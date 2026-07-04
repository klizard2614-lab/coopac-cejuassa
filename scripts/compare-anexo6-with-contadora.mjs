/**
 * compare-anexo6-with-contadora.mjs
 * Compara estructura del Anexo 06 de la app vs modelo de la contadora.
 * Solo lectura. No modifica datos ni DB.
 *
 * Uso: node scripts/compare-anexo6-with-contadora.mjs
 */

import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// ── rutas ──────────────────────────────────────────────────────────────────
const MODELO_PATH = join(ROOT,
  '_client_files/raw/extracted/Archvos app',
  '1106_03 Anexo Nø6-Reporte de Deudores ENERO 2026 trabajo SIN CEROS - copia (1).xlsx'
)
const APP_EXPORT_PATH = 'D:\\Kevin Lizarme\\Downloads\\Anexo6_CEJUASSA_032026.xlsx'
const OUT_DIR = join(ROOT, 'exports/anexo6-comparison')
const REPORT_PATH = join(ROOT, 'docs/ai-recovery/ANEXO6_COMPARISON_CONTADORA_REPORT.md')
const DIFF_XLSX_PATH = join(OUT_DIR, 'anexo6_diferencias.xlsx')

// ── importar xlsx ──────────────────────────────────────────────────────────
let XLSX
try {
  XLSX = await import('xlsx')
} catch {
  console.error('ERROR: xlsx no disponible. Ejecutar: npm install')
  process.exit(1)
}
const { read, utils, writeFile } = XLSX.default ?? XLSX

// ── helpers ────────────────────────────────────────────────────────────────
function readExcel(path) {
  if (!existsSync(path)) return null
  const buf = readFileSync(path)
  return read(buf, { type: 'buffer', cellStyles: true, cellFormula: true, sheetStubs: true })
}

function getSheetInfo(wb) {
  const sheets = {}
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name]
    const range = ws['!ref'] ? utils.decode_range(ws['!ref']) : null
    const merges = ws['!merges'] ?? []
    const colWidths = ws['!cols'] ?? []
    const aoa = ws['!ref'] ? utils.sheet_to_json(ws, { header: 1, defval: null }) : []

    // buscar fila de encabezado (primera fila no vacía)
    let headerRow = null
    let headerRowIdx = -1
    for (let i = 0; i < Math.min(10, aoa.length); i++) {
      const row = aoa[i]
      const nonNull = row.filter(c => c !== null && c !== undefined && String(c).trim() !== '')
      if (nonNull.length >= 3) { headerRow = row; headerRowIdx = i; break }
    }

    // extraer muestra de datos (primeras 3 filas de datos)
    const dataSample = aoa.slice(headerRowIdx + 1, headerRowIdx + 4)

    sheets[name] = {
      rows: range ? range.e.r - range.s.r + 1 : 0,
      cols: range ? range.e.c - range.s.c + 1 : 0,
      range: ws['!ref'] ?? 'vacío',
      mergesCount: merges.length,
      colWidthsDefined: colWidths.length,
      headerRowIdx,
      headers: headerRow ? headerRow.map(h => h === null ? '' : String(h).trim()) : [],
      dataSample,
    }
  }
  return sheets
}

function compareHeaders(headersModelo, headersApp) {
  const setModelo = new Set(headersModelo.filter(Boolean))
  const setApp = new Set(headersApp.filter(Boolean))

  const faltanEnApp = [...setModelo].filter(h => !setApp.has(h))
  const sobranEnApp = [...setApp].filter(h => !setModelo.has(h))
  const coinciden = [...setModelo].filter(h => setApp.has(h))

  // diferencias de orden
  const diferenciasOrden = []
  const modeloFiltrado = headersModelo.filter(Boolean)
  const appFiltrada = headersApp.filter(Boolean)

  for (let i = 0; i < Math.min(modeloFiltrado.length, appFiltrada.length); i++) {
    if (modeloFiltrado[i] !== appFiltrada[i]) {
      diferenciasOrden.push({
        col: i + 1,
        modelo: modeloFiltrado[i],
        app: appFiltrada[i],
      })
    }
  }

  return { faltanEnApp, sobranEnApp, coinciden, diferenciasOrden }
}

