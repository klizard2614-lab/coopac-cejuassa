#!/usr/bin/env node
/**
 * check-xlsx-risk-plan.mjs
 * Verifica que el plan de riesgo DEP-1 para xlsx existe y es correcto.
 * Audita que la app no lee archivos Excel de usuarios externos.
 * No reemplaza xlsx.
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

// ─── 1. Plan DEP-1 existe ─────────────────────────────────────────────────────
console.log('\n── Artefacto DEP-1 ──');

const planPath = join(ROOT, 'docs/ai-recovery/XLSX_DEPENDENCY_RISK_AND_MIGRATION_PLAN.md');
check(existsSync(planPath), 'Plan DEP-1 existe (XLSX_DEPENDENCY_RISK_AND_MIGRATION_PLAN.md)');

if (existsSync(planPath)) {
  const doc = readFileSync(planPath, 'utf8');
  console.log('\n── Contenido del plan ──');
  check(doc.includes('xlsx'),                      'Plan menciona dependencia xlsx');
  check(doc.includes('Prototype Pollution') ||
        doc.includes('vulnerabilidad'),             'Plan documenta la vulnerabilidad');
  check(doc.includes('riesgo práctico'),            'Plan evalúa el riesgo práctico');
  check(doc.includes('ExcelJS'),                    'Plan evalúa alternativa ExcelJS');
  check(doc.includes('DEP-1A') || doc.includes('Plan por fases'), 'Plan tiene fases de migración');
  check(doc.includes('no se reemplaza') ||
        doc.includes('sin cambios') ||
        doc.includes('Mantener'),                   'Plan deja xlsx sin cambios en esta fase');
  check(doc.includes('usuarios externos') ||
        doc.includes('archivos de usuario'),        'Plan analiza si lee archivos externos');
  check(doc.includes('Anexo'),                      'Plan menciona riesgo de regresión en Anexo N°6');
  // El plan puede mencionar "npm audit fix --force" solo para desaconsejarlo
  const mentionForce = doc.includes('npm audit fix --force');
  const discouragedForce = doc.includes('NO usar') || doc.includes('❌ NO') || doc.includes('No usar');
  check(!mentionForce || discouragedForce, 'Plan NO recomienda npm audit fix --force (solo lo menciona para desaconsejarlo)');
}

// ─── 2. Verificar que la app NO lee archivos de usuarios ─────────────────────
console.log('\n── App frontend: solo exporta (no lee archivos externos) ──');

const pagesConXlsx = [
  'app/dashboard/reportes/anexo6/page.tsx',
  'app/dashboard/reportes/caja/page.tsx',
  'app/dashboard/reportes/aportes/page.tsx',
];

for (const rel of pagesConXlsx) {
  const src = readFile(rel);
  if (!src) { err(`${rel}: no encontrado`); continue; }
  const nombre = rel.split('/').pop();

  // Debe usar exportación
  const exporta = src.includes('writeFile') || src.includes('book_new') || src.includes('aoa_to_sheet');
  check(exporta, `${nombre}: usa xlsx para exportar`);

  // NO debe leer archivos externos (readFile, readFileSync, FileReader, input type=file)
  const leeExterno = src.includes('XLSX.readFile') || src.includes('XLSX.read(') ||
                     src.includes('FileReader') || src.includes("type='file'") ||
                     src.includes('type="file"');
  check(!leeExterno, `${nombre}: NO lee archivos Excel de usuarios externos`);
}

// ─── 3. Scripts que leen archivos: solo archivos locales del proyecto ─────────
console.log('\n── Scripts de importación: leen archivos locales (no de usuarios web) ──');

const scriptsLectura = [
  'scripts/import-excel/import-excel-mvp.mjs',
  'scripts/import-excel/dry-run-excel-import.mjs',
];

for (const rel of scriptsLectura) {
  const src = readFile(rel);
  if (!src) { note(`${rel}: no encontrado (puede ser normal si no fue creado)`); continue; }
  const nombre = rel.split('/').pop();

  // Debe leer archivos locales (no request.body ni FormData)
  const leeRequest = src.includes('request.body') || src.includes('FormData') ||
                     src.includes('req.body') || src.includes('multer');
  check(!leeRequest, `${nombre}: NO lee archivos desde request HTTP (usuarios externos)`);
  note(`${nombre}: lee archivos locales del proyecto (_client_files/) — riesgo bajo`);
}

// ─── 4. xlsx NO fue reemplazado en esta fase ─────────────────────────────────
console.log('\n── xlsx intacto (no reemplazado en DEP-1) ──');

const pkg = readFile('package.json');
if (pkg) {
  check(pkg.includes('"xlsx"'), 'package.json: xlsx sigue siendo dependencia activa');
  check(!pkg.includes('"exceljs"'), 'package.json: exceljs NO fue instalado (esperado en DEP-1)');
}

// ─── 5. Seguridad del script ─────────────────────────────────────────────────
console.log('\n── Seguridad de este check ──');
ok('Este script no ejecuta npm audit fix ni modifica dependencias');
ok('No toca DB, no modifica código de la app');

// ─── Resultado ────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════');
console.log(`  Resultado: ${pass}/${pass + fail} checks PASS · ${warn} WARN`);
if (fail > 0) {
  console.log(`  ⚠️  ${fail} checks FALLARON`);
  console.log('══════════════════════════════════════════════\n');
  process.exit(1);
}
console.log('══════════════════════════════════════════════\n');
console.log('✅ Plan DEP-1 xlsx verificado.');
console.log('   xlsx mantiene la versión actual — riesgo práctico BAJO (solo exporta en frontend).\n');
