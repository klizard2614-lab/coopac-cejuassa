/**
 * Fase 10C.2 — Prueba CRUD controlada de beneficiarios múltiples.
 *
 * Solo toca la tabla `socio_beneficiarios`.
 * NO modifica socios, creditos, pagos_recibos, cronograma_cuotas,
 * usuarios, configuracion ni auth.users.
 * NO crea migraciones.
 *
 * Uso:
 *   node scripts/test-beneficiarios-crud.mjs --dry-run
 *   node scripts/test-beneficiarios-crud.mjs --apply
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

const OBSERVACION_MARCA = 'TEST CRUD 10C.2 - BORRAR'

// ── Helpers ────────────────────────────────────────────────────────────────
function mask(s) {
  if (!s) return '(vacío)'
  return String(s).slice(0, 3) + '***'
}

// ── DRY-RUN ────────────────────────────────────────────────────────────────
async function dryRun() {
  console.log('=== DRY-RUN: Prueba CRUD beneficiarios (Fase 10C.2) ===\n')
  let passed = 0
  let failed = 0

  // 1. Verificar que la tabla existe seleccionando de ella
  console.log('[ 1 ] Verificando tabla socio_beneficiarios...')
  const { error: tableErr } = await supabase
    .from('socio_beneficiarios')
    .select('id')
    .limit(1)

  if (tableErr) {
    console.error(`  ✗ No se puede acceder a socio_beneficiarios: ${tableErr.message}`)
    failed++
  } else {
    console.log('  ✓ Tabla socio_beneficiarios accesible')
    passed++
  }

  // 2. Verificar columnas requeridas
  console.log('\n[ 2 ] Verificando columnas requeridas...')
  const REQUIRED_COLS = ['id', 'socio_id', 'nombres', 'dni', 'parentesco', 'porcentaje', 'es_principal', 'observacion', 'created_at']
  if (tableErr) {
    // tabla inaccesible — ya reportado en paso 1
  } else {
    // Verificar columnas específicas requeridas
    const { error: colErr } = await supabase
      .from('socio_beneficiarios')
      .select('id, socio_id, nombres, dni, parentesco, porcentaje, es_principal, observacion, created_at')
      .limit(1)
    if (colErr) {
      console.error(`  ✗ Columnas requeridas no encontradas: ${colErr.message}`)
      failed++
    } else {
      console.log(`  ✓ Columnas requeridas presentes: ${REQUIRED_COLS.join(', ')}`)
      passed++
    }
  }

  // 3. Buscar un socio existente válido
  console.log('\n[ 3 ] Buscando socio existente...')
  const { data: socios, error: socioErr } = await supabase
    .from('socios')
    .select('id, nro_socio, apellidos, nombres')
    .eq('estado', 'activo')
    .order('id')
    .limit(1)

  if (socioErr || !socios || socios.length === 0) {
    console.error(`  ✗ No se encontró socio activo: ${socioErr?.message || 'tabla vacía'}`)
    failed++
  } else {
    const s = socios[0]
    console.log(`  ✓ Socio encontrado: ID=${s.id} | nro=${mask(s.nro_socio)} | ${mask(s.apellidos)} ${mask(s.nombres)}`)
    passed++
  }

  // 4. Verificar que NO hay registros test huérfanos
  console.log('\n[ 4 ] Verificando limpieza previa (no hay test huérfanos)...')
  const { data: orphans, error: orphErr } = await supabase
    .from('socio_beneficiarios')
    .select('id')
    .eq('observacion', OBSERVACION_MARCA)

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
  console.log('  → INSERT  en socio_beneficiarios (nombres=TEST BENEFICIARIO BORRAR, dni=00000000, observacion=TEST CRUD 10C.2 - BORRAR)')
  console.log('  → SELECT  para verificar insert')
  console.log('  → UPDATE  parentesco=PRUEBA_EDITADA, es_principal=true, porcentaje=50')
  console.log('  → SELECT  para verificar update')
  console.log('  → DELETE  el registro temporal')
  console.log('  → SELECT  para verificar limpieza final')
  console.log('\n  ✓ Solo se tocaría la tabla socio_beneficiarios')
  console.log('  ✓ Registro eliminado al final (sin persistencia)')

  console.log('\n══════════════════════════════════════════════════')
  console.log(`DRY-RUN completo: ${passed} OK | ${failed} FAIL`)
  if (failed > 0) {
    console.log('⛔ Corregir errores antes de ejecutar --apply')
    process.exit(1)
  } else {
    console.log('✅ Listo para apply. Ejecutar con: npm run beneficiarios:crud:apply')
  }
}

// ── APPLY ──────────────────────────────────────────────────────────────────
async function applyRun() {
  console.log('=== APPLY: Prueba CRUD beneficiarios (Fase 10C.2) ===\n')

  const results = {
    socio_id: null,
    nro_socio_masked: null,
    insert: null,
    update: null,
    delete: null,
    cleanup: null,
    inserted_id: null,
  }

  // 0. Limpiar huérfanos de corridas anteriores
  const { error: preCleanErr } = await supabase
    .from('socio_beneficiarios')
    .delete()
    .eq('observacion', OBSERVACION_MARCA)
  if (preCleanErr) {
    console.warn(`  ⚠ No se pudo limpiar huérfanos previos: ${preCleanErr.message}`)
  }

  // 1. Seleccionar socio
  console.log('[ 1 ] Seleccionando socio existente...')
  const { data: socios, error: socioErr } = await supabase
    .from('socios')
    .select('id, nro_socio, apellidos, nombres')
    .eq('estado', 'activo')
    .order('id')
    .limit(1)

  if (socioErr || !socios || socios.length === 0) {
    console.error(`  ✗ No se encontró socio activo: ${socioErr?.message || 'tabla vacía'}`)
    printReport(results)
    process.exit(1)
  }

  const socio = socios[0]
  results.socio_id = socio.id
  results.nro_socio_masked = mask(socio.nro_socio)
  console.log(`  ✓ Socio seleccionado: ID=${socio.id} | nro=${mask(socio.nro_socio)}`)

  // 2. INSERT
  console.log('\n[ 2 ] INSERT beneficiario temporal...')
  const { data: inserted, error: insertErr } = await supabase
    .from('socio_beneficiarios')
    .insert({
      socio_id:     socio.id,
      nombres:      'TEST BENEFICIARIO BORRAR',
      dni:          '00000000',
      parentesco:   'PRUEBA',
      porcentaje:   100,
      es_principal: false,
      observacion:  OBSERVACION_MARCA,
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
  console.log(`  ✓ INSERT OK — id=${inserted.id}, nombres=${inserted.nombres}, porcentaje=${inserted.porcentaje}`)

  // Verificar via SELECT
  const { data: verIns, error: verInsErr } = await supabase
    .from('socio_beneficiarios')
    .select('*')
    .eq('id', inserted.id)
    .single()

  if (verInsErr || !verIns) {
    console.error(`  ✗ SELECT post-insert FAIL: ${verInsErr?.message}`)
    results.insert = 'FAIL_VERIFY'
  } else {
    console.log(`  ✓ Verificación insert OK — parentesco=${verIns.parentesco}, es_principal=${verIns.es_principal}`)
  }

  // 3. UPDATE
  console.log('\n[ 3 ] UPDATE beneficiario temporal...')
  const { data: updated, error: updateErr } = await supabase
    .from('socio_beneficiarios')
    .update({
      parentesco:   'PRUEBA_EDITADA',
      es_principal: true,
      porcentaje:   50,
    })
    .eq('id', inserted.id)
    .select()
    .single()

  if (updateErr || !updated) {
    console.error(`  ✗ UPDATE FAIL: ${updateErr?.message || 'sin datos retornados'}`)
    results.update = 'FAIL'
  } else {
    results.update = 'OK'
    console.log(`  ✓ UPDATE OK — parentesco=${updated.parentesco}, es_principal=${updated.es_principal}, porcentaje=${updated.porcentaje}`)
  }

  // Verificar via SELECT
  const { data: verUpd, error: verUpdErr } = await supabase
    .from('socio_beneficiarios')
    .select('*')
    .eq('id', inserted.id)
    .single()

  if (verUpdErr || !verUpd) {
    console.error(`  ✗ SELECT post-update FAIL: ${verUpdErr?.message}`)
    results.update = results.update === 'OK' ? 'OK_VERIFY_FAIL' : 'FAIL'
  } else if (verUpd.parentesco !== 'PRUEBA_EDITADA' || verUpd.es_principal !== true || verUpd.porcentaje !== 50) {
    console.error(`  ✗ Datos post-update no coinciden: parentesco=${verUpd.parentesco}, es_principal=${verUpd.es_principal}, porcentaje=${verUpd.porcentaje}`)
    results.update = 'FAIL_DATA_MISMATCH'
  } else {
    console.log(`  ✓ Verificación update OK`)
  }

  // 4. DELETE
  console.log('\n[ 4 ] DELETE beneficiario temporal...')
  const { error: deleteErr } = await supabase
    .from('socio_beneficiarios')
    .delete()
    .eq('id', inserted.id)

  if (deleteErr) {
    console.error(`  ✗ DELETE FAIL: ${deleteErr.message}`)
    results.delete = 'FAIL'
  } else {
    results.delete = 'OK'
    console.log(`  ✓ DELETE OK`)
  }

  // 5. Verificar limpieza final
  console.log('\n[ 5 ] Verificando limpieza final...')
  const { data: remaining, error: cleanErr } = await supabase
    .from('socio_beneficiarios')
    .select('id')
    .eq('observacion', OBSERVACION_MARCA)

  if (cleanErr) {
    console.error(`  ✗ Error verificando limpieza: ${cleanErr.message}`)
    results.cleanup = 'FAIL_VERIFY'
  } else if (remaining && remaining.length > 0) {
    console.error(`  ✗ LIMPIEZA INCOMPLETA — quedan ${remaining.length} registro(s) con marca TEST`)
    results.cleanup = 'FAIL_INCOMPLETE'
    // Intentar limpieza de emergencia
    await supabase.from('socio_beneficiarios').delete().eq('observacion', OBSERVACION_MARCA)
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
  console.log(`  Socio usado:    ID=${r.socio_id ?? 'N/A'} | nro=${r.nro_socio_masked ?? 'N/A'}`)
  console.log(`  Beneficiario ID insertado: ${r.inserted_id ?? 'N/A'}`)
  console.log(`  INSERT:         ${r.insert ?? 'NO EJECUTADO'}`)
  console.log(`  UPDATE:         ${r.update ?? 'NO EJECUTADO'}`)
  console.log(`  DELETE:         ${r.delete ?? 'NO EJECUTADO'}`)
  console.log(`  Limpieza final: ${r.cleanup ?? 'NO VERIFICADO'}`)
  console.log('  Otras tablas tocadas: NINGUNA')
  console.log('══════════════════════════════════════════════════')
}

// ── Entry point ────────────────────────────────────────────────────────────
const mode = process.argv[2]
if (mode === '--dry-run') {
  dryRun().catch(e => { console.error(e); process.exit(1) })
} else if (mode === '--apply') {
  applyRun().catch(e => { console.error(e); process.exit(1) })
} else {
  console.error('Uso: node scripts/test-beneficiarios-crud.mjs --dry-run | --apply')
  process.exit(1)
}
