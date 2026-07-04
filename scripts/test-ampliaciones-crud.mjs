/**
 * Fase 10D-1A — Prueba CRUD controlada de ampliaciones.
 *
 * Solo toca la tabla `ampliaciones`.
 * NO modifica creditos, cronograma_cuotas, pagos_recibos, socios,
 * usuarios, configuracion ni auth.users.
 * NO crea migraciones. NO toca _client_files.
 *
 * Uso:
 *   node scripts/test-ampliaciones-crud.mjs --dry-run
 *   node scripts/test-ampliaciones-crud.mjs --apply
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Cargar .env.local ──────────────────────────────────────────────────────
function loadEnv() {
  const envPath = resolve(__dirname, '..', '.env.local')
  try {
    const raw = readFileSync(envPath, 'utf8')
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf('=')
      if (idx === -1) continue
      const k = trimmed.slice(0, idx).trim()
      const v = trimmed.slice(idx + 1).trim()
      if (k) process.env[k] = v
    }
  } catch { /* sin .env.local, usar vars del entorno */ }
}

loadEnv()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridas.')
  process.exit(1)
}

const supabase = createClient(url, key)

const OBSERVACION_MARCA = 'TEST CRUD AMPLIACIONES 10D-1A'
const OBSERVACION_INSERT = 'TEST CRUD AMPLIACIONES 10D-1A - BORRAR'
const OBSERVACION_UPDATE = 'TEST CRUD AMPLIACIONES 10D-1A - EDITADO - BORRAR'
const NRO_PAGARE_TEST    = 'TEST_PAGARE_10D_1A'

// ── Helpers ────────────────────────────────────────────────────────────────
function mask(s) {
  if (!s) return '(vacío)'
  return String(s).slice(0, 3) + '***'
}

function today() {
  return new Date().toISOString().split('T')[0]
}

// ── DRY-RUN ────────────────────────────────────────────────────────────────
async function dryRun() {
  console.log('=== DRY-RUN: Prueba CRUD ampliaciones (Fase 10D-1A) ===\n')
  let passed = 0
  let failed = 0

  // 1. Verificar que la tabla ampliaciones existe
  console.log('[ 1 ] Verificando tabla ampliaciones...')
  const { error: tableErr } = await supabase
    .from('ampliaciones')
    .select('id')
    .limit(1)

  if (tableErr) {
    console.error(`  ✗ No se puede acceder a ampliaciones: ${tableErr.message}`)
    failed++
  } else {
    console.log('  ✓ Tabla ampliaciones accesible')
    passed++
  }

  // 2. Verificar columnas requeridas
  console.log('\n[ 2 ] Verificando columnas requeridas...')
  const REQUIRED_COLS = ['id', 'id_credito', 'fecha', 'nro_pagare_anterior', 'nro_pagare_nuevo',
                         'monto_nuevo', 'plazo_nuevo', 'saldo_nuevo', 'observacion', 'created_at']
  if (!tableErr) {
    const { error: colErr } = await supabase
      .from('ampliaciones')
      .select('id, id_credito, fecha, nro_pagare_anterior, nro_pagare_nuevo, monto_nuevo, plazo_nuevo, saldo_nuevo, observacion, created_at')
      .limit(1)
    if (colErr) {
      console.error(`  ✗ Columnas requeridas no encontradas: ${colErr.message}`)
      failed++
    } else {
      console.log(`  ✓ Columnas requeridas presentes: ${REQUIRED_COLS.join(', ')}`)
      passed++
    }
  } else {
    console.warn('  ⚠ Skipped (tabla inaccesible)')
  }

  // 3. Buscar un crédito existente válido
  console.log('\n[ 3 ] Buscando crédito existente válido...')
  const { data: creditos, error: creditoErr } = await supabase
    .from('creditos')
    .select('id, nro_pagare, monto_aprobado, plazo_meses, saldo_capital')
    .order('id')
    .limit(1)

  if (creditoErr || !creditos || creditos.length === 0) {
    console.error(`  ✗ No se encontró crédito: ${creditoErr?.message || 'tabla vacía'}`)
    failed++
  } else {
    const c = creditos[0]
    console.log(`  ✓ Crédito encontrado: ID=${c.id} | pagaré=${mask(c.nro_pagare)} | monto=${c.monto_aprobado} | plazo=${c.plazo_meses}`)
    passed++
  }

  // 4. Verificar que no hay registros test huérfanos
  console.log('\n[ 4 ] Verificando limpieza previa (no hay test huérfanos)...')
  const { data: orphans, error: orphErr } = await supabase
    .from('ampliaciones')
    .select('id')
    .ilike('observacion', `${OBSERVACION_MARCA}%`)

  if (orphErr) {
    console.warn(`  ⚠ No se pudo verificar huérfanos: ${orphErr.message}`)
  } else if (orphans && orphans.length > 0) {
    console.warn(`  ⚠ Hay ${orphans.length} registro(s) test huérfano(s) de corrida anterior. El apply los eliminará.`)
  } else {
    console.log('  ✓ Sin registros test huérfanos')
    passed++
  }

  // 5. Resumen de lo que haría el apply
  console.log('\n[ 5 ] Operaciones que ejecutaría --apply:')
  console.log(`  → INSERT  en ampliaciones (nro_pagare_nuevo=${NRO_PAGARE_TEST}, observacion='${OBSERVACION_INSERT}')`)
  console.log('  → SELECT  para verificar insert')
  console.log(`  → UPDATE  observacion='${OBSERVACION_UPDATE}', monto_nuevo += 100`)
  console.log('  → SELECT  para verificar update')
  console.log('  → DELETE  el registro temporal')
  console.log(`  → SELECT  para verificar que no quedan registros con observacion que contenga '${OBSERVACION_MARCA}'`)
  console.log('\n  ✓ Solo se tocaría la tabla ampliaciones')
  console.log('  ✓ NO se toca creditos, cronograma_cuotas, pagos_recibos, socios')
  console.log('  ✓ Registro eliminado al final (sin persistencia)')

  console.log('\n══════════════════════════════════════════════════')
  console.log(`DRY-RUN completo: ${passed} OK | ${failed} FAIL`)
  if (failed > 0) {
    console.log('⛔ Corregir errores antes de ejecutar --apply')
    process.exit(1)
  } else {
    console.log('✅ Listo para apply. Ejecutar con: npm run ampliaciones:crud:apply')
  }
}

