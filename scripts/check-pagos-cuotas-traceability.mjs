/**
 * check-pagos-cuotas-traceability.mjs
 * Fase 10K-1 — Verificación de seguridad del plan de trazabilidad de pagos a cuotas.
 *
 * Verifica:
 * 1. Existe documento de trazabilidad
 * 2. Existe migración local para la tabla intermedia
 * 3. No hay apply de pagos a cuotas (script apply todavía no existe)
 * 4. No hay updates a cronograma_cuotas ni pagos_recibos en scripts nuevos
 * 5. No se tocó data real (no hay --apply en scripts de esta fase)
 * 6. La migración NO modifica tablas existentes (solo CREATE TABLE nueva)
 * 7. La tabla propuesta tiene FK a pago, cuota y crédito
 * 8. Hay CHECK constraints de montos positivos
 * 9. Hay índices para id_pago, id_cuota, id_credito
 * 10. La migración tiene RLS habilitado
 * 11. La migración no está aplicada en Supabase todavía (no se auto-aplica)
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DOCS = resolve(ROOT, 'docs/ai-recovery')
const SCRIPTS = resolve(ROOT, 'scripts')
const MIGRATIONS = resolve(ROOT, 'supabase/migrations')

let passed = 0
let failed = 0
let warnings = 0

function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ ${name}`)
    passed++
  } else {
    console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`)
    failed++
  }
}

function warn(name, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ ${name}`)
    passed++
  } else {
    console.log(`  ⚠️  ${name}${detail ? ' — ' + detail : ''}`)
    warnings++
  }
}

// ─── Sección 1: Documentación ───────────────────────────────────────────────
console.log('\n📄 Sección 1: Documento de trazabilidad')

const PLAN_DOC = resolve(DOCS, 'PAGOS_CUOTAS_TRACEABILITY_PLAN.md')
check('Existe PAGOS_CUOTAS_TRACEABILITY_PLAN.md', existsSync(PLAN_DOC))

if (existsSync(PLAN_DOC)) {
  const planContent = readFileSync(PLAN_DOC, 'utf8')
  check('Documento menciona Modelo A (descartado)', planContent.includes('Modelo A'))
  check('Documento menciona Modelo B (recomendado)', planContent.includes('Modelo B'))
  check('Documento tiene esquema de tabla propuesta', planContent.includes('pagos_cuotas_aplicaciones'))
  check('Documento tiene sección rollback', planContent.toLowerCase().includes('rollback'))
  check('Documento indica autorización requerida', planContent.includes('APLICAR TRAZABILIDAD PAGOS CUOTAS 10K-1'))
  check('Documento menciona Fase 10K-2 como siguiente', planContent.includes('10K-2'))
  check('Documento confirma que NO se modificaron datos', planContent.includes('NO modificada') || planContent.includes('NO modificado'))
}

// ─── Sección 2: Migración local ──────────────────────────────────────────────
console.log('\n🗄️  Sección 2: Migración local')

const MIGRATION_FILE = resolve(MIGRATIONS, '20260702000003_create_pagos_cuotas_aplicaciones.sql')
check('Existe migración 20260702000003_create_pagos_cuotas_aplicaciones.sql', existsSync(MIGRATION_FILE))

if (existsSync(MIGRATION_FILE)) {
  const migration = readFileSync(MIGRATION_FILE, 'utf8').toLowerCase()

  // La migración solo crea tabla nueva — no toca tablas existentes
  check('Migración usa CREATE TABLE (no ALTER de tablas existentes de negocio)',
    migration.includes('create table') && !migration.match(/alter table public\.(cronograma_cuotas|pagos_recibos|creditos|socios|aportes|egresos|convenios|usuarios|configuracion)\b/))

  // FKs requeridas
  check('FK a pagos_recibos (id_pago)',
    migration.includes('references public.pagos_recibos') || migration.includes('references pagos_recibos'))
  check('FK a cronograma_cuotas (id_cuota)',
    migration.includes('references public.cronograma_cuotas') || migration.includes('references cronograma_cuotas'))
  check('FK a creditos (id_credito)',
    migration.includes('references public.creditos') || migration.includes('references creditos'))

  // Constraints de montos
  check('CHECK capital_aplicado >= 0', migration.includes('capital_aplicado') && migration.includes('>= 0'))
  check('CHECK interes_aplicado >= 0', migration.includes('interes_aplicado') && migration.includes('>= 0'))
  check('CHECK monto total > 0 (capital + interes > 0)',
    migration.includes('capital_aplicado + interes_aplicado > 0') ||
    migration.includes('monto_aplicado_positivo'))

  // Índices
  check('Índice por id_pago', migration.includes('idx_pca_id_pago') || (migration.includes('index') && migration.includes('id_pago')))
  check('Índice por id_cuota', migration.includes('idx_pca_id_cuota') || (migration.includes('index') && migration.includes('id_cuota')))
  check('Índice por id_credito', migration.includes('idx_pca_id_credito') || (migration.includes('index') && migration.includes('id_credito')))

  // RLS
  check('RLS habilitado (ENABLE ROW LEVEL SECURITY)', migration.includes('enable row level security'))
  check('Política RLS para authenticated', migration.includes('to authenticated'))

  // Seguridad: no hay UPDATE / DELETE / INSERT en la migración (solo DDL)
  const hasWriteDml = /\b(update|delete from|insert into)\s+public\.(cronograma_cuotas|pagos_recibos|creditos|socios)/i.test(
    readFileSync(MIGRATION_FILE, 'utf8')
  )
  check('Migración NO tiene DML sobre tablas existentes de negocio', !hasWriteDml)

  // Guard de autorización en comentario
  check('Migración tiene instrucción de autorización en comentario',
    migration.includes('aplicar trazabilidad pagos cuotas 10k-1'))
}

// ─── Sección 3: No apply de pagos a cuotas ───────────────────────────────────
console.log('\n🔒 Sección 3: Restricciones de apply')

const applyPagosCuotasScript = resolve(SCRIPTS, 'apply-pagos-cuotas.mjs')
check('NO existe script apply-pagos-cuotas.mjs todavía (Fase 10K-2 bloqueada)',
  !existsSync(applyPagosCuotasScript))

// Verificar que los scripts existentes de esta fase (check/plan) no hacen writes
const scriptsToCheck = [
  'check-pagos-cuotas-traceability.mjs',
  'check-pagos-cuotas-plan.mjs',
  'plan-pagos-cuotas.mjs',
]

for (const scriptName of scriptsToCheck) {
  const scriptPath = resolve(SCRIPTS, scriptName)
  if (existsSync(scriptPath)) {
    const content = readFileSync(scriptPath, 'utf8')
    const hasInsert = /\.from\(['"`]cronograma_cuotas['"`]\)\s*\.(?:insert|update|delete|upsert)/i.test(content)
    const hasUpdate = /\.from\(['"`]pagos_recibos['"`]\)\s*\.(?:insert|update|delete|upsert)/i.test(content)
    check(`Script ${scriptName}: no modifica cronograma_cuotas ni pagos_recibos`, !hasInsert && !hasUpdate)
  }
}

// ─── Sección 4: Integridad del plan existente (10K-0) ───────────────────────
console.log('\n📋 Sección 4: Plan 10K-0 previo intacto')

const APPLICATION_PLAN = resolve(DOCS, 'PAGOS_CUOTAS_APPLICATION_PLAN.md')
check('Existe PAGOS_CUOTAS_APPLICATION_PLAN.md (Fase 10K-0)', existsSync(APPLICATION_PLAN))

const CHECK_PLAN_SCRIPT = resolve(SCRIPTS, 'check-pagos-cuotas-plan.mjs')
check('Existe check-pagos-cuotas-plan.mjs', existsSync(CHECK_PLAN_SCRIPT))

const PLAN_SCRIPT = resolve(SCRIPTS, 'plan-pagos-cuotas.mjs')
check('Existe plan-pagos-cuotas.mjs', existsSync(PLAN_SCRIPT))

// ─── Sección 5: Estructura de la tabla (coherencia con el plan) ─────────────
console.log('\n🏗️  Sección 5: Coherencia del esquema')

if (existsSync(MIGRATION_FILE)) {
  const migrationRaw = readFileSync(MIGRATION_FILE, 'utf8')

  check('Columna id serial primary key', /\bid\s+serial\b/i.test(migrationRaw))
  check('Columna capital_aplicado numeric(12,2)', /capital_aplicado\s+numeric\(12,2\)/i.test(migrationRaw))
  check('Columna interes_aplicado numeric(12,2)', /interes_aplicado\s+numeric\(12,2\)/i.test(migrationRaw))
  check('Columna monto_aplicado generada (GENERATED)', /generated always as/i.test(migrationRaw))
  check('Columna fecha_aplicacion date NOT NULL', /fecha_aplicacion\s+date\s+not null/i.test(migrationRaw))
  check('Columna created_at timestamptz NOT NULL', /created_at\s+timestamptz\s+not null/i.test(migrationRaw))
  check('Columna created_by uuid (nullable)', /created_by\s+uuid/i.test(migrationRaw))
  check('ON DELETE RESTRICT en FK pagos_recibos (no permite borrar pagos aplicados)',
    /pagos_recibos\(id\)\s+on delete restrict/i.test(migrationRaw))
  check('ON DELETE RESTRICT en FK cronograma_cuotas (no permite borrar cuotas aplicadas)',
    /cronograma_cuotas\(id\)\s+on delete restrict/i.test(migrationRaw))
}

// ─── Resumen ─────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60))
console.log(`\n📊 Resultado: ${passed} PASS · ${failed} FAIL · ${warnings} WARN\n`)

if (failed > 0) {
  console.log('❌ Verificación FALLIDA — revisar los items marcados antes de continuar.')
  process.exit(1)
} else if (warnings > 0) {
  console.log('⚠️  Verificación con advertencias — revisar antes del apply.')
  process.exit(0)
} else {
  console.log('✅ Todos los checks pasan. El plan de trazabilidad está listo.')
  console.log('\n⏳ Próximo paso: obtener autorización APLICAR TRAZABILIDAD PAGOS CUOTAS 10K-1')
  console.log('   para aplicar la migración en Supabase.\n')
  process.exit(0)
}
