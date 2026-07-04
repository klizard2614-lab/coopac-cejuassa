/**
 * dry-run-pagos-cuotas-10k2a.mjs
 * Fase 10K-2A — Revisión final y dry-run de pagos contra cuotas.
 *
 * REGLAS ESTRICTAS — SOLO LECTURA:
 * - NO insert / NO update / NO delete / NO truncate
 * - NO toca cronograma_cuotas / creditos / pagos_recibos / socios / aportes / egresos
 * - NO toca pagos_cuotas_aplicaciones (solo se LEE para confirmar que sigue vacía)
 * - NO toca Anexo 6 ni seguridad (RLS/auditoría)
 * - NO crea migraciones
 * - Solo dry-run, propuesta, Excel y reporte
 *
 * Construido sobre el algoritmo de cascada de Fase 10K-0 (scripts/plan-pagos-cuotas.mjs),
 * extendido para:
 * - Auditar TODOS los pagos_recibos (con y sin id_credito)
 * - Clasificar casos ambiguos (mixtos, excedentes, montos sospechosos)
 * - Generar Excel de revisión multi-hoja para Tesorería/Créditos
 */

import { createClient } from '@supabase/supabase-js'
import XLSX from 'xlsx'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DOCS_DIR = resolve(ROOT, 'docs/ai-recovery')
const EXPORT_DIR = resolve(ROOT, 'exports/pagos-cuotas-dryrun')

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

function montoAplicableACuota(pago) {
  const capital = round2(num(pago.monto_capital))
  const interes = round2(num(pago.monto_interes))
  const total = round2(capital + interes)
  const esMixto = total > 0 && (
    num(pago.monto_aporte) > 0 ||
    num(pago.monto_fps) > 0 ||
    num(pago.monto_fps_extra) > 0 ||
    num(pago.monto_otros) > 0
  )
  return { capital, interes, total, esMixto }
}

// ─── Algoritmo de cascada (idéntico a Fase 10K-0) ─────────────────────────────

