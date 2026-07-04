#!/usr/bin/env node
// Valida RPC B: registrar_aporte_socio — 3 niveles de prueba
//
// NIVEL 1 (default, sin datos):
//   npm run test:rpc:b
//
// NIVEL 2 (happy path DB-layer, crea datos TEST en producción):
//   CEJUASSA_ALLOW_TEST_WRITES=true npm run test:rpc:b:happy
//   o: npm run test:rpc:b -- --run-happy   (requiere CEJUASSA_ALLOW_TEST_WRITES=true en .env.local)
//
// NIVEL 3 (auth/RLS real, requiere usuario test):
//   CEJUASSA_TEST_EMAIL=x CEJUASSA_TEST_PASSWORD=y npm run test:rpc:b:auth
//
// Limpieza de datos TEST:
//   npm run test:rpc:b:happy -- --cleanup

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const RUN_HAPPY = process.argv.includes('--run-happy')
const RUN_AUTH  = process.argv.includes('--auth')
const CLEANUP   = process.argv.includes('--cleanup')
const TEST_TAG  = 'TEST_RPC_B_AUTO'
const TODAY     = new Date().toISOString().slice(0, 10)
const PERIODO   = TODAY.slice(0, 7)

// ── Cargar .env.local sin imprimir valores ────────────────────────────────────
function loadEnv() {
  try {
    const raw = readFileSync('.env.local', 'utf8')
    return Object.fromEntries(
      raw.split('\n')
        .filter(l => l.includes('=') && !l.startsWith('#') && l.trim())
        .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
    )
  } catch { return {} }
}

const env = { ...loadEnv(), ...process.env }

const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SUPA_SRK = env.SUPABASE_SERVICE_ROLE_KEY
const SUPA_ANK = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const ALLOW_WRITES = env.CEJUASSA_ALLOW_TEST_WRITES === 'true'
const TEST_EMAIL   = env.CEJUASSA_TEST_EMAIL
const TEST_PASS    = env.CEJUASSA_TEST_PASSWORD

if (!SUPA_URL || !SUPA_SRK) {
  console.error('✗ FAIL: NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY faltantes en .env.local')
  process.exit(1)
}

const srClient = createClient(SUPA_URL, SUPA_SRK, {
  auth: { autoRefreshToken: false, persistSession: false },
})

let passed = 0, failed = 0, skipped = 0

function ok(msg)   { console.log(`  ✓ PASS: ${msg}`); passed++ }
function fail(msg) { console.log(`  ✗ FAIL: ${msg}`); failed++ }
function skip(msg) { console.log(`  ⚠ SKIP: ${msg}`); skipped++ }

// ── NIVEL 1 — T1: monto=0 rechazado ──────────────────────────────────────────
async function testMontoInvalido() {
  console.log('\n[L1-T1] monto=0 debe ser rechazado (sin datos)')
  const { error } = await srClient.rpc('registrar_aporte_socio', {
    p_id_socio: 1, p_id_recibo: 1, p_fecha: '2099-01-01', p_monto: 0, p_observacion: null,
  })
  if (error?.message?.includes('monto_invalido')) {
    ok(`rechazado: "${error.message.split('\n')[0]}"`)
  } else if (error) {
    fail(`error inesperado: ${error.message} (code: ${error.code})`)
  } else {
    fail('monto=0 no lanzó error — RPC podría haber insertado datos')
  }
}

// ── NIVEL 1 — T2: monto negativo rechazado ────────────────────────────────────
async function testMontoNegativo() {
  console.log('\n[L1-T2] monto=-1 debe ser rechazado (sin datos)')
  const { error } = await srClient.rpc('registrar_aporte_socio', {
    p_id_socio: 1, p_id_recibo: 1, p_fecha: '2099-01-01', p_monto: -1, p_observacion: null,
  })
  if (error?.message?.includes('monto_invalido')) {
    ok(`rechazado: "${error.message.split('\n')[0]}"`)
  } else if (error) {
    fail(`error inesperado: ${error.message}`)
  } else {
    fail('monto=-1 no lanzó error — RPC podría haber insertado datos')
  }
}

