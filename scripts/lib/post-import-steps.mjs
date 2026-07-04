/**
 * post-import-steps.mjs
 * Pasos automáticos post-recarga (usados por import-excel-mvp.mjs y por
 * scripts/post-import-finalize.mjs cuando se corre por separado).
 *
 * PASO A — Regenerar cronogramas: DETERMINÍSTICO, se aplica automáticamente.
 *   Genera cronograma_cuotas para todo crédito elegible (monto/plazo/tasa/fecha
 *   válidos) que aún no tenga cuotas. Mismo algoritmo (sistema francés) ya
 *   validado en apply-regenerate-cronogramas.mjs — sin números esperados
 *   hardcodeados, para que funcione con cualquier recarga futura.
 *
 * PASO B — Vincular pagos a créditos: SOLO se aplica automáticamente la
 *   categoría match_alto (sin ambigüedad). match_medio / ambiguo / sin_match
 *   / no_aplica_credito quedan SIN TOCAR y se listan en un Excel para
 *   revisión de Créditos/Tesorería — mismo criterio de clasificación ya
 *   validado en dry-run-link-pagos-creditos.mjs / apply-link-pagos-creditos.mjs.
 *
 * NO incluye (queda como paso manual separado, con dry-run + confirmación,
 * igual que la Fase 10K-2B ya ejecutada):
 *   - Aplicar montos de pagos a cronograma_cuotas / pagos_cuotas_aplicaciones.
 */

import XLSX from 'xlsx'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve } from 'path'

function round2(n) { return Math.round(n * 100) / 100 }
function num(v) { return Number(v) || 0 }
function mask(val) {
  const s = String(val ?? '').trim()
  return s.length === 0 ? '(vacío)' : s.substring(0, 4) + '****'
}

// ─── PASO A — Regenerar cronogramas ──────────────────────────────────────────

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
      id_credito, nro_cuota: i, fecha_vencimiento: addMonths(fecha_desembolso, i),
      capital, interes, cuota_total, capital_pagado: 0, interes_pagado: 0,
      estado: 'pendiente', fecha_pago: null,
    })
  }
  return cuotas
}

export async function regenerarCronogramas(sb, { log = console.log, dryRun = false } = {}) {
  log(`\n📐 Paso A — Regenerando cronogramas de cuotas...${dryRun ? ' [DRY-RUN]' : ''}`)

  const { data: creditos, error: errCred } = await sb
    .from('creditos')
    .select('id, monto_aprobado, tasa_interes, plazo_meses, fecha_desembolso, estado')
  if (errCred) throw new Error(`Error leyendo créditos: ${errCred.message}`)

  const { data: cuotasExistentes, error: errCuotas } = await sb
    .from('cronograma_cuotas').select('id_credito')
  if (errCuotas) throw new Error(`Error leyendo cronograma_cuotas: ${errCuotas.message}`)
  const creditosConCuotas = new Set(cuotasExistentes.map(c => c.id_credito))

  const elegibles = []
  const omitidos = []
  for (const c of creditos) {
    if (creditosConCuotas.has(c.id)) { omitidos.push({ id: c.id, razon: 'ya tiene cronograma' }); continue }
    if (c.estado !== 'vigente') { omitidos.push({ id: c.id, razon: `estado=${c.estado} (solo se generan cronogramas para vigentes)` }); continue }
    const razones = []
    if (!c.monto_aprobado || c.monto_aprobado <= 0) razones.push('monto_aprobado inválido')
    if (!c.plazo_meses || c.plazo_meses <= 0) razones.push('plazo_meses inválido')
    if (!c.fecha_desembolso) razones.push('fecha_desembolso vacía')
    if (!c.tasa_interes || c.tasa_interes <= 1) razones.push('tasa_interes<=1 (posible error de unidad)')
    if (razones.length > 0) { omitidos.push({ id: c.id, razon: razones.join(', ') }); continue }
    elegibles.push(c)
  }

  log(`  → Créditos totales: ${creditos.length} | elegibles: ${elegibles.length} | omitidos: ${omitidos.length}`)

  let totalInsertadas = 0
  const errores = []
  if (dryRun) {
    for (const c of elegibles) totalInsertadas += generarCuotas(c).length
    log(`  🛑 dry-run: no se insertó nada (se habrían insertado ${totalInsertadas} cuotas).`)
  } else {
    for (const c of elegibles) {
      const cuotas = generarCuotas(c)
      for (let i = 0; i < cuotas.length; i += 50) {
        const lote = cuotas.slice(i, i + 50)
        const { error } = await sb.from('cronograma_cuotas').insert(lote)
        if (error) { errores.push({ credito_id: c.id, error: error.message }); break }
        totalInsertadas += lote.length
      }
    }
  }

  log(`  ✅ Cuotas insertadas: ${totalInsertadas} | créditos con error: ${errores.length}`)
  return { creditosElegibles: elegibles.length, creditosOmitidos: omitidos, cuotasInsertadas: totalInsertadas, errores }
}

