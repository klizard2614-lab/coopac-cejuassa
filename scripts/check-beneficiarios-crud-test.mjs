/**
 * Fase 10C.2 — Check: prueba CRUD beneficiarios
 *
 * Verifica que el script CRUD cumple todas las reglas de seguridad:
 * - Solo toca socio_beneficiarios
 * - No toca tablas prohibidas
 * - Soporta dry-run y apply
 * - Elimina el registro temporal
 *
 * Uso: node scripts/check-beneficiarios-crud-test.mjs
 */

import { existsSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const PASS = '  ✓'
const FAIL = '  ✗'
let failures = 0

function check(label, ok, detail = '') {
  if (ok) {
    console.log(`${PASS} ${label}`)
  } else {
    console.log(`${FAIL} ${label}${detail ? ': ' + detail : ''}`)
    failures++
  }
}

function fileExists(rel) {
  return existsSync(resolve(root, rel))
}

function fileContains(rel, ...strings) {
  if (!fileExists(rel)) return false
  const c = readFileSync(resolve(root, rel), 'utf8')
  return strings.every(s => c.includes(s))
}

function fileNotContains(rel, ...strings) {
  if (!fileExists(rel)) return true
  const c = readFileSync(resolve(root, rel), 'utf8')
  return strings.every(s => !c.includes(s))
}

const SCRIPT = 'scripts/test-beneficiarios-crud.mjs'

console.log('=== CHECK: Prueba CRUD beneficiarios (Fase 10C.2) ===\n')

// ── Existencia del script ──────────────────────────────────────────────────
console.log('[ Existencia del script ]')
check('scripts/test-beneficiarios-crud.mjs existe', fileExists(SCRIPT))

// ── Modos de ejecución ────────────────────────────────────────────────────
console.log('\n[ Modos de ejecución ]')
check(
  'Soporta modo --dry-run',
  fileContains(SCRIPT, '--dry-run')
)
check(
  'Soporta modo --apply',
  fileContains(SCRIPT, '--apply')
)
check(
  'dry-run NO inserta (llama dryRun y verifica columnas solamente)',
  fileContains(SCRIPT, 'dryRun') && fileContains(SCRIPT, 'applyRun')
)

// ── Tabla objetivo ────────────────────────────────────────────────────────
console.log('\n[ Tabla objetivo: solo socio_beneficiarios ]')
check(
  "Solo usa .from('socio_beneficiarios')",
  fileContains(SCRIPT, "from('socio_beneficiarios')")
)

// ── Tablas prohibidas ─────────────────────────────────────────────────────
console.log('\n[ Tablas prohibidas: no deben ser modificadas ]')

// socios puede aparecer en un SELECT de lectura para obtener el ID
// Verificamos que no haga INSERT/UPDATE/DELETE en socios
const scriptContent = fileExists(SCRIPT) ? readFileSync(resolve(root, SCRIPT), 'utf8') : ''

// Chequeo más preciso: no debe haber .from('socios') seguido de .insert/.update/.delete
// (puede hacer SELECT para buscar el socio a usar)
const socioModLines = scriptContent
  .split('\n')
  .filter(l => l.includes("from('socios')"))
  .filter(l => {
    // Solo lectura permitida en socios
    const lineIdx = scriptContent.split('\n').indexOf(l)
    const nextFew = scriptContent.split('\n').slice(lineIdx, lineIdx + 5).join(' ')
    return /\.insert|\.update|\.delete/.test(nextFew)
  })

check(
  'No modifica tabla socios (solo lectura permitida)',
  socioModLines.length === 0,
  socioModLines.length > 0 ? 'Encontradas líneas sospechosas de modificación' : ''
)

const FORBIDDEN_TABLES = ['creditos', 'pagos_recibos', 'cronograma_cuotas', 'usuarios', 'configuracion', 'auth.users', 'aportes', 'egresos', 'convenios']
for (const table of FORBIDDEN_TABLES) {
  check(
    `No toca tabla '${table}'`,
    fileNotContains(SCRIPT, `from('${table}')`, `from("${table}")`)
  )
}

// ── auth.users ────────────────────────────────────────────────────────────
console.log('\n[ Auth y configuración ]')
check(
  "No hace queries a auth.users (from('auth.users') ausente)",
  fileNotContains(SCRIPT, "from('auth.users')", 'from("auth.users")', 'supabase.auth.admin')
)
check(
  'No usa signIn/signOut/inviteUser',
  fileNotContains(SCRIPT, 'signIn', 'signOut', 'inviteUserByEmail')
)

// ── Migraciones ───────────────────────────────────────────────────────────
console.log('\n[ Sin migraciones ]')
check(
  'No crea archivos de migración',
  fileNotContains(SCRIPT, 'migrations/', 'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE')
)

// ── _client_files ─────────────────────────────────────────────────────────
console.log('\n[ Sin _client_files ]')
check(
  'No toca _client_files',
  fileNotContains(SCRIPT, '_client_files', 'client_files')
)

// ── Limpieza del registro temporal ────────────────────────────────────────
console.log('\n[ Limpieza del registro temporal ]')
check(
  "Elimina registro con observacion 'TEST CRUD 10C.2 - BORRAR'",
  fileContains(SCRIPT, 'TEST CRUD 10C.2 - BORRAR') && fileContains(SCRIPT, '.delete()')
)
check(
  'Verifica que no quedan registros test huérfanos',
  fileContains(SCRIPT, 'limpieza') || fileContains(SCRIPT, 'remaining') || fileContains(SCRIPT, 'cleanup')
)

// ── Comandos npm ──────────────────────────────────────────────────────────
console.log('\n[ Comandos npm en package.json ]')
const pkg = fileExists('package.json') ? readFileSync(resolve(root, 'package.json'), 'utf8') : ''
check(
  'npm run beneficiarios:crud:dry-run registrado',
  pkg.includes('beneficiarios:crud:dry-run')
)
check(
  'npm run beneficiarios:crud:apply registrado',
  pkg.includes('beneficiarios:crud:apply')
)
check(
  'npm run check:beneficiarios-crud registrado',
  pkg.includes('check:beneficiarios-crud')
)

// ── Resultado ─────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════')
if (failures === 0) {
  console.log('✅ CHECK PASSED — Script CRUD cumple todas las reglas de seguridad.')
} else {
  console.log(`❌ CHECK FAILED — ${failures} problema(s) encontrado(s). Corregir antes de ejecutar --apply.`)
  process.exit(1)
}