// ── NIVEL 2 — helper: buscar o crear socio TEST ───────────────────────────────
async function getSocioTest() {
  // Reutilizar si existe
  const { data: existing } = await srClient
    .from('socios').select('id').eq('apellidos', TEST_TAG).limit(1).maybeSingle()
  if (existing) { console.log(`  → socio TEST reutilizado id=${existing.id}`); return existing.id }

  // Crear con campos mínimos inferidos
  const { data: nuevo, error } = await srClient.from('socios').insert({
    apellidos:  TEST_TAG,
    nombres:    'PRUEBA AUTOMATICA',
    nro_socio:  'TEST-RPC-B-001',
    dni:        '99999999',
    estado:     'activo',
  }).select('id').single()

  if (error) {
    if (error.code === '23505') {
      // Conflicto único — probablemente nro_socio o dni ya existe de un run anterior
      const { data: retry } = await srClient
        .from('socios').select('id').eq('apellidos', TEST_TAG).limit(1).maybeSingle()
      if (retry) { console.log(`  → socio TEST recuperado id=${retry.id}`); return retry.id }
    }
    console.log(`  ✗ No se pudo crear socio TEST: ${error.message} (code: ${error.code})`)
    if (error.code === '23502') console.log('     → Campo NOT NULL faltante — agregar campo al insert en el script')
    if (error.code === '23503') console.log('     → FK requerida — id_convenio u otro campo necesita valor real')
    return null
  }

  console.log(`  → socio TEST creado id=${nuevo.id} (apellidos=${TEST_TAG}, dni=99999999)`)
  return nuevo.id
}

// ── NIVEL 2 — helper: buscar o crear recibo TEST ──────────────────────────────
async function getReciboTest(socioId) {
  // Reutilizar si existe uno TEST para este socio
  const { data: existing } = await srClient
    .from('pagos_recibos').select('id, fecha')
    .eq('id_socio', socioId).eq('observacion', TEST_TAG)
    .limit(1).maybeSingle()
  if (existing) { console.log(`  → recibo TEST reutilizado id=${existing.id}`); return existing }

  // Intentar crear con campos mínimos
  const { data: nuevo, error } = await srClient.from('pagos_recibos').insert({
    id_socio:                socioId,
    nro_recibo:              `TEST-RPC-B-${Date.now()}`,
    fecha:                   TODAY,
    periodo:                 PERIODO,
    canal_pago:              'ventanilla',
    estado_flujo:            'registrado',
    monto_aporte:            1,
    monto_capital:           0,
    monto_interes:           0,
    monto_fps:               0,
    monto_fps_extra:         0,
    monto_otros:             0,
    monto_total:             1,
    interes_amortizado_pagado: 0,
    observacion:             TEST_TAG,
  }).select('id, fecha').single()

  if (error) {
    console.log(`  ✗ No se pudo crear recibo TEST: ${error.message} (code: ${error.code})`)
    if (error.code === '23502') console.log('     → Campo NOT NULL faltante — revisar campos requeridos de pagos_recibos')
    if (error.code === '23503') console.log('     → FK requerida (id_credito? id_convenio?) — ajustar insert')
    return null
  }

  console.log(`  → recibo TEST creado id=${nuevo.id}`)
  return nuevo
}

