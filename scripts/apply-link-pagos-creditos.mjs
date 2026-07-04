/**
 * apply-link-pagos-creditos.mjs
 * Fase 9C-6F — Apply controlado: vincular pagos_recibos.id_credito para match_alto.
 *
 * REGLAS ESTRICTAS:
 * - Solo actualiza pagos_recibos.id_credito
 * - Solo aplica categoría match_alto
 * - NO toca match_medio / ambiguo / no_aplica_credito / sin_match
 * - NO modifica cronograma_cuotas / creditos / socios
 * - NO toca usuarios / configuracion / auth.users
 * - NO crea migraciones
 * - NO modifica _client_files
 * - NO imprime datos personales completos
 *
 * Uso:
 *   node scripts/apply-link-pagos-creditos.mjs --dry-run
 *   node scripts/apply-link-pagos-creditos.mjs --apply --authorized
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DOCS_DIR = resolve(ROOT, 'docs/ai-recovery')

// ─── Args ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const IS_DRY_RUN = args.includes('--dry-run')
const IS_APPLY   = args.includes('--apply') && args.includes('--authorized')

if (!IS_DRY_RUN && !IS_APPLY) {
  console.error('\n❌ Debes especificar el modo de ejecución:')
  console.error('   --dry-run   : Simular sin modificar datos')
  console.error('   --apply --authorized : Aplicar cambios (requiere autorización explícita)')
  process.exit(1)
}

const MODE = IS_DRY_RUN ? 'DRY-RUN' : 'APPLY'

// ─── Env ──────────────────────────────────────────────────────────────────────

function loadEnv() {
  const p = resolve(ROOT, '.env.local')
  if (!existsSync(p)) return false
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const [key, ...rest] = line.split('=')
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
  }
  return true
}

if (!loadEnv()) { console.error('❌ .env.local no encontrado'); process.exit(1) }

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mask(val) {
  const s = String(val || '').trim()
  if (s.length === 0) return '(vacío)'
  return s.substring(0, 4) + '****'
}

function num(v) { return Number(v) || 0 }

function addMonths(fechaStr, months) {
  if (!fechaStr) return null
  const [y, m, d] = fechaStr.split('-').map(Number)
  const totalMonths = (m - 1) + months
  const newYear = y + Math.floor(totalMonths / 12)
  const newMonth = (totalMonths % 12) + 1
  const day = Math.min(d, new Date(newYear, newMonth, 0).getDate())
  return new Date(newYear, newMonth - 1, day)
}

function parseDate(str) {
  if (!str) return null
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function now() { return new Date().toISOString() }

// ─── Clasificación (idéntica a dry-run-link-pagos-creditos.mjs) ───────────────

function clasificarPago(p) {
  const hasCapital = num(p.monto_capital) > 0
  const hasInteres = num(p.monto_interes) > 0
  const hasAporte  = num(p.monto_aporte) > 0
  const hasFps     = num(p.monto_fps) > 0 || num(p.monto_fps_extra) > 0
  const hasOtros   = num(p.monto_otros) > 0

  const hasCreditComp    = hasCapital || hasInteres
  const hasNonCreditComp = hasAporte || hasFps || hasOtros

  const obs = String(p.observacion || '').toUpperCase()
  const tipoPago = String(p.tipo_pago || '').toUpperCase()
  const isTipoK = tipoPago === 'K' || obs.includes('TIPO K') || obs.includes('CUOTA K')

  if (isTipoK)                                 return 'E'
  if (hasCreditComp && hasNonCreditComp)       return 'D'
  if (hasCreditComp)                           return 'A'
  if (hasAporte && !hasCreditComp)             return 'B'
  if ((hasFps || hasOtros) && !hasCreditComp && !hasAporte) return 'C'
  return 'F'
}

const TOLERANCIA_CUOTA = 5

function encontrarMatch(pago, creditosPorSocio) {
  const grupo = clasificarPago(pago)

  if (grupo === 'B' || grupo === 'C') {
    return { categoria: 'no_aplica_credito', credito_id: null, razon: `grupo ${grupo} sin componente capital/interes`, grupo }
  }

  if (!pago.id_socio) {
    return { categoria: 'sin_match', credito_id: null, razon: 'pago sin id_socio', grupo }
  }

  const creditos = creditosPorSocio[pago.id_socio] || []

  if (creditos.length === 0) {
    return { categoria: 'sin_match', credito_id: null, razon: 'socio sin créditos en DB', grupo }
  }

  const pagoFecha = parseDate(pago.fecha)

  const enRango = creditos.filter(c => {
    const inicio = parseDate(c.fecha_desembolso)
    const fin    = addMonths(c.fecha_desembolso, c.plazo_meses || 120)
    if (!inicio || !pagoFecha) return false
    return pagoFecha >= inicio && pagoFecha <= fin
  })

  if (enRango.length === 1) {
    return {
      categoria: 'match_alto',
      credito_id: enRango[0].id,
      razon: `socio + único crédito en rango fecha (${enRango[0].estado})`,
      grupo,
    }
  }

  if (enRango.length > 1) {
    const montoCredito = num(pago.monto_capital) + num(pago.monto_interes)
    const porMonto = enRango.filter(c => Math.abs(num(c.cuota_mensual) - montoCredito) <= TOLERANCIA_CUOTA)

    if (porMonto.length === 1) {
      return {
        categoria: 'match_alto',
        credito_id: porMonto[0].id,
        razon: `socio + rango fecha + monto cuota coincide (±S/${TOLERANCIA_CUOTA})`,
        grupo,
      }
    }
    return {
      categoria: 'ambiguo',
      credito_id: null,
      razon: `${enRango.length} créditos en rango de fechas para el mismo socio`,
      grupo,
      candidatos: enRango.map(c => c.id),
    }
  }

  if (creditos.length === 1) {
    return {
      categoria: 'match_medio',
      credito_id: creditos[0].id,
      razon: `único crédito del socio (fuera de rango fecha, estado: ${creditos[0].estado})`,
      grupo,
    }
  }

  const vigentes = creditos.filter(c => c.estado === 'vigente')
  if (vigentes.length === 1) {
    return {
      categoria: 'match_medio',
      credito_id: vigentes[0].id,
      razon: 'único crédito vigente del socio (fecha fuera de rango)',
      grupo,
    }
  }
  if (vigentes.length > 1) {
    return {
      categoria: 'ambiguo',
      credito_id: null,
      razon: `${vigentes.length} créditos vigentes del socio, ninguno en rango de fecha`,
      grupo,
      candidatos: vigentes.map(c => c.id),
    }
  }

  return { categoria: 'sin_match', credito_id: null, razon: 'sin crédito en rango ni único vigente', grupo }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════════════════')
console.log(`  CEJUASSA — Apply Link pagos_recibos → creditos (9C-6F)`)
console.log(`  MODO: ${MODE}`)
if (IS_DRY_RUN) console.log('  ⚠️  DRY-RUN: NO se modificará ningún dato')
if (IS_APPLY)   console.log('  🔴 APPLY: Se actualizará pagos_recibos.id_credito para match_alto')
console.log('══════════════════════════════════════════════════════════════\n')

// ─── Preflight 1: leer y validar preview JSON ─────────────────────────────────

console.log('📋 Preflight 1 — Validar preview JSON...')
const previewPath = resolve(DOCS_DIR, 'proposed_pago_credito_links_preview.json')
if (!existsSync(previewPath)) {
  console.error('❌ Preview JSON no encontrado:', previewPath)
  console.error('   Ejecutar primero: npm run pagos:link-creditos:dry-run')
  process.exit(1)
}

const preview = JSON.parse(readFileSync(previewPath, 'utf8'))
const previewMatchAlto  = preview.totales?.match_alto || 0
const previewMatchMedio = preview.totales?.match_medio || 0
const previewAmbiguo    = preview.totales?.ambiguo || 0

console.log(`  Preview fase: ${preview.fase}`)
console.log(`  Preview generado: ${preview.generated_at}`)
console.log(`  match_alto en preview: ${previewMatchAlto}`)
console.log(`  match_medio en preview: ${previewMatchMedio}`)
console.log(`  ambiguo en preview: ${previewAmbiguo}`)

if (previewMatchAlto !== 28) {
  console.error(`\n❌ ABORTANDO: Se esperan exactamente 28 match_alto en preview, encontrados: ${previewMatchAlto}`)
  process.exit(1)
}
console.log('  ✅ Preview contiene exactamente 28 match_alto\n')

// ─── Preflight 2: fetch datos de DB ───────────────────────────────────────────

console.log('📥 Preflight 2 — Cargando pagos_recibos con id_credito = NULL desde DB...')
const { data: pagos, error: errPagos } = await sb
  .from('pagos_recibos')
  .select('id, nro_recibo, id_socio, id_credito, id_convenio, fecha, periodo, tipo_pago, estado_flujo, monto_aporte, monto_capital, monto_interes, monto_fps, monto_fps_extra, monto_otros, monto_total, observacion')
  .is('id_credito', null)

if (errPagos) { console.error('❌ Error cargando pagos:', errPagos.message); process.exit(1) }
console.log(`  → ${pagos.length} pagos con id_credito = NULL en DB`)

console.log('\n📥 Preflight 2 — Cargando créditos desde DB...')
const { data: creditos, error: errCred } = await sb
  .from('creditos')
  .select('id, id_socio, nro_pagare, fecha_desembolso, plazo_meses, cuota_mensual, monto_aprobado, saldo_capital, estado, tasa_interes')

if (errCred) { console.error('❌ Error cargando créditos:', errCred.message); process.exit(1) }
console.log(`  → ${creditos.length} créditos totales`)

const creditosPorSocio = {}
for (const c of creditos) {
  if (!creditosPorSocio[c.id_socio]) creditosPorSocio[c.id_socio] = []
  creditosPorSocio[c.id_socio].push(c)
}

// Índice de créditos por ID para lookup rápido
const creditosById = {}
for (const c of creditos) creditosById[c.id] = c

// ─── Clasificar y encontrar matches (igual que dry-run) ───────────────────────

console.log('\n🔍 Preflight 3 — Clasificando pagos y buscando matches...')
const resultados = []
for (const pago of pagos) {
  const { categoria, credito_id, razon, grupo, candidatos } = encontrarMatch(pago, creditosPorSocio)
  resultados.push({ pago, categoria, credito_id, razon, grupo, candidatos })
}

const matchAltoSet  = resultados.filter(r => r.categoria === 'match_alto')
const matchMedioSet = resultados.filter(r => r.categoria === 'match_medio')
const ambiguoSet    = resultados.filter(r => r.categoria === 'ambiguo')

console.log(`  → match_alto en DB: ${matchAltoSet.length}`)
console.log(`  → match_medio en DB: ${matchMedioSet.length}`)
console.log(`  → ambiguo en DB: ${ambiguoSet.length}`)

// ─── Preflight: validaciones de seguridad ─────────────────────────────────────

console.log('\n🔒 Preflight 4 — Verificaciones de seguridad...')
let preflightOk = true

// a) Exactamente 28 match_alto
if (matchAltoSet.length !== 28) {
  console.error(`  ❌ Se esperan 28 match_alto, encontrados: ${matchAltoSet.length}`)
  console.error('     La base de datos puede haber cambiado desde el dry-run 9C-6E.')
  preflightOk = false
} else {
  console.log(`  ✅ match_alto en DB = 28 (coincide con preview)`)
}

// b) Confirmar que preview y DB coinciden en conteo match_alto
if (matchAltoSet.length === previewMatchAlto) {
  console.log(`  ✅ Conteo match_alto DB (${matchAltoSet.length}) coincide con preview (${previewMatchAlto})`)
} else {
  console.error(`  ❌ Conteo match_alto DB (${matchAltoSet.length}) difiere del preview (${previewMatchAlto})`)
  preflightOk = false
}

// c) Ningún pago en set match_alto ya tiene id_credito
const pagoConIdExistente = matchAltoSet.filter(r => r.pago.id_credito !== null)
if (pagoConIdExistente.length > 0) {
  console.error(`  ❌ ${pagoConIdExistente.length} pagos del set match_alto ya tienen id_credito (no debería ocurrir)`)
  preflightOk = false
} else {
  console.log(`  ✅ Todos los pagos match_alto tienen id_credito = NULL`)
}

// d) Cada crédito propuesto existe en DB
const creditos_faltantes = matchAltoSet.filter(r => r.credito_id && !creditosById[r.credito_id])
if (creditos_faltantes.length > 0) {
  console.error(`  ❌ ${creditos_faltantes.length} créditos propuestos no existen en DB`)
  preflightOk = false
} else {
  console.log(`  ✅ Todos los créditos propuestos existen en DB`)
}

// e) No hay ambiguos en el set de apply
if (ambiguoSet.length > 0) {
  console.log(`  ⚠️  ${ambiguoSet.length} pagos ambiguos detectados (NO serán aplicados — correcto)`)
}

// f) No hay match_medio mezclados en el set de apply (solo verificación)
if (matchMedioSet.length > 0) {
  console.log(`  ⚠️  ${matchMedioSet.length} match_medio detectados (NO serán aplicados — correcto)`)
}

// g) Verificar que ningún pago del set tiene categoría distinta a match_alto
const categoriasNoAlto = matchAltoSet.filter(r => r.categoria !== 'match_alto')
if (categoriasNoAlto.length > 0) {
  console.error(`  ❌ ${categoriasNoAlto.length} elementos con categoría distinta a match_alto en el set`)
  preflightOk = false
} else {
  console.log(`  ✅ Set de apply contiene únicamente categoría match_alto`)
}

if (!preflightOk) {
  console.error('\n❌ PREFLIGHT FALLIDO — Abortando. Revisar errores arriba.')
  process.exit(1)
}

console.log('\n  ✅ Todos los checks de preflight pasaron\n')

// ─── Mostrar plan ─────────────────────────────────────────────────────────────

console.log('📋 Plan de apply:')
console.log(`  Tabla:   pagos_recibos`)
console.log(`  Campo:   id_credito`)
console.log(`  Acción:  UPDATE ... SET id_credito = ? WHERE id = ? AND id_credito IS NULL`)
console.log(`  Filas:   ${matchAltoSet.length}`)
console.log(`\n  Muestra enmascarada:`)
for (const r of matchAltoSet.slice(0, 5)) {
  console.log(`    pago=${mask(r.pago.id)} → cred=${mask(r.credito_id)} [${r.razon.substring(0, 50)}]`)
}
if (matchAltoSet.length > 5) console.log(`    ... y ${matchAltoSet.length - 5} más`)

// ─── DRY-RUN: generar reporte ─────────────────────────────────────────────────

if (IS_DRY_RUN) {
  console.log('\n══════════════════════════════════════════════════════════════')
  console.log('  DRY-RUN completado — NO se modificó ningún dato')
  console.log('══════════════════════════════════════════════════════════════\n')

  const ts = now()
  if (!existsSync(DOCS_DIR)) mkdirSync(DOCS_DIR, { recursive: true })

  const reportLines = [
    `# PAGOS_CREDITOS_LINK_APPLY_DRY_RUN.md`,
    ``,
    `**Fase:** 9C-6F — Apply controlado link pagos → créditos`,
    `**Modo:** DRY-RUN (SOLO LECTURA — ningún dato fue modificado)`,
    `**Generado:** ${ts}`,
    ``,
    `## Resultado del preflight`,
    ``,
    `| Check | Resultado |`,
    `|---|---|`,
    `| Preview JSON existe | ✅ |`,
    `| match_alto en preview | ${previewMatchAlto} ✅ |`,
    `| match_alto en DB | ${matchAltoSet.length} ✅ |`,
    `| Conteos DB = preview | ✅ |`,
    `| Todos los pagos tienen id_credito = NULL | ✅ |`,
    `| Todos los créditos propuestos existen | ✅ |`,
    `| Set de apply = solo match_alto | ✅ |`,
    ``,
    `## Plan de apply`,
    ``,
    `- **Tabla afectada:** \`pagos_recibos\``,
    `- **Campo a actualizar:** \`id_credito\``,
    `- **Filas a actualizar:** ${matchAltoSet.length}`,
    `- **Categoría:** \`match_alto\` únicamente`,
    ``,
    `## Tablas NO modificadas (confirmado)`,
    ``,
    `- \`cronograma_cuotas\` — NO modificada`,
    `- \`creditos\` — NO modificada`,
    `- \`socios\` — NO modificada`,
    `- \`usuarios\` — NO modificada`,
    `- \`configuracion\` — NO modificada`,
    `- \`auth.users\` — NO modificada`,
    ``,
    `## Muestra enmascarada (${Math.min(10, matchAltoSet.length)} de ${matchAltoSet.length})`,
    ``,
    `| pago_masked | socio_masked | fecha | grupo | credito_masked | razon |`,
    `|---|---|---|---|---|---|`,
    ...matchAltoSet.slice(0, 10).map(r =>
      `| ${mask(r.pago.id)} | ${mask(r.pago.id_socio)} | ${r.pago.fecha} | ${r.grupo} | ${mask(r.credito_id)} | ${r.razon} |`
    ),
    ``,
    `## Conteos de pagos sin modificar`,
    ``,
    `| Categoría | Cantidad |`,
    `|---|---|`,
    `| match_medio (NO aplicados) | ${matchMedioSet.length} |`,
    `| ambiguo (NO aplicados) | ${ambiguoSet.length} |`,
    `| no_aplica_credito (NO aplicados) | ${resultados.filter(r => r.categoria === 'no_aplica_credito').length} |`,
    `| sin_match (NO aplicados) | ${resultados.filter(r => r.categoria === 'sin_match').length} |`,
    ``,
    `## Riesgos`,
    ``,
    `- Los ${matchMedioSet.length} match_medio requieren revisión manual antes de aplicar en una fase posterior.`,
    `- Los ${ambiguoSet.length} ambiguos requieren revisión manual del área de Créditos.`,
    `- Esta fase NO recalcula saldos, cuotas ni estados — eso es responsabilidad de fases posteriores.`,
    ``,
    `## Autorización requerida`,
    ``,
    `Para ejecutar el apply, enviar exactamente:`,
    ``,
    `\`\`\``,
    `VINCULAR 28 PAGOS 9C-6F`,
    `\`\`\``,
    ``,
    `Luego ejecutar:`,
    `\`\`\`bash`,
    `npm run pagos:link-creditos:apply`,
    `\`\`\``,
  ]

  const reportPath = resolve(DOCS_DIR, 'PAGOS_CREDITOS_LINK_APPLY_DRY_RUN.md')
  writeFileSync(reportPath, reportLines.join('\n'), 'utf8')
  console.log(`💾 Reporte dry-run guardado en: docs/ai-recovery/PAGOS_CREDITOS_LINK_APPLY_DRY_RUN.md`)
  console.log(`\n⏸️  Para continuar, enviar autorización exacta: VINCULAR 28 PAGOS 9C-6F`)
  console.log(`   Luego ejecutar: npm run pagos:link-creditos:apply\n`)
  process.exit(0)
}

// ─── APPLY ────────────────────────────────────────────────────────────────────

console.log('\n🔴 Iniciando APPLY...')
console.log(`  Actualizando ${matchAltoSet.length} registros en pagos_recibos.id_credito...\n`)

const resultadosApply = []
let exitosos = 0
let fallidos = 0

for (const r of matchAltoSet) {
  const { error } = await sb
    .from('pagos_recibos')
    .update({ id_credito: r.credito_id })
    .eq('id', r.pago.id)
    .is('id_credito', null) // guardarda de seguridad

  if (error) {
    console.error(`  ❌ Error actualizando pago ${mask(r.pago.id)}: ${error.message}`)
    resultadosApply.push({ pago_masked: mask(r.pago.id), credito_masked: mask(r.credito_id), ok: false, error: error.message })
    fallidos++
  } else {
    console.log(`  ✅ pago=${mask(r.pago.id)} → id_credito=${mask(r.credito_id)}`)
    resultadosApply.push({ pago_masked: mask(r.pago.id), credito_masked: mask(r.credito_id), ok: true })
    exitosos++
  }
}

console.log(`\n══════════════════════════════════════════════════════════════`)
console.log(`  APPLY completado`)
console.log(`  ✅ Exitosos: ${exitosos}`)
if (fallidos > 0) console.log(`  ❌ Fallidos: ${fallidos}`)
console.log(`══════════════════════════════════════════════════════════════\n`)

// ─── Verificación post-apply ──────────────────────────────────────────────────

console.log('🔍 Verificación post-apply...')
const { data: pagosPostApply, error: errPost } = await sb
  .from('pagos_recibos')
  .select('id')
  .is('id_credito', null)

const restantesNullTotal = errPost ? '(error)' : pagosPostApply.length
console.log(`  Pagos con id_credito = NULL restantes: ${restantesNullTotal}`)

// ─── Reporte apply ────────────────────────────────────────────────────────────

const ts = now()
if (!existsSync(DOCS_DIR)) mkdirSync(DOCS_DIR, { recursive: true })

const reportLines = [
  `# PAGOS_CREDITOS_LINK_APPLY_REPORT.md`,
  ``,
  `**Fase:** 9C-6F — Apply controlado link pagos → créditos`,
  `**Modo:** APPLY EJECUTADO`,
  `**Generado:** ${ts}`,
  ``,
  `## Resultado`,
  ``,
  `| Métrica | Valor |`,
  `|---|---|`,
  `| Pagos actualizados exitosamente | ${exitosos} |`,
  `| Pagos con error | ${fallidos} |`,
  `| Pagos con id_credito = NULL post-apply | ${restantesNullTotal} |`,
  ``,
  `## Confirmaciones`,
  ``,
  `- ✅ Solo se actualizó \`pagos_recibos.id_credito\``,
  `- ✅ Solo se aplicaron registros con categoría \`match_alto\``,
  `- ✅ \`cronograma_cuotas\` NO fue modificada`,
  `- ✅ \`creditos\` NO fue modificada`,
  `- ✅ \`socios\` NO fue modificada`,
  `- ✅ \`usuarios\` NO fue modificada`,
  `- ✅ \`configuracion\` NO fue modificada`,
  `- ✅ \`auth.users\` NO fue modificada`,
  `- ✅ No se insertaron ni eliminaron datos`,
  ``,
  `## Detalle de filas aplicadas (enmascarado)`,
  ``,
  `| pago_masked | credito_masked | ok | error |`,
  `|---|---|---|---|`,
  ...resultadosApply.map(r => `| ${r.pago_masked} | ${r.credito_masked} | ${r.ok ? '✅' : '❌'} | ${r.error || ''} |`),
  ``,
  `## Categorías NO aplicadas (confirmado)`,
  ``,
  `- \`match_medio\`: ${matchMedioSet.length} registros — requieren revisión manual`,
  `- \`ambiguo\`: ${ambiguoSet.length} registros — requieren revisión manual`,
  `- \`no_aplica_credito\`: ${resultados.filter(r => r.categoria === 'no_aplica_credito').length} registros — sin componente de crédito`,
  `- \`sin_match\`: ${resultados.filter(r => r.categoria === 'sin_match').length} registros — sin datos suficientes`,
  ``,
  `## Riesgos restantes`,
  ``,
  `- ${matchMedioSet.length} match_medio pendientes de revisión manual.`,
  `- ${ambiguoSet.length} ambiguos pendientes de revisión manual.`,
  `- Saldos, cuotas y estados no han sido recalculados (fase posterior).`,
  `- Hay ${restantesNullTotal} pagos con id_credito = NULL restantes.`,
  ``,
  `## Próxima fase recomendada`,
  ``,
  `Revisar manualmente los ${matchMedioSet.length} match_medio con el área de Créditos.`,
  `Luego evaluar vinculación de cuotas (cronograma_cuotas) en una fase separada.`,
]

const reportPath = resolve(DOCS_DIR, 'PAGOS_CREDITOS_LINK_APPLY_REPORT.md')
writeFileSync(reportPath, reportLines.join('\n'), 'utf8')
console.log(`\n💾 Reporte apply guardado en: docs/ai-recovery/PAGOS_CREDITOS_LINK_APPLY_REPORT.md`)

if (fallidos > 0) {
  console.error(`\n⚠️  ${fallidos} pagos fallaron durante el apply. Revisar el reporte.`)
  process.exit(1)
}

console.log(`\n✅ Fase 9C-6F completada. ${exitosos} pagos vinculados correctamente.\n`)
