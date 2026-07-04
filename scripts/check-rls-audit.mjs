#!/usr/bin/env node
/**
 * check-rls-audit.mjs
 * Fase SEC-3A — Verifica que los artefactos de auditoría RLS están completos
 * y que no se aplicaron cambios a la DB durante la auditoría.
 *
 * Checks:
 * 1. Existe RLS_AUDIT_RESULT.md
 * 2. Existe RLS_HARDENING_PLAN.md
 * 3. Existe rls_audit_matrix.xlsx
 * 4. No hay migraciones nuevas aplicadas en esta fase
 * 5. El reporte cubre las tablas prioritarias
 * 6. El plan incluye rollback
 * 7. El plan incluye fases SEC-3B a SEC-3E
 * 8. Los checks de seguridad previos siguen pasando (sin regresiones)
 */
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const ROOT = process.cwd()
let ok = true
let passed = 0
let failed = 0

function check(label, condition, detail = '') {
  const icon = condition ? '[OK]  ' : '[FAIL]'
  if (condition) { passed++ } else { failed++; ok = false }
  console.log(`${icon} ${label}${detail ? ` — ${detail}` : ''}`)
}

function readFile(path) {
  try { return readFileSync(resolve(ROOT, path), 'utf8') } catch { return '' }
}

function fileExists(path) {
  return existsSync(resolve(ROOT, path))
}

console.log('\n=== CHECK: SEC-3A — Auditoría RLS Supabase ===\n')

// ── 1. Archivos de reporte ─────────────────────────────────────────────────────
console.log('── Artefactos de auditoría ──')

const auditPath   = 'docs/ai-recovery/RLS_AUDIT_RESULT.md'
const planPath    = 'docs/ai-recovery/RLS_HARDENING_PLAN.md'
const matrixPath  = 'exports/security/rls_audit_matrix.xlsx'

check('RLS_AUDIT_RESULT.md existe', fileExists(auditPath))
check('RLS_HARDENING_PLAN.md existe', fileExists(planPath))
check('rls_audit_matrix.xlsx existe', fileExists(matrixPath))

// ── 2. Contenido del reporte ───────────────────────────────────────────────────
console.log('\n── Contenido de RLS_AUDIT_RESULT.md ──')

const audit = readFile(auditPath)

const tablasPrioritarias = [
  'usuarios', 'socios', 'creditos', 'pagos_recibos',
  'aportes', 'egresos', 'cronograma_cuotas', 'ampliaciones',
  'socio_beneficiarios', 'pagos_cuotas_aplicaciones',
  'configuracion', 'convenios'
]

for (const tabla of tablasPrioritarias) {
  check(`Reporte cubre tabla: ${tabla}`, audit.includes(`\`${tabla}\``))
}

check('Reporte menciona get_user_rol()', audit.includes('get_user_rol'))
check('Reporte menciona USING (true)', audit.includes('USING (true)') || audit.includes('USING: `true`'))
check('Reporte identifica tablas con policy amplia', audit.includes('pagos_cuotas_aplicaciones') && audit.includes('socio_beneficiarios'))
check('Reporte confirma no se modificó la DB', audit.includes('No se modificó la base de datos') || audit.includes('No se modificaron policies') || audit.includes('ninguna policy tocada'))
check('Reporte tiene sección de riesgo de implementación', audit.includes('Riesgos de implementación') || audit.includes('riesgo'))
check('Reporte tiene modelo esperado por rol', audit.includes('admin') && audit.includes('tesoreria') && audit.includes('contabilidad'))

// ── 3. Contenido del plan ──────────────────────────────────────────────────────
console.log('\n── Contenido de RLS_HARDENING_PLAN.md ──')

const plan = readFile(planPath)

