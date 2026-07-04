/**
 * convert-tasa-interes-to-percent.mjs
 * Fase 9C-6C.2 — Convierte tasa_interes de decimal SBS a porcentaje interno.
 *
 * Uso:
 *   node scripts/convert-tasa-interes-to-percent.mjs --dry-run   (default)
 *   node scripts/convert-tasa-interes-to-percent.mjs --apply
 *
 * REGLAS ESTRICTAS:
 * - Solo modifica creditos.tasa_interes
 * - Guard: WHERE tasa_interes > 0 AND tasa_interes < 1
 * - NO toca cronograma_cuotas
 * - NO toca usuarios / configuracion / auth.users
 * - NO crea migraciones
 * - NO toca _client_files
 * - NO toca tipo_credito_sbs / subtipo_credito_sbs / cuenta_contable_bd01
 * - NO imprime datos personales completos
 * - Apply REQUIERE autorización: CONVERTIR TASA A PORCENTAJE 9C-6C.2
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DOCS_DIR = resolve(ROOT, 'docs/ai-recovery')

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

const IS_APPLY = process.argv.includes('--apply')
const IS_DRY = !IS_APPLY

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

function round4(n) { return Math.round(n * 10000) / 10000 }
function round2(n) { return Math.round(n * 100) / 100 }

function calcCuota(principal, tasaAnual, plazo) {
  if (!principal || !plazo) return 0
  const r = tasaAnual / 100 / 12
  if (r === 0) return principal / plazo
  const factor = Math.pow(1 + r, plazo)
  return (principal * r * factor) / (factor - 1)
}

async function main() {
  const modo = IS_DRY ? 'DRY-RUN (solo lectura)' : 'APPLY (modificará datos)'
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  Fase 9C-6C.2 — Conversión tasa_interes → porcentaje`)
  console.log(`  Modo: ${modo}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // 1. Leer créditos con tasa en formato decimal
  const { data: creditos, error } = await sb
    .from('creditos')
    .select('id, tasa_interes, monto_aprobado, plazo_meses, cuota_mensual, estado')
    .gt('tasa_interes', 0)
    .lt('tasa_interes', 1)
    .order('id')

  if (error) { console.error('❌ Error leyendo créditos:', error.message); process.exit(1) }

  const total = creditos.length

  // 2. Verificar que no hay mezcla de formatos (guard de seguridad)
  const { data: credMezclados, error: errMix } = await sb
    .from('creditos')
    .select('id, tasa_interes')
    .gte('tasa_interes', 1)

  if (errMix) { console.error('❌ Error en guard de mezcla:', errMix.message); process.exit(1) }

  if (credMezclados && credMezclados.length > 0) {
    console.log('⚠️  MEZCLA DETECTADA — Hay créditos con tasa >= 1 (ya en porcentaje):')
    console.log(`   ${credMezclados.length} créditos con tasa >= 1`)
    console.log('   Revise manualmente antes de continuar.')
    if (IS_APPLY) {
      console.error('❌ ABORTADO — Se detectó mezcla de unidades. No se puede aplicar de forma segura.')
      process.exit(1)
    }
    console.log('   (En dry-run: solo advertencia, no se modifica nada)\n')
  } else {
    console.log(`✅ Sin mezcla de formatos — todos los créditos con tasa tienen el mismo formato\n`)
  }

  console.log(`📊 Créditos detectados para conversión (tasa_interes > 0 AND < 1): ${total}`)

  if (total === 0) {
    console.log('\n✅ No hay créditos con tasa en formato decimal. Nada que convertir.')
    process.exit(0)
  }

  // 3. Mostrar resumen de valores sin datos personales
  const tasasUnicas = [...new Set(creditos.map(c => c.tasa_interes))].sort()
  console.log(`\n📋 Tasas únicas encontradas:`)
  for (const t of tasasUnicas) {
    const count = creditos.filter(c => c.tasa_interes === t).length
    console.log(`   ${t} → ${round4(t * 100)}%  (${count} créditos)`)
  }

  // 4. Simular cuotas antes y después para el primer elegible con cuota_mensual en DB
  const ejemplo = creditos.find(c => c.monto_aprobado > 0 && c.plazo_meses > 0 && c.cuota_mensual > 0)
  let simRows = []
  if (ejemplo) {
    const tasaAntes = ejemplo.tasa_interes
    const tasaDespues = round4(tasaAntes * 100)
    const cuotaAntes = round2(calcCuota(ejemplo.monto_aprobado, tasaAntes, ejemplo.plazo_meses))
    const cuotaDespues = round2(calcCuota(ejemplo.monto_aprobado, tasaDespues, ejemplo.plazo_meses))
    const cuotaDB = ejemplo.cuota_mensual

    console.log(`\n📐 Simulación cuota (ejemplo sin datos personales):`)
    console.log(`   Monto: S/ ${ejemplo.monto_aprobado}  Plazo: ${ejemplo.plazo_meses}m`)
    console.log(`   Antes  (tasa=${tasaAntes}):   cuota = S/ ${cuotaAntes.toFixed(2)}`)
    console.log(`   Después (tasa=${tasaDespues}): cuota = S/ ${cuotaDespues.toFixed(2)}`)
    console.log(`   cuota_mensual en DB:          S/ ${cuotaDB.toFixed(2)}`)
    console.log(`   Δ antes  vs DB: S/ ${Math.abs(cuotaAntes - cuotaDB).toFixed(2)}`)
    console.log(`   Δ después vs DB: S/ ${Math.abs(cuotaDespues - cuotaDB).toFixed(2)}`)

    simRows = [
      { label: 'Antes (decimal)', tasa: tasaAntes, cuota: cuotaAntes },
      { label: 'Después (porcentaje)', tasa: tasaDespues, cuota: cuotaDespues },
      { label: 'cuota_mensual en DB', tasa: '-', cuota: cuotaDB },
    ]
  }

  // 5. Generar reporte markdown (siempre, aunque sea dry-run)
  const hoy = new Date().toISOString().split('T')[0]
  const lines = []
  lines.push('# TASA_INTERES_CONVERSION_DRY_RUN.md')
  lines.push(`# Dry-Run: Conversión tasa_interes decimal → porcentaje`)
  lines.push(`# Generado: ${hoy} — Fase 9C-6C.2`)
  lines.push('')
  lines.push('> Solo lectura — no se modificó ningún dato en este reporte.')
  lines.push('')
  lines.push('## Contexto')
  lines.push('')
  lines.push('La app usa `r = tasa_interes / 100 / 12` en formularios y scripts de cronograma.')
  lines.push('Esto asume que `tasa_interes` está en porcentaje (e.g., `26.82`).')
  lines.push('La importación Fase 9C-6B guardó el valor SBS decimal (e.g., `0.2682`).')
  lines.push('Este script corrige la unidad multiplicando por 100.')
  lines.push('')
  lines.push('## Resumen')
  lines.push('')
  lines.push(`| Campo | Valor |`)
  lines.push(`|---|---|`)
  lines.push(`| Créditos detectados (tasa < 1) | **${total}** |`)
  lines.push(`| Mezcla de formatos | ${credMezclados?.length > 0 ? '⚠️ SÍ — revisar' : '✅ No'} |`)
  lines.push(`| Operación propuesta | \`tasa_interes = tasa_interes * 100\` |`)
  lines.push(`| Guard | \`WHERE tasa_interes > 0 AND tasa_interes < 1\` |`)
  lines.push(`| Cronograma_cuotas tocado | ❌ NO |`)
  lines.push(`| Otros campos tocados | ❌ NO |`)
  lines.push('')
  lines.push('## Tasas únicas (antes → después)')
  lines.push('')
  lines.push('| tasa_interes actual | tasa_interes propuesta | Créditos |')
  lines.push('|---|---|---|')
  for (const t of tasasUnicas) {
    const count = creditos.filter(c => c.tasa_interes === t).length
    lines.push(`| ${t} | ${round4(t * 100)} | ${count} |`)
  }

  if (simRows.length > 0 && ejemplo) {
    lines.push('')
    lines.push('## Simulación cuota mensual (ejemplo sin datos personales)')
    lines.push('')
    lines.push(`| Escenario | tasa_interes | Cuota simulada |`)
    lines.push(`|---|---|---|`)
    for (const r of simRows) {
      lines.push(`| ${r.label} | ${r.tasa} | S/ ${typeof r.cuota === 'number' ? r.cuota.toFixed(2) : r.cuota} |`)
    }
    lines.push('')
    lines.push('> La cuota "Después (porcentaje)" debe aproximarse a `cuota_mensual` en DB.')
  }

  lines.push('')
  lines.push('## SQL equivalente (para referencia)')
  lines.push('')
  lines.push('```sql')
  lines.push('-- Dry-run: verificar candidatos')
  lines.push('SELECT id, tasa_interes, tasa_interes * 100 AS tasa_propuesta')
  lines.push('FROM creditos')
  lines.push('WHERE tasa_interes > 0 AND tasa_interes < 1;')
  lines.push('')
  lines.push('-- Apply: actualizar (solo con autorización CONVERTIR TASA A PORCENTAJE 9C-6C.2)')
  lines.push('UPDATE creditos')
  lines.push('SET tasa_interes = tasa_interes * 100')
  lines.push('WHERE tasa_interes > 0 AND tasa_interes < 1;')
  lines.push('```')

  lines.push('')
  lines.push('## Estado')
  lines.push('')
  lines.push('- [ ] Dry-run ejecutado ✅')
  lines.push('- [ ] Apply pendiente de autorización: `CONVERTIR TASA A PORCENTAJE 9C-6C.2`')

  if (!existsSync(DOCS_DIR)) mkdirSync(DOCS_DIR, { recursive: true })
  const reportPath = resolve(DOCS_DIR, 'TASA_INTERES_CONVERSION_DRY_RUN.md')
  writeFileSync(reportPath, lines.join('\n'), 'utf8')
  console.log(`\n📄 Reporte generado: docs/ai-recovery/TASA_INTERES_CONVERSION_DRY_RUN.md`)

  // 6. APPLY
  if (IS_DRY) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('  DRY-RUN completado. NO se modificó ningún dato.')
    console.log(`  ${total} créditos serían actualizados con --apply`)
    console.log('  Para aplicar: npm run convert:tasa:apply')
    console.log('  (Requiere autorización: CONVERTIR TASA A PORCENTAJE 9C-6C.2)')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    process.exit(0)
  }

  // APPLY — actualizar créditos uno a uno con verificación
  console.log('\n⚡ APPLY — Actualizando tasa_interes...\n')

  let actualizados = 0
  let errores = 0

  for (const c of creditos) {
    const tasaNueva = round4(c.tasa_interes * 100)
    const { error: errUpdate } = await sb
      .from('creditos')
      .update({ tasa_interes: tasaNueva })
      .eq('id', c.id)
      .gt('tasa_interes', 0)
      .lt('tasa_interes', 1)

    if (errUpdate) {
      console.error(`❌ Error actualizando crédito ${String(c.id).substring(0, 8)}****: ${errUpdate.message}`)
      errores++
    } else {
      actualizados++
    }
  }

  console.log(`\n✅ Actualizados: ${actualizados} / ${total}`)
  if (errores > 0) console.log(`❌ Errores: ${errores}`)

  // Verificar resultado
  const { data: verificacion, error: errVer } = await sb
    .from('creditos')
    .select('tasa_interes')
    .gt('tasa_interes', 0)
    .lt('tasa_interes', 1)

  if (!errVer) {
    console.log(`\n📋 Verificación post-apply: créditos con tasa aún < 1: ${verificacion.length}`)
    if (verificacion.length === 0) {
      console.log('✅ Todos los créditos tienen tasa_interes en formato porcentaje.')
    } else {
      console.log(`⚠️  ${verificacion.length} créditos aún en formato decimal — revisar manualmente.`)
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  APPLY completado.')
  console.log('  Siguiente: npm run audit:interest-rate-unit')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  process.exit(errores > 0 ? 1 : 0)
}

main().catch(e => { console.error('❌ Error fatal:', e.message); process.exit(1) })
