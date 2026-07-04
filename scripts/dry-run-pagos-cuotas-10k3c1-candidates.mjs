/**
 * dry-run-pagos-cuotas-10k3c1-candidates.mjs
 * Fase 10K-3C.1 — Búsqueda de candidatos reales para el plan de prueba
 * controlada de registrar_pago_con_aplicacion.
 *
 * REGLAS ESTRICTAS — SOLO LECTURA:
 * - NO insert / NO update / NO delete / NO truncate / NO RPC
 * - Solo SELECT, para identificar registros reales (enmascarados en el
 *   reporte) que sirvan de referencia al plan de prueba
 * - NO ejecuta registrar_pago_con_aplicacion ni ninguna otra RPC
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

function mask(val) {
  const s = String(val ?? '').trim()
  if (s.length === 0) return '(vacío)'
  return s.substring(0, 4) + '****'
}

async function main() {
  console.log('\n📊 Conteos actuales (solo lectura)')

  const { count: countPagos } = await sb.from('pagos_recibos').select('id', { count: 'exact', head: true })
  const { count: countAplicaciones } = await sb.from('pagos_cuotas_aplicaciones').select('id', { count: 'exact', head: true })
  console.log(`  pagos_recibos: ${countPagos}`)
  console.log(`  pagos_cuotas_aplicaciones: ${countAplicaciones}`)

  // ── Candidato 1: crédito vigente con >=2 cuotas pendientes/vencidas/parciales ──
  console.log('\n🔍 Candidato — crédito vigente con cuotas pendientes')
  const { data: creditos } = await sb
    .from('creditos')
    .select('id, nro_pagare, saldo_capital, estado')
    .eq('estado', 'vigente')
    .limit(500)

  let candidato = null
  for (const c of creditos ?? []) {
    const { data: cuotas } = await sb
      .from('cronograma_cuotas')
      .select('id, nro_cuota, capital, interes, capital_pagado, interes_pagado, estado, fecha_vencimiento')
      .eq('id_credito', c.id)
      .in('estado', ['pendiente', 'vencida', 'parcial'])
      .order('fecha_vencimiento', { ascending: true })
      .limit(5)

    if (cuotas && cuotas.length >= 2) {
      candidato = { credito: c, cuotas }
      break
    }
  }

  if (candidato) {
    console.log(`  Crédito candidato: id=${candidato.credito.id} nro_pagare=${mask(candidato.credito.nro_pagare)} saldo_capital=${candidato.credito.saldo_capital}`)
    for (const cu of candidato.cuotas) {
      const capFaltante = round2(cu.capital - (cu.capital_pagado ?? 0))
      const intFaltante = round2(cu.interes - (cu.interes_pagado ?? 0))
      console.log(`    cuota id=${cu.id} nro=${cu.nro_cuota} estado=${cu.estado} capital_faltante=${capFaltante} interes_faltante=${intFaltante} vence=${cu.fecha_vencimiento}`)
    }
  } else {
    console.log('  ⚠️  No se encontró un crédito vigente con 2+ cuotas pendientes.')
  }

  // ── Candidato 2: crédito cancelado (para probar rechazo) ──
  console.log('\n🔍 Candidato — crédito cancelado')
  const { data: cancelados } = await sb
    .from('creditos')
    .select('id, nro_pagare, estado')
    .eq('estado', 'cancelado')
    .limit(1)

  if (cancelados && cancelados.length > 0) {
    console.log(`  Crédito cancelado candidato: id=${cancelados[0].id} nro_pagare=${mask(cancelados[0].nro_pagare)}`)
  } else {
    console.log('  ⚠️  No se encontró ningún crédito cancelado.')
  }

  // ── Candidato 3: nro_recibo existente (para probar rechazo de duplicado) ──
  console.log('\n🔍 Candidato — nro_recibo existente (para probar recibo_duplicado)')
  const { data: reciboExistente } = await sb
    .from('pagos_recibos')
    .select('id, nro_recibo')
    .limit(1)
    .maybeSingle()

  if (reciboExistente) {
    console.log(`  nro_recibo existente candidato: ${mask(reciboExistente.nro_recibo)} (id=${reciboExistente.id})`)
  } else {
    console.log('  ⚠️  No se encontró ningún pagos_recibos existente.')
  }

  console.log('\n✅ Búsqueda de candidatos completada — ningún dato fue modificado.')
}

function round2(n) { return Math.round(n * 100) / 100 }

main().catch(err => { console.error(err); process.exit(1) })