// ── main ───────────────────────────────────────────────────────────────────

mkdirSync(OUT_DIR, { recursive: true })

console.log('\n═══════════════════════════════════════════════════════')
console.log('  COMPARACIÓN ANEXO 06 — CONTADORA vs APP')
console.log('═══════════════════════════════════════════════════════\n')

// 1. Leer archivos
const wbModelo = readExcel(MODELO_PATH)
const wbApp = readExcel(APP_EXPORT_PATH)

const modeloOk = !!wbModelo
const appOk = !!wbApp

console.log(`Modelo contadora : ${modeloOk ? '✅ encontrado' : '❌ NO ENCONTRADO'}`)
console.log(`Export app       : ${appOk ? '✅ encontrado' : '❌ NO ENCONTRADO — ejecutar primero la exportación desde la UI'}`)
console.log()

if (!modeloOk) {
  console.error('No se puede continuar sin el modelo de la contadora.')
  process.exit(1)
}

// 2. Extraer info del modelo
const modeloSheets = getSheetInfo(wbModelo)
console.log(`Hojas en modelo contadora (${wbModelo.SheetNames.length}): ${wbModelo.SheetNames.join(', ')}`)

// 3. Encabezados actualizados en la app (post ANEXO6-1, de page.tsx handleExportar)
const headersApp = [
  'Fila',
  'Apellidos y Nombres / Razón Social',
  'Fecha de Nacimiento',
  'Género',
  'Estado Civil',
  'Sigla de la Empresa',
  'Código Socio',
  'Partida Registral',
  'Tipo de Documento',
  'Número de Documento',
  'Tipo de Persona',
  'Domicilio',
  'Relación Laboral con la Cooperativa',
  'Clasificación del Deudor',
  'Clasificación del Deudor con Alineamiento Interno',
  'Código de Agencia',
  'Moneda del crédito',
  'Número de Crédito',
  'Tipo de Crédito',
  'Sub Tipo de Crédito',
  'Fecha de Desembolso',
  'Monto de Desembolso',
  'Tasa de Interés Anual',
  'Saldo de Colocaciones',
  'Cuenta Contable',
  'Capital Vigente',
  'Capital Reestructurado',
  'Capital Refinanciado',
  'Capital Vencido',
  'Capital en Cobranza Judicial',
  'Capital Contingente',
  'Cuenta Contable del Capital Contingente',
  'Días de Mora',
  'Saldos de Garantías Preferidas',
  'Saldos de Garantías Autolíquidables',
  'Provisiones Requeridas',
  'Provisiones Constituidas',
  'Saldo de Créditos Castigados',
  'Cuenta Contable del Crédito Castigado',
  'Rendimiento Devengado',
  'Intereses en Suspenso',
  'Ingresos Diferidos',
  'Tipo de Producto',
  'Número de Cuotas Programadas',
  'Número de Cuotas Pagadas',
  'Periodicidad de la cuota',
  'Periodo de Gracia',
  'Fecha de Vencimiento Original del Crédito',
  'Fecha de Vencimiento Actual del Crédito',
  'Saldo de Créditos con Sustitución de Contraparte Crediticia',
  'Saldo de Créditos que no cuentan con cobertura',
  'Saldo Capital de Créditos Reprogramados',
  'Saldo Capital en Cuenta de Orden por efecto del Covid',
  'Subcuenta de orden',
  'Rendimiento Devengado por efecto del COVID 19',
  'Saldo de Garantías con Sustitución de Contraparte',
  'Saldo Capital de Créditos Reprogramados por efecto del COVID 19',
  'Saldo de Créditos dentro del alcance del DL N°1508',
  'Saldo Capital en Cuenta de Orden Programa IMPULSO MYPERU',
  'Rendimiento Devengado por Programa IMPULSO MYPERU',
]

