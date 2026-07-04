/**
 * check-excel-import-prep.mjs
 * Fase 9C-4A — Verificación de que la preparación de importación Excel cumple reglas estrictas.
 */

import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

let passed = 0;
let failed = 0;

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ PASS  ${label}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL  ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

function fileContains(filePath, pattern) {
  if (!existsSync(filePath)) return false;
  const content = readFileSync(filePath, 'utf8');
  if (pattern instanceof RegExp) return pattern.test(content);
  return content.includes(pattern);
}

function fileNotContains(filePath, pattern) {
  if (!existsSync(filePath)) return true; // si no existe, no contiene
  const content = readFileSync(filePath, 'utf8');
  if (pattern instanceof RegExp) return !pattern.test(content);
  return !content.includes(pattern);
}

console.log('\n══════════════════════════════════════════════════════');
console.log('  CEJUASSA — Check: Excel Import Prep (Fase 9C-4A)');
console.log('══════════════════════════════════════════════════════\n');

const AUDIT = resolve(ROOT, 'docs/ai-recovery/EXCEL_IMPORT_SOURCE_AUDIT.md');
const MAPPING = resolve(ROOT, 'docs/ai-recovery/EXCEL_IMPORT_MAPPING_PLAN.md');
const DRY_RUN_SCRIPT = resolve(ROOT, 'scripts/import-excel/dry-run-excel-import.mjs');
const DRY_RUN_REPORT = resolve(ROOT, 'docs/ai-recovery/EXCEL_IMPORT_DRY_RUN_REPORT.md');
const PKG = resolve(ROOT, 'package.json');

// ─── Bloque 1: Existencia de artefactos ──────────────────────────────────────

console.log('📁 Bloque 1: Existencia de artefactos');

check('Auditoría Excel existe (EXCEL_IMPORT_SOURCE_AUDIT.md)', existsSync(AUDIT));
check('Plan de mapping existe (EXCEL_IMPORT_MAPPING_PLAN.md)', existsSync(MAPPING));
check('Script dry-run existe (scripts/import-excel/dry-run-excel-import.mjs)', existsSync(DRY_RUN_SCRIPT));
check('Reporte dry-run existe (EXCEL_IMPORT_DRY_RUN_REPORT.md)', existsSync(DRY_RUN_REPORT));

// ─── Bloque 2: Contenido mínimo de la auditoría ──────────────────────────────

console.log('\n📋 Bloque 2: Contenido mínimo de auditoría');

check(
  'Auditoría menciona DSCTO Y DESEMBOLSO (créditos)',
  fileContains(AUDIT, 'DSCTO') && fileContains(AUDIT, 'creditos'),
);
check(
  'Auditoría menciona INGRESO DETALLADO (pagos)',
  fileContains(AUDIT, 'INGRESO DETALLADO') && fileContains(AUDIT, 'pagos'),
);
check(
  'Auditoría menciona CONVENIO (convenios/pagos)',
  fileContains(AUDIT, 'CONVENIO') && fileContains(AUDIT, 'pagos'),
);
check(
  'Auditoría alerta sobre falta de padrón de socios',
  fileContains(AUDIT, /sin fuente.*socios|no hay.*excel.*socios|sin.*padrón/i) ||
  fileContains(AUDIT, 'No existe ningún Excel con tabla de socios') ||
  fileContains(AUDIT, 'Sin Excel'),
);
check(
  'Auditoría clasifica archivos de referencia (G)',
  fileContains(AUDIT, 'referencia') || fileContains(AUDIT, 'Solo referencia'),
);

// ─── Bloque 3: Contenido mínimo del mapping ──────────────────────────────────

console.log('\n🗺️  Bloque 3: Contenido mínimo del plan de mapping');

check('Mapping define orden de carga', fileContains(MAPPING, 'Orden de carga') || fileContains(MAPPING, 'orden'));
check('Mapping cubre tabla socios', fileContains(MAPPING, '`socios`') || fileContains(MAPPING, 'socios'));
check('Mapping cubre tabla creditos', fileContains(MAPPING, '`creditos`') || fileContains(MAPPING, 'creditos'));
check('Mapping cubre tabla pagos_recibos', fileContains(MAPPING, 'pagos_recibos'));
check('Mapping cubre tabla aportes', fileContains(MAPPING, 'aportes'));
check('Mapping cubre tabla convenios', fileContains(MAPPING, 'convenios'));
check('Mapping menciona transformación de fecha serial Excel', fileContains(MAPPING, 'serial') || fileContains(MAPPING, '25569') || fileContains(MAPPING, 'excelDate'));

// ─── Bloque 4: Seguridad del script dry-run ──────────────────────────────────

console.log('\n🔐 Bloque 4: Seguridad del script dry-run');

