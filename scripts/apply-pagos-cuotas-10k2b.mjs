/**
 * apply-pagos-cuotas-10k2b.mjs
 * Fase 10K-2B (acotada) — Apply real de los pagos con id_credito ya vinculado
 * contra cronograma_cuotas, con trazabilidad en pagos_cuotas_aplicaciones.
 *
 * ALCANCE: SOLO los pagos_recibos que YA tienen id_credito asignado (28,
 * de la Fase 9C-6F). NO toca los 804 pagos sin id_credito (siguen diferidos).
 *
 * EXCLUSIÓN EXPLÍCITA: pago id=411 (crédito 1138, monto S/1,896.96 vs cuota
 * S/285.59) — sigue pendiente de verificación con Tesorería (caso R-K2,
 * documentado en PAGOS_CREDITOS_LINK_APPLY_REPORT.md). Se excluye de este
 * apply hasta que se confirme si es prepago real o error de digitación.
 *
 * Algoritmo de cascada idéntico al dry-run ya revisado
 * (scripts/dry-run-pagos-cuotas-10k2a.mjs) — mismo criterio de orden,
 * prorrateo capital/interés y tolerancia de redondeo.
 *
 * Escribe en:
 *  - cronograma_cuotas (capital_pagado, interes_pagado, estado, fecha_pago)
 *  - pagos_cuotas_aplicaciones (trazabilidad, una fila por pago+cuota)
 *
 * NO toca: pagos_recibos, creditos.saldo_capital, socios, usuarios,
 * configuracion, auth.users.
 *
 * Guardas de seguridad:
 *  - Aborta si pagos_cuotas_aplicaciones ya tiene filas (evita duplicar).
 *  - Aborta si el pago 411 aparece incluido por error.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const PAGO_EXCLUIDO_ID = 411 // R-K2 — pendiente de verificación con Tesorería

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

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

function num(v) { return typeof v === 'number' ? v : (parseFloat(v) || 0) }
function round2(n) { return Math.round(n * 100) / 100 }
function now() { return new Date().toISOString() }

function montoAplicableACuota(pago) {
  const capital = round2(num(pago.monto_capital))
  const interes = round2(num(pago.monto_interes))
  return { capital, interes, total: round2(capital + interes) }
}

function simularAplicacionCascada(pago, cuotas, estadoLocal) {
  const { capital: montoCapital, total: montoTotal } = montoAplicableACuota(pago)
  const propuestas = []
  if (montoTotal === 0) return { propuestas, excedente: 0 }

  let montoDisponible = montoTotal
  const ratioCapital = montoTotal > 0 ? montoCapital / montoTotal : 0

  for (const cuota of cuotas) {
    if (montoDisponible <= 0.005) break
    const localState = estadoLocal[cuota.id]
    if (!['pendiente', 'vencida', 'parcial'].includes(localState.estado)) continue

    const capitalFaltante = round2(num(cuota.capital) - localState.capital_pagado)
    const interesFaltante = round2(num(cuota.interes) - localState.interes_pagado)
    const saldoCuota = round2(capitalFaltante + interesFaltante)
    if (saldoCuota <= 0.005) { localState.estado = 'pagada'; continue }

    let capitalAplicar, interesAplicar, estadoNuevo
    if (montoDisponible >= saldoCuota) {
      capitalAplicar = capitalFaltante
      interesAplicar = interesFaltante
      montoDisponible = round2(montoDisponible - saldoCuota)
      estadoNuevo = 'pagada'
    } else {
      capitalAplicar = round2(Math.min(montoDisponible * ratioCapital, capitalFaltante))
      interesAplicar = round2(Math.min(montoDisponible - capitalAplicar, interesFaltante))
      if (round2(capitalAplicar + interesAplicar) < montoDisponible - 0.01 && interesFaltante > interesAplicar) {
        interesAplicar = round2(montoDisponible - capitalAplicar)
      }
      montoDisponible = 0
      estadoNuevo = 'parcial'
    }

    localState.capital_pagado = round2(localState.capital_pagado + capitalAplicar)
    localState.interes_pagado = round2(localState.interes_pagado + interesAplicar)
    localState.estado = estadoNuevo
    if (estadoNuevo === 'pagada') localState.fecha_pago = pago.fecha

    propuestas.push({
      cuota_id: cuota.id, capital_aplicado: capitalAplicar, interes_aplicado: interesAplicar,
      estado_propuesto: estadoNuevo, fecha_pago: estadoNuevo === 'pagada' ? pago.fecha : null,
    })
  }
  return { propuestas, excedente: round2(montoDisponible) }
}

console.log('\n══════════════════════════════════════════════════════════════')
console.log('  CEJUASSA — Fase 10K-2B (acotada) — APPLY pagos → cuotas')
console.log('  ALCANCE: solo pagos con id_credito ya vinculado (excluye pago 411)')
console.log('══════════════════════════════════════════════════════════════\n')

// ─── Guarda 1: pagos_cuotas_aplicaciones debe estar vacía ────────────────────
const { count: countAplicaciones, error: errAplic } = await sb
  .from('pagos_cuotas_aplicaciones').select('*', { count: 'exact', head: true })
if (errAplic) { console.error('❌', errAplic.message); process.exit(1) }
if (countAplicaciones > 0) {
  console.error(`❌ ABORTADO: pagos_cuotas_aplicaciones ya tiene ${countAplicaciones} filas. No se puede re-aplicar sin revisión manual.`)
  process.exit(1)
}
console.log('✅ Guarda 1: pagos_cuotas_aplicaciones está vacía. Continuando.\n')

// ─── Cargar pagos con id_credito, excluyendo el caso R-K2 ────────────────────
const { data: pagosConCredito, error: errPagos } = await sb
  .from('pagos_recibos')
  .select('id, id_credito, fecha, monto_capital, monto_interes')
  .not('id_credito', 'is', null)
  .order('fecha', { ascending: true })
if (errPagos) { console.error('❌', errPagos.message); process.exit(1) }

const pagosFiltrados = pagosConCredito.filter(p => p.id !== PAGO_EXCLUIDO_ID)
console.log(`📥 Pagos con id_credito: ${pagosConCredito.length} (excluido pago ${PAGO_EXCLUIDO_ID}: R-K2 pendiente Tesorería)`)
console.log(`📥 Pagos a procesar: ${pagosFiltrados.length}\n`)

const creditoIds = [...new Set(pagosFiltrados.map(p => p.id_credito))]
const { data: cuotasTodas, error: errCuotas } = await sb
  .from('cronograma_cuotas')
  .select('id, id_credito, nro_cuota, capital, interes, capital_pagado, interes_pagado, estado')
  .in('id_credito', creditoIds)
  .order('nro_cuota', { ascending: true })
if (errCuotas) { console.error('❌', errCuotas.message); process.exit(1) }

const cuotasPorCredito = {}
for (const c of cuotasTodas) (cuotasPorCredito[c.id_credito] ??= []).push(c)
const pagosPorCredito = {}
for (const p of pagosFiltrados) (pagosPorCredito[p.id_credito] ??= []).push(p)

let totalPropuestas = 0, totalCuotasPagadas = 0, totalCuotasParciales = 0
let totalMontoAplicado = 0, creditosOmitidos = 0
const filasAplicacion = []
const updatesCuotas = []
const resumenPorCredito = []

for (const creditoId of creditoIds) {
  const cuotas = cuotasPorCredito[creditoId] || []
  const pagosDelCredito = pagosPorCredito[creditoId] || []
  if (cuotas.length === 0) { creditosOmitidos++; continue }

  const estadoLocal = {}
  for (const c of cuotas) {
    estadoLocal[c.id] = { capital_pagado: round2(num(c.capital_pagado)), interes_pagado: round2(num(c.interes_pagado)), estado: c.estado, fecha_pago: null }
  }

  let cuotasCreditoTocadas = 0
  for (const pago of pagosDelCredito) {
    const { propuestas } = simularAplicacionCascada(pago, cuotas, estadoLocal)
    for (const prop of propuestas) {
      totalPropuestas++
      cuotasCreditoTocadas++
      if (prop.estado_propuesto === 'pagada') totalCuotasPagadas++; else totalCuotasParciales++
      totalMontoAplicado = round2(totalMontoAplicado + prop.capital_aplicado + prop.interes_aplicado)
      filasAplicacion.push({
        id_pago: pago.id, id_cuota: prop.cuota_id, id_credito: creditoId,
        capital_aplicado: prop.capital_aplicado, interes_aplicado: prop.interes_aplicado,
        fecha_aplicacion: pago.fecha, observacion: 'Fase 10K-2B — apply acotado a pagos ya vinculados (9C-6F)',
      })
    }
  }
  if (cuotasCreditoTocadas > 0) resumenPorCredito.push({ credito_id: creditoId, cuotas_tocadas: cuotasCreditoTocadas })

  for (const c of cuotas) {
    const st = estadoLocal[c.id]
    const cambioReal = st.capital_pagado !== round2(num(c.capital_pagado)) || st.interes_pagado !== round2(num(c.interes_pagado))
    if (cambioReal) {
      updatesCuotas.push({
        id: c.id,
        capital_pagado: st.capital_pagado,
        interes_pagado: st.interes_pagado,
        estado: st.estado,
        fecha_pago: st.fecha_pago,
      })
    }
  }
}

console.log('🧮 Simulación completada (idéntica al dry-run 10K-2A, excluyendo pago 411):')
console.log(`  → Propuestas: ${totalPropuestas} | Cuotas → pagada: ${totalCuotasPagadas} | Cuotas → parcial: ${totalCuotasParciales}`)
console.log(`  → Monto total a aplicar: S/${totalMontoAplicado.toFixed(2)}`)
console.log(`  → Créditos con pagos vinculados pero sin cronograma (omitidos): ${creditosOmitidos}`)
console.log(`  → Filas a insertar en pagos_cuotas_aplicaciones: ${filasAplicacion.length}`)
console.log(`  → Filas a actualizar en cronograma_cuotas: ${updatesCuotas.length}\n`)

if (filasAplicacion.length === 0) {
  console.log('⚠️  Nada que aplicar. Fin.')
  process.exit(0)
}

// ─── Guarda 2: verificar que el pago 411 no quedó incluido por error ─────────
if (filasAplicacion.some(f => f.id_pago === PAGO_EXCLUIDO_ID)) {
  console.error('❌ ABORTADO: el pago excluido apareció en las filas a aplicar. Revisar lógica.')
  process.exit(1)
}
console.log('✅ Guarda 2: pago 411 (R-K2) confirmado fuera del set a aplicar.\n')

if (process.argv.includes('--dry-run')) {
  console.log('🛑 --dry-run: deteniendo antes de escribir. Nada fue modificado.\n')
  process.exit(0)
}

// ─── APPLY: primero trazabilidad, luego cronograma_cuotas ────────────────────
console.log('✍️  Aplicando cambios...\n')

const { error: errInsert } = await sb.from('pagos_cuotas_aplicaciones').insert(filasAplicacion)
if (errInsert) {
  console.error('❌ Error insertando trazabilidad — ABORTADO, no se tocó cronograma_cuotas:', errInsert.message)
  process.exit(1)
}
console.log(`✅ Insertadas ${filasAplicacion.length} filas en pagos_cuotas_aplicaciones.`)

let updatesOk = 0, updatesError = 0
const erroresUpdate = []
for (const u of updatesCuotas) {
  const { error } = await sb.from('cronograma_cuotas')
    .update({ capital_pagado: u.capital_pagado, interes_pagado: u.interes_pagado, estado: u.estado, fecha_pago: u.fecha_pago })
    .eq('id', u.id)
  if (error) { updatesError++; erroresUpdate.push({ cuota_id: u.id, error: error.message }) }
  else updatesOk++
}

console.log(`✅ cronograma_cuotas actualizadas: ${updatesOk} OK, ${updatesError} con error.\n`)
if (updatesError > 0) {
  console.error('⚠️  Hubo errores actualizando cuotas (la trazabilidad ya quedó insertada). Detalle:')
  console.error(JSON.stringify(erroresUpdate, null, 2))
}

const reporte = {
  fase: '10K-2B (acotada)', modo: 'APPLY EJECUTADO', generado: now(),
  pago_excluido: PAGO_EXCLUIDO_ID,
  pagos_procesados: pagosFiltrados.length,
  filas_pagos_cuotas_aplicaciones: filasAplicacion.length,
  cuotas_actualizadas_ok: updatesOk,
  cuotas_actualizadas_error: updatesError,
  cuotas_quedaron_pagadas: totalCuotasPagadas,
  cuotas_quedaron_parciales: totalCuotasParciales,
  monto_total_aplicado: totalMontoAplicado,
  creditos_afectados: resumenPorCredito.length,
  creditos_sin_cronograma_omitidos: creditosOmitidos,
  errores: erroresUpdate,
}
writeFileSync(resolve(ROOT, 'docs/ai-recovery/pagos_cuotas_10k2b_apply_report.json'), JSON.stringify(reporte, null, 2), 'utf8')
console.log('💾 Reporte guardado: docs/ai-recovery/pagos_cuotas_10k2b_apply_report.json')
console.log('\n✅ Fase 10K-2B (acotada) completada.\n')
