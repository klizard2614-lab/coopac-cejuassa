/**
 * dry-run-apply-pagos-to-cuotas.mjs
 * Fase 9C-6H.0 — Dry-run: simular cómo los 28 pagos vinculados afectarían cronograma_cuotas.
 *
 * REGLAS ESTRICTAS — SOLO LECTURA:
 * - NO insert / NO update / NO delete / NO truncate
 * - NO toca cronograma_cuotas / creditos / pagos_recibos / socios
 * - NO toca usuarios / configuracion / auth.users
 * - NO crea migraciones
 * - NO modifica _client_files/
 * - NO imprime datos personales completos
 * - Solo dry-run, propuesta y reporte
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DOCS_DIR = resolve(ROOT, 'docs/ai-recovery')

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

function num(v) { return typeof v === 'number' ? v : (parseFloat(v) || 0) }
function round2(n) { return Math.round(n * 100) / 100 }
function now() { return new Date().toISOString() }

// ─── Regla de monto aplicable ─────────────────────────────────────────────────
// Solo se aplican a cuotas: monto_capital + monto_interes
// Se excluyen: monto_aporte, monto_fps, monto_fps_extra, monto_otros
// Esta regla es consistente con pagos/nuevo/page.tsx (paso 3)

function montoAplicableACuota(pago) {
  return {
    capital: round2(num(pago.monto_capital)),
    interes: round2(num(pago.monto_interes)),
    total:   round2(num(pago.monto_capital) + num(pago.monto_interes)),
  }
}

// ─── Confianza ────────────────────────────────────────────────────────────────
// alta  : monto aplicado ≈ cuota_total (≤ S/1.00 de diferencia) y queda 'pagada'
// media : pago parcial o diferencia ≤ 10% del total de cuota
// baja  : diferencia > 10%, o pago no asignable

function calcConfianza(montoAplicado, cuotaTotal, estadoPropuesto) {
  if (estadoPropuesto === 'pagada') {
    const diff = Math.abs(montoAplicado - cuotaTotal)
    if (diff <= 1.0)  return 'alta'
    if (diff <= cuotaTotal * 0.10) return 'media'
    return 'baja'
  }
  if (estadoPropuesto === 'parcial') return 'media'
  return 'baja'
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════════════════')
console.log('  CEJUASSA — Dry-run: Aplicar pagos a cuotas (9C-6H.0)')
console.log('  MODO: DRY-RUN — NO se modificará ningún dato')
console.log('══════════════════════════════════════════════════════════════\n')

// ─── Paso 1: Cargar los 28 pagos vinculados (id_credito IS NOT NULL) ──────────

console.log('📥 Cargando pagos_recibos con id_credito IS NOT NULL...')
const { data: pagos, error: errPagos } = await sb
  .from('pagos_recibos')
  .select('id, id_socio, id_credito, nro_recibo, fecha, periodo, monto_capital, monto_interes, monto_aporte, monto_fps, monto_fps_extra, monto_otros, monto_total, observacion')
  .not('id_credito', 'is', null)
  .order('fecha', { ascending: true })

if (errPagos) { console.error('❌ Error cargando pagos:', errPagos.message); process.exit(1) }

console.log(`  → ${pagos.length} pagos con id_credito asignado`)

if (pagos.length === 0) {
  console.error('❌ No hay pagos con id_credito. ¿Se ejecutó la Fase 9C-6F?')
  process.exit(1)
}

if (pagos.length !== 28) {
  console.warn(`  ⚠️  Se esperan 28 pagos vinculados, encontrados: ${pagos.length}`)
}

// ─── Paso 2: Obtener IDs de créditos únicos ───────────────────────────────────

const creditoIds = [...new Set(pagos.map(p => p.id_credito))]
console.log(`  → ${creditoIds.length} créditos únicos referenciados`)

// ─── Paso 3: Cargar cronograma_cuotas para esos créditos ─────────────────────

console.log('\n📥 Cargando cronograma_cuotas para los créditos vinculados...')
const { data: todasLasCuotas, error: errCuotas } = await sb
  .from('cronograma_cuotas')
  .select('id, id_credito, nro_cuota, fecha_vencimiento, capital, interes, cuota_total, capital_pagado, interes_pagado, estado, fecha_pago')
  .in('id_credito', creditoIds)
  .order('nro_cuota', { ascending: true })

if (errCuotas) { console.error('❌ Error cargando cuotas:', errCuotas.message); process.exit(1) }
console.log(`  → ${todasLasCuotas.length} cuotas cargadas para ${creditoIds.length} créditos`)

// ─── Paso 4: Cargar datos de créditos para referencia ────────────────────────

console.log('\n📥 Cargando datos de créditos...')
const { data: creditos, error: errCred } = await sb
  .from('creditos')
  .select('id, nro_pagare, monto_aprobado, saldo_capital, cuota_mensual, plazo_meses, tasa_interes, estado')
  .in('id', creditoIds)

if (errCred) { console.error('❌ Error cargando créditos:', errCred.message); process.exit(1) }
console.log(`  → ${creditos.length} créditos cargados`)

const creditoById = {}
for (const c of creditos) creditoById[c.id] = c

// ─── Paso 5: Agrupar cuotas por id_credito ───────────────────────────────────

const cuotasPorCredito = {}
for (const cuota of todasLasCuotas) {
  if (!cuotasPorCredito[cuota.id_credito]) cuotasPorCredito[cuota.id_credito] = []
  cuotasPorCredito[cuota.id_credito].push(cuota)
}

// Agrupar pagos por id_credito, ordenados por fecha
const pagosPorCredito = {}
for (const pago of pagos) {
  if (!pagosPorCredito[pago.id_credito]) pagosPorCredito[pago.id_credito] = []
  pagosPorCredito[pago.id_credito].push(pago)
}

// ─── Paso 6: Simulación ───────────────────────────────────────────────────────

console.log('\n🧮 Simulando aplicación de pagos a cuotas...')
console.log('   Regla: capital + interés del pago → cuota más antigua pendiente/vencida/parcial')
console.log('   Consistente con lógica de pagos/nuevo/page.tsx (Fase 3B / R7)\n')

const propuestas = []
const pagosNoAsignables = []
const resumenPorCredito = []

let totalCuotasPropuestasPagadas = 0
let totalCuotasPropuestasParciales = 0

for (const creditoId of creditoIds) {
  const credito = creditoById[creditoId]
  const cuotas = cuotasPorCredito[creditoId] || []
  const pagosDelCredito = pagosPorCredito[creditoId] || []

  if (cuotas.length === 0) {
    console.log(`  ⚠️  Crédito ${mask(creditoId)}: sin cuotas en cronograma`)
    for (const p of pagosDelCredito) {
      pagosNoAsignables.push({ pago_id: p.id, credito_id: creditoId, razon: 'sin cuotas en cronograma' })
    }
    continue
  }

  // Estado local de cada cuota (en memoria — NO se escribe a DB)
  const estadoLocal = {}
  for (const c of cuotas) {
    estadoLocal[c.id] = {
      capital_pagado:  round2(num(c.capital_pagado)),
      interes_pagado:  round2(num(c.interes_pagado)),
      estado:          c.estado,
    }
  }

  // Estadísticas del crédito
  let cuotasPagadasCredito = 0
  let cuotasParcialCredito = 0
  let pagosAsignadosCredito = 0
  let pagosNoAsignadosCredito = 0

  console.log(`\n  Crédito ${mask(creditoId)} | ${cuotas.length} cuotas | ${pagosDelCredito.length} pago(s)`)

  for (const pago of pagosDelCredito) {
    const { capital: montoCapital, interes: montoInteres, total: montoTotal } = montoAplicableACuota(pago)

    if (montoTotal === 0) {
      console.log(`    ⚠️  Pago ${mask(pago.id)} (${pago.fecha}): monto capital+interés = 0 — no asignable`)
      pagosNoAsignables.push({ pago_id: pago.id, credito_id: creditoId, razon: 'monto_capital + monto_interes = 0' })
      pagosNoAsignadosCredito++
      continue
    }

    // Encontrar la cuota más antigua no pagada
    const cuotaObjetivo = cuotas.find(c => {
      const est = estadoLocal[c.id].estado
      return est === 'pendiente' || est === 'vencida' || est === 'parcial'
    })

    if (!cuotaObjetivo) {
      console.log(`    ⚠️  Pago ${mask(pago.id)} (${pago.fecha}): no hay cuota pendiente/parcial — no asignable`)
      pagosNoAsignables.push({ pago_id: pago.id, credito_id: creditoId, razon: 'todas las cuotas ya propuestas como pagadas' })
      pagosNoAsignadosCredito++
      continue
    }

    const estadoCuotaLocal = estadoLocal[cuotaObjetivo.id]
    const capitalPagadoNuevo  = round2(estadoCuotaLocal.capital_pagado  + montoCapital)
    const interesPagadoNuevo  = round2(estadoCuotaLocal.interes_pagado  + montoInteres)
    const capitalCuota        = round2(num(cuotaObjetivo.capital))
    const interesCuota        = round2(num(cuotaObjetivo.interes))
    const cuotaTotal          = round2(num(cuotaObjetivo.cuota_total))

    // Determinar estado propuesto
    const capitalCubierto = capitalPagadoNuevo >= capitalCuota - 0.01
    const interesCubierto = interesPagadoNuevo >= interesCuota - 0.01
    const estadoPropuesto = (capitalCubierto && interesCubierto) ? 'pagada' : 'parcial'

    const diferencia      = round2(montoTotal - cuotaTotal)
    const confianza       = calcConfianza(montoTotal, cuotaTotal, estadoPropuesto)

    // Actualizar estado local
    estadoLocal[cuotaObjetivo.id].capital_pagado = capitalPagadoNuevo
    estadoLocal[cuotaObjetivo.id].interes_pagado = interesPagadoNuevo
    estadoLocal[cuotaObjetivo.id].estado         = estadoPropuesto

    if (estadoPropuesto === 'pagada') cuotasPagadasCredito++
    else cuotasParcialCredito++
    pagosAsignadosCredito++

    console.log(`    ✓ Pago ${mask(pago.id)} (${pago.fecha}) → Cuota ${cuotaObjetivo.nro_cuota} | capital=${montoCapital} interés=${montoInteres} | ${estadoCuotaLocal.estado} → ${estadoPropuesto} [${confianza}]`)

    propuestas.push({
      pago_id:         pago.id,
      credito_id:      creditoId,
      cuota_id:        cuotaObjetivo.id,
      nro_cuota:       cuotaObjetivo.nro_cuota,
      fecha_pago:      pago.fecha,
      estado_actual:   cuotaObjetivo.estado,
      estado_propuesto: estadoPropuesto,
      capital_aplicado: montoCapital,
      interes_aplicado: montoInteres,
      monto_aplicado:  montoTotal,
      monto_cuota:     cuotaTotal,
      diferencia:      diferencia,
      capital_cuota:   capitalCuota,
      interes_cuota:   interesCuota,
      capital_pagado_nuevo: capitalPagadoNuevo,
      interes_pagado_nuevo: interesPagadoNuevo,
      confianza:       confianza,
    })
  }

  // Resumen del crédito
  const cuotasPendientesRestantes = cuotas.filter(c => {
    const est = estadoLocal[c.id].estado
    return est === 'pendiente' || est === 'vencida' || est === 'parcial'
  }).length

  resumenPorCredito.push({
    credito_id:             creditoId,
    credito_masked:         mask(creditoId),
    nro_pagare:             credito?.nro_pagare || null,
    total_cuotas:           cuotas.length,
    cuotas_pagadas_propuestas: cuotasPagadasCredito,
    cuotas_parciales_propuestas: cuotasParcialCredito,
    cuotas_pendientes_restantes: cuotasPendientesRestantes,
    pagos_analizados:       pagosDelCredito.length,
    pagos_asignados:        pagosAsignadosCredito,
    pagos_no_asignados:     pagosNoAsignadosCredito,
  })

  totalCuotasPropuestasPagadas   += cuotasPagadasCredito
  totalCuotasPropuestasParciales += cuotasParcialCredito
}

// ─── Resumen final ────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════════════════')
console.log('  RESUMEN DEL DRY-RUN')
console.log('══════════════════════════════════════════════════════════════')
console.log(`  Pagos vinculados analizados:        ${pagos.length}`)
console.log(`  Créditos afectados:                 ${creditoIds.length}`)
console.log(`  Cuotas propuestas como PAGADAS:     ${totalCuotasPropuestasPagadas}`)
console.log(`  Cuotas propuestas como PARCIALES:   ${totalCuotasPropuestasParciales}`)
console.log(`  Pagos no asignables:                ${pagosNoAsignables.length}`)
console.log(`  Propuestas generadas:               ${propuestas.length}`)
console.log('══════════════════════════════════════════════════════════════\n')

// ─── Guardar preview JSON ──────────────────────────────────────────────────────

if (!existsSync(DOCS_DIR)) mkdirSync(DOCS_DIR, { recursive: true })

const previewData = {
  fase: '9C-6H.0',
  modo: 'DRY-RUN',
  generated_at: now(),
  regla_monto: 'monto_aplicado = monto_capital + monto_interes (excluye monto_aporte, monto_fps, monto_fps_extra, monto_otros)',
  totales: {
    pagos_analizados:             pagos.length,
    creditos_afectados:           creditoIds.length,
    cuotas_propuestas_pagadas:    totalCuotasPropuestasPagadas,
    cuotas_propuestas_parciales:  totalCuotasPropuestasParciales,
    pagos_no_asignables:          pagosNoAsignables.length,
    propuestas_generadas:         propuestas.length,
  },
  propuestas: propuestas.map(p => ({
    pago_id:         mask(p.pago_id),
    credito_id:      mask(p.credito_id),
    cuota_id:        mask(p.cuota_id),
    nro_cuota:       p.nro_cuota,
    fecha_pago:      p.fecha_pago,
    estado_actual:   p.estado_actual,
    estado_propuesto: p.estado_propuesto,
    monto_aplicado:  p.monto_aplicado,
    monto_cuota:     p.monto_cuota,
    diferencia:      p.diferencia,
    confianza:       p.confianza,
  })),
  pagos_no_asignables: pagosNoAsignables.map(p => ({
    pago_id:    mask(p.pago_id),
    credito_id: mask(p.credito_id),
    razon:      p.razon,
  })),
  resumen_por_credito: resumenPorCredito.map(r => ({
    credito_masked:              r.credito_masked,
    total_cuotas:                r.total_cuotas,
    cuotas_pagadas_propuestas:   r.cuotas_pagadas_propuestas,
    cuotas_parciales_propuestas: r.cuotas_parciales_propuestas,
    cuotas_pendientes_restantes: r.cuotas_pendientes_restantes,
    pagos_analizados:            r.pagos_analizados,
    pagos_asignados:             r.pagos_asignados,
    pagos_no_asignados:          r.pagos_no_asignados,
  })),
}

const previewPath = resolve(DOCS_DIR, 'proposed_cuotas_payment_updates_preview.json')
writeFileSync(previewPath, JSON.stringify(previewData, null, 2), 'utf8')
console.log(`💾 Preview guardado: docs/ai-recovery/proposed_cuotas_payment_updates_preview.json`)

// ─── Guardar reporte Markdown ──────────────────────────────────────────────────

const confianzaAlta   = propuestas.filter(p => p.confianza === 'alta').length
const confianzaMedia  = propuestas.filter(p => p.confianza === 'media').length
const confianzaBaja   = propuestas.filter(p => p.confianza === 'baja').length

const reportLines = [
  `# PAGOS_TO_CUOTAS_DRY_RUN_REPORT.md`,
  ``,
  `**Fase:** 9C-6H.0 — Dry-run: simular aplicación de pagos a cronograma_cuotas`,
  `**Modo:** DRY-RUN — NINGÚN DATO FUE MODIFICADO`,
  `**Generado:** ${now()}`,
  ``,
  `---`,
  ``,
  `## Objetivo`,
  ``,
  `Simular cómo los 28 pagos vinculados en Fase 9C-6F (id_credito IS NOT NULL) afectarían`,
  `el estado de las cuotas en \`cronograma_cuotas\`, sin modificar ningún dato.`,
  ``,
  `## Metodología`,
  ``,
  `1. Se cargan todos los \`pagos_recibos\` con \`id_credito IS NOT NULL\` (los 28 vinculados en 9C-6F).`,
  `2. Para cada crédito referenciado, se cargan sus cuotas en \`cronograma_cuotas\` ordenadas por \`nro_cuota\`.`,
  `3. Se ordenan los pagos por \`fecha\` ascendente (del más antiguo al más reciente).`,
  `4. Por cada pago, se busca la cuota más antigua en estado \`pendiente\`, \`vencida\` o \`parcial\`.`,
  `5. Se simula la acumulación de \`capital_pagado\` e \`interes_pagado\` en memoria.`,
  `6. Se determina el estado propuesto: \`pagada\` si capital + interés cubiertos, \`parcial\` si no.`,
  `7. Esta lógica es idéntica a la del frontend (\`pagos/nuevo/page.tsx\`, Fase 3B / R7).`,
  ``,
  `## Regla de monto aplicable`,
  ``,
  `| Campo | ¿Incluido en monto cuota? | Justificación |`,
  `|---|---|---|`,
  `| \`monto_capital\` | ✅ Sí | Componente de capital del préstamo |`,
  `| \`monto_interes\` | ✅ Sí | Componente de interés del préstamo |`,
  `| \`monto_aporte\` | ❌ No | Aporte de capital social del socio — no es pago de crédito |`,
  `| \`monto_fps\` | ❌ No | Fondo de previsión social — no es pago de crédito |`,
  `| \`monto_fps_extra\` | ❌ No | FPS extra — no es pago de crédito |`,
  `| \`monto_otros\` | ❌ No | Otros conceptos — no es pago de crédito |`,
  ``,
  `**Fórmula:** \`monto_aplicado = monto_capital + monto_interes\``,
  ``,
  `## Resultado del dry-run`,
  ``,
  `| Métrica | Valor |`,
  `|---|---|`,
  `| Pagos vinculados analizados | **${pagos.length}** |`,
  `| Créditos afectados | **${creditoIds.length}** |`,
  `| Cuotas propuestas como PAGADAS | **${totalCuotasPropuestasPagadas}** |`,
  `| Cuotas propuestas como PARCIALES | **${totalCuotasPropuestasParciales}** |`,
  `| Pagos no asignables | **${pagosNoAsignables.length}** |`,
  `| Propuestas con confianza ALTA | **${confianzaAlta}** |`,
  `| Propuestas con confianza MEDIA | **${confianzaMedia}** |`,
  `| Propuestas con confianza BAJA | **${confianzaBaja}** |`,
  ``,
  `## Créditos afectados`,
  ``,
  `| Crédito (mask) | Cuotas total | Propuestas pagadas | Propuestas parciales | Pendientes restantes | Pagos |`,
  `|---|---|---|---|---|---|`,
  ...resumenPorCredito.map(r =>
    `| ${r.credito_masked} | ${r.total_cuotas} | ${r.cuotas_pagadas_propuestas} | ${r.cuotas_parciales_propuestas} | ${r.cuotas_pendientes_restantes} | ${r.pagos_analizados} |`
  ),
  ``,
  `## Cuotas propuestas como PAGADAS`,
  ``,
  totalCuotasPropuestasPagadas === 0
    ? `_Ninguna cuota propuesta como pagada._`
    : [
        `| Pago (mask) | Crédito (mask) | Cuota Nro | Fecha pago | Monto aplicado | Monto cuota | Diferencia | Confianza |`,
        `|---|---|---|---|---|---|---|---|`,
        ...propuestas.filter(p => p.estado_propuesto === 'pagada').map(p =>
          `| ${mask(p.pago_id)} | ${mask(p.credito_id)} | ${p.nro_cuota} | ${p.fecha_pago} | S/ ${p.monto_aplicado.toFixed(2)} | S/ ${p.monto_cuota.toFixed(2)} | S/ ${p.diferencia.toFixed(2)} | ${p.confianza} |`
        ),
      ].join('\n'),
  ``,
  `## Cuotas propuestas como PARCIALES`,
  ``,
  totalCuotasPropuestasParciales === 0
    ? `_Ninguna cuota propuesta como parcial._`
    : [
        `| Pago (mask) | Crédito (mask) | Cuota Nro | Fecha pago | Monto aplicado | Monto cuota | Diferencia | Confianza |`,
        `|---|---|---|---|---|---|---|---|`,
        ...propuestas.filter(p => p.estado_propuesto === 'parcial').map(p =>
          `| ${mask(p.pago_id)} | ${mask(p.credito_id)} | ${p.nro_cuota} | ${p.fecha_pago} | S/ ${p.monto_aplicado.toFixed(2)} | S/ ${p.monto_cuota.toFixed(2)} | S/ ${p.diferencia.toFixed(2)} | ${p.confianza} |`
        ),
      ].join('\n'),
  ``,
  `## Pagos no asignables`,
  ``,
  pagosNoAsignables.length === 0
    ? `_Todos los pagos pudieron asignarse a una cuota._`
    : [
        `| Pago (mask) | Crédito (mask) | Razón |`,
        `|---|---|---|`,
        ...pagosNoAsignables.map(p => `| ${mask(p.pago_id)} | ${mask(p.credito_id)} | ${p.razon} |`),
      ].join('\n'),
  ``,
  `## Riesgos`,
  ``,
  `1. **Cuotas regeneradas en estado pendiente (0 pagos previos):** Las cuotas se insertaron en Fase 9C-6D `,
  `   con capital_pagado=0 e interes_pagado=0. La simulación es consistente con este estado inicial.`,
  `2. **Solo 28 pagos vinculados:** Los 804 pagos restantes (id_credito=NULL) no se incluyen en esta fase.`,
  `   Los créditos con pagos no vinculados mostrarán más cuotas en estado pendiente de lo real.`,
  `3. **Un pago por cuota:** La lógica aplica un pago a exactamente una cuota (la más antigua pendiente).`,
  `   Si el monto es mayor al total de la cuota, el exceso no se cascadea automáticamente.`,
  `4. **3 match_medio pendientes:** No están incluidos. Si se vinculan en la siguiente fase, podrían`,
  `   afectar cuotas de los mismos créditos.`,
  `5. **Diferencias (campo "diferencia"):** Una diferencia positiva indica que el pago superó el total`,
  `   de la cuota. Una diferencia negativa indica pago parcial. En ambos casos no hay ajuste automático.`,
  ``,
  `## Recomendación: ¿Apply ahora o esperar los 3 match_medio?`,
  ``,
  `### Opción A — Apply ahora (sin esperar match_medio)`,
  `**Pros:** Refleja la situación real de los 28 pagos ya vinculados. El módulo de cuotas`,
  `quedaría operativo para esos créditos.`,
  `**Contras:** Los 3 créditos de match_medio podrían tener cuotas adicionales que también`,
  `deberían marcarse. Si se aplica ahora y luego se vinculan los 3 match_medio, se necesitaría`,
  `un tercer apply que aplicaría esos pagos sobre las cuotas restantes (sin conflicto).`,
  ``,
  `### Opción B — Esperar revisión de los 3 match_medio (RECOMENDADA)`,
  `**Pros:** Si los 3 match_medio se vinculan antes del apply de cuotas, el apply final`,
  `incluiría los 28 + hasta 3 pagos adicionales en una sola operación, cubriendo todos los créditos.`,
  `**Contras:** Depende de que el área de Créditos complete el Excel de revisión.`,
  ``,
  `**Recomendación del sistema: Opción B — esperar los 3 match_medio.**`,
  `Razón: es una única oportunidad de tener el cuadre completo de pagos→cuotas en una sola fase.`,
  `Si el cliente demora, puede aplicarse Opción A como alternativa parcial.`,
  ``,
  `## Archivos generados`,
  ``,
  `- \`scripts/dry-run-apply-pagos-to-cuotas.mjs\` — este script (SOLO LECTURA)`,
  `- \`docs/ai-recovery/proposed_cuotas_payment_updates_preview.json\` — propuesta completa`,
  `- \`docs/ai-recovery/PAGOS_TO_CUOTAS_DRY_RUN_REPORT.md\` — este reporte`,
  `- \`scripts/check-pagos-to-cuotas-plan.mjs\` — verificación de seguridad`,
  ``,
  `## Tablas NO modificadas (confirmado)`,
  ``,
  `- ✅ \`cronograma_cuotas\` — NO modificada`,
  `- ✅ \`pagos_recibos\` — NO modificada`,
  `- ✅ \`creditos\` — NO modificada`,
  `- ✅ \`socios\` — NO modificada`,
  `- ✅ \`usuarios\` — NO modificada`,
  `- ✅ \`configuracion\` — NO modificada`,
  `- ✅ \`auth.users\` — NO modificada`,
]

const reportPath = resolve(DOCS_DIR, 'PAGOS_TO_CUOTAS_DRY_RUN_REPORT.md')
writeFileSync(reportPath, reportLines.join('\n'), 'utf8')
console.log(`💾 Reporte guardado: docs/ai-recovery/PAGOS_TO_CUOTAS_DRY_RUN_REPORT.md`)

console.log('\n✅ Dry-run Fase 9C-6H.0 completado. NINGÚN DATO FUE MODIFICADO.\n')
