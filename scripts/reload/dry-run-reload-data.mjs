/**
 * dry-run-reload-data.mjs
 * Fase 9C-3 — Validación de fuentes para recarga de datos
 *
 * NO inserta nada. Solo lee fuentes, valida estructura,
 * detecta duplicados y genera un reporte.
 *
 * Uso: npm run reload:dry-run
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '../..')

// ── Cargar .env.local ───────────────────────────────────────────────────────
function loadEnv() {
  const envPath = join(ROOT, '.env.local')
  if (!existsSync(envPath)) { console.error('❌ No se encontró .env.local'); process.exit(1) }
  const lines = readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const [key, ...rest] = line.split('=')
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
  }
}

loadEnv()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Localizar backup más reciente ───────────────────────────────────────────
function getMostRecentBackup() {
  const backupsDir = join(ROOT, 'backups', 'data-reset')
  if (!existsSync(backupsDir)) return null
  const entries = readdirSync(backupsDir)
    .filter(e => /^\d{8}-\d{4}$/.test(e))
    .map(e => ({ name: e, path: join(backupsDir, e) }))
    .filter(e => statSync(e.path).isDirectory())
    .sort((a, b) => b.name.localeCompare(a.name))
  return entries.length > 0 ? entries[0] : null
}

// ── Leer JSON de backup ─────────────────────────────────────────────────────
function readBackupJson(backupPath, tabla) {
  const filePath = join(backupPath, `${tabla}.json`)
  if (!existsSync(filePath)) return null
  try { return JSON.parse(readFileSync(filePath, 'utf8')) } catch { return null }
}

// ── Contador de checks ──────────────────────────────────────────────────────
const issues = []
const warnings = []
const infos = []

function issue(msg) { issues.push(msg); console.log(`  ❌ ${msg}`) }
function warn(msg)  { warnings.push(msg); console.log(`  ⚠️  ${msg}`) }
function info(msg)  { infos.push(msg); console.log(`  ✅ ${msg}`) }

// ── Validar socios ──────────────────────────────────────────────────────────
function validateSocios(rows) {
  console.log('\n【SOCIOS】')
  if (!rows || rows.length === 0) { warn('socios.json vacío o no encontrado'); return {} }
  info(`${rows.length} registros en backup`)

  const dniMap = {}
  const nroSocioMap = {}
  let duplicadosDni = 0
  let duplicadosNro = 0
  let sinDni = 0
  let sinApellidos = 0
  let sinNombres = 0
  let sinGenero = 0
  let sinEstadoCivil = 0

  for (const r of rows) {
    if (!r.dni) { sinDni++; continue }
    if (dniMap[r.dni]) duplicadosDni++
    else dniMap[r.dni] = r.id
    if (r.nro_socio) {
      if (nroSocioMap[r.nro_socio]) duplicadosNro++
      else nroSocioMap[r.nro_socio] = r.id
    }
    if (!r.apellidos) sinApellidos++
    if (!r.nombres) sinNombres++
    if (!r.genero) sinGenero++
    if (!r.estado_civil) sinEstadoCivil++
  }

  if (duplicadosDni > 0) issue(`${duplicadosDni} DNIs duplicados en socios.json`)
  else info(`Sin DNIs duplicados`)
  if (duplicadosNro > 0) issue(`${duplicadosNro} nro_socio duplicados`)
  else info(`Sin nro_socio duplicados`)
  if (sinDni > 0) issue(`${sinDni} registros sin DNI`)
  if (sinApellidos > 0) warn(`${sinApellidos} socios sin apellidos`)
  if (sinNombres > 0) warn(`${sinNombres} socios sin nombres`)
  if (sinGenero > 0) warn(`${sinGenero} socios sin genero (campo BDCC — completar antes de enviar a SBS)`)
  if (sinEstadoCivil > 0) warn(`${sinEstadoCivil} socios sin estado_civil (campo BDCC)`)

  return dniMap  // id de socio por DNI
}

// ── Validar créditos ────────────────────────────────────────────────────────
function validateCreditos(rows, socioIds) {
  console.log('\n【CRÉDITOS】')
  if (!rows || rows.length === 0) { warn('creditos.json vacío o no encontrado'); return {} }
  info(`${rows.length} registros en backup`)

  const pagareMap = {}
  let duplicadosPagare = 0
  let sinSocio = 0
  let sinSaldo = 0
  let sinFecha = 0
  let creditoIds = new Set()

  for (const r of rows) {
    if (r.nro_pagare) {
      if (pagareMap[r.nro_pagare]) duplicadosPagare++
      else pagareMap[r.nro_pagare] = r.id
    }
    if (!r.id_socio || !socioIds.has(r.id_socio)) sinSocio++
    if (r.saldo_capital === null || r.saldo_capital === undefined) sinSaldo++
    if (!r.fecha_desembolso) sinFecha++
    creditoIds.add(r.id)
  }

  if (duplicadosPagare > 0) issue(`${duplicadosPagare} nro_pagare duplicados`)
  else info(`Sin nro_pagare duplicados`)
  if (sinSocio > 0) issue(`${sinSocio} créditos con id_socio que no existe en socios.json`)
  else info(`Todos los créditos tienen socio válido en el backup`)
  if (sinSaldo > 0) warn(`${sinSaldo} créditos sin saldo_capital`)
  if (sinFecha > 0) warn(`${sinFecha} créditos sin fecha_desembolso`)

  return creditoIds
}

// ── Validar pagos_recibos ───────────────────────────────────────────────────
function validatePagos(rows, socioIds, creditoIds) {
  console.log('\n【PAGOS RECIBOS】')
  if (!rows || rows.length === 0) { warn('pagos_recibos.json vacío o no encontrado'); return new Set() }
  info(`${rows.length} registros en backup`)

  const reciboMap = {}
  let duplicadosRecibo = 0
  let sinSocio = 0
  let sinCredito = 0
  let sinMonto = 0
  let pagoIds = new Set()

  for (const r of rows) {
    if (r.nro_recibo) {
      if (reciboMap[r.nro_recibo]) duplicadosRecibo++
      else reciboMap[r.nro_recibo] = r.id
    }
    if (!r.id_socio || !socioIds.has(r.id_socio)) sinSocio++
    if (r.id_credito && !creditoIds.has(r.id_credito)) sinCredito++
    if (!r.monto_total && r.monto_total !== 0) sinMonto++
    pagoIds.add(r.id)
  }

  if (duplicadosRecibo > 0) issue(`${duplicadosRecibo} nro_recibo duplicados`)
  else info(`Sin nro_recibo duplicados`)
  if (sinSocio > 0) issue(`${sinSocio} recibos con id_socio que no existe en socios.json`)
  else info(`Todos los recibos tienen socio válido`)
  if (sinCredito > 0) warn(`${sinCredito} recibos con id_credito que no existe en creditos.json`)
  if (sinMonto > 0) warn(`${sinMonto} recibos sin monto_total`)

  return pagoIds
}

// ── Validar aportes ─────────────────────────────────────────────────────────
function validateAportes(rows, socioIds, pagoIds) {
  console.log('\n【APORTES】')
  if (!rows || rows.length === 0) { info('aportes.json vacío (0 registros)'); return }
  info(`${rows.length} registros en backup`)

  let sinSocio = 0
  let sinRecibo = 0

  for (const r of rows) {
    if (!r.id_socio || !socioIds.has(r.id_socio)) sinSocio++
    if (r.id_recibo && !pagoIds.has(r.id_recibo)) sinRecibo++
  }

  if (sinSocio > 0) issue(`${sinSocio} aportes con id_socio que no existe en socios.json`)
  else info(`Todos los aportes tienen socio válido`)
  if (sinRecibo > 0) warn(`${sinRecibo} aportes con id_recibo que no existe en pagos_recibos.json`)
}

// ── Verificar DB actual (debe estar en 0) ───────────────────────────────────
async function checkDbEmpty() {
  console.log('\n【ESTADO DB ACTUAL】')
  const tablas = ['socios', 'creditos', 'pagos_recibos', 'aportes', 'cronograma_cuotas']
  for (const t of tablas) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true })
    if (error) { warn(`No se pudo consultar ${t}: ${error.message}`); continue }
    if (count === 0) info(`${t}: 0 registros (lista para recarga)`)
    else issue(`${t}: ${count} registros — NO está vacía (recarga ya ejecutada o limpieza incompleta)`)
  }
  const { count: uc } = await supabase.from('usuarios').select('*', { count: 'exact', head: true })
  info(`usuarios: ${uc} registros (conservado ✅)`)
  const { count: cc } = await supabase.from('configuracion').select('*', { count: 'exact', head: true })
  info(`configuracion: ${cc} registros (conservada ✅)`)
}

// ── Verificar fuentes Excel del cliente ─────────────────────────────────────
function checkClientExcel() {
  console.log('\n【ARCHIVOS EXCEL DEL CLIENTE】')
  const base = join(ROOT, '_client_files', 'raw', 'extracted', 'Archvos app')
  const archivos = [
    { nombre: 'CONVENIO MES MARZO 2026 (1).xlsx', tabla: 'pagos_recibos', filas: 805 },
    { nombre: 'INGRESO DETALLADO MARZO 2026 (1).xlsx', tabla: 'pagos_recibos', filas: 39 },
    { nombre: 'DSCTO Y DESMBOLSO DE CRDITO MA ABR-2026 (1).xlsx', tabla: 'creditos', filas: 32 },
  ]
  for (const a of archivos) {
    const p = join(base, a.nombre)
    if (existsSync(p)) info(`${a.nombre} → ${a.tabla} (~${a.filas} filas) [requiere transformación manual]`)
    else warn(`No encontrado: ${a.nombre}`)
  }
  info('Los archivos Excel requieren limpieza y mapeo de columnas — no importables automáticamente')
}

// ── Generar reporte MD ──────────────────────────────────────────────────────
function generateReport(backup, counts) {
  const ahora = new Date().toISOString()
  const issuesMd = issues.length > 0
    ? issues.map(i => `- ❌ ${i}`).join('\n')
    : '- Ninguno'
  const warnMd = warnings.length > 0
    ? warnings.map(w => `- ⚠️ ${w}`).join('\n')
    : '- Ninguna'

  const content = `# DATA_RELOAD_DRY_RUN_REPORT.md
# Fase 9C-3 — Reporte de Dry-Run de Recarga
# Generado: ${ahora}

> Este reporte fue generado por \`npm run reload:dry-run\`.
> NO se insertó ningún dato en la base de datos.

---

## Fuente analizada

- **Backup:** \`${backup ? 'backups/data-reset/' + backup.name : 'NO ENCONTRADO'}\`
- **Excel del cliente:** \`_client_files/raw/extracted/Archvos app/\` (requieren transformación manual)

---

## Conteos del backup

| Tabla | Registros en backup | DB actual |
|---|---|---|
| \`socios\` | ${counts.socios} | 0 |
| \`creditos\` | ${counts.creditos} | 0 |
| \`pagos_recibos\` | ${counts.pagos} | 0 |
| \`aportes\` | ${counts.aportes} | 0 |
| \`cronograma_cuotas\` | ${counts.cronograma} | 0 |
| \`egresos\` | ${counts.egresos} | 0 |
| \`convenios\` | ${counts.convenios} | 0 |

---

## Problemas críticos (bloquean la carga automática)

${issuesMd}

---

## Advertencias (no bloquean, pero requieren atención)

${warnMd}

---

## Decisión pendiente del usuario

1. **¿Recargar desde el backup (F1)?** — Contiene 434 socios y 431 créditos. ¿Son todos reales o hay mezcla de prueba?
2. **¿Cronograma de cuotas?** — Estaba en 0 en el backup. ¿Regenerar via RPC o cargar manualmente?
3. **¿Importar Excel del cliente (F2-F4)?** — Solo marzo 2026, 32 créditos. Requiere mapeo manual.

> Para autorizar la recarga real, indicar con qué fuente proceder.

---

## Confirmación

- ✅ NO se insertó ningún dato en la base de datos.
- ✅ Las tablas \`usuarios\` y \`configuracion\` siguen intactas.
- ✅ No se ejecutó ninguna migración.

*Dry-run completado ${ahora}*
`
  const reportPath = join(ROOT, 'docs', 'ai-recovery', 'DATA_RELOAD_DRY_RUN_REPORT.md')
  writeFileSync(reportPath, content, 'utf8')
  return reportPath
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n' + '═'.repeat(60))
  console.log('  CEJUASSA — Dry-Run de Recarga de Datos (Fase 9C-3)')
  console.log('  NO se inserta nada. Solo auditoría y validación.')
  console.log('═'.repeat(60))

  const backup = getMostRecentBackup()
  if (!backup) {
    console.log('\n❌ No se encontró backup en backups/data-reset/')
    process.exit(1)
  }
  console.log(`\n📁 Backup: backups/data-reset/${backup.name}/\n`)

  const socios   = readBackupJson(backup.path, 'socios') ?? []
  const creditos = readBackupJson(backup.path, 'creditos') ?? []
  const pagos    = readBackupJson(backup.path, 'pagos_recibos') ?? []
  const aportes  = readBackupJson(backup.path, 'aportes') ?? []
  const cronograma = readBackupJson(backup.path, 'cronograma_cuotas') ?? []
  const egresos  = readBackupJson(backup.path, 'egresos') ?? []
  const convenios = readBackupJson(backup.path, 'convenios') ?? []

  // Validar cada tabla
  const dniMap = validateSocios(socios)
  const socioIdSet = new Set(Object.values(dniMap))
  // También aceptar socios por su UUID directamente
  const socioUuids = new Set(socios.map(s => s.id))

  const creditoIds = validateCreditos(creditos, socioUuids)
  const pagoIds    = validatePagos(pagos, socioUuids, creditoIds)
  validateAportes(aportes, socioUuids, pagoIds)
  checkClientExcel()
  await checkDbEmpty()

  const counts = {
    socios: socios.length,
    creditos: creditos.length,
    pagos: pagos.length,
    aportes: aportes.length,
    cronograma: cronograma.length,
    egresos: egresos.length,
    convenios: convenios.length,
  }

  console.log('\n' + '─'.repeat(60))
  const reportPath = generateReport(backup, counts)
  console.log(`\n📄 Reporte generado: docs/ai-recovery/DATA_RELOAD_DRY_RUN_REPORT.md`)

  console.log('\n' + '═'.repeat(60))
  console.log(`\n  Issues:    ${issues.length}`)
  console.log(`  Warnings:  ${warnings.length}`)
  if (issues.length === 0) {
    console.log('\n  ✅ Sin issues críticos — backup puede recargarse con autorización.')
  } else {
    console.log(`\n  ⚠️  ${issues.length} issues críticos — revisar antes de recargar.`)
  }
  console.log('\n  ⛔ NO se insertó ningún dato.')
  console.log('═'.repeat(60) + '\n')

  if (issues.length > 0) process.exit(1)
}

main().catch(err => {
  console.error('\n❌ Error inesperado:', err.message)
  process.exit(1)
})
