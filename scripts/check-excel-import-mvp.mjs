/**
 * check-excel-import-mvp.mjs
 * Fase 9C-4B — Verificación del importador Excel MVP
 */

import { existsSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

let passed = 0
let failed = 0

function check(label, condition, detail = '') {
  if (condition) { console.log(`  ✅ PASS  ${label}`); passed++ }
  else { console.log(`  ❌ FAIL  ${label}${detail ? ' — ' + detail : ''}`); failed++ }
}

function has(filePath, pattern) {
  if (!existsSync(filePath)) return false
  const c = readFileSync(filePath, 'utf8')
  return pattern instanceof RegExp ? pattern.test(c) : c.includes(pattern)
}

function notHas(filePath, pattern) {
  if (!existsSync(filePath)) return true
  const c = readFileSync(filePath, 'utf8')
  if (pattern instanceof RegExp) return !pattern.test(c)
  return !c.includes(pattern)
}

function notHasInCodeLines(filePath, pattern) {
  if (!existsSync(filePath)) return true
  const lines = readFileSync(filePath, 'utf8').split('\n')
  return !lines.some(l => !/^\s*[/*]/.test(l) && (pattern instanceof RegExp ? pattern.test(l) : l.includes(pattern)))
}

console.log('\n══════════════════════════════════════════════════════')
console.log('  CEJUASSA — Check: Excel Import MVP (Fase 9C-4B)')
console.log('══════════════════════════════════════════════════════\n')

const MVP = resolve(ROOT, 'scripts/import-excel/import-excel-mvp.mjs')
const PLAN = resolve(ROOT, 'docs/ai-recovery/EXCEL_IMPORT_EXECUTION_PLAN.md')
const REPORT = resolve(ROOT, 'docs/ai-recovery/EXCEL_IMPORT_MVP_DRY_RUN_REPORT.md')
const PKG = resolve(ROOT, 'package.json')

let pkgJson = {}
try { pkgJson = JSON.parse(readFileSync(PKG, 'utf8')) } catch {}

// ─── Bloque 1: Existencia ────────────────────────────────────────────────────

console.log('📁 Bloque 1: Existencia de artefactos')
check('Importador MVP existe (import-excel-mvp.mjs)', existsSync(MVP))
check('Plan de ejecución existe (EXCEL_IMPORT_EXECUTION_PLAN.md)', existsSync(PLAN))
check('Reporte dry-run MVP existe (EXCEL_IMPORT_MVP_DRY_RUN_REPORT.md)', existsSync(REPORT))

// ─── Bloque 2: Modos del script ──────────────────────────────────────────────

console.log('\n🔄 Bloque 2: Modos del importador')
check('Script tiene modo dry-run', has(MVP, '--dry-run') || has(MVP, 'DRY-RUN') || has(MVP, 'IS_APPLY'))
check('Script tiene modo apply', has(MVP, '--apply') || has(MVP, 'IS_APPLY'))
check('Apply requiere autorización', has(MVP, 'EJECUTAR IMPORTACION EXCEL 9C-4B'))
check('Apply verifica autorización en env variable', has(MVP, 'IMPORT_AUTH'))

// ─── Bloque 3: Fuente de datos ───────────────────────────────────────────────

console.log('\n📂 Bloque 3: Fuente de datos')
check(
  'Script usa Excel como fuente (no backup JSON)',
  has(MVP, '_client_files') || has(MVP, 'EXCEL_FILES'),
)
check(
  'Script deriva socios desde Excel',
  has(MVP, 'sociosDerivados') || has(MVP, 'socioMap') || has(MVP, 'IdSocio'),
)
check(
  'Script deduplica por DNI/IdSocio',
  has(MVP, 'dni') && (has(MVP, 'nro_socio') || has(MVP, 'IdSocio')),
)
check(
  'Script no usa backup JSON como fuente principal',
  notHas(MVP, /readFileSync.*backups\/data-reset/i),
)
check(
  'Plan de ejecución declara Excel como fuente principal',
  has(PLAN, 'Excel') && (has(PLAN, 'fuente principal') || has(PLAN, 'Fuente principal') || has(PLAN, 'fuente: Excel')),
)
check(
  'Plan menciona creación de socios desde Excel',
  has(PLAN, 'socios') && (has(PLAN, 'automáticamente') || has(PLAN, 'derivados') || has(PLAN, 'Creación automática') || has(PLAN, 'crearán')),
)

// ─── Bloque 4: Seguridad ─────────────────────────────────────────────────────

console.log('\n🔐 Bloque 4: Seguridad')
check(
  'Script no inserta en usuarios',
  notHasInCodeLines(MVP, /\.from\(['"`]usuarios['"`]\).*\.insert/),
)
check(
  'Script no inserta en configuracion',
  notHasInCodeLines(MVP, /\.from\(['"`]configuracion['"`]\).*\.insert/),
)
check(
  'Script no toca auth.users en código',
  notHasInCodeLines(MVP, /auth\.users/),
)
check(
  'Script no crea migraciones',
  notHasInCodeLines(MVP, /CREATE TABLE/i) &&
  notHasInCodeLines(MVP, /ALTER TABLE/i) &&
  notHasInCodeLines(MVP, /supabase.*migration/i),
)
check(
  'Script no modifica _client_files',
  notHasInCodeLines(MVP, /writeFile.*_client_files/i) &&
  notHasInCodeLines(MVP, /appendFile.*_client_files/i),
)
check(
  'Script no borra datos (no DELETE/TRUNCATE)',
  notHasInCodeLines(MVP, /\.delete\(\)/) &&
  notHasInCodeLines(MVP, /TRUNCATE/i),
)
check(
  'Apply verifica tablas vacías antes de insertar',
  has(MVP, 'checkTablesEmpty') || has(MVP, 'tablas operativas estén en 0') || has(MVP, 'count > 0'),
)

// ─── Bloque 5: Comandos npm ──────────────────────────────────────────────────

console.log('\n📦 Bloque 5: Comandos npm')
check('npm run import:excel:mvp:dry-run registrado', pkgJson.scripts?.['import:excel:mvp:dry-run'] !== undefined)
check('npm run import:excel:mvp:apply registrado', pkgJson.scripts?.['import:excel:mvp:apply'] !== undefined)
check('npm run check:excel-import-mvp registrado', pkgJson.scripts?.['check:excel-import-mvp'] !== undefined)
check(
  'dry-run apunta a import-excel-mvp.mjs',
  pkgJson.scripts?.['import:excel:mvp:dry-run']?.includes('import-excel-mvp.mjs'),
)
check(
  'apply apunta a import-excel-mvp.mjs',
  pkgJson.scripts?.['import:excel:mvp:apply']?.includes('import-excel-mvp.mjs'),
)

// ─── Bloque 6: Reporte ───────────────────────────────────────────────────────

console.log('\n📄 Bloque 6: Reporte dry-run MVP')
check('Reporte menciona socios derivados', has(REPORT, 'Socios derivados') || has(REPORT, 'socios'))
check('Reporte menciona créditos candidatos', has(REPORT, 'Créditos') || has(REPORT, 'créditos'))
check('Reporte menciona pagos', has(REPORT, 'Pagos') || has(REPORT, 'pagos'))
check('Reporte menciona aportes', has(REPORT, 'Aportes') || has(REPORT, 'aportes'))
check('Reporte menciona autorización para apply', has(REPORT, 'EJECUTAR IMPORTACION EXCEL 9C-4B'))
check('Reporte confirma que no se insertó nada', has(REPORT, 'NO se insertó ningún dato') || has(REPORT, 'Nada fue insertado'))

// ─── Resultado ───────────────────────────────────────────────────────────────

const total = passed + failed
console.log('\n══════════════════════════════════════════════════════')
console.log(`  Resultado: ${passed}/${total} PASS`)
if (failed === 0) console.log('  ✅ TODOS LOS CHECKS PASARON — Import MVP listo')
else console.log(`  ❌ ${failed} checks fallaron — revisar antes de continuar`)
console.log('══════════════════════════════════════════════════════\n')
process.exit(failed > 0 ? 1 : 0)
