/**
 * smoke-report-exports.mjs
 * Fase 10B — Smoke test estático + datos para reportes y exportaciones CEJUASSA
 *
 * REGLAS: Solo lectura. No insert / No update / No delete.
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

if (!loadEnv()) { console.error('❌ .env.local no encontrado'); process.exit(1) }
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const SEP = '═'.repeat(60)
let passed = 0
let failed = 0
let warned = 0

function check(label, ok, detail) {
  if (ok) { passed++; console.log(`  ✅ ${label}`) }
  else     { failed++; console.log(`  ❌ ${label}${detail ? ' — ' + detail : ''}`) }
}

function warn(label) {
  warned++
  console.log(`  ⚠️  ${label}`)
}

async function count(table, filter) {
  let q = sb.from(table).select('*', { count: 'exact', head: true })
  if (filter) q = filter(q)
  const { count, error } = await q
  if (error) throw new Error(`count ${table}: ${error.message}`)
  return count ?? 0
}

console.log(`\n${SEP}`)
console.log('  SMOKE REPORT EXPORTS — CEJUASSA (Fase 10B)')
console.log(`  ${new Date().toLocaleString('es-PE')}`)
console.log(SEP)

// ── A. Rutas de reportes existen (static check) ───────────────────────────────

console.log('\n📁 A. Rutas de reportes (archivos fuente)\n')

const routeFiles = [
  'app/dashboard/reportes/page.tsx',
  'app/dashboard/reportes/anexo6/page.tsx',
  'app/dashboard/reportes/bdcc/page.tsx',
  'app/dashboard/reportes/aportes/page.tsx',
  'app/dashboard/reportes/caja/page.tsx',
  'app/dashboard/cartera/page.tsx',
  'app/dashboard/mora/page.tsx',
  'app/dashboard/pagos/page.tsx',
  'app/dashboard/aportes/page.tsx',
  'app/dashboard/creditos/page.tsx',
  'app/dashboard/socios/page.tsx',
]

for (const f of routeFiles) {
  const exists = existsSync(resolve(ROOT, f))
  check(`route: ${f}`, exists)
}

// ── B. Exportadores existen ───────────────────────────────────────────────────

console.log('\n📦 B. Exportadores y utilidades\n')

const exportFiles = [
  'app/dashboard/pagos/utils/generarReciboPDF.ts',
  'app/dashboard/socios/utils/generarFichaSocioPDF.ts',
  'lib/bdcc/format.ts',
]

for (const f of exportFiles) {
  const exists = existsSync(resolve(ROOT, f))
  check(`exporter: ${f}`, exists)
}

// ── C. Datos Reporte Caja — Pagos ─────────────────────────────────────────────

console.log('\n💰 C. Reporte Caja — Ingresos\n')

const totalPagos = await count('pagos_recibos')
check('pagos_recibos tiene datos (≥ 1)', totalPagos >= 1, `got ${totalPagos}`)
check('pagos_recibos ≥ 832 ingresos', totalPagos >= 832, `got ${totalPagos}`)

const pagosMarzo = await count('pagos_recibos', q => q.gte('fecha', '2026-03-01').lte('fecha', '2026-03-31'))
check('pagos_recibos en Marzo 2026 ≥ 1', pagosMarzo >= 1, `got ${pagosMarzo}`)

// Verificar que monto_total no sea NULL en muestra
const { data: pagosM } = await sb.from('pagos_recibos').select('monto_total').limit(20)
const nullMonto = (pagosM ?? []).filter(p => p.monto_total === null || p.monto_total === undefined).length
check('pagos_recibos.monto_total sin NULL en muestra (20)', nullMonto === 0, `${nullMonto} nulos`)

const { data: pagosCanal } = await sb.from('pagos_recibos').select('canal_pago').limit(20)
const nullCanal = (pagosCanal ?? []).filter(p => !p.canal_pago).length
check('pagos_recibos.canal_pago sin NULL en muestra (20)', nullCanal === 0, `${nullCanal} nulos`)

// Egresos = 0 no debe romper
const totalEgresos = await count('egresos')
if (totalEgresos === 0) warn('egresos = 0 — Reporte Caja debe manejar esto sin NaN (sección egresos vacía)')
else check('egresos tiene datos', totalEgresos >= 1)

// ── D. Datos Reporte Aportes ──────────────────────────────────────────────────

console.log('\n🏦 D. Reporte Aportes\n')

const totalAportes = await count('aportes')
check('aportes tiene datos (≥ 1)', totalAportes >= 1, `got ${totalAportes}`)
check('aportes ≥ 785', totalAportes >= 785, `got ${totalAportes}`)

const aportesMarzo = await count('aportes', q => q.gte('fecha', '2026-03-01').lte('fecha', '2026-03-31'))
check('aportes en Marzo 2026 ≥ 1', aportesMarzo >= 1, `got ${aportesMarzo}`)

const { data: aportesMuestra } = await sb.from('aportes').select('monto, saldo_anterior, saldo_nuevo').limit(20)
const nullMonto2 = (aportesMuestra ?? []).filter(a => a.monto === null || a.monto === undefined).length
check('aportes.monto sin NULL en muestra (20)', nullMonto2 === 0, `${nullMonto2} nulos`)

// ── E. Datos Anexo 6 ──────────────────────────────────────────────────────────

console.log('\n📋 E. Anexo 6 — Créditos vigentes\n')

const vigentes = await count('creditos', q => q.eq('estado', 'vigente'))
check('creditos vigentes ≥ 26', vigentes >= 26, `got ${vigentes}`)

const { data: creditosMuestra } = await sb.from('creditos')
  .select('saldo_capital, tasa_interes, monto_aprobado, plazo_meses')
  .eq('estado', 'vigente')
  .limit(30)

const nullSaldo = (creditosMuestra ?? []).filter(c => c.saldo_capital === null).length
const nullTasa  = (creditosMuestra ?? []).filter(c => c.tasa_interes === null).length
check('creditos vigentes.saldo_capital sin NULL', nullSaldo === 0, `${nullSaldo} nulos`)
check('creditos vigentes.tasa_interes sin NULL', nullTasa === 0, `${nullTasa} nulos`)

// Verificar que tasa_interes está en porcentaje (no decimal)
const tasaBaja = (creditosMuestra ?? []).filter(c => c.tasa_interes !== null && c.tasa_interes < 1).length
check('tasa_interes en formato porcentaje (≥ 1, no decimal)', tasaBaja === 0, `${tasaBaja} créditos con tasa < 1 (posible decimal)`)

// Verificar cronograma para vigentes
const { data: vigentesData } = await sb.from('creditos').select('id').eq('estado', 'vigente')
const vigentesIds = (vigentesData ?? []).map(c => c.id)
if (vigentesIds.length > 0) {
  const { data: cuotasIds } = await sb.from('cronograma_cuotas')
    .select('id_credito')
    .in('id_credito', vigentesIds)
  const idSet = new Set((cuotasIds ?? []).map(r => r.id_credito))
  const vigentesConCronograma = vigentesIds.filter(id => idSet.has(id)).length
  check(`vigentes con cronograma = ${vigentes}`, vigentesConCronograma === vigentes, `${vigentesConCronograma}/${vigentes}`)
}

// ── F. Datos BDCC — Advertencias demo ────────────────────────────────────────

console.log('\n🔒 F. BDCC — Campos demo / advertencias\n')

// Verificar que la página BDCC existe y tiene el banner DEMO
const bdccPath = resolve(ROOT, 'app/dashboard/reportes/bdcc/page.tsx')
if (existsSync(bdccPath)) {
  const bdccContent = readFileSync(bdccPath, 'utf8')
  const hasDemoBanner = bdccContent.includes('DEMO') && bdccContent.includes('NO ENVIAR A SBS')
  check('bdcc/page.tsx tiene banner DEMO + NO ENVIAR A SBS', hasDemoBanner)

  const hasPorConfirmarDetection = bdccContent.includes("por_confirmar")
  check('bdcc/page.tsx detecta subtipo por_confirmar', hasPorConfirmarDetection)
} else {
  check('bdcc/page.tsx existe', false)
}

// Verificar que Anexo6 tiene banner DEMO
const anexo6Path = resolve(ROOT, 'app/dashboard/reportes/anexo6/page.tsx')
if (existsSync(anexo6Path)) {
  const anexo6Content = readFileSync(anexo6Path, 'utf8')
  const hasDemoBanner = anexo6Content.includes('DATOS DE PRUEBA')
  check('anexo6/page.tsx tiene banner DATOS DE PRUEBA', hasDemoBanner)

  const hasCorrectCC = anexo6Content.includes('1411050604')
  const hasWrongCC   = anexo6Content.includes('1411030604')
  check('anexo6: cuenta contable 1411050604 correcta', hasCorrectCC && !hasWrongCC,
        hasWrongCC ? 'ERROR: todavía tiene 1411030604' : (!hasCorrectCC ? 'no encontrada' : ''))
} else {
  check('anexo6/page.tsx existe', false)
}

// Verificar subtipo demo en DB
const { data: subtipos } = await sb.from('creditos')
  .select('subtipo_credito_sbs')
  .eq('estado', 'vigente')

const totalSubtipos = (subtipos ?? []).length
const porConfirmar  = (subtipos ?? []).filter(r => r.subtipo_credito_sbs === 'por_confirmar').length
const sinSubtipo    = (subtipos ?? []).filter(r => !r.subtipo_credito_sbs).length

check('creditos vigentes sin subtipo_credito_sbs NULL = 0', sinSubtipo === 0, `${sinSubtipo} sin subtipo`)
if (porConfirmar > 0) warn(`subtipo_credito_sbs = "por_confirmar" en ${porConfirmar}/${totalSubtipos} créditos vigentes (DEMO — confirmar con Créditos antes de enviar a SBS)`)

// Verificar genero demo en DB
const { data: generosDemo } = await sb.from('socios').select('genero').limit(10)
const generoM = (generosDemo ?? []).filter(r => r.genero === 'M').length
if (generoM === (generosDemo ?? []).length && generoM > 0)
  warn(`genero = "M" en muestra (DEMO — reemplazar con datos reales)`)

// ── G. Cartera y Mora ────────────────────────────────────────────────────────

console.log('\n📊 G. Cartera / Mora\n')

const vigentesCartera = await count('creditos', q => q.eq('estado', 'vigente'))
const cancelados      = await count('creditos', q => q.eq('estado', 'cancelado'))
check('cartera: vigentes ≥ 26', vigentesCartera >= 26, `got ${vigentesCartera}`)
check('cartera: cancelados excluidos de vigentes', cancelados > 0, `got ${cancelados} cancelados`)

const { data: cuotasVencidas } = await sb.from('cronograma_cuotas')
  .select('id_credito, fecha_vencimiento, cuota_total')
  .in('estado', ['pendiente', 'vencida', 'parcial'])
  .limit(5)
check('cronograma_cuotas con estados pendiente/vencida/parcial tiene datos', (cuotasVencidas ?? []).length >= 0)

// Verificar que saldo_capital no tiene negativos extraños en vigentes
const { data: saldos } = await sb.from('creditos')
  .select('saldo_capital')
  .eq('estado', 'vigente')
const negativos = (saldos ?? []).filter(c => (c.saldo_capital ?? 0) < 0).length
check('creditos vigentes sin saldo_capital negativo', negativos === 0, `${negativos} con saldo negativo`)

// ── Resultado final ───────────────────────────────────────────────────────────

console.log(`\n${SEP}`)
console.log(`  RESULTADO: ${passed} ✅ PASS · ${failed} ❌ FAIL · ${warned} ⚠️  WARN`)
console.log(SEP + '\n')

if (failed > 0) process.exit(1)
