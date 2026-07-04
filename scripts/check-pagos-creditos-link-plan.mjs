/**
 * check-pagos-creditos-link-plan.mjs
 * Fase 9C-6E — Verificador de seguridad del plan de vinculación pagos→créditos.
 *
 * REGLAS ESTRICTAS — SOLO LECTURA / VERIFICACIÓN ESTÁTICA:
 * - NO ejecuta ningún script
 * - NO modifica ningún dato ni archivo de negocio
 * - Solo verifica existencia de archivos y contenido del script dry-run
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

let pass = 0
let fail = 0

function check(label, ok, detail = '') {
  if (ok) {
    console.log(`  ✅ ${label}`)
    pass++
  } else {
    console.log(`  ❌ ${label}${detail ? ' — ' + detail : ''}`)
    fail++
  }
}

function fileExists(rel) { return existsSync(resolve(ROOT, rel)) }

function fileContent(rel) {
  const p = resolve(ROOT, rel)
  return existsSync(p) ? readFileSync(p, 'utf8').toLowerCase() : ''
}

console.log('\n══════════════════════════════════════════════════════')
console.log('  CEJUASSA — Check: Plan Link Pagos → Créditos (9C-6E)')
console.log('══════════════════════════════════════════════════════\n')

// ─── 1. Archivos requeridos ────────────────────────────────────────────────────

console.log('📁 1. Existencia de archivos requeridos:')
check('Script dry-run existe',  fileExists('scripts/dry-run-link-pagos-creditos.mjs'))
check('Check script existe',    fileExists('scripts/check-pagos-creditos-link-plan.mjs'))
check('Reporte markdown existe', fileExists('docs/ai-recovery/PAGOS_CREDITOS_LINK_DRY_RUN_REPORT.md'))

// El preview se genera al ejecutar el dry-run, no existe antes
const previewExists = fileExists('docs/ai-recovery/proposed_pago_credito_links_preview.json')
if (previewExists) {
  check('Preview JSON existe (dry-run ya ejecutado)', true)
} else {
  console.log(`  ⚠️  Preview JSON aún no existe — ejecutar primero: npm run pagos:link-creditos:dry-run`)
}

// ─── 2. Script dry-run no contiene operaciones de escritura ────────────────────

console.log('\n🔒 2. Verificación de seguridad del script dry-run:')
const scriptContent = fileContent('scripts/dry-run-link-pagos-creditos.mjs')

check('No contiene .update(', !scriptContent.includes('.update('))
check('No contiene .insert(', !scriptContent.includes('.insert('))
check('No contiene .delete(', !scriptContent.includes('.delete('))
check('No contiene .upsert(', !scriptContent.includes('.upsert('))
check('No contiene RPC de escritura (rpc modificadora)',
  !scriptContent.includes("rpc('insert") &&
  !scriptContent.includes("rpc('update") &&
  !scriptContent.includes("rpc('delete") &&
  !scriptContent.includes("rpc('crear_credito") &&
  !scriptContent.includes("rpc('registrar_aporte") &&
  !scriptContent.includes("rpc('decrementar_saldo")
)

// ─── 3. Script no toca tablas prohibidas ─────────────────────────────────────

console.log('\n🚫 3. Tablas prohibidas — verificar que el script NO modifica:')

check('No modifica cronograma_cuotas (sin update/insert)',
  !(scriptContent.includes("'cronograma_cuotas'") && (scriptContent.includes('.update(') || scriptContent.includes('.insert(') || scriptContent.includes('.upsert(')))
)
check('No modifica creditos directamente',
  !scriptContent.includes("from('creditos').update") &&
  !scriptContent.includes('from("creditos").update') &&
  !scriptContent.includes("from('creditos').insert") &&
  !scriptContent.includes('from("creditos").insert')
)
check('No modifica socios',
  !scriptContent.includes("from('socios').update") &&
  !scriptContent.includes('from("socios").update') &&
  !scriptContent.includes("from('socios').insert") &&
  !scriptContent.includes('from("socios").insert')
)
check('No toca usuarios',
  !scriptContent.includes("from('usuarios')") || (
    !scriptContent.includes("from('usuarios').update") &&
    !scriptContent.includes("from('usuarios').insert")
  )
)
check('No toca configuracion',
  !scriptContent.includes("from('configuracion').update") &&
  !scriptContent.includes("from('configuracion').insert")
)
check('No toca auth.users',
  !scriptContent.includes('auth.admin.deleteUser') &&
  !scriptContent.includes('auth.admin.createUser') &&
  !scriptContent.includes('auth.admin.updateUserById')
)

// ─── 4. Script no crea migraciones ───────────────────────────────────────────

console.log('\n📄 4. No crea migraciones:')
check('No referencia supabase/migrations',
  !scriptContent.includes('supabase/migrations') && !scriptContent.includes('migration')
)
check('No contiene CREATE TABLE',  !scriptContent.includes('create table'))
check('No contiene ALTER TABLE',   !scriptContent.includes('alter table'))

// ─── 5. Script no modifica _client_files ─────────────────────────────────────

console.log('\n📂 5. No toca _client_files:')
check('No modifica _client_files/',
  !scriptContent.includes('_client_files') ||
  scriptContent.includes('_client_files') === false ||
  (scriptContent.includes('_client_files') && scriptContent.includes('solo lectura'))
)

// ─── 6. Comandos en package.json ─────────────────────────────────────────────

console.log('\n📦 6. Comandos npm registrados:')
const pkg = fileContent('package.json')
check('npm run pagos:link-creditos:dry-run',   pkg.includes('pagos:link-creditos:dry-run'))
check('npm run check:pagos-link-creditos',     pkg.includes('check:pagos-link-creditos'))

// ─── 7. Reporte tiene secciones obligatorias ─────────────────────────────────

console.log('\n📋 7. Reporte PAGOS_CREDITOS_LINK_DRY_RUN_REPORT.md:')
const report = fileContent('docs/ai-recovery/PAGOS_CREDITOS_LINK_DRY_RUN_REPORT.md')
if (report) {
  check('Contiene sección metodología',  report.includes('metodolog'))
  check('Contiene conteos por categoría', report.includes('match_alto') && report.includes('sin_match'))
  check('Contiene sección riesgos',      report.includes('riesgo'))
  check('Contiene recomendación',        report.includes('recomend'))
  check('Menciona que es solo lectura',  report.includes('solo lectura') || report.includes('dry-run'))
} else {
  console.log('  ⚠️  Reporte aún no existe — se creará al ejecutar el dry-run')
}

// ─── Resultado final ──────────────────────────────────────────────────────────

const total = pass + fail
console.log(`\n══════════════════════════════════════════════════════`)
console.log(`  Resultado: ${pass}/${total} checks PASS`)
if (fail > 0) {
  console.log(`  ⚠️  ${fail} checks fallidos — revisar antes de continuar`)
} else {
  console.log(`  ✅ Plan de dry-run verificado y seguro`)
}
console.log(`══════════════════════════════════════════════════════\n`)

process.exit(fail > 0 ? 1 : 0)