check(
  'Script dry-run no contiene INSERT SQL',
  fileNotContains(DRY_RUN_SCRIPT, /\.insert\s*\(/i) &&
  fileNotContains(DRY_RUN_SCRIPT, /INSERT\s+INTO/i),
  'El script no debe insertar datos'
);
check(
  'Script dry-run no contiene UPDATE SQL',
  fileNotContains(DRY_RUN_SCRIPT, /\.update\s*\(\s*\{/i) &&
  fileNotContains(DRY_RUN_SCRIPT, /UPDATE\s+\w+\s+SET/i),
  'El script no debe actualizar datos'
);
check(
  'Script dry-run no contiene DELETE SQL',
  fileNotContains(DRY_RUN_SCRIPT, /\.delete\s*\(\s*\)/i) &&
  fileNotContains(DRY_RUN_SCRIPT, /DELETE\s+FROM/i),
  'El script no debe borrar datos'
);
check(
  'Script dry-run no contiene TRUNCATE',
  fileNotContains(DRY_RUN_SCRIPT, /TRUNCATE/i),
);
check(
  'Script dry-run no toca tabla usuarios',
  fileNotContains(DRY_RUN_SCRIPT, /from\s*\(\s*['"`]usuarios['"`]/i) &&
  fileNotContains(DRY_RUN_SCRIPT, /\.from\(['"`]usuarios['"`]\)/),
);
check(
  'Script dry-run no toca configuracion',
  fileNotContains(DRY_RUN_SCRIPT, /\.from\(['"`]configuracion['"`]\)/),
);
check(
  'Script dry-run no toca auth.users',
  (() => {
    if (!existsSync(DRY_RUN_SCRIPT)) return true;
    const lines = readFileSync(DRY_RUN_SCRIPT, 'utf8').split('\n');
    // Solo verificar líneas que NO son comentarios
    return !lines.some(l => !/^\s*[/*]/.test(l) && /auth\.users/.test(l));
  })(),
);
check(
  'Script dry-run no crea migraciones',
  fileNotContains(DRY_RUN_SCRIPT, /supabase.*migration/i) &&
  fileNotContains(DRY_RUN_SCRIPT, /ALTER\s+TABLE/i) &&
  fileNotContains(DRY_RUN_SCRIPT, /CREATE\s+TABLE/i),
);
check(
  'Script dry-run no modifica _client_files',
  fileNotContains(DRY_RUN_SCRIPT, /writeFile.*_client_files/i) &&
  fileNotContains(DRY_RUN_SCRIPT, /appendFile.*_client_files/i),
);
check(
  'Script dry-run no usa backup JSON como fuente principal',
  fileNotContains(DRY_RUN_SCRIPT, /readFileSync.*backups/i) ||
  fileContains(DRY_RUN_SCRIPT, 'alternativa') ||
  fileContains(DRY_RUN_SCRIPT, 'sin fuente'),
  'El backup JSON no debe ser la fuente principal — solo alternativa'
);
check(
  'Script dry-run declara modo solo lectura',
  fileContains(DRY_RUN_SCRIPT, 'Solo lectura') ||
  fileContains(DRY_RUN_SCRIPT, 'NO se inserta') ||
  fileContains(DRY_RUN_SCRIPT, 'dry-run'),
);

// ─── Bloque 5: Comandos npm registrados ──────────────────────────────────────

console.log('\n📦 Bloque 5: Comandos npm');

let pkgJson = {};
try { pkgJson = JSON.parse(readFileSync(PKG, 'utf8')); } catch {}

check(
  'npm run import:excel:dry-run registrado',
  pkgJson.scripts?.['import:excel:dry-run'] !== undefined,
);
check(
  'npm run check:excel-import-prep registrado',
  pkgJson.scripts?.['check:excel-import-prep'] !== undefined,
);
check(
  'import:excel:dry-run apunta al script correcto',
  pkgJson.scripts?.['import:excel:dry-run']?.includes('dry-run-excel-import.mjs'),
);
check(
  'check:excel-import-prep apunta al script correcto',
  pkgJson.scripts?.['check:excel-import-prep']?.includes('check-excel-import-prep.mjs'),
);

// ─── Bloque 6: Reporte dry-run ───────────────────────────────────────────────

console.log('\n📄 Bloque 6: Reporte dry-run');

check(
  'Reporte contiene confirmación "No se insertó"',
  fileContains(DRY_RUN_REPORT, 'NO se insertó ningún dato') ||
  fileContains(DRY_RUN_REPORT, '0 — Ninguno'),
);
check(
  'Reporte contiene totales de créditos',
  fileContains(DRY_RUN_REPORT, 'Créditos') || fileContains(DRY_RUN_REPORT, 'creditos'),
);
check(
  'Reporte contiene totales de pagos',
  fileContains(DRY_RUN_REPORT, 'pagos') || fileContains(DRY_RUN_REPORT, 'Pagos'),
);
check(
  'Reporte menciona tablas sin fuente Excel',
  fileContains(DRY_RUN_REPORT, 'Sin Excel') || fileContains(DRY_RUN_REPORT, 'sin fuente'),
);

// ─── Resultado final ──────────────────────────────────────────────────────────

const total = passed + failed;
console.log('\n══════════════════════════════════════════════════════');
console.log(`  Resultado: ${passed}/${total} PASS`);
if (failed === 0) {
  console.log('  ✅ TODOS LOS CHECKS PASARON — Excel Import Prep lista');
} else {
  console.log(`  ❌ ${failed} checks fallaron — revisar antes de continuar`);
}
console.log('══════════════════════════════════════════════════════\n');

process.exit(failed > 0 ? 1 : 0);
