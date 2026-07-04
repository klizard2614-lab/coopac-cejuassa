/**
 * check-ampliaciones-funcionales-plan.mjs
 * Fase 10J-0 — Verificación del plan de ampliaciones funcionales
 *
 * Verifica que:
 * - El documento de plan existe y contiene las secciones clave
 * - El script dry-run existe y es seguro (sin apply, sin updates a tablas prohibidas)
 * - No hay migraciones nuevas relacionadas con ampliaciones
 * - No hay updates reales a creditos/cronograma/pagos en el script
 * - El plan advierte que no recalcula cronograma
 * - El plan resuelve la ambigüedad de monto_nuevo
 *
 * Uso: npm run check:ampliaciones-funcionales-plan
 */

import { existsSync, readFileSync, readdirSync } from 'fs'
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

const PLAN_DOC = 'docs/ai-recovery/AMPLIACIONES_FUNCIONALES_PLAN.md'
const DRY_RUN  = 'scripts/plan-ampliaciones-funcionales.mjs'

console.log('=== CHECK: Plan de Ampliaciones Funcionales (Fase 10J-0) ===\n')

// ── Existencia de artefactos ───────────────────────────────────────────────
console.log('[ Existencia de artefactos ]')
check('Documento de plan existe', fileExists(PLAN_DOC), PLAN_DOC)
check('Script dry-run existe', fileExists(DRY_RUN), DRY_RUN)

// ── Contenido del documento de plan ──────────────────────────────────────
console.log('\n[ Contenido del plan — secciones requeridas ]')
check(
  'Plan documenta regla confirmada por contadora',
  fileContains(PLAN_DOC, 'Regla Confirmada', 'suma el monto') ||
  fileContains(PLAN_DOC, 'confirmada', 'monto_aprobado')
)
check(
  'Plan documenta reglas NO confirmadas',
  fileContains(PLAN_DOC, 'NO Confirmadas') || fileContains(PLAN_DOC, 'Sin confirmar')
)
check(
  'Plan resuelve ambigüedad de monto_nuevo',
  fileContains(PLAN_DOC, 'monto_nuevo') &&
  (fileContains(PLAN_DOC, 'total resultante') || fileContains(PLAN_DOC, 'Opción B') || fileContains(PLAN_DOC, 'monto aprobado total'))
)
check(
  'Plan advierte que NO se recalcula el cronograma',
  fileContains(PLAN_DOC, 'NO se recalculará') || fileContains(PLAN_DOC, 'cronograma') && fileContains(PLAN_DOC, 'NO TOCAR')
)
check(
  'Plan describe impacto en tabla creditos',
  fileContains(PLAN_DOC, 'creditos') && fileContains(PLAN_DOC, 'monto_aprobado') && fileContains(PLAN_DOC, 'saldo_capital')
)
check(
  'Plan incluye rollback propuesto',
  fileContains(PLAN_DOC, 'Rollback') || fileContains(PLAN_DOC, 'rollback')
)
check(
  'Plan especifica que cronograma y pagos NO se tocan',
  fileContains(PLAN_DOC, 'cronograma_cuotas') && fileContains(PLAN_DOC, 'pagos_recibos') &&
  (fileContains(PLAN_DOC, 'NO TOCAR') || fileContains(PLAN_DOC, 'No tocar') || fileContains(PLAN_DOC, 'no se toca'))
)
check(
  'Plan incluye lista de riesgos',
  fileContains(PLAN_DOC, 'Riesgo') || fileContains(PLAN_DOC, 'riesgo')
)
check(
  'Plan describe vista previa propuesta para UI',
  fileContains(PLAN_DOC, 'Vista Previa') || fileContains(PLAN_DOC, 'vista previa')
)

// ── Seguridad del script dry-run ──────────────────────────────────────────
console.log('\n[ Seguridad del script dry-run — sin apply ni modificaciones ]')

