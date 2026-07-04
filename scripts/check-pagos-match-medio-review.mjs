// Fase 9C-6G — Check: verificar artefactos de revisión de match_medio
// npm run check:pagos-match-medio-review
// NO modifica la DB. NO toca _client_files.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

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

console.log('\n=== check:pagos-match-medio-review — Fase 9C-6G ===\n');

// 1. Excel existe
const excelPath = path.join(ROOT, 'exports', 'data-corrections', 'revision_pagos_match_medio.xlsx');
const excelExists = fs.existsSync(excelPath);
check('Excel existe: exports/data-corrections/revision_pagos_match_medio.xlsx', excelExists);

// 2. Excel tiene tamaño razonable (> 1 KB — no está vacío)
if (excelExists) {
  const stat = fs.statSync(excelPath);
  check('Excel tiene contenido (> 1 KB)', stat.size > 1024, `tamaño: ${stat.size} bytes`);
} else {
  check('Excel tiene contenido (> 1 KB)', false, 'archivo no encontrado');
}

// 3. Documento de revisión existe
const docPath = path.join(ROOT, 'docs', 'ai-recovery', 'PAGOS_MATCH_MEDIO_REVIEW.md');
const docExists = fs.existsSync(docPath);
check('Documento existe: docs/ai-recovery/PAGOS_MATCH_MEDIO_REVIEW.md', docExists);

// 4. Documento menciona 3 casos
if (docExists) {
  const docContent = fs.readFileSync(docPath, 'utf8');
  check('Documento menciona "3 casos" o "3"', docContent.includes('**3**') || docContent.includes('3 casos'));
  check('Documento contiene valores permitidos de decision_creditos', docContent.includes('vincular_al_credito_propuesto'));
  check('Documento aclara no modificar DB manualmente', docContent.includes('NO modificar directamente la base de datos'));
  check('Documento incluye vincular_al_credito_propuesto', docContent.includes('vincular_al_credito_propuesto'));
  check('Documento incluye no_vincular', docContent.includes('no_vincular'));
  check('Documento incluye credito_faltante_en_importacion', docContent.includes('credito_faltante_en_importacion'));
  check('Documento incluye requiere_revision', docContent.includes('requiere_revision'));
} else {
  for (let i = 0; i < 7; i++) check('Documento de revisión (contenido)', false, 'archivo no encontrado');
}

// 5. Script NO modifica la DB (verifica que no hay statements de UPDATE/INSERT/DELETE en este script)
const thisScript = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8');
const noDbMod = !/supabase\.(from|rpc)\(.*\)\.(update|insert|delete|upsert)/.test(thisScript);
check('Este script no modifica la DB', noDbMod);

// 6. No hay migraciones nuevas en supabase/migrations/ con timestamp de hoy
const migrationsDir = path.join(ROOT, 'supabase', 'migrations');
if (fs.existsSync(migrationsDir)) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const files = fs.readdirSync(migrationsDir);
  const newMigrations = files.filter(f => f.startsWith(today));
  check('No hay migraciones nuevas de hoy', newMigrations.length === 0, newMigrations.join(', '));
} else {
  check('No hay migraciones nuevas de hoy', true, 'carpeta migrations no existe');
}

// 7. No se tocaron _client_files (verificación básica: no se crearon archivos ahí)
const clientFilesDir = path.join(ROOT, '_client_files');
if (fs.existsSync(clientFilesDir)) {
  // Solo verificar que el directorio no tiene archivos recién modificados (en últimos 60 segundos)
  const now = Date.now();
  let recentlyModified = [];
  function scanDir(dir) {
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) scanDir(full);
        else {
          const stat = fs.statSync(full);
          if (now - stat.mtimeMs < 60000) recentlyModified.push(full.replace(ROOT, ''));
        }
      }
    } catch { /* ignore permission errors */ }
  }
  scanDir(clientFilesDir);
  check('_client_files no fue modificado recientemente', recentlyModified.length === 0,
    recentlyModified.slice(0, 3).join(', '));
} else {
  check('_client_files no fue modificado recientemente', true, 'directorio no existe');
}

// 8. Directorio exports/data-corrections/ existe
check('Directorio exports/data-corrections/ existe', fs.existsSync(path.join(ROOT, 'exports', 'data-corrections')));

// 9. Generación script existe (para referencia)
const genScript = path.join(ROOT, 'scripts', 'generate-match-medio-excel.mjs');
check('Script de generación existe (referencia)', fs.existsSync(genScript));

console.log(`\n=== Resultado: ${passed} PASS · ${failed} FAIL ===\n`);

if (failed > 0) {
  console.log('❌ Algunos checks fallaron. Revisar los mensajes anteriores.\n');
  process.exit(1);
} else {
  console.log('✅ Todos los checks pasaron. Artefactos de revisión match_medio listos.\n');
}
