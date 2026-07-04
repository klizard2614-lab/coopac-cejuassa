/**
 * check-cronograma-regeneration-plan.mjs
 * Fase 9C-6C — Verificar que el plan de regeneración de cronogramas cumple las reglas de seguridad.
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

let passed = 0
let failed = 0

function ok(msg) { console.log(`  ✅ ${msg}`); passed++ }
function fail(msg) { console.log(`  ❌ ${msg}`); failed++ }

function readText(relPath) {
  const p = resolve(ROOT, relPath)
  if (!existsSync(p)) return null
  return readFileSync(p, 'utf8')
}

function containsPattern(text, patterns) {
  for (const pat of patterns) {
    if (typeof pat === 'string' && text.toLowerCase().includes(pat.toLowerCase())) return pat
    if (pat instanceof RegExp && pat.test(text)) return pat.toString()
  }
  return null
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('  check-cronograma-regeneration-plan — Fase 9C-6C')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

// ─── 1. Existencia de artefactos ──────────────────────────────────────────────

const PLAN = 'docs/ai-recovery/CRONOGRAMA_REGENERATION_PLAN.md'
const REPORT = 'docs/ai-recovery/CRONOGRAMA_REGENERATION_DRY_RUN_REPORT.md'
const DRYRUN = 'scripts/dry-run-regenerate-cronogramas.mjs'

console.log('1. Existencia de artefactos')
existsSync(resolve(ROOT, PLAN)) ? ok(`Plan existe: ${PLAN}`) : fail(`Plan NO encontrado: ${PLAN}`)
existsSync(resolve(ROOT, REPORT)) ? ok(`Reporte dry-run existe: ${REPORT}`) : fail(`Reporte NO encontrado: ${REPORT}`)
existsSync(resolve(ROOT, DRYRUN)) ? ok(`Script dry-run existe: ${DRYRUN}`) : fail(`Script dry-run NO encontrado: ${DRYRUN}`)

// ─── 2. El script dry-run no contiene operaciones de escritura ────────────────

console.log('\n2. Script dry-run — sin operaciones de escritura')
const dryrunText = readText(DRYRUN)
if (dryrunText) {
  const FORBIDDEN = [
    /\.insert\s*\(/i,
    /\.update\s*\(/i,
    /\.delete\s*\(/i,
    /\.upsert\s*\(/i,
    /supabase\.rpc\s*\(/i,
    /TRUNCATE/i,
  ]
  // Excluir comentarios de cabecera (líneas que empiezan con * o //)
  const codeOnly = dryrunText.split('\n')
    .filter(l => !l.trim().startsWith('*') && !l.trim().startsWith('//'))
    .join('\n')

  let forbidden = false
  for (const pat of FORBIDDEN) {
    if (pat.test(codeOnly)) {
      fail(`Script contiene operación prohibida: ${pat}`)
      forbidden = true
    }
  }
  if (!forbidden) ok('Script no contiene insert/update/delete/truncate/rpc en código activo')

  const noTocarPatterns = ['auth.users', 'usuarios', 'configuracion', '_client_files', 'migrations']
  // Solo verificar que no los modifica (lectura es OK)
  const hasAuthUsers = /\.from\s*\(\s*['"]auth\.users['"]\s*\)/.test(codeOnly)
  hasAuthUsers ? fail('Script accede a auth.users') : ok('Script no toca auth.users')

  const hasMigrations = /supabase\/migrations/i.test(codeOnly)
  hasMigrations ? fail('Script referencia migraciones') : ok('Script no crea migraciones')

  const hasClientFiles = /_client_files/i.test(codeOnly)
  hasClientFiles ? fail('Script modifica _client_files') : ok('Script no modifica _client_files')
} else {
  fail('No se pudo leer el script dry-run')
}

// ─── 3. El plan menciona campos requeridos ────────────────────────────────────

console.log('\n3. Plan — campos requeridos documentados')
const planText = readText(PLAN)
if (planText) {
  const requiredFields = ['monto_aprobado', 'tasa_interes', 'plazo_meses', 'fecha_desembolso']
  for (const f of requiredFields) {
    planText.includes(f) ? ok(`Plan menciona campo requerido: ${f}`) : fail(`Plan NO menciona: ${f}`)
  }
  /sistema franc/i.test(planText) ? ok('Plan documenta fórmula sistema francés') : fail('Plan no documenta fórmula')
  planText.includes('Rollback') ? ok('Plan incluye sección Rollback') : fail('Plan no incluye Rollback')
  planText.includes('Riesgo') ? ok('Plan incluye sección Riesgos') : fail('Plan no incluye Riesgos')
  planText.includes('elegible') ? ok('Plan documenta criterios de elegibilidad') : fail('Plan no documenta elegibilidad')
} else {
  fail('No se pudo leer el plan')
}

// ─── 4. El reporte existe y tiene contenido ───────────────────────────────────

console.log('\n4. Reporte dry-run — contenido mínimo')
const reportText = readText(REPORT)
if (reportText) {
  reportText.includes('cronograma_cuotas') ? ok('Reporte menciona cronograma_cuotas') : fail('Reporte no menciona cronograma_cuotas')
  reportText.includes('SOLO LECTURA') ? ok('Reporte incluye advertencia SOLO LECTURA') : fail('Reporte no incluye advertencia SOLO LECTURA')
  reportText.includes('Elegibles') ? ok('Reporte clasifica elegibles') : fail('Reporte no clasifica elegibles')
  reportText.includes('Riesgos') ? ok('Reporte documenta riesgos') : fail('Reporte no documenta riesgos')
  reportText.includes('Próxima fase') ? ok('Reporte incluye próxima fase') : fail('Reporte no incluye próxima fase')
} else {
  fail('Reporte no existe o está vacío — ejecuta: npm run cronogramas:dry-run')
}

// ─── 5. Verificar que comandos npm están en package.json ─────────────────────

console.log('\n5. Comandos npm registrados en package.json')
const pkgText = readText('package.json')
if (pkgText) {
  pkgText.includes('"cronogramas:dry-run"') ? ok('Comando cronogramas:dry-run registrado') : fail('Comando cronogramas:dry-run NO registrado')
  pkgText.includes('"check:cronogramas:plan"') ? ok('Comando check:cronogramas:plan registrado') : fail('Comando check:cronogramas:plan NO registrado')
} else {
  fail('No se pudo leer package.json')
}

// ─── Resultado final ──────────────────────────────────────────────────────────

const total = passed + failed
console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
console.log(`  Resultado: ${passed}/${total} PASS`)
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

if (failed > 0) process.exit(1)