// Nombre de hoja dinámico: MMMYYYY sin CEROS (ej. MARZO2026 sin CEROS)
const appSheetName = 'MARZO2026 sin CEROS' // ejemplo para comparación; en la app es dinámico por mes/año
const appSheetInfo = {
  rows: 'N/A (generado dinámicamente)',
  cols: headersApp.length,
  range: 'dinámico',
  mergesCount: 0,
  headers: headersApp,
  headerRowIdx: 0,
}

// 4. Identificar hoja principal del modelo
// Buscar la que tiene más filas y datos útiles
let mainSheetName = wbModelo.SheetNames[0]
let maxRows = 0
for (const [name, info] of Object.entries(modeloSheets)) {
  if (info.rows > maxRows) { maxRows = info.rows; mainSheetName = name }
}
const mainSheet = modeloSheets[mainSheetName]

console.log(`\nHoja principal modelo: "${mainSheetName}"`)
console.log(`  Filas: ${mainSheet.rows} | Cols: ${mainSheet.cols} | Rango: ${mainSheet.range}`)
console.log(`  Encabezados encontrados en fila: ${mainSheet.headerRowIdx + 1}`)
console.log(`  Número de encabezados: ${mainSheet.headers.filter(Boolean).length}`)
console.log()

// 5. Comparar encabezados
const headersModelo = mainSheet.headers

console.log('─── Encabezados modelo contadora ─────────────────────')
headersModelo.forEach((h, i) => h && console.log(`  [${i+1}] ${h}`))

console.log('\n─── Encabezados app ────────────────────────────────────')
headersApp.forEach((h, i) => console.log(`  [${i+1}] ${h}`))

const cmp = compareHeaders(headersModelo.filter(Boolean), headersApp.filter(Boolean))

console.log('\n═══ DIFERENCIAS ═══════════════════════════════════════')
console.log(`Columnas en modelo   : ${headersModelo.filter(Boolean).length}`)
console.log(`Columnas en app      : ${headersApp.filter(Boolean).length}`)
console.log(`Coinciden exactamente: ${cmp.coinciden.length}`)
console.log(`Faltan en app        : ${cmp.faltanEnApp.length}`)
console.log(`Sobran en app        : ${cmp.sobranEnApp.length}`)
console.log(`Diferencias de orden : ${cmp.diferenciasOrden.length}`)

if (cmp.faltanEnApp.length > 0) {
  console.log('\n⚠ FALTAN en app:')
  cmp.faltanEnApp.forEach(h => console.log(`  - "${h}"`))
}
if (cmp.sobranEnApp.length > 0) {
  console.log('\n⚠ SOBRAN en app:')
  cmp.sobranEnApp.forEach(h => console.log(`  - "${h}"`))
}
if (cmp.diferenciasOrden.length > 0) {
  console.log('\n⚠ ORDEN diferente (primeras 10):')
  cmp.diferenciasOrden.slice(0, 10).forEach(d =>
    console.log(`  Col ${d.col}: modelo="${d.modelo}" | app="${d.app}"`)
  )
}

// Nombre de hoja
const sheetNameMatch = wbModelo.SheetNames.includes(appSheetName)
console.log(`\nNombre hoja modelo : "${mainSheetName}"`)
console.log(`Nombre hoja app    : "${appSheetName}"`)
console.log(`Coincide hoja      : ${sheetNameMatch ? '✅' : '❌ DIFERENTE'}`)

// Nombre de archivo
const fileNameModelo = '1106_03 Anexo Nø6-Reporte de Deudores ENERO 2026 trabajo SIN CEROS - copia (1).xlsx'
const fileNameApp = `Anexo6_CEJUASSA_032026.xlsx`
console.log(`\nNombre archivo modelo: "${fileNameModelo}"`)
console.log(`Nombre archivo app   : "${fileNameApp}" (patrón: Anexo6_CEJUASSA_<MM><YYYY>.xlsx)`)

