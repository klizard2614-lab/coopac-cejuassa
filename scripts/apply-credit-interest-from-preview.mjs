/**
 * apply-credit-interest-from-preview.mjs
 * Fase 9C-6B — Aplicar tasa_interes desde preview Anexo 6
 *
 * REGLAS ESTRICTAS:
 * - Solo modifica tasa_interes en tabla creditos
 * - NO toca: tipo_credito_sbs, subtipo_credito_sbs, cuenta_contable_bd01
 * - NO toca: usuarios, configuracion, auth.users, _client_files
 * - NO crea migraciones
 * - NO borra datos
 * - NO regenera cronogramas
 * - NO imprime datos personales completos
 * - Apply REQUIERE: APPLY_AUTH="APLICAR TASA ANEXO6 9C-6B"
 *
 * Uso:
 *   node scripts/apply-credit-interest-from-preview.mjs              # dry-run
 *   node scripts/apply-credit-interest-from-preview.mjs --dry-run    # dry-run explícito
 *   APPLY_AUTH="APLICAR TASA ANEXO6 9C-6B" node scripts/apply-credit-interest-from-preview.mjs --apply
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const PREVIEW_PATH = resolve(ROOT, 'docs/ai-recovery/proposed_credit_field_updates_preview.json')
const FORBIDDEN_FIELDS = ['tipo_credito_sbs', 'subtipo_credito_sbs', 'cuenta_contable_bd01',
                          'id', 'id_socio', 'nro_pagare', 'nro_expediente', 'monto_aprobado',
                          'saldo_capital', 'fecha_desembolso', 'estado', 'plazo_meses', 'cuota_mensual']

// ─── Modo ─────────────────────────────────────────────────────────────────────

const IS_APPLY = process.argv.includes('--apply')
const IS_DRY = !IS_APPLY || process.argv.includes('--dry-run')
const MODE = IS_APPLY ? 'APPLY' : 'DRY-RUN'

if (IS_APPLY) {
  const auth = process.env.APPLY_AUTH || ''
  if (auth !== 'APLICAR TASA ANEXO6 9C-6B') {
    console.error('\n❌ APPLY bloqueado — autorización incorrecta o ausente.')
    console.error('   Requerido exactamente: APPLY_AUTH="APLICAR TASA ANEXO6 9C-6B"')
    console.error('\n   En PowerShell:')
    console.error('   $env:APPLY_AUTH="APLICAR TASA ANEXO6 9C-6B"; npm run apply:tasa-anexo6:apply')
    process.exit(1)
  }
}

// ─── Env ──────────────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

let errorCount = 0
let warnCount = 0

function ok(msg) { console.log(`   ✅ ${msg}`) }
function fail(msg) { console.log(`   ❌ ${msg}`); errorCount++ }
function warn(msg) { console.log(`   ⚠️  ${msg}`); warnCount++ }
function info(msg) { console.log(`   ℹ️  ${msg}`) }

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n══════════════════════════════════════════════════════════')
  console.log(`  Fase 9C-6B — Aplicar tasa_interes desde Preview Anexo 6`)
  console.log(`  MODO: ${MODE}`)
  if (IS_APPLY) console.log('  ⚠️  MODO APPLY — SE MODIFICARÁN DATOS EN PRODUCCIÓN')
  console.log('══════════════════════════════════════════════════════════\n')

  // ─── Paso 1: Leer y validar preview ───────────────────────────────────────
  console.log('1. Validando preview...')

  if (!existsSync(PREVIEW_PATH)) {
    fail('Preview no encontrado: docs/ai-recovery/proposed_credit_field_updates_preview.json')
    console.error('\n❌ Abortar — ejecutar primero: npm run refine:credit-anexo6-match')
    process.exit(1)
  }

  let preview
  try {
    preview = JSON.parse(readFileSync(PREVIEW_PATH, 'utf8'))
  } catch (e) {
    fail(`Error parseando preview: ${e.message}`)
    process.exit(1)
  }

  if (!Array.isArray(preview)) { fail('Preview no es un array JSON'); process.exit(1) }

  // Validar conteo
  if (preview.length === 31) {
    ok(`Preview contiene exactamente 31 entradas`)
  } else {
    warn(`Preview contiene ${preview.length} entradas (esperadas 31)`)
  }

  // Validar estructura de cada entrada
  let entriesValidas = 0
  let entriesConTasaInvalida = 0
  let entriesConCamposForbidden = 0

  for (const entry of preview) {
    let entryOk = true

    if (!entry.credito_id) { fail(`Entrada sin credito_id`); entryOk = false }

    const tasa = parseFloat(String(entry.tasa_interes_propuesta || '').replace(',', '.'))
    if (isNaN(tasa) || tasa <= 0 || tasa > 1) {
      fail(`credito_id ${entry.credito_id}: tasa_interes_propuesta inválida = "${entry.tasa_interes_propuesta}"`)
      entriesConTasaInvalida++; entryOk = false
    }

    // Verificar que tipo/subtipo propuesto son null (no se aplican)
    if (entry.tipo_credito_sbs_propuesto !== null && entry.tipo_credito_sbs_propuesto !== undefined) {
      fail(`credito_id ${entry.credito_id}: tipo_credito_sbs_propuesto no es null = "${entry.tipo_credito_sbs_propuesto}"`)
      entriesConCamposForbidden++; entryOk = false
    }
    if (entry.subtipo_credito_sbs_propuesto !== null && entry.subtipo_credito_sbs_propuesto !== undefined) {
      fail(`credito_id ${entry.credito_id}: subtipo_credito_sbs_propuesto no es null = "${entry.subtipo_credito_sbs_propuesto}"`)
      entriesConCamposForbidden++; entryOk = false
    }

    if (entryOk) entriesValidas++
  }

  if (entriesValidas === preview.length) {
    ok(`Todas las ${entriesValidas} entradas tienen estructura válida`)
  }
  ok(`tipo_credito_sbs: NO se modificará (todos null en propuesta)`)
  ok(`subtipo_credito_sbs: NO se modificará (todos null en propuesta)`)

  const tasasUnicas = [...new Set(preview.map(e => e.tasa_interes_propuesta))]
  info(`Tasas propuestas únicas: ${tasasUnicas.join(', ')}`)
  info(`Fuente: ${[...new Set(preview.map(e => e.fuente))].join(', ')}`)
  info(`Confianza: ${[...new Set(preview.map(e => e.match_confidence))].join(', ')}`)

  if (errorCount > 0) {
    console.error(`\n❌ Validación falló con ${errorCount} error(es). Abortar.`)
    process.exit(1)
  }

  // ─── Paso 2: Verificar créditos en DB ─────────────────────────────────────
  console.log('\n2. Verificando créditos en DB...')

  const creditoIds = preview.map(e => e.credito_id)
  const { data: creditosDB, error: dbErr } = await sb
    .from('creditos')
    .select('id, tasa_interes, tipo_credito_sbs, subtipo_credito_sbs, estado')
    .in('id', creditoIds)

  if (dbErr) { fail(`Error consultando DB: ${dbErr.message}`); process.exit(1) }

  const dbById = {}
  for (const c of creditosDB) dbById[c.id] = c

  let noExiste = 0
  let tasaYaTiene = 0
  let tasaCero = 0

  for (const entry of preview) {
    const dbCred = dbById[entry.credito_id]
    if (!dbCred) {
      fail(`credito_id ${entry.credito_id} no existe en DB`)
      noExiste++
    } else {
      const tasaActual = Number(dbCred.tasa_interes || 0)
      if (tasaActual > 0) {
        warn(`credito_id ${entry.credito_id}: ya tiene tasa_interes = ${tasaActual} (se sobreescribirá)`)
        tasaYaTiene++
      } else {
        tasaCero++
      }
    }
  }

  if (creditosDB.length === preview.length) {
    ok(`Todos los ${creditosDB.length} credito_id existen en DB`)
  } else {
    fail(`Solo ${creditosDB.length}/${preview.length} credito_id encontrados en DB`)
  }

  if (tasaCero > 0) ok(`${tasaCero} créditos con tasa_interes = 0 (candidatos a actualizar)`)
  if (tasaYaTiene > 0) warn(`${tasaYaTiene} créditos ya tienen tasa > 0`)

  if (noExiste > 0) {
    console.error(`\n❌ ${noExiste} crédito(s) no existen en DB. Abortar.`)
    process.exit(1)
  }

  if (errorCount > 0) {
    console.error(`\n❌ Validación con ${errorCount} error(es). Abortar.`)
    process.exit(1)
  }

  // ─── Paso 3: Plan de actualización ────────────────────────────────────────
  console.log('\n3. Plan de actualización:')
  console.log(`   Campo a actualizar: tasa_interes`)
  console.log(`   Valor a aplicar:    0.2682 (TEA 26.82%)`  )
  console.log(`   Registros afectados: ${preview.length}`)
  console.log(`   Tabla:              creditos`)
  console.log(`   Campos NO tocados:  tipo_credito_sbs, subtipo_credito_sbs, cuenta_contable_bd01`)
  console.log(`                       id_socio, nro_pagare, nro_expediente, monto_aprobado,`)
  console.log(`                       saldo_capital, fecha_desembolso, estado, plazo_meses`)

  // ─── DRY-RUN: mostrar plan y salir ────────────────────────────────────────
  if (!IS_APPLY) {
    console.log('\n══════════════════════════════════════════════════════════')
    console.log('  DRY-RUN COMPLETADO — ningún dato fue modificado')
    console.log('══════════════════════════════════════════════════════════')
    console.log(`\n  Resumen:`)
    console.log(`  • Preview válido: ✅ (${preview.length} entradas)`)
    console.log(`  • credito_id en DB: ✅ (${creditosDB.length}/${preview.length})`)
    console.log(`  • Tasa con valor 0: ${tasaCero}`)
    console.log(`  • Tasa ya populada: ${tasaYaTiene}`)
    console.log(`  • tipo_credito_sbs: ✅ NO se toca`)
    console.log(`  • subtipo_credito_sbs: ✅ NO se toca`)
    console.log(`  • Errores: ${errorCount} | Advertencias: ${warnCount}`)
    console.log('\n  Para aplicar, ejecutar:')
    console.log('  $env:APPLY_AUTH="APLICAR TASA ANEXO6 9C-6B"; npm run apply:tasa-anexo6:apply')
    console.log('\n══════════════════════════════════════════════════════════\n')
    process.exit(errorCount > 0 ? 1 : 0)
  }

  // ─── APPLY: aplicar actualizaciones ───────────────────────────────────────
  console.log('\n4. Aplicando actualizaciones...')

  let applied = 0
  let failed = 0
  const errors = []

  for (const entry of preview) {
    const tasa = parseFloat(String(entry.tasa_interes_propuesta).replace(',', '.'))

    const { error: updateErr } = await sb
      .from('creditos')
      .update({ tasa_interes: tasa })
      .eq('id', entry.credito_id)

    if (updateErr) {
      console.log(`   ❌ id=${entry.credito_id}: ${updateErr.message}`)
      errors.push({ id: entry.credito_id, error: updateErr.message })
      failed++
    } else {
      applied++
    }
  }

  console.log(`\n   Aplicados: ${applied}/${preview.length}`)
  if (failed > 0) console.log(`   Fallidos:  ${failed}`)

  // ─── Verificación post-apply ───────────────────────────────────────────────
  console.log('\n5. Verificación post-apply...')

  const { data: creditosPost, error: postErr } = await sb
    .from('creditos')
    .select('id, tasa_interes, tipo_credito_sbs, subtipo_credito_sbs')
    .in('id', creditoIds)

  if (postErr) {
    fail(`Error verificando post-apply: ${postErr.message}`)
  } else {
    const conTasa = creditosPost.filter(c => Number(c.tasa_interes) > 0).length
    const sinTasa = creditosPost.filter(c => !Number(c.tasa_interes)).length
    const tipoIntacto = creditosPost.every(c => c.tipo_credito_sbs === 'consumo_no_revolvente')
    const subtipoIntacto = creditosPost.every(c => c.subtipo_credito_sbs === null)

    ok(`${conTasa}/${creditosPost.length} créditos ahora tienen tasa_interes > 0`)
    if (sinTasa > 0) warn(`${sinTasa} créditos aún sin tasa`)
    if (tipoIntacto) ok(`tipo_credito_sbs: sin cambios (todos = 'consumo_no_revolvente')`)
    else warn(`tipo_credito_sbs: algunos valores cambiaron — verificar manualmente`)
    if (subtipoIntacto) ok(`subtipo_credito_sbs: sin cambios (todos NULL)`)
    else warn(`subtipo_credito_sbs: algunos valores cambiaron — verificar manualmente`)

    // Mostrar tasas únicas aplicadas
    const tasasPost = [...new Set(creditosPost.map(c => c.tasa_interes))]
    info(`Tasas únicas en DB post-apply: ${tasasPost.join(', ')}`)
  }

  // ─── Resumen final ─────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════')
  if (failed === 0) {
    console.log('  ✅ APPLY COMPLETADO — tasa_interes actualizada en 31 créditos')
  } else {
    console.log(`  ⚠️  APPLY con ${failed} error(es)`)
  }
  console.log('══════════════════════════════════════════════════════════')
  console.log(`\n  Aplicados: ${applied} | Fallidos: ${failed}`)
  console.log(`  tipo_credito_sbs: NO modificado ✅`)
  console.log(`  subtipo_credito_sbs: NO modificado ✅`)
  console.log(`  cuenta_contable_bd01: NO modificado ✅`)
  console.log('\n  Próximos pasos:')
  console.log('  1. npm run audit:post-excel-import')
  console.log('  2. npm run verify:cejuassa')
  console.log('  3. Confirmar código SBS C19 con cliente para tipo_credito_sbs')
  console.log('  4. Fase 9C-6C: generar cronograma_cuotas\n')

  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error('❌ Error fatal:', e.message); process.exit(1) })