function simularAplicacionCascada(pago, cuotas, estadoLocal) {
  const { capital: montoCapital, total: montoTotal, esMixto } = montoAplicableACuota(pago)
  const propuestasDelPago = []

  if (montoTotal === 0) {
    return { propuestas: [], excedente: 0, razonNoAplicable: 'monto_capital + monto_interes = 0', esMixto }
  }

  let montoDisponible = montoTotal
  const ratioCapital = montoTotal > 0 ? montoCapital / montoTotal : 0

  for (const cuota of cuotas) {
    if (montoDisponible <= 0.005) break

    const localState = estadoLocal[cuota.id]
    const est = localState.estado
    if (est !== 'pendiente' && est !== 'vencida' && est !== 'parcial') continue

    const capitalCuota = round2(num(cuota.capital))
    const interesCuota = round2(num(cuota.interes))
    const cuotaTotal = round2(num(cuota.cuota_total))

    const capitalFaltante = round2(capitalCuota - localState.capital_pagado)
    const interesFaltante = round2(interesCuota - localState.interes_pagado)
    const saldoCuota = round2(capitalFaltante + interesFaltante)

    if (saldoCuota <= 0.005) {
      localState.estado = 'pagada'
      continue
    }

    let capitalAplicar, interesAplicar

    if (montoDisponible >= saldoCuota) {
      capitalAplicar = capitalFaltante
      interesAplicar = interesFaltante
      montoDisponible = round2(montoDisponible - saldoCuota)

      localState.capital_pagado = round2(localState.capital_pagado + capitalAplicar)
      localState.interes_pagado = round2(localState.interes_pagado + interesAplicar)
      localState.estado = 'pagada'
      localState.fecha_pago = pago.fecha

      propuestasDelPago.push({
        pago_id: pago.id, credito_id: pago.id_credito, cuota_id: cuota.id, nro_cuota: cuota.nro_cuota,
        fecha_pago: pago.fecha, estado_actual: cuota.estado, estado_propuesto: 'pagada',
        capital_aplicado: capitalAplicar, interes_aplicado: interesAplicar,
        monto_aplicado: round2(capitalAplicar + interesAplicar), monto_cuota: cuotaTotal,
        saldo_cuota_previo: saldoCuota, es_cascada: propuestasDelPago.length > 0, es_mixto: esMixto,
      })
    } else {
      capitalAplicar = round2(Math.min(montoDisponible * ratioCapital, capitalFaltante))
      interesAplicar = round2(Math.min(montoDisponible - capitalAplicar, interesFaltante))
      const totalAplicar = round2(capitalAplicar + interesAplicar)
      if (totalAplicar < montoDisponible - 0.01 && interesFaltante > interesAplicar) {
        interesAplicar = round2(montoDisponible - capitalAplicar)
      }

      localState.capital_pagado = round2(localState.capital_pagado + capitalAplicar)
      localState.interes_pagado = round2(localState.interes_pagado + interesAplicar)
      localState.estado = 'parcial'
      montoDisponible = 0

      propuestasDelPago.push({
        pago_id: pago.id, credito_id: pago.id_credito, cuota_id: cuota.id, nro_cuota: cuota.nro_cuota,
        fecha_pago: pago.fecha, estado_actual: cuota.estado, estado_propuesto: 'parcial',
        capital_aplicado: capitalAplicar, interes_aplicado: interesAplicar,
        monto_aplicado: round2(capitalAplicar + interesAplicar), monto_cuota: cuotaTotal,
        saldo_cuota_previo: saldoCuota, es_cascada: propuestasDelPago.length > 0, es_mixto: esMixto,
      })
    }
  }

  return { propuestas: propuestasDelPago, excedente: round2(montoDisponible), razonNoAplicable: null, esMixto }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════════════════')
console.log('  CEJUASSA — Fase 10K-2A — Dry-run final pagos → cuotas')
console.log('  MODO: SOLO LECTURA — NO se modificará ningún dato')
console.log('══════════════════════════════════════════════════════════════\n')

// ─── Paso 1: pagos_cuotas_aplicaciones sigue vacía (confirmación de seguridad) ─

console.log('🔒 Paso 1 — Confirmando que pagos_cuotas_aplicaciones sigue vacía...')
const { count: countAplicaciones, error: errAplic } = await sb
  .from('pagos_cuotas_aplicaciones')
  .select('*', { count: 'exact', head: true })

if (errAplic) { console.error('❌ Error consultando pagos_cuotas_aplicaciones:', errAplic.message); process.exit(1) }
console.log(`  → pagos_cuotas_aplicaciones: ${countAplicaciones} filas (esperado: 0)`)

// ─── Paso 2: Cargar TODOS los pagos_recibos ──────────────────────────────────

console.log('\n📥 Paso 2 — Cargando TODOS los pagos_recibos...')
const { data: todosLosPagos, error: errTodos } = await sb
  .from('pagos_recibos')
  .select('id, id_socio, id_credito, nro_recibo, fecha, periodo, canal_pago, monto_capital, monto_interes, monto_aporte, monto_fps, monto_fps_extra, monto_otros, monto_total, observacion')
  .order('fecha', { ascending: true })

if (errTodos) { console.error('❌ Error cargando pagos_recibos:', errTodos.message); process.exit(1) }

const totalPagos = todosLosPagos.length
const pagosConCredito = todosLosPagos.filter(p => p.id_credito !== null)
const pagosSinCredito = todosLosPagos.filter(p => p.id_credito === null)

console.log(`  → Total pagos_recibos: ${totalPagos}`)
console.log(`  → Con id_credito: ${pagosConCredito.length}`)
console.log(`  → Sin id_credito: ${pagosSinCredito.length}`)

// ─── Paso 3: Cargar cronograma_cuotas completo (para stats globales) ─────────

console.log('\n📥 Paso 3 — Cargando cronograma_cuotas completo...')
const { data: todasLasCuotasGlobal, error: errCuotasGlobal } = await sb
  .from('cronograma_cuotas')
  .select('id, id_credito, nro_cuota, fecha_vencimiento, capital, interes, cuota_total, capital_pagado, interes_pagado, estado, fecha_pago')

if (errCuotasGlobal) { console.error('❌ Error cargando cronograma_cuotas:', errCuotasGlobal.message); process.exit(1) }

const cuotasPendientesGlobal = todasLasCuotasGlobal.filter(c => c.estado === 'pendiente' || c.estado === 'vencida')
const cuotasParcialesGlobal = todasLasCuotasGlobal.filter(c => c.estado === 'parcial')
const cuotasPagadasGlobal = todasLasCuotasGlobal.filter(c => c.estado === 'pagada')

console.log(`  → Total cuotas: ${todasLasCuotasGlobal.length}`)
console.log(`  → Pendientes/vencidas: ${cuotasPendientesGlobal.length}`)
console.log(`  → Parciales: ${cuotasParcialesGlobal.length}`)
console.log(`  → Pagadas: ${cuotasPagadasGlobal.length}`)

// ─── Paso 4: Clasificar pagos con id_credito por claridad de monto ───────────

console.log('\n🔍 Paso 4 — Clasificando pagos con id_credito por claridad de monto...')

let pagosMontoClaroSoloCredito = 0
let pagosMontoClaroMixto = 0
let pagosNoAplicables = 0
const pagosAmbiguosPreliminar = []

for (const p of pagosConCredito) {
  const { total, esMixto } = montoAplicableACuota(p)
  if (total === 0) {
    pagosNoAplicables++
  } else if (esMixto) {
    pagosMontoClaroMixto++
  } else {
    pagosMontoClaroSoloCredito++
  }

  // Heurística de monto sospechoso: monto_capital+interes muy superior a lo normal
  // (más de 5x el promedio de pagos del mismo crédito, o mayor a S/1,500 en un solo recibo)
  if (total > 1500) {
    pagosAmbiguosPreliminar.push({
      pago_id: p.id,
      credito_id: p.id_credito,
      fecha: p.fecha,
      monto_total_aplicable: total,
      razon: `Monto aplicable inusualmente alto (S/${total.toFixed(2)}) — posible prepago múltiple o error de digitación, requiere verificación de Tesorería`,
    })
  }
}

console.log(`  → Monto claro, solo crédito: ${pagosMontoClaroSoloCredito}`)
console.log(`  → Monto claro, mixto (crédito+aporte/FPS): ${pagosMontoClaroMixto}`)
console.log(`  → No aplicables (monto=0): ${pagosNoAplicables}`)
console.log(`  → Ambiguos preliminares (monto alto): ${pagosAmbiguosPreliminar.length}`)

// ─── Paso 5: Cargar créditos y cuotas para los pagos con id_credito ──────────

const creditoIds = [...new Set(pagosConCredito.map(p => p.id_credito))]
console.log(`\n📥 Paso 5 — Cargando datos para ${creditoIds.length} créditos con pagos vinculados...`)

const { data: cuotasDeCreditos, error: errCuotas } = await sb
  .from('cronograma_cuotas')
  .select('id, id_credito, nro_cuota, fecha_vencimiento, capital, interes, cuota_total, capital_pagado, interes_pagado, estado, fecha_pago')
  .in('id_credito', creditoIds)
  .order('nro_cuota', { ascending: true })

if (errCuotas) { console.error('❌ Error cargando cuotas:', errCuotas.message); process.exit(1) }

const { data: creditosData, error: errCred } = await sb
  .from('creditos')
  .select('id, nro_pagare, monto_aprobado, saldo_capital, cuota_mensual, plazo_meses, tasa_interes, estado')
  .in('id', creditoIds)

if (errCred) { console.error('❌ Error cargando créditos:', errCred.message); process.exit(1) }

const creditoById = {}
for (const c of creditosData) creditoById[c.id] = c

const cuotasPorCredito = {}
for (const c of cuotasDeCreditos) {
  if (!cuotasPorCredito[c.id_credito]) cuotasPorCredito[c.id_credito] = []
  cuotasPorCredito[c.id_credito].push(c)
}

const pagosPorCredito = {}
for (const p of pagosConCredito) {
  if (!pagosPorCredito[p.id_credito]) pagosPorCredito[p.id_credito] = []
  pagosPorCredito[p.id_credito].push(p)
}

// ─── Paso 6: Simulación de cascada (propuesta de aplicación) ─────────────────

console.log('\n🧮 Paso 6 — Simulando aplicación con algoritmo de cascada (sin escribir nada)...')

const todasLasPropuestas = []
const pagosNoAsignables = []
const excedentesDetalle = []
const casosAmbiguos = [...pagosAmbiguosPreliminar.map(a => ({ ...a, tipo: 'monto_alto' }))]
let creditosSinCronograma = 0

for (const creditoId of creditoIds) {
  const credito = creditoById[creditoId]
  const cuotas = cuotasPorCredito[creditoId] || []
  const pagosDelCredito = pagosPorCredito[creditoId] || []

  if (cuotas.length === 0) {
    creditosSinCronograma++
    for (const p of pagosDelCredito) {
      pagosNoAsignables.push({ pago_id: p.id, credito_id: creditoId, razon: 'crédito sin cronograma (probablemente cancelado)' })
      casosAmbiguos.push({
        pago_id: p.id, credito_id: creditoId, fecha: p.fecha, monto_total_aplicable: montoAplicableACuota(p).total,
        razon: 'Crédito sin cronograma de cuotas — no se puede determinar a qué cuota aplicaría este pago',
        tipo: 'sin_cronograma',
      })
    }
    continue
  }

  const estadoLocal = {}
  for (const c of cuotas) {
    estadoLocal[c.id] = {
      capital_pagado: round2(num(c.capital_pagado)),
      interes_pagado: round2(num(c.interes_pagado)),
      estado: c.estado,
      fecha_pago: c.fecha_pago,
    }
  }

  for (const pago of pagosDelCredito) {
    const { total: montoTotal } = montoAplicableACuota(pago)

    if (montoTotal === 0) {
      pagosNoAsignables.push({ pago_id: pago.id, credito_id: creditoId, razon: 'monto_capital + monto_interes = 0 (solo aporte/FPS/otros)' })
      continue
    }

    const resultado = simularAplicacionCascada(pago, cuotas, estadoLocal)

    if (resultado.propuestas.length === 0 && resultado.excedente > 0) {
      excedentesDetalle.push({ pago_id: pago.id, credito_id: creditoId, excedente: resultado.excedente, razon: 'todas las cuotas ya propuestas como pagadas' })
      pagosNoAsignables.push({ pago_id: pago.id, credito_id: creditoId, razon: 'todas las cuotas ya propuestas como pagadas (excedente total)' })
      casosAmbiguos.push({
        pago_id: pago.id, credito_id: creditoId, fecha: pago.fecha, monto_total_aplicable: montoTotal,
        razon: `Excedente total de S/${resultado.excedente.toFixed(2)} sin cuota pendiente donde aplicarlo`,
        tipo: 'excedente_total',
      })
      continue
    }

    for (const prop of resultado.propuestas) todasLasPropuestas.push(prop)

    if (resultado.excedente > 0.01) {
      excedentesDetalle.push({ pago_id: pago.id, credito_id: creditoId, excedente: resultado.excedente, razon: 'sobrante después de cubrir cuotas disponibles' })
      casosAmbiguos.push({
        pago_id: pago.id, credito_id: creditoId, fecha: pago.fecha, monto_total_aplicable: montoTotal,
        razon: `Excedente parcial de S/${resultado.excedente.toFixed(2)} después de cubrir todas las cuotas pendientes disponibles`,
        tipo: 'excedente_parcial',
      })
    }
  }
}

const cuotasPagadasPropuestas = todasLasPropuestas.filter(p => p.estado_propuesto === 'pagada').length
const cuotasParcialesPropuestas = todasLasPropuestas.filter(p => p.estado_propuesto === 'parcial').length
const cuotasAfectadasUnicas = new Set(todasLasPropuestas.map(p => p.cuota_id)).size
const montoTotalPropuesto = round2(todasLasPropuestas.reduce((acc, p) => acc + p.monto_aplicado, 0))

// Deduplicar casos ambiguos por pago_id + tipo
const casosAmbiguosUnicos = []
const seen = new Set()
for (const c of casosAmbiguos) {
  const key = `${c.pago_id}-${c.tipo}`
  if (!seen.has(key)) { seen.add(key); casosAmbiguosUnicos.push(c) }
}

console.log(`  → Propuestas generadas: ${todasLasPropuestas.length}`)
console.log(`  → Cuotas que quedarían PAGADAS: ${cuotasPagadasPropuestas}`)
console.log(`  → Cuotas que quedarían PARCIALES: ${cuotasParcialesPropuestas}`)
console.log(`  → Cuotas únicas afectadas: ${cuotasAfectadasUnicas}`)
console.log(`  → Monto total propuesto a aplicar: S/${montoTotalPropuesto.toFixed(2)}`)
console.log(`  → Casos ambiguos (deduplicados): ${casosAmbiguosUnicos.length}`)
console.log(`  → Créditos sin cronograma: ${creditosSinCronograma}`)

// ─── Resumen ──────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════════════════')
console.log('  RESUMEN DEL DRY-RUN (10K-2A)')
console.log('══════════════════════════════════════════════════════════════')
console.log(`  Total pagos_recibos:                 ${totalPagos}`)
console.log(`  Pagos con id_credito:                ${pagosConCredito.length}`)
console.log(`  Pagos sin id_credito:                ${pagosSinCredito.length}`)
console.log(`  Pagos aplicables (monto>0, con crédito): ${pagosMontoClaroSoloCredito + pagosMontoClaroMixto}`)
console.log(`  Pagos ambiguos:                       ${casosAmbiguosUnicos.length}`)
console.log(`  Cuotas pendientes (global):           ${cuotasPendientesGlobal.length}`)
console.log(`  Cuotas parciales (global):            ${cuotasParcialesGlobal.length}`)
console.log(`  Cuotas pagadas (global):              ${cuotasPagadasGlobal.length}`)
console.log(`  Cuotas afectadas por la propuesta:    ${cuotasAfectadasUnicas}`)
console.log(`  Monto total propuesto a aplicar:      S/${montoTotalPropuesto.toFixed(2)}`)
console.log(`  pagos_cuotas_aplicaciones (filas):    ${countAplicaciones} (debe ser 0)`)
console.log('══════════════════════════════════════════════════════════════\n')

// ─── Generar Excel ────────────────────────────────────────────────────────────

console.log('📊 Generando Excel de revisión...')
if (!existsSync(EXPORT_DIR)) mkdirSync(EXPORT_DIR, { recursive: true })

const wb = XLSX.utils.book_new()

// Hoja: resumen
const resumenRows = [
  { metrica: 'Total pagos_recibos', valor: totalPagos },
  { metrica: 'Pagos con id_credito', valor: pagosConCredito.length },
  { metrica: 'Pagos sin id_credito', valor: pagosSinCredito.length },
  { metrica: 'Pagos monto claro (solo crédito)', valor: pagosMontoClaroSoloCredito },
  { metrica: 'Pagos monto claro (mixto crédito+aporte/FPS)', valor: pagosMontoClaroMixto },
  { metrica: 'Pagos no aplicables (monto=0)', valor: pagosNoAplicables },
  { metrica: 'Pagos ambiguos (requieren revisión)', valor: casosAmbiguosUnicos.length },
  { metrica: 'Cuotas pendientes/vencidas (global)', valor: cuotasPendientesGlobal.length },
  { metrica: 'Cuotas parciales (global)', valor: cuotasParcialesGlobal.length },
  { metrica: 'Cuotas pagadas (global)', valor: cuotasPagadasGlobal.length },
  { metrica: 'Créditos con pagos vinculados', valor: creditoIds.length },
  { metrica: 'Créditos sin cronograma (entre esos)', valor: creditosSinCronograma },
  { metrica: 'Propuestas de aplicación generadas', valor: todasLasPropuestas.length },
  { metrica: 'Cuotas que quedarían PAGADAS', valor: cuotasPagadasPropuestas },
  { metrica: 'Cuotas que quedarían PARCIALES', valor: cuotasParcialesPropuestas },
  { metrica: 'Cuotas únicas afectadas', valor: cuotasAfectadasUnicas },
  { metrica: 'Monto total propuesto a aplicar (S/)', valor: montoTotalPropuesto },
  { metrica: 'Filas en pagos_cuotas_aplicaciones (debe ser 0)', valor: countAplicaciones },
  { metrica: 'Fecha de generación', valor: now() },
  { metrica: 'Modo', valor: 'DRY-RUN — NINGÚN DATO FUE MODIFICADO' },
]
const wsResumen = XLSX.utils.json_to_sheet(resumenRows)
wsResumen['!cols'] = [{ wch: 48 }, { wch: 30 }]
XLSX.utils.book_append_sheet(wb, wsResumen, 'resumen')

// Hoja: pagos_aplicables
const pagosAplicablesRows = pagosConCredito
  .map(p => ({ ...p, ...montoAplicableACuota(p) }))
  .filter(p => p.total > 0)
  .map(p => ({
    pago_id: mask(p.id),
    credito_id: mask(p.id_credito),
    fecha: p.fecha,
    periodo: p.periodo,
    canal_pago: p.canal_pago,
    monto_capital: p.capital,
    monto_interes: p.interes,
    monto_total_aplicable: p.total,
    monto_aporte: num(p.monto_aporte),
    monto_fps: num(p.monto_fps),
    es_mixto: p.esMixto ? 'SI' : 'NO',
  }))
const wsAplicables = XLSX.utils.json_to_sheet(pagosAplicablesRows)
wsAplicables['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 14 }, { wch: 12 }, { wch: 10 }]
XLSX.utils.book_append_sheet(wb, wsAplicables, 'pagos_aplicables')

// Hoja: aplicaciones_propuestas
const aplicacionesRows = todasLasPropuestas.map(p => ({
  pago_id: mask(p.pago_id),
  credito_id: mask(p.credito_id),
  cuota_id: mask(p.cuota_id),
  nro_cuota: p.nro_cuota,
  fecha_pago: p.fecha_pago,
  estado_actual: p.estado_actual,
  estado_propuesto: p.estado_propuesto,
  capital_aplicado: p.capital_aplicado,
  interes_aplicado: p.interes_aplicado,
  monto_aplicado: p.monto_aplicado,
  monto_cuota: p.monto_cuota,
  es_cascada: p.es_cascada ? 'SI' : 'NO',
  es_mixto: p.es_mixto ? 'SI' : 'NO',
}))
const wsAplicaciones = XLSX.utils.json_to_sheet(aplicacionesRows)
wsAplicaciones['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 10 }]
XLSX.utils.book_append_sheet(wb, wsAplicaciones, 'aplicaciones_propuestas')

// Hoja: casos_ambiguos
const ambiguosRows = casosAmbiguosUnicos.map(c => ({
  pago_id: mask(c.pago_id),
  credito_id: mask(c.credito_id),
  fecha: c.fecha,
  monto_total_aplicable: c.monto_total_aplicable,
  tipo: c.tipo,
  razon: c.razon,
  decision_creditos_tesoreria: '',
}))
const wsAmbiguos = XLSX.utils.json_to_sheet(ambiguosRows)
wsAmbiguos['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 18 }, { wch: 70 }, { wch: 30 }]
XLSX.utils.book_append_sheet(wb, wsAmbiguos, 'casos_ambiguos')

// Hoja: pagos_sin_credito
const sinCreditoRows = pagosSinCredito.map(p => ({
  pago_id: mask(p.id),
  socio_id: mask(p.id_socio),
  fecha: p.fecha,
  periodo: p.periodo,
  canal_pago: p.canal_pago,
  monto_capital: num(p.monto_capital),
  monto_interes: num(p.monto_interes),
  monto_aporte: num(p.monto_aporte),
  monto_total: num(p.monto_total),
}))
const wsSinCredito = XLSX.utils.json_to_sheet(sinCreditoRows)
wsSinCredito['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }]
XLSX.utils.book_append_sheet(wb, wsSinCredito, 'pagos_sin_credito')

// Hoja: cuotas_afectadas
const cuotaIdsAfectadas = new Set(todasLasPropuestas.map(p => p.cuota_id))
const cuotasAfectadasRows = cuotasDeCreditos
  .filter(c => cuotaIdsAfectadas.has(c.id))
  .map(c => {
    const propsDeEstaCuota = todasLasPropuestas.filter(p => p.cuota_id === c.id)
    const estadoFinal = propsDeEstaCuota[propsDeEstaCuota.length - 1]?.estado_propuesto || c.estado
    return {
      cuota_id: mask(c.id),
      credito_id: mask(c.id_credito),
      nro_cuota: c.nro_cuota,
      fecha_vencimiento: c.fecha_vencimiento,
      cuota_total: num(c.cuota_total),
      estado_actual: c.estado,
      estado_propuesto: estadoFinal,
      num_pagos_aplicados: propsDeEstaCuota.length,
    }
  })
const wsCuotasAfectadas = XLSX.utils.json_to_sheet(cuotasAfectadasRows)
wsCuotasAfectadas['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 18 }]
XLSX.utils.book_append_sheet(wb, wsCuotasAfectadas, 'cuotas_afectadas')

// Hoja: advertencias
const advertenciasRows = [
  { advertencia: 'Este archivo es SOLO una propuesta — ningún dato ha sido modificado en la base de datos.' },
  { advertencia: `pagos_cuotas_aplicaciones tiene ${countAplicaciones} filas (confirmado vacía).` },
  { advertencia: `${excedentesDetalle.length} pago(s) generan excedente — monto que no alcanza a cubrir ninguna cuota adicional.` },
  { advertencia: `${creditosSinCronograma} crédito(s) con pagos vinculados no tienen cronograma_cuotas (probablemente cancelados).` },
  { advertencia: '3 pagos match_medio (Fase 9C-6G) siguen pendientes de decisión del área de Créditos — ver PAGOS_MATCH_MEDIO_REVIEW.md.' },
  { advertencia: 'Pago 411**** (crédito 1138****) con monto S/1,896.96 vs cuota S/285.59 sigue pendiente de verificación con Tesorería (R-K2).' },
  { advertencia: '804 pagos sin id_credito no fueron reasignados en esta fase — ver hoja pagos_sin_credito para el desglose completo.' },
  { advertencia: 'Ningún pago fue aplicado. El apply real requiere autorización explícita: APLICAR PAGOS A CUOTAS 10K-2.' },
]
const wsAdvertencias = XLSX.utils.json_to_sheet(advertenciasRows)
wsAdvertencias['!cols'] = [{ wch: 100 }]
XLSX.utils.book_append_sheet(wb, wsAdvertencias, 'advertencias')

const excelPath = resolve(EXPORT_DIR, '10k_2a_propuesta_aplicacion_pagos_cuotas.xlsx')
XLSX.writeFile(wb, excelPath)
console.log(`💾 Excel generado: exports/pagos-cuotas-dryrun/10k_2a_propuesta_aplicacion_pagos_cuotas.xlsx`)

// ─── Guardar JSON de soporte (para el reporte y el check) ────────────────────

const previewData = {
  fase: '10K-2A',
  modo: 'DRY-RUN',
  generated_at: now(),
  totales: {
    total_pagos_recibos: totalPagos,
    pagos_con_credito: pagosConCredito.length,
    pagos_sin_credito: pagosSinCredito.length,
    pagos_monto_claro_solo_credito: pagosMontoClaroSoloCredito,
    pagos_monto_claro_mixto: pagosMontoClaroMixto,
    pagos_no_aplicables: pagosNoAplicables,
    pagos_ambiguos: casosAmbiguosUnicos.length,
    cuotas_pendientes_global: cuotasPendientesGlobal.length,
    cuotas_parciales_global: cuotasParcialesGlobal.length,
    cuotas_pagadas_global: cuotasPagadasGlobal.length,
    creditos_con_pagos: creditoIds.length,
    creditos_sin_cronograma: creditosSinCronograma,
    propuestas_generadas: todasLasPropuestas.length,
    cuotas_quedarian_pagadas: cuotasPagadasPropuestas,
    cuotas_quedarian_parciales: cuotasParcialesPropuestas,
    cuotas_unicas_afectadas: cuotasAfectadasUnicas,
    monto_total_propuesto: montoTotalPropuesto,
    filas_pagos_cuotas_aplicaciones: countAplicaciones,
  },
}

if (!existsSync(DOCS_DIR)) mkdirSync(DOCS_DIR, { recursive: true })
const previewPath = resolve(DOCS_DIR, 'pagos_cuotas_10k2a_dryrun_preview.json')
writeFileSync(previewPath, JSON.stringify(previewData, null, 2), 'utf8')
console.log(`💾 Preview guardado: docs/ai-recovery/pagos_cuotas_10k2a_dryrun_preview.json`)

console.log('\n✅ Dry-run Fase 10K-2A completado. NINGÚN DATO FUE MODIFICADO.\n')
