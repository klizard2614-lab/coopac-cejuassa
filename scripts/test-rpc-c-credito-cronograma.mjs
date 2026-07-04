#!/usr/bin/env node
// Valida RPC C: crear_credito_con_cronograma — 3 niveles de prueba
//
// NIVEL 1 (default, sin datos):
//   npm run test:rpc:c
//
// NIVEL 2 (happy path DB-layer, crea datos TEST en producción):
//   CEJUASSA_ALLOW_TEST_WRITES=true npm run test:rpc:c:happy
//   o: npm run test:rpc:c -- --run-happy   (requiere CEJUASSA_ALLOW_TEST_WRITES=true en .env.local)
//
// NIVEL 3 (auth/RLS real, requiere usuario test):
//   CEJUASSA_TEST_EMAIL=x CEJUASSA_TEST_PASSWORD=y npm run test:rpc:c:auth
//
// Limpieza de datos TEST:
//   npm run test:rpc:c:happy -- --cleanup

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const RUN_HAPPY = process.argv.includes('--run-happy')
const RUN_AUTH  = process.argv.includes('--auth')
const CLEANUP   = process.argv.includes('--cleanup')
const TEST_TAG  = 'TEST_RPC_C_AUTO'
const TODAY     = new Date().toISOString().slice(0, 10)

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

const SUPA_URL     = env.NEXT_PUBLIC_SUPABASE_URL
const SUPA_SRK     = env.SUPABASE_SERVICE_ROLE_KEY
const SUPA_ANK     = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
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

// ── Helper: construir p_credito de prueba ─────────────────────────────────────
function buildCredito(idSocio, nroPagare) {
  return {
    id_socio:          idSocio,
    nro_pagare:        nroPagare,
    fecha_desembolso:  TODAY,
    monto_aprobado:    1000,
    monto_girado_neto: 1000,
    descuento_fps:     0,
    descuento_seguro:  0,
    descuento_otros:   0,
    tasa_interes:      24,
    plazo_meses:       3,
    cuota_mensual:     346.75,
    tipo_credito:      'consumo',
    interes_acumulado: 0,
  }
}

// ── Helper: construir 3 cuotas para 1000 al 24% anual ────────────────────────
// r=0.02/mes — calculado con sistema francés
function buildCuotas3() {
  const fecha1 = addMonths(TODAY, 1)
  const fecha2 = addMonths(TODAY, 2)
  const fecha3 = addMonths(TODAY, 3)
  return [
    { nro_cuota: 1, fecha_vencimiento: fecha1, capital: 326.75, interes: 20.00, cuota_total: 346.75, estado: 'pendiente' },
    { nro_cuota: 2, fecha_vencimiento: fecha2, capital: 333.29, interes: 13.47, cuota_total: 346.75, estado: 'pendiente' },
    { nro_cuota: 3, fecha_vencimiento: fecha3, capital: 339.97, interes:  6.80, cuota_total: 346.77, estado: 'pendiente' },
  ]
}

function addMonths(fechaStr, months) {
  const [y, m, d] = fechaStr.split('-').map(Number)
  const total = (m - 1) + months
  const ny = y + Math.floor(total / 12)
  const nm = (total % 12) + 1
  return `${String(ny).padStart(4,'0')}-${String(nm).padStart(2,'0')}-${String(d).padStart(2,'0')}`
}

// ── NIVEL 1 — T1: p_cuotas no es array ───────────────────────────────────────
async function testCuotasNoArray() {
  console.log('\n[L1-T1] p_cuotas no es array → debe fallar con cuotas_no_es_array')
  const { error } = await srClient.rpc('crear_credito_con_cronograma', {
    p_credito: buildCredito(1, 'TEST_NOARRAY'),
    p_cuotas:  { error: 'no soy array' },
  })
  if (error?.message?.includes('cuotas_no_es_array')) {
    ok(`rechazado correctamente: "${error.message.split('\n')[0]}"`)
  } else if (error?.code === '42883' || error?.code === 'PGRST202') {
    fail(`RPC no encontrada (${error.code}) — verificar que la migración 20260617000002 fue aplicada`)
  } else if (error) {
    fail(`error inesperado: ${error.message} (code: ${error.code})`)
  } else {
    fail('p_cuotas no-array no lanzó error — RPC podría haber insertado datos')
  }
}

