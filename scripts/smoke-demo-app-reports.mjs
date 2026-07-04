/**
 * smoke-demo-app-reports.mjs
 * Fase 9C-6J-FUNC — Smoke test funcional: datos demo + reportes
 *
 * REGLAS: Solo lectura. No insert / No update / No delete.
 * No toca usuarios / configuracion / auth.users.
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

async function count(table, filter) {
  let q = sb.from(table).select('*', { count: 'exact', head: true })
  if (filter) q = filter(q)
  const { count, error } = await q
  if (error) throw new Error(`count ${table}: ${error.message}`)
  return count ?? 0
}

const SEP = '═'.repeat(56)
const checks = []
let passed = 0
let failed = 0

function check(label, ok, detail) {
  checks.push({ ok, label, detail })
  if (ok) { passed++; console.log(`  ✅ ${label}`) }
  else     { failed++; console.log(`  ❌ ${label}${detail ? ' — ' + detail : ''}`) }
}

function warn(label, detail) {
  console.log(`  ⚠️  ${label}${detail ? ' — ' + detail : ''}`)
}

console.log(`\n${SEP}`)
console.log('  SMOKE TEST — CEJUASSA DEMO APP (Fase 9C-6J-FUNC)')
console.log(`  ${new Date().toLocaleString('es-PE')}`)
console.log(SEP)

// ── A. Conteos base ──────────────────────────────────────────────────────────

console.log('\n📊 A. Conteos base esperados\n')

const nSocios     = await count('socios')
const nCreditos   = await count('creditos')
const nPagos      = await count('pagos_recibos')
const nAportes    = await count('aportes')
const nConvenios  = await count('convenios')
const nCronograma = await count('cronograma_cuotas')
const nEgresos    = await count('egresos')

check('socios = 782',              nSocios === 782,     `got ${nSocios}`)
check('creditos = 31',             nCreditos === 31,    `got ${nCreditos}`)
check('pagos_recibos = 832',       nPagos === 832,      `got ${nPagos}`)
check('aportes = 785',             nAportes === 785,    `got ${nAportes}`)
check('convenios = 8',             nConvenios === 8,    `got ${nConvenios}`)
check('cronograma_cuotas = 911',   nCronograma === 911, `got ${nCronograma}`)
if (nEgresos === 0) warn('egresos = 0 (esperado, sin datos aún)')

// ── B. Campos demo regulatorios ──────────────────────────────────────────────

console.log('\n📋 B. Campos demo regulatorios\n')

const sinGenero     = await count('socios', q => q.is('genero', null))
const sinEstCivil   = await count('socios', q => q.is('estado_civil', null))
const sinSubtipo    = await count('creditos', q => q.is('subtipo_credito_sbs', null))

check('socios sin genero NULL = 0',       sinGenero === 0,   `${sinGenero} sin genero`)
check('socios sin estado_civil NULL = 0', sinEstCivil === 0, `${sinEstCivil} sin estado_civil`)
check('creditos sin subtipo NULL = 0',    sinSubtipo === 0,  `${sinSubtipo} sin subtipo`)

// Verificar valores demo (no bloqueante, solo warning)
const { data: subtipos } = await sb.from('creditos')
  .select('subtipo_credito_sbs')
  .not('subtipo_credito_sbs', 'is', null)
const todosDemo = (subtipos ?? []).every(r => r.subtipo_credito_sbs === 'por_confirmar')
if (todosDemo) warn('subtipo_credito_sbs = "por_confirmar" en todos (DEMO — no oficial SBS)')

const { data: generos } = await sb.from('socios')
  .select('genero')
  .not('genero', 'is', null)
  .limit(5)
const generoDemo = (generos ?? []).every(r => r.genero === 'M')
if (generoDemo) warn('genero = "M" en muestra (DEMO — no oficial)')

// ── C. Créditos vigentes y cronograma ────────────────────────────────────────

console.log('\n💳 C. Créditos vigentes + cronograma\n')

const nVigentes  = await count('creditos', q => q.eq('estado', 'vigente'))
const nCancelados = await count('creditos', q => q.eq('estado', 'cancelado'))

check('creditos vigentes = 26', nVigentes === 26, `got ${nVigentes}`)
check('creditos cancelados = 5', nCancelados === 5, `got ${nCancelados}`)

// Verificar que los 26 vigentes tienen cronograma
const { data: vigentesData } = await sb.from('creditos')
  .select('id')
  .eq('estado', 'vigente')

const vigentesIds = (vigentesData ?? []).map(c => c.id)
let vigentesConCronograma = 0
if (vigentesIds.length > 0) {
  const { data: cuotaIds } = await sb.from('cronograma_cuotas')
    .select('id_credito')
    .in('id_credito', vigentesIds)

  const idSet = new Set((cuotaIds ?? []).map(r => r.id_credito))
  vigentesConCronograma = vigentesIds.filter(id => idSet.has(id)).length
}
check('26 vigentes con cronograma', vigentesConCronograma === 26, `${vigentesConCronograma}/26 tienen cronograma`)

// ── D. Anexo 6 — datos suficientes ──────────────────────────────────────────

console.log('\n📄 D. Anexo 6 — datos para generar reporte\n')

const { data: creditosAnexo6 } = await sb.from('creditos')
  .select('id, saldo_capital, tasa_interes, plazo_meses, fecha_desembolso, socios(dni, apellidos, nombres)')
  .eq('estado', 'vigente')

const filas6 = (creditosAnexo6 ?? [])
check('Anexo 6 tiene filas (>0)', filas6.length > 0, `${filas6.length} filas`)

const sinSaldo  = filas6.filter(c => c.saldo_capital == null || isNaN(c.saldo_capital)).length
const sinTasa   = filas6.filter(c => c.tasa_interes == null  || isNaN(c.tasa_interes)).length
const sinFecha  = filas6.filter(c => !c.fecha_desembolso).length
const sinSocio  = filas6.filter(c => !c.socios).length
check('Anexo 6: sin saldo_capital = 0',    sinSaldo === 0,  `${sinSaldo} con saldo NULL/NaN`)
check('Anexo 6: sin tasa_interes = 0',     sinTasa === 0,   `${sinTasa} con tasa NULL/NaN`)
check('Anexo 6: sin fecha_desembolso = 0', sinFecha === 0,  `${sinFecha} sin fecha`)
check('Anexo 6: sin socio vinculado = 0',  sinSocio === 0,  `${sinSocio} sin socio`)

// ── E. Reportes — datos de exportación ──────────────────────────────────────

console.log('\n📤 E. Datos para exportación de reportes\n')

const nPagosConMonto = await count('pagos_recibos', q => q.gt('monto_total', 0))
check('pagos_recibos con monto > 0 (exportador de caja)',
  nPagosConMonto > 0, `${nPagosConMonto} pagos con monto`)

const nAportesConMonto = await count('aportes', q => q.gt('monto', 0))
check('aportes con monto > 0 (reporte aportes)',
  nAportesConMonto > 0, `${nAportesConMonto} aportes con monto`)

const nPagosConCredito = await count('pagos_recibos', q => q.not('id_credito', 'is', null))
check('pagos vinculados a crédito >= 28',
  nPagosConCredito >= 28, `${nPagosConCredito} pagos vinculados`)

// Pagos NULL de id_credito (normal — informativo)
const nPagosNullCredito = await count('pagos_recibos', q => q.is('id_credito', null))
warn(`pagos_recibos.id_credito NULL = ${nPagosNullCredito} (esperado — no son créditos individualizados aún)`)

// ── F. BDCC — validaciones demo ──────────────────────────────────────────────

console.log('\n🏛️  F. BDCC — validaciones demo\n')

// Verificar que hay datos para BD01 (créditos vigentes con socio)
const { data: bd01Data } = await sb.from('creditos')
  .select('id, socios(dni)', { count: 'exact' })
  .eq('estado', 'vigente')

const bd01Filas = (bd01Data ?? []).filter(c => c.socios?.dni)
check('BD01 tiene filas con DNI (demo genereable)',
  bd01Filas.length > 0, `${bd01Filas.length} créditos con socio+DNI`)

// Verificar campos genero/estado_civil presentes (requeridos por BD01)
const sinGeneroBD01 = await count('socios', q => q.is('genero', null))
check('BD01: genero no NULL en socios = 0', sinGeneroBD01 === 0, `${sinGeneroBD01} sin genero`)

warn('BD01/BDCC = DEMO. subtipo_credito_sbs="por_confirmar". No enviar a SBS sin validación.')

// ── G. NaN/undefined en campos críticos de créditos ─────────────────────────

console.log('\n🔢 G. Integridad numérica en créditos\n')

const { data: creditoNums } = await sb.from('creditos')
  .select('id, monto_aprobado, saldo_capital, cuota_mensual, tasa_interes, plazo_meses')

const nums = creditoNums ?? []
const sinMonto    = nums.filter(c => c.monto_aprobado == null).length
const sinSaldoCap = nums.filter(c => c.saldo_capital  == null).length
const sinCuota    = nums.filter(c => c.cuota_mensual  == null).length
const sinTasaNum  = nums.filter(c => c.tasa_interes   == null).length
const sinPlazo    = nums.filter(c => c.plazo_meses    == null).length

check('creditos sin monto_aprobado NULL = 0',  sinMonto === 0,    `${sinMonto} NULL`)
check('creditos sin saldo_capital NULL = 0',   sinSaldoCap === 0, `${sinSaldoCap} NULL`)
check('creditos sin cuota_mensual NULL = 0',   sinCuota === 0,    `${sinCuota} NULL`)
check('creditos sin tasa_interes NULL = 0',    sinTasaNum === 0,  `${sinTasaNum} NULL`)
check('creditos sin plazo_meses NULL = 0',     sinPlazo === 0,    `${sinPlazo} NULL`)

// Verificar tasa en rango razonable (porcentaje, no decimal)
const tasaFueraRango = nums.filter(c => {
  const t = c.tasa_interes
  return t != null && (t < 1 || t > 100)
}).length
check('tasa_interes en rango 1–100 (porcentaje)',
  tasaFueraRango === 0, `${tasaFueraRango} créditos con tasa fuera de rango`)

// ── Resumen ──────────────────────────────────────────────────────────────────

console.log(`\n${SEP}`)
console.log('  RESUMEN')
console.log(SEP)
console.log(`  ✅ Pasaron  : ${passed}`)
console.log(`  ❌ Fallaron : ${failed}`)

if (failed > 0) {
  console.log('\n  Checks fallidos:')
  checks.filter(c => !c.ok).forEach(c => console.log(`    ✗ ${c.label}${c.detail ? ' — '+c.detail : ''}`))
}

console.log(SEP + '\n')

if (failed > 0) process.exit(1)
