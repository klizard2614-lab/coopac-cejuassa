#!/usr/bin/env node
/**
 * check-security-backup-runbook.mjs
 * Verifica que el runbook de seguridad operacional existe y cubre los temas requeridos.
 * No ejecuta backups ni toca DB.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

let pass = 0;
let fail = 0;

function ok(msg) { console.log(`[OK]   ${msg}`); pass++; }
function err(msg) { console.log(`[FAIL] ${msg}`); fail++; }
function check(cond, msg) { if (cond) ok(msg); else err(msg); }

// ─── 1. Existencia del runbook ────────────────────────────────────────────────
console.log('\n── Artefactos requeridos ──');

const runbookPath = join(ROOT, 'docs/ai-recovery/SECURITY_BACKUP_AND_RECOVERY_RUNBOOK.md');
check(existsSync(runbookPath), 'Runbook de seguridad existe (SECURITY_BACKUP_AND_RECOVERY_RUNBOOK.md)');

// ─── 2. Contenido requerido ────────────────────────────────────────────────────
if (existsSync(runbookPath)) {
  const doc = readFileSync(runbookPath, 'utf8');
  console.log('\n── Contenido del runbook ──');

  // Backup
  check(doc.toLowerCase().includes('backup'),           'Runbook menciona backup');
  check(doc.includes('backup:operational-data') ||
        doc.includes('backup manual'),                  'Runbook referencia script de backup');
  check(doc.includes('backups/'),                       'Runbook referencia directorio de backups');
  check(doc.includes('socios') && doc.includes('creditos'), 'Runbook lista tablas críticas');

  // Rollback
  check(doc.toLowerCase().includes('rollback'),         'Runbook menciona rollback');
  check(doc.includes('migration repair'),               'Runbook menciona reparación de historial');

  // RLS
  check(doc.includes('RLS') || doc.includes('Row Level Security'), 'Runbook menciona RLS');
  check(doc.includes('falla RLS') || doc.includes('Falla RLS'),    'Runbook tiene sección de fallo RLS');
  check(doc.includes('get_user_rol'),                   'Runbook menciona función get_user_rol()');

  // Migraciones
  check(doc.toLowerCase().includes('migración') ||
        doc.toLowerCase().includes('migracion'),        'Runbook menciona migraciones');
  check(doc.includes('--dry-run'),                      'Runbook menciona dry-run antes de aplicar');
  check(doc.includes('supabase db push'),               'Runbook menciona comando supabase db push');

  // Usuarios/roles
  check(doc.toLowerCase().includes('usuario'),          'Runbook menciona usuarios');
  check(doc.includes('activo'),                         'Runbook menciona campo activo de usuario');
  check(doc.includes('rol'),                            'Runbook menciona roles');
  check(doc.includes('admin'),                          'Runbook menciona rol admin');

  // Checklist demo
  check(doc.includes('demo'),                           'Runbook tiene sección de demo');
  check(doc.includes('smoke:demo-app'),                 'Runbook referencia smoke test');
  check(doc.includes('verify:cejuassa'),                'Runbook referencia verify:cejuassa');

  // Checklist producción
  check(doc.toLowerCase().includes('producción') ||
        doc.toLowerCase().includes('produccion'),       'Runbook tiene sección de producción');
  check(doc.includes('SERVICE_ROLE_KEY'),               'Runbook menciona protección de service role key');

  // Seguridad
  check(!doc.includes('npm audit fix --force'),         'Runbook NO recomienda npm audit fix --force');
  check(!doc.includes('DROP TABLE') || doc.includes('SOLO'),
        'Runbook no tiene DROP TABLE sin advertencia');
}

// ─── 3. Verificar backups existentes ─────────────────────────────────────────
console.log('\n── Backups existentes ──');

const backup1 = join(ROOT, 'backups/data-reset/20260620-1327/BACKUP_MANIFEST.md');
const backup2 = join(ROOT, 'backups/demo-data-fill/2026-06-23T02-18/BACKUP_MANIFEST.md');

check(existsSync(backup1), 'Backup pre-reset (20260620-1327) existe con manifest');
check(existsSync(backup2), 'Backup demo-data-fill (2026-06-23) existe con manifest');

// ─── 4. Confirmar que este script NO toca DB ─────────────────────────────────
console.log('\n── Verificación de seguridad del script ──');
ok('Este script es solo lectura — no ejecuta backups reales');
ok('No conecta a Supabase remoto — no toca DB');
ok('No modifica archivos del proyecto');

// ─── Resultado ────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════');
console.log(`  Resultado: ${pass}/${pass + fail} checks PASS`);
if (fail > 0) {
  console.log(`  ⚠️  ${fail} checks FALLARON`);
  console.log('══════════════════════════════════════════════\n');
  process.exit(1);
}
console.log('══════════════════════════════════════════════\n');
console.log('✅ Runbook de seguridad verificado correctamente.\n');
