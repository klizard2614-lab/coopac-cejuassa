/**
 * post-import-finalize.mjs
 * Ejecuta los pasos automáticos post-recarga por separado (útil si la
 * recarga ya se hizo y solo quieres correr estos pasos, o para volver a
 * intentar el vínculo de pagos tras revisar el Excel de match_medio/ambiguo).
 *
 * Uso: node scripts/post-import-finalize.mjs
 *
 * Ver scripts/lib/post-import-steps.mjs para el detalle de qué hace cada paso
 * y qué NO se toca automáticamente (match_medio/ambiguo, aplicación de pagos
 * a cronograma_cuotas — eso sigue siendo manual, con dry-run + confirmación).
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { regenerarCronogramas, vincularPagosMatchAlto } from './lib/post-import-steps.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DOCS_DIR = resolve(ROOT, 'docs/ai-recovery')
const EXPORT_DIR = resolve(ROOT, 'exports/pagos-cuotas-dryrun')

function loadEnv() {
  const p = resolve(ROOT, '.env.local')
  if (!existsSync(p)) return false
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const [key, ...rest] = line.split('=')
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
  }
  return true
}
if (!loadEnv()) { console.error('❌ .env.local no encontrado'); process.exit(1) }

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

console.log('\n══════════════════════════════════════════════════════════════')
console.log('  CEJUASSA — Post-import: cronogramas + vínculo de pagos claros')
console.log('══════════════════════════════════════════════════════════════')

const resultadoCronogramas = await regenerarCronogramas(sb)
const resultadoVinculo = await vincularPagosMatchAlto(sb, { exportDir: EXPORT_DIR })

if (!existsSync(DOCS_DIR)) mkdirSync(DOCS_DIR, { recursive: true })
writeFileSync(
  resolve(DOCS_DIR, 'post_import_finalize_report.json'),
  JSON.stringify({ generado: new Date().toISOString(), cronogramas: resultadoCronogramas, vinculo_pagos: resultadoVinculo }, null, 2),
  'utf8',
)

console.log('\n══════════════════════════════════════════════════════════════')
console.log('  Resumen')
console.log('══════════════════════════════════════════════════════════════')
console.log(`  Cronogramas insertados para ${resultadoCronogramas.creditosElegibles} créditos (${resultadoCronogramas.cuotasInsertadas} cuotas)`)
console.log(`  Pagos vinculados automáticamente (match_alto): ${resultadoVinculo.vinculados}`)
console.log(`  Pagos que requieren revisión manual (match_medio + ambiguo): ${resultadoVinculo.matchMedio + resultadoVinculo.ambiguo}`)
console.log('\n  Pendiente (manual, con dry-run propio):')
console.log('  - Revisar el Excel de match_medio/ambiguo y decidir caso por caso.')
console.log('  - Aplicar montos de pagos a cronograma_cuotas (Fase estilo 10K-2B) — NO se hace aquí.')
console.log('\n✅ Post-import completado.\n')
