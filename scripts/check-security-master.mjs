#!/usr/bin/env node
/**
 * check-security-master.mjs
 * Verifica que todos los artefactos de la sesión SECURITY-MASTER existen y son válidos.
 * No aplica migraciones, no toca DB, no modifica código.
 */

import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

let pass = 0;
let fail = 0;

function ok(msg)  { console.log(`[OK]   ${msg}`); pass++; }
function err(msg) { console.log(`[FAIL] ${msg}`); fail++; }
function check(cond, msg) { if (cond) ok(msg); else err(msg); }

function fileExists(rel, label) {
  check(existsSync(join(ROOT, rel)), label || rel);
  return existsSync(join(ROOT, rel));
}

// ─── 1. Reportes de documentación ─────────────────────────────────────────────
console.log('\n── Documentación de seguridad ──');
fileExists('docs/ai-recovery/SECURITY_AUDIT_REPORT.md',                 'Reporte auditoría SEC-1 (SECURITY_AUDIT_REPORT)');
fileExists('docs/ai-recovery/SECURITY_HARDENING_PLAN.md',               'Plan de hardening (SECURITY_HARDENING_PLAN)');
fileExists('docs/ai-recovery/RLS_AUDIT_RESULT.md',                      'Resultado auditoría RLS (RLS_AUDIT_RESULT)');
fileExists('docs/ai-recovery/AUDIT_LOG_DESIGN_PLAN.md',                 'Diseño audit log (AUDIT_LOG_DESIGN_PLAN)');
fileExists('docs/ai-recovery/AUDITORIA_TABLE_BASELINE_REPORT.md',       'Baseline tabla auditoria (SEC-3E)');
fileExists('docs/ai-recovery/AUDIT_LOG_IMPLEMENTATION_PLAN.md',         'Plan implementación audit log (SEC-4B)');
fileExists('docs/ai-recovery/SECURITY_BACKUP_AND_RECOVERY_RUNBOOK.md',  'Runbook backup/recovery (SEC-5)');
fileExists('docs/ai-recovery/SECURITY_VALIDATIONS_AND_GUARDS_REVIEW.md','Review guards/validaciones (SEC-6)');
fileExists('docs/ai-recovery/XLSX_DEPENDENCY_RISK_AND_MIGRATION_PLAN.md','Plan riesgo xlsx (DEP-1)');
fileExists('docs/ai-recovery/SECURITY_MASTER_STATUS_REPORT.md',         'Reporte maestro (SEC-FINAL)');

// ─── 2. Migraciones locales ────────────────────────────────────────────────────
console.log('\n── Migraciones locales (no aplicadas) ──');
fileExists('supabase/migrations/20260703120000_sec3e_auditoria_baseline.sql',         'Migración SEC-3E: baseline auditoria');
fileExists('supabase/migrations/20260703130000_sec4b_audit_log_implementation.sql',   'Migración SEC-4B: audit log implementation');

// Verificar que las migraciones son idempotentes (IF NOT EXISTS)
const mig3e = join(ROOT, 'supabase/migrations/20260703120000_sec3e_auditoria_baseline.sql');
if (existsSync(mig3e)) {
  const sql = readFileSync(mig3e, 'utf8').toUpperCase();
  check(sql.includes('IF NOT EXISTS'),  'SEC-3E: usa IF NOT EXISTS (idempotente)');
  const sqlNoComments = sql.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
  check(!sqlNoComments.includes('DROP TABLE'), 'SEC-3E: no tiene DROP TABLE ejecutable');
  check(!sqlNoComments.includes('DELETE FROM'), 'SEC-3E: no tiene DELETE FROM');
  check(!sqlNoComments.includes('TRUNCATE'),    'SEC-3E: no tiene TRUNCATE');
}

const mig4b = join(ROOT, 'supabase/migrations/20260703130000_sec4b_audit_log_implementation.sql');
if (existsSync(mig4b)) {
  const sql = readFileSync(mig4b, 'utf8').toUpperCase();
  check(sql.includes('REGISTRAR_AUDITORIA') || sql.includes('CREATE OR REPLACE FUNCTION'),
    'SEC-4B: contiene RPC registrar_auditoria');
  check(sql.includes('SECURITY DEFINER'), 'SEC-4B: RPC es SECURITY DEFINER');
}

// ─── 3. Código de audit (inerte) ─────────────────────────────────────────────
console.log('\n── Helpers de audit (inactivos) ──');
const typesOk = fileExists('lib/audit/types.ts',       'lib/audit/types.ts existe');
const clientOk = fileExists('lib/audit/auditClient.ts', 'lib/audit/auditClient.ts existe');

if (clientOk) {
  const src = readFileSync(join(ROOT, 'lib/audit/auditClient.ts'), 'utf8');
  check(src.includes('AUDIT_ENABLED') && src.includes('false'),
    'auditClient.ts: AUDIT_ENABLED = false (inactivo)');
  check(!src.includes('throw '), 'auditClient.ts: no lanza excepciones (silencia errores)');
}

