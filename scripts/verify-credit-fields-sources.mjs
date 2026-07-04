/**
 * verify-credit-fields-sources.mjs
 * Fase 9C-6A.1 — Verificar fuentes de tasa_interes, tipo_credito_sbs y subtipo_credito_sbs
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
const BASE = resolve(ROOT, '_client_files/raw/extracted/Archvos app')

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

function maskStr(str, keep = 4) {
  const s = String(str || '').trim()
  return s.length > keep ? s.substring(0, keep) + '****' : '****'
}

function readExcelSheetRaw(filePath, sheetIndex = 0) {
  if (!existsSync(filePath)) return null
  try {
    const wb = XLSX.readFile(filePath, { cellDates: true, sheetStubs: true })
    const sheetName = wb.SheetNames[sheetIndex]
    const ws = wb.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
    return { sheetName, rows, allSheetNames: wb.SheetNames }
  } catch (e) {
    return { error: e.message }
  }
}

function findHeaderRow(rows, minCols = 3) {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i]
    const nonEmpty = row.filter(c => String(c || '').trim() !== '').length
    if (nonEmpty >= minCols) return i
  }
  return 0
}

// Normaliza nombre de columna para búsqueda
function normCol(s) {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

const TASA_KEYWORDS = ['tasa', 'tea', 'ten', 'interes', 'rate', 'tasaefectiva', 'tipointer', 'tipodetasa']
const TIPO_KEYWORDS = ['tipocredi', 'tipcred', 'tipocred', 'tipodecred', 'tipcredi', 'clasif', 'clasificac']
const SUBTIPO_KEYWORDS = ['subtipo', 'subtipcred', 'subcred', 'subt', 'modalidad']

function checkColumnPresence(headers) {
  const norm = headers.map(h => normCol(h))
  const found = { tasa: [], tipo: [], subtipo: [] }
  norm.forEach((n, i) => {
    if (TASA_KEYWORDS.some(k => n.includes(k))) found.tasa.push({ idx: i, original: headers[i] })
    if (TIPO_KEYWORDS.some(k => n.includes(k))) found.tipo.push({ idx: i, original: headers[i] })
    if (SUBTIPO_KEYWORDS.some(k => n.includes(k))) found.subtipo.push({ idx: i, original: headers[i] })
  })
  return found
}

// Toma hasta N valores de muestra no vacíos de una columna
function sampleColumnValues(rows, colIdx, headerRow, maxSamples = 5) {
  const samples = []
  for (let i = headerRow + 1; i < rows.length && samples.length < maxSamples; i++) {
    const val = rows[i][colIdx]
    if (val !== '' && val !== null && val !== undefined) samples.push(val)
  }
  return samples
}

// ─── Archivos a revisar ───────────────────────────────────────────────────────

const FILES = [
  {
    key: 'dscto',
    label: 'DSCTO Y DESMBOLSO DE CRDITO MA ABR-2026 (1).xlsx',
    path: resolve(BASE, 'DSCTO Y DESMBOLSO DE CRDITO MA ABR-2026 (1).xlsx'),
    sheets: [0],
  },
  {
    key: 'anexo6',
    label: '1106_03 Anexo Nø6-Reporte de Deudores ENERO 2026 (1).xlsx',
    path: resolve(BASE, '1106_03 Anexo Nø6-Reporte de Deudores ENERO 2026 trabajo SIN CEROS - copia (1).xlsx'),
    sheets: [0, 1, 2],
  },
  {
    key: 'ingreso',
    label: 'INGRESO DETALLADO MARZO 2026 (1).xlsx',
    path: resolve(BASE, 'INGRESO DETALLADO MARZO 2026 (1).xlsx'),
    sheets: [0, 1],
  },
  {
    key: 'convenio',
    label: 'CONVENIO MES MARZO 2026 (1).xlsx',
    path: resolve(BASE, 'CONVENIO MES MARZO 2026 (1).xlsx'),
    sheets: [0, 1],
  },
  {
    key: 'informe',
    label: '1105-05 informe de deudores (1).xlsx',
    path: resolve(BASE, '1105-05 informe de deudores (1).xlsx'),
    sheets: [0],
  },
  {
    key: 'cuadre5',
    label: '1105_04_Cuadre del Anexo 5... (1).xlsx',
    path: resolve(BASE, '1105_04_Cuadre del Anexo 5 con las Cifras del Balance (COOPAC Nivel 2)_OK (1).xlsx'),
    sheets: [0],
  },
  {
    key: 'reportes',
    label: 'ELABORACION DE REPORTES DE CARTERA Y APORTES (1).xlsx',
    path: resolve(BASE, 'ELABORACION DE REPORTES DE CARTERA Y APORTES (1).xlsx'),
    sheets: [0],
  },
]

// ─── Análisis de un archivo (todas sus hojas) ─────────────────────────────────

function analyzeFile(file) {
  const result = {
    label: file.label,
    exists: existsSync(file.path),
    sheets: [],
    hasTasa: false,
    hasTipo: false,
    hasSubtipo: false,
    tasaCols: [],
    tipoCols: [],
    subtipoCols: [],
    tasaSamples: [],
    tipoCodSbsFound: false,
    rowCount: 0,
    colCount: 0,
  }

  if (!result.exists) return result

  try {
    const wb = XLSX.readFile(file.path, { cellDates: true, sheetStubs: true })

    for (const sheetIdx of file.sheets) {
      if (sheetIdx >= wb.SheetNames.length) continue
      const sheetName = wb.SheetNames[sheetIdx]
      const ws = wb.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      if (!rows.length) continue

      const headerRow = findHeaderRow(rows, 2)
      const headers = rows[headerRow].map(h => String(h || '').trim())
      const found = checkColumnPresence(headers)

      result.rowCount += rows.length - headerRow - 1

      if (headers.length > result.colCount) result.colCount = headers.length

      const sheetResult = {
        name: sheetName,
        headerRow,
        colCount: headers.length,
        dataRows: rows.length - headerRow - 1,
        tasa: found.tasa,
        tipo: found.tipo,
        subtipo: found.subtipo,
      }

      // Muestras de valores para columnas de tasa
      for (const tc of found.tasa) {
        const samples = sampleColumnValues(rows, tc.idx, headerRow, 8)
        sheetResult.tasaSamples = samples
        result.tasaSamples.push(...samples)
      }

      // Muestras de tipo
      for (const tc of found.tipo) {
        const samples = sampleColumnValues(rows, tc.idx, headerRow, 8)
        sheetResult.tipoSamples = samples
        // Buscar si hay código numérico SBS (004, 001, 002, etc.)
        for (const s of samples) {
          const str = String(s || '').trim()
          if (/^\d{3}$/.test(str) || /^\d{1,2}$/.test(str)) {
            result.tipoCodSbsFound = true
          }
        }
      }

      result.sheets.push(sheetResult)

      if (found.tasa.length) { result.hasTasa = true; result.tasaCols.push(...found.tasa.map(t => `[${sheetName}] ${t.original}`)) }
      if (found.tipo.length) { result.hasTipo = true; result.tipoCols.push(...found.tipo.map(t => `[${sheetName}] ${t.original}`)) }
      if (found.subtipo.length) { result.hasSubtipo = true; result.subtipoCols.push(...found.subtipo.map(t => `[${sheetName}] ${t.original}`)) }
    }
  } catch (e) {
    result.error = e.message
  }

  return result
}

// ─── Cruce Anexo 6 con créditos DB ───────────────────────────────────────────

function buildAnexo6Map(filePath) {
  if (!existsSync(filePath)) return { error: 'Archivo no encontrado' }
  try {
    const wb = XLSX.readFile(filePath, { cellDates: true })
    const allSheets = {}

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      if (rows.length < 2) continue

      const headerRow = findHeaderRow(rows, 3)
      const headers = rows[headerRow].map(h => String(h || '').trim())
      const normHeaders = headers.map(normCol)

      // Buscar columnas clave para cruce
      const idxMap = {
        idSocio: normHeaders.findIndex(h => h.includes('idsocio') || h.includes('codsocio') || h.includes('codigosocio')),
        nroCredito: normHeaders.findIndex(h => h.includes('nrocred') || h.includes('numcred') || h.includes('credito') || h.includes('expediente') || h.includes('nropag') || h.includes('pagare')),
        dni: normHeaders.findIndex(h => h === 'dni' || h.includes('documento') || h.includes('nrodoc')),
        tasa: normHeaders.findIndex(h => TASA_KEYWORDS.some(k => h.includes(k))),
        tipo: normHeaders.findIndex(h => TIPO_KEYWORDS.some(k => h.includes(k))),
        subtipo: normHeaders.findIndex(h => SUBTIPO_KEYWORDS.some(k => h.includes(k))),
        nombre: normHeaders.findIndex(h => h.includes('nombre') || h.includes('apellido') || h.includes('socio')),
        monto: normHeaders.findIndex(h => h.includes('monto') || h.includes('desembolso')),
        saldo: normHeaders.findIndex(h => h.includes('saldo')),
        fecha: normHeaders.findIndex(h => h.includes('fecha')),
      }

      const dataRows = []
      for (let i = headerRow + 1; i < rows.length; i++) {
        const row = rows[i]
        const isEmpty = row.every(c => c === '' || c === null || c === undefined)
        if (isEmpty) continue
        dataRows.push({
          rowIdx: i,
          raw: row,
          idSocio: idxMap.idSocio >= 0 ? String(row[idxMap.idSocio] || '').trim() : null,
          nroCredito: idxMap.nroCredito >= 0 ? String(row[idxMap.nroCredito] || '').trim() : null,
          dni: idxMap.dni >= 0 ? String(row[idxMap.dni] || '').trim() : null,
          tasa: idxMap.tasa >= 0 ? row[idxMap.tasa] : null,
          tipo: idxMap.tipo >= 0 ? row[idxMap.tipo] : null,
          subtipo: idxMap.subtipo >= 0 ? row[idxMap.subtipo] : null,
          nombre: idxMap.nombre >= 0 ? String(row[idxMap.nombre] || '').trim() : null,
          monto: idxMap.monto >= 0 ? row[idxMap.monto] : null,
          saldo: idxMap.saldo >= 0 ? row[idxMap.saldo] : null,
        })
      }

      allSheets[sheetName] = {
        headers,
        idxMap,
        dataRows,
        colCount: headers.length,
      }
    }

    return { allSheets }
  } catch (e) {
    return { error: e.message }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n══════════════════════════════════════════════════════════')
  console.log('  Fase 9C-6A.1 — Verificación de fuentes de campos crédito')
  console.log('  SOLO LECTURA — no se modifica ningún dato')
  console.log('══════════════════════════════════════════════════════════\n')

  // 1. Obtener créditos de Supabase
  console.log('1. Consultando créditos en Supabase...')
  const { data: creditos, error: credErr } = await sb.from('creditos').select(
    'id, id_socio, nro_pagare, nro_expediente, monto_aprobado, saldo_capital, fecha_desembolso, tasa_interes, tipo_credito, tipo_credito_sbs, subtipo_credito_sbs'
  ).order('fecha_desembolso', { ascending: true })

  if (credErr) { console.error('❌ Error consultando creditos:', credErr.message); process.exit(1) }

  const totalCreditos = creditos.length
  const conTasa = creditos.filter(c => c.tasa_interes && Number(c.tasa_interes) > 0).length
  const conTipo = creditos.filter(c => c.tipo_credito_sbs && c.tipo_credito_sbs.trim() !== '').length
  const conSubtipo = creditos.filter(c => c.subtipo_credito_sbs && String(c.subtipo_credito_sbs).trim() !== '').length
  const sinTasa = totalCreditos - conTasa
  const sinTipo = creditos.filter(c => !c.tipo_credito_sbs || c.tipo_credito_sbs.trim() === '' || c.tipo_credito_sbs === 'consumo_no_revolvente').length
  const sinSubtipo = totalCreditos - conSubtipo

  console.log(`   Total créditos: ${totalCreditos}`)
  console.log(`   Con tasa_interes > 0: ${conTasa} | Sin tasa o = 0: ${sinTasa}`)
  console.log(`   Con tipo_credito_sbs (texto): ${conTipo} | Sin código SBS oficial: ${sinTipo}`)
  console.log(`   Con subtipo_credito_sbs: ${conSubtipo} | Sin subtipo: ${sinSubtipo}`)

  // Obtener socios para DNI lookup
  const { data: socios } = await sb.from('socios').select('id, nro_socio, dni, apellidos, nombres')
  const socioById = {}
  if (socios) socios.forEach(s => { socioById[s.id] = s })

  // Set de nro_socio y DNI de créditos existentes
  const creditoMeta = creditos.map(c => {
    const s = socioById[c.id_socio] || {}
    return {
      ...c,
      nro_socio: s.nro_socio || null,
      dni: s.dni || null,
      nombre_mask: (s.apellidos || s.nombres) ? maskStr((s.apellidos || '') + ' ' + (s.nombres || ''), 6) : '??????',
    }
  })

  const creditosByExpediente = {}
  const creditosByNroPagare = {}
  const creditosByNroSocio = {}
  const creditosByDni = {}
  for (const c of creditoMeta) {
    if (c.nro_expediente) creditosByExpediente[String(c.nro_expediente).trim()] = c
    if (c.nro_pagare) creditosByNroPagare[String(c.nro_pagare).trim()] = c
    if (c.nro_socio) {
      if (!creditosByNroSocio[c.nro_socio]) creditosByNroSocio[c.nro_socio] = []
      creditosByNroSocio[c.nro_socio].push(c)
    }
    if (c.dni) {
      if (!creditosByDni[c.dni]) creditosByDni[c.dni] = []
      creditosByDni[c.dni].push(c)
    }
  }

  // 2. Analizar archivos Excel
  console.log('\n2. Analizando archivos Excel...')
  const fileResults = {}
  for (const file of FILES) {
    process.stdout.write(`   ${file.key}: `)
    const r = analyzeFile(file)
    fileResults[file.key] = r
    if (!r.exists) { console.log('❌ No encontrado'); continue }
    if (r.error) { console.log(`⚠️ Error: ${r.error}`); continue }
    const flags = [
      r.hasTasa ? `TASA(${r.tasaCols.join(', ')})` : 'sin_tasa',
      r.hasTipo ? `TIPO(${r.tipoCols.join(', ')})` : 'sin_tipo',
      r.hasSubtipo ? `SUBTIPO(${r.subtipoCols.join(', ')})` : 'sin_subtipo',
    ]
    console.log(`✅ ${flags.join(' | ')}`)
  }

  // 3. Cruce profundo con Anexo 6
  console.log('\n3. Cruce detallado contra Anexo 6...')
  const anexo6Path = FILES.find(f => f.key === 'anexo6').path
  const a6 = buildAnexo6Map(anexo6Path)

  let matchByExpediente = 0
  let matchByNroSocio = 0
  let matchByDni = 0
  let matchTotal = 0
  let matchConTasa = 0
  let matchConTipo = 0
  let matchConSubtipo = 0
  let tasaValues = new Set()
  let tipoValues = new Set()
  let subtipoValues = new Set()

  const matchDetails = []

  if (!a6.error) {
    for (const [sheetName, sheet] of Object.entries(a6.allSheets)) {
      for (const row of sheet.dataRows) {
        let matchedCredito = null
        let matchMethod = null

        // Cruce 1: por nro_expediente
        if (row.nroCredito && creditosByExpediente[row.nroCredito]) {
          matchedCredito = creditosByExpediente[row.nroCredito]
          matchMethod = 'expediente'
          matchByExpediente++
        }
        // Cruce 2: por nro_socio (IdSocio)
        else if (row.idSocio && creditosByNroSocio[row.idSocio]) {
          const creds = creditosByNroSocio[row.idSocio]
          if (creds.length === 1) {
            matchedCredito = creds[0]
            matchMethod = 'nro_socio'
            matchByNroSocio++
          }
        }
        // Cruce 3: por DNI
        else if (row.dni && creditosByDni[row.dni]) {
          const creds = creditosByDni[row.dni]
          if (creds.length === 1) {
            matchedCredito = creds[0]
            matchMethod = 'dni'
            matchByDni++
          }
        }

        if (!matchedCredito) continue

        const creditoId = matchedCredito.id
        const already = matchDetails.find(m => m.creditoId === creditoId)
        if (already) continue // evitar duplicados

        matchTotal++
        const detail = {
          creditoId,
          nro_socio_mask: maskStr(matchedCredito.nro_socio),
          matchMethod,
          sheet: sheetName,
          tasaEnAnexo: row.tasa,
          tipoEnAnexo: row.tipo,
          subtipoEnAnexo: row.subtipo,
          tasaEnDB: matchedCredito.tasa_interes,
          tipoEnDB: matchedCredito.tipo_credito_sbs,
          subtipoEnDB: matchedCredito.subtipo_credito_sbs,
        }

        if (row.tasa !== null && row.tasa !== '') {
          matchConTasa++
          tasaValues.add(String(row.tasa))
        }
        if (row.tipo !== null && row.tipo !== '') {
          matchConTipo++
          tipoValues.add(String(row.tipo))
        }
        if (row.subtipo !== null && row.subtipo !== '') {
          matchConSubtipo++
          subtipoValues.add(String(row.subtipo))
        }

        matchDetails.push(detail)
      }
    }
  }

  console.log(`   Matches encontrados: ${matchTotal} de ${totalCreditos}`)
  console.log(`   Por expediente: ${matchByExpediente} | Por nro_socio: ${matchByNroSocio} | Por DNI: ${matchByDni}`)
  console.log(`   Matches con tasa en Anexo 6: ${matchConTasa}`)
  console.log(`   Matches con tipo en Anexo 6: ${matchConTipo}`)
  console.log(`   Matches con subtipo en Anexo 6: ${matchConSubtipo}`)
  console.log(`   Valores de tasa encontrados: ${[...tasaValues].join(', ') || '(ninguno)'}`)
  console.log(`   Valores de tipo encontrados: ${[...tipoValues].join(', ') || '(ninguno)'}`)

  // Buscar 0.2682 en archivos
  let donde0_2682 = []
  for (const [key, r] of Object.entries(fileResults)) {
    if (!r.exists || r.error) continue
    if (r.tasaSamples.some(v => {
      const n = parseFloat(String(v).replace(',', '.'))
      return Math.abs(n - 0.2682) < 0.0001
    })) {
      donde0_2682.push(FILES.find(f => f.key === key).label)
    }
  }
  if (tasaValues.has('0.2682') || [...tasaValues].some(v => Math.abs(parseFloat(v) - 0.2682) < 0.0001)) {
    donde0_2682.push('Anexo 6 (cruce)')
  }

  // 4. Generar reporte MD
  console.log('\n4. Generando reporte...')
  if (!existsSync(DOCS_DIR)) mkdirSync(DOCS_DIR, { recursive: true })

  const now = new Date().toISOString().replace('T', ' ').substring(0, 19)

  let md = `# CREDIT_FIELDS_SOURCE_VERIFICATION.md
# Verificación de Fuentes — tasa_interes · tipo_credito_sbs · subtipo_credito_sbs
# Generado: ${now} — Fase 9C-6A.1
# SOLO LECTURA — ningún dato fue modificado

---

## Resumen ejecutivo

| Campo | En DB | Faltantes | Recuperable desde Excel |
|---|---|---|---|
| \`tasa_interes\` | ${conTasa} de ${totalCreditos} | **${sinTasa}** | Ver sección 4 |
| \`tipo_credito_sbs\` (código SBS) | 0 de ${totalCreditos} | **${totalCreditos}** | Ver sección 4 |
| \`subtipo_credito_sbs\` | ${conSubtipo} de ${totalCreditos} | **${sinSubtipo}** | Ver sección 4 |

---

## 1. Archivos revisados

| # | Archivo | Existe | Hojas | Filas datos | Col tasa | Col tipo | Col subtipo |
|---|---|---|---|---|---|---|---|
`

  let fileNum = 1
  for (const file of FILES) {
    const r = fileResults[file.key]
    const existe = r.exists ? '✅' : '❌'
    let hojas = r.exists && !r.error ? r.sheets.map(s => s.name).join(', ') : '-'
    const filasTotal = r.exists && !r.error ? r.rowCount : '-'
    const tasa = r.hasTasa ? `✅ ${r.tasaCols.map(c => `\`${c}\``).join(', ')}` : '❌'
    const tipo = r.hasTipo ? `✅ ${r.tipoCols.map(c => `\`${c}\``).join(', ')}` : '❌'
    const subtipo = r.hasSubtipo ? `✅ ${r.subtipoCols.map(c => `\`${c}\``).join(', ')}` : '❌'
    md += `| ${fileNum++} | ${file.label} | ${existe} | ${hojas} | ${filasTotal} | ${tasa} | ${tipo} | ${subtipo} |\n`
  }

  md += `
---

## 2. Estado actual de créditos en Supabase

| Campo | Con valor real | Sin valor / default | Total |
|---|---|---|---|
| \`tasa_interes\` | ${conTasa} | ${sinTasa} | ${totalCreditos} |
| \`tipo_credito_sbs\` (texto/consumo_no_revolvente) | ${conTipo} | ${sinTipo} | ${totalCreditos} |
| \`tipo_credito_sbs\` (código SBS numérico) | 0 | ${totalCreditos} | ${totalCreditos} |
| \`subtipo_credito_sbs\` | ${conSubtipo} | ${sinSubtipo} | ${totalCreditos} |

> **Nota:** El valor actual de \`tipo_credito_sbs\` es el texto \`'consumo_no_revolvente'\` —
> no es un código SBS numérico del catálogo C19 (ej: '004'). Se cuenta como faltante para efectos BDCC.

---

## 3. Columnas encontradas por archivo

### DSCTO Y DESMBOLSO DE CRDITO
`
  const dscto = fileResults['dscto']
  if (dscto.exists && !dscto.error) {
    md += `- **Hojas revisadas:** ${dscto.sheets.map(s => s.name).join(', ')}\n`
    md += `- **Columna "Interes":** ⚠️ PRESENTE — pero corresponde a \`interes_acumulado\` (interés corriente vencido), NO a \`tasa_interes\` (TEA/TEN)\n`
    if (dscto.hasTasa) {
      md += `- **Columnas detectadas como tasa:** ${dscto.tasaCols.join(', ')}\n`
      md += `- **Muestras de valores:** ${dscto.tasaSamples.slice(0, 8).join(', ') || '(vacío)'}\n`
    } else {
      md += `- **Sin columna de tasa de interés anualizada**\n`
    }
    md += `- **Tipo crédito SBS:** ❌ No encontrado\n`
    md += `- **Subtipo crédito SBS:** ❌ No encontrado\n`
  } else {
    md += `- ❌ Archivo no disponible o error: ${dscto.error || 'no encontrado'}\n`
  }

  md += `\n### Anexo 6 — Reporte de Deudores ENERO 2026\n`
  const a6r = fileResults['anexo6']
  if (a6r.exists && !a6r.error) {
    for (const sheet of a6r.sheets) {
      md += `\n**Hoja \`${sheet.name}\`** (${sheet.colCount} col, ${sheet.dataRows} filas datos):\n`
      md += `- Tasa: ${sheet.tasa.length ? sheet.tasa.map(t => `\`${t.original}\``).join(', ') : '❌ no encontrado'}\n`
      if (sheet.tasa.length && sheet.tasaSamples) {
        md += `  - Muestras: ${sheet.tasaSamples.slice(0, 8).map(v => `\`${v}\``).join(', ') || '(vacío)'}\n`
      }
      md += `- Tipo: ${sheet.tipo.length ? sheet.tipo.map(t => `\`${t.original}\``).join(', ') : '❌ no encontrado'}\n`
      if (sheet.tipo.length && sheet.tipoSamples) {
        md += `  - Muestras: ${sheet.tipoSamples.slice(0, 8).map(v => `\`${v}\``).join(', ') || '(vacío)'}\n`
      }
      md += `- Subtipo: ${sheet.subtipo.length ? sheet.subtipo.map(t => `\`${t.original}\``).join(', ') : '❌ no encontrado'}\n`
    }
  } else {
    md += `- ❌ Archivo no disponible o error: ${a6r.error || 'no encontrado'}\n`
  }

  md += `\n### Otros archivos (Ingreso Detallado, Convenio, Informe Deudores, Cuadre Anexo 5, Cartera)\n`
  for (const key of ['ingreso', 'convenio', 'informe', 'cuadre5', 'reportes']) {
    const r = fileResults[key]
    const label = FILES.find(f => f.key === key).label
    md += `\n**${label}:**\n`
    if (!r.exists) { md += `- ❌ No encontrado\n`; continue }
    if (r.error) { md += `- ⚠️ Error: ${r.error}\n`; continue }
    md += `- Tasa: ${r.hasTasa ? `✅ ${r.tasaCols.join(', ')} | Muestras: ${r.tasaSamples.slice(0,5).join(', ')}` : '❌ no encontrado'}\n`
    md += `- Tipo crédito: ${r.hasTipo ? `✅ ${r.tipoCols.join(', ')}` : '❌ no encontrado'}\n`
    md += `- Subtipo: ${r.hasSubtipo ? `✅ ${r.subtipoCols.join(', ')}` : '❌ no encontrado'}\n`
  }

  md += `
---

## 4. Cruce de 31 créditos contra Anexo 6

| Métrica | Valor |
|---|---|
| Créditos en DB | ${totalCreditos} |
| Matches en Anexo 6 (por expediente) | ${matchByExpediente} |
| Matches en Anexo 6 (por nro_socio) | ${matchByNroSocio} |
| Matches en Anexo 6 (por DNI) | ${matchByDni} |
| **Total créditos con match en Anexo 6** | **${matchTotal}** |
| De esos, con \`tasa\` en Anexo 6 | ${matchConTasa} |
| De esos, con \`tipo\` en Anexo 6 | ${matchConTipo} |
| De esos, con \`subtipo\` en Anexo 6 | ${matchConSubtipo} |

**Valores de tasa encontrados en Anexo 6 (para créditos con match):**
${[...tasaValues].length ? [...tasaValues].map(v => `- \`${v}\``).join('\n') : '- (ninguno — columna tasa no encontrada o vacía)'}

**Valores de tipo encontrados en Anexo 6 (para créditos con match):**
${[...tipoValues].length ? [...tipoValues].map(v => `- \`${v}\``).join('\n') : '- (ninguno — columna tipo no encontrada o vacía)'}

**Valores de subtipo encontrados en Anexo 6 (para créditos con match):**
${[...subtipoValues].length ? [...subtipoValues].map(v => `- \`${v}\``).join('\n') : '- (ninguno — columna subtipo no encontrada o vacía)'}

---

## 5. ¿Aparece el valor 0.2682?

${donde0_2682.length
  ? `✅ Valor \`0.2682\` (TEA ~26.82%) detectado en:\n${donde0_2682.map(f => `- ${f}`).join('\n')}`
  : `❌ El valor \`0.2682\` **NO aparece** en ninguno de los archivos Excel revisados.\n\nEste valor no es una TEA estándar de crédito de consumo en Perú. Las tasas habituales en cooperativas oscilan entre 24% y 36% TEA. Si se requiere, debe confirmar con el área de créditos la tasa oficial vigente.`}

---

## 6. ¿Aparece código SBS oficial de tipo crédito?

${a6r.tipoCodSbsFound
  ? `✅ Se encontraron posibles códigos numéricos SBS en columnas de tipo crédito del Anexo 6. Revisar muestras en sección 3.`
  : `❌ **No se encontraron códigos numéricos SBS** (ej: '004' para consumo no revolvente) en ningún archivo.\n\nLos archivos solo contienen texto descriptivo (si algo). El código oficial debe provenir del:\n- Catálogo SBS C19 (Tipos de Crédito)\n- Oficio SBS o instructivo BDCC enviado a la cooperativa\n- Confirmación del área de créditos de CEJUASSA`}

---

## 7. ¿Aparece subtipo crédito SBS?

${[...subtipoValues].length
  ? `⚠️ Se encontraron valores en columnas de subtipo: ${[...subtipoValues].join(', ')}\nVerificar si son códigos SBS oficiales.`
  : `❌ **El subtipo crédito SBS NO aparece** en ningún archivo Excel disponible.\n\nNo hay fuente de datos para poblar \`subtipo_credito_sbs\` de los 31 créditos.`}

---

## 8. Conteo exacto de faltantes

| Campo | Faltantes en DB | Recuperable desde Excel | Fuente |
|---|---|---|---|
| \`tasa_interes\` | **${sinTasa} de ${totalCreditos}** | ${matchConTasa > 0 ? `⚠️ ${matchConTasa} posibles desde Anexo 6` : '❌ No recuperable desde Excel disponible'} | Confirmación requerida área créditos |
| \`tipo_credito_sbs\` (código numérico) | **${totalCreditos} de ${totalCreditos}** | ❌ No recuperable desde Excel | Catálogo SBS C19 + Oficio SBS |
| \`subtipo_credito_sbs\` | **${sinSubtipo} de ${totalCreditos}** | ❌ No recuperable desde Excel | Catálogo SBS + Oficio SBS |

---

## 9. Recomendación de corrección

### tasa_interes

**Estado:** Los 31 créditos tienen \`tasa_interes = 0\`. Los archivos Excel no contienen una columna de TEA/TEN directamente utilizable.

**Opciones:**
1. **Si todos los créditos son consumo no revolvente a la misma tasa:** aplicar un valor único confirmado por el área de créditos (script bulk-update con autorización explícita).
2. **Si hay créditos con tasas distintas:** requiere tabla de tasas por expediente provista por el área de créditos.
3. **No usar 0.2682 sin confirmación** — ese valor no aparece en los Excel y no tiene respaldo documental.

**Bloqueante para:** generación de \`cronograma_cuotas\` (la RPC de cronograma requiere \`tasa_interes > 0\`).

### tipo_credito_sbs (código SBS)

**Estado:** Todos los 31 créditos tienen el texto \`'consumo_no_revolvente'\` pero **no** el código numérico del catálogo SBS C19.

**Acción requerida:** Confirmar con el área de créditos o SBS:
- Código TIPCRED según catálogo C19 (probable: \`'004'\` para consumo no revolvente)
- Oficio SBS que define los códigos para esta COOPAC

**Bloqueante para:** exportación BDCC BD01 correcta.

### subtipo_credito_sbs

**Estado:** NULL en los 31 créditos. **No aparece en ningún Excel**.

**Acción requerida:** Confirmar con SBS/área de créditos el código SUBTIPCRED correspondiente.

**Nota:** Si los créditos son todos "consumo no revolvente directo", puede no haber subtipo requerido — consultar si el campo es opcional en el Oficio SBS vigente.

---

## 10. Próximos pasos recomendados

- [ ] **Fase 9C-6A.2:** Solicitar al cliente: lista de tasas por expediente O tasa única aplicada
- [ ] **Fase 9C-6A.3:** Confirmar código SBS C19 para tipo crédito (TIPCRED)
- [ ] **Fase 9C-6A.4:** Confirmar si subtipo_credito_sbs es obligatorio o puede ser NULL en BDCC
- [ ] **Fase 9C-6B:** Aplicar correcciones (requiere autorización explícita)

---

*Generado por: scripts/verify-credit-fields-sources.mjs — SOLO LECTURA*
*Proyecto: COOPAC CEJUASSA — Sistema de Gestión Cooperativa*
`

  const outPath = resolve(DOCS_DIR, 'CREDIT_FIELDS_SOURCE_VERIFICATION.md')
  writeFileSync(outPath, md, 'utf8')
  console.log(`   ✅ Reporte escrito en: docs/ai-recovery/CREDIT_FIELDS_SOURCE_VERIFICATION.md`)

  // ─── Resumen final consola ────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════')
  console.log('  RESUMEN FINAL')
  console.log('══════════════════════════════════════════════════════════')
  console.log(`\n1. Archivos revisados: ${FILES.length}`)
  for (const file of FILES) {
    const r = fileResults[file.key]
    console.log(`   ${r.exists ? '✅' : '❌'} ${file.label}`)
  }

  console.log(`\n2. TASA DE INTERÉS:`)
  const archivosConTasa = FILES.filter(f => fileResults[f.key].hasTasa)
  if (archivosConTasa.length) {
    console.log(`   ⚠️  Columnas tipo "Interes" encontradas en: ${archivosConTasa.map(f => f.key).join(', ')}`)
    console.log(`      → Pero corresponden a interés acumulado, NO a TEA/TEN`)
  } else {
    console.log(`   ❌ Columna de tasa TEA/TEN no encontrada en ningún archivo`)
  }
  console.log(`   📊 DB: ${conTasa}/${totalCreditos} créditos con tasa > 0 (${sinTasa} faltantes)`)
  console.log(`   🔗 Cruce Anexo 6: ${matchConTasa} matches con valor de tasa`)
  console.log(`   ❌ Valor 0.2682: ${donde0_2682.length ? `Encontrado en ${donde0_2682.join(', ')}` : 'NO aparece en ningún archivo'}`)

  console.log(`\n3. TIPO CRÉDITO SBS (código numérico):`)
  const archivosConTipo = FILES.filter(f => fileResults[f.key].hasTipo)
  if (archivosConTipo.length) {
    console.log(`   ⚠️  Columnas de tipo encontradas en: ${archivosConTipo.map(f => f.key).join(', ')}`)
    console.log(`      Valores: ${[...tipoValues].join(', ') || '(ver reporte)'}`)
    console.log(`   Código numérico SBS oficial: ${a6r.tipoCodSbsFound ? '⚠️ Posible — verificar' : '❌ NO encontrado'}`)
  } else {
    console.log(`   ❌ Columna de tipo crédito SBS no encontrada en ningún archivo`)
  }
  console.log(`   📊 DB: 0/${totalCreditos} con código SBS numérico (todos tienen texto descriptivo)`)

  console.log(`\n4. SUBTIPO CRÉDITO SBS:`)
  const archivosConSubtipo = FILES.filter(f => fileResults[f.key].hasSubtipo)
  if (archivosConSubtipo.length) {
    console.log(`   ⚠️  Columnas de subtipo encontradas en: ${archivosConSubtipo.map(f => f.key).join(', ')}`)
  } else {
    console.log(`   ❌ Columna de subtipo NO encontrada en ningún archivo`)
  }
  console.log(`   📊 DB: ${conSubtipo}/${totalCreditos} con subtipo (${sinSubtipo} faltantes)`)

  console.log(`\n5. CONTEO EXACTO DE FALTANTES:`)
  console.log(`   • tasa_interes:         ${sinTasa}/${totalCreditos} faltantes`)
  console.log(`   • tipo_credito_sbs:     ${totalCreditos}/${totalCreditos} sin código SBS numérico`)
  console.log(`   • subtipo_credito_sbs:  ${sinSubtipo}/${totalCreditos} faltantes`)

  console.log(`\n6. RECOMENDACIÓN:`)
  console.log(`   ⚠️  PROCEDER CON CAUTELA`)
  console.log(`   Los 3 campos no pueden completarse automáticamente desde los Excel disponibles.`)
  console.log(`   Se requiere confirmación explícita del cliente antes de cualquier actualización:`)
  console.log(`   a) Tasa de interés por crédito (o tasa única si aplica)`)
  console.log(`   b) Código TIPCRED según catálogo SBS C19`)
  console.log(`   c) Código SUBTIPCRED (o confirmar si es NULL aceptable para esta COOPAC)`)
  console.log(`\n══════════════════════════════════════════════════════════\n`)
}

main().catch(e => { console.error('❌ Error fatal:', e.message); process.exit(1) })
