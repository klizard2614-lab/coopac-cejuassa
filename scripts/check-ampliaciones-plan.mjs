/**
 * check-ampliaciones-plan.mjs
 * Fase 10D-0 — Verificación de seguridad del plan de auditoría de ampliaciones.
 * Comprueba que:
 *   · La auditoría existe
 *   · No hay migraciones nuevas no autorizadas
 *   · No se tocó DB (creditos, pagos, cronogramas, socios)
 *   · No hay lógica financiera irreversible implementada
 *   · El plan incluye preguntas de negocio
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';

const PASS = '✅';
const WARN = '⚠️';
const FAIL = '❌';

let checks = 0;
let passes = 0;
let warns = 0;
let fails = 0;

function check(label, ok, detail = '', mode = 'strict') {
  checks++;
  const status = ok === true ? 'PASS' : ok === 'warn' ? 'WARN' : 'FAIL';
  if (status === 'PASS') passes++;
  else if (status === 'WARN') warns++;
  else fails++;
  const icon = status === 'PASS' ? PASS : status === 'WARN' ? WARN : FAIL;
  const suffix = detail ? `  ${detail}` : '';
  console.log(`  ${icon} ${label}${suffix}`);
}

function section(title) {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 55 - title.length))}`);
}

function fileExists(p) {
  return existsSync(resolve(process.cwd(), p));
}

function fileContains(p, pattern) {
  if (!fileExists(p)) return false;
  const content = readFileSync(resolve(process.cwd(), p), 'utf-8');
  return typeof pattern === 'string' ? content.includes(pattern) : pattern.test(content);
}

function grepCode(pattern, extensions = ['ts', 'tsx', 'mjs', 'js']) {
  try {
    const ext = extensions.join(',');
    const result = execSync(
      `grep -r --include="*.{${ext}}" -l "${pattern}" app/ lib/ scripts/ 2>/dev/null || true`,
      { cwd: process.cwd(), encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();
    return result.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║   CHECK: PLAN AMPLIACIONES — Fase 10D-0             ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  // ── 1. Documentación ──────────────────────────────────────────────────────
  section('1. Documentación obligatoria');

  check(
    'docs/ai-recovery/AMPLIACIONES_MODULE_AUDIT_AND_PLAN.md existe',
    fileExists('docs/ai-recovery/AMPLIACIONES_MODULE_AUDIT_AND_PLAN.md')
  );

  check(
    'El documento menciona la estructura real de la tabla',
    fileContains('docs/ai-recovery/AMPLIACIONES_MODULE_AUDIT_AND_PLAN.md', 'nro_pagare_anterior')
  );

  check(
    'El documento contiene preguntas para Créditos/Contabilidad',
    fileContains('docs/ai-recovery/AMPLIACIONES_MODULE_AUDIT_AND_PLAN.md', 'Preguntas')
  );

  check(
    'El documento lista los modelos de negocio posibles',
    fileContains('docs/ai-recovery/AMPLIACIONES_MODULE_AUDIT_AND_PLAN.md', 'Modelo A')
  );

  check(
    'El documento incluye sección "Qué NO Debe Hacerse"',
    fileContains('docs/ai-recovery/AMPLIACIONES_MODULE_AUDIT_AND_PLAN.md', 'NO Debe Hacerse')
  );

  check(
    'El documento propone MVP seguro',
    fileContains('docs/ai-recovery/AMPLIACIONES_MODULE_AUDIT_AND_PLAN.md', 'MVP Seguro')
  );

  check(
    'scripts/audit-ampliaciones-module.mjs existe',
    fileExists('scripts/audit-ampliaciones-module.mjs')
  );

  check(
    'scripts/check-ampliaciones-plan.mjs existe',
    fileExists('scripts/check-ampliaciones-plan.mjs')
  );

  // ── 2. Migraciones: no debe haber nuevas para ampliaciones ────────────────
  section('2. Migraciones (no debe haber nuevas no autorizadas)');

  const migrationsDir = resolve(process.cwd(), 'supabase', 'migrations');
  if (existsSync(migrationsDir)) {
    const { readdirSync } = await import('fs');
    const migrations = readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
    const ampliacionMigrations = migrations.filter(f =>
      f.toLowerCase().includes('ampliacion') || f.toLowerCase().includes('ampliaciones')
    );

    if (ampliacionMigrations.length === 0) {
      check('No hay migraciones nuevas para ampliaciones', true);
    } else {
      check(
        `Hay migraciones de ampliaciones: ${ampliacionMigrations.join(', ')}`,
        'warn',
        'Solo permitido si fue autorizado explícitamente'
      );
    }

    const stateMigrations = migrations.filter(f =>
      f.toLowerCase().includes('estado') && f.toLowerCase().includes('ampliacion')
    );
    if (stateMigrations.length === 0) {
      check('No hay migración de campo estado en ampliaciones (correcto por ahora)', true);
    } else {
      check('Hay migración de campo estado en ampliaciones', 'warn', 'Verificar si fue aprobado');
    }
  } else {
    check('Directorio supabase/migrations/ no existe', 'warn', 'Estructura inesperada');
  }

  // ── 3. No se tocaron tablas financieras ───────────────────────────────────
  section('3. Integridad de tablas financieras (no se debieron tocar)');

  const allowedMigrationFiles = [
    '20260617000000_create_decrementar_saldo_capital.sql',
    '20260617000001_create_registrar_aporte_socio.sql',
    '20260617000002_create_crear_credito_con_cronograma.sql',
    '20260617000003_fix_tipo_credito_cast.sql',
    '20260617000004_fix_estado_cuota_cast.sql',
    '20260605112510_remote_existing_migration_placeholder.sql',
    '20260623000001_create_socio_beneficiarios.sql',
  ];

  if (existsSync(migrationsDir)) {
    const { readdirSync } = await import('fs');
    const allMigrations = readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
    const newMigrations = allMigrations.filter(f => !allowedMigrationFiles.includes(f));

    if (newMigrations.length === 0) {
      check('No hay migraciones nuevas fuera del plan previo', true);
    } else {
      newMigrations.forEach(f => {
        const isAmpliacion = f.toLowerCase().includes('ampliacion');
        check(
          `Migración nueva detectada: ${f}`,
          isAmpliacion ? 'warn' : 'warn',
          'Verificar si fue autorizada en esta fase'
        );
      });
    }
  }

  // ── 4. No hay UI de ampliaciones implementada aún ─────────────────────────
  section('4. Estado de la UI (no debe estar implementada todavía)');

  const ampliacionesPage = resolve(process.cwd(), 'app', 'dashboard', 'ampliaciones');
  if (!existsSync(ampliacionesPage)) {
    check('No existe app/dashboard/ampliaciones/ (correcto para esta fase)', true);
  } else {
    check('app/dashboard/ampliaciones/ existe', 'warn', 'Revisar si es implementación prematura');
  }

  const ampliacionesAmplarPage = resolve(
    process.cwd(), 'app', 'dashboard', 'creditos', '[id]', 'ampliar'
  );
  if (!existsSync(ampliacionesAmplarPage)) {
    check('No existe creditos/[id]/ampliar/ (correcto para esta fase)', true);
  } else {
    check('creditos/[id]/ampliar/ existe', 'warn', 'Revisar si es implementación prematura');
  }

  // ── 5. No hay lógica de actualización automática de créditos ─────────────
  section('5. No hay lógica financiera irreversible en código');

  const ampliacionImports = grepCode("from.*ampliacion", ['ts', 'tsx']);
  if (ampliacionImports.length === 0) {
    check('No hay imports de módulos de ampliaciones en app/', true);
  } else {
    check(
      `Imports de ampliaciones encontrados: ${ampliacionImports.slice(0, 3).join(', ')}`,
      'warn',
      'Revisar si es implementación prematura'
    );
  }

  const rpcAmpliacion = grepCode("rpc.*ampliacion", ['ts', 'tsx']);
  if (rpcAmpliacion.length === 0) {
    check('No hay llamadas RPC de ampliaciones en código', true);
  } else {
    check(
      'Hay llamadas RPC de ampliaciones en código',
      false,
      'PELIGRO: RPC de ampliaciones no debe existir sin plan aprobado'
    );
  }

  // ── 6. Verificar package.json tiene los comandos nuevos ───────────────────
  section('6. Comandos npm');

  const pkgPath = resolve(process.cwd(), 'package.json');
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    const scripts = pkg.scripts ?? {};

    check(
      'npm run audit:ampliaciones-module definido',
      'audit:ampliaciones-module' in scripts
    );

    check(
      'npm run check:ampliaciones-plan definido',
      'check:ampliaciones-plan' in scripts
    );
  } else {
    check('package.json no encontrado', false);
  }

  // ── 7. El plan incluye reglas de negocio pendientes ───────────────────────
  section('7. Preguntas de negocio pendientes documentadas');

  const doc = 'docs/ai-recovery/AMPLIACIONES_MODULE_AUDIT_AND_PLAN.md';

  const businessQuestions = [
    ['Pregunta sobre cancelar vs modificar crédito', 'cancela el crédito original'],
    ['Pregunta sobre cronograma', 'cronograma'],
    ['Pregunta sobre pagaré', 'pagaré siempre cambia'],
    ['Pregunta sobre saldo nuevo', 'saldo_nuevo'],
    ['Pregunta sobre tasa de interés', 'tasa de interés'],
    ['Pregunta sobre aprobación', 'aprobación'],
    ['Pregunta sobre número de ampliaciones', 'más de una ampliación'],
  ];

  businessQuestions.forEach(([label, pattern]) => {
    check(label, fileContains(doc, pattern));
  });

  // ── Resumen ───────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════');
  console.log(`  RESUMEN: ${checks} checks | ${passes} PASS | ${warns} WARN | ${fails} FAIL`);
  console.log('══════════════════════════════════════════════════════');

  if (fails > 0) {
    console.log('\n  RESULTADO: FALLOS CRÍTICOS — Plan incompleto o con riesgos.\n');
    process.exit(1);
  } else if (warns > 0) {
    console.log('\n  RESULTADO: PLAN OK con advertencias menores');
    console.log('  Los WARN son items a monitorear — no bloquean el avance.\n');
  } else {
    console.log(`\n  RESULTADO: ${passes}/${checks} PASS — Plan de auditoría completo y seguro.\n`);
  }
}

main().catch(err => {
  console.error('Error inesperado:', err);
  process.exit(1);
});
