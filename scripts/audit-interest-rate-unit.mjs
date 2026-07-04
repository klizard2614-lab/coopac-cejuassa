/**
 * audit-interest-rate-unit.mjs
 * Fase 9C-6C.1 — Audita la unidad de tasa_interes en la DB vs. lo que espera la app.
 *
 * REGLAS: SOLO LECTURA — sin insert, update, delete, migraciones.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

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

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

function round2(n) { return Math.round(n * 100) / 100 }

function calcCuota(principal, tasaAnual, plazo) {
  if (!principal || !plazo) return 0
  const r = tasaAnual / 100 / 12
  if (r === 0) return principal / plazo
  const factor = Math.pow(1 + r, plazo)
  return (principal * r * factor) / (factor - 1)
}

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Auditoría unidad tasa_interes — Fase 9C-6C.1')
  console.log('  SOLO LECTURA')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  const { data: creditos, error } = await sb
    .from('creditos')
    .select('id, tasa_interes, monto_aprobado, plazo_meses, cuota_mensual, estado')
    .order('id')

  if (error) { console.error('❌ Error leyendo créditos:', error.message); process.exit(1) }

  const total = creditos.length
  const conTasa = creditos.filter(c => c.tasa_interes !== null && c.tasa_interes !== undefined)
  const decimal = conTasa.filter(c => c.tasa_interes > 0 && c.tasa_interes < 1)
  const porcentaje = conTasa.filter(c => c.tasa_interes >= 1)
  const cero = creditos.filter(c => !c.tasa_interes)

  console.log(`📊 Créditos totales:          ${total}`)
  console.log(`   Con tasa_interes:          ${conTasa.length}`)
  console.log(`   Decimal (0 < t < 1) ❌:    ${decimal.length}  ← INCORRECTO`)
  console.log(`   Porcentaje (t >= 1) ✅:    ${porcentaje.length}`)
  console.log(`   Sin tasa (0 o NULL):       ${cero.length}`)

  if (decimal.length > 0) {
    const sample = decimal[0]
    console.log('\n⚠️  PROBLEMA DETECTADO: tasa_interes está en formato decimal, no porcentaje.')
    console.log(`   Ejemplo: tasa_interes = ${sample.tasa_interes}`)
    console.log(`            La app espera: ${(sample.tasa_interes * 100).toFixed(4)}`)
  }

  // Comparar cuota simulada para el primer crédito elegible con ambas unidades
  const ejemplo = creditos.find(c => c.tasa_interes > 0 && c.monto_aprobado > 0 && c.plazo_meses > 0)
  if (ejemplo) {
    const monto = ejemplo.monto_aprobado
    const plazo = ejemplo.plazo_meses
    const tasaDB = ejemplo.tasa_interes

    const cuotaConDecimal = round2(calcCuota(monto, tasaDB, plazo))
    const cuotaConPorcentaje = round2(calcCuota(monto, tasaDB * 100, plazo))
    const cuotaDB = ejemplo.cuota_mensual

    console.log('\n📐 Simulación para crédito de ejemplo (sin datos personales):')
    console.log(`   Monto:  S/ ${monto.toFixed(2)}  |  Plazo: ${plazo}m  |  tasa_interes DB: ${tasaDB}`)
    console.log('')
    console.log(`   A) tasa como decimal  (${tasaDB}):      cuota = S/ ${cuotaConDecimal.toFixed(2)}`)
    console.log(`   B) tasa como porcent. (${tasaDB * 100}): cuota = S/ ${cuotaConPorcentaje.toFixed(2)}`)
    console.log(`   C) cuota_mensual en DB:                  S/ ${cuotaDB?.toFixed(2) ?? 'NULL'}`)
    console.log('')

    const difA = cuotaDB ? Math.abs(cuotaConDecimal - cuotaDB) : null
    const difB = cuotaDB ? Math.abs(cuotaConPorcentaje - cuotaDB) : null

    if (difB !== null && difA !== null) {
      const matchB = difB < 1
      const matchA = difA < 1
      if (matchB) {
        console.log(`   ✅ Escenario B (porcentaje) coincide con cuota_mensual en DB (Δ S/ ${difB.toFixed(2)})`)
      } else if (matchA) {
        console.log(`   ⚠️  Escenario A (decimal) coincide con cuota_mensual en DB (Δ S/ ${difA.toFixed(2)}) — inconsistente`)
      } else {
        console.log(`   ⚠️  Ningún escenario coincide exactamente con cuota_mensual DB`)
        console.log(`       Δ escenario A: S/ ${difA.toFixed(2)}`)
        console.log(`       Δ escenario B: S/ ${difB.toFixed(2)}`)
      }
    }

    const interesA = round2(cuotaConDecimal * plazo - monto)
    const interesB = round2(cuotaConPorcentaje * plazo - monto)
    console.log(`\n   Interés total A (decimal):     S/ ${interesA.toFixed(2)}`)
    console.log(`   Interés total B (porcentaje):  S/ ${interesB.toFixed(2)}`)
    console.log(`   Diferencia:                    S/ ${Math.abs(interesB - interesA).toFixed(2)}`)
  }

  // Verificación contra cuota_mensual en DB para todos los créditos con tasa decimal
  if (decimal.length > 0) {
    const elegibles = decimal.filter(c => c.monto_aprobado > 0 && c.plazo_meses > 0 && c.cuota_mensual > 0)
    let matchPorcentaje = 0
    let matchDecimal = 0

    for (const c of elegibles) {
      const cuotaDecimal = round2(calcCuota(c.monto_aprobado, c.tasa_interes, c.plazo_meses))
      const cuotaPorcentaje = round2(calcCuota(c.monto_aprobado, c.tasa_interes * 100, c.plazo_meses))
      if (Math.abs(cuotaPorcentaje - c.cuota_mensual) < 1) matchPorcentaje++
      if (Math.abs(cuotaDecimal - c.cuota_mensual) < 1) matchDecimal++
    }

    console.log(`\n📊 Verificación masiva (${elegibles.length} créditos con tasa decimal y cuota_mensual en DB):`)
    console.log(`   Coinciden con fórmula porcentaje (tasa*100): ${matchPorcentaje} / ${elegibles.length}`)
    console.log(`   Coinciden con fórmula decimal (tasa tal cual): ${matchDecimal} / ${elegibles.length}`)
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  RESULTADO AUDITORÍA')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  if (decimal.length > 0) {
    console.log(`\n  ❌ PROBLEMA CONFIRMADO`)
    console.log(`     ${decimal.length} créditos tienen tasa_interes en formato DECIMAL (< 1).`)
    console.log(`     La app espera PORCENTAJE (>= 1).`)
    console.log(`\n  ACCIÓN REQUERIDA antes de Fase 9C-6D:`)
    console.log(`     Fase 9C-6C.2 — Convertir tasa_interes * 100 con guard WHERE tasa_interes < 1`)
  } else if (porcentaje.length > 0) {
    console.log(`\n  ✅ tasa_interes en formato PORCENTAJE correcto.`)
    console.log(`     Puede proceder con la regeneración de cronogramas (Fase 9C-6D).`)
  } else {
    console.log(`\n  ⚠️  Sin créditos con tasa_interes válida para evaluar.`)
  }

  console.log('\n  Reporte completo: docs/ai-recovery/INTEREST_RATE_UNIT_AUDIT.md\n')
  process.exit(decimal.length > 0 ? 1 : 0)
}

main().catch(e => { console.error('❌ Error fatal:', e.message); process.exit(1) })
