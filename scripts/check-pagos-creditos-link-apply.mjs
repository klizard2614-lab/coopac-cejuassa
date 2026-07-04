/**
 * check-pagos-creditos-link-apply.mjs
 * Fase 9C-6F — Verificador de seguridad del script apply de vinculación pagos→créditos.
 *
 * REGLAS ESTRICTAS — SOLO LECTURA / VERIFICACIÓN ESTÁTICA:
 * - NO ejecuta ningún script
 * - NO modifica ningún dato ni archivo de negocio
 * - Solo verifica existencia de archivos y contenido del script apply
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
  return existsSync(p) ? readFileSync(p, 'utf8') : ''
}

function fileLower(rel) { return fileContent(rel).toLowerCase() }

console.log('\n══════════════════════════════════════════════════════════════')
console.log('  CEJUASSA — Check: Apply Link Pagos → Créditos (9C-6F)')
console.log('══════════════════════════════════════════════════════════════\n')

const applyScript = fileContent('scripts/apply-link-pagos-creditos.mjs')
const applyLower  = applyScript.toLowerCase()

// ─── 1. Existencia de archivos ────────────────────────────────────────────────

console.log('📁 1. Existencia de archivos requeridos:')
check('Script apply existe',         fileExists('scripts/apply-link-pagos-creditos.mjs'))
check('Check script existe',         fileExists('scripts/check-pagos-creditos-link-apply.mjs'))
check('Preview JSON existe',         fileExists('docs/ai-recovery/proposed_pago_credito_links_preview.json'),
  'Ejecutar primero: npm run pagos:link-creditos:dry-run')

const dryRunReportExists = fileExists('docs/ai-recovery/PAGOS_CREDITOS_LINK_APPLY_DRY_RUN.md')
if (dryRunReportExists) {
  check('Reporte dry-run apply existe', true)
} else {
  console.log('  ⚠️  Reporte dry-run apply aún no existe — ejecutar: npm run pagos:link-creditos:apply:dry-run')
}

// ─── 2. Soporta modo dry-run ──────────────────────────────────────────────────

console.log('\n🔀 2. Soporte de modos:')
check('Soporta --dry-run',
  applyScript.includes('--dry-run') && applyScript.includes('IS_DRY_RUN'))
check('Soporta --apply',
  applyScript.includes('--apply') && applyScript.includes('IS_APPLY'))
check('Requiere --authorized para apply',
  applyScript.includes('--authorized'))
check('Lee preview JSON',
  applyScript.includes('proposed_pago_credito_links_preview.json'))

// ─── 3. Solo aplica match_alto ────────────────────────────────────────────────

console.log('\n🎯 3. Solo aplica categoría match_alto:')
check("Filtra por 'match_alto'",
  applyScript.includes("'match_alto'"))
check('Genera set matchAltoSet o equivalente',
  applyScript.includes('matchAltoSet') || applyScript.includes('match_alto'))
check('No aplica match_medio (sin update de match_medio)',
  !applyScript.includes("categoria === 'match_medio'") ||
  (applyScript.includes("match_medio") && applyScript.includes('NO serán aplicados') || applyScript.includes('requieren revisión'))
)
check('Preflight verifica exactamente 28 match_alto',
  applyScript.includes('28'))

// ─── 4. Solo actualiza pagos_recibos.id_credito ───────────────────────────────

console.log('\n🔑 4. Operación acotada — solo pagos_recibos.id_credito:')
check("Update solo en 'pagos_recibos'",
  applyLower.includes("from('pagos_recibos')") || applyLower.includes('from("pagos_recibos")'))
check('Solo actualiza id_credito',
  applyScript.includes('{ id_credito: r.credito_id }') ||
  applyScript.includes("id_credito:"))
check('Guarda de seguridad .is(id_credito, null)',
  applyScript.includes(".is('id_credito', null)") || applyScript.includes('.is("id_credito", null)'))

// ─── 5. No toca cronograma_cuotas ────────────────────────────────────────────

console.log('\n🚫 5. Tablas prohibidas — confirmar que el script NO modifica:')

check('No hace UPDATE en cronograma_cuotas',
  !applyLower.includes("from('cronograma_cuotas').update") &&
  !applyLower.includes('from("cronograma_cuotas").update')
)
check('No hace INSERT en cronograma_cuotas',
  !applyLower.includes("from('cronograma_cuotas').insert") &&
  !applyLower.includes('from("cronograma_cuotas").insert')
)

check('No modifica creditos',
  !applyLower.includes("from('creditos').update") &&
  !applyLower.includes('from("creditos").update') &&
  !applyLower.includes("from('creditos').insert") &&
  !applyLower.includes('from("creditos").insert')
)
check('No modifica socios',
  !applyLower.includes("from('socios').update") &&
  !applyLower.includes('from("socios").update') &&
  !applyLower.includes("from('socios').insert") &&
  !applyLower.includes('from("socios").insert')
)
check('No modifica usuarios',
  !applyLower.includes("from('usuarios').update") &&
  !applyLower.includes("from('usuarios').insert")
)
check('No modifica configuracion',
  !applyLower.includes("from('configuracion').update") &&
  !applyLower.includes("from('configuracion').insert")
)
check('No toca auth.users',
  !applyLower.includes('auth.admin.deleteuser') &&
  !applyLower.includes('auth.admin.createuser') &&
  !applyLower.includes('auth.admin.updateuserbyid')
)

// ─── 6. No crea migraciones ───────────────────────────────────────────────────

console.log('\n📄 6. No crea migraciones ni DDL:')
check('No referencia supabase/migrations',
  !applyLower.includes('supabase/migrations') && !applyLower.includes('migration'))
check('No contiene CREATE TABLE',  !applyLower.includes('create table'))
check('No contiene ALTER TABLE',   !applyLower.includes('alter table'))
check('No contiene DROP TABLE',    !applyLower.includes('drop table'))

// ─── 7. No toca _client_files ─────────────────────────────────────────────────

console.log('\n📂 7. No toca _client_files:')
// Solo escribe en docs/ai-recovery — no en _client_files/
check('No escribe en _client_files/',
  !applyScript.includes("resolve(ROOT, '_client_files") &&
  !applyScript.includes('resolve(ROOT, "_client_files')
)

// ─── 8. Comandos npm registrados ─────────────────────────────────────────────

console.log('\n📦 8. Comandos npm registrados en package.json:')
const pkg = fileLower('package.json')
check('npm run pagos:link-creditos:apply:dry-run',  pkg.includes('pagos:link-creditos:apply:dry-run'))
check('npm run pagos:link-creditos:apply',          pkg.includes('pagos:link-creditos:apply'))
check('npm run check:pagos-link-creditos-apply',    pkg.includes('check:pagos-link-creditos-apply'))

// ─── 9. Preflight y guardas ───────────────────────────────────────────────────

console.log('\n🛡️  9. Preflight y guardas de seguridad:')
check('Verifica que pago tenga id_credito = NULL antes de apply',
  applyScript.includes('id_credito IS NULL') || applyScript.includes('.is(\'id_credito\', null)') ||
  applyScript.includes('.is("id_credito", null)'))
check('Aborta si preflight falla',
  applyScript.includes('preflightOk = false') && applyScript.includes('process.exit(1)'))
check('Verifica que crédito propuesto exista en DB',
  applyScript.includes('credito_faltantes') || applyScript.includes('creditos_faltantes') ||
  applyScript.includes('creditosById'))
check('Genera reporte de apply',
  applyScript.includes('PAGOS_CREDITOS_LINK_APPLY_REPORT.md'))
check('Genera reporte de dry-run',
  applyScript.includes('PAGOS_CREDITOS_LINK_APPLY_DRY_RUN.md'))

// ─── 10. Reporte dry-run apply (si existe) ────────────────────────────────────

console.log('\n📋 10. Reporte PAGOS_CREDITOS_LINK_APPLY_DRY_RUN.md (si existe):')
const dryRunReport = fileLower('docs/ai-recovery/PAGOS_CREDITOS_LINK_APPLY_DRY_RUN.md')
if (dryRunReport) {
  check('Menciona match_alto',           dryRunReport.includes('match_alto'))
  check('Menciona que es dry-run',       dryRunReport.includes('dry-run') || dryRunReport.includes('solo lectura'))
  check('Menciona autorización requerida', dryRunReport.includes('vincular 28 pagos 9c-6f') || dryRunReport.includes('autorización'))
  check('Confirma cronograma no modificado', dryRunReport.includes('cronograma') && dryRunReport.includes('no'))
} else {
  console.log('  ⚠️  Reporte dry-run apply aún no existe — ejecutar: npm run pagos:link-creditos:apply:dry-run')
}

// ─── Resultado final ──────────────────────────────────────────────────────────

const total = pass + fail
console.log(`\n══════════════════════════════════════════════════════════════`)
console.log(`  Resultado: ${pass}/${total} checks PASS`)
if (fail > 0) {
  console.log(`  ⚠️  ${fail} checks fallidos — revisar antes de ejecutar apply`)
} else {
  console.log(`  ✅ Script apply verificado y seguro para ejecutar`)
  console.log(`  📌 Para aplicar: enviar autorización exacta "VINCULAR 28 PAGOS 9C-6F"`)
}
console.log(`══════════════════════════════════════════════════════════════\n`)

process.exit(fail > 0 ? 1 : 0)