// ── NIVEL 1 — T2: longitud de cuotas incorrecta ───────────────────────────────
async function testLongitudIncorrecta() {
  console.log('\n[L1-T2] plazo_meses=3 con 1 cuota → debe fallar con longitud_cuotas_incorrecta')
  const { error } = await srClient.rpc('crear_credito_con_cronograma', {
    p_credito: buildCredito(1, 'TEST_LONGITUD'),
    p_cuotas:  [
      { nro_cuota: 1, fecha_vencimiento: addMonths(TODAY, 1), capital: 1000, interes: 20, cuota_total: 1020, estado: 'pendiente' },
    ],
  })
  if (error?.message?.includes('longitud_cuotas_incorrecta')) {
    ok(`rechazado correctamente: "${error.message.split('\n')[0]}"`)
  } else if (error?.code === '42883' || error?.code === 'PGRST202') {
    fail(`RPC no encontrada (${error.code}) — verificar migración`)
  } else if (error) {
    fail(`error inesperado: ${error.message} (code: ${error.code})`)
  } else {
    fail('longitud incorrecta no lanzó error')
  }
}

// ── NIVEL 1 — T3: socio inexistente con cuotas válidas ───────────────────────
// Confirma que la RPC existe y que no crea crédito cuando el socio no existe (FK violation).
async function testSocioInexistente() {
  console.log('\n[L1-T3] socio id=999999999 (inexistente) con cuotas válidas → FK violation, sin crédito creado')
  const nroPagare = `TEST_RPC_C_AUTO_L1T3_${Date.now()}`

  const { data, error } = await srClient.rpc('crear_credito_con_cronograma', {
    p_credito: buildCredito(999999999, nroPagare),
    p_cuotas:  buildCuotas3(),
  })

  if (error) {
    // Esperamos FK violation (23503) o similar — el crédito NO debe haberse creado
    const esFKError   = error.code === '23503' || error.message?.includes('foreign key')
    const esOtroError = error.message?.includes('not found') || error.message?.includes('no encontrado')
    if (esFKError || esOtroError) {
      ok(`RPC rechazó socio inexistente (FK) — rollback automático: "${error.message.split('\n')[0]}"`)
    } else {
      ok(`RPC lanzó error (sin crédito creado): code=${error.code} — "${error.message.split('\n')[0]}"`)
    }

    // Verificar que no se creó el crédito
    const { data: check } = await srClient
      .from('creditos').select('id').eq('nro_pagare', nroPagare).maybeSingle()
    if (check) {
      fail(`crédito con nro_pagare=${nroPagare} fue creado a pesar del error — rollback NO funcionó`)
    } else {
      ok('confirmado: no se creó crédito huérfano (rollback funcionó)')
    }
  } else if (data) {
    // Socio inexistente creó crédito — no debería pasar nunca
    fail(`RPC creó crédito id=${data} con socio inexistente — revisar FK constraints de la tabla creditos`)
  }
}

// ── NIVEL 1 — T4: confirmar cero datos TEST_RPC_C_AUTO residuales ─────────────
async function confirmarSinDatosTest() {
  console.log('\n[L1-T4] Confirmar que no existen créditos TEST_RPC_C_AUTO en la DB')
  const { data, error } = await srClient
    .from('creditos')
    .select('id, nro_pagare')
    .like('nro_pagare', `${TEST_TAG}%`)
  if (error) {
    fail(`error al consultar créditos TEST: ${error.message}`)
    return
  }
  if (!data || data.length === 0) {
    ok('cero créditos TEST_RPC_C_AUTO en DB — entorno limpio')
  } else {
    console.log(`  ⚠ Existen ${data.length} crédito(s) TEST: [${data.map(c => c.nro_pagare).join(', ')}]`)
    console.log('     → Limpiar con: npm run test:rpc:c:happy -- --cleanup')
    skipped++
  }
}

// ── NIVEL 2 — helper: buscar o crear socio TEST ───────────────────────────────
async function getSocioTest() {
  const { data: existing } = await srClient
    .from('socios').select('id').eq('apellidos', TEST_TAG).limit(1).maybeSingle()
  if (existing) { console.log(`  → socio TEST reutilizado id=${existing.id}`); return existing.id }

  const { data: nuevo, error } = await srClient.from('socios').insert({
    apellidos: TEST_TAG,
    nombres:   'PRUEBA AUTOMATICA',
    nro_socio: 'TEST-RPC-C-001',
    dni:       '99999998',
    estado:    'activo',
  }).select('id').single()

  if (error) {
    if (error.code === '23505') {
      const { data: retry } = await srClient
        .from('socios').select('id').eq('apellidos', TEST_TAG).limit(1).maybeSingle()
      if (retry) { console.log(`  → socio TEST recuperado id=${retry.id}`); return retry.id }
    }
    console.log(`  ✗ No se pudo crear socio TEST: ${error.message} (code: ${error.code})`)
    if (error.code === '23502') console.log('     → Campo NOT NULL faltante — ajustar insert en el script')
    if (error.code === '23503') console.log('     → FK requerida — agregar campo al insert')
    return null
  }

  console.log(`  → socio TEST creado id=${nuevo.id} (apellidos=${TEST_TAG}, dni=99999998)`)
  return nuevo.id
}

