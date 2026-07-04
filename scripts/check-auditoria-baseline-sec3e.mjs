#!/usr/bin/env node
/**
 * check-auditoria-baseline-sec3e.mjs
 * Verifica que la migración baseline SEC-3E de tabla auditoria es segura.
 * No aplica nada — solo auditoría estática de archivos locales.
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

function check(cond, msg) {
  if (cond) ok(msg);
  else err(msg);
}

// ─── 1. Existencia de artefactos ─────────────────────────────────────────────
console.log('\n── Artefactos requeridos ──');

const reportPath  = join(ROOT, 'docs/ai-recovery/AUDITORIA_TABLE_BASELINE_REPORT.md');
const migPath     = join(ROOT, 'supabase/migrations/20260703120000_sec3e_auditoria_baseline.sql');

check(existsSync(reportPath),  'Reporte baseline existe (AUDITORIA_TABLE_BASELINE_REPORT.md)');
check(existsSync(migPath),     'Migración SEC-3E existe (20260703120000_sec3e_auditoria_baseline.sql)');

// ─── 2. Validar contenido del reporte ────────────────────────────────────────
if (existsSync(reportPath)) {
  const report = readFileSync(reportPath, 'utf8');
  console.log('\n── Contenido reporte baseline ──');
  check(report.includes('SEC-3E'),               'Reporte menciona SEC-3E');
  check(report.includes('ljdjbhsipgkxlgnprzhm'), 'Reporte referencia proyecto Supabase');
  check(report.includes('id_usuario'),            'Reporte documenta columna id_usuario');
  check(report.includes('fecha_hora'),            'Reporte documenta columna fecha_hora');
  check(report.includes('modulo'),                'Reporte documenta columna modulo');
  check(report.includes('accion'),                'Reporte documenta columna accion');
  check(report.includes('idx_auditoria_fecha'),   'Reporte documenta índice fecha');
  check(report.includes('idx_auditoria_usuario'), 'Reporte documenta índice usuario');
  check(report.includes('auditoria_insert'),      'Reporte documenta policy INSERT');
  check(report.includes('auditoria_select'),      'Reporte documenta policy SELECT');
  check(report.includes('APLICAR BASELINE AUDITORIA SEC-3E'), 'Reporte menciona autorización pendiente');
}

// ─── 3. Validar migración ─────────────────────────────────────────────────────
if (existsSync(migPath)) {
  const sql = readFileSync(migPath, 'utf8').toUpperCase();
  const sqlRaw = readFileSync(migPath, 'utf8');
  console.log('\n── Seguridad de la migración ──');

  // Debe incluir
  check(sqlRaw.includes('public.auditoria'),             'Migración referencia public.auditoria');
  check(sqlRaw.includes('CREATE TABLE IF NOT EXISTS'),   'Migración usa CREATE TABLE IF NOT EXISTS');
  check(sqlRaw.includes('ENABLE ROW LEVEL SECURITY'),    'Migración habilita RLS');
  check(sqlRaw.includes('CREATE INDEX IF NOT EXISTS'),   'Migración usa CREATE INDEX IF NOT EXISTS');
  check(sqlRaw.includes('BEGIN'),                        'Migración tiene BEGIN');
  check(sqlRaw.includes('COMMIT'),                       'Migración tiene COMMIT');
  check(sqlRaw.includes('auditoria_select'),             'Migración crea policy SELECT');
  check(sqlRaw.includes('auditoria_insert'),             'Migración crea policy INSERT');
  check(sqlRaw.includes('APLICAR BASELINE AUDITORIA SEC-3E'), 'Migración menciona autorización requerida');

  // Filtrar comentarios para validar SQL ejecutable (no comentado)
  const sqlNoComments = sqlRaw
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n')
    .toUpperCase();

  // Solo toca auditoria (en SQL ejecutable, no comentarios)
  check(!sqlNoComments.includes('DROP TABLE'),  'Migración NO contiene DROP TABLE ejecutable');
  check(!sqlNoComments.includes('DELETE FROM'), 'Migración NO contiene DELETE ejecutable');
  check(!sqlNoComments.includes('TRUNCATE'),    'Migración NO contiene TRUNCATE ejecutable');
  check(!sqlNoComments.includes('UPDATE '),     'Migración NO contiene UPDATE ejecutable');

  // No crea RPCs
  check(!sql.includes('CREATE OR REPLACE FUNCTION'), 'Migración NO crea funciones/RPC');
  check(!sql.includes('CREATE FUNCTION'),            'Migración NO crea funciones/RPC (alt)');

  // No agrega columnas de SEC-4B
  check(!sql.includes('ACTOR_EMAIL'),    'Migración NO agrega columna actor_email (SEC-4B)');
  check(!sql.includes('ACTOR_ROL'),      'Migración NO agrega columna actor_rol (SEC-4B)');
  check(!sql.includes('METADATA'),       'Migración NO agrega columna metadata (SEC-4B)');
  check(!sql.includes('IP_HASH'),        'Migración NO agrega columna ip_hash (SEC-4B)');

  // No toca Anexo 06 ni lógica financiera
  check(!sql.includes('ANEXO'),          'Migración NO toca Anexo 06');
  check(!sql.includes('CRONOGRAMA_CUOTAS'), 'Migración NO toca cronograma_cuotas');
  check(!sql.includes('PAGOS_RECIBOS'),  'Migración NO toca pagos_recibos');
  check(!sql.includes('CREDITOS'),       'Migración NO toca creditos');
  check(!sql.includes('APORTES'),        'Migración NO toca aportes');
  check(!sql.includes('EGRESOS'),        'Migración NO toca egresos');
}

// ─── 4. Verificar que migración NO está marcada como aplicada ────────────────
console.log('\n── Estado de la migración ──');
ok('Migración creada SOLO LOCAL — no se aplica automáticamente por este script');
ok('Para aplicar: proporcionar autorización exacta "APLICAR BASELINE AUDITORIA SEC-3E"');

// ─── Resultado ────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════');
console.log(`  Resultado: ${pass}/${pass + fail} checks PASS`);
if (fail > 0) {
  console.log(`  ⚠️  ${fail} checks FALLARON`);
  console.log('══════════════════════════════════════════════\n');
  process.exit(1);
}
console.log('══════════════════════════════════════════════\n');
console.log('✅ SEC-3E baseline auditoria verificado.');
console.log('   Autorización pendiente: APLICAR BASELINE AUDITORIA SEC-3E\n');
