/**
 * dry-run-link-pagos-creditos.mjs
 * Fase 9C-6E — Dry-run: clasificar pagos_recibos con id_credito=NULL y proponer matches.
 *
 * REGLAS ESTRICTAS — SOLO LECTURA:
 * - NO insert / NO update / NO delete / NO truncate
 * - NO toca usuarios / configuracion / auth.users
 * - NO modifica _client_files/ ni cronograma_cuotas ni creditos ni socios
 * - NO crea migraciones
 * - NO imprime datos personales completos
 * - Solo lectura, clasificación, propuesta y reporte
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

// ─── Clasificación de pagos ────────────────────────────────────────────────────
// A: componente capital/interés claro
// B: solo aporte
// C: solo FPS/otros/trámite/seguro
// D: mixto (múltiples componentes)
// E: tipo K
// F: sin información suficiente

function clasificarPago(p) {
  const hasCapital = num(p.monto_capital) > 0
  const hasInteres = num(p.monto_interes) > 0
  const hasAporte  = num(p.monto_aporte) > 0
  const hasFps     = num(p.monto_fps) > 0 || num(p.monto_fps_extra) > 0
  const hasOtros   = num(p.monto_otros) > 0

  const hasCreditComp    = hasCapital || hasInteres
  const hasNonCreditComp = hasAporte || hasFps || hasOtros

  // Tipo K: detectado por tipo_pago='K' o en observacion
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

// ─── Estrategia de match ───────────────────────────────────────────────────────
// match_alto   : un único crédito inequívoco
// match_medio  : probable pero requiere revisión manual
// ambiguo      : más de un crédito posible
// no_aplica    : sin componente de crédito (B, C)
// sin_match    : no hay datos suficientes

const TOLERANCIA_CUOTA = 5 // S/ — diferencia máxima para match por monto

function encontrarMatch(pago, creditosPorSocio) {
  const grupo = clasificarPago(pago)

  // Grupos sin componente de crédito → no aplica vincular
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

  // Estrategia 1: créditos cuyo rango de fechas incluye el pago
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
    // Estrategia 2: dentro del rango, afinar por monto de cuota
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
    // Múltiples en rango → ambiguo
    return {
      categoria: 'ambiguo',
      credito_id: null,
      razon: `${enRango.length} créditos en rango de fechas para el mismo socio`,
      grupo,
      candidatos: enRango.map(c => c.id),
    }
  }

  // Ninguno en rango de fecha
  if (creditos.length === 1) {
    // Único crédito del socio, aunque fuera de rango (puede ser crédito cancelado con pagos tardíos)
    return {
      categoria: 'match_medio',
      credito_id: creditos[0].id,
      razon: `único crédito del socio (fuera de rango fecha, estado: ${creditos[0].estado})`,
      grupo,
    }
  }

  // Múltiples créditos pero ninguno en rango → intentar por estado vigente
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
console.log('  CEJUASSA — Dry-run Link pagos_recibos → creditos (9C-6E)')
console.log('  MODO: SOLO LECTURA — no se modifica ningún dato')
console.log('══════════════════════════════════════════════════════════════\n')

// 1. Fetch pagos con id_credito = NULL
console.log('📥 Cargando pagos_recibos con id_credito = NULL...')
const { data: pagos, error: errPagos } = await sb
  .from('pagos_recibos')
  .select('id, nro_recibo, id_socio, id_credito, id_convenio, fecha, periodo, tipo_pago, estado_flujo, monto_aporte, monto_capital, monto_interes, monto_fps, monto_fps_extra, monto_otros, monto_total, observacion')
  .is('id_credito', null)

if (errPagos) { console.error('❌ Error cargando pagos:', errPagos.message); process.exit(1) }
console.log(`  → ${pagos.length} pagos con id_credito = NULL\n`)

// 2. Fetch estructura real de pagos (muestra columnas disponibles)
const { data: samplePago } = await sb.from('pagos_recibos').select('*').limit(1)
if (samplePago?.[0]) {
  console.log('📋 Columnas disponibles en pagos_recibos:')
  console.log('  ', Object.keys(samplePago[0]).join(', '), '\n')
}

// 3. Fetch todos los créditos
console.log('📥 Cargando créditos...')
const { data: creditos, error: errCred } = await sb
  .from('creditos')
  .select('id, id_socio, nro_pagare, fecha_desembolso, plazo_meses, cuota_mensual, monto_aprobado, saldo_capital, estado, tasa_interes')

if (errCred) { console.error('❌ Error cargando créditos:', errCred.message); process.exit(1) }
console.log(`  → ${creditos.length} créditos totales`)

// Índice por id_socio
const creditosPorSocio = {}
for (const c of creditos) {
  if (!creditosPorSocio[c.id_socio]) creditosPorSocio[c.id_socio] = []
  creditosPorSocio[c.id_socio].push(c)
}

const sociosConMultiplesCreditos = Object.values(creditosPorSocio).filter(cs => cs.length > 1).length
console.log(`  → ${Object.keys(creditosPorSocio).length} socios con crédito`)
console.log(`  → ${sociosConMultiplesCreditos} socios con más de un crédito\n`)

// 4. Clasificar y encontrar matches
console.log('🔍 Clasificando pagos y buscando matches...')

const resultados = []
const conteoGrupos = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 }
const conteoMatch = {
  match_alto: 0,
  match_medio: 0,
  ambiguo: 0,
  no_aplica_credito: 0,
  sin_match: 0,
}

for (const pago of pagos) {
  const { categoria, credito_id, razon, grupo, candidatos } = encontrarMatch(pago, creditosPorSocio)
  conteoGrupos[grupo] = (conteoGrupos[grupo] || 0) + 1
  conteoMatch[categoria] = (conteoMatch[categoria] || 0) + 1
  resultados.push({ pago, categoria, credito_id, razon, grupo, candidatos })
}

// ─── Resumen ─────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════')
console.log('  RESULTADOS')
console.log('══════════════════════════════════════════════════')
console.log(`\n📊 Total pagos con id_credito = NULL: ${pagos.length}`)

console.log('\n📁 Clasificación por grupo:')
const GRUPOS = {
  A: 'componente capital/interés claro',
  B: 'solo aporte',
  C: 'solo FPS/otros/trámite/seguro',
  D: 'mixto (múltiples componentes)',
  E: 'tipo K',
  F: 'sin información suficiente',
}
for (const [g, label] of Object.entries(GRUPOS)) {
  const cnt = conteoGrupos[g] || 0
  const pct = pagos.length > 0 ? ((cnt / pagos.length) * 100).toFixed(1) : '0.0'
  console.log(`  Grupo ${g} (${label.padEnd(35)}): ${String(cnt).padStart(4)} (${pct}%)`)
}

console.log('\n🎯 Resultado de matching:')
const CAT_LABELS = {
  match_alto:        '✅ match_alto       (un único crédito claro)           ',
  match_medio:       '🟡 match_medio      (probable, requiere revisión)       ',
  ambiguo:           '🟠 ambiguo          (más de un crédito posible)         ',
  no_aplica_credito: '⚫ no_aplica_credito (sin componente de crédito)        ',
  sin_match:         '❌ sin_match        (sin datos suficientes)             ',
}
for (const [cat, label] of Object.entries(CAT_LABELS)) {
  const cnt = conteoMatch[cat] || 0
  const pct = pagos.length > 0 ? ((cnt / pagos.length) * 100).toFixed(1) : '0.0'
  console.log(`  ${label}: ${String(cnt).padStart(4)} (${pct}%)`)
}

// ─── Muestra enmascarada ──────────────────────────────────────────────────────

console.log('\n🔐 Muestra enmascarada (3 por categoría):')
for (const cat of ['match_alto', 'match_medio', 'ambiguo', 'no_aplica_credito', 'sin_match']) {
  const sample = resultados.filter(r => r.categoria === cat).slice(0, 3)
  if (sample.length === 0) continue
  console.log(`\n  --- ${cat} ---`)
  for (const r of sample) {
    const montoCapital = num(r.pago.monto_capital)
    const montoInteres = num(r.pago.monto_interes)
    const montoAporte  = num(r.pago.monto_aporte)
    const credMask = r.credito_id ? mask(r.credito_id) : '—'
    console.log(`  pago=${mask(r.pago.id)} socio=${mask(r.pago.id_socio)} fecha=${r.pago.fecha} cap=${montoCapital.toFixed(2)} int=${montoInteres.toFixed(2)} ap=${montoAporte.toFixed(2)} grupo=${r.grupo} → cred=${credMask} [${r.razon}]`)
  }
}

// ─── Riesgos ─────────────────────────────────────────────────────────────────

console.log('\n⚠️  Riesgos detectados:')
const matchAlto  = conteoMatch.match_alto || 0
const matchMedio = conteoMatch.match_medio || 0
const ambiguo    = conteoMatch.ambiguo || 0
const noAplica   = conteoMatch.no_aplica_credito || 0
const sinMatch   = conteoMatch.sin_match || 0

if (ambiguo > 0)   console.log(`  🟠 ${ambiguo} pagos ambiguos — requieren revisión manual por el cliente`)
if (sinMatch > 0)  console.log(`  ❌ ${sinMatch} pagos sin match — pueden ser pagos sin crédito asociado, o datos faltantes`)
if (matchMedio > 0)console.log(`  🟡 ${matchMedio} matches medios — probables pero fuera del rango de fecha esperado`)
if (conteoGrupos.E > 0) console.log(`  🔶 ${conteoGrupos.E} pagos tipo K — confirmar con área Créditos/SBS antes de vincular`)

const recomendacion = matchAlto > 0 && (matchMedio + ambiguo) < matchAlto * 0.2
  ? `✅ APPLY RECOMENDADO para ${matchAlto} match_alto. Revisar ${matchMedio} match_medio y ${ambiguo} ambiguos manualmente.`
  : `⚠️  REVISIÓN MANUAL recomendada antes de apply — proporción de casos inciertos es alta.`
console.log(`\n📋 Recomendación: ${recomendacion}`)

// ─── Preview JSON (seguro) ────────────────────────────────────────────────────

if (!existsSync(DOCS_DIR)) mkdirSync(DOCS_DIR, { recursive: true })

const preview = {
  generated_at: new Date().toISOString(),
  fase: '9C-6E',
  modo: 'DRY-RUN — SOLO LECTURA',
  nota: 'Todos los IDs están enmascarados. No ejecutar update sin autorización explícita.',
  totales: {
    pagos_null_credito: pagos.length,
    match_alto: matchAlto,
    match_medio: matchMedio,
    ambiguo,
    no_aplica_credito: noAplica,
    sin_match: sinMatch,
  },
  grupos: {
    A_capital_interes: conteoGrupos.A || 0,
    B_solo_aporte: conteoGrupos.B || 0,
    C_fps_otros: conteoGrupos.C || 0,
    D_mixto: conteoGrupos.D || 0,
    E_tipo_k: conteoGrupos.E || 0,
    F_sin_info: conteoGrupos.F || 0,
  },
  recomendacion,
  links_propuestos: resultados
    .filter(r => r.categoria === 'match_alto' || r.categoria === 'match_medio')
    .map(r => ({
      pago_id_masked: mask(r.pago.id),
      id_socio_masked: mask(r.pago.id_socio),
      fecha: r.pago.fecha,
      periodo: r.pago.periodo || null,
      monto_capital: num(r.pago.monto_capital),
      monto_interes: num(r.pago.monto_interes),
      monto_aporte: num(r.pago.monto_aporte),
      grupo: r.grupo,
      categoria: r.categoria,
      credito_id_masked: mask(r.credito_id),
      razon: r.razon,
    })),
  casos_ambiguos: resultados
    .filter(r => r.categoria === 'ambiguo')
    .map(r => ({
      pago_id_masked: mask(r.pago.id),
      id_socio_masked: mask(r.pago.id_socio),
      fecha: r.pago.fecha,
      grupo: r.grupo,
      razon: r.razon,
      num_candidatos: (r.candidatos || []).length,
    })),
  sin_match: resultados
    .filter(r => r.categoria === 'sin_match')
    .map(r => ({
      pago_id_masked: mask(r.pago.id),
      id_socio_masked: mask(r.pago.id_socio),
      fecha: r.pago.fecha,
      grupo: r.grupo,
      razon: r.razon,
    })),
}

const previewPath = resolve(DOCS_DIR, 'proposed_pago_credito_links_preview.json')
writeFileSync(previewPath, JSON.stringify(preview, null, 2), 'utf8')
console.log(`\n💾 Preview guardado en: docs/ai-recovery/proposed_pago_credito_links_preview.json`)
console.log(`   (${preview.links_propuestos.length} links propuestos + ${preview.casos_ambiguos.length} ambiguos + ${preview.sin_match.length} sin match)\n`)

// ─── Apply instructions (read-only, for user reference) ─────────────────────

console.log('📌 Para aplicar los matches: requiere autorización explícita del usuario.')
console.log('   La Fase de apply modificará ÚNICAMENTE pagos_recibos.id_credito.')
console.log('   cronograma_cuotas, creditos, socios y otras tablas NO serán modificados.')
console.log('   La aplicación a cronograma_cuotas será una fase posterior separada.\n')