// ── APPLY ──────────────────────────────────────────────────────────────────
async function applyRun() {
  console.log('=== APPLY: Prueba CRUD ampliaciones (Fase 10D-1A) ===\n')

  const results = {
    credito_id: null,
    nro_pagare_masked: null,
    insert: null,
    update: null,
    delete: null,
    cleanup: null,
    inserted_id: null,
  }

  // 0. Limpiar huérfanos de corridas anteriores
  const { error: preCleanErr } = await supabase
    .from('ampliaciones')
    .delete()
    .ilike('observacion', `${OBSERVACION_MARCA}%`)
  if (preCleanErr) {
    console.warn(`  ⚠ No se pudo limpiar huérfanos previos: ${preCleanErr.message}`)
  }

  // 1. Seleccionar crédito existente
  console.log('[ 1 ] Seleccionando crédito existente...')
  const { data: creditos, error: creditoErr } = await supabase
    .from('creditos')
    .select('id, nro_pagare, monto_aprobado, plazo_meses, saldo_capital')
    .order('id')
    .limit(1)

  if (creditoErr || !creditos || creditos.length === 0) {
    console.error(`  ✗ No se encontró crédito: ${creditoErr?.message || 'tabla vacía'}`)
    printReport(results)
    process.exit(1)
  }

  const credito = creditos[0]
  results.credito_id = credito.id
  results.nro_pagare_masked = mask(credito.nro_pagare)
  const montoBase  = credito.monto_aprobado ?? 1000
  const plazoBase  = credito.plazo_meses   ?? 12
  const saldoBase  = credito.saldo_capital  ?? 1000
  const pagareAnterior = credito.nro_pagare || 'TEST_ANTERIOR'
  console.log(`  ✓ Crédito seleccionado: ID=${credito.id} | pagaré=${mask(credito.nro_pagare)} | monto=${montoBase} | plazo=${plazoBase}`)

  // 2. INSERT
  console.log('\n[ 2 ] INSERT ampliación temporal...')
  const { data: inserted, error: insertErr } = await supabase
    .from('ampliaciones')
    .insert({
      id_credito:          credito.id,
      fecha:               today(),
      nro_pagare_anterior: pagareAnterior,
      nro_pagare_nuevo:    NRO_PAGARE_TEST,
      monto_nuevo:         montoBase,
      plazo_nuevo:         plazoBase,
      saldo_nuevo:         saldoBase,
      observacion:         OBSERVACION_INSERT,
    })
    .select()
    .single()

  if (insertErr || !inserted) {
    console.error(`  ✗ INSERT FAIL: ${insertErr?.message || 'sin datos retornados'}`)
    results.insert = 'FAIL'
    printReport(results)
    process.exit(1)
  }

  results.inserted_id = inserted.id
  results.insert = 'OK'
  console.log(`  ✓ INSERT OK — id=${inserted.id}, nro_pagare_nuevo=${inserted.nro_pagare_nuevo}, monto=${inserted.monto_nuevo}`)

  // Verificar via SELECT
  const { data: verIns, error: verInsErr } = await supabase
    .from('ampliaciones')
    .select('*')
    .eq('id', inserted.id)
    .single()

  if (verInsErr || !verIns) {
    console.error(`  ✗ SELECT post-insert FAIL: ${verInsErr?.message}`)
    results.insert = 'FAIL_VERIFY'
  } else {
    console.log(`  ✓ Verificación insert OK — observacion='${verIns.observacion}'`)
  }

  // 3. UPDATE
  console.log('\n[ 3 ] UPDATE ampliación temporal...')
  const montoEditado = montoBase + 100
  const { data: updated, error: updateErr } = await supabase
    .from('ampliaciones')
    .update({
      observacion: OBSERVACION_UPDATE,
      monto_nuevo: montoEditado,
    })
    .eq('id', inserted.id)
    .select()
    .single()

  if (updateErr || !updated) {
    console.error(`  ✗ UPDATE FAIL: ${updateErr?.message || 'sin datos retornados'}`)
    results.update = 'FAIL'
  } else {
    results.update = 'OK'
    console.log(`  ✓ UPDATE OK — observacion='${updated.observacion}', monto_nuevo=${updated.monto_nuevo}`)
  }

  // Verificar via SELECT
  const { data: verUpd, error: verUpdErr } = await supabase
    .from('ampliaciones')
    .select('*')
    .eq('id', inserted.id)
    .single()

  if (verUpdErr || !verUpd) {
    console.error(`  ✗ SELECT post-update FAIL: ${verUpdErr?.message}`)
    results.update = results.update === 'OK' ? 'OK_VERIFY_FAIL' : 'FAIL'
  } else if (verUpd.observacion !== OBSERVACION_UPDATE || verUpd.monto_nuevo !== montoEditado) {
    console.error(`  ✗ Datos post-update no coinciden: observacion='${verUpd.observacion}', monto=${verUpd.monto_nuevo}`)
    results.update = 'FAIL_DATA_MISMATCH'
  } else {
    console.log('  ✓ Verificación update OK')
  }

  // 4. DELETE
  console.log('\n[ 4 ] DELETE ampliación temporal...')
  const { error: deleteErr } = await supabase
    .from('ampliaciones')
    .delete()
    .eq('id', inserted.id)

  if (deleteErr) {
    console.error(`  ✗ DELETE FAIL: ${deleteErr.message}`)
    results.delete = 'FAIL'
  } else {
    results.delete = 'OK'
    console.log('  ✓ DELETE OK')
  }

  // 5. Verificar limpieza final
  console.log('\n[ 5 ] Verificando limpieza final...')
  const { data: remaining, error: cleanErr } = await supabase
    .from('ampliaciones')
    .select('id')
    .ilike('observacion', `${OBSERVACION_MARCA}%`)

  if (cleanErr) {
    console.error(`  ✗ Error verificando limpieza: ${cleanErr.message}`)
    results.cleanup = 'FAIL_VERIFY'
  } else if (remaining && remaining.length > 0) {
    console.error(`  ✗ LIMPIEZA INCOMPLETA — quedan ${remaining.length} registro(s) con marca TEST`)
    results.cleanup = 'FAIL_INCOMPLETE'
    // Limpieza de emergencia
    await supabase.from('ampliaciones').delete().ilike('observacion', `${OBSERVACION_MARCA}%`)
    console.log('  ⚠ Limpieza de emergencia ejecutada')
  } else {
    results.cleanup = 'OK'
    console.log('  ✓ Limpieza final OK — sin registros test huérfanos')
  }

  printReport(results)

  const allOk = results.insert?.startsWith('OK') && results.update?.startsWith('OK') &&
                results.delete === 'OK' && results.cleanup === 'OK'
  process.exit(allOk ? 0 : 1)
}

