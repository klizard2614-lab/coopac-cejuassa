/**
 * check-demo-regulatory-fields-fill.mjs
 * Fase 9C-6I-DEMO — Verificador de seguridad del script demo de campos regulatorios.
 *
 * REGLAS ESTRICTAS — SOLO LECTURA / VERIFICACIÓN ESTÁTICA:
 * - NO ejecuta ningún script
 * - NO modifica ningún dato ni archivo de negocio
 * - Solo verifica existencia de archivos y contenido del script apply
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

let pass = 0
let fail = 0

function check(label, ok, detail = '') {
  if (ok) {
    console.log(`  ✅ ${label}`)
    pass++
  } else {
    console.log(`  ❌ ${label}${detail ? ' — ' + detail : ''}`)
    fail++
  }
}

function warn(label) {
  console.log(`  ⚠️  ${label}`)
}

function fileExists(rel) { return existsSync(resolve(ROOT, rel)) }

function fileContent(rel) {
  const p = resolve(ROOT, rel)
  return existsSync(p) ? readFileSync(p, 'utf8') : ''
}

console.log('\n══════════════════════════════════════════════════════════════════')
console.log('  CEJUASSA — Check: Demo Regulatory Fields Fill (9C-6I-DEMO)')
console.log('══════════════════════════════════════════════════════════════════\n')

const applyScript  = fileContent('scripts/apply-demo-regulatory-fields.mjs')

// ─── 1. Existencia de archivos ────────────────────────────────────────────────

console.log('📁 1. Existencia de archivos requeridos:')
check('Script apply existe',  fileExists('scripts/apply-demo-regulatory-fields.mjs'))
check('Check script existe',  fileExists('scripts/check-demo-regulatory-fields-fill.mjs'))

const reporteExists = fileExists('docs/ai-recovery/DEMO_REGULATORY_FIELDS_FILL_REPORT.md')
if (reporteExists) {
  check('Reporte fill existe', true)
} else {
  warn('Reporte aún no existe — se creará tras el apply')
}

// ─── 2. Soporte de modos ──────────────────────────────────────────────────────

console.log('\n🔀 2. Soporte de modos:')
check('Soporta --dry-run',
  applyScript.includes('--dry-run') && applyScript.includes('IS_DRY_RUN'))
check('Soporta --apply',
  applyScript.includes('--apply') && applyScript.includes('IS_APPLY'))
check('Requiere --authorized para apply',
  applyScript.includes('--authorized'))

// ─── 3. Crea backup antes del apply ──────────────────────────────────────────

console.log('\n💾 3. Backup antes del apply:')
check('Llama a crearBackup() en modo apply',
  applyScript.includes('crearBackup'))
check('Backup incluye socios',
  applyScript.includes("'socios'") || applyScript.includes('"socios"'))
check('Backup incluye creditos',
  applyScript.includes("'creditos'") || applyScript.includes('"creditos"'))
check('Backup va a backups/demo-data-fill/',
  applyScript.includes('backups/demo-data-fill'))

// ─── 4. Solo toca campos permitidos ──────────────────────────────────────────

console.log('\n🎯 4. Solo modifica campos permitidos:')
check("Actualiza socios.genero → 'M'",
  applyScript.includes("genero: 'M'"))
check("Actualiza socios.estado_civil → 'soltero'",
  applyScript.includes("estado_civil: 'soltero'"))
check("Actualiza creditos.subtipo_credito_sbs → 'por_confirmar'",
  applyScript.includes("subtipo_credito_sbs: 'por_confirmar'"))

// ─── 5. NO toca tablas prohibidas ────────────────────────────────────────────

console.log('\n🚫 5. NO toca tablas/campos prohibidos:')

check('NO toca pagos_recibos (no update en esa tabla)',
  !applyScript.includes(".from('pagos_recibos').update") &&
  !applyScript.includes('.from("pagos_recibos").update'))

check('NO toca cronograma_cuotas',
  !applyScript.includes(".from('cronograma_cuotas').update") &&
  !applyScript.includes('.from("cronograma_cuotas").update'))

check('NO toca usuarios',
  !applyScript.includes(".from('usuarios').update") &&
  !applyScript.includes('.from("usuarios").update'))

check('NO toca configuracion',
  !applyScript.includes(".from('configuracion').update") &&
  !applyScript.includes('.from("configuracion").update'))

check('NO toca auth.users (no código que acceda auth.users)',
  !applyScript.includes(".from('auth") && !applyScript.includes('.from("auth'))

check('NO toca _client_files (no código que acceda _client_files)',
  !applyScript.includes(".from('_client_files")  && !applyScript.includes('.from("_client_files'))

// ─── 6. NO modifica montos financieros ───────────────────────────────────────

console.log('\n💰 6. NO modifica montos financieros:')

const camposMonetarios = [
  'monto_aprobado', 'monto_girado_neto', 'saldo_capital',
  'cuota_mensual', 'monto_total', 'interes_acumulado',
  'capital', 'interes', 'cuota_total'
]
let tocaMontos = false
for (const campo of camposMonetarios) {
  if (applyScript.includes(`${campo}:`)) { tocaMontos = true; break }
}
check('NO modifica montos financieros', !tocaMontos)

// ─── 7. NO inventa DNI ───────────────────────────────────────────────────────

console.log('\n🪪 7. NO inventa DNI:')
check('NO asigna DNI a socios con placeholder',
  !applyScript.includes("dni: ") && !applyScript.includes("'dni'"))
check('Documenta DNI placeholder como pendiente',
  applyScript.includes('SINDNI') || applyScript.includes('placeholder'))

// ─── 8. NO convierte tipo_credito_sbs a código SBS ───────────────────────────

console.log('\n📌 8. NO convierte tipo_credito_sbs:')
check("NO asigna '004' u otro código numérico SBS a tipo_credito_sbs",
  !applyScript.includes("tipo_credito_sbs: '004'") &&
  !applyScript.includes('tipo_credito_sbs: "004"'))
check("NO actualiza tipo_credito_sbs (sin .update({tipo_credito_sbs:...}))",
  // subtipo_credito_sbs is allowed; only bare tipo_credito_sbs updates are forbidden
  !/ tipo_credito_sbs: ['"]/.test(applyScript) &&
  !/{tipo_credito_sbs: ['"]/.test(applyScript))

// ─── 9. Advertencia DATOS DEMO visible ───────────────────────────────────────

console.log('\n⚠️  9. Advertencia DATOS DEMO visible:')
check('Script contiene advertencia DATOS DE DEMOSTRACIÓN',
  applyScript.includes('DATOS DE DEMOSTRACIÓN') || applyScript.includes('DATOS DEMO'))
check('Script menciona NO OFICIALES',
  applyScript.includes('NO OFICIALES'))

// ─── Resumen ──────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════════════════════')
console.log(`  RESULTADO: ${pass} ✅  ${fail} ❌`)
console.log('══════════════════════════════════════════════════════════════════')

if (fail > 0) {
  console.log('\n  ❌ Check fallido — revisar script antes de ejecutar apply.')
  process.exit(1)
} else {
  console.log('\n  ✅ Script verificado — seguro para dry-run y apply con autorización.')
  if (!reporteExists) {
    console.log('\n  ⚠️  Para generar el reporte, ejecutar primero:')
    console.log('     npm run demo:reg-fields:dry-run')
  }
}
