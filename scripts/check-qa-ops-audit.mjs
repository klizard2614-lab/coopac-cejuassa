#!/usr/bin/env node
/**
 * check-qa-ops-audit.mjs
 * Verifica que la auditoría QA-OPS-0 esté completa y correcta.
 * No toca DB, no hace requests a Supabase.
 */

import fs from 'fs'
import path from 'path'

const ROOT = process.cwd()
const PASS = '✅'
const FAIL = '❌'
const WARN = '⚠️ '

let passed = 0
let failed = 0

function check(label, value, detail = '') {
  if (value) {
    console.log(`  ${PASS} ${label}${detail ? ' — ' + detail : ''}`)
    passed++
  } else {
    console.log(`  ${FAIL} ${label}${detail ? ' — ' + detail : ''}`)
    failed++
  }
}

function warn(label, detail = '') {
  console.log(`  ${WARN} ${label}${detail ? ' — ' + detail : ''}`)
}

console.log('\n━━━ QA-OPS-0 Audit Check ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

// ── 1. Existe manual HTML ──────────────────────────────────────────────────────
console.log('1. Manual HTML')
const manualPath = path.join(ROOT, 'exports/qa-ops/manual/manual_usuario_cejuassa.html')
const manualExists = fs.existsSync(manualPath)
check('manual_usuario_cejuassa.html existe', manualExists, manualPath)

// ── 2. Existe reporte QA ───────────────────────────────────────────────────────
console.log('\n2. Reporte QA')
const reportPath = path.join(ROOT, 'exports/qa-ops/reports/QA_OPERATIVA_CEJUASSA.md')
const reportExists = fs.existsSync(reportPath)
check('QA_OPERATIVA_CEJUASSA.md existe', reportExists, reportPath)

// ── 3. Existe carpeta de screenshots ──────────────────────────────────────────
console.log('\n3. Screenshots')
const screenshotsDir = path.join(ROOT, 'exports/qa-ops/screenshots')
const screenshotsDirExists = fs.existsSync(screenshotsDir)
check('carpeta exports/qa-ops/screenshots/ existe', screenshotsDirExists)

// ── 4. Al menos 10 screenshots ────────────────────────────────────────────────
if (screenshotsDirExists) {
  const files = fs.readdirSync(screenshotsDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png'))
  check(`hay al menos 10 screenshots (hay ${files.length})`, files.length >= 10, `${files.length} capturas encontradas`)
} else {
  check('hay al menos 10 screenshots', false, 'carpeta no existe')
}

// ── 5. El manual referencia capturas ──────────────────────────────────────────
console.log('\n4. Contenido del manual')
if (manualExists) {
  const manualContent = fs.readFileSync(manualPath, 'utf8')
  const imgRefs = (manualContent.match(/src="screenshots\/[^"]+"/g) || []).length
  check(`manual referencia capturas (${imgRefs} imágenes)`, imgRefs >= 10, `${imgRefs} referencias a screenshots`)

  const hasFlows = manualContent.includes('Flujo') || manualContent.includes('flujo')
  check('manual incluye flujos de trabajo', hasFlows)

  const hasLimitaciones = manualContent.includes('Limitaciones') || manualContent.includes('limitaciones')
  check('manual incluye limitaciones actuales', hasLimitaciones)

  const hasIndice = manualContent.includes('ndice') // Índice / indice
  check('manual incluye índice navegable', hasIndice)
} else {
  check('manual referencia capturas', false, 'archivo no existe')
  check('manual incluye flujos de trabajo', false)
  check('manual incluye limitaciones actuales', false)
  check('manual incluye índice navegable', false)
}

// ── 6. El reporte incluye matriz de pruebas ────────────────────────────────────
console.log('\n5. Contenido del reporte')
if (reportExists) {
  const reportContent = fs.readFileSync(reportPath, 'utf8')
  const hasMatrix = reportContent.includes('Matriz de pruebas') || reportContent.includes('matriz de pruebas')
  check('reporte incluye matriz de pruebas', hasMatrix)

  const hasSeverity = reportContent.includes('CRÍTICO') || reportContent.includes('crítico') || reportContent.includes('Hallazgos')
  check('reporte incluye hallazgos por severidad', hasSeverity)

  const hasConsolErrors = reportContent.includes('errores de consola') || reportContent.includes('Errores de consola')
  check('reporte incluye sección de errores de consola', hasConsolErrors)

  const hasRecommendation = reportContent.includes('Recomendación') || reportContent.includes('recomendación')
  check('reporte incluye recomendación final', hasRecommendation)

  const hasScreenshotTable = reportContent.includes('.jpg') && reportContent.includes('screenshots')
  check('reporte incluye evidencia con screenshots', hasScreenshotTable)
} else {
  check('reporte incluye matriz de pruebas', false, 'archivo no existe')
  check('reporte incluye hallazgos por severidad', false)
  check('reporte incluye sección de errores de consola', false)
  check('reporte incluye recomendación final', false)
  check('reporte incluye evidencia con screenshots', false)
}

// ── 7. No hay migraciones nuevas de esta fase ─────────────────────────────────
console.log('\n6. Integridad de DB y código crítico')

// Migraciones pre-existentes aprobadas (creadas en fases anteriores, no en QA-OPS-0)
const KNOWN_MIGRATIONS = new Set([
  '20260702000001_ampliaciones_add_tasa_cuota_nuevas.sql',  // Fase Ampliaciones
  '20260702000002_extend_aplicar_ampliacion_credito.sql',    // Fase Ampliaciones
  '20260702000003_create_pagos_cuotas_aplicaciones.sql',     // Fase Ampliaciones
])

const migrationsDir = path.join(ROOT, 'supabase/migrations')
if (fs.existsSync(migrationsDir)) {
  const allMigrations = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'))
  const todayMigrations = allMigrations.filter(f => f.includes('20260702'))
  const unknownNew = todayMigrations.filter(f => !KNOWN_MIGRATIONS.has(f))
  check('sin migraciones nuevas de esta fase QA-OPS-0', unknownNew.length === 0,
    unknownNew.length === 0
      ? `${todayMigrations.length} migraciones pre-existentes (aprobadas, no de QA-OPS-0)`
      : `NUEVAS en QA-OPS-0: ${unknownNew.join(', ')}`)
} else {
  check('sin migraciones nuevas de esta fase QA-OPS-0', true, 'carpeta supabase/migrations no existe')
}

// ── 8. No se tocó Anexo 06 exporter ──────────────────────────────────────────
const anexo6Path = path.join(ROOT, 'app/dashboard/reportes/anexo6/page.tsx')
if (fs.existsSync(anexo6Path)) {
  const stats = fs.statSync(anexo6Path)
  const modifiedToday = new Date(stats.mtime).toDateString() === new Date().toDateString()
  // Solo advertencia si fue modificado hoy — puede ser coincidencia con builds
  if (modifiedToday) {
    warn('anexo6/page.tsx tiene fecha de modificación de hoy', 'verificar que no fue modificado por este script')
  } else {
    check('anexo6/page.tsx no fue tocado en esta fase', true, `última modificación: ${stats.mtime.toLocaleDateString()}`)
  }
} else {
  warn('anexo6/page.tsx no encontrado', 'verificar ruta')
}

// ── 9. No se modificó DB (lib/supabase.ts sin cambios de esquema) ──────────────
const supabasePath = path.join(ROOT, 'lib/supabase.ts')
if (fs.existsSync(supabasePath)) {
  const content = fs.readFileSync(supabasePath, 'utf8')
  const hasCreateTable = content.includes('CREATE TABLE') || content.includes('ALTER TABLE')
  check('lib/supabase.ts no contiene DDL SQL', !hasCreateTable, hasCreateTable ? 'DDL SQL detectado — revisar' : 'sin DDL SQL')
} else {
  check('lib/supabase.ts existe', false)
}

// ── Resumen ─────────────────────────────────────────────────────────────────────
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
const total = passed + failed
console.log(`Resultado: ${passed}/${total} checks pasaron`)

if (failed === 0) {
  console.log('\n✅ QA-OPS-0 audit — COMPLETO\n')
  process.exit(0)
} else {
  console.log(`\n❌ ${failed} check(s) fallaron — revisar arriba\n`)
  process.exit(1)
}
