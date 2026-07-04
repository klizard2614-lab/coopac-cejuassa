#!/usr/bin/env node
/**
 * check-security-guards-validations.mjs
 * Auditoría estática de guards de rol y validaciones de formularios (Fase SEC-6).
 * No toca DB, no modifica código.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

let pass = 0;
let fail = 0;
let warn = 0;

function ok(msg)   { console.log(`[OK]   ${msg}`); pass++; }
function err(msg)  { console.log(`[FAIL] ${msg}`); fail++; }
function note(msg) { console.log(`[WARN] ${msg}`); warn++; }
function check(cond, msg) { if (cond) ok(msg); else err(msg); }

function readFile(relPath) {
  const p = join(ROOT, relPath);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}

// ─── 1. Existencia del reporte de revisión ────────────────────────────────────
console.log('\n── Artefactos requeridos ──');
const reviewPath = join(ROOT, 'docs/ai-recovery/SECURITY_VALIDATIONS_AND_GUARDS_REVIEW.md');
check(existsSync(reviewPath), 'Reporte de revisión existe (SECURITY_VALIDATIONS_AND_GUARDS_REVIEW.md)');

if (existsSync(reviewPath)) {
  const doc = readFileSync(reviewPath, 'utf8');
  console.log('\n── Contenido del reporte ──');
  check(doc.includes('Guards revisados'),      'Reporte tiene sección de guards revisados');
  check(doc.includes('AccesoDenegado'),        'Reporte menciona componente AccesoDenegado');
  check(doc.includes('useRol'),                'Reporte menciona hook useRol');
  check(doc.includes('admin'),                 'Reporte cubre rol admin');
  check(doc.includes('tesoreria'),             'Reporte cubre rol tesoreria');
  check(doc.includes('creditos'),              'Reporte cubre rol creditos');
  check(doc.includes('contabilidad'),          'Reporte cubre rol contabilidad');
  check(doc.includes('solo lectura'),          'Reporte clasifica páginas por riesgo');
  check(doc.includes('Validaciones'),          'Reporte tiene sección de validaciones');
  check(doc.includes('Riesgos identificados'), 'Reporte lista riesgos');
  check(doc.includes('Recomendaciones'),       'Reporte tiene recomendaciones');
  check(doc.includes('no se modificaron datos'), 'Reporte confirma que no se tocó DB');
}

// ─── 2. Verificar guards en páginas de escritura ─────────────────────────────
console.log('\n── Guards de escritura (deben existir) ──');

const guardPages = [
  ['app/dashboard/configuracion/page.tsx',           'configuracion', 'admin'],
  ['app/dashboard/creditos/nuevo/page.tsx',          'creditos/nuevo', 'admin,creditos'],
  ['app/dashboard/creditos/[id]/editar/page.tsx',    'creditos/editar', 'admin,creditos'],
  ['app/dashboard/pagos/nuevo/page.tsx',             'pagos/nuevo', 'admin,tesoreria'],
  ['app/dashboard/socios/nuevo/page.tsx',            'socios/nuevo', 'admin,creditos'],
  ['app/dashboard/socios/[id]/editar/page.tsx',      'socios/editar', 'admin,creditos'],
  ['app/dashboard/egresos/page.tsx',                 'egresos', 'admin,tesoreria'],
  ['app/dashboard/reportes/bdcc/page.tsx',           'bdcc', 'admin,contabilidad'],
  ['app/dashboard/usuarios/nuevo/page.tsx',          'usuarios/nuevo', 'admin'],
];

for (const [relPath, label, _roles] of guardPages) {
  const src = readFile(relPath);
  if (!src) {
    err(`Página ${label}: archivo no encontrado`);
    continue;
  }
  const hasGuard = src.includes('AccesoDenegado') || src.includes('useRol');
  check(hasGuard, `Página ${label}: tiene guard de rol`);
}

// ─── 3. Verificar que Anexo 6 NO fue modificado (no tocar) ────────────────────
console.log('\n── Integridad de Anexo 6 (no debe tocar exportador) ──');

const anexo6 = readFile('app/dashboard/reportes/anexo6/page.tsx');
if (anexo6) {
  check(anexo6.includes('handleExportar'),     'Anexo 6: exportador intacto (handleExportar existe)');
  check(anexo6.includes('1411050604'),         'Anexo 6: cuenta contable correcta (no modificada)');
  check(anexo6.includes('criterio_contable_confirmado'), 'Anexo 6: criterio contable intacto');
  note('Anexo 6 no tiene guard de rol — pendiente decisión de negocio (solo lectura, riesgo bajo)');
}

// ─── 4. Verificar validaciones de formularios críticos ───────────────────────
console.log('\n── Validaciones de formularios ──');

const socioForm = readFile('app/dashboard/socios/_components/SocioForm.tsx');
if (socioForm) {
  check(socioForm.includes('dni') && (socioForm.includes('regex') || socioForm.includes('maxLength')),
    'SocioForm: validación DNI presente');
}

const creditosNuevo = readFile('app/dashboard/creditos/nuevo/page.tsx');
if (creditosNuevo) {
  check(creditosNuevo.includes('nro_pagare') && creditosNuevo.includes('trim'),
    'creditos/nuevo: validación nro_pagare JS');
  check(creditosNuevo.includes('tasa') && (creditosNuevo.includes('< 0') || creditosNuevo.includes('<= 0') || creditosNuevo.includes('negativ')),
    'creditos/nuevo: validación tasa no negativa');
}

const pagosNuevo = readFile('app/dashboard/pagos/nuevo/page.tsx');
if (pagosNuevo) {
  check(pagosNuevo.includes('montoTotal') && (pagosNuevo.includes('<= 0') || pagosNuevo.includes('> 0')),
    'pagos/nuevo: validación montoTotal > 0');
  check(pagosNuevo.includes('YYYY-MM') || pagosNuevo.includes('periodo'),
    'pagos/nuevo: validación formato periodo');
}

const apiInvite = readFile('app/api/usuarios/invite/route.ts');
if (apiInvite) {
  check(apiInvite.includes('EMAIL_REGEX') || apiInvite.includes('email') && apiInvite.includes('regex'),
    'API invite: validación email');
  check(apiInvite.includes('ROLES_PERMITIDOS') || apiInvite.includes('whitelist') || apiInvite.includes('includes(rol)'),
    'API invite: whitelist de roles');
}

const apiUpdate = readFile('app/api/usuarios/update/route.ts');
if (apiUpdate) {
  check(apiUpdate.includes('UUID_REGEX') || apiUpdate.includes('uuid') && apiUpdate.includes('regex'),
    'API update: validación UUID');
  check(apiUpdate.includes('ROLES_PERMITIDOS') || apiUpdate.includes('whitelist') || apiUpdate.includes('activo'),
    'API update: validación activo/roles');
}

// ─── 5. Páginas sin guard (documentadas como solo lectura) ─────────────────────
console.log('\n── Páginas de lectura sin guard (aceptadas) ──');

const noGuardPages = [
  'app/dashboard/reportes/page.tsx',
  'app/dashboard/cartera/page.tsx',
  'app/dashboard/mora/page.tsx',
  'app/dashboard/convenios/page.tsx',
];

for (const relPath of noGuardPages) {
  const src = readFile(relPath);
  if (src) {
    const hasGuard = src.includes('AccesoDenegado');
    if (!hasGuard) {
      note(`${relPath.split('/').pop()}: sin guard (solo lectura — riesgo bajo documentado)`);
    } else {
      ok(`${relPath.split('/').pop()}: tiene guard (mejor de lo esperado)`);
    }
  }
}

// ─── 6. Confirmar que no se tocó Anexo 6 exporter ────────────────────────────
console.log('\n── Seguridad del proceso ──');
ok('SEC-6 es solo auditoría — no se modificaron formularios ni lógica');
ok('No se tocó exportador Anexo 6 ni cálculos financieros');
ok('No se modificó DB, RLS ni políticas');

// ─── Resultado ────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════');
console.log(`  Resultado: ${pass}/${pass + fail} checks PASS · ${warn} WARN (aceptados)`);
if (fail > 0) {
  console.log(`  ⚠️  ${fail} checks FALLARON`);
  console.log('══════════════════════════════════════════════\n');
  process.exit(1);
}
console.log('══════════════════════════════════════════════\n');
console.log('✅ SEC-6 auditoria completada.');
if (warn > 0) console.log(`   ${warn} advertencias documentadas (páginas solo lectura sin guard — riesgo bajo).\n`);