// 6. Analizar muestra de datos del modelo para inferir tipos
console.log('\n─── Muestra de datos modelo (primeras 3 filas) ─────────')
mainSheet.dataSample.forEach((row, i) => {
  const preview = row.slice(0, 10).map(v => v === null ? 'null' : String(v).slice(0, 15))
  console.log(`  Fila ${i+1}: [${preview.join(' | ')}]`)
})

// 7. Generar veredicto
const totalDiffs = cmp.faltanEnApp.length + cmp.sobranEnApp.length + cmp.diferenciasOrden.length
let veredicto = 'IGUAL'
let criticidad = 'ninguna'
if (totalDiffs > 20) { veredicto = 'DIFERENTE'; criticidad = 'alta' }
else if (totalDiffs > 5) { veredicto = 'PARCIALMENTE IGUAL'; criticidad = 'media' }
else if (totalDiffs > 0) { veredicto = 'PARCIALMENTE IGUAL'; criticidad = 'baja' }

console.log(`\n═══ VEREDICTO: ${veredicto} (criticidad: ${criticidad}) ═══`)

// 8. Escribir Excel de diferencias
const wb = utils.book_new()

// Hoja Resumen
const resumen = [
  ['Campo', 'Modelo Contadora', 'App Actual', 'Coincide'],
  ['Nombre hoja principal', mainSheetName, appSheetName, mainSheetName === appSheetName ? 'SÍ' : 'NO'],
  ['N° hojas', wbModelo.SheetNames.length, 1, wbModelo.SheetNames.length === 1 ? 'SÍ' : 'NO'],
  ['N° columnas', headersModelo.filter(Boolean).length, headersApp.filter(Boolean).length,
    headersModelo.filter(Boolean).length === headersApp.filter(Boolean).length ? 'SÍ' : 'NO'],
  ['N° filas (modelo)', mainSheet.rows, 'dinámico', '—'],
  ['Fila de encabezados', mainSheet.headerRowIdx + 1, 1, '—'],
  ['Patrón nombre archivo', fileNameModelo, 'Anexo6_CEJUASSA_MMYYYY.xlsx', 'NO (diferente convención)'],
  ['VEREDICTO', veredicto, '', ''],
]
utils.book_append_sheet(wb, utils.aoa_to_sheet(resumen), 'Resumen')

// Hoja Columnas modelo
const colsModelo = [['#', 'Columna (Modelo Contadora)']]
headersModelo.forEach((h, i) => h && colsModelo.push([i + 1, h]))
utils.book_append_sheet(wb, utils.aoa_to_sheet(colsModelo), 'Columnas modelo')

// Hoja Columnas app
const colsApp = [['#', 'Columna (App Actual)']]
headersApp.forEach((h, i) => colsApp.push([i + 1, h]))
utils.book_append_sheet(wb, utils.aoa_to_sheet(colsApp), 'Columnas app')

// Hoja Diferencias
const diffs = [['Tipo', 'Detalle', 'Criticidad']]
if (mainSheetName !== appSheetName)
  diffs.push(['Nombre de hoja', `Modelo: "${mainSheetName}" vs App: "${appSheetName}"`, 'MEDIA'])
cmp.faltanEnApp.forEach(h => diffs.push(['Falta en app', h, 'ALTA']))
cmp.sobranEnApp.forEach(h => diffs.push(['Sobra en app', h, 'MEDIA']))
cmp.diferenciasOrden.slice(0, 30).forEach(d =>
  diffs.push(['Orden diferente', `Col ${d.col}: modelo="${d.modelo}" / app="${d.app}"`, 'BAJA'])
)
if (diffs.length === 1) diffs.push(['', 'Sin diferencias encontradas', ''])
utils.book_append_sheet(wb, utils.aoa_to_sheet(diffs), 'Diferencias')

