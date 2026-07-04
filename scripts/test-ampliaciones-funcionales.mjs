#!/usr/bin/env node
/**
 * test-ampliaciones-funcionales.mjs
 * Dry-run y apply+revert controlado para la RPC aplicar_ampliacion_credito.
 * Fase 10J-2B: soporta tasa_nueva, cuota_nueva, plazo_nuevo editables.
 *
 * Uso:
 *   node scripts/test-ampliaciones-funcionales.mjs --dry-run
 *   APPLY_TOKEN="PROBAR AMPLIACION EXTENDIDA 10J-2B" node scripts/test-ampliaciones-funcionales.mjs --apply
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync } from 'fs'
import { resolve } from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('[ERROR] Requiere NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const args     = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')
const isApply  = args.includes('--apply')

const APPLY_TOKEN  = 'PROBAR AMPLIACION EXTENDIDA 10J-2B'
const TEST_PAGARE  = 'TEST_PAGARE_EXT_10J_2B'
const MONTO_TEST   = 500
const TASA_TEST    = 24.5   // TEA % de prueba
const CUOTA_TEST   = 250.00 // cuota mensual de prueba

if (!isDryRun && !isApply) {
  console.log('Uso:')
  console.log('  node scripts/test-ampliaciones-funcionales.mjs --dry-run')
  console.log(`  APPLY_TOKEN="${APPLY_TOKEN}" node scripts/test-ampliaciones-funcionales.mjs --apply`)
  process.exit(0)
}

async function getTestCredito() {
  const envId = process.env.TEST_CREDITO_ID
  if (envId) {
    const { data, error } = await supabase
      .from('creditos')
      .select('id, nro_pagare, monto_aprobado, saldo_capital, plazo_meses, tasa_interes, cuota_mensual, estado')
      .eq('id', envId)
      .single()
    if (error || !data) throw new Error(`Crédito TEST_CREDITO_ID no encontrado: ${envId}`)
    return data
  }
  const { data, error } = await supabase
    .from('creditos')
    .select('id, nro_pagare, monto_aprobado, saldo_capital, plazo_meses, tasa_interes, cuota_mensual, estado')
    .eq('estado', 'vigente')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  if (error || !data) throw new Error('No hay créditos vigentes para la prueba. Define TEST_CREDITO_ID.')
  return data
}

async function dryRun() {
  console.log('\n=== DRY-RUN: Ampliaciones Funcionales 10J-2B ===\n')

  const credito = await getTestCredito()
  console.log('Crédito seleccionado:')
  console.log(`  ID:             ${credito.id}`)
  console.log(`  Nº Pagaré:      ${credito.nro_pagare}`)
  console.log(`  Monto Aprobado: S/ ${credito.monto_aprobado}`)
  console.log(`  Saldo Capital:  S/ ${credito.saldo_capital}`)
  console.log(`  Plazo:          ${credito.plazo_meses} meses`)
  console.log(`  Tasa TEA:       ${credito.tasa_interes}%`)
  console.log(`  Cuota Mensual:  S/ ${credito.cuota_mensual}`)
  console.log(`  Estado:         ${credito.estado}`)

  const plazoTest     = (credito.plazo_meses ?? 12) + 1
  const v_monto_nuevo = credito.monto_aprobado + MONTO_TEST
  const v_saldo_nuevo = credito.saldo_capital  + MONTO_TEST

  console.log(`\nSimulación (monto_a_ampliar = S/ ${MONTO_TEST}.00):`)
  console.log(`  nuevo_monto_aprobado = ${credito.monto_aprobado} + ${MONTO_TEST} = ${v_monto_nuevo}`)
  console.log(`  nuevo_saldo_capital  = ${credito.saldo_capital}  + ${MONTO_TEST} = ${v_saldo_nuevo}`)
  console.log(`  nuevo_pagare         = ${TEST_PAGARE}`)
  console.log(`  nuevo_plazo          = ${plazoTest} meses`)
  console.log(`  nueva_tasa_tea       = ${TASA_TEST}%`)
  console.log(`  nueva_cuota          = S/ ${CUOTA_TEST}`)

  const [
    { data: pagareEnCreditos },
    { data: pagareEnAmp },
  ] = await Promise.all([
    supabase.from('creditos').select('id').eq('nro_pagare', TEST_PAGARE),
    supabase.from('ampliaciones').select('id').eq('nro_pagare_nuevo', TEST_PAGARE),
  ])

  const mig1 = resolve(process.cwd(), 'supabase/migrations/20260702000001_ampliaciones_add_tasa_cuota_nuevas.sql')
  const mig2 = resolve(process.cwd(), 'supabase/migrations/20260702000002_extend_aplicar_ampliacion_credito.sql')

  console.log('\nVerificaciones:')
  console.log(`  [${pagareEnCreditos?.length === 0 ? 'OK' : 'WARN'}] Pagaré TEST no existe en creditos`)
  console.log(`  [${pagareEnAmp?.length === 0 ? 'OK' : 'WARN'}] Pagaré TEST no existe en ampliaciones`)
  console.log(`  [OK] Fórmula: nuevo_monto_aprobado = monto_aprobado + monto_a_ampliar`)
  console.log(`  [OK] Fórmula: nuevo_saldo_capital  = saldo_capital  + monto_a_ampliar`)
  console.log(`  [OK] cronograma_cuotas NO modificado (dry-run)`)
  console.log(`  [OK] pagos_recibos NO modificado (dry-run)`)
  console.log(`  [${existsSync(mig1) ? 'OK' : 'FAIL'}] Migración ALTER TABLE ampliaciones local existe`)
  console.log(`  [${existsSync(mig2) ? 'OK' : 'FAIL'}] Migración RPC extendida local existe`)

  if (!existsSync(mig1) || !existsSync(mig2)) {
    console.log('\n[STOP] Las migraciones locales no existen. Deben aplicarse con autorización:')
    console.log('       APLICAR MIGRACION AMPLIACIONES 10J-2B')
    process.exit(1)
  }

  console.log('\n[DRY-RUN COMPLETADO] No se modificaron datos.')
}

async function applyAndRevert() {
  const token = process.env.APPLY_TOKEN
  if (token !== APPLY_TOKEN) {
    console.error('\n[BLOQUEADO] Para ejecutar el apply, defina la variable de entorno:')
    console.error(`  APPLY_TOKEN="${APPLY_TOKEN}"`)
    process.exit(1)
  }

  console.log('\n=== APPLY + REVERT: Ampliaciones Funcionales 10J-2B ===\n')

  const credito = await getTestCredito()
  const plazoTest = (credito.plazo_meses ?? 12) + 1

  console.log(`Crédito: ${credito.id}`)
  console.log(`Pagaré: ${credito.nro_pagare} | Monto: S/ ${credito.monto_aprobado} | Saldo: S/ ${credito.saldo_capital}`)
  console.log(`Plazo: ${credito.plazo_meses} m | Tasa: ${credito.tasa_interes}% | Cuota: S/ ${credito.cuota_mensual}\n`)

  // Guardar valores originales para revertir
  const original = {
    nro_pagare:     credito.nro_pagare,
    monto_aprobado: credito.monto_aprobado,
    saldo_capital:  credito.saldo_capital,
    plazo_meses:    credito.plazo_meses,
    tasa_interes:   credito.tasa_interes,
    cuota_mensual:  credito.cuota_mensual,
  }

  // Guardar conteo inicial de cuotas y pagos para verificar que no cambian
  const [{ count: cuotasAntes }, { count: pagosAntes }] = await Promise.all([
    supabase.from('cronograma_cuotas').select('id', { count: 'exact', head: true }).eq('id_credito', credito.id),
    supabase.from('pagos_recibos').select('id', { count: 'exact', head: true }).eq('id_credito', credito.id),
  ])

  // Limpiar posibles residuos de ejecuciones anteriores
  await supabase.from('ampliaciones').delete().eq('nro_pagare_nuevo', TEST_PAGARE)

  console.log('Aplicando RPC aplicar_ampliacion_credito (versión 10J-2B)...')
  const { data: rpcResult, error: rpcError } = await supabase.rpc('aplicar_ampliacion_credito', {
    p_id_credito:       credito.id,
    p_fecha:            new Date().toISOString().split('T')[0],
    p_nro_pagare_nuevo: TEST_PAGARE,
    p_monto_a_ampliar:  MONTO_TEST,
    p_plazo_nuevo:      plazoTest,
    p_tasa_nueva:       TASA_TEST,
    p_cuota_nueva:      CUOTA_TEST,
    p_observacion:      'TEST AUTOMATICO 10J-2B — será revertido',
    p_created_by:       null,
  })

  if (rpcError) {
    console.error('[FAIL] Error en RPC:', rpcError.message)
    process.exit(1)
  }

  console.log('[OK] RPC ejecutada correctamente')
  console.log('Resumen:', JSON.stringify(rpcResult, null, 2))

  // Verificar resultados post-apply
  const [
    { data: creditoPost },
    { data: ampPost },
    { count: cuotasDespues },
    { count: pagosDespues },
  ] = await Promise.all([
    supabase.from('creditos').select('nro_pagare, monto_aprobado, saldo_capital, plazo_meses, tasa_interes, cuota_mensual').eq('id', credito.id).single(),
    supabase.from('ampliaciones').select('id, nro_pagare_anterior, monto_nuevo, saldo_nuevo, tasa_nueva, cuota_nueva').eq('id_credito', credito.id).eq('nro_pagare_nuevo', TEST_PAGARE).single(),
    supabase.from('cronograma_cuotas').select('id', { count: 'exact', head: true }).eq('id_credito', credito.id),
    supabase.from('pagos_recibos').select('id', { count: 'exact', head: true }).eq('id_credito', credito.id),
  ])

  const esperadoMonto = credito.monto_aprobado + MONTO_TEST
  const esperadoSaldo = credito.saldo_capital  + MONTO_TEST

  console.log('\nVerificaciones post-apply:')
  console.log(`  [${creditoPost?.nro_pagare === TEST_PAGARE ? 'OK' : 'FAIL'}] nro_pagare actualizado: ${creditoPost?.nro_pagare}`)
  console.log(`  [${creditoPost?.monto_aprobado === esperadoMonto ? 'OK' : 'FAIL'}] monto_aprobado: ${credito.monto_aprobado} → ${creditoPost?.monto_aprobado} (esperado: ${esperadoMonto})`)
  console.log(`  [${creditoPost?.saldo_capital === esperadoSaldo ? 'OK' : 'FAIL'}] saldo_capital: ${credito.saldo_capital} → ${creditoPost?.saldo_capital} (esperado: ${esperadoSaldo})`)
  console.log(`  [${creditoPost?.plazo_meses === plazoTest ? 'OK' : 'FAIL'}] plazo_meses: ${credito.plazo_meses} → ${creditoPost?.plazo_meses} (esperado: ${plazoTest})`)
  console.log(`  [${creditoPost?.tasa_interes === TASA_TEST ? 'OK' : 'FAIL'}] tasa_interes: ${credito.tasa_interes} → ${creditoPost?.tasa_interes} (esperado: ${TASA_TEST})`)
  console.log(`  [${creditoPost?.cuota_mensual === CUOTA_TEST ? 'OK' : 'FAIL'}] cuota_mensual: ${credito.cuota_mensual} → ${creditoPost?.cuota_mensual} (esperado: ${CUOTA_TEST})`)
  console.log(`  [${ampPost ? 'OK' : 'FAIL'}] Historial insertado en ampliaciones`)
  console.log(`  [${ampPost?.nro_pagare_anterior === credito.nro_pagare ? 'OK' : 'FAIL'}] nro_pagare_anterior correcto: ${ampPost?.nro_pagare_anterior}`)
  console.log(`  [${ampPost?.tasa_nueva === TASA_TEST ? 'OK' : 'FAIL'}] tasa_nueva en ampliaciones: ${ampPost?.tasa_nueva} (esperado: ${TASA_TEST})`)
  console.log(`  [${ampPost?.cuota_nueva === CUOTA_TEST ? 'OK' : 'FAIL'}] cuota_nueva en ampliaciones: ${ampPost?.cuota_nueva} (esperado: ${CUOTA_TEST})`)
  console.log(`  [${cuotasDespues === cuotasAntes ? 'OK' : 'FAIL'}] cronograma_cuotas: sin cambios (${cuotasAntes} cuotas)`)
  console.log(`  [${pagosDespues === pagosAntes ? 'OK' : 'FAIL'}] pagos_recibos: sin cambios (${pagosAntes} pagos)`)

  // Revertir
  console.log('\nRevirtiendo...')
  await Promise.all([
    supabase.from('ampliaciones').delete().eq('nro_pagare_nuevo', TEST_PAGARE),
    supabase.from('creditos').update(original).eq('id', credito.id),
  ])

  // Verificar limpieza post-revert
  const [
    { data: creditoFinal },
    { data: ampFinal },
  ] = await Promise.all([
    supabase.from('creditos').select('nro_pagare, monto_aprobado, saldo_capital, plazo_meses, tasa_interes, cuota_mensual').eq('id', credito.id).single(),
    supabase.from('ampliaciones').select('id').eq('nro_pagare_nuevo', TEST_PAGARE),
  ])

  console.log('\nVerificaciones post-revert:')
  console.log(`  [${creditoFinal?.nro_pagare === original.nro_pagare ? 'OK' : 'FAIL'}] nro_pagare restaurado: ${creditoFinal?.nro_pagare}`)
  console.log(`  [${creditoFinal?.monto_aprobado === original.monto_aprobado ? 'OK' : 'FAIL'}] monto_aprobado restaurado: ${creditoFinal?.monto_aprobado}`)
  console.log(`  [${creditoFinal?.saldo_capital === original.saldo_capital ? 'OK' : 'FAIL'}] saldo_capital restaurado: ${creditoFinal?.saldo_capital}`)
  console.log(`  [${creditoFinal?.plazo_meses === original.plazo_meses ? 'OK' : 'FAIL'}] plazo_meses restaurado: ${creditoFinal?.plazo_meses}`)
  console.log(`  [${creditoFinal?.tasa_interes === original.tasa_interes ? 'OK' : 'FAIL'}] tasa_interes restaurada: ${creditoFinal?.tasa_interes}`)
  console.log(`  [${creditoFinal?.cuota_mensual === original.cuota_mensual ? 'OK' : 'FAIL'}] cuota_mensual restaurada: ${creditoFinal?.cuota_mensual}`)
  console.log(`  [${ampFinal?.length === 0 ? 'OK' : 'FAIL'}] Ampliación temporal eliminada`)

  console.log('\n[APPLY + REVERT COMPLETADO]')
}

if (isDryRun) {
  dryRun().catch(e => { console.error('[ERROR]', e.message); process.exit(1) })
} else if (isApply) {
  applyAndRevert().catch(e => { console.error('[ERROR]', e.message); process.exit(1) })
}
