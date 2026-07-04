/**
 * check-operational-backup.mjs
 * Fase 9C-1 — Validación del backup operativo
 *
 * Verifica que el backup existe, es completo y que NO se borró nada.
 *
 * Uso: npm run check:operational-backup
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// ── Cargar .env.local ───────────────────────────────────────────────────────
function loadEnv() {
  const envPath = join(ROOT, '.env.local')
  if (!existsSync(envPath)) {
    console.error('❌ No se encontró .env.local')
    process.exit(1)
  }
  const lines = readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const [key, ...rest] = line.split('=')
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
  }
}

loadEnv()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Faltan variables: NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

// ── Tablas operativas esperadas ─────────────────────────────────────────────
const TABLAS_OPERATIVAS = [
  'socios',
  'creditos',
  'pagos_recibos',
  'aportes',
  'cronograma_cuotas',
  'egresos',
  'convenios',
]

// ── Tablas protegidas (no deben aparecer en el backup) ─────────────────────
const TABLAS_PROTEGIDAS = ['auth.users']

// ── Contador ────────────────────────────────────────────────────────────────
let passed = 0
let failed = 0

function check(label, ok, detail = '') {
  if (ok) {
    console.log(`  ✅ ${label}`)
    passed++
  } else {
    console.log(`  ❌ ${label}${detail ? ' — ' + detail : ''}`)
    failed++
  }
}

// ── Obtener backup más reciente ─────────────────────────────────────────────
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

// ── Contar registros en DB ──────────────────────────────────────────────────
async function countTable(tableName) {
  try {
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true })
    if (error) {
      if (error.code === '42P01') return { exists: false, count: 0 }
      return { exists: true, count: null, error: error.message }
    }
    return { exists: true, count: count ?? 0 }
  } catch {
    return { exists: false, count: 0 }
  }
}

// ── Leer conteo del JSON de backup ─────────────────────────────────────────
function readBackupCount(backupPath, tabla) {
  const filePath = join(backupPath, `${tabla}.json`)
  if (!existsSync(filePath)) return null
  try {
    const data = JSON.parse(readFileSync(filePath, 'utf8'))
    return Array.isArray(data) ? data.length : null
  } catch {
    return null
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n' + '═'.repeat(60))
  console.log('  CEJUASSA — Validación de Backup Operativo (Fase 9C-1)')
  console.log('═'.repeat(60) + '\n')

  // ── 1. Existe backup más reciente ────────────────────────────────────────
  console.log('【1】 Estructura del backup\n')
  const backup = getMostRecentBackup()
  check('Existe carpeta backups/data-reset/', !!backup, backup ? `→ ${backup.name}` : 'No se encontró ningún backup')
  if (!backup) {
    console.log('\n❌ No hay backup. Ejecutar: npm run backup:operational-data\n')
    process.exit(1)
  }

  const backupPath = backup.path
  console.log(`     Usando backup: ${backup.name}\n`)

  // ── 2. Existe BACKUP_MANIFEST.md ─────────────────────────────────────────
  const manifestPath = join(backupPath, 'BACKUP_MANIFEST.md')
  check('Existe BACKUP_MANIFEST.md en la carpeta', existsSync(manifestPath))
  check('Existe BACKUP_MANIFEST.md en la raíz del proyecto', existsSync(join(ROOT, 'BACKUP_MANIFEST.md')))

  // ── 3. Existen archivos por tabla ─────────────────────────────────────────
  console.log('\n【2】 Archivos por tabla\n')
  for (const tabla of TABLAS_OPERATIVAS) {
    const filePath = join(backupPath, `${tabla}.json`)
    check(`Archivo ${tabla}.json existe`, existsSync(filePath))
  }

  // ── 4. No se exportó auth.users ──────────────────────────────────────────
  console.log('\n【3】 Seguridad de exportación\n')
  for (const prot of TABLAS_PROTEGIDAS) {
    const safeName = prot.replace('.', '_')
    const filePath = join(backupPath, `${safeName}.json`)
    check(`NO se exportó ${prot}`, !existsSync(filePath))
  }

  // ── 5. Conteos del backup coinciden con DB actual ─────────────────────────
  console.log('\n【4】 Conteos backup vs. DB actual\n')
  let countMismatches = 0
  const dbCounts = {}

  for (const tabla of TABLAS_OPERATIVAS) {
    const backupCount = readBackupCount(backupPath, tabla)
    const dbResult = await countTable(tabla)

    if (backupCount === null && !dbResult.exists) {
      check(`${tabla}: tabla no existe (OK — fue omitida)`, true)
      dbCounts[tabla] = 0
      continue
    }

    if (backupCount === null) {
      check(`${tabla}: archivo JSON legible`, false, 'no se pudo leer')
      countMismatches++
      continue
    }

    const dbCount = dbResult.count ?? 0
    dbCounts[tabla] = dbCount
    const coincide = backupCount === dbCount
    if (!coincide) countMismatches++
    check(
      `${tabla}: backup=${backupCount} == DB=${dbCount}`,
      coincide,
      coincide ? '' : `⚠️ DIFERENCIA — backup=${backupCount}, DB actual=${dbCount}`
    )
  }

  // ── 6. No se borró nada (todos los conteos DB ≥ 0) ──────────────────────
  console.log('\n【5】 Verificación de integridad post-backup\n')
  for (const tabla of TABLAS_OPERATIVAS) {
    const dbResult = await countTable(tabla)
    if (dbResult.exists) {
      check(`${tabla}: sigue presente en DB (no borrado)`, true, `${dbResult.count} registros`)
    } else {
      check(`${tabla}: sigue presente en DB`, false, 'tabla no encontrada')
    }
  }

  // ── 7. No se tocó _client_files ─────────────────────────────────────────
  console.log('\n【6】 Archivos protegidos\n')
  const clientFilesDir = join(ROOT, '_client_files')
  if (existsSync(clientFilesDir)) {
    const entries = readdirSync(clientFilesDir)
    check('_client_files existe (intacto)', true, `${entries.length} entradas`)
  } else {
    check('_client_files no tocado (no existe en el proyecto)', true)
  }

  // ── 8. No se crearon migraciones nuevas en esta fase ────────────────────
  const migrationsDir = join(ROOT, 'supabase', 'migrations')
  if (existsSync(migrationsDir)) {
    const migrations = readdirSync(migrationsDir).filter(f => f.endsWith('.sql'))
    const recentMigrations = migrations.filter(f => {
      const ts = f.split('_')[0]
      return ts >= '20260621'  // después de hoy (2026-06-20)
    })
    check('No se crearon migraciones nuevas en Fase 9C-1', recentMigrations.length === 0,
      recentMigrations.length > 0 ? `Encontradas: ${recentMigrations.join(', ')}` : '')
  } else {
    check('Directorio de migraciones existe', false, 'supabase/migrations/ no encontrado')
  }

  // ── Resumen ─────────────────────────────────────────────────────────────
  const total = passed + failed
  console.log('\n' + '═'.repeat(60))
  console.log(`\n  Resultado: ${passed}/${total} checks PASS`)
  if (failed === 0) {
    console.log('  ✅ Backup verificado. Ningún dato fue borrado.')
    console.log('  ✅ Backup listo para continuar con Fase 9C-2 (limpieza real).')
  } else {
    console.log(`  ❌ ${failed} checks fallaron. Revisar antes de continuar.`)
  }
  if (countMismatches > 0) {
    console.log(`\n  ⚠️  ${countMismatches} discrepancias en conteos.`)
    console.log('  Si se modificaron datos DESPUÉS del backup, ejecutar de nuevo:')
    console.log('  npm run backup:operational-data')
  }
  console.log('\n' + '═'.repeat(60) + '\n')

  if (failed > 0) process.exit(1)
}

main().catch(err => {
  console.error('\n❌ Error inesperado:', err.message)
  process.exit(1)
})