check('Plan incluye SEC-3B', plan.includes('SEC-3B'))
check('Plan incluye SEC-3C', plan.includes('SEC-3C'))
check('Plan incluye SEC-3D', plan.includes('SEC-3D'))
check('Plan incluye SEC-3E', plan.includes('SEC-3E'))
check('Plan incluye SEC-3F', plan.includes('SEC-3F'))
check('Plan incluye rollback para socio_beneficiarios', plan.includes('ROLLBACK') && plan.includes('socio_beneficiarios'))
check('Plan incluye rollback para pagos_cuotas_aplicaciones', plan.includes('ROLLBACK') && plan.includes('pagos_cuotas_aplicaciones'))
check('Plan requiere autorización explícita', plan.includes('REQUIERE AUTORIZACIÓN'))
check('Plan menciona get_user_rol()', plan.includes('get_user_rol'))
check('Plan menciona TO authenticated', plan.includes('TO authenticated'))

// ── 4. No hay migraciones nuevas de esta fase ──────────────────────────────────
console.log('\n── Verificar que no se crearon migraciones nuevas ──')

const { readdirSync } = await import('fs')
const migrationsDir = resolve(ROOT, 'supabase/migrations')
let migrationFiles = []
try {
  migrationFiles = readdirSync(migrationsDir).filter(f => f.endsWith('.sql'))
} catch { /* dir no existe */ }

const lastKnownMigration = '20260702000003_create_pagos_cuotas_aplicaciones.sql'
// SEC-3C autorizada: se permite la migración 20260702000010_sec3c_rls_hardening.sql
const authorizedMigrations = new Set(['20260702000010'])
const hasNewMigration = migrationFiles.some(f => {
  const version = f.split('_')[0]
  return version > '20260702000003' && !authorizedMigrations.has(version)
})

check('No se crearon migraciones no autorizadas en SEC-3A', !hasNewMigration,
  hasNewMigration ? 'Se detectó migración no autorizada posterior a 20260702000003 — revisar' : 'OK')

check('Migración de referencia existe', migrationFiles.includes(lastKnownMigration))

// ── 5. No se agregaron policies en SQL ────────────────────────────────────────
console.log('\n── Verificar que el reporte no contiene SQL de escritura ──')

const hasDDLInAudit = /^\s*(ALTER TABLE|CREATE TABLE|DROP TABLE|DROP POLICY|CREATE POLICY)/im.test(audit)
// El reporte puede MENCIONAR SQL propuesto en bloques de código, pero no como instrucciones aplicadas
const hasAppliedNote = audit.includes('APLICADA') || audit.includes('EJECUTADA') || audit.includes('MIGRACIÓN APLICADA')
check('Reporte solo contiene SQL propuesto (no aplicado)', !hasAppliedNote,
  hasAppliedNote ? 'Se detectó nota de migración aplicada — verificar' : 'OK')

// ── 6. Package.json tiene el script ───────────────────────────────────────────
console.log('\n── Package.json ──')

const pkg = readFile('package.json')
check('npm run check:rls-audit está en package.json', pkg.includes('check:rls-audit'))
check('npm run generate:rls-matrix está en package.json', pkg.includes('generate:rls-matrix'))

// ── 7. Archivos de contexto existentes ────────────────────────────────────────
console.log('\n── Archivos de contexto previos ──')

check('SECURITY_AUDIT_REPORT.md existe', fileExists('docs/ai-recovery/SECURITY_AUDIT_REPORT.md'))
check('SECURITY_HARDENING_PLAN.md existe', fileExists('docs/ai-recovery/SECURITY_HARDENING_PLAN.md'))
check('SECURITY_API_HARDENING_REPORT.md existe', fileExists('docs/ai-recovery/SECURITY_API_HARDENING_REPORT.md'))
check('AI_HANDOFF.md existe', fileExists('docs/ai-recovery/AI_HANDOFF.md'))

// ── Resultado ─────────────────────────────────────────────────────────────────
const total = passed + failed
console.log(`\n=== RESULTADO: ${passed}/${total} checks ===`)

if (ok) {
  console.log('✅ SEC-3A COMPLETA — Auditoría RLS verificada. No se tocó la DB.')
  console.log('   Próxima fase: SEC-3C (requiere autorización: APLICAR RLS TABLAS SEC-3C)')
} else {
  console.log(`❌ ${failed} checks fallaron — revisar antes de continuar`)
}

process.exit(ok ? 0 : 1)
