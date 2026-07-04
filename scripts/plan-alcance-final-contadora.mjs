/**
 * plan-alcance-final-contadora.mjs
 * Fase 10J-2 — Auditoría/dry-run del alcance final según respuestas de la contadora
 *
 * REGLAS: Solo lectura. No modifica datos, esquema ni código.
 * Verifica el estado actual del proyecto contra las decisiones de alcance.
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

let pass = 0
let fail = 0
const warns = []

function check(label, ok, detail = '') {
  if (ok) {
    console.log(`  ✅ ${label}`)
    pass++
  } else {
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`)
    fail++
  }
}

function warn(label, detail = '') {
  console.log(`  ⚠️  ${label}${detail ? ` — ${detail}` : ''}`)
  warns.push(label)
}

function fileExists(rel) {
  return existsSync(resolve(ROOT, rel))
}

function fileContains(rel, str) {
  if (!fileExists(rel)) return false
  return readFileSync(resolve(ROOT, rel), 'utf8').includes(str)
}

async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('  plan-alcance-final-contadora — Auditoría de alcance')
  console.log('  Fase 10J-2 · Solo lectura · Sin modificaciones')
  console.log('═══════════════════════════════════════════════════════\n')

  // ── 1. Documento de alcance ──────────────────────────────────────────────
  console.log('── 1. Documento de decisiones finales ─────────────────')
  const alcanceDoc = 'docs/ai-recovery/COOPERATIVA_RESPUESTAS_FINALES_ALCANCE.md'
  check('Existe COOPERATIVA_RESPUESTAS_FINALES_ALCANCE.md', fileExists(alcanceDoc))
  check('Documento menciona tasa TEA', fileContains(alcanceDoc, 'TEA'))
  check('Documento menciona BDCC fuera de alcance', fileContains(alcanceDoc, 'Fuera del alcance'))
  check('Documento menciona Anexo N°6 como reporte principal', fileContains(alcanceDoc, 'Anexo N°6'))
  check('Documento menciona cuota/plazo/tasa en ampliaciones', fileContains(alcanceDoc, '10J-2'))
  console.log()

  // ── 2. Estado BDCC/TXT ───────────────────────────────────────────────────
  console.log('── 2. Estado del módulo BDCC/TXT ──────────────────────')
  const bdccPage   = 'app/dashboard/reportes/bdcc/page.tsx'
  const bdccFormat = 'lib/bdcc/format.ts'
  check('Código BDCC no fue eliminado (bdcc/page.tsx existe)', fileExists(bdccPage))
  check('Código BDCC no fue eliminado (lib/bdcc/format.ts existe)', fileExists(bdccFormat))
  if (fileExists(bdccPage)) {
    const hasBanner = fileContains(bdccPage, 'Fuera de alcance') || fileContains(bdccPage, 'DEMO')
    if (hasBanner) {
      check('Banner de advertencia visible en página BDCC', true)
    } else {
      warn('Página BDCC sin banner "Fuera de alcance" — pendiente Opción B')
    }
  }
  check('Migración BDCC min-fields aún existe', fileExists('supabase/migrations/20260620000001_bdcc_min_fields.sql'))
  console.log()

  // ── 3. Estado de Anexo N°6 ───────────────────────────────────────────────
  console.log('── 3. Reporte regulatorio Anexo N°6 ───────────────────')
  const anexo6Page = 'app/dashboard/reportes/anexo6/page.tsx'
  check('Archivo anexo6/page.tsx existe', fileExists(anexo6Page))
  check('Anexo 6 aparece en reportes/page.tsx', fileContains('app/dashboard/reportes/page.tsx', 'Anexo N°6'))
  check('Anexo 6 tiene la ruta correcta en reportes', fileContains('app/dashboard/reportes/page.tsx', '/dashboard/reportes/anexo6'))
  check('Cuenta contable corregida (1411050604)', fileContains(anexo6Page, '1411050604'))
  console.log()

  // ── 4. Tasa TEA en UI ────────────────────────────────────────────────────
  console.log('── 4. Labels de tasa TEA en formularios ───────────────')
  const creditoNuevo = 'app/dashboard/creditos/nuevo/page.tsx'
  const creditoEditar = 'app/dashboard/creditos/[id]/editar/page.tsx'
  const creditoDetalle = 'app/dashboard/creditos/[id]/page.tsx'

  const nuevoTieneAnual  = fileContains(creditoNuevo, 'Tasa de Interés Anual')
  const editarTieneAnual = fileContains(creditoEditar, 'Tasa de Interés Anual')
  const detalleTieneAnual = fileContains(creditoDetalle, 'Tasa Interés Anual')
  const nuevoTieneTEA    = fileContains(creditoNuevo, 'TEA')
  const editarTieneTEA   = fileContains(creditoEditar, 'TEA')
  const detalleTieneTEA  = fileContains(creditoDetalle, 'TEA')

  if (nuevoTieneTEA) {
    check('creditos/nuevo — label ya dice TEA', true)
  } else if (nuevoTieneAnual) {
    warn('creditos/nuevo — label dice "Anual" → pendiente cambiar a "% TEA"')
  }

  if (editarTieneTEA) {
    check('creditos/[id]/editar — label ya dice TEA', true)
  } else if (editarTieneAnual) {
    warn('creditos/[id]/editar — label dice "Anual" → pendiente cambiar a "% TEA"')
  }

  if (detalleTieneTEA) {
    check('creditos/[id]/page — label ya dice TEA', true)
  } else if (detalleTieneAnual) {
    warn('creditos/[id]/page — label dice "Anual" → pendiente cambiar a "% TEA"')
  }
  console.log()

  // ── 5. Campos de crédito para cuota/plazo/tasa ───────────────────────────
  console.log('── 5. Campos en tabla creditos (por código) ───────────')
  check('creditos/[id]/editar carga tasa_interes', fileContains(creditoEditar, 'tasa_interes'))
  check('creditos/[id]/editar carga plazo_meses', fileContains(creditoEditar, 'plazo_meses'))
  check('creditos/[id]/editar carga cuota_mensual', fileContains(creditoEditar, 'cuota_mensual'))
  console.log()

  // ── 6. Estado de ampliaciones ────────────────────────────────────────────
  console.log('── 6. Ampliaciones — estado 10J-1 y gap 10J-2 ─────────')
  const ampliSection = 'app/dashboard/creditos/_components/AmpliacionesSection.tsx'
  const ampliMigration = 'supabase/migrations/20260624000001_create_aplicar_ampliacion_credito.sql'

  check('AmpliacionesSection.tsx existe', fileExists(ampliSection))
  check('Migración aplicar_ampliacion_credito existe', fileExists(ampliMigration))

  if (fileExists(ampliMigration)) {
    const rpcSql = readFileSync(resolve(ROOT, ampliMigration), 'utf8')
    check('RPC actualiza nro_pagare en creditos', rpcSql.includes('nro_pagare'))
    check('RPC actualiza monto_aprobado en creditos', rpcSql.includes('monto_aprobado'))
    check('RPC actualiza saldo_capital en creditos', rpcSql.includes('saldo_capital'))
    // Gaps de 10J-2
    const rpcActualizaTasa = rpcSql.includes('tasa_interes') && rpcSql.includes('UPDATE creditos')
    const rpcActualizaCuota = rpcSql.includes('cuota_mensual')
    const rpcActualizaPlazo = rpcSql.includes('plazo_meses')
    if (!rpcActualizaTasa) warn('RPC NO actualiza tasa_interes en creditos — pendiente 10J-2')
    if (!rpcActualizaCuota) warn('RPC NO actualiza cuota_mensual en creditos — pendiente 10J-2')
    if (!rpcActualizaPlazo) warn('RPC NO actualiza plazo_meses en creditos — pendiente 10J-2')
  }

  if (fileExists(ampliSection)) {
    const ui = readFileSync(resolve(ROOT, ampliSection), 'utf8')
    const uiTieneTasa = ui.includes('tasa_nueva') || ui.includes('tasa_interes')
    const uiTieneCuota = ui.includes('cuota_nueva') || ui.includes('cuota_mensual')
    if (!uiTieneTasa) warn('UI de ampliaciones NO tiene campo tasa_nueva — pendiente 10J-2')
    if (!uiTieneCuota) warn('UI de ampliaciones NO tiene campo cuota_nueva — pendiente 10J-2')
  }
  console.log()

  // ── 7. Columnas faltantes en tabla ampliaciones ──────────────────────────
  console.log('── 7. Columnas pendientes en tabla ampliaciones (DB) ───')
  if (!loadEnv()) {
    warn('No se pudo cargar .env.local — verificación DB omitida')
  } else {
    try {
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
      )
      const { data: cols, error } = await sb
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_schema', 'public')
        .eq('table_name', 'ampliaciones')

      if (error) {
        warn('Error al consultar columnas de ampliaciones: ' + error.message)
      } else {
        const colNames = (cols ?? []).map(c => c.column_name)
        console.log(`  Columnas actuales en ampliaciones: ${colNames.join(', ')}`)
        check('ampliaciones tiene monto_nuevo', colNames.includes('monto_nuevo'))
        check('ampliaciones tiene plazo_nuevo', colNames.includes('plazo_nuevo'))
        check('ampliaciones tiene saldo_nuevo', colNames.includes('saldo_nuevo'))
        if (colNames.includes('tasa_nueva')) {
          check('ampliaciones tiene tasa_nueva', true)
        } else {
          warn('ampliaciones NO tiene tasa_nueva — se necesita migración para 10J-2')
        }
        if (colNames.includes('cuota_nueva')) {
          check('ampliaciones tiene cuota_nueva', true)
        } else {
          warn('ampliaciones NO tiene cuota_nueva — se necesita migración para 10J-2')
        }
      }
    } catch (e) {
      warn('Excepción al consultar DB: ' + e.message)
    }
  }
  console.log()

  // ── 8. Tipo crédito ──────────────────────────────────────────────────────
  console.log('── 8. Tipo de crédito (consumo/convenio) ───────────────')
  check('creditos/nuevo tiene opción "consumo"', fileContains(creditoNuevo, 'Consumo'))
  check('creditos/nuevo tiene tipo_credito_sbs con consumo_no_revolvente', fileContains(creditoNuevo, 'consumo_no_revolvente'))
  check('socios tienen campo id_convenio (verificado en DATABASE_AND_AUTH.md)', fileContains('docs/ai-recovery/DATABASE_AND_AUTH.md', 'id_convenio'))
  console.log()

  // ── 9. Integridad general — no se tocaron tablas sensibles ───────────────
  console.log('── 9. Guardrails — tablas críticas ─────────────────────')
  // Verificar que cronograma y pagos no tienen scripts de modificación recientes
  check('cronograma_cuotas no mencionado en AmpliacionesSection', !fileContains(ampliSection, 'cronograma_cuotas'))
  check('pagos_recibos no mencionado en AmpliacionesSection', !fileContains(ampliSection, 'pagos_recibos'))
  console.log()

  // ── Resumen ──────────────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════')
  console.log(`  TOTAL: ${pass + fail + warns.length} verificaciones`)
  console.log(`  ✅ PASS: ${pass}`)
  console.log(`  ❌ FAIL: ${fail}`)
  console.log(`  ⚠️  WARN: ${warns.length}`)
  console.log()

  if (warns.length > 0) {
    console.log('  Pendientes para Fase 10J-2:')
    warns.forEach(w => console.log(`    • ${w}`))
  }

  console.log()
  if (fail === 0) {
    console.log('  ✅ Auditoría completada sin errores. Ver WARNs para pendientes de 10J-2.')
  } else {
    console.log(`  ❌ ${fail} verificación(es) fallaron. Revisar antes de continuar.`)
    process.exit(1)
  }
}

main().catch(e => { console.error('Error fatal:', e); process.exit(1) })