check(
  'Script no tiene modo --apply',
  fileNotContains(DRY_RUN, '--apply', 'applyRun', 'APPLY')
)
check(
  'Script no hace UPDATE a creditos',
  fileNotContains(DRY_RUN, ".update(", "UPDATE creditos", "update creditos")
)
check(
  'Script no hace INSERT en ampliaciones',
  fileNotContains(DRY_RUN, ".insert(", "INSERT INTO ampliaciones")
)
check(
  'Script no hace DELETE en ninguna tabla',
  fileNotContains(DRY_RUN, ".delete(", "DELETE FROM")
)
check(
  'Script no toca cronograma_cuotas (write)',
  fileNotContains(DRY_RUN, "from('cronograma_cuotas').update", "from('cronograma_cuotas').insert", "from('cronograma_cuotas').delete")
)
check(
  'Script no toca pagos_recibos (write)',
  fileNotContains(DRY_RUN, "from('pagos_recibos').update", "from('pagos_recibos').insert", "from('pagos_recibos').delete")
)
check(
  'Script declara que no modifica nada (comentario o mensaje)',
  fileContains(DRY_RUN, 'NO modifica') || fileContains(DRY_RUN, 'no modifica') || fileContains(DRY_RUN, 'DRY-RUN')
)

// ── El script lee creditos (SELECT permitido) ─────────────────────────────
console.log('\n[ El script hace consultas de solo lectura ]')
check(
  'Script consulta tabla creditos (SELECT)',
  fileContains(DRY_RUN, "from('creditos')")
)
check(
  'Script consulta tabla ampliaciones (COUNT)',
  fileContains(DRY_RUN, "from('ampliaciones')")
)

// ── Sin migraciones nuevas relacionadas a ampliaciones ────────────────────
console.log('\n[ Sin migraciones nuevas de ampliaciones ]')

const migrationsDir = resolve(root, 'supabase', 'migrations')
let ampliacionMigrations = []
if (existsSync(migrationsDir)) {
  const files = readdirSync(migrationsDir)
  ampliacionMigrations = files.filter(f =>
    f.toLowerCase().includes('ampliacion') &&
    !f.includes('placeholder')
  )
}
check(
  'No hay migraciones nuevas de ampliaciones en supabase/migrations/',
  ampliacionMigrations.length === 0,
  ampliacionMigrations.length > 0
    ? `Encontradas: ${ampliacionMigrations.join(', ')}`
    : ''
)

// ── Sin alter table en scripts de ampliaciones ────────────────────────────
console.log('\n[ Sin ALTER TABLE / CREATE TABLE en scripts de esta fase ]')
check(
  'Script dry-run no contiene ALTER TABLE',
  fileNotContains(DRY_RUN, 'ALTER TABLE', 'alter table')
)
check(
  'Script dry-run no contiene CREATE TABLE',
  fileNotContains(DRY_RUN, 'CREATE TABLE', 'create table')
)
check(
  'Script dry-run no contiene DROP',
  fileNotContains(DRY_RUN, 'DROP TABLE', 'drop table')
)

// ── Comandos npm ──────────────────────────────────────────────────────────
console.log('\n[ Comandos npm en package.json ]')
const pkg = readFile('package.json')
check(
  'npm run plan:ampliaciones-funcionales registrado',
  pkg.includes('plan:ampliaciones-funcionales')
)
check(
  'npm run check:ampliaciones-funcionales-plan registrado',
  pkg.includes('check:ampliaciones-funcionales-plan')
)

// ── Resultado ─────────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(60))
if (failures === 0) {
  console.log('✅ CHECK PASSED — Plan de ampliaciones funcionales completo y seguro.')
  console.log('   Próxima acción: confirmar reglas con contadora antes de Fase 10J-1.')
} else {
  console.log(`❌ CHECK FAILED — ${failures} problema(s) encontrado(s).`)
  process.exit(1)
}