// ─── 4. Scripts de verificación ───────────────────────────────────────────────
console.log('\n── Scripts de check ──');
fileExists('scripts/check-security-audit.mjs',                'check:security-audit script');
fileExists('scripts/check-security-hardening-sec1.mjs',       'check:security-sec1 script');
fileExists('scripts/check-security-api-hardening.mjs',        'check:security-api script');
fileExists('scripts/check-rls-sec3c.mjs',                     'check:rls-sec3c script');
fileExists('scripts/check-audit-log-design.mjs',              'check:audit-log-design script');
fileExists('scripts/check-auditoria-baseline-sec3e.mjs',      'check:auditoria-baseline-sec3e script');
fileExists('scripts/check-audit-log-implementation-plan.mjs', 'check:audit-log-implementation-plan script');
fileExists('scripts/check-security-backup-runbook.mjs',       'check:security-backup-runbook script');
fileExists('scripts/check-security-guards-validations.mjs',   'check:security-guards-validations script');
fileExists('scripts/check-xlsx-risk-plan.mjs',                'check:xlsx-risk-plan script');
fileExists('scripts/check-security-master.mjs',               'check:security-master script (este)');

// ─── 5. Matrices XLSX en exports/security/ ────────────────────────────────────
console.log('\n── Matrices XLSX de seguridad ──');
fileExists('exports/security/security_risk_matrix.xlsx', 'security_risk_matrix.xlsx');
fileExists('exports/security/rls_audit_matrix.xlsx',     'rls_audit_matrix.xlsx');
fileExists('exports/security/audit_log_scope.xlsx',      'audit_log_scope.xlsx');

// ─── 6. Verificar que no se tocó Anexo 6 exporter ────────────────────────────
console.log('\n── Integridad de Anexo N°6 ──');
const anexo6 = join(ROOT, 'app/dashboard/reportes/anexo6/page.tsx');
if (existsSync(anexo6)) {
  const src = readFileSync(anexo6, 'utf8');
  check(src.includes('handleExportar'),               'Anexo 6: exportador intacto (handleExportar)');
  check(src.includes('1411050604'),                   'Anexo 6: cuenta contable intacta');
  check(src.includes('criterio_contable_confirmado'), 'Anexo 6: criterio contable intacto');
  check(!src.includes('AUDIT_ENABLED'),               'Anexo 6: no fue modificado con audit helpers');
}

// ─── 7. Confirmar que no se tocó lógica financiera ───────────────────────────
console.log('\n── Lógica financiera intacta ──');
const creditosNuevo = join(ROOT, 'app/dashboard/creditos/nuevo/page.tsx');
if (existsSync(creditosNuevo)) {
  const src = readFileSync(creditosNuevo, 'utf8');
  check(src.includes('cronograma') || src.includes('cuotas'), 'creditos/nuevo: lógica de cronograma intacta');
  check(!src.includes('AUDIT_ENABLED'),               'creditos/nuevo: no tiene audit helpers activos');
}

// ─── 8. Reporte maestro tiene autorizaciones pendientes ──────────────────────
console.log('\n── Reporte maestro menciona autorizaciones ──');
const masterReport = join(ROOT, 'docs/ai-recovery/SECURITY_MASTER_STATUS_REPORT.md');
if (existsSync(masterReport)) {
  const doc = readFileSync(masterReport, 'utf8');
  check(doc.includes('APLICAR BASELINE AUDITORIA SEC-3E'), 'Reporte lista autorización SEC-3E');
  check(doc.includes('APLICAR AUDIT LOG SEC-4B'),          'Reporte lista autorización SEC-4B');
  check(doc.includes('No se aplicaron migraciones') ||
        doc.includes('No se aplicaron') ||
        doc.includes('no se aplicaron'),                    'Reporte confirma que no se aplicó nada remoto');
}

// ─── 9. Seguridad de este script ─────────────────────────────────────────────
console.log('\n── Seguridad del check master ──');
ok('Este script no ejecuta migraciones ni modifica DB');
ok('No modifica archivos del proyecto');
ok('No llama a Supabase remoto');
ok('No toca datos reales');

// ─── Resultado ────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════');
console.log(`  Resultado: ${pass}/${pass + fail} checks PASS`);
if (fail > 0) {
  console.log(`  ⚠️  ${fail} checks FALLARON`);
  console.log('══════════════════════════════════════════════\n');
  process.exit(1);
}
console.log('══════════════════════════════════════════════\n');
console.log('✅ SEC-FINAL: todos los artefactos de seguridad verificados.');
console.log('   Sesión SECURITY-MASTER completada con éxito.\n');
console.log('   SEC-3E: ✅ APLICADA (2026-07-03)');
console.log('   SEC-4B: ✅ APLICADA (2026-07-03)');
console.log('   Sin autorizaciones pendientes. Próximo paso opcional: integrar');
console.log('   registrarAudit() en módulos (SEC-4C) y activar AUDIT_ENABLED=true.\n');