function printReport(r) {
  console.log('\n══════════════════════════════════════════════════')
  console.log('REPORTE FINAL:')
  console.log(`  Crédito usado:    ID=${r.credito_id ?? 'N/A'} | pagaré=${r.nro_pagare_masked ?? 'N/A'}`)
  console.log(`  Ampliación ID insertada: ${r.inserted_id ?? 'N/A'}`)
  console.log(`  INSERT:           ${r.insert ?? 'NO EJECUTADO'}`)
  console.log(`  UPDATE:           ${r.update ?? 'NO EJECUTADO'}`)
  console.log(`  DELETE:           ${r.delete ?? 'NO EJECUTADO'}`)
  console.log(`  Limpieza final:   ${r.cleanup ?? 'NO VERIFICADO'}`)
  console.log('  Tablas tocadas:   ampliaciones (solo lectura en creditos para selección)')
  console.log('  creditos:         NO MODIFICADO')
  console.log('  cronograma_cuotas: NO TOCADO')
  console.log('  pagos_recibos:    NO TOCADO')
  console.log('  socios:           NO TOCADO')
  console.log('══════════════════════════════════════════════════')
}

// ── Entry point ────────────────────────────────────────────────────────────
const mode = process.argv[2]
if (mode === '--dry-run') {
  dryRun().catch(e => { console.error(e); process.exit(1) })
} else if (mode === '--apply') {
  applyRun().catch(e => { console.error(e); process.exit(1) })
} else {
  console.error('Uso: node scripts/test-ampliaciones-crud.mjs --dry-run | --apply')
  process.exit(1)
}