// ── NIVEL 2 — T3: happy path con datos TEST ───────────────────────────────────
async function testHappyPath() {
  if (!RUN_HAPPY) {
    console.log('\n[L2-T3] Happy path — OMITIDO')
    console.log('     Para ejecutar: CEJUASSA_ALLOW_TEST_WRITES=true npm run test:rpc:b:happy')
    console.log('     O agregar CEJUASSA_ALLOW_TEST_WRITES=true en .env.local')
    return
  }

  if (!ALLOW_WRITES) {
    console.log('\n[L2-T3] Happy path — ABORTADO: falta CEJUASSA_ALLOW_TEST_WRITES=true')
    console.log('     Agrega CEJUASSA_ALLOW_TEST_WRITES=true en .env.local o como variable de entorno.')
    console.log('     Esta protección evita crear datos TEST en producción por accidente.')
    fail('CEJUASSA_ALLOW_TEST_WRITES no habilitado')
    return
  }

  console.log('\n[L2-T3] Happy path — DB layer (service role, bypasa RLS)')
  console.log('     ⚠ Puede crear datos en producción taggados como TEST_RPC_B_AUTO')

  const socioId = await getSocioTest()
  if (!socioId) { fail('no se pudo obtener socio TEST'); return }

  const recibo = await getReciboTest(socioId)
  if (!recibo) { fail('no se pudo obtener recibo TEST'); return }

  const { data: ultimo } = await srClient
    .from('aportes').select('saldo_nuevo')
    .eq('id_socio', socioId)
    .order('created_at', { ascending: false })
    .limit(1).maybeSingle()

  const saldoPrevio   = ultimo?.saldo_nuevo ?? 0
  const montoTest     = 1
  const saldoEsperado = saldoPrevio + montoTest
  console.log(`  → saldo previo socio TEST: S/${saldoPrevio} → esperado S/${saldoEsperado}`)

  const { data: aporteId, error: rpcErr } = await srClient.rpc('registrar_aporte_socio', {
    p_id_socio:    socioId,
    p_id_recibo:   recibo.id,
    p_fecha:       recibo.fecha,
    p_monto:       montoTest,
    p_observacion: TEST_TAG,
  })

  if (rpcErr) {
    fail(`RPC error: ${rpcErr.message} (code: ${rpcErr.code})`)
    if (rpcErr.code === '42501') console.log('     → RLS block — service role debería bypasar RLS')
    if (rpcErr.code === '23503') console.log('     → FK violation en id_recibo o id_socio')
    if (rpcErr.code === '42883') console.log('     → Función no encontrada — verificar migración')
    return
  }

  console.log(`  → aporte creado id=${aporteId}`)

  const { data: a, error: vErr } = await srClient
    .from('aportes')
    .select('id, id_recibo, id_socio, saldo_anterior, saldo_nuevo, tipo, monto, observacion')
    .eq('id', aporteId).single()

  if (vErr || !a) { fail(`no se pudo leer aporte: ${vErr?.message}`); return }

  a.id_socio       === socioId       ? ok(`id_socio=${a.id_socio}`)                   : fail(`id_socio: esperado=${socioId}, got=${a.id_socio}`)
  a.id_recibo      === recibo.id     ? ok(`id_recibo=${a.id_recibo}`)                  : fail(`id_recibo: esperado=${recibo.id}, got=${a.id_recibo}`)
  a.monto          === montoTest     ? ok(`monto=S/${a.monto}`)                        : fail(`monto: esperado=${montoTest}, got=${a.monto}`)
  a.saldo_anterior === saldoPrevio   ? ok(`saldo_anterior=S/${a.saldo_anterior}`)      : fail(`saldo_anterior: esperado=${saldoPrevio}, got=${a.saldo_anterior}`)
  a.saldo_nuevo    === saldoEsperado ? ok(`saldo_nuevo=S/${a.saldo_nuevo}`)            : fail(`saldo_nuevo: esperado=${saldoEsperado}, got=${a.saldo_nuevo}`)
  a.tipo           === 'aporte'      ? ok(`tipo='aporte'`)                             : fail(`tipo: esperado='aporte', got='${a.tipo}'`)
  a.observacion    === TEST_TAG      ? ok(`observacion='${TEST_TAG}'`)                 : fail(`observacion: esperado='${TEST_TAG}', got='${a.observacion}'`)
}

