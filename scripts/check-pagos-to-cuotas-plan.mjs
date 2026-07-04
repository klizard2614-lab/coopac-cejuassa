/**
 * check-pagos-to-cuotas-plan.mjs
 * Fase 9C-6H.0 — Verificación de seguridad del plan de aplicación de pagos a cuotas.
 *
 * Verifica:
 * - Existe el script dry-run
 * - Existe el reporte
 * - Existe el preview JSON
 * - El script NO contiene UPDATE / INSERT / DELETE / TRUNCATE
 * - El script NO toca creditos en modo escritura
 * - El script NO toca pagos_recibos en modo escritura
 * - El script NO toca socios en modo escritura
 * - El script NO toca usuarios / configuracion / auth.users
 * - El script NO crea migraciones
 * - El script NO toca _client_files
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DOCS = resolve(ROOT, 'docs/ai-recovery')
const SCRIPTS = resolve(ROOT, 'scripts')

let passed = 0
let failed = 0
const results = []

function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ ${name}`)
    passed++
    results.push({ name, ok: true })
  } else {
    console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`)
    failed++
    results.push({ name, ok: false, detail })
  }
}

console.log('\n══════════════════════════════════════════════════════════════')
console.log('  CEJUASSA — Check: Plan pagos → cuotas (9C-6H.0)')
console.log('══════════════════════════════════════════════════════════════\n')

// ─── Paths ────────────────────────────────────────────────────────────────────

const SCRIPT_PATH  = resolve(SCRIPTS, 'dry-run-apply-pagos-to-cuotas.mjs')
const REPORT_PATH  = resolve(DOCS, 'PAGOS_TO_CUOTAS_DRY_RUN_REPORT.md')
const PREVIEW_PATH = resolve(DOCS, 'proposed_cuotas_payment_updates_preview.json')
const CHECK_PATH   = resolve(SCRIPTS, 'check-pagos-to-cuotas-plan.mjs')

// ─── Bloque 1: Existencia de archivos ─────────────────────────────────────────

console.log('📁 Bloque 1 — Existencia de archivos')

check('Script dry-run existe', existsSync(SCRIPT_PATH), 'scripts/dry-run-apply-pagos-to-cuotas.mjs')
check('Reporte existe', existsSync(REPORT_PATH), 'docs/ai-recovery/PAGOS_TO_CUOTAS_DRY_RUN_REPORT.md')
check('Preview JSON existe', existsSync(PREVIEW_PATH), 'docs/ai-recovery/proposed_cuotas_payment_updates_preview.json')
check('Script de check existe', existsSync(CHECK_PATH), 'scripts/check-pagos-to-cuotas-plan.mjs')

// ─── Bloque 2: Verificar el script dry-run ────────────────────────────────────

console.log('\n🔍 Bloque 2 — Análisis del script dry-run')

if (existsSync(SCRIPT_PATH)) {
  const scriptContent = readFileSync(SCRIPT_PATH, 'utf8')


  // NO debe contener operaciones de escritura SQL directas
  // Excluimos las líneas de comentario (que documentan lo que NO hace el script)
  // Remover comentarios (líneas con * en bloques JSDoc y comentarios //)
  const scriptNoComments = scriptContent.replace(/^\s*\*.*$/gm, '').replace(/\/\/.*/g, '')
  const hasSqlUpdate   = /\bUPDATE\s+\w/i.test(scriptNoComments)
  const hasSqlInsert   = /\bINSERT\s+INTO\s/i.test(scriptNoComments)
  const hasSqlDelete   = /\bDELETE\s+FROM\s/i.test(scriptNoComments)
  const hasSqlTruncate = /\bTRUNCATE\s+/i.test(scriptNoComments)

  check('Script NO contiene SQL UPDATE', !hasSqlUpdate)
  check('Script NO contiene SQL INSERT INTO', !hasSqlInsert)
  check('Script NO contiene SQL DELETE FROM', !hasSqlDelete)
  check('Script NO contiene SQL TRUNCATE', !hasSqlTruncate)

  // NO debe contener operaciones de escritura en Supabase JS SDK
  const writePatternsMatch = [
    /\.from\(['"]cronograma_cuotas['"]\)\s*\.\s*update\s*\(/i,
    /\.from\(['"]cronograma_cuotas['"]\)\s*\.\s*insert\s*\(/i,
    /\.from\(['"]cronograma_cuotas['"]\)\s*\.\s*upsert\s*\(/i,
    /\.from\(['"]cronograma_cuotas['"]\)\s*\.\s*delete\s*\(/i,
  ]
  const writesCuotas = writePatternsMatch.some(p => p.test(scriptContent))
  check('Script NO escribe en cronograma_cuotas', !writesCuotas)

  const writesCreditos = [
    /\.from\(['"]creditos['"]\)\s*\.\s*update\s*\(/i,
    /\.from\(['"]creditos['"]\)\s*\.\s*insert\s*\(/i,
    /\.from\(['"]creditos['"]\)\s*\.\s*upsert\s*\(/i,
    /\.from\(['"]creditos['"]\)\s*\.\s*delete\s*\(/i,
  ].some(p => p.test(scriptContent))
  check('Script NO escribe en creditos', !writesCreditos)

  const writesPagos = [
    /\.from\(['"]pagos_recibos['"]\)\s*\.\s*update\s*\(/i,
    /\.from\(['"]pagos_recibos['"]\)\s*\.\s*insert\s*\(/i,
    /\.from\(['"]pagos_recibos['"]\)\s*\.\s*upsert\s*\(/i,
    /\.from\(['"]pagos_recibos['"]\)\s*\.\s*delete\s*\(/i,
  ].some(p => p.test(scriptContent))
  check('Script NO escribe en pagos_recibos', !writesPagos)

  const writesSocios = [
    /\.from\(['"]socios['"]\)\s*\.\s*update\s*\(/i,
    /\.from\(['"]socios['"]\)\s*\.\s*insert\s*\(/i,
    /\.from\(['"]socios['"]\)\s*\.\s*upsert\s*\(/i,
    /\.from\(['"]socios['"]\)\s*\.\s*delete\s*\(/i,
  ].some(p => p.test(scriptContent))
  check('Script NO escribe en socios', !writesSocios)

  // NO toca usuarios / configuracion / auth.users
  const touchesUsuarios      = /\.from\(['"]usuarios['"]\)\s*\.\s*(update|insert|upsert|delete)/i.test(scriptContent)
  const touchesConfiguracion = /\.from\(['"]configuracion['"]\)\s*\.\s*(update|insert|upsert|delete)/i.test(scriptContent)
  // auth.users solo es relevante si hay llamadas a supabase.auth.admin (API Supabase)
  // Puede aparecer en strings de reporte (no peligroso) — se verifica por llamada real
  const touchesAuthUsers     = /supabase\.auth\.admin\./i.test(scriptNoComments)
  check('Script NO escribe en usuarios', !touchesUsuarios)
  check('Script NO escribe en configuracion', !touchesConfiguracion)
  check('Script NO toca auth.users', !touchesAuthUsers)

  // NO crea migraciones
  const createsMigration = /supabase\/migrations/i.test(scriptContent) ||
    /db\.push/i.test(scriptContent) ||
    /migration\.apply/i.test(scriptContent)
  check('Script NO crea migraciones', !createsMigration)

  // NO modifica _client_files: verificar que _client_files no aparece como argumento de write/mkdir
  // Excluir menciones en comentarios de documentación
  const touchesClientFiles = /_client_files/i.test(scriptNoComments)
  check('Script NO modifica _client_files', !touchesClientFiles)

  // Tiene header de reglas SOLO LECTURA
  const hasReadonlyHeader = scriptContent.includes('SOLO LECTURA') || scriptContent.includes('DRY-RUN')
  check('Script tiene declaración de SOLO LECTURA', hasReadonlyHeader)

  // Solo lee de las tablas esperadas
  const readsFromPagos     = scriptContent.includes("from('pagos_recibos')")
  const readsFromCuotas    = scriptContent.includes("from('cronograma_cuotas')")
  const readsFromCreditos  = scriptContent.includes("from('creditos')")
  check('Script lee pagos_recibos (SELECT)', readsFromPagos)
  check('Script lee cronograma_cuotas (SELECT)', readsFromCuotas)
  check('Script lee creditos (SELECT)', readsFromCreditos)

} else {
  // Si el script no existe, todos los checks del bloque 2 fallan
  for (let i = 0; i < 17; i++) {
    check(`[script no existe — check ${i + 1}]`, false, 'script no encontrado')
  }
}

// ─── Bloque 3: Verificar preview JSON ─────────────────────────────────────────

console.log('\n📊 Bloque 3 — Análisis del preview JSON')

if (existsSync(PREVIEW_PATH)) {
  try {
    const preview = JSON.parse(readFileSync(PREVIEW_PATH, 'utf8'))

    check('Preview tiene campo "fase"', preview.fase === '9C-6H.0')
    check('Preview tiene campo "modo" = DRY-RUN', preview.modo === 'DRY-RUN')
    check('Preview tiene campo "regla_monto"', typeof preview.regla_monto === 'string' && preview.regla_monto.length > 0)
    check('Preview tiene campo "totales"', typeof preview.totales === 'object')
    check('Preview tiene campo "propuestas" (array)', Array.isArray(preview.propuestas))
    check('Preview tiene campo "pagos_no_asignables" (array)', Array.isArray(preview.pagos_no_asignables))
    check('Preview tiene campo "resumen_por_credito" (array)', Array.isArray(preview.resumen_por_credito))

    if (Array.isArray(preview.propuestas) && preview.propuestas.length > 0) {
      const p0 = preview.propuestas[0]
      const hasRequiredFields = (
        'pago_id' in p0 &&
        'credito_id' in p0 &&
        'cuota_id' in p0 &&
        'estado_actual' in p0 &&
        'estado_propuesto' in p0 &&
        'monto_aplicado' in p0 &&
        'monto_cuota' in p0 &&
        'diferencia' in p0 &&
        'confianza' in p0
      )
      check('Propuestas tienen todos los campos requeridos', hasRequiredFields,
        'Campos: pago_id, credito_id, cuota_id, estado_actual, estado_propuesto, monto_aplicado, monto_cuota, diferencia, confianza')
    } else {
      check('Al menos una propuesta generada', false, 'preview.propuestas vacío')
    }

  } catch (e) {
    check('Preview JSON es válido', false, e.message)
  }
} else {
  for (let i = 0; i < 8; i++) {
    check(`[preview no existe — check ${i + 1}]`, false, 'preview no encontrado')
  }
}

// ─── Bloque 4: Verificar reporte Markdown ─────────────────────────────────────

console.log('\n📄 Bloque 4 — Análisis del reporte Markdown')

if (existsSync(REPORT_PATH)) {
  const report = readFileSync(REPORT_PATH, 'utf8')

  check('Reporte tiene título', report.includes('PAGOS_TO_CUOTAS_DRY_RUN_REPORT'))
  check('Reporte tiene sección Metodología', report.includes('## Metodología'))
  check('Reporte tiene sección Regla de monto', report.includes('## Regla de monto'))
  check('Reporte tiene sección Resultado del dry-run', report.includes('## Resultado del dry-run'))
  check('Reporte tiene sección Créditos afectados', report.includes('## Créditos afectados'))
  check('Reporte tiene sección Riesgos', report.includes('## Riesgos'))
  check('Reporte tiene sección Recomendación', report.includes('## Recomendación'))
  check('Reporte indica que NO modificó datos', report.includes('NINGÚN DATO FUE MODIFICADO') || report.includes('NO MODIFICADA'))
} else {
  for (let i = 0; i < 8; i++) {
    check(`[reporte no existe — check ${i + 1}]`, false, 'reporte no encontrado')
  }
}

// ─── Resumen ───────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════════════════')
console.log(`  RESULTADO: ${passed}/${passed + failed} PASS`)
if (failed === 0) {
  console.log('  ✅ Todos los checks pasaron — plan es seguro (DRY-RUN)')
} else {
  console.log(`  ❌ ${failed} check(s) fallaron — revisar antes de continuar`)
}
console.log('══════════════════════════════════════════════════════════════\n')

process.exit(failed > 0 ? 1 : 0)