// Hoja Pendientes
const pendientes = [
  ['Campo pendiente', 'Motivo', 'Quién confirma'],
  ['Género (sexo)', 'App exporta "M" para todos — hardcoded', 'Contadora / Operaciones'],
  ['Estado civil', 'App exporta "S" para todos — hardcoded', 'Contadora / Operaciones'],
  ['Sub Tipo de Crédito', 'App exporta vacío — pendiente SBS', 'Créditos'],
  ['Nombre de hoja Excel', `Modelo usa "${mainSheetName}" / App usa "Anexo6"`, 'Contadora'],
  ['Columnas Col50-Col60', 'App exporta 11 cols extra con nombre genérico', 'Contadora — verificar si son reales o padding'],
  ['Patrón nombre archivo', 'Convención diferente. Confirmar cuál acepta SBS.', 'Contadora'],
]
utils.book_append_sheet(wb, utils.aoa_to_sheet(pendientes), 'Pendientes')

writeFile(wb, DIFF_XLSX_PATH)
console.log(`\n✅ Excel de diferencias guardado: ${DIFF_XLSX_PATH}`)

// Guardar también versión post-fix si fue ejecutado post ANEXO6-1
const POST_FIX_PATH = join(OUT_DIR, 'anexo6_diferencias_post_fix.xlsx')
const wbPF = utils.book_new()
utils.book_append_sheet(wbPF, utils.aoa_to_sheet(resumen), 'Resumen')
utils.book_append_sheet(wbPF, utils.aoa_to_sheet(colsModelo), 'Columnas modelo')
utils.book_append_sheet(wbPF, utils.aoa_to_sheet(colsApp), 'Columnas app')
utils.book_append_sheet(wbPF, utils.aoa_to_sheet(diffs), 'Diferencias')
utils.book_append_sheet(wbPF, utils.aoa_to_sheet(pendientes), 'Pendientes')
writeFile(wbPF, POST_FIX_PATH)
console.log(`✅ Excel post-fix guardado: ${POST_FIX_PATH}`)

// 9. Escribir reporte Markdown
const now = new Date().toISOString().split('T')[0]
const reportMd = `# ANEXO6_COMPARISON_CONTADORA_REPORT.md

> Generado: ${now} | Fase: ANEXO6-0 | Solo lectura — no se modificó DB ni código

---

## Resumen ejecutivo

| | |
|---|---|
| Archivo modelo | \`1106_03 Anexo Nø6-Reporte de Deudores ENERO 2026 trabajo SIN CEROS - copia (1).xlsx\` |
| Archivo app (referencia) | \`Anexo6_CEJUASSA_032026.xlsx\` (encabezados extraídos de \`page.tsx\`) |
| Resultado | **${veredicto}** |
| Criticidad | **${criticidad.toUpperCase()}** |
| Total diferencias | ${totalDiffs} |

**El Anexo 06 actual es ${veredicto.toLowerCase()} al modelo de la contadora.**

---

## Tabla de diferencias

### Hojas
| Campo | Modelo | App | Estado |
|---|---|---|---|
| Nombre hoja principal | \`${mainSheetName}\` | \`Anexo6\` | ${mainSheetName === appSheetName ? '✅ igual' : '⚠ diferente'} |
| N° hojas | ${wbModelo.SheetNames.length} | 1 | ${wbModelo.SheetNames.length === 1 ? '✅ igual' : '⚠ diferente'} |
| Todas las hojas | ${wbModelo.SheetNames.map(n => `\`${n}\``).join(', ')} | \`Anexo6\` | — |

### Columnas
| Indicador | Valor |
|---|---|
| Columnas en modelo | ${headersModelo.filter(Boolean).length} |
| Columnas en app | ${headersApp.filter(Boolean).length} |
| Coinciden exactamente | ${cmp.coinciden.length} |
| Faltan en app | ${cmp.faltanEnApp.length} |
| Sobran en app | ${cmp.sobranEnApp.length} |
| Diferencias de orden | ${cmp.diferenciasOrden.length} |

---

## Diferencias críticas

${cmp.faltanEnApp.length > 0 ? `### Columnas que faltan en la app (${cmp.faltanEnApp.length})
${cmp.faltanEnApp.map(h => `- \`${h}\``).join('\n')}` : '### Columnas faltantes\n_Ninguna detectada._'}

---

## Diferencias menores

${cmp.sobranEnApp.length > 0 ? `### Columnas extra en la app (${cmp.sobranEnApp.length})
${cmp.sobranEnApp.map(h => `- \`${h}\``).join('\n')}` : ''}

${cmp.diferenciasOrden.length > 0 ? `### Diferencias de orden (${Math.min(20, cmp.diferenciasOrden.length)} de ${cmp.diferenciasOrden.length})
| Col | Modelo | App |
|---|---|---|
${cmp.diferenciasOrden.slice(0, 20).map(d => `| ${d.col} | \`${d.modelo}\` | \`${d.app}\` |`).join('\n')}` : ''}

### Nombre de hoja
- Modelo: \`${mainSheetName}\`
- App: \`Anexo6\`
- ${mainSheetName === appSheetName ? '✅ Coincide' : '⚠ No coincide — cambiar en código'}

### Nombre de archivo
- Modelo: \`1106_03 Anexo Nø6-Reporte de Deudores ENERO 2026 trabajo SIN CEROS - copia (1).xlsx\`
- App: \`Anexo6_CEJUASSA_<MM><YYYY>.xlsx\`
- ⚠ Convención diferente — confirmar con contadora cuál formato acepta el sistema SBS

---

## Campos hardcodeados (pendientes de corrección)
| Campo | Valor hardcoded | Valor real requerido |
|---|---|---|
| Género | \`M\` (todos) | Campo \`sexo\` en tabla \`socios\` |
| Estado civil | \`S\` (todos) | Campo \`estado_civil\` en tabla \`socios\` |
| Sub Tipo de Crédito | \`\` (vacío) | Código SBS del sub-tipo de crédito |
| Relación Laboral Coop. | \`0\` | Verificar si es correcto |

---

## Columnas modelo (${headersModelo.filter(Boolean).length})
${headersModelo.filter(Boolean).map((h, i) => `${i+1}. \`${h}\``).join('\n')}