// ── NIVEL 3 — T4: RLS/auth real con usuario autenticado ──────────────────────
async function testAuthRLS() {
  if (!RUN_AUTH) {
    console.log('\n[L3-T4] Auth/RLS — OMITIDO')
    console.log('     Para ejecutar: npm run test:rpc:b:auth')
    console.log('     Requiere: CEJUASSA_TEST_EMAIL y CEJUASSA_TEST_PASSWORD en .env.local')
    return
  }

  console.log('\n[L3-T4] Auth/RLS real — anon client + signInWithPassword')

  if (!TEST_EMAIL || !TEST_PASS) {
    skip('RLS/auth no validado: faltan CEJUASSA_TEST_EMAIL y CEJUASSA_TEST_PASSWORD en .env.local')
    console.log('     Agrega esas variables para un usuario de prueba de Supabase Auth.')
    return
  }
  if (!SUPA_ANK) {
    skip('RLS/auth no validado: falta NEXT_PUBLIC_SUPABASE_ANON_KEY')
    return
  }

  const anonClient = createClient(SUPA_URL, SUPA_ANK)
  const { data: session, error: loginErr } = await anonClient.auth.signInWithPassword({
    email: TEST_EMAIL, password: TEST_PASS,
  })

  if (loginErr || !session?.user) {
    fail(`login fallido: ${loginErr?.message}`)
    return
  }

  console.log(`  → autenticado como uid=${session.user.id}`)

  // Llamar RPC con monto=0 — debe fallar por monto_invalido (no por RLS)
  const { error: rpcErr } = await anonClient.rpc('registrar_aporte_socio', {
    p_id_socio: 1, p_id_recibo: 1, p_fecha: '2099-01-01', p_monto: 0, p_observacion: null,
  })

  if (rpcErr?.message?.includes('monto_invalido')) {
    ok('RPC accesible para usuario autenticado — RLS no bloquea la función')
  } else if (rpcErr?.code === '42501' || rpcErr?.message?.includes('permission denied')) {
    fail(`RLS bloquea la RPC para usuarios autenticados: ${rpcErr.message}`)
    console.log('     → Revisar: la función debe ser accesible para el rol authenticated')
  } else if (rpcErr?.code === '42883') {
    fail('Función no encontrada vía anon client')
  } else if (rpcErr) {
    fail(`error inesperado vía auth: ${rpcErr.message} (code: ${rpcErr.code})`)
  } else {
    fail('monto=0 no lanzó error vía auth — revisar RPC')
  }

  await anonClient.auth.signOut()
}

// ── Cleanup: borra datos taggados TEST_RPC_B_AUTO ─────────────────────────────
async function cleanup() {
  if (!CLEANUP) {
    // Informar si hay datos de prueba pendientes
    const { data: p } = await srClient.from('aportes').select('id').eq('observacion', TEST_TAG)
    if (p?.length) {
      console.log(`\n⚠  ${p.length} aporte(s) TEST pendientes (tag: ${TEST_TAG})`)
      console.log('   Limpiar con: npm run test:rpc:b:happy -- --cleanup')
      console.log('   ⚠ El cleanup modifica la cadena de saldos del socio TEST.')
    }
    return
  }

  console.log('\n[CLEANUP] Eliminando datos TEST_RPC_B_AUTO')

  const { data: aportes } = await srClient.from('aportes').select('id').eq('observacion', TEST_TAG)
  if (aportes?.length) {
    const ids = aportes.map(a => a.id)
    const { error } = await srClient.from('aportes').delete().in('id', ids)
    error
      ? console.log(`  ✗ Error al borrar aportes: ${error.message}`)
      : console.log(`  ✓ Aportes eliminados: [${ids.join(',')}]`)
  } else {
    console.log('  No hay aportes TEST para limpiar.')
  }

  const { data: recibos } = await srClient.from('pagos_recibos').select('id').eq('observacion', TEST_TAG)
  if (recibos?.length) {
    const ids = recibos.map(r => r.id)
    const { error } = await srClient.from('pagos_recibos').delete().in('id', ids)
    error
      ? console.log(`  ✗ Error al borrar recibos: ${error.message}`)
      : console.log(`  ✓ Recibos TEST eliminados: [${ids.join(',')}]`)
  }

  const { data: socios } = await srClient.from('socios').select('id').eq('apellidos', TEST_TAG)
  if (socios?.length) {
    const ids = socios.map(s => s.id)
    const { error } = await srClient.from('socios').delete().in('id', ids)
    error
      ? console.log(`  ✗ Error al borrar socios: ${error.message}`)
      : console.log(`  ✓ Socios TEST eliminados: [${ids.join(',')}]`)
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
const SEP = '─'.repeat(52)
const nivel = RUN_AUTH ? 'L1+L2+L3' : RUN_HAPPY ? 'L1+L2' : 'L1'
console.log(`\nCEJUASSA test:rpc:b [${nivel}] — ${new Date().toLocaleTimeString('es-PE')}\n${SEP}`)
console.log('RPC: registrar_aporte_socio')

await testMontoInvalido()
await testMontoNegativo()
await testHappyPath()
await testAuthRLS()
await cleanup()

console.log(`\n${SEP}`)
const resumen = [`${passed} PASS`, failed ? `${failed} FAIL` : null, skipped ? `${skipped} SKIP` : null]
  .filter(Boolean).join(' | ')
console.log(failed > 0 ? `✗  ${resumen}` : `✓  Todas las pruebas pasaron (${resumen})`)
if (failed > 0) process.exit(1)
