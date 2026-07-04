/**
 * check-pagos-cuotas-10k2a-dryrun.mjs
 * Fase 10K-2A — Verificación del dry-run final de pagos contra cuotas.
 *
 * Verifica:
 * 1. Existe el reporte y el Excel de propuesta
 * 2. El Excel contiene las 7 hojas esperadas
 * 3. No se modificaron datos reales (script fuente solo usa .select())
 * 4. No hay SQL UPDATE/DELETE/INSERT aplicado en el script de esta fase
 * 5. No se tocó Anexo 6
 * 6. No se tocó seguridad (RLS/auditoría/usuarios)
 * 7. El reporte lista los casos ambiguos
 * 8. El reporte tiene una recomendación final
 * 9. No existe todavía script de apply real (10K-2B sigue bloqueada)
 * 10. El preview JSON existe y tiene la estructura esperada
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import XLSX from 'xlsx'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DOCS = resolve(ROOT, 'docs/ai-recovery')
const SCRIPTS = resolve(ROOT, 'scripts')
const EXPORTS = resolve(ROOT, 'exports/pagos-cuotas-dryrun')

let passed = 0
let failed = 0
let warnings = 0

function check(name, condition, detail = '') {
  if (condition) { console.log(`  ✅ ${name}`); passed++ }
  else { console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); failed++ }
}

function warn(name, condition, detail = '') {
  if (condition) { console.log(`  ✅ ${name}`); passed++ }
  else { console.log(`  ⚠️  ${name}${detail ? ' — ' + detail : ''}`); warnings++ }
}

// ─── Sección 1: Reporte y Excel existen ──────────────────────────────────────
console.log('\n📄 Sección 1: Artefactos generados')

const REPORT = resolve(DOCS, 'PAGOS_CUOTAS_10K_2A_DRY_RUN_REPORT.md')
check('Existe PAGOS_CUOTAS_10K_2A_DRY_RUN_REPORT.md', existsSync(REPORT))

const EXCEL = resolve(EXPORTS, '10k_2a_propuesta_aplicacion_pagos_cuotas.xlsx')
check('Existe Excel 10k_2a_propuesta_aplicacion_pagos_cuotas.xlsx', existsSync(EXCEL))

const PREVIEW_JSON = resolve(DOCS, 'pagos_cuotas_10k2a_dryrun_preview.json')
check('Existe pagos_cuotas_10k2a_dryrun_preview.json', existsSync(PREVIEW_JSON))

const DRY_RUN_SCRIPT = resolve(SCRIPTS, 'dry-run-pagos-cuotas-10k2a.mjs')
check('Existe scripts/dry-run-pagos-cuotas-10k2a.mjs', existsSync(DRY_RUN_SCRIPT))

// ─── Sección 2: Hojas del Excel ───────────────────────────────────────────────
console.log('\n📊 Sección 2: Hojas del Excel')

const HOJAS_ESPERADAS = [
  'resumen',
  'pagos_aplicables',
  'aplicaciones_propuestas',
  'casos_ambiguos',
  'pagos_sin_credito',
  'cuotas_afectadas',
  'advertencias',
]

if (existsSync(EXCEL)) {
  const wb = XLSX.readFile(EXCEL)
  for (const hoja of HOJAS_ESPERADAS) {
    check(`Hoja "${hoja}" presente`, wb.SheetNames.includes(hoja))
  }
  check('Excel no tiene hojas extra inesperadas (solo las 7 esperadas)',
    wb.SheetNames.length === HOJAS_ESPERADAS.length &&
    wb.SheetNames.every(s => HOJAS_ESPERADAS.includes(s)))
} else {
  for (const hoja of HOJAS_ESPERADAS) check(`Hoja "${hoja}" presente`, false, 'Excel no existe')
}

// ─── Sección 3: El script fuente es solo lectura ─────────────────────────────
console.log('\n🔒 Sección 3: El dry-run es solo lectura')

if (existsSync(DRY_RUN_SCRIPT)) {
  const src = readFileSync(DRY_RUN_SCRIPT, 'utf8')

  const tablasNegocio = ['cronograma_cuotas', 'pagos_recibos', 'creditos', 'socios', 'aportes', 'egresos', 'pagos_cuotas_aplicaciones']
  let sinEscrituras = true
  for (const tabla of tablasNegocio) {
    const re = new RegExp(`\\.from\\(['"\`]${tabla}['"\`]\\)\\s*\\.(insert|update|delete|upsert)`, 'i')
    if (re.test(src)) sinEscrituras = false
  }
  check('El script no llama insert/update/delete/upsert sobre ninguna tabla de negocio', sinEscrituras)

  check('El script usa .select() para leer pagos_recibos', /\.from\(['"`]pagos_recibos['"`]\)[\s\S]{0,80}\.select\(/.test(src))
  check('El script usa .select() para leer cronograma_cuotas', /\.from\(['"`]cronograma_cuotas['"`]\)[\s\S]{0,80}\.select\(/.test(src))
  check('El script confirma pagos_cuotas_aplicaciones vacía (count, no insert)',
    src.includes("from('pagos_cuotas_aplicaciones')") && src.includes('count'))

  check('No hay statements SQL destructivos crudos (DROP/TRUNCATE)', !/\b(drop\s+table|truncate\s+table)\b/i.test(src))
  check('El script no crea ni modifica migraciones', !src.includes('supabase/migrations'))
} else {
  check('El script no llama insert/update/delete/upsert sobre ninguna tabla de negocio', false, 'script no existe')
}

// ─── Sección 4: No se tocó Anexo 6 ni seguridad ──────────────────────────────
console.log('\n🛡️  Sección 4: Fuera de alcance respetado (Anexo 6, seguridad)')

if (existsSync(DRY_RUN_SCRIPT)) {
  const src = readFileSync(DRY_RUN_SCRIPT, 'utf8')
  check('El script no referencia Anexo 6 / anexo6', !/anexo6|anexo_6/i.test(src))
  check('El script no toca tabla auditoria', !src.includes("from('auditoria')"))
  check('El script no toca tabla usuarios', !src.includes("from('usuarios')"))
  check('El script no modifica RLS / policies', !/create policy|alter policy|drop policy|enable row level security/i.test(src))
}

// ─── Sección 5: No existe apply real todavía (10K-2B bloqueada) ──────────────
console.log('\n⏳ Sección 5: 10K-2B sigue bloqueada')

const APPLY_SCRIPT = resolve(SCRIPTS, 'apply-pagos-cuotas.mjs')
check('NO existe scripts/apply-pagos-cuotas.mjs todavía (10K-2B no iniciada)', !existsSync(APPLY_SCRIPT))

// ─── Sección 6: Contenido del reporte ────────────────────────────────────────
console.log('\n📋 Sección 6: Contenido del reporte')

if (existsSync(REPORT)) {
  const report = readFileSync(REPORT, 'utf8')

  check('Reporte tiene resumen ejecutivo', /resumen ejecutivo/i.test(report))
  check('Reporte menciona reglas usadas', /reglas usadas/i.test(report))
  check('Reporte indica cuántos pagos se aplicarían', /pagos aplicables|propuestas de aplicación generadas/i.test(report))
  check('Reporte indica cuántas cuotas se afectarían', /cuotas.*afectad/i.test(report))
  check('Reporte lista casos ambiguos / revisión manual', /casos ambiguos|revisión manual/i.test(report))
  check('Reporte menciona pago 411 (R-K2)', report.includes('411') && report.includes('R-K2'))
  check('Reporte menciona match_medio pendiente', /match_medio/i.test(report))
  check('Reporte tiene sección de riesgos', /##\s*riesgos/i.test(report))
  check('Reporte tiene sección "Qué NO se aplicó"', /qué no se aplicó/i.test(report))
  check('Reporte confirma que NO se modificó nada', /ningún dato fue modificado|ningún dato fue modificad/i.test(report))
  check('Reporte tiene recomendación final antes de 10K-2B', /recomendación antes de 10k-2b/i.test(report))
  check('Reporte NO indica que se aplicó ningún pago', !/pagos aplicados exitosamente|apply completado|apply ejecutado/i.test(report))
} else {
  warn('Contenido del reporte verificable', false, 'reporte no existe')
}

// ─── Sección 7: Estructura del preview JSON ──────────────────────────────────
console.log('\n🗂️  Sección 7: Preview JSON')

if (existsSync(PREVIEW_JSON)) {
  const data = JSON.parse(readFileSync(PREVIEW_JSON, 'utf8'))
  check('JSON tiene fase = "10K-2A"', data.fase === '10K-2A')
  check('JSON tiene modo = "DRY-RUN"', data.modo === 'DRY-RUN')
  check('JSON tiene totales.total_pagos_recibos', typeof data.totales?.total_pagos_recibos === 'number')
  check('JSON tiene totales.pagos_ambiguos', typeof data.totales?.pagos_ambiguos === 'number')
  check('JSON tiene totales.filas_pagos_cuotas_aplicaciones', typeof data.totales?.filas_pagos_cuotas_aplicaciones === 'number')
  warn('filas_pagos_cuotas_aplicaciones registrado como 0 en el último run',
    data.totales?.filas_pagos_cuotas_aplicaciones === 0,
    `valor actual: ${data.totales?.filas_pagos_cuotas_aplicaciones}`)
} else {
  check('JSON tiene fase = "10K-2A"', false, 'preview no existe')
}

// ─── Sección 8: package.json ──────────────────────────────────────────────────
console.log('\n📦 Sección 8: Comandos npm')

const PKG = resolve(ROOT, 'package.json')
if (existsSync(PKG)) {
  const pkg = JSON.parse(readFileSync(PKG, 'utf8'))
  check('Script npm "pagos-cuotas-10k2a:dry-run" registrado', !!pkg.scripts?.['pagos-cuotas-10k2a:dry-run'])
  check('Script npm "check:pagos-cuotas-10k2a" registrado', !!pkg.scripts?.['check:pagos-cuotas-10k2a'])
}

// ─── Resumen ──────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60))
console.log(`\n📊 Resultado: ${passed} PASS · ${failed} FAIL · ${warnings} WARN\n`)

if (failed > 0) {
  console.log('❌ Verificación FALLIDA — revisar los items marcados antes de continuar.')
  process.exit(1)
} else {
  console.log('✅ Todos los checks pasan. El dry-run 10K-2A está listo para revisión de Tesorería/Créditos.')
  console.log('\n⏳ Próximo paso: revisión manual de los casos ambiguos antes de considerar 10K-2B.\n')
  process.exit(0)
}
