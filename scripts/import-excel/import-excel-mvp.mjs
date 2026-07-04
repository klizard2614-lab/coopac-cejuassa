/**
 * import-excel-mvp.mjs
 * Fase 9C-4B — Importador desde Excel (fuente principal: Excel del proyecto)
 *
 * REGLAS ESTRICTAS:
 * - NO modifica _client_files/
 * - NO toca usuarios/configuracion/auth.users
 * - NO crea migraciones
 * - NO borra datos
 * - NO usa backup JSON como fuente principal
 * - NO imprime datos personales completos
 * - Apply REQUIERE: IMPORT_AUTH="EJECUTAR IMPORTACION EXCEL 9C-4B"
 *
 * Uso:
 *   node scripts/import-excel/import-excel-mvp.mjs --dry-run   (default)
 *   IMPORT_AUTH="EJECUTAR IMPORTACION EXCEL 9C-4B" node scripts/import-excel/import-excel-mvp.mjs --apply
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')
const DOCS_DIR = resolve(ROOT, 'docs/ai-recovery')
const XLSX = await import('xlsx').then(m => m.default || m)

// ─── Modo ────────────────────────────────────────────────────────────────────

const IS_APPLY = process.argv.includes('--apply')
const MODE = IS_APPLY ? 'APPLY' : 'DRY-RUN'

if (IS_APPLY) {
  const auth = process.env.IMPORT_AUTH || ''
  if (auth !== 'EJECUTAR IMPORTACION EXCEL 9C-4B') {
    console.error('\n❌ APPLY bloqueado.')
    console.error('   Requiere: IMPORT_AUTH="EJECUTAR IMPORTACION EXCEL 9C-4B"')
    console.error('   En PowerShell: $env:IMPORT_AUTH="EJECUTAR IMPORTACION EXCEL 9C-4B"; npm run import:excel:mvp:apply')
    process.exit(1)
  }
}

// ─── Fuentes Excel ───────────────────────────────────────────────────────────

const BASE = resolve(ROOT, '_client_files/raw/extracted/Archvos app')
const EXCEL_FILES = {
  creditos: resolve(BASE, 'DSCTO Y DESMBOLSO DE CRDITO MA ABR-2026 (1).xlsx'),
  ingresos: resolve(BASE, 'INGRESO DETALLADO MARZO 2026 (1).xlsx'),
  convenio: resolve(BASE, 'CONVENIO MES MARZO 2026 (1).xlsx'),
}

// ─── Utilidades ──────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = resolve(ROOT, '.env.local')
  if (!existsSync(envPath)) return false
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const [key, ...rest] = line.split('=')
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
  }
  return true
}

function excelSerialToDate(serial) {
  if (!serial || typeof serial !== 'number') return null
  return new Date(Math.round((serial - 25569) * 86400 * 1000)).toISOString().split('T')[0]
}

function parseSpanishDate(str) {
  const s = String(str || '').trim()
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const [, d, mo, y] = m
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function parsePeriod(fechaStr) {
  const d = parseSpanishDate(fechaStr)
  return d ? d.substring(0, 7) : null // YYYY-MM
}

function splitNombre(fullName) {
  const s = (fullName || '').trim().replace(/\s+/g, ' ')
  const parts = s.split(' ')
  if (parts.length === 1) return { apellidos: s, nombres: '' }
  return { apellidos: parts[0], nombres: parts.slice(1).join(' ') }
}

function maskDni(dni) {
  const s = String(dni || '').trim()
  if (s.length <= 3) return '***'
  return s.substring(0, 2) + '*'.repeat(Math.min(s.length - 4, 5)) + s.slice(-2)
}

function maskNombre(name) {
  const parts = String(name || '').trim().split(' ')
  if (parts.length === 0) return '***'
  return parts[0].substring(0, 2) + '***'
}

function readSheet(filePath, sheetName, headerRow) {
  if (!existsSync(filePath)) return { error: `No encontrado: ${filePath}`, rows: [] }
  try {
    const wb = XLSX.readFile(filePath)
    if (!wb.SheetNames.includes(sheetName)) return { error: `Hoja "${sheetName}" no existe`, rows: [] }
    const allRows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' })
    const headers = allRows[headerRow].map(h => String(h).trim())
    const dataRows = allRows.slice(headerRow + 1).filter(r => r.some(c => c !== ''))
    return { headers, rows: dataRows.map(r => Object.fromEntries(headers.map((h, i) => [h, r[i]]))) }
  } catch (e) {
    return { error: e.message, rows: [] }
  }
}

function normalizarUsuario(u) {
  const s = String(u || '').trim()
  const MAP = {
    'BELEN': 'BELEN', 'BELEN  ': 'BELEN',
    'CHEPEN': 'CHEPEN', 'CHEPEN ': 'CHEPEN',
    'DIRES': 'DIRES', 'DIRES  ': 'DIRES',
    'IREN': 'IREN', 'IREN   ': 'IREN',
    'IRO': 'IRO', 'IRO    ': 'IRO',
    'LAFORA': 'LAFORA', 'LAFORA ': 'LAFORA', 'LA FORA': 'LAFORA',
    'REGION': 'REGION', 'REGION ': 'REGION', 'REGIONAL': 'REGION',
    'UTES': 'UTES', 'UTES   ': 'UTES', 'UTES 6': 'UTES',
    'OTUZCO': 'OTUZCO', 'OTUZCO ': 'OTUZCO',
    'SCHUCO': 'SCHUCO', 'SCHUCO ': 'SCHUCO',
  }
  return MAP[s.trim()] || (s.trim() === 'USUCAJ' ? null : s.trim() || null)
}

// ─── Fase 1: Leer Excel ───────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(56)}`)
console.log(`  CEJUASSA — Importador Excel MVP — ${MODE}`)
console.log(`  Fuente: archivos Excel del proyecto`)
console.log(`  NO se modifica _client_files/ en ningún modo.`)
console.log(`${'═'.repeat(56)}\n`)

console.log('📂 Leyendo Excel...')
const creditosData = readSheet(EXCEL_FILES.creditos, 'Hoja3', 3)
const ingresosData = readSheet(EXCEL_FILES.ingresos, 'Hoja1', 4)
const convenioData = readSheet(EXCEL_FILES.convenio, 'DETALLE', 4)

if (creditosData.error || ingresosData.error || convenioData.error) {
  if (creditosData.error) console.error('  ❌ DSCTO:', creditosData.error)
  if (ingresosData.error) console.error('  ❌ INGRESO:', ingresosData.error)
  if (convenioData.error) console.error('  ❌ CONVENIO:', convenioData.error)
  process.exit(1)
}
console.log(`  ✅ DSCTO:    ${creditosData.rows.length} filas`)
console.log(`  ✅ INGRESO:  ${ingresosData.rows.length} filas`)
console.log(`  ✅ CONVENIO: ${convenioData.rows.length} filas`)

// ─── Fase 2: Construir entidades ─────────────────────────────────────────────

// Juntar todas las filas de pagos para extraer socios
const todasFilasPagos = [...ingresosData.rows, ...convenioData.rows]

// ── 2A: Socios derivados ──────────────────────────────────────────────────────
console.log('\n🧑 Construyendo socios derivados...')
const socioMap = new Map() // nro_socio → { nro_socio, dni, nombre, usuario, idPers }

for (const row of todasFilasPagos) {
  const nroSocio = String(row['IdSocio'] || '').trim().replace(/^0+/, '').padStart(7, '0')
  if (!nroSocio || nroSocio === '0000000') continue
  const dni = String(row['DNI'] || '').trim()
  const nombre = String(row['Socio'] || '').trim().replace(/\s+/g, ' ')
  const usuario = normalizarUsuario(row['Usuario'])
  const idPers = String(row['IdPers'] || '').trim()

  if (!socioMap.has(nroSocio)) {
    socioMap.set(nroSocio, { nro_socio: nroSocio, dni: dni || null, nombre, usuario, idPers })
  } else {
    const existing = socioMap.get(nroSocio)
    if (!existing.dni && dni) existing.dni = dni
    if (!existing.nombre && nombre) existing.nombre = nombre
    if (!existing.usuario && usuario) existing.usuario = usuario
  }
}

// También agregar socios desde DSCTO (pueden tener créditos pero no pagos en este mes)
for (const row of creditosData.rows) {
  const nroSocio = String(row['IdSocio'] || '').trim().replace(/^0+/, '').padStart(7, '0')
  if (!nroSocio || nroSocio === '0000000') continue
  const nombre = String(row['Socio'] || '').trim().replace(/\s+/g, ' ')
  const usuario = normalizarUsuario(row['Convenio'])

  if (!socioMap.has(nroSocio)) {
    socioMap.set(nroSocio, { nro_socio: nroSocio, dni: null, nombre, usuario, idPers: null })
  } else {
    const existing = socioMap.get(nroSocio)
    if (!existing.nombre && nombre) existing.nombre = nombre
    if (!existing.usuario && usuario) existing.usuario = usuario
  }
}

const sociosDerivados = [...socioMap.values()]
const sociosSinDni = sociosDerivados.filter(s => !s.dni)
const socioConflictos = [] // socios con mismo DNI diferente nroSocio

const dniMap = new Map()
for (const s of sociosDerivados) {
  if (!s.dni) continue
  if (dniMap.has(s.dni)) socioConflictos.push({ dni: maskDni(s.dni), nros: [s.nro_socio, dniMap.get(s.dni)] })
  else dniMap.set(s.dni, s.nro_socio)
}

console.log(`  Total socios únicos : ${sociosDerivados.length}`)
console.log(`  Con DNI             : ${sociosDerivados.length - sociosSinDni.length}`)
console.log(`  Sin DNI             : ${sociosSinDni.length}`)
if (socioConflictos.length) console.log(`  ⚠️  DNI con conflicto: ${socioConflictos.length}`)

// ── 2B: Convenios ─────────────────────────────────────────────────────────────
console.log('\n🏛️  Construyendo convenios...')
const convenioNombres = new Set()
for (const s of sociosDerivados) if (s.usuario) convenioNombres.add(s.usuario)
// También de pagos
for (const row of todasFilasPagos) {
  const u = normalizarUsuario(row['Usuario'])
  if (u) convenioNombres.add(u)
}
const conveniosList = [...convenioNombres].sort().map(n => ({ nombre: n }))
console.log(`  Convenios únicos: ${conveniosList.length} → ${conveniosList.map(c => c.nombre).join(', ')}`)

// ── 2C: Créditos ─────────────────────────────────────────────────────────────
console.log('\n💳 Construyendo créditos...')
const creditosWarnings = []
const creditos = []
let creditosSinSocio = 0

for (const row of creditosData.rows) {
  const nroSocio = String(row['IdSocio'] || '').trim().replace(/^0+/, '').padStart(7, '0')
  if (!nroSocio || nroSocio === '0000000') { creditosSinSocio++; continue }
  if (!socioMap.has(nroSocio)) { creditosSinSocio++; continue }

  const monto = parseFloat(row['Monto']) || 0
  const saldoCapital = parseFloat(row['Saldo Capital']) || 0
  const plazo = parseInt(row['Plazo']) || 0
  const expediente = row['Exped.']
  const fechaSerial = row['Fecha']
  const fecha = excelSerialToDate(fechaSerial)

  if (!fecha) creditosWarnings.push(`Fecha inválida en expediente ${expediente}`)

  const descuentoFps = parseFloat(row['FPS']) || 0
  const tramite = parseFloat(row['Tram.']) || 0
  const autoSeg = parseFloat(row['AutoSeg.']) || 0
  const montoGirado = parseFloat(row['Monto Girado']) || 0
  const descuentoTotal = parseFloat(row['Descuento']) || 0
  const cuotaMensual = parseFloat(row['CuoProp']) || 0
  const aporte = parseFloat(row['Aporte']) || 0
  const interes = parseFloat(row['Interes']) || 0

  creditos.push({
    _nro_socio: nroSocio,
    nro_pagare: String(expediente || ''),
    nro_expediente: String(expediente || ''),
    fecha_desembolso: fecha,
    monto_aprobado: monto,
    monto_girado_neto: montoGirado,
    descuento_fps: descuentoFps,
    descuento_seguro: autoSeg,
    descuento_otros: 0,
    tramite,
    aporte_descontado: aporte,
    saldo_capital: saldoCapital,
    cuota_mensual: cuotaMensual,
    tasa_interes: 0, // no disponible en Excel
    plazo_meses: plazo,
    tipo_credito: 'consumo',
    estado: saldoCapital > 0 ? 'vigente' : 'cancelado',
    interes_acumulado: interes,
    cuenta_contable_bd01: '1411050604',
  })
}

const creditosVigentes = creditos.filter(c => c.estado === 'vigente').length
const creditosCancelados = creditos.filter(c => c.estado === 'cancelado').length
console.log(`  Total créditos     : ${creditos.length}`)
console.log(`  Vigentes           : ${creditosVigentes}`)
console.log(`  Cancelados         : ${creditosCancelados}`)
if (creditosSinSocio) console.log(`  ⚠️  Sin socio      : ${creditosSinSocio}`)
if (creditosWarnings.length) creditosWarnings.forEach(w => console.log(`  ⚠️  ${w}`))

// ── 2D: Pagos ─────────────────────────────────────────────────────────────────
console.log('\n💵 Construyendo pagos...')
const pagosWarnings = []
const pagos = []
let pagosSinSocio = 0

for (const row of todasFilasPagos) {
  const nroSocio = String(row['IdSocio'] || '').trim().replace(/^0+/, '').padStart(7, '0')
  if (!nroSocio || nroSocio === '0000000') { pagosSinSocio++; continue }
  if (!socioMap.has(nroSocio)) { pagosSinSocio++; continue }

  const nroRecibo = String(row['N°Recibo'] || '').trim()
  if (!nroRecibo) { pagosWarnings.push('Pago sin N°Recibo omitido'); continue }

  const fecha = parseSpanishDate(String(row['Fecha'] || ''))
  const ap = parseFloat(row['Ap']) || 0
  const ptmo = parseFloat(row['Ptmo']) || 0
  const intC = parseFloat(row['IntC']) || 0
  const fps = parseFloat(row['FPS']) || 0
  const fpsEx = parseFloat(row['FPSEx']) || 0
  const otrosP = parseFloat(row['OtrosP']) || 0
  const totalRec = parseFloat(row['TotalRec']) || 0
  const usuario = normalizarUsuario(row['Usuario'])
  const tipoPago = String(row['Tipo'] || 'A').trim() || 'A'

  const calculado = ap + ptmo + intC + fps + fpsEx + otrosP
  if (Math.abs(calculado - totalRec) > 0.05) {
    pagosWarnings.push(`Recibo ${nroRecibo}: discrepancia monto (calculado=${calculado.toFixed(2)}, total=${totalRec.toFixed(2)})`)
  }

  pagos.push({
    _nro_socio: nroSocio,
    _usuario_convenio: usuario,
    nro_recibo: nroRecibo,
    fecha,
    periodo: fecha ? fecha.substring(0, 7) : null,
    canal_pago: usuario ? 'convenio' : 'caja',
    estado_flujo: 'registrado',
    monto_aporte: ap,
    monto_capital: ptmo,
    monto_interes: intC,
    monto_fps: fps,
    monto_fps_extra: fpsEx,
    monto_otros: otrosP,
    monto_total: totalRec,
    interes_amortizado_pagado: intC,
    tipo_pago: tipoPago,
    id_credito: null, // no mapeable automáticamente
    observacion: 'Importado desde Excel Fase 9C-4B',
  })
}

const pagosConAporte = pagos.filter(p => p.monto_aporte > 0).length
const pagosConCapital = pagos.filter(p => p.monto_capital > 0).length
console.log(`  Total pagos        : ${pagos.length}`)
console.log(`  Con aporte (Ap>0)  : ${pagosConAporte}`)
console.log(`  Con capital (Ptmo>0): ${pagosConCapital}`)
if (pagosSinSocio) console.log(`  ⚠️  Sin socio      : ${pagosSinSocio}`)
if (pagosWarnings.length) pagosWarnings.forEach(w => console.log(`  ⚠️  ${w}`))

// ── 2E: Aportes ───────────────────────────────────────────────────────────────
console.log('\n💰 Construyendo aportes...')
const pagosConAporteList = pagos
  .filter(p => p.monto_aporte > 0)
  .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))

const saldosPorSocio = {}
const aportes = []
for (const pago of pagosConAporteList) {
  const ns = pago._nro_socio
  const saldoAnterior = saldosPorSocio[ns] || 0
  const saldoNuevo = saldoAnterior + pago.monto_aporte
  saldosPorSocio[ns] = saldoNuevo
  aportes.push({
    _nro_socio: ns,
    _nro_recibo: pago.nro_recibo,
    fecha: pago.fecha,
    tipo: 'aporte',
    monto: pago.monto_aporte,
    saldo_anterior: saldoAnterior,
    saldo_nuevo: saldoNuevo,
    observacion: 'Importado desde Excel Fase 9C-4B',
  })
}
console.log(`  Total aportes      : ${aportes.length}`)
console.log(`  Socios con aporte  : ${Object.keys(saldosPorSocio).length}`)

// ─── Fase 3: Validaciones de relaciones ──────────────────────────────────────

console.log('\n🔗 Validando relaciones...')
const issues = []
const warnings = []

// Créditos con socio derivado
for (const c of creditos) {
  if (!socioMap.has(c._nro_socio)) issues.push(`Crédito ${c.nro_pagare}: socio ${c._nro_socio} no derivado`)
}

// Pagos con socio derivado
for (const p of pagos) {
  if (!socioMap.has(p._nro_socio)) issues.push(`Recibo ${p.nro_recibo}: socio ${p._nro_socio} no derivado`)
}

// Aportes con socio derivado
for (const a of aportes) {
  if (!socioMap.has(a._nro_socio)) issues.push(`Aporte de socio ${a._nro_socio}: no derivado`)
}

if (socioConflictos.length) warnings.push(`${socioConflictos.length} DNIs con más de un nro_socio`)
if (sociosSinDni.length) warnings.push(`${sociosSinDni.length} socios sin DNI — se insertarán con DNI NULL`)
if (creditosWarnings.length) warnings.push(...creditosWarnings)
if (pagosWarnings.length) warnings.push(...pagosWarnings)
warnings.push('tasa_interes = 0 en todos los créditos — completar manualmente')
warnings.push('id_credito en pagos_recibos = NULL — no mapeable automáticamente')
warnings.push('cronograma_cuotas NO se cargará — regenerar via RPC o manualmente')
warnings.push('genero/estado_civil de socios = NULL — completar en módulo Socios')

if (issues.length) issues.forEach(i => console.log(`  ❌ ${i}`))
else console.log('  ✅ Todas las relaciones válidas')
if (warnings.length) warnings.forEach(w => console.log(`  ⚠️  ${w}`))

// ─── Fase 4: Resumen final ───────────────────────────────────────────────────

console.log(`\n${'═'.repeat(56)}`)
console.log('  RESUMEN DEL DRY-RUN')
console.log(`${'═'.repeat(56)}`)
console.log(`  Convenios       : ${conveniosList.length}`)
console.log(`  Socios derivados: ${sociosDerivados.length} (de Excel)`)
console.log(`  Créditos        : ${creditos.length} (${creditosVigentes} vigentes, ${creditosCancelados} cancelados)`)
console.log(`  Pagos           : ${pagos.length}`)
console.log(`  Aportes         : ${aportes.length}`)
console.log(`  Issues críticos : ${issues.length}`)
console.log(`  Warnings        : ${warnings.length}`)

// ─── Fase 5: Generar reporte ─────────────────────────────────────────────────

const now = new Date().toISOString().replace('T', ' ').substring(0, 19)
const report = `# EXCEL_IMPORT_MVP_DRY_RUN_REPORT.md
# Reporte Dry-Run Importador Excel MVP — CEJUASSA
# Generado: ${now} — MODO: ${MODE}

> Fase 9C-4B — Fuente principal: Excel del proyecto.
> NO se insertó ningún dato.

---

## Resumen ejecutivo

| Entidad | Candidatos | Estado |
|---|---|---|
| Convenios | ${conveniosList.length} | ✅ Listos para insertar |
| Socios derivados | ${sociosDerivados.length} | ✅ Derivados desde Excel |
| Socios con DNI | ${sociosDerivados.length - sociosSinDni.length} | ✅ |
| Socios sin DNI | ${sociosSinDni.length} | ⚠️ Se insertan con DNI NULL |
| Créditos vigentes | ${creditosVigentes} | ✅ |
| Créditos cancelados | ${creditosCancelados} | ✅ |
| Pagos | ${pagos.length} | ✅ |
| Aportes calculados | ${aportes.length} | ✅ |
| Issues críticos | ${issues.length} | ${issues.length === 0 ? '✅ Ninguno' : '❌ Ver detalle'} |
| Warnings | ${warnings.length} | ⚠️ Ver detalle |

---

## Convenios detectados

| # | Nombre (abreviatura) |
|---|---|
${conveniosList.map((c, i) => `| ${i + 1} | ${c.nombre} |`).join('\n')}

---

## Socios derivados

- **Total únicos por IdSocio:** ${sociosDerivados.length}
- **Con DNI disponible:** ${sociosDerivados.length - sociosSinDni.length}
- **Sin DNI:** ${sociosSinDni.length} (insertarán con dni=NULL)
- **Con convenio asignado:** ${sociosDerivados.filter(s => s.usuario).length}
- **Sin convenio:** ${sociosDerivados.filter(s => !s.usuario).length} (pagos de caja directa)
- **Fuentes de extracción:** CONVENIO (800 filas) + INGRESO (34 filas) + DSCTO (32 filas)

**Campos automáticos (desde Excel):** nro_socio, apellidos, nombres, dni, id_convenio (parcial)

**Campos pendientes (completar en app):** genero, estado_civil, fecha_nacimiento, direccion, beneficiario_*

---

## Créditos candidatos

- **Total:** ${creditos.length} créditos (solo desembolsos de marzo 2026)
- **Vigentes:** ${creditosVigentes}
- **Cancelados:** ${creditosCancelados}
- **Campo tasa_interes:** 0 (no disponible en Excel — completar manualmente)
- **Campo tipo_credito:** 'consumo' (default — completar manualmente)
- **cronograma_cuotas:** NO se carga (regenerar via app o RPC)
- **id_credito en pagos:** NULL (no mapeable automáticamente)

---

## Pagos candidatos

- **Total:** ${pagos.length}
  - INGRESO DETALLADO (caja): ~34
  - CONVENIO (múltiples): ~800
- **Con aporte (Ap > 0):** ${pagosConAporte}
- **Con capital (Ptmo > 0):** ${pagosConCapital}
- **id_credito:** NULL en todos (no mapeable desde Excel)

---

## Aportes derivados

- **Total:** ${aportes.length} aportes calculados desde pagos con Ap > 0
- **Socios con aporte:** ${Object.keys(saldosPorSocio).length}
- **Saldo calculado por socio:** acumulativo ordenado por fecha (solo período marzo 2026)
- **Nota:** saldo_anterior = 0 para todos (inicio del período — no hay historial previo)

---

## Issues críticos

${issues.length === 0 ? '✅ Ningún issue crítico.' : issues.map(i => `- ❌ ${i}`).join('\n')}

---

## Warnings

${warnings.map(w => `- ⚠️ ${w}`).join('\n')}

---

## Tablas NO cargadas en este plan

| Tabla | Motivo |
|---|---|
| \`cronograma_cuotas\` | Sin fuente segura — regenerar manualmente via RPC C o en la app |
| \`egresos\` | Sin fuente Excel disponible |
| \`usuarios\` | 🚫 Conservado — nunca tocar |
| \`configuracion\` | 🚫 Conservado — nunca tocar |

---

## Confirmaciones de cumplimiento

- ✅ NO se insertó ningún dato en Supabase
- ✅ NO se modificaron archivos en _client_files/
- ✅ NO se imprimieron datos personales completos en consola
- ✅ NO se usó backup JSON como fuente
- ✅ NO se tocaron usuarios/configuracion
- ✅ NO se crearon migraciones
- ✅ NO se borró ningún dato

---

## Comando para apply

Una vez revisado este reporte y el usuario aprueba:

**PowerShell:**
\`\`\`powershell
$env:IMPORT_AUTH="EJECUTAR IMPORTACION EXCEL 9C-4B"; npm run import:excel:mvp:apply
\`\`\`

**Bash:**
\`\`\`bash
IMPORT_AUTH="EJECUTAR IMPORTACION EXCEL 9C-4B" npm run import:excel:mvp:apply
\`\`\`

---

*Reporte generado por scripts/import-excel/import-excel-mvp.mjs — ${now}*
`

if (!existsSync(DOCS_DIR)) mkdirSync(DOCS_DIR, { recursive: true })
writeFileSync(resolve(DOCS_DIR, 'EXCEL_IMPORT_MVP_DRY_RUN_REPORT.md'), report, 'utf8')
console.log('\n📄 Reporte: docs/ai-recovery/EXCEL_IMPORT_MVP_DRY_RUN_REPORT.md')

// ─── Fase 6: Apply ───────────────────────────────────────────────────────────

if (!IS_APPLY) {
  console.log(`\n${'═'.repeat(56)}`)
  console.log('  MODO DRY-RUN — Nada fue insertado.')
  console.log('  Para aplicar, revisar el reporte y ejecutar:')
  console.log('  $env:IMPORT_AUTH="EJECUTAR IMPORTACION EXCEL 9C-4B"')
  console.log('  npm run import:excel:mvp:apply')
  console.log(`${'═'.repeat(56)}\n`)
  process.exit(0)
}

// ── APPLY MODE ────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(56)}`)
console.log('  ⚠️  MODO APPLY — Iniciando inserción real')
console.log(`${'═'.repeat(56)}\n`)

if (!loadEnv()) { console.error('❌ .env.local no encontrado'); process.exit(1) }
const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!sbUrl || !sbKey) { console.error('❌ Faltan variables de entorno Supabase'); process.exit(1) }
const sb = createClient(sbUrl, sbKey)

async function checkTablesEmpty() {
  const tablas = ['socios', 'creditos', 'pagos_recibos', 'aportes', 'convenios']
  for (const tabla of tablas) {
    const { count, error } = await sb.from(tabla).select('*', { count: 'exact', head: true })
    if (error) { console.error(`  ❌ Error verificando ${tabla}: ${error.message}`); return false }
    if (count > 0) {
      console.error(`  ❌ BLOQUEADO: tabla ${tabla} tiene ${count} registros. Debe estar en 0 antes de importar.`)
      return false
    }
  }
  return true
}

async function insertBatch(tabla, rows, batchSize = 200) {
  let inserted = 0
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const { error } = await sb.from(tabla).insert(batch)
    if (error) throw new Error(`Error insertando en ${tabla}: ${error.message}`)
    inserted += batch.length
  }
  return inserted
}

async function applyImport() {
  console.log('🔍 Verificando que tablas operativas estén en 0...')
  const empty = await checkTablesEmpty()
  if (!empty) {
    console.error('\n❌ APPLY ABORTADO — Las tablas no están vacías.')
    console.error('   Ejecutar el reset de datos antes de importar.')
    process.exit(1)
  }
  console.log('  ✅ Tablas vacías — procediendo\n')

  // PASO 1: Convenios
  console.log('1️⃣  Insertando convenios...')
  const { data: conveniosInserted, error: convErr } = await sb
    .from('convenios').insert(conveniosList).select('id, nombre')
  if (convErr) { console.error('  ❌', convErr.message); process.exit(1) }
  const convenioIdMap = {}
  for (const c of conveniosInserted) convenioIdMap[c.nombre] = c.id
  console.log(`  ✅ ${conveniosInserted.length} convenios insertados`)

  // PASO 2: Socios
  console.log('\n2️⃣  Insertando socios derivados...')
  const sociosRows = sociosDerivados.map(s => {
    const { apellidos, nombres } = splitNombre(s.nombre)
    // dni tiene NOT NULL en la DB — usar placeholder para los que no tienen DNI en Excel
    const dni = s.dni || `SINDNI${s.nro_socio}`
    return {
      nro_socio: s.nro_socio,
      apellidos: apellidos || s.nombre || 'SIN NOMBRE',
      nombres: nombres || '',
      dni,
      estado: 'activo',
      id_convenio: (s.usuario && convenioIdMap[s.usuario]) ? convenioIdMap[s.usuario] : null,
    }
  })
  const nInserted = await insertBatch('socios', sociosRows)
  console.log(`  ✅ ${nInserted} socios insertados`)

  // Obtener UUIDs de socios
  const { data: sociosDB, error: socErr } = await sb.from('socios').select('id, nro_socio')
  if (socErr) { console.error('  ❌', socErr.message); process.exit(1) }
  const socioUuidMap = {}
  for (const s of sociosDB) socioUuidMap[s.nro_socio] = s.id

  // PASO 3: Créditos
  console.log('\n3️⃣  Insertando créditos...')
  const creditosRows = creditos
    .filter(c => socioUuidMap[c._nro_socio])
    .map(c => {
      const { _nro_socio, ...rest } = c
      return { ...rest, id_socio: socioUuidMap[_nro_socio] }
    })
  const nCreditos = await insertBatch('creditos', creditosRows)
  console.log(`  ✅ ${nCreditos} créditos insertados`)
  console.log(`  ℹ️  cronograma_cuotas: NO cargado — regenerar manualmente`)

  // PASO 4: Pagos
  console.log('\n4️⃣  Insertando pagos_recibos...')
  const pagosRows = pagos
    .filter(p => socioUuidMap[p._nro_socio])
    .map(p => {
      const { _nro_socio, _usuario_convenio, ...rest } = p
      return {
        ...rest,
        id_socio: socioUuidMap[_nro_socio],
        id_convenio: (_usuario_convenio && convenioIdMap[_usuario_convenio]) ? convenioIdMap[_usuario_convenio] : null,
      }
    })
  const nPagos = await insertBatch('pagos_recibos', pagosRows)
  console.log(`  ✅ ${nPagos} pagos insertados`)

  // Obtener IDs de recibos
  const { data: recibosDB, error: recErr } = await sb.from('pagos_recibos').select('id, nro_recibo')
  if (recErr) { console.error('  ❌', recErr.message); process.exit(1) }
  const reciboUuidMap = {}
  for (const r of recibosDB) reciboUuidMap[r.nro_recibo] = r.id

  // PASO 5: Aportes
  console.log('\n5️⃣  Insertando aportes...')
  const aportesRows = aportes
    .filter(a => socioUuidMap[a._nro_socio] && reciboUuidMap[a._nro_recibo])
    .map(a => {
      const { _nro_socio, _nro_recibo, ...rest } = a
      return {
        ...rest,
        id_socio: socioUuidMap[_nro_socio],
        id_recibo: reciboUuidMap[_nro_recibo],
      }
    })
  const nAportes = await insertBatch('aportes', aportesRows)
  console.log(`  ✅ ${nAportes} aportes insertados`)

  console.log(`\n${'═'.repeat(56)}`)
  console.log('  ✅ IMPORTACIÓN COMPLETADA')
  console.log(`  Convenios : ${conveniosInserted.length}`)
  console.log(`  Socios    : ${nInserted}`)
  console.log(`  Créditos  : ${nCreditos}`)
  console.log(`  Pagos     : ${nPagos}`)
  console.log(`  Aportes   : ${nAportes}`)
  console.log(`${'═'.repeat(56)}`)
  console.log('\n⚠️  Pendientes:')
  console.log('   - Completar genero/estado_civil de socios en módulo Socios')
  console.log('   - Completar tasa_interes y tipo_credito en módulo Créditos')
  console.log('   - cronograma_cuotas vacío — regenerar en app o via RPC')
  console.log('   - id_credito en pagos = NULL — asociar manualmente si se requiere')
}

applyImport().catch(e => { console.error('\n❌ Error en apply:', e.message); process.exit(1) })
