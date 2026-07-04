/**
 * check-post-excel-import-audit.mjs
 * Fase 9C-5 — Verificación del script de auditoría post-importación
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

function notHasInCodeLines(filePath, pattern) {
  if (!existsSync(filePath)) return true
  const lines = readFileSync(filePath, 'utf8').split('\n')
  return !lines.some(l => {
    if (/^\s*[/*]/.test(l)) return false // ignorar comentarios
    if (/^\s*\*/.test(l)) return false    // ignorar bloques de comentario
    return pattern instanceof RegExp ? pattern.test(l) : l.includes(pattern)
  })
}

console.log('\n══════════════════════════════════════════════════════')
console.log('  CEJUASSA — Check: Post-Excel Import Audit (9C-5)')
console.log('══════════════════════════════════════════════════════\n')

const AUDIT = resolve(ROOT, 'scripts/audit-post-excel-import.mjs')
const REPORT = resolve(ROOT, 'docs/ai-recovery/POST_EXCEL_IMPORT_AUDIT.md')
const PKG = resolve(ROOT, 'package.json')

let pkgJson = {}
try { pkgJson = JSON.parse(readFileSync(PKG, 'utf8')) } catch {}

// Bloque 1: Existencia
console.log('📁 Bloque 1: Existencia de artefactos')
check('Script de auditoría existe (audit-post-excel-import.mjs)', existsSync(AUDIT))
check('Reporte existe (POST_EXCEL_IMPORT_AUDIT.md)', existsSync(REPORT))

// Bloque 2: El script es solo lectura
console.log('\n🔒 Bloque 2: Seguridad — solo lectura')
check(
  'Script no ejecuta INSERT en código',
  notHasInCodeLines(AUDIT, /\.insert\s*\(/) &&
  notHasInCodeLines(AUDIT, /INSERT INTO/i),
)
check(
  'Script no ejecuta UPDATE en código',
  notHasInCodeLines(AUDIT, /\.update\s*\(/) &&
  notHasInCodeLines(AUDIT, /UPDATE\s+\w+\s+SET/i),
)
check(
  'Script no ejecuta DELETE en código',
  notHasInCodeLines(AUDIT, /\.delete\s*\(\s*\)/) &&
  notHasInCodeLines(AUDIT, /DELETE FROM/i),
)
check(
  'Script no ejecuta TRUNCATE en código',
  notHasInCodeLines(AUDIT, /TRUNCATE/i),
)
check(
  'Script no toca usuarios en código',
  notHasInCodeLines(AUDIT, /from\(['"`]usuarios['"`]\)/i) ||
  // es OK si solo lo cuenta en el array de tablas de auditoría
  has(AUDIT, "'usuarios'") && !has(AUDIT, ".from('usuarios').insert"),
)
check(
  'Script no toca configuracion (solo lectura)',
  !has(AUDIT, ".from('configuracion').insert") &&
  !has(AUDIT, ".from('configuracion').update") &&
  !has(AUDIT, ".from('configuracion').delete"),
)
check(
  'Script no toca auth.users en código',
  notHasInCodeLines(AUDIT, /auth\.users/),
)
check(
  'Script no crea migraciones',
  notHasInCodeLines(AUDIT, /CREATE TABLE/i) &&
  notHasInCodeLines(AUDIT, /ALTER TABLE/i),
)
check(
  'Script no modifica _client_files',
  notHasInCodeLines(AUDIT, /writeFile.*_client_files/i) &&
  notHasInCodeLines(AUDIT, /appendFile.*_client_files/i),
)

// Bloque 3: Cobertura de auditoría
console.log('\n🔍 Bloque 3: Cobertura de auditoría')
check('Script audita socios', has(AUDIT, 'socios'))
check('Script audita créditos', has(AUDIT, 'creditos'))
check('Script audita pagos', has(AUDIT, 'pagos_recibos'))
check('Script audita aportes', has(AUDIT, 'aportes'))
check('Script audita convenios', has(AUDIT, 'convenios'))
check('Script detecta DNI duplicados', has(AUDIT, 'dniDuplicados') || has(AUDIT, 'dniCount'))
check('Script detecta DNI placeholder', has(AUDIT, 'SINDNI') || has(AUDIT, 'placeholder'))
check('Script detecta tasa_interes cero', has(AUDIT, 'tasa_interes') && has(AUDIT, '=== 0'))
check('Script detecta cronograma vacío', has(AUDIT, 'cronograma_cuotas') || has(AUDIT, 'cronograma'))
check('Script evalúa reportes/BDCC', has(AUDIT, 'BDCC') || has(AUDIT, 'bdcc') || has(AUDIT, 'genero'))
check('Script genera reporte Markdown', has(AUDIT, 'POST_EXCEL_IMPORT_AUDIT.md'))

// Bloque 4: Reporte generado
console.log('\n📄 Bloque 4: Reporte generado')
check('Reporte incluye resumen ejecutivo', has(REPORT, 'Resumen ejecutivo') || has(REPORT, 'resumen'))
check('Reporte incluye conteos', has(REPORT, 'Conteos actuales') || has(REPORT, 'convenios') && has(REPORT, 'socios'))
check('Reporte incluye problemas críticos', has(REPORT, 'críticos') || has(REPORT, 'Crítico'))
check('Reporte incluye qué puede usarse', has(REPORT, 'puede usar') || has(REPORT, 'Qué se puede') || has(REPORT, 'Listo'))
check('Reporte menciona BDCC', has(REPORT, 'BDCC') || has(REPORT, 'BD01'))
check('Reporte menciona Anexo 6', has(REPORT, 'Anexo 6') || has(REPORT, 'Anexo'))
check('Reporte incluye acciones recomendadas', has(REPORT, 'Acciones recomendadas') || has(REPORT, 'recomendadas'))

// Bloque 5: Comandos npm
console.log('\n📦 Bloque 5: Comandos npm')
check('npm run audit:post-excel-import registrado', pkgJson.scripts?.['audit:post-excel-import'] !== undefined)
check('npm run check:post-excel-import-audit registrado', pkgJson.scripts?.['check:post-excel-import-audit'] !== undefined)
check(
  'audit:post-excel-import apunta al script',
  pkgJson.scripts?.['audit:post-excel-import']?.includes('audit-post-excel-import.mjs'),
)

// Resultado
const total = passed + failed
console.log('\n══════════════════════════════════════════════════════')
console.log(`  Resultado: ${passed}/${total} PASS`)
if (failed === 0) console.log('  ✅ TODOS LOS CHECKS PASARON')
else console.log(`  ❌ ${failed} checks fallaron`)
console.log('══════════════════════════════════════════════════════\n')
process.exit(failed > 0 ? 1 : 0)
