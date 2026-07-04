/**
 * check-data-reset-plan.mjs
 * Fase 9C-0 — Validación del plan de limpieza de datos
 *
 * Verifica que todos los archivos del plan existen y son seguros.
 * NO borra datos. NO conecta a Supabase.
 *
 * Uso: npm run check:data-reset-plan
 */

import { existsSync, readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

let pass = 0
let fail = 0

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ ${label}`)
    pass++
  } else {
    console.log(`  ❌ ${label}${detail ? ' — ' + detail : ''}`)
    fail++
  }
}

function fileExists(rel) {
  return existsSync(join(ROOT, rel))
}

function fileContains(rel, text) {
  if (!fileExists(rel)) return false
  return readFileSync(join(ROOT, rel), 'utf8').includes(text)
}

function fileNotContains(rel, text) {
  if (!fileExists(rel)) return true
  return !readFileSync(join(ROOT, rel), 'utf8').includes(text)
}

function pkgScriptExists(name) {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  return name in (pkg.scripts ?? {})
}

console.log('\n' + '═'.repeat(60))
console.log('  CEJUASSA — Validación del Plan de Reset de Datos')
console.log('═'.repeat(60) + '\n')

// ── Existencia de archivos ──────────────────────────────────────────────────
console.log('📄 Archivos del plan:')
check('DATA_RESET_PLAN.md existe',
  fileExists('docs/ai-recovery/DATA_RESET_PLAN.md'))

check('DATA_RELOAD_CHECKLIST.md existe',
  fileExists('docs/ai-recovery/DATA_RELOAD_CHECKLIST.md'))

check('plan-data-reset.mjs existe',
  fileExists('scripts/plan-data-reset.mjs'))

check('data-reset-template.sql existe',
  fileExists('supabase/manual/data-reset-template.sql'))

// ── Seguridad del template SQL ──────────────────────────────────────────────
console.log('\n🔒 Seguridad del template SQL:')
const SQL = 'supabase/manual/data-reset-template.sql'

check('Template marcado como PLANTILLA',
  fileContains(SQL, 'NO EJECUTAR SIN AUTORIZACIÓN'))

check('Template NO borra usuarios',
  fileNotContains(SQL, 'DELETE FROM public.usuarios') &&
  fileNotContains(SQL, 'TRUNCATE public.usuarios') &&
  fileNotContains(SQL, 'DROP TABLE usuarios'))

check('Template NO borra configuracion',
  fileNotContains(SQL, 'DELETE FROM public.configuracion') &&
  fileNotContains(SQL, 'TRUNCATE public.configuracion'))

check('Template NO menciona auth.users en operaciones destructivas',
  fileNotContains(SQL, 'DELETE FROM auth.users') &&
  fileNotContains(SQL, 'TRUNCATE auth.users'))

check('Template usa ROLLBACK por defecto (no COMMIT activo al final)',
  (() => {
    if (!fileExists(SQL)) return false
    const content = readFileSync(join(ROOT, SQL), 'utf8')
    // Líneas no comentadas
    const lines = content.split('\n').filter(l => !l.trim().startsWith('--'))
    // ROLLBACK presente como instrucción (no importa si tiene comentario inline)
    const hasRollback = lines.some(l => l.trim().startsWith('ROLLBACK'))
    // COMMIT activo = línea que empieza con COMMIT (sin ser comentario)
    const hasCommit = lines.some(l => l.trim().startsWith('COMMIT'))
    return hasRollback && !hasCommit
  })())

check('Template respeta orden FK (cronograma antes que creditos)',
  (() => {
    if (!fileExists(SQL)) return false
    const content = readFileSync(join(ROOT, SQL), 'utf8')
    const idxCronograma = content.indexOf('cronograma_cuotas')
    const idxCreditos = content.indexOf("'creditos'") !== -1
      ? content.indexOf("'creditos'")
      : content.lastIndexOf('public.creditos')
    return idxCronograma < idxCreditos && idxCronograma > 0
  })())

// ── Seguridad del package.json ──────────────────────────────────────────────
console.log('\n📦 Seguridad de scripts npm:')

check('Existe npm run plan:data-reset',
  pkgScriptExists('plan:data-reset'))

check('Existe npm run check:data-reset-plan',
  pkgScriptExists('check:data-reset-plan'))

check('Ningún script npm ejecuta data-reset-template.sql',
  (() => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
    const scripts = Object.values(pkg.scripts ?? {}).join('\n')
    return !scripts.includes('data-reset-template')
  })())

check('No hay script npm de borrado masivo (reset:db, delete:data, truncate)',
  (() => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
    const names = Object.keys(pkg.scripts ?? {})
    return !names.some(n =>
      n.includes('reset:db') ||
      n.includes('delete:data') ||
      n.includes('truncate')
    )
  })())

// ── Archivos protegidos ─────────────────────────────────────────────────────
console.log('\n🛡️  Protecciones críticas:')

check('No existe migración de reset en supabase/migrations/',
  (() => {
    const migrDir = join(ROOT, 'supabase', 'migrations')
    if (!existsSync(migrDir)) return true
    const files = readdirSync(migrDir)
    return !files.some(f => f.toLowerCase().includes('reset') || f.toLowerCase().includes('truncate'))
  })())

check('_client_files/ no tiene archivos del plan (no contaminada)',
  (() => {
    const clientDir = join(ROOT, '_client_files')
    if (!existsSync(clientDir)) return true
    const files = readdirSync(clientDir)
    return !files.some(f =>
      f.includes('data-reset') ||
      f.includes('RESET') ||
      f.includes('data-reset-template')
    )
  })())

check('data-reset-template.sql NO está en supabase/migrations/',
  (() => {
    const migrDir = join(ROOT, 'supabase', 'migrations')
    if (!existsSync(migrDir)) return true
    const files = readdirSync(migrDir)
    return !files.some(f => f.includes('data-reset'))
  })())

check('plan-data-reset.mjs no borra datos (no usa API de borrado de Supabase)',
  (() => {
    const scriptPath = 'scripts/plan-data-reset.mjs'
    if (!fileExists(scriptPath)) return false
    const content = readFileSync(join(ROOT, scriptPath), 'utf8')
    // Verificar que no hay llamadas de borrado reales vía Supabase JS client
    const hasDangerousCall =
      /\.delete\(\)/.test(content) ||
      /supabase\.rpc\(.*delete/i.test(content) ||
      /supabase\.rpc\(.*truncate/i.test(content)
    return !hasDangerousCall
  })())

// ── Resumen ─────────────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(60))
console.log(`  Resultado: ${pass} ✅ PASS  /  ${fail} ❌ FAIL`)
console.log('═'.repeat(60) + '\n')

if (fail > 0) {
  console.error(`⚠️  ${fail} verificación(es) fallaron. Revisar antes de continuar.\n`)
  process.exit(1)
} else {
  console.log('✅ Plan de reset verificado. Ningún dato fue borrado.\n')
}