// ─── PASO B — Vincular pagos con match_alto (clasificación idéntica a 9C-6F) ─

function clasificarPago(p) {
  const hasCapital = num(p.monto_capital) > 0
  const hasInteres = num(p.monto_interes) > 0
  const hasAporte  = num(p.monto_aporte) > 0
  const hasFps     = num(p.monto_fps) > 0 || num(p.monto_fps_extra) > 0
  const hasOtros   = num(p.monto_otros) > 0
  const hasCreditComp    = hasCapital || hasInteres
  const hasNonCreditComp = hasAporte || hasFps || hasOtros

  if (hasCreditComp && hasNonCreditComp) return 'D'
  if (hasCreditComp) return 'A'
  if (hasAporte && !hasCreditComp) return 'B'
  if ((hasFps || hasOtros) && !hasCreditComp && !hasAporte) return 'C'
  return 'F'
}

const TOLERANCIA_CUOTA = 5

function parseDate(str) {
  if (!str) return null
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function addMonthsDate(fechaStr, months) {
  if (!fechaStr) return null
  const [y, m, d] = fechaStr.split('-').map(Number)
  const totalMonths = (m - 1) + months
  const newYear = y + Math.floor(totalMonths / 12)
  const newMonth = (totalMonths % 12) + 1
  const day = Math.min(d, new Date(newYear, newMonth, 0).getDate())
  return new Date(newYear, newMonth - 1, day)
}

function encontrarMatch(pago, creditosPorSocio) {
  const grupo = clasificarPago(pago)
  if (grupo === 'B' || grupo === 'C') {
    return { categoria: 'no_aplica_credito', credito_id: null, razon: `grupo ${grupo} sin componente capital/interes`, grupo }
  }
  if (!pago.id_socio) return { categoria: 'sin_match', credito_id: null, razon: 'pago sin id_socio', grupo }

  const creditos = creditosPorSocio[pago.id_socio] || []
  if (creditos.length === 0) return { categoria: 'sin_match', credito_id: null, razon: 'socio sin créditos en DB', grupo }

  const pagoFecha = parseDate(pago.fecha)
  const enRango = creditos.filter(c => {
    const inicio = parseDate(c.fecha_desembolso)
    const fin = addMonthsDate(c.fecha_desembolso, c.plazo_meses || 120)
    if (!inicio || !pagoFecha) return false
    return pagoFecha >= inicio && pagoFecha <= fin
  })

  if (enRango.length === 1) {
    return { categoria: 'match_alto', credito_id: enRango[0].id, razon: `socio + único crédito en rango fecha (${enRango[0].estado})`, grupo }
  }
  if (enRango.length > 1) {
    const montoCredito = num(pago.monto_capital) + num(pago.monto_interes)
    const porMonto = enRango.filter(c => Math.abs(num(c.cuota_mensual) - montoCredito) <= TOLERANCIA_CUOTA)
    if (porMonto.length === 1) {
      return { categoria: 'match_alto', credito_id: porMonto[0].id, razon: `socio + rango fecha + monto cuota coincide (±S/${TOLERANCIA_CUOTA})`, grupo }
    }
    return { categoria: 'ambiguo', credito_id: null, razon: `${enRango.length} créditos en rango de fechas para el mismo socio`, grupo }
  }
  if (creditos.length === 1) {
    return { categoria: 'match_medio', credito_id: creditos[0].id, razon: `único crédito del socio (fuera de rango fecha, estado: ${creditos[0].estado})`, grupo }
  }
  const vigentes = creditos.filter(c => c.estado === 'vigente')
  if (vigentes.length === 1) {
    return { categoria: 'match_medio', credito_id: vigentes[0].id, razon: 'único crédito vigente del socio (fecha fuera de rango)', grupo }
  }
  if (vigentes.length > 1) {
    return { categoria: 'ambiguo', credito_id: null, razon: `${vigentes.length} créditos vigentes del socio, ninguno en rango de fecha`, grupo }
  }
  return { categoria: 'sin_match', credito_id: null, razon: 'sin crédito en rango ni único vigente', grupo }
}

export async function vincularPagosMatchAlto(sb, { log = console.log, exportDir, dryRun = false } = {}) {
  log(`\n🔗 Paso B — Vinculando pagos con crédito claro (match_alto)...${dryRun ? ' [DRY-RUN]' : ''}`)

  const { data: pagos, error: errPagos } = await sb
    .from('pagos_recibos')
    .select('id, id_socio, id_credito, fecha, monto_capital, monto_interes, monto_aporte, monto_fps, monto_fps_extra, monto_otros')
    .is('id_credito', null)
  if (errPagos) throw new Error(`Error leyendo pagos_recibos: ${errPagos.message}`)

  const { data: creditos, error: errCred } = await sb
    .from('creditos').select('id, id_socio, fecha_desembolso, plazo_meses, cuota_mensual, estado')
  if (errCred) throw new Error(`Error leyendo creditos: ${errCred.message}`)

  const creditosPorSocio = {}
  for (const c of creditos) (creditosPorSocio[c.id_socio] ??= []).push(c)

  const resultados = pagos.map(p => ({ pago: p, ...encontrarMatch(p, creditosPorSocio) }))
  const matchAlto = resultados.filter(r => r.categoria === 'match_alto')
  const matchMedio = resultados.filter(r => r.categoria === 'match_medio')
  const ambiguo = resultados.filter(r => r.categoria === 'ambiguo')
  const sinMatch = resultados.filter(r => r.categoria === 'sin_match')
  const noAplica = resultados.filter(r => r.categoria === 'no_aplica_credito')

  log(`  → Pagos sin id_credito: ${pagos.length}`)
  log(`  → match_alto (se vincula ahora): ${matchAlto.length}`)
  log(`  → match_medio (requiere revisión manual, NO se toca): ${matchMedio.length}`)
  log(`  → ambiguo (requiere revisión manual, NO se toca): ${ambiguo.length}`)
  log(`  → sin_match / no_aplica_credito (sin componente de crédito o sin datos): ${sinMatch.length + noAplica.length}`)

  let exitosos = 0
  const errores = []
  if (dryRun) {
    log(`  🛑 dry-run: no se escribió nada (se habrían vinculado ${matchAlto.length}).`)
  } else {
    for (const r of matchAlto) {
      const { error } = await sb.from('pagos_recibos').update({ id_credito: r.credito_id }).eq('id', r.pago.id).is('id_credito', null)
      if (error) errores.push({ pago_id: r.pago.id, error: error.message })
      else exitosos++
    }
    log(`  ✅ Vinculados: ${exitosos} | errores: ${errores.length}`)
  }

  // Excel de revisión para los casos que SÍ requieren ojo humano
  if (exportDir) {
    if (!existsSync(exportDir)) mkdirSync(exportDir, { recursive: true })
    const wb = XLSX.utils.book_new()
    const revisar = [...matchMedio, ...ambiguo].map(r => ({
      pago_id: mask(r.pago.id), socio_id: mask(r.pago.id_socio), fecha: r.pago.fecha,
      monto_capital: num(r.pago.monto_capital), monto_interes: num(r.pago.monto_interes),
      categoria: r.categoria, razon: r.razon, decision_creditos_tesoreria: '',
    }))
    const ws = XLSX.utils.json_to_sheet(revisar)
    ws['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 60 }, { wch: 30 }]
    XLSX.utils.book_append_sheet(wb, ws, 'requiere_revision')
    const excelPath = resolve(exportDir, `post_import_pagos_revision_manual_${Date.now()}.xlsx`)
    XLSX.writeFile(wb, excelPath)
    log(`  💾 Excel de revisión (match_medio + ambiguo): ${excelPath}`)
  }

  return {
    pagosSinCredito: pagos.length, matchAlto: matchAlto.length, vinculados: exitosos,
    matchMedio: matchMedio.length, ambiguo: ambiguo.length,
    sinMatch: sinMatch.length, noAplicaCredito: noAplica.length, errores,
  }
}
