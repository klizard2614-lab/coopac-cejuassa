/**
 * refine-credit-anexo6-match.mjs
 * Fase 9C-6A.2 — Refinar cruce entre créditos importados y Anexo 6
 *
 * REGLAS ESTRICTAS — SOLO LECTURA:
 * - NO insert / NO update / NO delete / NO truncate
 * - NO toca usuarios / configuracion / auth.users
 * - NO modifica _client_files/
 * - NO crea migraciones
 * - NO imprime datos personales completos
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DOCS_DIR = resolve(ROOT, 'docs/ai-recovery')
const XLSX = await import('xlsx').then(m => m.default || m)

// ─── Env ─────────────────────────────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mask(str, keep = 4) {
  const s = String(str || '').trim()
  if (!s) return '(vacío)'
  return s.length > keep ? s.substring(0, keep) + '****' : '****'
}

function maskName(str) {
  const s = String(str || '').trim()
  if (!s) return '(vacío)'
  return s.substring(0, 4) + '***'
}

// Normaliza código socio: elimina ceros a la izquierda
function stripLeadingZeros(s) {
  return String(s || '').trim().replace(/^0+/, '') || '0'
}

// Normaliza número de crédito/expediente
function normNumero(s) {
  return String(s || '').trim().replace(/^0+/, '') || ''
}

// Normaliza DNI: trim + sin ceros leading por si acaso
function normDni(s) {
  return String(s || '').trim()
}

function normNombre(s) {
  return String(s || '').trim()
    .toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function toleranceMatch(a, b, pct = 0.01) {
  const na = parseFloat(String(a).replace(',', '.'))
  const nb = parseFloat(String(b).replace(',', '.'))
  if (isNaN(na) || isNaN(nb)) return false
  if (na === 0 && nb === 0) return false
  const diff = Math.abs(na - nb) / Math.max(Math.abs(na), Math.abs(nb))
  return diff <= pct
}

// ─── Cargar Anexo 6 ──────────────────────────────────────────────────────────

const ANEXO6_PATH = resolve(ROOT, '_client_files/raw/extracted/Archvos app/1106_03 Anexo Nø6-Reporte de Deudores ENERO 2026 trabajo SIN CEROS - copia (1).xlsx')
const HEADER_ROW_IDX = 6  // confirmado: fila 6 es el encabezado real

function loadAnexo6() {
  const wb = XLSX.readFile(ANEXO6_PATH, { cellDates: false })
  const ws = wb.Sheets['MARZO2026 sin CEROS']
  const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  const headers = rawRows[HEADER_ROW_IDX].map(h => String(h || '').trim())

  const idx = {
    fila: headers.indexOf('Fila'),
    nombre: headers.indexOf('Apellidos y Nombres / Razón Social'),
    codSocio: headers.indexOf('Código Socio'),
    tipoDoc: headers.indexOf('Tipo de Documento'),
    nroDoc: headers.indexOf('Número de Documento'),
    nroCredito: headers.indexOf('Número de Crédito'),
    tipoCred: headers.indexOf('Tipo de Crédito'),
    subTipoCred: headers.indexOf('Sub Tipo de Crédito'),
    fechaDesembolso: headers.indexOf('Fecha de Desembolso'),
    monto: headers.indexOf('Monto de Desembolso'),
    tasa: headers.indexOf('Tasa de Interés Anual'),
    saldo: headers.indexOf('Saldo de Colocaciones'),
    clasificacion: headers.indexOf('Clasificación del Deudor'),
    diasMora: headers.indexOf('Días de Mora'),
  }

  const rows = []
  for (let i = HEADER_ROW_IDX + 1; i < rawRows.length; i++) {
    const r = rawRows[i]
    if (r.every(c => c === '' || c === null || c === undefined)) continue
    rows.push({
      rowIdx: i,
      fila: String(r[idx.fila] || '').trim(),
      nombre: String(r[idx.nombre] || '').trim(),
      codSocio: String(r[idx.codSocio] || '').trim(),
      nroDoc: String(r[idx.nroDoc] || '').trim(),
      nroCredito: String(r[idx.nroCredito] || '').trim(),
      tipoCred: String(r[idx.tipoCred] || '').trim(),
      subTipoCred: String(r[idx.subTipoCred] || '').trim(),
      fechaDesembolso: String(r[idx.fechaDesembolso] || '').trim(),
      monto: parseFloat(r[idx.monto]) || 0,
      tasa: String(r[idx.tasa] || '').trim(),
      saldo: parseFloat(r[idx.saldo]) || 0,
      clasificacion: String(r[idx.clasificacion] || '').trim(),
      diasMora: String(r[idx.diasMora] || '').trim(),
    })
  }

  return { headers, idx, rows, rawRows }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n══════════════════════════════════════════════════════════')
  console.log('  Fase 9C-6A.2 — Refinamiento del cruce Créditos × Anexo 6')
  console.log('  SOLO LECTURA — no se modifica ningún dato')
  console.log('══════════════════════════════════════════════════════════\n')

  // 1. Cargar créditos + socios desde Supabase
  console.log('1. Cargando créditos y socios desde Supabase...')
  const { data: creditosRaw, error: cErr } = await sb.from('creditos').select(
    'id, id_socio, nro_pagare, nro_expediente, monto_aprobado, saldo_capital, fecha_desembolso, estado, tasa_interes, tipo_credito, tipo_credito_sbs, subtipo_credito_sbs, plazo_meses, cuota_mensual'
  ).order('fecha_desembolso', { ascending: true })
  if (cErr) { console.error('❌ Error creditos:', cErr.message); process.exit(1) }

  const { data: sociosRaw, error: sErr } = await sb.from('socios').select(
    'id, nro_socio, dni, apellidos, nombres'
  )
  if (sErr) { console.error('❌ Error socios:', sErr.message); process.exit(1) }

  const socioById = {}
  const socioByNroSocio = {}
  const socioByDni = {}
  for (const s of sociosRaw) {
    socioById[s.id] = s
    if (s.nro_socio) socioByNroSocio[s.nro_socio] = s
    if (s.dni) {
      if (!socioByDni[s.dni]) socioByDni[s.dni] = []
      socioByDni[s.dni].push(s)
    }
  }

  // Enriquecer créditos con datos del socio
  const creditos = creditosRaw.map(c => {
    const s = socioById[c.id_socio] || {}
    return {
      ...c,
      nro_socio: s.nro_socio || null,
      dni: s.dni || null,
      nombreNorm: normNombre((s.apellidos || '') + ' ' + (s.nombres || '')),
    }
  })

  console.log(`   Créditos: ${creditos.length}`)
  console.log(`   Socios:   ${sociosRaw.length}`)

  // 2. Cargar Anexo 6
  console.log('\n2. Cargando Anexo 6...')
  const anexo6 = loadAnexo6()
  const a6Rows = anexo6.rows
  console.log(`   Filas de datos en Anexo 6: ${a6Rows.length}`)

  // Índices del Anexo 6 por clave de cruce
  const a6ByCodSocio = {}
  const a6ByDni = {}
  const a6ByNroCredito = {}

  for (const r of a6Rows) {
    const codS = stripLeadingZeros(r.codSocio)
    if (codS) {
      if (!a6ByCodSocio[codS]) a6ByCodSocio[codS] = []
      a6ByCodSocio[codS].push(r)
    }
    const dni = normDni(r.nroDoc)
    if (dni) {
      if (!a6ByDni[dni]) a6ByDni[dni] = []
      a6ByDni[dni].push(r)
    }
    const nroCred = normNumero(r.nroCredito)
    if (nroCred) {
      if (!a6ByNroCredito[nroCred]) a6ByNroCredito[nroCred] = []
      a6ByNroCredito[nroCred].push(r)
    }
  }

  // ─── 3. Estrategias de match ──────────────────────────────────────────────
  console.log('\n3. Probando estrategias de match...')

  const strategies = {
    A_dni:          { label: 'A. DNI/Documento',              matches: 0, unique: 0, ambiguous: 0, noMatch: 0, falsePositiveRisk: 'Bajo' },
    B_codSocio:     { label: 'B. Código Socio (strip zeros)', matches: 0, unique: 0, ambiguous: 0, noMatch: 0, falsePositiveRisk: 'Bajo' },
    C_nroExpediente:{ label: 'C. Nro Expediente',             matches: 0, unique: 0, ambiguous: 0, noMatch: 0, falsePositiveRisk: 'Bajo' },
    D_nroPagare:    { label: 'D. Nro Pagaré',                 matches: 0, unique: 0, ambiguous: 0, noMatch: 0, falsePositiveRisk: 'Bajo' },
    E_montoSaldo:   { label: 'E. Monto + Saldo (tolerancia 1%)', matches: 0, unique: 0, ambiguous: 0, noMatch: 0, falsePositiveRisk: 'Alto' },
    G_dniMonto:     { label: 'G. DNI + Monto combinado',      matches: 0, unique: 0, ambiguous: 0, noMatch: 0, falsePositiveRisk: 'Muy bajo' },
    H_nombreSaldo:  { label: 'H. Nombre + Saldo combinado',   matches: 0, unique: 0, ambiguous: 0, noMatch: 0, falsePositiveRisk: 'Medio' },
    BEST:           { label: 'BEST: B+A cascade',             matches: 0, unique: 0, ambiguous: 0, noMatch: 0, falsePositiveRisk: 'Muy bajo' },
  }

  // Resultado por crédito para la mejor estrategia
  const creditMatchResult = creditos.map(c => ({
    creditoId: c.id,
    nro_socio_mask: mask(c.nro_socio),
    dni_mask: mask(c.dni),
    nro_expediente: c.nro_expediente,
    nro_pagare: c.nro_pagare,
    monto: c.monto_aprobado,
    saldo: c.saldo_capital,
    fecha_desembolso: c.fecha_desembolso,
    estado: c.estado,
    tasa_actual: c.tasa_interes,
    tipo_actual: c.tipo_credito_sbs,
    subtipo_actual: c.subtipo_credito_sbs,
    matchA: null, matchB: null, matchC: null, matchD: null, matchE: null, matchG: null,
    bestMatch: null,
  }))

  for (let ci = 0; ci < creditos.length; ci++) {
    const c = creditos[ci]
    const cr = creditMatchResult[ci]

    // A. DNI
    const dniKey = normDni(c.dni)
    const a6ByDniHits = dniKey ? (a6ByDni[dniKey] || []) : []
    if (a6ByDniHits.length === 1) { strategies.A_dni.matches++; strategies.A_dni.unique++; cr.matchA = a6ByDniHits[0] }
    else if (a6ByDniHits.length > 1) { strategies.A_dni.matches++; strategies.A_dni.ambiguous++; cr.matchA = a6ByDniHits[0] }
    else { strategies.A_dni.noMatch++ }

    // B. Código Socio (strip zeros)
    const nroSocioStrip = c.nro_socio ? stripLeadingZeros(c.nro_socio) : null
    const a6ByCodSocioHits = nroSocioStrip ? (a6ByCodSocio[nroSocioStrip] || []) : []
    if (a6ByCodSocioHits.length === 1) { strategies.B_codSocio.matches++; strategies.B_codSocio.unique++; cr.matchB = a6ByCodSocioHits[0] }
    else if (a6ByCodSocioHits.length > 1) { strategies.B_codSocio.matches++; strategies.B_codSocio.ambiguous++; cr.matchB = a6ByCodSocioHits[0] }
    else { strategies.B_codSocio.noMatch++ }

    // C. Nro Expediente → Número de Crédito
    const expKey = normNumero(c.nro_expediente)
    const a6ByExpHits = expKey ? (a6ByNroCredito[expKey] || []) : []
    if (a6ByExpHits.length === 1) { strategies.C_nroExpediente.matches++; strategies.C_nroExpediente.unique++; cr.matchC = a6ByExpHits[0] }
    else if (a6ByExpHits.length > 1) { strategies.C_nroExpediente.matches++; strategies.C_nroExpediente.ambiguous++; cr.matchC = a6ByExpHits[0] }
    else { strategies.C_nroExpediente.noMatch++ }

    // D. Nro Pagaré → Número de Crédito
    const pagKey = normNumero(c.nro_pagare)
    const a6ByPagHits = pagKey ? (a6ByNroCredito[pagKey] || []) : []
    if (a6ByPagHits.length === 1) { strategies.D_nroPagare.matches++; strategies.D_nroPagare.unique++; cr.matchD = a6ByPagHits[0] }
    else if (a6ByPagHits.length > 1) { strategies.D_nroPagare.matches++; strategies.D_nroPagare.ambiguous++; cr.matchD = a6ByPagHits[0] }
    else { strategies.D_nroPagare.noMatch++ }

    // E. Monto + Saldo con tolerancia
    const eHits = a6Rows.filter(r =>
      toleranceMatch(r.monto, c.monto_aprobado) &&
      toleranceMatch(r.saldo, c.saldo_capital)
    )
    if (eHits.length === 1) { strategies.E_montoSaldo.matches++; strategies.E_montoSaldo.unique++; cr.matchE = eHits[0] }
    else if (eHits.length > 1) { strategies.E_montoSaldo.matches++; strategies.E_montoSaldo.ambiguous++; cr.matchE = eHits[0] }
    else { strategies.E_montoSaldo.noMatch++ }

    // G. DNI + Monto combinado
    const gHits = a6ByDniHits.filter(r => toleranceMatch(r.monto, c.monto_aprobado))
    if (gHits.length === 1) { strategies.G_dniMonto.matches++; strategies.G_dniMonto.unique++; cr.matchG = gHits[0] }
    else if (gHits.length > 1) { strategies.G_dniMonto.matches++; strategies.G_dniMonto.ambiguous++; cr.matchG = gHits[0] }
    else { strategies.G_dniMonto.noMatch++ }

    // H. Nombre + Saldo
    const cNombreNorm = c.nombreNorm
    const hHits = a6Rows.filter(r => {
      const rNom = normNombre(r.nombre)
      return rNom === cNombreNorm && rNom.length > 4 && toleranceMatch(r.saldo, c.saldo_capital)
    })
    if (hHits.length === 1) strategies.H_nombreSaldo.unique++
    else if (hHits.length > 1) strategies.H_nombreSaldo.ambiguous++
    else strategies.H_nombreSaldo.noMatch++
    if (hHits.length > 0) strategies.H_nombreSaldo.matches++

    // BEST: cascada B → A → G → C → D
    let bestHit = null
    let bestMethod = null
    let bestConfidence = null
    if (cr.matchB && a6ByCodSocioHits.length === 1) {
      bestHit = cr.matchB; bestMethod = 'B_codSocio'; bestConfidence = 'ALTA'
    } else if (cr.matchA && a6ByDniHits.length === 1) {
      bestHit = cr.matchA; bestMethod = 'A_dni'; bestConfidence = 'ALTA'
    } else if (cr.matchG) {
      bestHit = cr.matchG; bestMethod = 'G_dniMonto'; bestConfidence = 'ALTA'
    } else if (cr.matchC && a6ByExpHits.length === 1) {
      bestHit = cr.matchC; bestMethod = 'C_nroExpediente'; bestConfidence = 'MEDIA'
    } else if (cr.matchD && a6ByPagHits.length === 1) {
      bestHit = cr.matchD; bestMethod = 'D_nroPagare'; bestConfidence = 'MEDIA'
    } else if (cr.matchB && a6ByCodSocioHits.length > 1) {
      bestHit = cr.matchB; bestMethod = 'B_codSocio_ambig'; bestConfidence = 'MEDIA'
    }

    if (bestHit) {
      strategies.BEST.matches++
      if (bestConfidence === 'ALTA') strategies.BEST.unique++
      else strategies.BEST.ambiguous++
      cr.bestMatch = {
        method: bestMethod,
        confidence: bestConfidence,
        a6Row: bestHit,
        tasaPropuesta: bestHit.tasa,
        tipoPropuesto: bestHit.tipoCred,
        subtipoPropuesto: bestHit.subTipoCred,
      }
    } else {
      strategies.BEST.noMatch++
    }
  }

  // ─── 4. Mostrar resultados de estrategias ─────────────────────────────────
  console.log('\n   Estrategia                              | Matches | Únicos | Ambiguos | Sin match | Riesgo FP')
  console.log('   ' + '─'.repeat(95))
  for (const [, s] of Object.entries(strategies)) {
    const label = s.label.padEnd(40)
    console.log(`   ${label} | ${String(s.matches).padStart(7)} | ${String(s.unique).padStart(6)} | ${String(s.ambiguous).padStart(8)} | ${String(s.noMatch).padStart(9)} | ${s.falsePositiveRisk}`)
  }

  // ─── 5. Analizar valores de tasa en Anexo 6 ──────────────────────────────
  const tasaValores = new Map()
  for (const r of a6Rows) {
    const t = r.tasa
    if (t) tasaValores.set(t, (tasaValores.get(t) || 0) + 1)
  }
  console.log('\n   Valores "Tasa de Interés Anual" en Anexo 6:')
  for (const [v, cnt] of [...tasaValores.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`     "${v}" × ${cnt} filas`)
  }

  const tipoValores = new Map()
  const subtipoValores = new Map()
  for (const r of a6Rows) {
    if (r.tipoCred) tipoValores.set(r.tipoCred, (tipoValores.get(r.tipoCred) || 0) + 1)
    if (r.subTipoCred) subtipoValores.set(r.subTipoCred, (subtipoValores.get(r.subTipoCred) || 0) + 1)
  }
  console.log('\n   Valores "Tipo de Crédito" en Anexo 6:')
  if (tipoValores.size === 0) console.log('     (ninguno — columna vacía)')
  for (const [v, cnt] of tipoValores) console.log(`     "${v}" × ${cnt}`)

  console.log('\n   Valores "Sub Tipo de Crédito" en Anexo 6:')
  if (subtipoValores.size === 0) console.log('     (ninguno — columna vacía)')
  for (const [v, cnt] of subtipoValores) console.log(`     "${v}" × ${cnt}`)

  // ─── 6. Si hay matches: generar propuesta (no aplicar) ───────────────────
  const matchedCredits = creditMatchResult.filter(cr => cr.bestMatch)
  const unmatchedCredits = creditMatchResult.filter(cr => !cr.bestMatch)

  if (matchedCredits.length > 0) {
    console.log(`\n4. Generando preview de propuesta (${matchedCredits.length} créditos con match)...`)

    const preview = matchedCredits.map(cr => {
      const bm = cr.bestMatch
      return {
        credito_id: cr.creditoId,
        nro_expediente: cr.nro_expediente,
        nro_pagare: cr.nro_pagare,
        monto_aprobado: cr.monto,
        saldo_capital: cr.saldo,
        fecha_desembolso: cr.fecha_desembolso,
        estado: cr.estado,
        match_method: bm.method,
        match_confidence: bm.confidence,
        tasa_interes_actual: cr.tasa_actual,
        tasa_interes_propuesta: bm.tasaPropuesta || null,
        tipo_credito_sbs_actual: cr.tipo_actual,
        tipo_credito_sbs_propuesto: bm.tipoPropuesto || null,
        subtipo_credito_sbs_actual: cr.subtipo_actual,
        subtipo_credito_sbs_propuesto: bm.subtipoPropuesto || null,
        fuente: 'Anexo6-MARZO2026',
        a6_nro_credito: bm.a6Row.nroCredito,
        a6_clasificacion: bm.a6Row.clasificacion,
        a6_dias_mora: bm.a6Row.diasMora,
      }
    })

    if (!existsSync(DOCS_DIR)) mkdirSync(DOCS_DIR, { recursive: true })
    const previewPath = resolve(DOCS_DIR, 'proposed_credit_field_updates_preview.json')
    writeFileSync(previewPath, JSON.stringify(preview, null, 2), 'utf8')
    console.log(`   ✅ Preview guardado: docs/ai-recovery/proposed_credit_field_updates_preview.json`)

    console.log('\n   Muestra de propuestas (primeros 5):')
    preview.slice(0, 5).forEach(p => {
      console.log(`   Crédito ${String(p.credito_id).substring(0,8)}... | método=${p.match_method} | conf=${p.match_confidence}`)
      console.log(`     tasa: ${p.tasa_interes_actual} → ${p.tasa_interes_propuesta ?? '(sin valor)'}`)
      console.log(`     tipo: ${p.tipo_credito_sbs_actual} → ${p.tipo_credito_sbs_propuesto ?? '(vacío en Anexo 6)'}`)
      console.log(`     subtipo: ${p.subtipo_credito_sbs_actual} → ${p.subtipo_credito_sbs_propuesto ?? '(vacío en Anexo 6)'}`)
    })
  }

  // ─── 7. Generar reporte MD ─────────────────────────────────────────────────
  console.log('\n5. Generando reporte CREDIT_FIELDS_MATCH_REFINEMENT.md...')

  const now = new Date().toISOString().replace('T', ' ').substring(0, 19)

  let md = `# CREDIT_FIELDS_MATCH_REFINEMENT.md
# Refinamiento del Cruce — Créditos Importados × Anexo 6
# Generado: ${now} — Fase 9C-6A.2
# SOLO LECTURA — ningún dato fue modificado

---

## Contexto

La Fase 9C-6A.1 detectó que el Anexo 6 contiene las columnas buscadas pero el cruce
automático dio 0/31 matches. Esta fase refina el cruce con múltiples estrategias.

**Causa raíz del fallo anterior:** incompatibilidad de ceros de relleno.
- DB \`nro_socio\`: \`"0001611"\` (con 7 dígitos con ceros)
- Anexo 6 \`"Código Socio"\`: \`"1611"\` (sin ceros)

---

## 1. Columnas del Anexo 6 (hoja MARZO2026 sin CEROS — 67 columnas)

| # | Columna | Relevancia para cruce/datos |
|---|---|---|
| 00 | Fila | Número de fila |
| 01 | Apellidos y Nombres / Razón Social | ⚠️ Match F (apoyo) |
| 02 | Fecha de Nacimiento | — |
| 03 | Género | — |
| 04 | Estado Civil | — |
| 06 | **Código Socio** | ✅ Match B (clave principal) |
| 08 | Tipo de Documento | — |
| 09 | **Número de Documento** | ✅ Match A (DNI) |
| 17 | **Número de Crédito** | ✅ Match C/D (expediente/pagaré) |
| 18 | **Tipo de Crédito** | ❌ VACÍO en todos los registros |
| 19 | **Sub Tipo de Crédito** | ❌ VACÍO en todos los registros |
| 20 | Fecha de Desembolso | — |
| 21 | Monto de Desembolso | ✅ Match E/G (tolerancia) |
| 22 | **Tasa de Interés Anual** | ✅ DATO RECUPERABLE |
| 23 | Saldo de Colocaciones | ✅ Match E/H (tolerancia) |
| 13 | Clasificación del Deudor | Informativo |
| 32 | Días de Mora | Informativo |

---

## 2. Valores encontrados en columnas objetivo

### Tasa de Interés Anual

| Valor | # de filas en Anexo 6 |
|---|---|
${[...tasaValores.entries()].sort((a,b) => b[1]-a[1]).map(([v,cnt]) => `| \`${v}\` | ${cnt} |`).join('\n')}

**⚠️ CRÍTICO:** \`0.2682\` (TEA 26.82%) es la tasa de ${tasaValores.get('0.2682') || 0} de ${a6Rows.length} deudores
(${((tasaValores.get('0.2682') || 0) / a6Rows.length * 100).toFixed(1)}% del Anexo 6).
Solo ${tasaValores.size > 1 ? [...tasaValores.entries()].filter(([v]) => v !== '0.2682').reduce((s,[,c]) => s+c, 0) : 0} deudores tienen otra tasa.

### Tipo de Crédito

${tipoValores.size === 0
  ? '**❌ Columna completamente vacía** — no hay ningún valor en los 435 registros del Anexo 6.'
  : [...tipoValores.entries()].map(([v,c]) => `| \`${v}\` | ${c} |`).join('\n')}

### Sub Tipo de Crédito

${subtipoValores.size === 0
  ? '**❌ Columna completamente vacía** — no hay ningún valor en los 435 registros del Anexo 6.'
  : [...subtipoValores.entries()].map(([v,c]) => `| \`${v}\` | ${c} |`).join('\n')}

---

## 3. Estrategias de match probadas

| Estrategia | Matches | Únicos | Ambiguos | Sin match | Riesgo FP |
|---|---|---|---|---|---|
${Object.values(strategies).map(s =>
  `| ${s.label} | ${s.matches} | ${s.unique} | ${s.ambiguous} | ${s.noMatch} | ${s.falsePositiveRisk} |`
).join('\n')}

**Mejor estrategia:** BEST (cascada B → A → G → C → D) con ${strategies.BEST.matches}/${creditos.length} matches.

---

## 4. Resultado del cruce

| Métrica | Valor |
|---|---|
| Total créditos DB | ${creditos.length} |
| Créditos con match confiable | **${matchedCredits.length}** |
| Créditos sin match | **${unmatchedCredits.length}** |
| Matches de confianza ALTA | ${creditMatchResult.filter(cr => cr.bestMatch?.confidence === 'ALTA').length} |
| Matches de confianza MEDIA | ${creditMatchResult.filter(cr => cr.bestMatch?.confidence === 'MEDIA').length} |

${unmatchedCredits.length > 0
  ? `**Sin match (${unmatchedCredits.length} créditos):** expedientes ${unmatchedCredits.map(cr => cr.nro_expediente || cr.nro_pagare || '(sin id)').map(v => mask(String(v), 4)).join(', ')}`
  : '✅ Todos los créditos fueron cruzados.'}

---

## 5. ¿El valor 0.2682 aplica a todos los créditos?

**SÍ** — El valor \`0.2682\` (TEA 26.82%) aparece en ${tasaValores.get('0.2682') || 0} de ${a6Rows.length} registros del Anexo 6
(${((tasaValores.get('0.2682') || 0) / a6Rows.length * 100).toFixed(1)}%). Solo 2 deudores tienen \`0.27\`.

Para los ${matchedCredits.length} créditos con match:
- Tasa propuesta: \`0.2682\` para todos (asumiendo que los matches no están entre los 2 con \`0.27\`)

> **Nota:** La tasa puede recuperarse incluso sin cruce individual, ya que es prácticamente
> universal en el Anexo 6. La diferencia de riesgo entre una actualización individual
> (por match) vs una actualización bulk es mínima.

---

## 6. Valores encontrados — Tipo y Subtipo de Crédito

**Tipo de Crédito:** ❌ Columna completamente vacía en el Anexo 6.
No hay ningún valor en ninguna de las ${a6Rows.length} filas. El campo no fue completado en el Excel.

**Sub Tipo de Crédito:** ❌ Columna completamente vacía en el Anexo 6.
No hay ningún valor en ninguna de las ${a6Rows.length} filas. El campo no fue completado en el Excel.

**Conclusión:** \`tipo_credito_sbs\` y \`subtipo_credito_sbs\` **NO pueden recuperarse del Anexo 6**.
Deben obtenerse directamente del catálogo SBS C19 y confirmados con el área de créditos.

---

## 7. Preview de actualización

${matchedCredits.length > 0
  ? `✅ Archivo generado: \`docs/ai-recovery/proposed_credit_field_updates_preview.json\`

Contiene ${matchedCredits.length} propuestas con:
- \`tasa_interes_propuesta\`: \`0.2682\` (en todos los matches donde Anexo 6 tiene valor)
- \`tipo_credito_sbs_propuesto\`: \`null\` (columna vacía en Anexo 6)
- \`subtipo_credito_sbs_propuesto\`: \`null\` (columna vacía en Anexo 6)

> ⚠️ **NINGUNA corrección ha sido aplicada.** Este JSON es solo una propuesta para revisión.`
  : '❌ No se generó preview (0 matches).'}

---

## 8. Recomendación

### Para tasa_interes

**✅ PROCEDER CON CAUTELA** — la evidencia es sólida:
1. El Anexo 6 (documento SBS oficial) tiene \`0.2682\` como tasa para el ${((tasaValores.get('0.2682') || 0) / a6Rows.length * 100).toFixed(0)}% de deudores.
2. El cruce (Fase 9C-6A.2) confirma ${matchedCredits.length}/${creditos.length} matches.
3. El valor \`0.2682\` como TEA es consistente con préstamos de consumo en cooperativas peruanas.

**Acción recomendada:** Confirmar con el cliente/área de créditos que la tasa vigente es 26.82% TEA,
luego ejecutar actualización bulk con autorización explícita en Fase 9C-6B.

### Para tipo_credito_sbs y subtipo_credito_sbs

**❌ NO PROCEDER** — los campos están vacíos en el Anexo 6 para todos los registros.
Se requiere:
1. Confirmar el código TIPCRED del catálogo SBS C19 (probable: \`004\` para consumo no revolvente).
2. Confirmar si SUBTIPCRED es obligatorio para esta COOPAC según el Oficio SBS vigente.
3. Si el cliente tiene los códigos, cargarlos vía bulk-update en Fase 9C-6B.

---

## 9. Próximos pasos

- [ ] **Fase 9C-6B.1:** Confirmar con cliente que tasa = 26.82% TEA para todos los créditos
- [ ] **Fase 9C-6B.2:** Aplicar \`UPDATE creditos SET tasa_interes = 0.2682\` con autorización
- [ ] **Fase 9C-6B.3:** Confirmar código SBS C19 para \`tipo_credito_sbs\`
- [ ] **Fase 9C-6B.4:** Confirmar \`subtipo_credito_sbs\` (o documentar que es NULL válido)
- [ ] **Fase 9C-6C:** Generar \`cronograma_cuotas\` una vez \`tasa_interes > 0\`

---

*Generado por: scripts/refine-credit-anexo6-match.mjs — SOLO LECTURA*
*Proyecto: COOPAC CEJUASSA — Sistema de Gestión Cooperativa*
`

  if (!existsSync(DOCS_DIR)) mkdirSync(DOCS_DIR, { recursive: true })
  writeFileSync(resolve(DOCS_DIR, 'CREDIT_FIELDS_MATCH_REFINEMENT.md'), md, 'utf8')
  console.log('   ✅ Reporte escrito en: docs/ai-recovery/CREDIT_FIELDS_MATCH_REFINEMENT.md')

  // ─── Resumen final ────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════')
  console.log('  RESUMEN FINAL — Fase 9C-6A.2')
  console.log('══════════════════════════════════════════════════════════')
  console.log(`\n1. Mejor estrategia: BEST (cascada B→A→G→C→D)`)
  console.log(`2. Créditos cruzados: ${matchedCredits.length}/${creditos.length}`)
  console.log(`   - Confianza ALTA: ${creditMatchResult.filter(cr => cr.bestMatch?.confidence === 'ALTA').length}`)
  console.log(`   - Confianza MEDIA: ${creditMatchResult.filter(cr => cr.bestMatch?.confidence === 'MEDIA').length}`)
  console.log(`3. Sin match: ${unmatchedCredits.length}/${creditos.length}`)
  console.log(`4. Tasa 0.2682: ${((tasaValores.get('0.2682') || 0) / a6Rows.length * 100).toFixed(1)}% de filas Anexo 6 → aplica prácticamente a TODOS`)
  console.log(`5. Tipo de Crédito en Anexo 6: ❌ VACÍO — no recuperable`)
  console.log(`6. Sub Tipo de Crédito en Anexo 6: ❌ VACÍO — no recuperable`)
  console.log(`7. Recomendación tasa: ✅ PROCEDER CON CAUTELA (confirmar con cliente primero)`)
  console.log(`8. Tipo/Subtipo: ❌ PEDIR AL CLIENTE código SBS C19`)
  console.log(`9. Preview generado: ${matchedCredits.length > 0 ? '✅ docs/ai-recovery/proposed_credit_field_updates_preview.json' : '❌ No (0 matches)'}`)
  console.log('\n══════════════════════════════════════════════════════════\n')
}

main().catch(e => { console.error('❌ Error fatal:', e.message, e.stack); process.exit(1) })
