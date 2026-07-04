/**
 * check-cronograma-apply.mjs
 * Fase 9C-6D — Verificador del script apply-regenerate-cronogramas.mjs
 *
 * Verifica:
 * - Existe el script apply
 * - Tiene modo dry-run
 * - Tiene modo apply
 * - Tiene guard anti-duplicado
 * - No toca pagos_recibos
 * - No toca creditos (solo lectura)
 * - No toca socios
 * - No toca usuarios / configuracion / auth.users
 * - No crea migraciones
 * - No toca _client_files
 * - Existe reporte post-apply si ya se ejecutó apply
 */

import { existsSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const checks = []
let passed = 0
let failed = 0

function check(name, result, detail = '') {
  const ok = result === true
  checks.push({ name, ok, detail })
  if (ok) { passed++; console.log(`  ✅ ${name}`) }
  else { failed++; console.error(`  ❌ ${name}${detail ? ': ' + detail : ''}`) }
}

function checkNot(name, content, forbidden, detail = '') {
  // Eliminar comentarios de línea antes de buscar patrones prohibidos
  const sinComentarios = content
    .split('\n')
    .filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
    .join('\n')
  const found = sinComentarios.includes(forbidden)
  check(name, !found, found ? `contiene "${forbidden}"` : detail)
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('  Check — apply-regenerate-cronogramas.mjs')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

// 1. Existe el script apply
const SCRIPT_PATH = resolve(ROOT, 'scripts/apply-regenerate-cronogramas.mjs')
const exists = existsSync(SCRIPT_PATH)
check('Existe scripts/apply-regenerate-cronogramas.mjs', exists)

if (!exists) {
  console.error('\n❌ Script no encontrado. No se pueden ejecutar más checks.\n')
  process.exit(1)
}

const content = readFileSync(SCRIPT_PATH, 'utf8')

// 2. Tiene modo dry-run
check('Soporta --dry-run', content.includes("'dry-run'") || content.includes('"dry-run"'))

// 3. Tiene modo apply
check('Soporta --apply', content.includes("'--apply'") || content.includes('"--apply"'))

// 4. Tiene guard anti-duplicado (verifica cronograma_cuotas antes de insertar)
check('Guard anti-duplicado (verifica countCron > 0)', content.includes('countCron > 0'))

// 5. Tiene guard de autorización para apply
check('Guard --authorized para apply real', content.includes('--authorized') && content.includes('IS_AUTHORIZED'))

// 6. No toca pagos_recibos (no hace insert/update/delete en esa tabla)
const linesPagos = content.split('\n').filter(l => {
  const stripped = l.trim()
  if (stripped.startsWith('//') || stripped.startsWith('*')) return false
  return stripped.includes("'pagos_recibos'") || stripped.includes('"pagos_recibos"')
})
const tocaPagos = linesPagos.some(l => {
  const lower = l.toLowerCase()
  return lower.includes('.insert(') || lower.includes('.update(') || lower.includes('.delete(') || lower.includes('.upsert(')
})
check('No modifica pagos_recibos', !tocaPagos, tocaPagos ? 'contiene operación de escritura en pagos_recibos' : '')

// 7. No toca socios (no hace insert/update/delete en esa tabla)
const linesSocios = content.split('\n').filter(l => {
  const stripped = l.trim()
  if (stripped.startsWith('//') || stripped.startsWith('*')) return false
  return stripped.includes("'socios'") || stripped.includes('"socios"')
})
const tocaSocios = linesSocios.some(l => {
  const lower = l.toLowerCase()
  return lower.includes('.insert(') || lower.includes('.update(') || lower.includes('.delete(') || lower.includes('.upsert(')
})
check('No modifica socios', !tocaSocios)

// 8. No toca creditos con operaciones de escritura
const linesCreditos = content.split('\n').filter(l => {
  const stripped = l.trim()
  if (stripped.startsWith('//') || stripped.startsWith('*')) return false
  return stripped.includes("'creditos'") || stripped.includes('"creditos"')
})
const tocaCreditosWrite = linesCreditos.some(l => {
  const lower = l.toLowerCase()
  return lower.includes('.insert(') || lower.includes('.update(') || lower.includes('.delete(') || lower.includes('.upsert(')
})
check('No modifica creditos (solo lectura)', !tocaCreditosWrite)

// 9. No toca usuarios
checkNot('No toca tabla usuarios', content, "from('usuarios')")

// 10. No toca configuracion
checkNot('No toca tabla configuracion', content, "from('configuracion')")

// 11. No toca auth.users
checkNot('No referencia auth.users', content, 'auth.users')

// 12. No crea migraciones
const noMigraciones = !content.includes('supabase migration') &&
  !content.includes('db push') &&
  !content.includes('.sql') &&
  !content.includes('migrate')
check('No crea migraciones SQL', noMigraciones)

// 13. No toca _client_files
checkNot('No toca _client_files/', content, '_client_files')

// 14. Tiene preflight con verificación de 26 créditos
check('Preflight verifica 26 créditos vigentes', content.includes('EXPECTED_VIGENTES') && content.includes('26'))

// 15. Preflight verifica 911 cuotas
check('Preflight verifica 911 cuotas', content.includes('EXPECTED_CUOTAS') && content.includes('911'))

// 16. Inserta en lotes (no una a una)
check('Inserta en lotes seguros', content.includes('BATCH_SIZE') && content.includes('lotes'))

// 17. Genera reporte post-apply
check('Genera reporte APPLY_REPORT.md', content.includes('CRONOGRAMA_REGENERATION_APPLY_REPORT'))

// 18. Existe reporte si ya se ejecutó apply
const REPORT_PATH = resolve(ROOT, 'docs/ai-recovery/CRONOGRAMA_REGENERATION_APPLY_REPORT.md')
const reportExists = existsSync(REPORT_PATH)
if (reportExists) {
  const reportContent = readFileSync(REPORT_PATH, 'utf8')
  const esApply = reportContent.includes('APPLY EJECUTADO')
  if (esApply) {
    check('Reporte post-apply existe y es de apply real', true)
  } else {
    check('Reporte post-apply existe (dry-run; apply aún no ejecutado)', true, 'aún no se ejecutó apply real')
  }
} else {
  check('Reporte post-apply existe (opcional antes de apply)', true, 'aún no generado — OK si no se ejecutó aún')
}

// ─── Resumen ──────────────────────────────────────────────────────────────────

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(`  Resultado: ${passed} OK / ${failed} FALLIDOS / ${checks.length} total`)
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

if (failed > 0) {
  console.error(`❌ ${failed} check(s) fallidos.\n`)
  process.exit(1)
} else {
  console.log('✅ Todos los checks pasaron.\n')
}
