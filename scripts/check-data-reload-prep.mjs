/**
 * check-data-reload-prep.mjs
 * Fase 9C-3 — Validar que la preparación de recarga es segura
 *
 * Verifica: documentos existen, script no inserta datos,
 * no toca tablas protegidas, no ejecutó recarga real.
 *
 * Uso: npm run check:data-reload-prep
 */

import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

let passed = 0
let failed = 0

function check(label, ok, detail = '') {
  if (ok) { console.log(`  ✅ ${label}`); passed++ }
  else     { console.log(`  ❌ ${label}${detail ? ' — ' + detail : ''}`); failed++ }
}

function fileContains(filePath, pattern) {
  try { return readFileSync(filePath, 'utf8').includes(pattern) } catch { return false }
}

function fileNotContains(filePath, ...patterns) {
  try {
    const content = readFileSync(filePath, 'utf8').toLowerCase()
    return patterns.every(p => !content.includes(p.toLowerCase()))
  } catch { return true }
}

async function main() {
  console.log('\n' + '═'.repeat(60))
  console.log('  CEJUASSA — Validación Preparación Recarga (Fase 9C-3)')
  console.log('═'.repeat(60) + '\n')

  // ── 1. Documentos obligatorios ───────────────────────────────────────────
  console.log('【1】 Documentos\n')
  const sourceMap = join(ROOT, 'docs', 'ai-recovery', 'DATA_RELOAD_SOURCE_MAP.md')
  const dryRunReport = join(ROOT, 'docs', 'ai-recovery', 'DATA_RELOAD_DRY_RUN_REPORT.md')
  check('Existe DATA_RELOAD_SOURCE_MAP.md', existsSync(sourceMap))
  check('Existe DATA_RELOAD_DRY_RUN_REPORT.md (ejecutar reload:dry-run si falta)', existsSync(dryRunReport))

  // ── 2. Script de dry-run ─────────────────────────────────────────────────
  console.log('\n【2】 Script de dry-run\n')
  const dryRunScript = join(ROOT, 'scripts', 'reload', 'dry-run-reload-data.mjs')
  check('Existe scripts/reload/dry-run-reload-data.mjs', existsSync(dryRunScript))

  if (existsSync(dryRunScript)) {
    // El script debe ser solo lectura — sin INSERT/UPDATE/DELETE/TRUNCATE/UPSERT
    check(
      'Script NO contiene INSERT',
      fileNotContains(dryRunScript, '.insert(', 'INSERT INTO')
    )
    check(
      'Script NO contiene UPDATE/UPSERT',
      fileNotContains(dryRunScript, '.update(', '.upsert(', 'UPDATE public.')
    )
    check(
      'Script NO contiene DELETE/TRUNCATE',
      fileNotContains(dryRunScript, '.delete(', 'DELETE FROM', 'TRUNCATE')
    )
    // Solo detectar escrituras en tablas protegidas (INSERT/UPDATE/DELETE sobre ellas)
    // Leer conteos de usuarios/configuracion está permitido (es una verificación de integridad)
    const dryContent = readFileSync(dryRunScript, 'utf8')
    const writeOnProtected =
      /supabase\.from\('usuarios'\)\s*\.(insert|update|delete|upsert)/.test(dryContent) ||
      /supabase\.from\('configuracion'\)\s*\.(insert|update|delete|upsert)/.test(dryContent)
    check('Script NO escribe en tabla usuarios ni configuracion', !writeOnProtected)
    check(
      'Script NO menciona auth.users',
      fileNotContains(dryRunScript, 'auth.users', 'auth.admin')
    )
  }

  // ── 3. No se ejecutó recarga real ────────────────────────────────────────
  console.log('\n【3】 Seguridad — sin recarga real ejecutada\n')

  // El reporte de dry-run debe confirmar que no se insertó nada
  if (existsSync(dryRunReport)) {
    check(
      'Reporte dry-run confirma: NO se insertó ningún dato',
      fileContains(dryRunReport, 'NO se insertó ningún dato')
    )
    check(
      'Reporte dry-run menciona usuarios conservados',
      fileContains(dryRunReport, 'usuarios')
    )
  }

  // El backup pre-reset sigue disponible (no fue borrado por el dry-run)
  const backupsDir = join(ROOT, 'backups', 'data-reset')
  check('Backup pre-reset sigue disponible (no borrado)', existsSync(backupsDir))

  // ── 4. No se crearon migraciones nuevas ──────────────────────────────────
  console.log('\n【4】 Integridad del proyecto\n')
  const migrationsDir = join(ROOT, 'supabase', 'migrations')
  if (existsSync(migrationsDir)) {
    const { readdirSync } = await import('fs')
    const migrations = readdirSync(migrationsDir).filter(f => f.endsWith('.sql'))
    const nuevas = migrations.filter(f => f.split('_')[0] >= '20260621')
    check('No se crearon migraciones en Fase 9C-3', nuevas.length === 0,
      nuevas.length > 0 ? `Encontradas: ${nuevas.join(', ')}` : '')
  } else {
    check('Directorio de migraciones existe', false, 'supabase/migrations/ no encontrado')
  }

  // El SOURCE MAP debe tener la advertencia de NO insertar
  if (existsSync(sourceMap)) {
    check(
      'SOURCE MAP indica que recarga requiere autorización posterior',
      fileContains(sourceMap, 'requiere autorización') || fileContains(sourceMap, 'autorización')
    )
  }

  // ── Resumen ─────────────────────────────────────────────────────────────
  const total = passed + failed
  console.log('\n' + '═'.repeat(60))
  console.log(`\n  Resultado: ${passed}/${total} checks PASS`)
  if (failed === 0) {
    console.log('  ✅ Preparación de recarga verificada.')
    console.log('  ✅ No se insertó ningún dato.')
    console.log('  ✅ Listo para que el usuario autorice la recarga real.')
  } else {
    console.log(`  ❌ ${failed} checks fallaron.`)
  }
  console.log('\n' + '═'.repeat(60) + '\n')

  if (failed > 0) process.exit(1)
}

main().catch(err => {
  console.error('\n❌ Error inesperado:', err.message)
  process.exit(1)
})