---

## Columnas app (${headersApp.length})
${headersApp.map((h, i) => `${i+1}. \`${h}\``).join('\n')}

---

## Archivos generados
- \`exports/anexo6-comparison/anexo6_diferencias.xlsx\` — Excel con 5 hojas de análisis
- \`docs/ai-recovery/ANEXO6_COMPARISON_CONTADORA_REPORT.md\` — este reporte

## Confirmación: no se tocó DB
- No se ejecutaron migraciones.
- No se modificó código de Anexo 06.
- No se ejecutaron scripts destructivos.
- No se modificaron datos en Supabase.

---

## Recomendación

${veredicto === 'IGUAL'
  ? '**PROCEDER** — El Anexo 06 coincide con el modelo de la contadora.'
  : veredicto === 'PARCIALMENTE IGUAL'
  ? '**PROCEDER CON CAUTELA** — Existen diferencias menores corregibles sin riesgo.'
  : '**BLOQUEAR** — Existen diferencias estructurales significativas que requieren corrección antes del envío SBS.'}

### Próxima fase recomendada
1. Confirmar con la contadora el nombre de hoja esperado.
2. Agregar campos \`sexo\` y \`estado_civil\` a la tabla \`socios\` (fase DB).
3. Corregir columnas extras (Col50–Col60) si no corresponden al formato SBS.
4. Alinear nombre de archivo al patrón del sistema SBS.
`

writeFileSync(REPORT_PATH, reportMd, 'utf8')
console.log(`✅ Reporte MD guardado: ${REPORT_PATH}`)

console.log('\n═══════════════════════════════════════════════════════')
console.log('  COMPARACIÓN COMPLETADA')
console.log(`  Veredicto: ${veredicto}`)
console.log(`  Diferencias totales: ${totalDiffs}`)
console.log('═══════════════════════════════════════════════════════\n')
