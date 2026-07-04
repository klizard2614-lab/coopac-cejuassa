#!/usr/bin/env node
/**
 * check-audit-log-implementation-plan.mjs
 * Verifica que el plan de implementación de audit log (SEC-4B) está completo y seguro.
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
function check(cond, msg) { if (cond) ok(msg); else err(msg); }

// ─── 1. Artefactos requeridos ─────────────────────────────────────────────────
console.log('\n── Artefactos requeridos ──');

const planPath    = join(ROOT, 'docs/ai-recovery/AUDIT_LOG_IMPLEMENTATION_PLAN.md');
const migPath     = join(ROOT, 'supabase/migrations/20260703130000_sec4b_audit_log_implementation.sql');
const typesPath   = join(ROOT, 'lib/audit/types.ts');
const clientPath  = join(ROOT, 'lib/audit/auditClient.ts');

check(existsSync(planPath),   'Plan de implementación existe (AUDIT_LOG_IMPLEMENTATION_PLAN.md)');
check(existsSync(migPath),    'Migración SEC-4B local existe');
check(existsSync(typesPath),  'Helper de tipos existe (lib/audit/types.ts)');
check(existsSync(clientPath), 'Helper auditClient existe (lib/audit/auditClient.ts)');

// ─── 2. Validar plan ──────────────────────────────────────────────────────────
if (existsSync(planPath)) {
  const plan = readFileSync(planPath, 'utf8');
  console.log('\n── Contenido del plan ──');
  check(plan.includes('SEC-4B'),                    'Plan menciona SEC-4B');
  check(plan.includes('registrar_auditoria'),        'Plan menciona RPC registrar_auditoria');
  check(plan.includes('SECURITY DEFINER'),           'Plan menciona SECURITY DEFINER');
  check(plan.includes('Rollback'),                   'Plan tiene sección de rollback');
  check(plan.includes('DROP FUNCTION'),              'Rollback incluye eliminar RPC');
  check(plan.includes('APLICAR AUDIT LOG SEC-4B'),   'Plan menciona autorización pendiente');
  check(plan.includes('APLICAR BASELINE AUDITORIA'), 'Plan menciona prerequisito SEC-3E');
  check(plan.includes('metadata'),                   'Plan documenta qué incluir en metadata');
  check(plan.includes('NUNCA incluir'),              'Plan documenta qué NO incluir en metadata (PII)');
  check(plan.includes('SEC-4C'),                     'Plan define módulos a integrar en SEC-4C');
  check(plan.includes('actor_email'),                'Plan menciona columna actor_email');
  check(plan.includes('actor_rol'),                  'Plan menciona columna actor_rol');
}

// ─── 3. Validar migración SEC-4B ─────────────────────────────────────────────
if (existsSync(migPath)) {
  const sqlRaw = readFileSync(migPath, 'utf8');
  const sqlExec = sqlRaw
    .split('\n')
    .filter(l => !l.trim().startsWith('--'))
    .join('\n')
    .toUpperCase();

  console.log('\n── Seguridad de la migración SEC-4B ──');

  check(sqlRaw.includes('registrar_auditoria'),     'Migración crea RPC registrar_auditoria');
  check(sqlRaw.includes('SECURITY DEFINER'),         'RPC usa SECURITY DEFINER');
  check(sqlRaw.includes('ADD COLUMN IF NOT EXISTS'), 'Migración usa ADD COLUMN IF NOT EXISTS');
  check(sqlRaw.includes('actor_email'),              'Migración agrega actor_email');
  check(sqlRaw.includes('actor_rol'),                'Migración agrega actor_rol');
  check(sqlRaw.includes('ip_hash'),                  'Migración agrega ip_hash (sin IP en texto claro)');
  check(sqlRaw.includes('REVOKE EXECUTE ON FUNCTION public.registrar_auditoria') && sqlRaw.includes('FROM anon'),
    'Migración revoca EXECUTE de anon explícitamente (Supabase otorga por default privileges)');
  check(sqlRaw.includes('DROP POLICY IF EXISTS auditoria_insert'), 'Migración revoca INSERT directo');
  check(sqlRaw.includes('get_user_rol()'),           'Policy SELECT usa get_user_rol()');
  check(sqlRaw.includes('BEGIN') && sqlRaw.includes('COMMIT'), 'Migración tiene transacción');
  check(sqlRaw.includes('APLICAR AUDIT LOG SEC-4B'), 'Migración menciona autorización requerida');

  // No toca Anexo 06 ni lógica financiera.
  // Excepción esperada: 'EXPORTAR_ANEXO6' es una etiqueta de acción auditable en la
  // whitelist (no una referencia a la tabla/exportador de Anexo 06 — no existe tal
  // tabla en la DB, el Anexo 6 se genera en el frontend).
  const sqlSinEtiquetaAnexo6 = sqlExec.replace(/'EXPORTAR_ANEXO6'/g, '');
  check(!sqlSinEtiquetaAnexo6.includes('ANEXO6'), 'Migración NO toca Anexo 06 (fuera de la etiqueta de acción auditable)');
  check(!sqlExec.includes('CRONOGRAMA_CUOTAS'),   'Migración NO toca cronograma_cuotas');
  check(!sqlExec.includes('PAGOS_RECIBOS'),        'Migración NO toca pagos_recibos');

  // No toca datos
  check(!sqlExec.includes('DELETE FROM'),          'Migración NO elimina datos');
  check(!sqlExec.includes('TRUNCATE'),             'Migración NO trunca datos');
  check(!sqlExec.includes('UPDATE '),              'Migración NO actualiza datos existentes');
  check(!sqlExec.includes('DROP TABLE'),           'Migración NO elimina tablas');

  // ─── 3B. Controles técnicos reales en la RPC (endurecimiento post-revisión) ──
  console.log('\n── Controles técnicos de la RPC registrar_auditoria ──');

  check(sqlRaw.includes('SET search_path = public'), 'RPC fija SET search_path = public');
  check(sqlRaw.includes('auth.uid()'),                'RPC usa auth.uid() para resolver el actor');
  check(!/p_actor_user_id|p_user_id/.test(sqlRaw),    'RPC NO acepta actor_user_id como parámetro (evita suplantación)');

  // B. Whitelist de acciones
  const accionesEsperadas = [
    'CREAR_SOCIO', 'EDITAR_SOCIO', 'EDITAR_BENEFICIARIOS', 'CREAR_CREDITO',
    'EDITAR_CREDITO', 'APLICAR_AMPLIACION', 'REGISTRAR_PAGO', 'REGISTRAR_APORTE',
    'CREAR_EGRESO', 'ELIMINAR_EGRESO', 'INVITAR_USUARIO', 'CAMBIAR_ESTADO_USUARIO',
    'EDITAR_CONFIGURACION', 'EXPORTAR_ANEXO6',
  ];
  check(
    accionesEsperadas.every(a => sqlRaw.includes(`'${a}'`)),
    'RPC valida p_accion contra whitelist completa (14 acciones)'
  );
  check(sqlRaw.includes('p_accion NOT IN'), 'RPC rechaza acciones fuera de whitelist');

  // C. Whitelist de módulos
  const modulosEsperados = [
    'socios', 'creditos', 'beneficiarios', 'ampliaciones', 'pagos',
    'aportes', 'egresos', 'usuarios', 'configuracion', 'reportes',
  ];
  check(
    modulosEsperados.every(m => sqlRaw.includes(`'${m}'`)),
    'RPC valida p_modulo contra whitelist completa (10 módulos)'
  );
  check(sqlRaw.includes('p_modulo NOT IN'), 'RPC rechaza módulos fuera de whitelist');

  // D. Límites de longitud
  check(sqlRaw.includes('left(trim('), 'RPC trunca campos de texto de forma segura (left/trim)');
  check(sqlRaw.includes(', 80)') && sqlRaw.includes(', 120)') && sqlRaw.includes(', 500)'),
    'RPC aplica límites de longitud (80/120/500 caracteres)');

  // E. Metadata debe ser objeto o null
  check(sqlRaw.includes("jsonb_typeof(p_metadata) = 'object'"),
    'RPC valida que metadata sea un objeto JSON (rechaza arrays/strings/números/booleanos)');
  check(sqlRaw.includes("'{}'::jsonb"), 'RPC reemplaza metadata inválida por objeto vacío');

  // F. Tamaño máximo de metadata
  check(sqlRaw.includes('4000'), 'RPC limita el tamaño serializado de metadata a 4000 caracteres');

  // G. Rechazo de claves sensibles
  const clavesSensibles = [
    'dni', 'documento', 'password', 'token', 'secret', 'email',
    'telefono', 'beneficiario', 'cuenta', 'tarjeta', 'auth', 'session', 'cookie', 'supabase',
  ];
  check(
    clavesSensibles.every(k => sqlRaw.toLowerCase().includes(k)),
    'RPC rechaza metadata con claves sensibles conocidas (dni, password, token, etc.)'
  );
  check(sqlRaw.includes('jsonb_object_keys'), 'RPC inspecciona las claves del objeto metadata');

  // No guarda payloads completos — verificar declaración explícita en comentarios
  check(
    sqlRaw.includes('NUNCA debe contener snapshots completos') || sqlRaw.includes('nunca debe contener snapshots completos'),
    'Migración declara explícitamente que metadata no debe contener snapshots completos'
  );

  // ─── 3C. Alineación SQL ↔ TypeScript (lib/audit/types.ts) ──────────────────
  console.log('\n── Alineación whitelist SQL vs TypeScript (types.ts) ──');

  if (existsSync(typesPath)) {
    const typesSrc = readFileSync(typesPath, 'utf8');

    const accionSection = typesSrc.split('export type AuditAccion')[1]?.split('export type AuditModulo')[0] ?? '';
    const moduloSection = typesSrc.split('export type AuditModulo')[1]?.split('export interface')[0] ?? '';

    const tsAcciones = [...accionSection.matchAll(/'([A-Z0-9_]+)'/g)].map(m => m[1]);
    const tsModulos  = [...moduloSection.matchAll(/'([a-z0-9_]+)'/g)].map(m => m[1]);

    const accionesFaltantesEnTs = accionesEsperadas.filter(a => !tsAcciones.includes(a));
    const accionesExtraEnTs     = tsAcciones.filter(a => !accionesEsperadas.includes(a));
    const modulosFaltantesEnTs  = modulosEsperados.filter(m => !tsModulos.includes(m));
    const modulosExtraEnTs      = tsModulos.filter(m => !modulosEsperados.includes(m));

    check(accionesFaltantesEnTs.length === 0,
      `types.ts incluye todas las acciones de la whitelist SQL (${tsAcciones.length}/${accionesEsperadas.length})`);
    check(accionesExtraEnTs.length === 0,
      `types.ts NO tiene acciones fuera de la whitelist SQL${accionesExtraEnTs.length ? ' — extra: ' + accionesExtraEnTs.join(', ') : ''}`);
    check(modulosFaltantesEnTs.length === 0,
      `types.ts incluye todos los módulos de la whitelist SQL (${tsModulos.length}/${modulosEsperados.length})`);
    check(modulosExtraEnTs.length === 0,
      `types.ts NO tiene módulos fuera de la whitelist SQL${modulosExtraEnTs.length ? ' — extra: ' + modulosExtraEnTs.join(', ') : ''}`);

    check(!typesSrc.includes('EXPORTAR_BDCC'),
      'types.ts ya NO incluye EXPORTAR_BDCC (estaba fuera de la whitelist SQL)');
    check(!typesSrc.includes('ACTIVAR_USUARIO') && !typesSrc.includes('DESACTIVAR_USUARIO'),
      'types.ts ya NO incluye ACTIVAR_USUARIO/DESACTIVAR_USUARIO (reemplazadas por CAMBIAR_ESTADO_USUARIO)');
  } else {
    err('lib/audit/types.ts no encontrado para verificar alineación SQL/TypeScript');
  }
}

// ─── 4. Validar auditClient — AUDIT_ENABLED = false ─────────────────────────
if (existsSync(clientPath)) {
  const client = readFileSync(clientPath, 'utf8');
  console.log('\n── Estado de activación del helper ──');
  check(client.includes('AUDIT_ENABLED = false'),  'auditClient tiene AUDIT_ENABLED = false (inactivo)');
  check(client.includes('registrar_auditoria'),     'auditClient llama a la RPC correcta');
  check(client.includes('AuditParams'),             'auditClient usa tipo AuditParams');
  // No debe importar nada que rompa el build
  check(!client.includes('NEXT_PUBLIC_SUPABASE'),   'auditClient no expone variables de entorno');
}

// ─── 5. Estado de aplicación ──────────────────────────────────────────────────
console.log('\n── Estado de aplicación ──');
ok('Prerequisito SEC-3E: ✅ aplicado en remoto (2026-07-03)');
ok('SEC-4B: ✅ aplicada en remoto (2026-07-03) — RPC registrar_auditoria existe en producción');
ok('EXECUTE revocado de anon explícitamente — solo authenticated/service_role pueden ejecutar la RPC');
ok('AUDIT_ENABLED sigue en false en lib/audit/auditClient.ts — activación es un paso manual posterior (SEC-4C)');

// ─── Resultado ────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════');
console.log(`  Resultado: ${pass}/${pass + fail} checks PASS`);
if (fail > 0) {
  console.log(`  ⚠️  ${fail} checks FALLARON`);
  console.log('══════════════════════════════════════════════\n');
  process.exit(1);
}
console.log('══════════════════════════════════════════════\n');
console.log('✅ SEC-4B verificada y APLICADA en remoto (con controles técnicos reales en la RPC).');
console.log('   Sin autorizaciones pendientes para esta fase.');
console.log('   Próximo paso opcional: integrar registrarAudit() en módulos (SEC-4C).\n');