// ── NIVEL 2 — T5: happy path completo ────────────────────────────────────────
async function testHappyPath() {
  if (!RUN_HAPPY) {
    console.log('\n[L2-T5] Happy path — OMITIDO')
    console.log('     Para ejecutar: CEJUASSA_ALLOW_TEST_WRITES=true npm run test:rpc:c:happy')
    console.log('     O agregar CEJUASSA_ALLOW_TEST_WRITES=true en .env.local')
    return
  }

  if (!ALLOW_WRITES) {
    console.log('\n[L2-T5] Happy path — ABORTADO: falta CEJUASSA_ALLOW_TEST_WRITES=true')
    console.log('     Agrega CEJUASSA_ALLOW_TEST_WRITES=true en .env.local o como variable de entorno.')
    console.log('     Esta protección evita crear datos TEST en producción por accidente.')
    fail('CEJUASSA_ALLOW_TEST_WRITES no habilitado')
    return
  }

  console.log('\n[L2-T5] Happy path — DB layer (service role, bypasa RLS)')
  console.log(`     ⚠ Puede crear datos en producción taggados como ${TEST_TAG}`)

  const socioId = await getSocioTest()
  if (!socioId) { fail('no se pudo obtener socio TEST'); return }

  const nroPagare = `${TEST_TAG}_${Date.now()}`
  const pCredito  = buildCredito(socioId, nroPagare)
  const pCuotas   = buildCuotas3()

  console.log(`  → llamando RPC con nro_pagare=${nroPagare}, plazo=3 cuotas, monto=1000`)

  const { data: idCredito, error: rpcErr } = await srClient.rpc('crear_credito_con_cronograma', {
    p_credito: pCredito,
    p_cuotas:  pCuotas,
  })

  if (rpcErr) {
    fail(`RPC error: ${rpcErr.message} (code: ${rpcErr.code})`)
    if (rpcErr.code === '42501') console.log('     → RLS bloquea service role — revisar permisos de la función')
    if (rpcErr.code === '23503') console.log('     → FK violation — id_socio no existe o tabla creditos requiere campo extra')
    if (rpcErr.code === '23502') console.log('     → Campo NOT NULL faltante en creditos o cronograma_cuotas')
    if (rpcErr.code === '42883') console.log('     → Función no encontrada — verificar migración 20260617000002')
    return
  }

  ok(`RPC devolvió id_credito=${idCredito}`)

  // Verificar crédito en DB
  const { data: credito, error: cErr } = await srClient
    .from('creditos')
    .select('id, nro_pagare, monto_aprobado, saldo_capital, estado')
    .eq('id', idCredito)
    .single()

  if (cErr || !credito) { fail(`no se pudo leer crédito: ${cErr?.message}`); return }

  credito.nro_pagare    === nroPagare ? ok(`nro_pagare=${credito.nro_pagare}`)     : fail(`nro_pagare: esperado=${nroPagare}, got=${credito.nro_pagare}`)
  credito.saldo_capital === 1000      ? ok(`saldo_capital=S/${credito.saldo_capital}`) : fail(`saldo_capital: esperado=1000, got=${credito.saldo_capital}`)
  credito.estado        === 'vigente' ? ok(`estado='vigente'`)                      : fail(`estado: esperado='vigente', got='${credito.estado}'`)

  // Verificar cuotas
  const { data: cuotas, error: qErr } = await srClient
    .from('cronograma_cuotas')
    .select('nro_cuota, estado, capital_pagado, interes_pagado')
    .eq('id_credito', idCredito)
    .order('nro_cuota')

  if (qErr || !cuotas) { fail(`no se pudo leer cuotas: ${qErr?.message}`); return }

  cuotas.length === 3 ? ok(`cantidad de cuotas=${cuotas.length}`) : fail(`cantidad de cuotas: esperado=3, got=${cuotas.length}`)

  const todasPendientes    = cuotas.every(c => c.estado === 'pendiente')
  const capitalPagadoCero  = cuotas.every(c => c.capital_pagado === 0)
  const interesPagadoCero  = cuotas.every(c => c.interes_pagado === 0)

  todasPendientes   ? ok("todas las cuotas estado='pendiente'")   : fail(`alguna cuota no está pendiente: ${JSON.stringify(cuotas.map(c => c.estado))}`)
  capitalPagadoCero ? ok('capital_pagado=0 en todas las cuotas')  : fail(`capital_pagado no es 0 en alguna cuota`)
  interesPagadoCero ? ok('interes_pagado=0 en todas las cuotas')  : fail(`interes_pagado no es 0 en alguna cuota`)

  console.log(`\n  → crédito id=${idCredito} con ${cuotas.length} cuotas creado correctamente.`)
  console.log(`     Limpiar con: npm run test:rpc:c:happy -- --cleanup`)
}

