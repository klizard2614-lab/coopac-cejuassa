/**
 * check-pagos-cuotas-plan.mjs
 * Fase 10K-0 — Verificación de seguridad del plan de aplicación de pagos a cuotas.
 *
 * Verifica:
 * - Existe documento de plan
 * - Existe script dry-run (plan-pagos-cuotas.mjs)
 * - Existe script dry-run anterior (dry-run-apply-pagos-to-cuotas.mjs)
 * - NO existe script apply todavía (apply-pagos-to-cuotas.mjs)
 * - NO hay migraciones nuevas no autorizadas
 * - Los scripts no contienen UPDATE / INSERT / DELETE / TRUNCATE
 * - Los scripts no tocan pagos_recibos en modo escritura
 * - Los scripts no tocan cronograma_cuotas en modo escritura
 * - Los scripts no tocan creditos en modo escritura
 * - Los scripts no tocan socios en modo escritura
 * - El plan distingue pago de crédito vs aporte/FPS/otros
 * - El plan advierte riesgos de pagos mixtos
 * - El plan documenta campos faltantes (id_pago)
 * - El script es dry-run únicamente (tiene declaración explícita)
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

console.log('\n══════════════════════════════════════════════════════════════')
console.log('  CEJUASSA — Check: Plan pagos → cuotas (10K-0)')
console.log('══════════════════════════════════════════════════════════════\n')

// ─── Bloque 1: Existencia de archivos ─────────────────────────────────────────

console.log('📁 Bloque 1 — Existencia de archivos requeridos')

const PLAN_PATH      = resolve(DOCS, 'PAGOS_CUOTAS_APPLICATION_PLAN.md')
const SCRIPT_PATH    = resolve(SCRIPTS, 'plan-pagos-cuotas.mjs')
const CHECK_PATH     = resolve(SCRIPTS, 'check-pagos-cuotas-plan.mjs')
const OLD_SCRIPT     = resolve(SCRIPTS, 'dry-run-apply-pagos-to-cuotas.mjs')
const OLD_CHECK      = resolve(SCRIPTS, 'check-pagos-to-cuotas-plan.mjs')
const OLD_REPORT     = resolve(DOCS, 'PAGOS_TO_CUOTAS_DRY_RUN_REPORT.md')
const APPLY_PATH     = resolve(SCRIPTS, 'apply-pagos-to-cuotas.mjs')
const APPLY_PATH2    = resolve(SCRIPTS, 'apply-pagos-cuotas.mjs')

check('Plan PAGOS_CUOTAS_APPLICATION_PLAN.md existe', existsSync(PLAN_PATH))
check('Script plan-pagos-cuotas.mjs existe', existsSync(SCRIPT_PATH))
check('Script check-pagos-cuotas-plan.mjs existe', existsSync(CHECK_PATH))
check('Script dry-run anterior (9C-6H.0) existe', existsSync(OLD_SCRIPT))
check('Check anterior (9C-6H.0) existe', existsSync(OLD_CHECK))
check('Reporte anterior (9C-6H.0) existe', existsSync(OLD_REPORT))
check('Script apply-pagos-to-cuotas.mjs NO existe aún', !existsSync(APPLY_PATH),
  'apply-pagos-to-cuotas.mjs no debe existir en esta fase')
check('Script apply-pagos-cuotas.mjs NO existe aún', !existsSync(APPLY_PATH2),
  'apply-pagos-cuotas.mjs no debe existir en esta fase')

// ─── Bloque 2: Análisis del script plan-pagos-cuotas.mjs ─────────────────────

console.log('\n🔍 Bloque 2 — Análisis del script plan-pagos-cuotas.mjs')

if (existsSync(SCRIPT_PATH)) {
  const script = readFileSync(SCRIPT_PATH, 'utf8')
  const scriptNoComments = script
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '')

  // No debe tener operaciones SQL directas de escritura
  check('Script NO contiene SQL UPDATE', !/\bUPDATE\s+\w/i.test(scriptNoComments))
  check('Script NO contiene SQL INSERT INTO', !/\bINSERT\s+INTO\s/i.test(scriptNoComments))
  check('Script NO contiene SQL DELETE FROM', !/\bDELETE\s+FROM\s/i.test(scriptNoComments))
  check('Script NO contiene SQL TRUNCATE', !/\bTRUNCATE\s+/i.test(scriptNoComments))

  // No debe hacer escrituras con Supabase JS SDK
  const tablasSinEscritura = ['cronograma_cuotas', 'pagos_recibos', 'creditos', 'socios', 'aportes', 'egresos']
  for (const tabla of tablasSinEscritura) {
    const pattern = new RegExp(`\\.from\\(['"]${tabla}['"]\\)\\s*\\.\\s*(update|insert|upsert|delete)\\s*\\(`, 'i')
    check(`Script NO escribe en ${tabla}`, !pattern.test(script))
  }

  // No debe tocar auth
  check('Script NO llama supabase.auth.admin', !/supabase\.auth\.admin\./i.test(scriptNoComments))

  // No crea migraciones
  check('Script NO crea migraciones', !/supabase\/migrations/i.test(script) && !/db\.push/i.test(scriptNoComments))

  // Tiene declaración de DRY-RUN
  check('Script declara SOLO LECTURA / DRY-RUN', script.includes('DRY-RUN') || script.includes('SOLO LECTURA'))

  // Tiene algoritmo de cascada
  check('Script implementa algoritmo de cascada', script.includes('cascada') || script.includes('montoDisponible'))

  // Lee las tablas esperadas
  check('Script lee pagos_recibos (SELECT)', script.includes("from('pagos_recibos')"))
  check('Script lee cronograma_cuotas (SELECT)', script.includes("from('cronograma_cuotas')"))
  check('Script lee creditos (SELECT)', script.includes("from('creditos')"))

  // Distingue pago de crédito vs aporte/FPS
  check('Script distingue monto_capital/interes de aporte/FPS',
    script.includes('monto_aporte') && script.includes('monto_fps') && script.includes('monto_capital'))

  // Detecta pagos mixtos
  check('Script detecta pagos mixtos', script.includes('esMixto') || script.includes('mixto'))

  // Detecta excedentes
  check('Script detecta excedentes', script.includes('excedente'))

  // Guarda preview JSON
  check('Script guarda preview JSON', script.includes('.json') && script.includes('writeFileSync'))

} else {
  for (let i = 0; i < 22; i++) check(`[script no encontrado — check ${i + 1}]`, false)
}

// ─── Bloque 3: Análisis del plan PAGOS_CUOTAS_APPLICATION_PLAN.md ────────────

console.log('\n📄 Bloque 3 — Análisis del plan PAGOS_CUOTAS_APPLICATION_PLAN.md')

if (existsSync(PLAN_PATH)) {
  const plan = readFileSync(PLAN_PATH, 'utf8')

  check('Plan tiene sección de estructura actual', plan.includes('Estructura actual'))
  check('Plan documenta cronograma_cuotas', plan.includes('cronograma_cuotas'))
  check('Plan documenta pagos_recibos', plan.includes('pagos_recibos'))
  check('Plan responde si tablas permiten aplicar pagos', plan.includes('permiten aplicar pagos') || plan.includes('suficientes'))
  check('Plan documenta campo id_pago faltante', plan.includes('id_pago'))
  check('Plan documenta campo saldo_pendiente calculable', plan.includes('saldo_pendiente'))
  check('Plan tiene regla de monto (fórmula)', plan.includes('monto_capital') && plan.includes('monto_interes'))
  check('Plan excluye monto_aporte', plan.includes('monto_aporte') && (plan.includes('❌') || plan.includes('exclu')))
  check('Plan excluye monto_fps', plan.includes('monto_fps') && (plan.includes('❌') || plan.includes('exclu')))
  check('Plan advierte sobre pagos mixtos', plan.includes('mixto') || plan.includes('Mixtos'))
  check('Plan tiene algoritmo propuesto', plan.includes('Algoritmo') || plan.includes('algoritmo'))
  check('Plan tiene cascada en algoritmo', plan.includes('cascada') || plan.includes('siguiente cuota'))
  check('Plan tiene sección de riesgos', plan.includes('Riesgos') || plan.includes('riesgos'))
  check('Plan tiene plan por fases', plan.toLowerCase().includes('plan por fases') || plan.includes('Fases'))
  check('Plan documenta qué NO hacer', plan.includes('NO debe') || plan.includes('NO hacer'))
  check('Plan tiene preguntas para Contabilidad/Tesorería', plan.includes('Contabilidad') || plan.includes('Tesorería'))
  check('Plan tiene recomendación final', plan.includes('Recomendación') || plan.includes('recomendación'))
  check('Plan tiene evaluación de migración', plan.includes('migración') || plan.includes('migración necesaria'))

} else {
  for (let i = 0; i < 18; i++) check(`[plan no encontrado — check ${i + 1}]`, false)
}

// ─── Bloque 4: Verificar migraciones no autorizadas ───────────────────────────

console.log('\n🗄️  Bloque 4 — Verificar migraciones')

// Las migraciones conocidas y autorizadas (hasta Fase 10J-2B)
const MIGRACIONES_AUTORIZADAS = new Set([
  '20260605112510_remote_existing_migration_placeholder.sql',
  '20260617000000_create_decrementar_saldo_capital.sql',
  '20260617000001_create_registrar_aporte_socio.sql',
  '20260617000002_create_crear_credito_con_cronograma.sql',
  '20260617000003_fix_tipo_credito_cast.sql',
  '20260617000004_fix_estado_cuota_cast.sql',
  '20260620000001_bdcc_min_fields.sql',
  '20260623000001_create_socio_beneficiarios.sql',
])

// Incluir las migraciones de Fase 10J-2B (ampliaciones) y anteriores
const PATRON_MIGRACIONES_10J = /^2026062[3-9]|^20260630|^20260701|^20260702/

if (existsSync(MIGRATIONS)) {
  const { readdirSync } = await import('fs')
  const archivos = readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql'))

  const migracionesNuevas = archivos.filter(f => {
    if (MIGRACIONES_AUTORIZADAS.has(f)) return false
    if (PATRON_MIGRACIONES_10J.test(f)) return false
    return true
  })

  warn('No hay migraciones nuevas no autorizadas', migracionesNuevas.length === 0,
    migracionesNuevas.length > 0 ? `Nuevas: ${migracionesNuevas.join(', ')}` : '')
} else {
  check('Directorio de migraciones existe', false, 'supabase/migrations no encontrado')
}

// ─── Bloque 5: Verificar que plan anterior (9C-6H.0) sigue intacto ───────────

console.log('\n🔄 Bloque 5 — Verificar integridad del dry-run anterior (9C-6H.0)')

if (existsSync(OLD_SCRIPT)) {
  const oldScript = readFileSync(OLD_SCRIPT, 'utf8')
  check('Dry-run anterior declara DRY-RUN', oldScript.includes('DRY-RUN') || oldScript.includes('SOLO LECTURA'))
  check('Dry-run anterior NO escribe en cronograma_cuotas',
    !/\.from\(['"]cronograma_cuotas['"]\)\s*\.\s*(update|insert|upsert|delete)/i.test(oldScript))
  check('Dry-run anterior NO escribe en pagos_recibos',
    !/\.from\(['"]pagos_recibos['"]\)\s*\.\s*(update|insert|upsert|delete)/i.test(oldScript))
} else {
  for (let i = 0; i < 3; i++) check(`[dry-run anterior no encontrado — check ${i + 1}]`, false)
}

// ─── Bloque 6: Preview JSON (si ya existe del run anterior o nuevo) ───────────

console.log('\n📊 Bloque 6 — Preview JSON')

const OLD_PREVIEW = resolve(DOCS, 'proposed_cuotas_payment_updates_preview.json')
const NEW_PREVIEW = resolve(DOCS, 'plan_pagos_cuotas_10k0_preview.json')

warn('Preview JSON anterior (9C-6H.0) existe', existsSync(OLD_PREVIEW))
warn('Preview JSON nuevo (10K-0) existe', existsSync(NEW_PREVIEW),
  'Ejecutar npm run plan:pagos-cuotas para generarlo')

if (existsSync(NEW_PREVIEW)) {
  try {
    const preview = JSON.parse(readFileSync(NEW_PREVIEW, 'utf8'))
    check('Preview 10K-0 tiene campo fase = 10K-0', preview.fase === '10K-0')
    check('Preview 10K-0 tiene campo modo = DRY-RUN', preview.modo === 'DRY-RUN')
    check('Preview 10K-0 tiene campo regla_monto', typeof preview.regla_monto === 'string')
    check('Preview 10K-0 tiene campo migracion_necesaria', 'migracion_necesaria' in preview)
    check('Preview 10K-0 tiene campo totales', typeof preview.totales === 'object')
    check('Preview 10K-0 tiene campo propuestas (array)', Array.isArray(preview.propuestas))
    check('Preview 10K-0 tiene campo pagos_no_asignables', Array.isArray(preview.pagos_no_asignables))
    check('Preview 10K-0 tiene campo pagos_mixtos_detalle', Array.isArray(preview.pagos_mixtos_detalle))
    check('Preview 10K-0 tiene campo excedentes', Array.isArray(preview.excedentes))
    check('Preview 10K-0 tiene campo resumen_por_credito', Array.isArray(preview.resumen_por_credito))
  } catch (e) {
    check('Preview 10K-0 JSON es válido', false, e.message)
  }
}

// ─── Resumen ───────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════════════════')
console.log(`  RESULTADO: ${passed}/${passed + failed + warnings} PASS | ${warnings} WARN | ${failed} FAIL`)
if (failed === 0 && warnings === 0) {
  console.log('  ✅ Todos los checks pasaron — plan Fase 10K-0 es seguro')
} else if (failed === 0) {
  console.log(`  ⚠️  ${warnings} advertencia(s) — revisar antes del apply`)
} else {
  console.log(`  ❌ ${failed} check(s) fallaron — revisar antes de continuar`)
}
console.log('══════════════════════════════════════════════════════════════\n')

process.exit(failed > 0 ? 1 : 0)
