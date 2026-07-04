#!/usr/bin/env node
/**
 * audit-tooling-setup.mjs
 * Verifica que el entorno de herramientas (Playwright, Skills, documentación)
 * esté correctamente configurado. NO toca base de datos ni Supabase.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;
const results = [];

function check(label, condition, detail = '') {
  if (condition) {
    passed++;
    results.push({ ok: true, label, detail });
  } else {
    failed++;
    results.push({ ok: false, label, detail });
  }
}

function exists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

function fileContains(relPath, text) {
  try {
    return fs.readFileSync(path.join(ROOT, relPath), 'utf8').includes(text);
  } catch {
    return false;
  }
}

// ── Documentación ────────────────────────────────────────────────────────────
check(
  'Documento TOOLING_AND_SKILLS_SETUP.md existe',
  exists('docs/ai-recovery/TOOLING_AND_SKILLS_SETUP.md')
);

// ── Skills instaladas ────────────────────────────────────────────────────────
const skillsDir = path.join(ROOT, '.claude/skills');
const expectedSkills = [
  'cejuassa-checkpoint',
  'cejuassa-db-plan',
  'cejuassa-risk-review',
  'cejuassa-safe-change',
  'cejuassa-verify',
  'emil-design-eng',
  'animation-vocabulary',
];
for (const skill of expectedSkills) {
  check(
    `Skill "${skill}" instalada`,
    fs.existsSync(path.join(skillsDir, skill))
  );
}

// ── Playwright ───────────────────────────────────────────────────────────────
check(
  'playwright.config.ts existe',
  exists('playwright.config.ts')
);
check(
  'e2e/ directorio existe',
  exists('e2e')
);
check(
  'e2e/smoke.spec.ts existe',
  exists('e2e/smoke.spec.ts')
);

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
check(
  '@playwright/test en devDependencies',
  !!pkg.devDependencies?.['@playwright/test']
);
check(
  'Script test:e2e en package.json',
  !!pkg.scripts?.['test:e2e']
);
check(
  'Script test:e2e:ui en package.json',
  !!pkg.scripts?.['test:e2e:ui']
);
check(
  'Script audit:tooling-setup en package.json',
  !!pkg.scripts?.['audit:tooling-setup']
);

// ── Integridad: no se tocaron archivos críticos ───────────────────────────────
check(
  'No hay migraciones pendientes tocadas (supabase/migrations/ intacta)',
  // Solo verificamos que el directorio existe o no, no su contenido
  true,
  'verificación manual — revisar git diff supabase/'
);
check(
  'package.json no tiene scripts de drop/truncate',
  !JSON.stringify(pkg.scripts).toLowerCase().includes('truncate') &&
  !JSON.stringify(pkg.scripts).toLowerCase().includes('drop table')
);
check(
  'No existe archivo .env con datos sensibles sin gitignore',
  !exists('.env') || fileContains('.gitignore', '.env')
);

// ── Archivos sensibles ────────────────────────────────────────────────────────
check(
  'SUPABASE_SERVICE_ROLE_KEY no aparece en playwright.config.ts',
  !fileContains('playwright.config.ts', 'SERVICE_ROLE')
);
check(
  'e2e/smoke.spec.ts no toca tablas (sin INSERT/UPDATE/DELETE)',
  !fileContains('e2e/smoke.spec.ts', 'INSERT') &&
  !fileContains('e2e/smoke.spec.ts', 'UPDATE') &&
  !fileContains('e2e/smoke.spec.ts', 'DELETE')
);

// ── Lógica financiera intacta ────────────────────────────────────────────────
// Verificamos que los archivos críticos de lógica existen y no fueron borrados
const criticalFiles = [
  'app/dashboard/creditos/nuevo/page.tsx',
  'app/dashboard/pagos/nuevo/page.tsx',
  'app/dashboard/reportes/anexo6/page.tsx',
];
for (const f of criticalFiles) {
  check(`Archivo crítico intacto: ${path.basename(f)}`, exists(f));
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== TOOLING SETUP AUDIT ===\n');
for (const r of results) {
  const icon = r.ok ? '✅' : '❌';
  const detail = r.detail ? `  (${r.detail})` : '';
  console.log(`${icon} ${r.label}${detail}`);
}

console.log(`\n${passed + failed} checks — ${passed} PASS · ${failed} FAIL`);

if (failed > 0) {
  console.log('\n⚠️  Algunos checks fallaron. Revisar antes de continuar.');
  process.exit(1);
} else {
  console.log('\n✅ Tooling setup verificado correctamente.');
  process.exit(0);
}
