/**
 * plan-pagos-cuotas.mjs
 * Fase 10K-0 — Dry-run: simular aplicación de pagos a cuotas con algoritmo de cascada completo.
 *
 * REGLAS ESTRICTAS — SOLO LECTURA:
 * - NO insert / NO update / NO delete / NO truncate
 * - NO toca cronograma_cuotas / creditos / pagos_recibos / socios
 * - NO toca usuarios / configuracion / auth.users
 * - NO crea migraciones
 * - Solo dry-run, propuesta y reporte
 *
 * Mejoras sobre Fase 9C-6H.0:
 * - Algoritmo de cascada: si el monto supera la cuota, el sobrante pasa a la siguiente
 * - Detección de pagos mixtos (aporte + crédito)
 * - Detección de excedentes después de cubrir todas las cuotas
 * - Reporte de casos especiales completo
 * - Evaluación de si hace falta migración
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

// ─── Algoritmo de cascada ──────────────────────────────────────────────────────

function simularAplicacionCascada(pago, cuotas, estadoLocal) {
  const { capital: montoCapital, total: montoTotal, esMixto } = montoAplicableACuota(pago)
  const propuestasDelPago = []

  if (montoTotal === 0) {
    return {
      propuestas: [],
      excedente: 0,
      razonNoAplicable: 'monto_capital + monto_interes = 0',
      esMixto,
    }
  }

  let montoDisponible = montoTotal

  // Repartir capital e interes proporcionalmente al monto disponible
  // La distribución sigue la proporción original del pago
  const ratioCapital = montoTotal > 0 ? montoCapital / montoTotal : 0

  for (const cuota of cuotas) {
    if (montoDisponible <= 0.005) break // tolerancia de redondeo

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
      // Esta cuota ya está cubierta en estado local pero no marcada pagada — borde raro
      localState.estado = 'pagada'
      continue
    }

    let capitalAplicar, interesAplicar

    if (montoDisponible >= saldoCuota) {
      // Cubrir cuota completa, sobrante pasa a siguiente
      capitalAplicar = capitalFaltante
      interesAplicar = interesFaltante
      montoDisponible = round2(montoDisponible - saldoCuota)

      localState.capital_pagado = round2(localState.capital_pagado + capitalAplicar)
      localState.interes_pagado = round2(localState.interes_pagado + interesAplicar)
      localState.estado = 'pagada'
      localState.fecha_pago = pago.fecha

      propuestasDelPago.push({
        pago_id: pago.id,
        credito_id: pago.id_credito,
        cuota_id: cuota.id,
        nro_cuota: cuota.nro_cuota,
        fecha_pago: pago.fecha,
        estado_actual: cuota.estado,
        estado_propuesto: 'pagada',
        capital_aplicado: capitalAplicar,
        interes_aplicado: interesAplicar,
        monto_aplicado: round2(capitalAplicar + interesAplicar),
        monto_cuota: cuotaTotal,
        saldo_cuota_previo: saldoCuota,
        excedente_esta_cuota: 0,
        es_cascada: propuestasDelPago.length > 0,
        es_mixto: esMixto,
      })
    } else {
      // Pago parcial — el monto disponible no alcanza para cubrir la cuota
      // Distribuir proporcionalmente entre capital e interés
      capitalAplicar = round2(Math.min(montoDisponible * ratioCapital, capitalFaltante))
      interesAplicar = round2(Math.min(montoDisponible - capitalAplicar, interesFaltante))
      // Ajuste de redondeo
      const totalAplicar = round2(capitalAplicar + interesAplicar)
      if (totalAplicar < montoDisponible - 0.01 && interesFaltante > interesAplicar) {
        interesAplicar = round2(montoDisponible - capitalAplicar)
      }

      localState.capital_pagado = round2(localState.capital_pagado + capitalAplicar)
      localState.interes_pagado = round2(localState.interes_pagado + interesAplicar)
      localState.estado = 'parcial'
      montoDisponible = 0

      propuestasDelPago.push({
        pago_id: pago.id,
        credito_id: pago.id_credito,
        cuota_id: cuota.id,
        nro_cuota: cuota.nro_cuota,
        fecha_pago: pago.fecha,
        estado_actual: cuota.estado,
        estado_propuesto: 'parcial',
        capital_aplicado: capitalAplicar,
        interes_aplicado: interesAplicar,
        monto_aplicado: round2(capitalAplicar + interesAplicar),
        monto_cuota: cuotaTotal,
        saldo_cuota_previo: saldoCuota,
        excedente_esta_cuota: 0,
        es_cascada: propuestasDelPago.length > 0,
        es_mixto: esMixto,
      })
    }
  }

  const excedente = round2(montoDisponible)

  return {
    propuestas: propuestasDelPago,
    excedente,
    razonNoAplicable: null,
    esMixto,
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════════════════')
console.log('  CEJUASSA — Plan: Aplicar pagos a cuotas (10K-0)')
console.log('  MODO: DRY-RUN — NO se modificará ningún dato')
console.log('  Algoritmo: cascada completa (monto sobrante → siguiente cuota)')
console.log('══════════════════════════════════════════════════════════════\n')

// ─── Paso 1: Auditar estructura de tablas ─────────────────────────────────────

console.log('🔍 Paso 1 — Auditar estructura de tablas...')

const { data: columnasCC } = await sb
  .from('information_schema.columns')
  .select('column_name, data_type, is_nullable')
  .eq('table_schema', 'public')
  .eq('table_name', 'cronograma_cuotas')
  .order('ordinal_position')

const camposCC = columnasCC?.map(c => c.column_name) || []

const camposEsperadosCC = [
  'id', 'id_credito', 'nro_cuota', 'fecha_vencimiento', 'capital', 'interes',
  'cuota_total', 'capital_pagado', 'interes_pagado', 'estado', 'fecha_pago',
]
const camposFaltantesCC = ['monto_pagado', 'saldo_pendiente', 'id_pago']

console.log('\n  cronograma_cuotas — Campos encontrados:')
for (const c of camposEsperadosCC) {
  const ok = camposCC.includes(c)
  console.log(`    ${ok ? '✅' : '❌'} ${c}`)
}
console.log('\n  cronograma_cuotas — Campos NO encontrados (para trazabilidad):')
for (const c of camposFaltantesCC) {
  const existe = camposCC.includes(c)
  console.log(`    ${existe ? '✅ (existe)' : '⚠️  ' + c + ' — no existe'} ${existe ? '' : '(calculable o faltante para trazabilidad)'}`)
}

const tieneIdPago = camposCC.includes('id_pago')
console.log(`\n  📋 Migración necesaria para trazabilidad: ${tieneIdPago ? 'NO (id_pago ya existe)' : 'SÍ — falta campo id_pago'}`)
console.log(`     (NO es bloqueante para el apply — solo para auditoría)`)

// ─── Paso 2: Cargar los pagos vinculados ─────────────────────────────────────

console.log('\n📥 Paso 2 — Cargando pagos_recibos con id_credito IS NOT NULL...')
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

// Estadísticas de composición de pagos
let pagosConSoloCredito = 0
let pagosMixtos = 0
let pagosSoloAporteOFPS = 0

for (const p of pagos) {
  const { total, esMixto } = montoAplicableACuota(p)
  if (total === 0) pagosSoloAporteOFPS++
  else if (esMixto) pagosMixtos++
  else pagosConSoloCredito++
}

console.log(`  → Composición:`)
console.log(`    - Solo crédito (capital+interés): ${pagosConSoloCredito}`)
console.log(`    - Mixtos (crédito + aporte/FPS): ${pagosMixtos} ⚠️`)
console.log(`    - Solo aporte/FPS/otros (no aplicables): ${pagosSoloAporteOFPS}`)

// ─── Paso 3: Cargar créditos y cuotas ────────────────────────────────────────

const creditoIds = [...new Set(pagos.map(p => p.id_credito))]
console.log(`\n📥 Paso 3 — Cargando datos para ${creditoIds.length} créditos únicos...`)

const { data: todasLasCuotas, error: errCuotas } = await sb
  .from('cronograma_cuotas')
  .select('id, id_credito, nro_cuota, fecha_vencimiento, capital, interes, cuota_total, capital_pagado, interes_pagado, estado, fecha_pago')
  .in('id_credito', creditoIds)
  .order('nro_cuota', { ascending: true })

if (errCuotas) { console.error('❌ Error cargando cuotas:', errCuotas.message); process.exit(1) }
console.log(`  → ${todasLasCuotas.length} cuotas cargadas`)

const { data: creditos, error: errCred } = await sb
  .from('creditos')
  .select('id, nro_pagare, monto_aprobado, saldo_capital, cuota_mensual, plazo_meses, tasa_interes, estado')
  .in('id', creditoIds)

if (errCred) { console.error('❌ Error cargando créditos:', errCred.message); process.exit(1) }

const creditoById = {}
for (const c of creditos) creditoById[c.id] = c

const cuotasPorCredito = {}
for (const c of todasLasCuotas) {
  if (!cuotasPorCredito[c.id_credito]) cuotasPorCredito[c.id_credito] = []
  cuotasPorCredito[c.id_credito].push(c)
}

const pagosPorCredito = {}
for (const p of pagos) {
  if (!pagosPorCredito[p.id_credito]) pagosPorCredito[p.id_credito] = []
  pagosPorCredito[p.id_credito].push(p)
}

// ─── Paso 4: Simulación con cascada ──────────────────────────────────────────

console.log('\n🧮 Paso 4 — Simulando aplicación con algoritmo de cascada...')
console.log('   Regla: capital + interés → cuota más antigua pendiente/vencida/parcial')
console.log('   Si sobra monto después de cubrir cuota → pasa a siguiente cuota\n')

const todasLasPropuestas = []
const pagosNoAsignables = []
const pagosMixtosDetalle = []
const excedentesDetalle = []
const resumenPorCredito = []

let totalCuotasPagadas = 0
let totalCuotasParciales = 0
let totalExcedentes = 0
let creditosSinCronograma = 0

for (const creditoId of creditoIds) {
  const credito = creditoById[creditoId]
  const cuotas = cuotasPorCredito[creditoId] || []
  const pagosDelCredito = pagosPorCredito[creditoId] || []

  if (cuotas.length === 0) {
    console.log(`  ⚠️  Crédito ${mask(creditoId)}: sin cuotas (estado: ${credito?.estado || 'desconocido'})`)
    creditosSinCronograma++
    for (const p of pagosDelCredito) {
      pagosNoAsignables.push({ pago_id: p.id, credito_id: creditoId, razon: 'sin cuotas en cronograma' })
    }
    continue
  }

  // Estado local (en memoria)
  const estadoLocal = {}
  for (const c of cuotas) {
    estadoLocal[c.id] = {
      capital_pagado: round2(num(c.capital_pagado)),
      interes_pagado: round2(num(c.interes_pagado)),
      estado: c.estado,
      fecha_pago: c.fecha_pago,
    }
  }

  let cuotasPagadasCredito = 0
  let cuotasParcialCredito = 0
  let pagosAsignados = 0
  let pagosNoAsig = 0
  let excedenteTotalCredito = 0

  console.log(`\n  Crédito ${mask(creditoId)} | ${cuotas.length} cuotas | ${pagosDelCredito.length} pago(s) | estado: ${credito?.estado || '?'}`)

  for (const pago of pagosDelCredito) {
    const { total: montoTotal, esMixto } = montoAplicableACuota(pago)

    if (esMixto) {
      pagosMixtosDetalle.push({
        pago_id: pago.id,
        credito_id: creditoId,
        monto_capital: num(pago.monto_capital),
        monto_interes: num(pago.monto_interes),
        monto_aporte: num(pago.monto_aporte),
        monto_fps: num(pago.monto_fps),
        monto_fps_extra: num(pago.monto_fps_extra),
        monto_otros: num(pago.monto_otros),
        monto_total: num(pago.monto_total),
      })
      console.log(`    ℹ️  Pago ${mask(pago.id)} (${pago.fecha}): MIXTO — capital+interés=${montoTotal} + aporte/FPS presentes`)
    }

    if (montoTotal === 0) {
      pagosNoAsignables.push({ pago_id: pago.id, credito_id: creditoId, razon: 'monto_capital + monto_interes = 0' })
      pagosNoAsig++
      console.log(`    ⚠️  Pago ${mask(pago.id)} (${pago.fecha}): no aplicable — solo aporte/FPS`)
      continue
    }

    const resultado = simularAplicacionCascada(pago, cuotas, estadoLocal)

    if (resultado.propuestas.length === 0 && resultado.excedente > 0) {
      // Pago sin cuotas pendientes — todo es excedente
      excedentesDetalle.push({
        pago_id: pago.id,
        credito_id: creditoId,
        excedente: resultado.excedente,
        razon: 'todas las cuotas ya propuestas como pagadas',
      })
      pagosNoAsignables.push({ pago_id: pago.id, credito_id: creditoId, razon: 'todas las cuotas ya propuestas como pagadas' })
      pagosNoAsig++
      console.log(`    ⚠️  Pago ${mask(pago.id)} (${pago.fecha}): excedente S/${resultado.excedente.toFixed(2)} — no hay cuotas pendientes`)
      continue
    }

    for (const prop of resultado.propuestas) {
      todasLasPropuestas.push(prop)
      if (prop.estado_propuesto === 'pagada') cuotasPagadasCredito++
      else if (prop.estado_propuesto === 'parcial') cuotasParcialCredito++
      const cascadaTag = prop.es_cascada ? ' [cascada]' : ''
      const mixtoTag = prop.es_mixto ? ' [mixto]' : ''
      console.log(`    ✓ Pago ${mask(pago.id)} (${pago.fecha}) → Cuota ${prop.nro_cuota} | aplicado=S/${prop.monto_aplicado.toFixed(2)} | ${prop.estado_actual}→${prop.estado_propuesto}${cascadaTag}${mixtoTag}`)
    }

    if (resultado.excedente > 0.01) {
      excedenteTotalCredito += resultado.excedente
      totalExcedentes++
      excedentesDetalle.push({
        pago_id: pago.id,
        credito_id: creditoId,
        excedente: resultado.excedente,
        razon: 'sobrante después de cubrir cuotas disponibles',
      })
      console.log(`    ℹ️  Excedente S/${resultado.excedente.toFixed(2)} — no asignado a ninguna cuota`)
    }

    pagosAsignados++
  }

  // Contar propuestas únicas por cuota (puede haber múltiples propuestas sobre la misma cuota)
  const cuotasCubiertas = new Set()
  const cuotasFinales = new Map()
  for (const prop of todasLasPropuestas.filter(p => p.credito_id === creditoId)) {
    cuotasCubiertas.add(prop.cuota_id)
    cuotasFinales.set(prop.cuota_id, prop.estado_propuesto)
  }

  const cuotasPendientesRestantes = cuotas.filter(c => {
    const est = estadoLocal[c.id].estado
    return est === 'pendiente' || est === 'vencida' || est === 'parcial'
  }).length

  resumenPorCredito.push({
    credito_id: creditoId,
    credito_masked: mask(creditoId),
    nro_pagare: credito?.nro_pagare || null,
    estado_credito: credito?.estado || 'desconocido',
    total_cuotas: cuotas.length,
    cuotas_pagadas_propuestas: cuotasPagadasCredito,
    cuotas_parciales_propuestas: cuotasParcialCredito,
    cuotas_pendientes_restantes: cuotasPendientesRestantes,
    pagos_analizados: pagosDelCredito.length,
    pagos_asignados: pagosAsignados,
    pagos_no_asignados: pagosNoAsig,
    excedente_total: round2(excedenteTotalCredito),
  })

  totalCuotasPagadas += cuotasPagadasCredito
  totalCuotasParciales += cuotasParcialCredito
}

// ─── Resumen ──────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════════════════')
console.log('  RESUMEN DEL PLAN (DRY-RUN 10K-0)')
console.log('══════════════════════════════════════════════════════════════')
console.log(`  Pagos analizados:                   ${pagos.length}`)
console.log(`  Pagos solo crédito:                 ${pagosConSoloCredito}`)
console.log(`  Pagos mixtos (crédito+aporte/FPS):  ${pagosMixtos}`)
console.log(`  Pagos no aplicables (monto=0):      ${pagosSoloAporteOFPS}`)
console.log(`  Créditos afectados:                 ${creditoIds.length}`)
console.log(`  Créditos sin cronograma:            ${creditosSinCronograma}`)
console.log(`  Cuotas propuestas como PAGADAS:     ${totalCuotasPagadas}`)
console.log(`  Cuotas propuestas como PARCIALES:   ${totalCuotasParciales}`)
console.log(`  Pagos no asignables (total):        ${pagosNoAsignables.length}`)
console.log(`  Excedentes detectados:              ${totalExcedentes}`)
console.log(`  Propuestas generadas:               ${todasLasPropuestas.length}`)
console.log(`  Campo id_pago en cronograma_cuotas: ${tieneIdPago ? '✅ existe' : '❌ no existe — migración recomendada'}`)
console.log('══════════════════════════════════════════════════════════════\n')

// ─── Evaluación de migración ──────────────────────────────────────────────────

console.log('📋 Evaluación de migración:')
console.log(`  ${tieneIdPago ? '✅ No hace falta migración' : '⚠️  Se recomienda agregar id_pago antes del apply'}`)
if (!tieneIdPago) {
  console.log('  Migración propuesta (NO aplicar todavía):')
  console.log('  ALTER TABLE public.cronograma_cuotas')
  console.log('    ADD COLUMN IF NOT EXISTS id_pago integer REFERENCES pagos_recibos(id) ON DELETE SET NULL;')
  console.log('  Esto es opcional para el apply — requerido para trazabilidad completa.\n')
}

// ─── Guardar JSON ─────────────────────────────────────────────────────────────

if (!existsSync(DOCS_DIR)) mkdirSync(DOCS_DIR, { recursive: true })

const previewData = {
  fase: '10K-0',
  modo: 'DRY-RUN',
  algoritmo: 'cascada completa',
  generated_at: now(),
  regla_monto: 'monto_aplicado = monto_capital + monto_interes (excluye monto_aporte, monto_fps, monto_fps_extra, monto_otros)',
  migracion_necesaria: !tieneIdPago,
  campo_id_pago_existe: tieneIdPago,
  totales: {
    pagos_analizados: pagos.length,
    pagos_solo_credito: pagosConSoloCredito,
    pagos_mixtos: pagosMixtos,
    pagos_no_aplicables: pagosSoloAporteOFPS,
    creditos_afectados: creditoIds.length,
    creditos_sin_cronograma: creditosSinCronograma,
    cuotas_propuestas_pagadas: totalCuotasPagadas,
    cuotas_propuestas_parciales: totalCuotasParciales,
    pagos_no_asignables: pagosNoAsignables.length,
    excedentes_detectados: totalExcedentes,
    propuestas_generadas: todasLasPropuestas.length,
  },
  propuestas: todasLasPropuestas.map(p => ({
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
    saldo_previo: p.saldo_cuota_previo,
    es_cascada: p.es_cascada,
    es_mixto: p.es_mixto,
  })),
  pagos_no_asignables: pagosNoAsignables.map(p => ({
    pago_id: mask(p.pago_id),
    credito_id: mask(p.credito_id),
    razon: p.razon,
  })),
  pagos_mixtos_detalle: pagosMixtosDetalle.map(p => ({
    pago_id: mask(p.pago_id),
    credito_id: mask(p.credito_id),
    monto_capital: p.monto_capital,
    monto_interes: p.monto_interes,
    monto_aporte: p.monto_aporte,
    monto_fps: p.monto_fps,
    monto_otros: p.monto_otros,
  })),
  excedentes: excedentesDetalle.map(e => ({
    pago_id: mask(e.pago_id),
    credito_id: mask(e.credito_id),
    excedente: e.excedente,
    razon: e.razon,
  })),
  resumen_por_credito: resumenPorCredito.map(r => ({
    credito_masked: r.credito_masked,
    estado_credito: r.estado_credito,
    total_cuotas: r.total_cuotas,
    cuotas_pagadas_propuestas: r.cuotas_pagadas_propuestas,
    cuotas_parciales_propuestas: r.cuotas_parciales_propuestas,
    cuotas_pendientes_restantes: r.cuotas_pendientes_restantes,
    pagos_analizados: r.pagos_analizados,
    pagos_asignados: r.pagos_asignados,
    pagos_no_asignados: r.pagos_no_asignados,
    excedente_total: r.excedente_total,
  })),
}

const previewPath = resolve(DOCS_DIR, 'plan_pagos_cuotas_10k0_preview.json')
writeFileSync(previewPath, JSON.stringify(previewData, null, 2), 'utf8')
console.log(`💾 Preview guardado: docs/ai-recovery/plan_pagos_cuotas_10k0_preview.json`)
console.log('\n✅ Plan Fase 10K-0 completado. NINGÚN DATO FUE MODIFICADO.\n')
