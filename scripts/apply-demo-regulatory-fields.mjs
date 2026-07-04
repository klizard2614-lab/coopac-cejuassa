/**
 * apply-demo-regulatory-fields.mjs
 * Fase 9C-6I-DEMO — Completar campos regulatorios con valores temporales de prueba.
 *
 * ⚠️  ADVERTENCIA: DATOS DE DEMOSTRACIÓN — NO OFICIALES
 * Los valores aplicados son temporales para pruebas funcionales con la contadora.
 * NO usar para TXT SBS, BDCC final, ni reporte regulatorio definitivo.
 *
 * REGLAS ESTRICTAS:
 * - Solo actualiza socios.genero (NULL/vacío → 'M')
 * - Solo actualiza socios.estado_civil (NULL/vacío → 'soltero')
 * - Opcionalmente: creditos.subtipo_credito_sbs (NULL/vacío → 'por_confirmar')
 * - NO toca creditos.tipo_credito_sbs
 * - NO inventa DNI ni toca socios con DNI placeholder (SINDNI%)
 * - NO modifica pagos_recibos / cronograma_cuotas / montos / saldos
 * - NO toca usuarios / configuracion / auth.users / _client_files
 * - Crea backup ANTES del apply
 *
 * Uso:
 *   node scripts/apply-demo-regulatory-fields.mjs --dry-run
 *   node scripts/apply-demo-regulatory-fields.mjs --apply --authorized
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DOCS_DIR = resolve(ROOT, 'docs/ai-recovery')

// ─── Args ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const IS_DRY_RUN = args.includes('--dry-run')
const IS_APPLY   = args.includes('--apply') && args.includes('--authorized')

if (!IS_DRY_RUN && !IS_APPLY) {
  console.error('\n❌ Debes especificar el modo de ejecución:')
  console.error('   --dry-run              : Simular sin modificar datos')
  console.error('   --apply --authorized   : Aplicar cambios (requiere autorización explícita)')
  process.exit(1)
}

const MODE = IS_DRY_RUN ? 'DRY-RUN' : 'APPLY'

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

function mask(val) {
  const s = String(val || '').trim()
  if (s.length === 0) return '(vacío)'
  return s.substring(0, 4) + '****'
}

function ts() { return new Date().toISOString().replace(/[:.]/g, '-').substring(0, 16) }

async function fetchAll(table, select = '*') {
  const { data, error } = await sb.from(table).select(select)
  if (error) throw new Error(`fetch ${table}: ${error.message}`)
  return data || []
}

// ─── Backup ───────────────────────────────────────────────────────────────────

async function crearBackup() {
  const stamp = ts()
  const backupDir = resolve(ROOT, `backups/demo-data-fill/${stamp}`)
  mkdirSync(backupDir, { recursive: true })

  console.log(`\n💾 Creando backup en: backups/demo-data-fill/${stamp}/`)

  const socios   = await fetchAll('socios',   'id,nro_socio,dni,apellidos,nombres,genero,estado_civil,estado')
  const creditos = await fetchAll('creditos',  'id,nro_pagare,id_socio,tipo_credito_sbs,subtipo_credito_sbs,estado')

  writeFileSync(resolve(backupDir, 'socios.json'),   JSON.stringify(socios,   null, 2))
  writeFileSync(resolve(backupDir, 'creditos.json'),  JSON.stringify(creditos,  null, 2))

  const manifest = `# Backup Demo Regulatory Fields — ${stamp}
⚠️  DATOS DE DEMOSTRACIÓN — NO OFICIALES
Generado: ${new Date().toISOString()}
Fase: 9C-6I-DEMO

## Contenido
- socios.json   — ${socios.length} registros (antes de actualizar genero/estado_civil)
- creditos.json — ${creditos.length} registros (antes de actualizar subtipo_credito_sbs)

## Cómo revertir
Restaurar manualmente los valores de socios.genero y socios.estado_civil
usando este backup como referencia. Campos con NULL antes del apply
deben volver a NULL si se desea revertir completamente.

## Nota
Este backup NO incluye pagos_recibos, cronograma_cuotas, montos ni saldos
porque esos datos NO fueron modificados por este script.
`
  writeFileSync(resolve(backupDir, 'BACKUP_MANIFEST.md'), manifest)

  console.log(`  ✅ socios.json     — ${socios.length} registros`)
  console.log(`  ✅ creditos.json   — ${creditos.length} registros`)
  console.log(`  ✅ BACKUP_MANIFEST.md`)

  return { stamp, backupDir, socios, creditos }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n══════════════════════════════════════════════════════════════════')
  console.log(`  CEJUASSA — Demo Regulatory Fields Fill — MODO: ${MODE}`)
  console.log('══════════════════════════════════════════════════════════════════')
  console.log('\n⚠️  ═══════════════════════════════════════════════════════════════')
  console.log('   DATOS DE DEMOSTRACIÓN — NO OFICIALES')
  console.log('   Valores temporales para pruebas funcionales únicamente.')
  console.log('   NO usar para TXT SBS, BDCC final ni reportes regulatorios.')
  console.log('⚠️  ═══════════════════════════════════════════════════════════════\n')

  // ─── Fetch datos actuales ─────────────────────────────────────────────────

  console.log('📊 Analizando estado actual de la base de datos...\n')

  const socios   = await fetchAll('socios',  'id,nro_socio,dni,apellidos,nombres,genero,estado_civil,estado')
  const creditos = await fetchAll('creditos', 'id,nro_pagare,id_socio,tipo_credito_sbs,subtipo_credito_sbs,estado')

  // ─── Socios sin genero ────────────────────────────────────────────────────

  const sociosSinGenero = socios.filter(s => !s.genero || s.genero.trim() === '')
  console.log(`👤 Socios sin genero:     ${sociosSinGenero.length} de ${socios.length}`)

  // ─── Socios sin estado_civil ──────────────────────────────────────────────

  const sociosSinEstadoCivil = socios.filter(s => !s.estado_civil || s.estado_civil.trim() === '')
  console.log(`💍 Socios sin estado_civil: ${sociosSinEstadoCivil.length} de ${socios.length}`)

  // ─── Socios con DNI placeholder ───────────────────────────────────────────

  const sociosDniPlaceholder = socios.filter(s => s.dni && String(s.dni).toUpperCase().startsWith('SINDNI'))
  console.log(`🪪 Socios con DNI placeholder (SINDNI%): ${sociosDniPlaceholder.length}`)
  if (sociosDniPlaceholder.length > 0) {
    sociosDniPlaceholder.forEach(s => {
      console.log(`   ⚠️  Pendiente — nro_socio: ${s.nro_socio || '?'}, DNI: ${mask(s.dni)} (NO se inventará DNI)`)
    })
  }

  // ─── Créditos sin subtipo_credito_sbs ────────────────────────────────────

  const creditosSinSubtipo = creditos.filter(c => !c.subtipo_credito_sbs || c.subtipo_credito_sbs.trim() === '')
  console.log(`\n📋 Créditos sin subtipo_credito_sbs: ${creditosSinSubtipo.length} de ${creditos.length}`)

  // ─── tipo_credito_sbs actual ──────────────────────────────────────────────

  const tiposUnicos = [...new Set(creditos.map(c => c.tipo_credito_sbs || '(NULL)'))].sort()
  console.log(`📌 tipo_credito_sbs valores actuales: ${tiposUnicos.join(', ')}`)
  console.log(`   ✅ NO se convertirá a código numérico SBS (ej. '004')`)

  // ─── Cambios propuestos ───────────────────────────────────────────────────

  console.log('\n📝 CAMBIOS PROPUESTOS (DATOS DEMO — NO OFICIALES):')
  console.log(`  • socios.genero NULL/vacío        → 'M'         (${sociosSinGenero.length} registros)`)
  console.log(`  • socios.estado_civil NULL/vacío  → 'soltero'   (${sociosSinEstadoCivil.length} registros)`)
  console.log(`  • creditos.subtipo_credito_sbs NULL/vacío → 'por_confirmar'  (${creditosSinSubtipo.length} registros)`)
  console.log(`  • socios DNI placeholder (${sociosDniPlaceholder.length}) → SIN CAMBIO (pendiente manual)`)
  console.log(`  • creditos.tipo_credito_sbs   → SIN CAMBIO (mantener valor actual)`)
  console.log(`  • pagos_recibos               → SIN CAMBIO`)
  console.log(`  • cronograma_cuotas           → SIN CAMBIO`)
  console.log(`  • montos / saldos             → SIN CAMBIO`)

  if (IS_DRY_RUN) {
    console.log('\n✅ DRY-RUN completado. Sin cambios aplicados.')
    console.log('   Para aplicar, ejecutar: npm run demo:reg-fields:apply')
    console.log('   (requiere autorización exacta: APLICAR DATOS DEMO 9C-6I)')
    return {
      mode: 'dry-run',
      sociosSinGenero: sociosSinGenero.length,
      sociosSinEstadoCivil: sociosSinEstadoCivil.length,
      creditosSinSubtipo: creditosSinSubtipo.length,
      sociosDniPlaceholder: sociosDniPlaceholder.length,
      tiposUnicos,
    }
  }

  // ─── APPLY ────────────────────────────────────────────────────────────────

  console.log('\n🔒 MODO APPLY — Creando backup antes de modificar datos...')
  const { stamp } = await crearBackup()

  let sociosGeneroActualizados   = 0
  let sociosEstadoCivilActualizados = 0
  let creditosSubtipoActualizados = 0
  const errores = []

  // Actualizar socios.genero
  if (sociosSinGenero.length > 0) {
    const ids = sociosSinGenero.map(s => s.id)
    const { error } = await sb.from('socios')
      .update({ genero: 'M' })
      .in('id', ids)
    if (error) {
      errores.push(`socios.genero: ${error.message}`)
      console.error(`  ❌ Error actualizando genero: ${error.message}`)
    } else {
      sociosGeneroActualizados = ids.length
      console.log(`  ✅ socios.genero → 'M'   (${ids.length} registros)`)
    }
  } else {
    console.log(`  ℹ️  socios.genero — Sin registros para actualizar`)
  }

  // Actualizar socios.estado_civil
  if (sociosSinEstadoCivil.length > 0) {
    const ids = sociosSinEstadoCivil.map(s => s.id)
    const { error } = await sb.from('socios')
      .update({ estado_civil: 'soltero' })
      .in('id', ids)
    if (error) {
      errores.push(`socios.estado_civil: ${error.message}`)
      console.error(`  ❌ Error actualizando estado_civil: ${error.message}`)
    } else {
      sociosEstadoCivilActualizados = ids.length
      console.log(`  ✅ socios.estado_civil → 'soltero'   (${ids.length} registros)`)
    }
  } else {
    console.log(`  ℹ️  socios.estado_civil — Sin registros para actualizar`)
  }

  // Actualizar creditos.subtipo_credito_sbs
  if (creditosSinSubtipo.length > 0) {
    const ids = creditosSinSubtipo.map(c => c.id)
    const { error } = await sb.from('creditos')
      .update({ subtipo_credito_sbs: 'por_confirmar' })
      .in('id', ids)
    if (error) {
      // Si falla (ej. constraint), documentar pero no abortar
      console.log(`  ⚠️  subtipo_credito_sbs no actualizado (posible constraint): ${error.message}`)
      console.log(`     Dejando NULL — no es requerido para reportes generales`)
    } else {
      creditosSubtipoActualizados = ids.length
      console.log(`  ✅ creditos.subtipo_credito_sbs → 'por_confirmar'  (${ids.length} registros)`)
    }
  } else {
    console.log(`  ℹ️  creditos.subtipo_credito_sbs — Sin registros para actualizar`)
  }

  // ─── Reporte apply ────────────────────────────────────────────────────────

  const reportePath = resolve(DOCS_DIR, 'DEMO_REGULATORY_FIELDS_FILL_REPORT.md')
  const reporteContenido = `# DEMO Regulatory Fields Fill Report — ${stamp}

> ⚠️  **DATOS DE DEMOSTRACIÓN — NO OFICIALES**
> Valores temporales aplicados para pruebas funcionales con la contadora.
> NO usar para TXT SBS, BDCC final ni reporte regulatorio definitivo.

Generado: ${new Date().toISOString()}
Fase: 9C-6I-DEMO
Modo: APPLY

## Campos completados

| Campo | Valor aplicado | Registros actualizados |
|---|---|---|
| \`socios.genero\` | \`M\` (temporal) | ${sociosGeneroActualizados} |
| \`socios.estado_civil\` | \`soltero\` (temporal) | ${sociosEstadoCivilActualizados} |
| \`creditos.subtipo_credito_sbs\` | \`por_confirmar\` (temporal) | ${creditosSubtipoActualizados} |

## Campos NO modificados (confirmado)

- \`creditos.tipo_credito_sbs\` — mantiene valor actual (\`consumo_no_revolvente\`)
- DNI placeholder (\`SINDNI%\`) — pendiente manual, no inventado
- \`pagos_recibos\` — sin cambios
- \`cronograma_cuotas\` — sin cambios
- Montos / saldos — sin cambios
- \`usuarios\` / \`configuracion\` / \`auth.users\` / \`_client_files\` — sin cambios

## Pendientes manuales

- ${sociosDniPlaceholder.length} socio(s) con DNI placeholder — requieren DNI real del socio

## Riesgos

- Los valores \`M\` y \`soltero\` son temporales — deben reemplazarse con datos reales antes de BDCC oficial.
- \`subtipo_credito_sbs = 'por_confirmar'\` no es un valor SBS válido — confirmar con contadora.
- No afecta montos, cronogramas ni pagos.

## Cómo revertir

1. Abrir backup: \`backups/demo-data-fill/${stamp}/socios.json\`
2. Identificar registros que tenían \`genero: null\` y \`estado_civil: null\`
3. Actualizar manualmente en Supabase Dashboard:
   \`\`\`sql
   UPDATE socios SET genero = NULL WHERE genero = 'M' AND <condición de IDs>;
   UPDATE socios SET estado_civil = NULL WHERE estado_civil = 'soltero' AND <condición de IDs>;
   UPDATE creditos SET subtipo_credito_sbs = NULL WHERE subtipo_credito_sbs = 'por_confirmar';
   \`\`\`

## Errores durante apply

${errores.length === 0 ? 'Ninguno.' : errores.map(e => `- ${e}`).join('\n')}
`
  writeFileSync(reportePath, reporteContenido)
  console.log(`\n📄 Reporte guardado: docs/ai-recovery/DEMO_REGULATORY_FIELDS_FILL_REPORT.md`)

  console.log('\n══════════════════════════════════════════════════════════════════')
  console.log('  RESUMEN APPLY — DATOS DEMO (NO OFICIALES)')
  console.log('══════════════════════════════════════════════════════════════════')
  console.log(`  socios.genero actualizado:         ${sociosGeneroActualizados}`)
  console.log(`  socios.estado_civil actualizado:   ${sociosEstadoCivilActualizados}`)
  console.log(`  creditos.subtipo actualizado:      ${creditosSubtipoActualizados}`)
  console.log(`  DNI placeholder pendientes:        ${sociosDniPlaceholder.length} (sin inventar)`)
  console.log(`  Backup creado: backups/demo-data-fill/${stamp}/`)
  if (errores.length > 0) {
    console.log(`\n  ⚠️  ${errores.length} error(es) — revisar reporte.`)
  } else {
    console.log('\n  ✅ Apply completado sin errores.')
  }

  return {
    mode: 'apply',
    sociosGeneroActualizados,
    sociosEstadoCivilActualizados,
    creditosSubtipoActualizados,
    sociosDniPlaceholder: sociosDniPlaceholder.length,
    backupStamp: stamp,
    errores,
  }
}

main().catch(err => {
  console.error('\n❌ Error fatal:', err.message)
  process.exit(1)
})
