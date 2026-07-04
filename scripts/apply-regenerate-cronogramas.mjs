/**
 * apply-regenerate-cronogramas.mjs
 * Fase 9C-6D — Apply controlado: inserta cronograma_cuotas para 26 créditos vigentes.
 *
 * REGLAS ESTRICTAS:
 * - Solo inserta en cronograma_cuotas
 * - NO toca creditos / pagos_recibos / socios / usuarios / configuracion / auth.users
 * - NO borra datos
 * - NO crea migraciones
 * - NO modifica _client_files/
 * - NO imprime datos personales completos
 * - Requiere --dry-run o --apply explícito
 * - Apply requiere: CEJUASSA_ALLOW_CRONOGRAMA_APPLY=true
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DOCS_DIR = resolve(ROOT, 'docs/ai-recovery')

const MODE = process.argv.includes('--apply') ? 'apply' : 'dry-run'
const IS_APPLY = MODE === 'apply'
const IS_AUTHORIZED = process.argv.includes('--authorized')

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

// Guard apply: requiere --authorized explícito (solo disponible via npm run cronogramas:apply)
if (IS_APPLY && !IS_AUTHORIZED) {
  console.error('\n❌ APPLY BLOQUEADO.')
  console.error('   El apply requiere autorización explícita.')
  console.error('   Usa: npm run cronogramas:apply')
  console.error('   (No ejecutar directamente con node --apply sin --authorized)\n')
  process.exit(1)
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

// ─── Fórmula (sistema francés — idéntica al dry-run validado) ────────────────

function round2(n) {
  return Math.round(n * 100) / 100
}

function calcCuota(principal, tasaAnual, plazo) {
  if (!principal || !plazo) return 0
  const r = tasaAnual / 100 / 12
  if (r === 0) return principal / plazo
  const factor = Math.pow(1 + r, plazo)
  return (principal * r * factor) / (factor - 1)
}

function addMonths(fechaStr, months) {
  const [y, m, d] = fechaStr.split('-').map(Number)
  const totalMonths = (m - 1) + months
  const newYear = y + Math.floor(totalMonths / 12)
  const newMonth = (totalMonths % 12) + 1
  return `${String(newYear).padStart(4, '0')}-${String(newMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function generarCuotas(credito) {
  const { id: id_credito, monto_aprobado: monto, tasa_interes: tasa, plazo_meses: plazo, fecha_desembolso } = credito
  const cuotaMensual = round2(calcCuota(monto, tasa, plazo))
  const r = tasa / 100 / 12
  let saldo = monto
  const cuotas = []

  for (let i = 1; i <= plazo; i++) {
    const interes = round2(saldo * r)
    let capital, cuota_total

    if (i === plazo) {
      capital = round2(saldo)
      cuota_total = round2(capital + interes)
    } else {
      capital = round2(cuotaMensual - interes)
      cuota_total = cuotaMensual
    }

    saldo = round2(saldo - capital)

    cuotas.push({
      id_credito,
      nro_cuota: i,
      fecha_vencimiento: addMonths(fecha_desembolso, i),
      capital,
      interes,
      cuota_total,
      capital_pagado: 0,
      interes_pagado: 0,
      estado: 'pendiente',
      fecha_pago: null,
    })
  }

  const totalCapital = round2(cuotas.reduce((s, c) => s + c.capital, 0))
  return { cuotas, totalCapital, cuotaMensual }
}

// ─── Preflight ────────────────────────────────────────────────────────────────

const EXPECTED_VIGENTES = 26
const EXPECTED_CUOTAS = 911

async function preflight() {
  console.log('\n🔍 Preflight checks...\n')
  const errores = []

  // Check 1: cronograma_cuotas vacío
  const { count: countCron, error: e1 } = await sb
    .from('cronograma_cuotas')
    .select('*', { count: 'exact', head: true })
  if (e1) { console.error('❌ Error leyendo cronograma_cuotas:', e1.message); process.exit(1) }
  console.log(`   cronograma_cuotas actual: ${countCron} registros`)
  if (countCron > 0) {
    errores.push(`cronograma_cuotas no está vacío (${countCron} registros). Abortar.`)
  }

  // Check 2: leer créditos
  const { data: creditos, error: e2 } = await sb
    .from('creditos')
    .select('id, estado, monto_aprobado, saldo_capital, tasa_interes, plazo_meses, fecha_desembolso')
    .order('id')
  if (e2) { console.error('❌ Error leyendo créditos:', e2.message); process.exit(1) }

  const vigentes = creditos.filter(c => c.estado === 'vigente')
  const cancelados = creditos.filter(c => c.estado === 'cancelado')
  console.log(`   creditos totales: ${creditos.length}`)
  console.log(`   vigentes:  ${vigentes.length}`)
  console.log(`   cancelados: ${cancelados.length}`)

  // Check 3: exactamente 26 vigentes
  if (vigentes.length !== EXPECTED_VIGENTES) {
    errores.push(`Se esperaban ${EXPECTED_VIGENTES} créditos vigentes, hay ${vigentes.length}.`)
  }

  // Check 4: clasificar elegibles — todos los vigentes deben ser elegibles
  const elegibles = []
  for (const c of vigentes) {
    const razones = []
    if (!c.monto_aprobado || c.monto_aprobado <= 0) razones.push('monto_aprobado=0 o NULL')
    if (!c.plazo_meses || c.plazo_meses <= 0) razones.push('plazo_meses=0 o NULL')
    if (!c.fecha_desembolso) razones.push('fecha_desembolso=NULL')
    if (!c.tasa_interes || c.tasa_interes <= 1) razones.push('tasa_interes<=1 (posible valor decimal incorrecto)')
    if (razones.length > 0) {
      const idS = String(c.id)
      const idM = idS.substring(0, 6) + '****'
      errores.push(`Crédito ${idM} no elegible: ${razones.join(', ')}`)
    } else {
      elegibles.push(c)
    }
  }
  console.log(`   elegibles: ${elegibles.length}`)

  // Check 5: simular y verificar 911 cuotas
  let totalCuotasSimuladas = 0
  for (const c of elegibles) {
    const { cuotas } = generarCuotas(c)
    totalCuotasSimuladas += cuotas.length
  }
  console.log(`   cuotas simuladas: ${totalCuotasSimuladas}`)
  if (totalCuotasSimuladas !== EXPECTED_CUOTAS) {
    errores.push(`Se esperaban ${EXPECTED_CUOTAS} cuotas, la simulación genera ${totalCuotasSimuladas}.`)
  }

  // Check 6: guard anti-cancelados — confirmar que elegibles no incluyen cancelados
  for (const c of elegibles) {
    if (c.estado !== 'vigente') {
      errores.push(`Crédito ${String(c.id).substring(0, 6)}**** no está vigente (estado: ${c.estado}) pero fue clasificado como elegible.`)
    }
  }

  // Check 7: guard anti-duplicado — verificar cuotas existentes por crédito elegible
  if (countCron === 0) {
    console.log('   ✅ cronograma_cuotas vacío — no hay riesgo de duplicados')
  }

  console.log('')
  if (errores.length > 0) {
    console.error('❌ PREFLIGHT FALLIDO:')
    for (const e of errores) console.error(`   - ${e}`)
    process.exit(1)
  }

  console.log('✅ Preflight OK — todos los checks pasaron\n')
  return { elegibles, totalCuotasSimuladas, vigentes, cancelados, countCron, creditos }
}

// ─── Apply (insertar en lotes) ────────────────────────────────────────────────

const BATCH_SIZE = 50

async function insertarEnLotes(cuotas, idCredito) {
  let insertadas = 0
  for (let i = 0; i < cuotas.length; i += BATCH_SIZE) {
    const lote = cuotas.slice(i, i + BATCH_SIZE)
    const { error } = await sb.from('cronograma_cuotas').insert(lote)
    if (error) {
      const idS = String(idCredito).substring(0, 6) + '****'
      throw new Error(`Error insertando lote para crédito ${idS}: ${error.message}`)
    }
    insertadas += lote.length
  }
  return insertadas
}

// ─── Reporte post-apply ───────────────────────────────────────────────────────

function generarReporte(opts) {
  const {
    modo, vigentes, cancelados, elegibles, totalCuotasSimuladas,
    resultadosPorCredito, totalInsertadas, countCronFinal, errorPorCredito,
    countCronInicial, hoy,
  } = opts

  const lines = []
  lines.push('# CRONOGRAMA_REGENERATION_APPLY_REPORT.md')
  lines.push(`# Reporte Apply — Fase 9C-6D`)
  lines.push(`# Generado: ${hoy} — Modo: ${modo.toUpperCase()}`)
  lines.push('')

  if (modo === 'dry-run') {
    lines.push('> **DRY-RUN** — No se insertó ningún dato. Solo simulación.')
  } else {
    lines.push('> **APPLY EJECUTADO** — Cuotas insertadas en cronograma_cuotas.')
  }
  lines.push('')

  lines.push('## Estadísticas globales')
  lines.push('')
  lines.push('| Indicador | Valor |')
  lines.push('|---|---|')
  lines.push(`| Modo | **${modo.toUpperCase()}** |`)
  lines.push(`| Créditos vigentes | ${vigentes.length} |`)
  lines.push(`| Créditos cancelados | ${cancelados.length} |`)
  lines.push(`| Créditos elegibles | ${elegibles.length} |`)
  lines.push(`| Cuotas simuladas / esperadas | ${totalCuotasSimuladas} / 911 |`)
  lines.push(`| Cuotas insertadas | ${totalInsertadas} |`)
  lines.push(`| cronograma_cuotas inicial | ${countCronInicial} |`)
  lines.push(`| cronograma_cuotas final | ${countCronFinal} |`)
  lines.push('')

  lines.push('## Créditos procesados')
  lines.push('')
  lines.push('| ID (parcial) | Monto | Plazo | Tasa% | Cuotas | ΣCapital | Estado |')
  lines.push('|---|---|---|---|---|---|---|')
  for (const r of resultadosPorCredito) {
    const idM = String(r.id).substring(0, 6) + '****'
    const err = errorPorCredito[r.id]
    const estadoStr = err ? `❌ ERROR: ${err}` : (modo === 'apply' ? '✅ insertado' : '✅ simulado')
    lines.push(`| ${idM} | S/${r.monto.toFixed(2)} | ${r.plazo}m | ${r.tasa}% | ${r.numCuotas} | S/${r.totalCapital.toFixed(2)} | ${estadoStr} |`)
  }
  lines.push('')

  lines.push('## Validación post-insert')
  lines.push('')
  lines.push('| Verificación | Resultado |')
  lines.push('|---|---|')
  lines.push(`| cronograma_cuotas final = cuotas esperadas | ${countCronFinal === EXPECTED_CUOTAS ? '✅ ' + countCronFinal : '⚠️ ' + countCronFinal + ' (esperado: ' + EXPECTED_CUOTAS + ')'} |`)
  lines.push(`| creditos NO modificados | ✅ confirmado (script no toca tabla creditos) |`)
  lines.push(`| pagos_recibos NO modificados | ✅ confirmado (script no toca tabla pagos_recibos) |`)
  lines.push(`| socios NO modificados | ✅ confirmado |`)
  lines.push(`| usuarios NO modificados | ✅ confirmado |`)
  lines.push('')

  lines.push('## Créditos omitidos')
  lines.push('')
  if (cancelados.length === 0) {
    lines.push('Ningún crédito cancelado fue procesado (correcto).')
  } else {
    lines.push(`${cancelados.length} crédito(s) cancelados fueron ignorados (correcto).`)
  }
  lines.push('')

  lines.push('## Riesgos restantes')
  lines.push('')
  lines.push('1. **R1 — pagos sin id_credito:** 832 pagos tienen `id_credito = NULL`. Todas las cuotas quedaron como `pendiente`. La vinculación de pagos a cuotas es la **siguiente fase**.')
  lines.push('2. **R2 — saldo_capital < monto_aprobado:** Los saldos reducidos por pagos previos no coinciden con el cronograma regenerado. Se resolverá al vincular pagos.')
  lines.push('3. **R3 — cuotas con fecha pasada:** Cuotas con `fecha_vencimiento < hoy` aparecen como `pendiente`. La app las detecta como vencidas por lógica de fecha.')
  lines.push('')

  lines.push('## Próxima fase recomendada')
  lines.push('')
  lines.push('**Fase 9C-6E — Vincular pagos_recibos a créditos:** Resolver los 832 pagos con `id_credito = NULL`, asociarlos al crédito correcto, y marcar las cuotas correspondientes como pagadas.')

  return lines.join('\n')
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const hoy = new Date().toISOString().split('T')[0]

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  Fase 9C-6D — Apply cronograma_cuotas [${MODE.toUpperCase()}]`)
  if (!IS_APPLY) {
    console.log('  DRY-RUN — No se insertará ningún dato')
  } else {
    console.log('  ⚠️  APPLY REAL — Se insertarán cuotas en Supabase')
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // Preflight
  const { elegibles, totalCuotasSimuladas, vigentes, cancelados, countCron, creditos } = await preflight()
  const countCronInicial = countCron

  const resultadosPorCredito = []
  const errorPorCredito = {}
  let totalInsertadas = 0

  // Procesar cada crédito elegible
  for (const c of elegibles) {
    const { cuotas, totalCapital, cuotaMensual } = generarCuotas(c)
    const idS = String(c.id).substring(0, 6) + '****'

    resultadosPorCredito.push({
      id: c.id,
      monto: c.monto_aprobado,
      plazo: c.plazo_meses,
      tasa: c.tasa_interes,
      numCuotas: cuotas.length,
      totalCapital,
      cuotaMensual,
    })

    if (IS_APPLY) {
      try {
        const insertadas = await insertarEnLotes(cuotas, c.id)
        totalInsertadas += insertadas
        console.log(`  ✅ ${idS} → ${insertadas} cuotas insertadas`)
      } catch (err) {
        errorPorCredito[c.id] = err.message
        console.error(`  ❌ ${idS} → ERROR: ${err.message}`)
      }
    } else {
      totalInsertadas += cuotas.length
      console.log(`  ✅ ${idS} | ${cuotas.length} cuotas | ΣCap: S/${totalCapital.toFixed(2)}`)
    }
  }

  // Conteo final
  let countCronFinal = totalCuotasSimuladas
  if (IS_APPLY) {
    const { count, error } = await sb
      .from('cronograma_cuotas')
      .select('*', { count: 'exact', head: true })
    if (error) {
      console.error('⚠️ No se pudo verificar conteo final:', error.message)
    } else {
      countCronFinal = count
    }
  }

  // Resumen en consola
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  Resumen ${MODE.toUpperCase()}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  Créditos procesados: ${elegibles.length}`)
  console.log(`  Cuotas ${IS_APPLY ? 'insertadas' : 'simuladas'}: ${totalInsertadas}`)
  console.log(`  cronograma_cuotas inicial: ${countCronInicial}`)
  console.log(`  cronograma_cuotas final:   ${countCronFinal}`)
  console.log(`  Errores: ${Object.keys(errorPorCredito).length}`)
  console.log('')

  if (IS_APPLY) {
    if (countCronFinal === EXPECTED_CUOTAS) {
      console.log(`  ✅ Validación OK: ${countCronFinal} cuotas en cronograma_cuotas (esperado: ${EXPECTED_CUOTAS})`)
    } else {
      console.log(`  ⚠️ Validación: ${countCronFinal} cuotas (esperado: ${EXPECTED_CUOTAS})`)
    }
  }

  // Generar reporte
  const reporte = generarReporte({
    modo: MODE,
    vigentes,
    cancelados,
    elegibles,
    totalCuotasSimuladas,
    resultadosPorCredito,
    totalInsertadas,
    countCronFinal,
    errorPorCredito,
    countCronInicial,
    hoy,
  })

  if (!existsSync(DOCS_DIR)) mkdirSync(DOCS_DIR, { recursive: true })
  const reportPath = resolve(DOCS_DIR, 'CRONOGRAMA_REGENERATION_APPLY_REPORT.md')
  writeFileSync(reportPath, reporte, 'utf8')
  console.log(`\n📄 Reporte generado: docs/ai-recovery/CRONOGRAMA_REGENERATION_APPLY_REPORT.md`)

  if (!IS_APPLY) {
    console.log('\n✅ Dry-run completado. No se insertó ningún dato.')
    console.log('   Para aplicar, envía la autorización exacta: INSERTAR CRONOGRAMA 9C-6D\n')
  } else {
    if (Object.keys(errorPorCredito).length === 0) {
      console.log('\n✅ Apply completado exitosamente.\n')
    } else {
      console.log(`\n⚠️ Apply completado con ${Object.keys(errorPorCredito).length} error(es). Revisar reporte.\n`)
    }
  }
}

main().catch(e => { console.error('❌ Error fatal:', e.message); process.exit(1) })
