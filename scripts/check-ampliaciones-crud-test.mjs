/**
 * Fase 10D-1A — Check: prueba CRUD ampliaciones
 *
 * Verifica que el script CRUD cumple todas las reglas de seguridad:
 * - Solo toca ampliaciones (lectura en creditos permitida para selección)
 * - No modifica tablas prohibidas
 * - Soporta dry-run y apply
 * - Elimina el registro temporal
 *
 * Uso: node scripts/check-ampliaciones-crud-test.mjs
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

function readFile(rel) {
  if (!fileExists(rel)) return ''
  return readFileSync(resolve(root, rel), 'utf8')
}

function fileContains(rel, ...strings) {
  const c = readFile(rel)
  return strings.every(s => c.includes(s))
}

function fileNotContains(rel, ...strings) {
  if (!fileExists(rel)) return true
  const c = readFile(rel)
  return strings.every(s => !c.includes(s))
}

const SCRIPT = 'scripts/test-ampliaciones-crud.mjs'

console.log('=== CHECK: Prueba CRUD ampliaciones (Fase 10D-1A) ===\n')

// ── Existencia del script ──────────────────────────────────────────────────
console.log('[ Existencia del script ]')
check('scripts/test-ampliaciones-crud.mjs existe', fileExists(SCRIPT))

// ── Modos de ejecución ────────────────────────────────────────────────────
console.log('\n[ Modos de ejecución ]')
check('Soporta modo --dry-run', fileContains(SCRIPT, '--dry-run'))
check('Soporta modo --apply',   fileContains(SCRIPT, '--apply'))
check(
  'dry-run y apply definidos como funciones',
  fileContains(SCRIPT, 'dryRun') && fileContains(SCRIPT, 'applyRun')
)

// ── Tabla objetivo ────────────────────────────────────────────────────────
console.log("\n[ Tabla objetivo: solo ampliaciones (lectura en creditos permitida) ]")
check(
  "Usa .from('ampliaciones')",
  fileContains(SCRIPT, "from('ampliaciones')")
)

// ── Verificar que no modifica creditos ───────────────────────────────────
console.log('\n[ Creditos: solo lectura permitida para selección ]')
const scriptContent = readFile(SCRIPT)

// Busca líneas que referencian creditos y verifica que no hay insert/update/delete
const creditoLines = scriptContent.split('\n').filter(l => l.includes("from('creditos')"))
const creditoModifications = creditoLines.filter(l => {
  const idx = scriptContent.split('\n').indexOf(l)
  const nextFew = scriptContent.split('\n').slice(idx, idx + 5).join(' ')
  return /\.insert|\.update|\.delete/.test(nextFew)
})

check(
  'No modifica tabla creditos (solo SELECT permitido para selección de crédito)',
  creditoModifications.length === 0,
  creditoModifications.length > 0 ? 'Modificación detectada en creditos' : ''
)

// ── Tablas prohibidas ─────────────────────────────────────────────────────
console.log('\n[ Tablas prohibidas: no deben ser accedidas ]')
const FORBIDDEN_TABLES = [
  'cronograma_cuotas',
  'pagos_recibos',
  'socios',
  'usuarios',
  'configuracion',
  'aportes',
  'egresos',
  'convenios',
]
for (const table of FORBIDDEN_TABLES) {
  check(
    `No toca tabla '${table}'`,
    fileNotContains(SCRIPT, `from('${table}')`, `from("${table}")`)
  )
}

// ── auth.users ────────────────────────────────────────────────────────────
console.log('\n[ Auth y configuración ]')
check(
  "No hace queries a auth.users",
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
  'No hace queries a _client_files',
  fileNotContains(SCRIPT, "from('_client_files')", 'from("_client_files")', "from('client_files')", 'from("client_files")')
)

// ── Limpieza del registro temporal ────────────────────────────────────────
console.log('\n[ Limpieza del registro temporal ]')
check(
  "Usa nro_pagare_nuevo=TEST_PAGARE_10D_1A como marca del test",
  fileContains(SCRIPT, 'TEST_PAGARE_10D_1A')
)
check(
  "Usa observacion con marca 'TEST CRUD AMPLIACIONES 10D-1A'",
  fileContains(SCRIPT, 'TEST CRUD AMPLIACIONES 10D-1A')
)
check(
  'Elimina el registro temporal (.delete() presente)',
  fileContains(SCRIPT, '.delete()')
)
check(
  'Verifica que no quedan registros test huérfanos',
  fileContains(SCRIPT, 'remaining') || fileContains(SCRIPT, 'cleanup') || fileContains(SCRIPT, 'limpieza')
)

// ── Comandos npm ──────────────────────────────────────────────────────────
console.log('\n[ Comandos npm en package.json ]')
const pkg = readFile('package.json')
check('npm run ampliaciones:crud:dry-run registrado', pkg.includes('ampliaciones:crud:dry-run'))
check('npm run ampliaciones:crud:apply registrado',   pkg.includes('ampliaciones:crud:apply'))
check('npm run check:ampliaciones-crud registrado',   pkg.includes('check:ampliaciones-crud'))

// ── Reporte ───────────────────────────────────────────────────────────────
console.log('\n[ Reporte markdown ]')
check(
  'docs/ai-recovery/AMPLIACIONES_CRUD_TEST_REPORT.md existe',
  fileExists('docs/ai-recovery/AMPLIACIONES_CRUD_TEST_REPORT.md')
)

// ── Resultado ─────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════')
if (failures === 0) {
  console.log('✅ CHECK PASSED — Script CRUD cumple todas las reglas de seguridad.')
} else {
  console.log(`❌ CHECK FAILED — ${failures} problema(s) encontrado(s). Corregir antes de ejecutar --apply.`)
  process.exit(1)
}
