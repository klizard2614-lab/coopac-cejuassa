/**
 * check-post-import-fix-plan.mjs
 * Fase 9C-6A — Verificación del plan y dry-run de correcciones post-importación
 */

import { existsSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

let passed = 0
let failed = 0

function check(label, condition) {
  if (condition) { console.log(`  ✅ PASS  ${label}`); passed++ }
  else { console.log(`  ❌ FAIL  ${label}`); failed++ }
}

function has(filePath, pattern) {
  if (!existsSync(filePath)) return false
  const c = readFileSync(filePath, 'utf8')
  return pattern instanceof RegExp ? pattern.test(c) : c.includes(pattern)
}

function notHasInCodeLines(filePath, pattern) {
  if (!existsSync(filePath)) return true
  const lines = readFileSync(filePath, 'utf8').split('\n')
  return !lines.some(l => {
    if (/^\s*[/*]/.test(l) || /^\s*\*/.test(l)) return false
    return pattern instanceof RegExp ? pattern.test(l) : l.includes(pattern)
  })
}

console.log('\n══════════════════════════════════════════════════════')
console.log('  CEJUASSA — Check: Post-Import Fix Plan (9C-6A)')
console.log('══════════════════════════════════════════════════════\n')

const PLAN = resolve(ROOT, 'docs/ai-recovery/POST_IMPORT_FIX_PLAN.md')
const REPORT = resolve(ROOT, 'docs/ai-recovery/POST_IMPORT_FIX_DRY_RUN_REPORT.md')
const DRY = resolve(ROOT, 'scripts/fix-post-import-dry-run.mjs')
const PKG = resolve(ROOT, 'package.json')

let pkgJson = {}
try { pkgJson = JSON.parse(readFileSync(PKG, 'utf8')) } catch {}

// Bloque 1: Existencia
console.log('📁 Bloque 1: Existencia de artefactos')
check('POST_IMPORT_FIX_PLAN.md existe', existsSync(PLAN))
check('POST_IMPORT_FIX_DRY_RUN_REPORT.md existe', existsSync(REPORT))
check('fix-post-import-dry-run.mjs existe', existsSync(DRY))

// Bloque 2: Seguridad del dry-run (solo lectura)
console.log('\n🔒 Bloque 2: Seguridad — solo lectura')
check('Script no ejecuta INSERT', notHasInCodeLines(DRY, /\.insert\s*\(/) && notHasInCodeLines(DRY, /INSERT INTO/i))
check('Script no ejecuta UPDATE', notHasInCodeLines(DRY, /\.update\s*\(/) && notHasInCodeLines(DRY, /UPDATE\s+\w+\s+SET/i))
check('Script no ejecuta DELETE', notHasInCodeLines(DRY, /\.delete\s*\(\s*\)/) && notHasInCodeLines(DRY, /DELETE FROM/i))
check('Script no ejecuta TRUNCATE', notHasInCodeLines(DRY, /TRUNCATE/i))
check('Script no inserta en usuarios', notHasInCodeLines(DRY, /from\(['"`]usuarios['"`]\).*insert/i))
check('Script no inserta en configuracion', notHasInCodeLines(DRY, /from\(['"`]configuracion['"`]\).*insert/i))
check('Script no toca tablas de sistema', notHasInCodeLines(DRY, /auth\.users/))
check('Script no crea migraciones', notHasInCodeLines(DRY, /CREATE TABLE/i) && notHasInCodeLines(DRY, /ALTER TABLE/i))
check('Script no modifica _client_files', notHasInCodeLines(DRY, /writeFile.*_client_files/i))
check('Script no aplica correcciones reales', notHasInCodeLines(DRY, /\.update\s*\(/))

// Bloque 3: Contenido del plan
console.log('\n📄 Bloque 3: Contenido del plan')
check('Plan tiene Grupo A (correcciones automáticas)', has(PLAN, 'Grupo A') || has(PLAN, 'automáticas seguras'))
check('Plan tiene Grupo B (requieren fuente)', has(PLAN, 'Grupo B') || has(PLAN, 'requieren datos reales'))
check('Plan tiene Grupo C (decisión de negocio)', has(PLAN, 'Grupo C') || has(PLAN, 'decisión de negocio'))
check('Plan menciona tipo_credito_sbs', has(PLAN, 'tipo_credito_sbs'))
check('Plan menciona genero/estado_civil', has(PLAN, 'genero') && has(PLAN, 'estado_civil'))
check('Plan menciona tasa_interes', has(PLAN, 'tasa_interes'))
check('Plan menciona cronograma_cuotas', has(PLAN, 'cronograma_cuotas'))
check('Plan menciona deadline BDCC', has(PLAN, '20/07/2026') || has(PLAN, 'deadline'))
check('Plan declara que no se modificó nada', has(PLAN, 'NO se insertó') || has(PLAN, 'NO se actualizó'))

// Bloque 4: Contenido del reporte dry-run
console.log('\n📊 Bloque 4: Reporte dry-run')
check('Reporte menciona Grupo A', has(REPORT, 'Grupo A') || has(REPORT, 'automáticas'))
check('Reporte menciona Grupo B', has(REPORT, 'Grupo B') || has(REPORT, 'datos del cliente'))
check('Reporte menciona Grupo C', has(REPORT, 'Grupo C') || has(REPORT, 'negocio'))
check('Reporte analiza cronograma', has(REPORT, 'cronograma') || has(REPORT, 'Cronograma'))
check('Reporte analiza tipo_credito_sbs', has(REPORT, 'tipo_credito_sbs'))
check('Reporte confirma que no se modificó nada', has(REPORT, 'NO se insertó') || has(REPORT, 'Nada fue modificado'))

// Bloque 5: Comandos npm
console.log('\n📦 Bloque 5: Comandos npm')
check('fix:post-import:dry-run registrado', pkgJson.scripts?.['fix:post-import:dry-run'] !== undefined)
check('check:post-import-fix-plan registrado', pkgJson.scripts?.['check:post-import-fix-plan'] !== undefined)
check('fix:post-import:dry-run apunta al script', pkgJson.scripts?.['fix:post-import:dry-run']?.includes('fix-post-import-dry-run.mjs'))

// Resultado
const total = passed + failed
console.log('\n══════════════════════════════════════════════════════')
console.log(`  Resultado: ${passed}/${total} PASS`)
if (failed === 0) console.log('  ✅ TODOS LOS CHECKS PASARON')
else console.log(`  ❌ ${failed} checks fallaron`)
console.log('══════════════════════════════════════════════════════\n')
process.exit(failed > 0 ? 1 : 0)
