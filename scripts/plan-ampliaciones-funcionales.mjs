/**
 * plan-ampliaciones-funcionales.mjs
 * Fase 10J-0 — Dry-run: diseño seguro de ampliaciones funcionales
 *
 * Este script NO modifica nada en la base de datos.
 * Solo consulta datos para simular cómo se vería una ampliación aplicada.
 *
 * Uso: npm run plan:ampliaciones-funcionales
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// ── Cargar .env.local ───────────────────────────────────────────────────────
function loadEnv() {
  const envPath = join(ROOT, '.env.local')
  if (!existsSync(envPath)) {
    console.error('❌ No se encontró .env.local — no se puede conectar a Supabase')
    process.exit(1)
  }
  const lines = readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const [key, ...rest] = line.split('=')
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
  }
}

loadEnv()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

function fmt(n) {
  if (n == null) return '—'
  return 'S/ ' + new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function sep(char = '─', len = 60) {
  return char.repeat(len)
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n' + sep('═'))
  console.log('  CEJUASSA — Plan de Ampliaciones Funcionales (DRY-RUN)')
  console.log('  Fase 10J-0 — Este script NO modifica nada en la DB.')
  console.log(sep('═') + '\n')

  // ── 1. Auditar tabla ampliaciones ──────────────────────────────────────────
  console.log('[ 1. Estado actual de la tabla ampliaciones ]')
  const { count: ampCount, error: ampErr } = await supabase
    .from('ampliaciones')
    .select('*', { count: 'exact', head: true })

  if (ampErr) {
    console.log(`   ❌ Error al consultar ampliaciones: ${ampErr.message}`)
  } else {
    console.log(`   Registros actuales: ${ampCount ?? 0}`)
    console.log(`   Tabla: public.ampliaciones`)
    console.log(`   Campos disponibles: id, id_credito, fecha, nro_pagare_anterior, nro_pagare_nuevo,`)
    console.log(`                       monto_nuevo, plazo_nuevo, saldo_nuevo, observacion,`)
    console.log(`                       created_at, created_by`)
  }

  // ── 2. Elegir un crédito de prueba vigente ─────────────────────────────────
  console.log('\n' + sep() + '\n[ 2. Crédito de prueba seleccionado ]')
  const { data: creditos, error: creditoErr } = await supabase
    .from('creditos')
    .select('id, nro_pagare, monto_aprobado, saldo_capital, plazo_meses, tasa_interes, estado, fecha_desembolso, id_socio')
    .eq('estado', 'vigente')
    .gt('saldo_capital', 0)
    .order('id', { ascending: true })
    .limit(1)

  if (creditoErr || !creditos || creditos.length === 0) {
    console.log('   ❌ No se encontró ningún crédito vigente con saldo > 0.')
    if (creditoErr) console.log(`   Error: ${creditoErr.message}`)
    console.log('   El dry-run no puede continuar sin un crédito de prueba.')
    process.exit(1)
  }

  const credito = creditos[0]

  // Obtener nombre del socio
  let socioLabel = `ID ${credito.id_socio}`
  const { data: socioData } = await supabase
    .from('socios')
    .select('apellidos, nombres, nro_socio')
    .eq('id', credito.id_socio)
    .single()
  if (socioData) {
    const apellidos = socioData.apellidos ?? ''
    const nombres = socioData.nombres ?? ''
    socioLabel = `${apellidos}, ${nombres} (Nº ${socioData.nro_socio ?? '—'})`
  }

  console.log(`   ID crédito:      ${credito.id}`)
  console.log(`   Pagaré actual:   ${credito.nro_pagare ?? '—'}`)
  console.log(`   Socio:           ${socioLabel}`)
  console.log(`   Monto aprobado:  ${fmt(credito.monto_aprobado)}`)
  console.log(`   Saldo capital:   ${fmt(credito.saldo_capital)}`)
  console.log(`   Plazo:           ${credito.plazo_meses ?? '—'} meses`)
  console.log(`   Tasa:            ${credito.tasa_interes ?? '—'}%`)
  console.log(`   Estado:          ${credito.estado}`)
  console.log(`   Desembolso:      ${credito.fecha_desembolso ?? '—'}`)

  // ── 3. Simular ampliación de ejemplo ───────────────────────────────────────
  console.log('\n' + sep() + '\n[ 3. Simulación de ampliación (DRY-RUN) ]')

  const MONTO_AMPLIACION = 1000.00
  const nroPagareAnterior = credito.nro_pagare ?? 'PAGARE-ACTUAL'
  const nroPagareNuevo = `${nroPagareAnterior}-AMP1`
  const montoNuevo = (credito.monto_aprobado ?? 0) + MONTO_AMPLIACION
  const saldoNuevo = (credito.saldo_capital ?? 0) + MONTO_AMPLIACION
  const plazoNuevo = credito.plazo_meses ?? 0
  const fechaAmpliacion = new Date().toISOString().split('T')[0]

  console.log(`\n   Monto a ampliar (ejemplo): ${fmt(MONTO_AMPLIACION)}`)
  console.log(`\n   ANTES DE APLICAR:`)
  console.log(`     creditos.nro_pagare     = ${nroPagareAnterior}`)
  console.log(`     creditos.monto_aprobado = ${fmt(credito.monto_aprobado)}`)
  console.log(`     creditos.saldo_capital  = ${fmt(credito.saldo_capital)}`)
  console.log(`     creditos.plazo_meses    = ${credito.plazo_meses ?? '—'}`)
  console.log(`\n   DESPUÉS DE APLICAR (simulado — NO se guarda):`)
  console.log(`     creditos.nro_pagare     = ${nroPagareNuevo}           ← cambia`)
  console.log(`     creditos.monto_aprobado = ${fmt(montoNuevo)}    ← suma ${fmt(MONTO_AMPLIACION)}`)
  console.log(`     creditos.saldo_capital  = ${fmt(saldoNuevo)}    ← suma ${fmt(MONTO_AMPLIACION)}`)
  console.log(`     creditos.plazo_meses    = ${plazoNuevo}          ← sin cambio en esta fase`)
  console.log(`\n   REGISTRO EN ampliaciones (simulado — NO se inserta):`)
  console.log(`     id_credito         = ${credito.id}`)
  console.log(`     fecha              = ${fechaAmpliacion}`)
  console.log(`     nro_pagare_anterior= ${nroPagareAnterior}`)
  console.log(`     nro_pagare_nuevo   = ${nroPagareNuevo}`)
  console.log(`     monto_nuevo        = ${fmt(montoNuevo)}   (= monto_aprobado final)`)
  console.log(`     saldo_nuevo        = ${fmt(saldoNuevo)}   (= saldo_capital final)`)
  console.log(`     plazo_nuevo        = ${plazoNuevo}`)
  console.log(`     observacion        = "DRY-RUN Fase 10J-0"`)

  // ── 4. Verificar que cronograma/pagos no se tocan ─────────────────────────
  console.log('\n' + sep() + '\n[ 4. Verificación: tablas que NO se tocarían ]')

  const { count: cronCount } = await supabase
    .from('cronograma_cuotas')
    .select('*', { count: 'exact', head: true })
    .eq('id_credito', credito.id)

  const { count: pagosCount } = await supabase
    .from('pagos_recibos')
    .select('*', { count: 'exact', head: true })
    .eq('id_credito', credito.id)

  const { count: ampExistCount } = await supabase
    .from('ampliaciones')
    .select('*', { count: 'exact', head: true })
    .eq('id_credito', credito.id)

  console.log(`   cronograma_cuotas (crédito ${credito.id}): ${cronCount ?? 0} cuotas → NO SE MODIFICA ✅`)
  console.log(`   pagos_recibos     (crédito ${credito.id}): ${pagosCount ?? 0} pagos  → NO SE MODIFICA ✅`)
  console.log(`   ampliaciones      (crédito ${credito.id}): ${ampExistCount ?? 0} previas → NO SE MODIFICA ✅`)

  if (cronCount > 0) {
    console.log(`\n   ⚠️  ADVERTENCIA: El crédito tiene ${cronCount} cuotas en cronograma.`)
    console.log(`       Tras el apply, las cuotas quedarán desactualizadas respecto al`)
    console.log(`       nuevo monto aprobado. Confirmar con contadora si se regenera.`)
  }

  // ── 5. Analizar campo monto_nuevo ──────────────────────────────────────────
  console.log('\n' + sep() + '\n[ 5. Análisis del campo monto_nuevo ]')

  console.log(`\n   DECISIÓN: monto_nuevo = monto aprobado total resultante (Opción B)`)
  console.log(`\n   Justificación:`)
  console.log(`   - El nombre "monto_nuevo" implica el valor final, no el delta.`)
  console.log(`   - "saldo_nuevo" sigue la misma semántica (saldo final, no delta).`)
  console.log(`   - El delta es recuperable: monto_nuevo - monto_aprobado_anterior.`)
  console.log(`   - NO se necesita campo adicional "monto_ampliacion" en la tabla.`)
  console.log(`\n   Flujo de UI propuesto (sin migración):`)
  console.log(`   1. Mostrar monto_aprobado actual (read-only)`)
  console.log(`   2. Pedir "Monto a ampliar" (campo temporal, solo UI)`)
  console.log(`   3. Calcular y mostrar: monto_aprobado + monto_a_ampliar = monto_nuevo`)
  console.log(`   4. Guardar monto_nuevo = monto_aprobado + monto_a_ampliar`)
  console.log(`\n   Verificación de suficiencia del campo:`)
  console.log(`   - Para reconstruir el delta: monto_nuevo[n] - monto_nuevo[n-1]`)
  console.log(`   - Para la primera ampliación: monto_nuevo[1] - creditos.monto_aprobado_original`)
  console.log(`   - LIMITACIÓN: si el crédito tuvo múltiples ampliaciones, el delta`)
  console.log(`     de cada una se puede calcular ordenando por fecha o id. ✅`)

  // ── 6. Riesgos ─────────────────────────────────────────────────────────────
  console.log('\n' + sep() + '\n[ 6. Riesgos identificados ]')

  const riesgos = []

  if ((cronCount ?? 0) > 0) {
    riesgos.push({
      nivel: 'ALTO',
      riesgo: 'Cronograma desactualizado',
      detalle: `El crédito tiene ${cronCount} cuotas. No se recalculará en esta fase.`,
      mitigacion: 'Advertir al operador. Confirmar con contadora en Fase 10J-2.'
    })
  }

  riesgos.push({
    nivel: 'ALTO',
    riesgo: 'nro_pagare_nuevo duplicado',
    detalle: 'El campo tiene constraint UNIQUE. Si ya existe, Supabase rechaza el INSERT.',
    mitigacion: 'Validar en UI antes de guardar. El error de Supabase es claro.'
  })

  riesgos.push({
    nivel: 'MEDIO',
    riesgo: 'Doble ampliación del mismo crédito',
    detalle: 'No hay guard en DB que impida ampliar dos veces seguidas.',
    mitigacion: 'Agregar confirmación explícita en UI si hay ampliaciones previas.'
  })

  riesgos.push({
    nivel: 'BAJO',
    riesgo: 'Cronograma obsoleto en Anexo 6 y BDCC',
    detalle: 'Anexo 6 y BD01 leen monto_aprobado/saldo_capital desde creditos → se actualizan. Cuotas individuales no.',
    mitigacion: 'Aceptable en esta fase. Resolver en Fase 10J-2 si contadora pide recalcular.'
  })

  for (const r of riesgos) {
    const icon = r.nivel === 'ALTO' ? '🔴' : r.nivel === 'MEDIO' ? '🟡' : '🟢'
    console.log(`\n   ${icon} [${r.nivel}] ${r.riesgo}`)
    console.log(`      Detalle:    ${r.detalle}`)
    console.log(`      Mitigación: ${r.mitigacion}`)
  }

  // ── 7. Confirmaciones pendientes ───────────────────────────────────────────
  console.log('\n' + sep() + '\n[ 7. Confirmaciones pendientes con contadora (bloquean Fase 10J-1) ]')
  console.log(`\n   ❓ ¿El cronograma de cuotas se recalcula al ampliar?`)
  console.log(`   ❓ ¿La cuota mensual cambia?`)
  console.log(`   ❓ ¿La tasa de interés puede cambiar al ampliar?`)
  console.log(`   ❓ ¿El plazo real (plazo_meses) cambia o solo se registra?`)
  console.log(`   ❓ ¿Solo créditos vigentes pueden ser ampliados?`)
  console.log(`   ❓ ¿Un crédito puede tener más de una ampliación?`)

  // ── Resumen ─────────────────────────────────────────────────────────────────
  console.log('\n' + sep('═'))
  console.log('\n📋 RESUMEN DEL DRY-RUN\n')
  console.log(`   Crédito de prueba:    ID=${credito.id}, Pagaré=${credito.nro_pagare ?? '—'}`)
  console.log(`   Monto a ampliar:      ${fmt(MONTO_AMPLIACION)} (ejemplo)`)
  console.log(`   monto_aprobado:       ${fmt(credito.monto_aprobado)} → ${fmt(montoNuevo)}`)
  console.log(`   saldo_capital:        ${fmt(credito.saldo_capital)} → ${fmt(saldoNuevo)}`)
  console.log(`   nro_pagare:           ${nroPagareAnterior} → ${nroPagareNuevo}`)
  console.log(`\n   Tabla ampliaciones:   SUFICIENTE sin migración ✅`)
  console.log(`   Campo monto_nuevo:    MONTO TOTAL RESULTANTE (no delta) ✅`)
  console.log(`   Cronograma_cuotas:    NO SE TOCA en esta fase ✅`)
  console.log(`   Pagos_recibos:        NO SE TOCA ✅`)
  console.log(`\n   Riesgos altos:        ${riesgos.filter(r => r.nivel === 'ALTO').length}`)
  console.log(`   Riesgos medios:       ${riesgos.filter(r => r.nivel === 'MEDIO').length}`)
  console.log(`   Riesgos bajos:        ${riesgos.filter(r => r.nivel === 'BAJO').length}`)
  console.log(`\n   Plan completo:        docs/ai-recovery/AMPLIACIONES_FUNCIONALES_PLAN.md`)
  console.log('\n' + sep('═'))
  console.log('\n✅ DRY-RUN COMPLETADO — Ningún dato fue modificado.\n')
}

main().catch(err => {
  console.error('❌ Error inesperado:', err.message)
  process.exit(1)
})