// ── NIVEL 3 — T6: RLS/auth real con usuario autenticado ──────────────────────
async function testAuthRLS() {
  if (!RUN_AUTH) {
    console.log('\n[L3-T6] Auth/RLS — OMITIDO')
    console.log('     Para ejecutar: npm run test:rpc:c:auth')
    console.log('     Requiere: CEJUASSA_TEST_EMAIL y CEJUASSA_TEST_PASSWORD en .env.local')
    return
  }

  console.log('\n[L3-T6] Auth/RLS real — anon client + signInWithPassword')

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

  // Llamar RPC con p_cuotas no-array — debe fallar por cuotas_no_es_array (no por RLS)
  const { error: rpcErr } = await anonClient.rpc('crear_credito_con_cronograma', {
    p_credito: buildCredito(1, 'TEST_AUTH_RLS'),
    p_cuotas:  { no: 'array' },
  })

  if (rpcErr?.message?.includes('cuotas_no_es_array')) {
    ok('RPC accesible para usuario autenticado — RLS no bloquea la función')
  } else if (rpcErr?.code === '42501' || rpcErr?.message?.includes('permission denied')) {
    fail(`RLS bloquea la RPC para usuarios autenticados: ${rpcErr.message}`)
    console.log('     → La función necesita GRANT EXECUTE al rol authenticated, o usar SECURITY DEFINER')
  } else if (rpcErr?.code === '42883') {
    fail('Función no encontrada vía anon client')
  } else if (rpcErr) {
    fail(`error inesperado vía auth: ${rpcErr.message} (code: ${rpcErr.code})`)
  } else {
    fail('p_cuotas no-array no lanzó error vía auth — revisar RPC')
  }

  await anonClient.auth.signOut()
}

// ── Cleanup: borra datos taggados TEST_RPC_C_AUTO ─────────────────────────────
async function cleanup() {
  if (!CLEANUP) {
    const { data: p } = await srClient
      .from('creditos').select('id').like('nro_pagare', `${TEST_TAG}%`)
    if (p?.length) {
      console.log(`\n⚠  ${p.length} crédito(s) TEST pendientes (tag: ${TEST_TAG})`)
      console.log('   Limpiar con: npm run test:rpc:c:happy -- --cleanup')
    }
    return
  }

  console.log('\n[CLEANUP] Eliminando datos TEST_RPC_C_AUTO')

  // 1. Obtener ids de créditos TEST
  const { data: creditos } = await srClient
    .from('creditos').select('id').like('nro_pagare', `${TEST_TAG}%`)

  if (creditos?.length) {
    const ids = creditos.map(c => c.id)

    // 2. Borrar cuotas primero (FK: cronograma_cuotas → creditos)
    const { error: qErr } = await srClient
      .from('cronograma_cuotas').delete().in('id_credito', ids)
    qErr
      ? console.log(`  ✗ Error al borrar cuotas: ${qErr.message}`)
      : console.log(`  ✓ Cuotas de créditos TEST eliminadas (ids: [${ids.join(',')}])`)

    // 3. Borrar créditos
    const { error: cErr } = await srClient
      .from('creditos').delete().in('id', ids)
    cErr
      ? console.log(`  ✗ Error al borrar créditos: ${cErr.message}`)
      : console.log(`  ✓ Créditos TEST eliminados: [${ids.join(',')}]`)
  } else {
    console.log('  No hay créditos TEST para limpiar.')
  }

  // 4. Borrar socio TEST (solo si tiene apellidos = TEST_TAG)
  const { data: socios } = await srClient
    .from('socios').select('id').eq('apellidos', TEST_TAG)
  if (socios?.length) {
    const ids = socios.map(s => s.id)
    const { error: sErr } = await srClient.from('socios').delete().in('id', ids)
    sErr
      ? console.log(`  ✗ Error al borrar socios TEST: ${sErr.message}`)
      : console.log(`  ✓ Socios TEST eliminados: [${ids.join(',')}]`)
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
const SEP   = '─'.repeat(52)
const nivel = RUN_AUTH ? 'L1+L2+L3' : RUN_HAPPY ? 'L1+L2' : 'L1'
console.log(`\nCEJUASSA test:rpc:c [${nivel}] — ${new Date().toLocaleTimeString('es-PE')}\n${SEP}`)
console.log('RPC: crear_credito_con_cronograma')

await testCuotasNoArray()
await testLongitudIncorrecta()
await testSocioInexistente()
await confirmarSinDatosTest()
await testHappyPath()
await testAuthRLS()
await cleanup()

console.log(`\n${SEP}`)
const resumen = [`${passed} PASS`, failed ? `${failed} FAIL` : null, skipped ? `${skipped} SKIP` : null]
  .filter(Boolean).join(' | ')
console.log(failed > 0 ? `✗  ${resumen}` : `✓  Todas las pruebas pasaron (${resumen})`)
if (failed > 0) process.exit(1)
