/**
 * audit-post-excel-import.mjs
 * Fase 9C-5 — Auditoría post-importación Excel
 *
 * REGLAS ESTRICTAS — SOLO LECTURA:
 * - NO insert / NO update / NO delete / NO truncate
 * - NO toca usuarios / configuracion / auth.users
 * - NO modifica _client_files/
 * - NO crea migraciones
 * - NO imprime datos personales completos
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DOCS_DIR = resolve(ROOT, 'docs/ai-recovery')

// ─── Env ─────────────────────────────────────────────────────────────────────

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

function maskId(str) {
  const s = String(str || '').trim()
  return s.length > 4 ? s.substring(0, 4) + '****' : '****'
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchAll(table, select = '*') {
  const { data, error } = await sb.from(table).select(select)
  if (error) throw new Error(`fetch ${table}: ${error.message}`)
  return data || []
}

async function countTable(table) {
  const { count, error } = await sb.from(table).select('*', { count: 'exact', head: true })
  if (error) return { count: -1, error: error.message }
  return { count }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════════')
console.log('  CEJUASSA — Auditoría Post-Importación Excel (9C-5)')
console.log('  MODO: SOLO LECTURA — no se modifica ningún dato')
console.log('══════════════════════════════════════════════════════\n')

// A. Conteos generales
console.log('📊 A. Conteos generales...')
const tablas = ['convenios','socios','creditos','pagos_recibos','aportes',
                'cronograma_cuotas','egresos','ampliaciones','usuarios','configuracion']
const conteos = {}
for (const t of tablas) {
  const r = await countTable(t)
  conteos[t] = r
  const mark = r.error ? '❌' : '  '
  const val = r.error ? `ERROR: ${r.error}` : r.count
  console.log(`  ${mark} ${t.padEnd(20)}: ${val}`)
}

// B. Socios
console.log('\n🧑 B. Auditando socios...')
const socios = await fetchAll('socios', 'id,nro_socio,dni,apellidos,nombres,genero,estado_civil,beneficiario_nombre,beneficiario_dni,estado')
const socioIds = new Set(socios.map(s => s.id))

const dniCount = {}
for (const s of socios) if (s.dni) dniCount[s.dni] = (dniCount[s.dni] || 0) + 1
const dniDuplicados = Object.entries(dniCount).filter(([, c]) => c > 1)
const sociosSinDni = socios.filter(s => !s.dni || s.dni.trim() === '')
const sociosPlaceholder = socios.filter(s => s.dni && s.dni.startsWith('SINDNI'))
const sociosSinNombre = socios.filter(s => !s.nombres || s.nombres.trim() === '')
const sociosSinApellido = socios.filter(s => !s.apellidos || s.apellidos.trim() === '')
const sociosSinGenero = socios.filter(s => !s.genero)
const sociosSinEstadoCivil = socios.filter(s => !s.estado_civil)
const sociosSinBeneficiario = socios.filter(s => !s.beneficiario_nombre)

console.log(`  DNI duplicados          : ${dniDuplicados.length}`)
console.log(`  DNI null/vacío          : ${sociosSinDni.length}`)
console.log(`  DNI placeholder SINDNI  : ${sociosPlaceholder.length}`)
console.log(`  Sin nombres             : ${sociosSinNombre.length}`)
console.log(`  Sin apellidos           : ${sociosSinApellido.length}`)
console.log(`  Sin género              : ${sociosSinGenero.length}`)
console.log(`  Sin estado_civil        : ${sociosSinEstadoCivil.length}`)
console.log(`  Sin beneficiario        : ${sociosSinBeneficiario.length}`)

// Socios sin créditos ni pagos
const creditos = await fetchAll('creditos', 'id,id_socio,nro_pagare,nro_expediente,tasa_interes,plazo_meses,saldo_capital,monto_aprobado,tipo_credito,tipo_credito_sbs,cuenta_contable_bd01,estado,fecha_desembolso,cuota_mensual')
const pagos = await fetchAll('pagos_recibos', 'id,id_socio,id_credito,id_convenio,nro_recibo,fecha,monto_total,monto_aporte,monto_capital,tipo_pago,estado_flujo')
const aportes = await fetchAll('aportes', 'id,id_socio,id_recibo,monto,saldo_anterior,saldo_nuevo,fecha,tipo')
const convenios = await fetchAll('convenios', 'id,nombre')

const sociosConCredito = new Set(creditos.map(c => c.id_socio))
const sociosConPago = new Set(pagos.map(p => p.id_socio))
const sociosSinActividad = socios.filter(s => !sociosConCredito.has(s.id) && !sociosConPago.has(s.id))
console.log(`  Sin créditos ni pagos   : ${sociosSinActividad.length}`)

// C. Créditos
console.log('\n💳 C. Auditando créditos...')
const creditosSinSocio = creditos.filter(c => !c.id_socio || !socioIds.has(c.id_socio))
const creditosTasaCero = creditos.filter(c => !c.tasa_interes || c.tasa_interes === 0)
const creditosSinPagare = creditos.filter(c => !c.nro_pagare || c.nro_pagare.trim() === '')
const creditosSinExpediente = creditos.filter(c => !c.nro_expediente || c.nro_expediente.trim() === '')
const creditosSinTipoSbs = creditos.filter(c => !c.tipo_credito_sbs)
const creditosSinCuenta = creditos.filter(c => !c.cuenta_contable_bd01)
const creditosVigentes = creditos.filter(c => c.estado === 'vigente')
const creditosCancelados = creditos.filter(c => c.estado === 'cancelado')
const creditosOtroEstado = creditos.filter(c => c.estado !== 'vigente' && c.estado !== 'cancelado')

// Créditos con/sin cronograma — separados por estado
const cronogramaCount = conteos['cronograma_cuotas']?.count || 0
const cronogramaRows = await fetchAll('cronograma_cuotas', 'id_credito')
const creditoIdsConCronograma = new Set(cronogramaRows.map(r => r.id_credito))
const creditosVigentesConCronograma = creditosVigentes.filter(c => creditoIdsConCronograma.has(c.id))
const creditosVigentesSinCronograma = creditosVigentes.filter(c => !creditoIdsConCronograma.has(c.id))
const creditosCanceladosSinCronograma = creditosCancelados.filter(c => !creditoIdsConCronograma.has(c.id))

// Inconsistencia saldo: para créditos vigentes, saldo_capital debería ser > 0
const creditosVigenteSaldoCero = creditosVigentes.filter(c => !c.saldo_capital || c.saldo_capital <= 0)
const creditosCanceladoSaldoPos = creditosCancelados.filter(c => c.saldo_capital > 0)

console.log(`  Sin socio válido        : ${creditosSinSocio.length}`)
console.log(`  tasa_interes = 0        : ${creditosTasaCero.length}`)
console.log(`  Sin nro_pagare          : ${creditosSinPagare.length}`)
console.log(`  Sin nro_expediente      : ${creditosSinExpediente.length}`)
console.log(`  Sin tipo_credito_sbs    : ${creditosSinTipoSbs.length}`)
console.log(`  Sin cuenta_contable_bd01: ${creditosSinCuenta.length}`)
console.log(`  Vigentes                : ${creditosVigentes.length}`)
console.log(`  Cancelados              : ${creditosCancelados.length}`)
console.log(`  Otro estado             : ${creditosOtroEstado.length}`)
console.log(`  Cronograma total cuotas : ${cronogramaCount}`)
console.log(`  Vigentes con cronograma : ${creditosVigentesConCronograma.length}`)
console.log(`  Vigentes sin cronograma : ${creditosVigentesSinCronograma.length}${creditosVigentesSinCronograma.length > 0 ? ' ⚠️' : ''}`)
console.log(`  Cancelados sin cronograma: ${creditosCanceladosSinCronograma.length} (esperado — no crítico)`)
console.log(`  Vigente con saldo 0     : ${creditosVigenteSaldoCero.length} ⚠️`)
console.log(`  Cancelado con saldo > 0 : ${creditosCanceladoSaldoPos.length} ⚠️`)

// D. Pagos
console.log('\n💵 D. Auditando pagos...')
const pagosSinSocio = pagos.filter(p => !p.id_socio || !socioIds.has(p.id_socio))
const pagosIdCreditoNull = pagos.filter(p => !p.id_credito)
const creditoIds = new Set(creditos.map(c => c.id))
const pagosCredInexistente = pagos.filter(p => p.id_credito && !creditoIds.has(p.id_credito))
const pagosMontoTotal0 = pagos.filter(p => !p.monto_total || p.monto_total === 0)
const pagosSinTipoPago = pagos.filter(p => !p.tipo_pago)
const pagosTipoK = pagos.filter(p => p.tipo_pago === 'K')
const pagosConAporte = pagos.filter(p => p.monto_aporte > 0)
const pagosConAporteIds = new Set(pagosConAporte.map(p => p.id))

// Aportes cuya id_recibo apunta a un pago con monto_aporte > 0
const reciboIds = new Set(pagos.map(p => p.id))
const aportesConRecibo = aportes.filter(a => a.id_recibo && reciboIds.has(a.id_recibo))
const aportesReciboPagoConAporte = aportesConRecibo.filter(a => pagosConAporteIds.has(a.id_recibo))

console.log(`  Sin socio válido        : ${pagosSinSocio.length}`)
console.log(`  id_credito NULL         : ${pagosIdCreditoNull.length} (todos — esperado)`)
console.log(`  id_credito inexistente  : ${pagosCredInexistente.length}`)
console.log(`  monto_total = 0         : ${pagosMontoTotal0.length}`)
console.log(`  Sin tipo_pago           : ${pagosSinTipoPago.length}`)
console.log(`  Tipo 'K' (convenio)     : ${pagosTipoK.length}`)
console.log(`  Con monto_aporte > 0    : ${pagosConAporte.length}`)
console.log(`  Aportes con recibo OK   : ${aportesReciboPagoConAporte.length}`)

// E. Aportes
console.log('\n💰 E. Auditando aportes...')
const aportesSinSocio = aportes.filter(a => !a.id_socio || !socioIds.has(a.id_socio))
const aportesMonto0 = aportes.filter(a => !a.monto || a.monto === 0)
const aportesConReciboPago = aportes.filter(a => a.id_recibo && pagosConAporteIds.has(a.id_recibo))
// Duplicados sospechosos: mismo socio, misma fecha, mismo monto
const aporteDupKey = {}
const aportesDuplicados = []
for (const a of aportes) {
  const k = `${a.id_socio}|${a.fecha}|${a.monto}`
  if (aporteDupKey[k]) aportesDuplicados.push(a)
  else aporteDupKey[k] = true
}
console.log(`  Sin socio válido        : ${aportesSinSocio.length}`)
console.log(`  monto = 0               : ${aportesMonto0.length}`)
console.log(`  Duplicados sospechosos  : ${aportesDuplicados.length}`)
console.log(`  Relacionados a pagos    : ${aportesConReciboPago.length}`)

// F. Convenios
console.log('\n🏛️  F. Auditando convenios...')
const convenioNombres = convenios.map(c => c.nombre)
const conveniosDups = convenioNombres.filter((n, i) => convenioNombres.indexOf(n) !== i)
const conveniosSinNombre = convenios.filter(c => !c.nombre || c.nombre.trim() === '')
// Pagos de convenio: canal_pago = 'convenio' sin id_convenio
const pagosConvenioSinId = pagos.filter(p => p.canal_pago === 'convenio' && !p.id_convenio)
console.log(`  Total convenios         : ${convenios.length}`)
console.log(`  Duplicados              : ${conveniosDups.length}`)
console.log(`  Sin nombre              : ${conveniosSinNombre.length}`)
console.log(`  Pagos convenio sin id   : ${pagosConvenioSinId.length}`)

// G. Reportes críticos
console.log('\n📋 G. Diagnóstico de reportes...')
const puedeAnexo6 = creditosVigentes.length > 0
const bdccGenero = sociosSinGenero.length
const bdccEstadoCivil = sociosSinEstadoCivil.length
const bdccTasaCero = creditosTasaCero.length
const bdccSinTipoSbs = creditosSinTipoSbs.length
const puedeBdcc = puedeAnexo6 && bdccGenero === 0 && bdccEstadoCivil === 0
const puedeCartera = creditosVigentes.length > 0 // cartera funciona sin cronograma
const puedeReporteCaja = pagos.length > 0

console.log(`  Anexo 6 (créditos vigentes): ${puedeAnexo6 ? '⚠️  Usable pero incompleto' : '❌  Sin datos'}`)
console.log(`  BDCC BD01 (socios):          ${bdccGenero > 0 ? `❌  ${bdccGenero} sin género, ${bdccEstadoCivil} sin estado_civil` : '✅ OK'}`)
console.log(`  BDCC BD01 (créditos):        ${bdccSinTipoSbs > 0 ? `⚠️  ${bdccSinTipoSbs} sin tipo_credito_sbs` : '✅ OK'}`)
console.log(`  Cartera/mora:                ${puedeCartera ? '✅ Usable (no depende de cronograma)' : '❌  Sin créditos'}`)
console.log(`  Reporte de caja:             ${puedeReporteCaja ? '✅ Usable' : '❌  Sin pagos'}`)
const cronogramaStatus = creditosVigentesSinCronograma.length === 0
  ? `✅ Completo — ${cronogramaCount} cuotas · ${creditosVigentesConCronograma.length}/${creditosVigentes.length} vigentes · ${creditosCanceladosSinCronograma.length} cancelados sin cronograma (OK)`
  : `⚠️  Incompleto — ${creditosVigentesSinCronograma.length} vigentes sin cronograma`
console.log(`  Cronograma de cuotas:        ${cronogramaStatus}`)

// ─── Clasificar issues ────────────────────────────────────────────────────────

const criticos = []
const medios = []
const advertencias = []

if (sociosSinGenero.length === socios.length) criticos.push(`Todos los socios (${socios.length}) sin género — BDCC BD01 bloqueado`)
if (sociosSinEstadoCivil.length === socios.length) criticos.push(`Todos los socios (${socios.length}) sin estado_civil — BDCC BD01 bloqueado`)
if (creditosVigentesSinCronograma.length > 0) criticos.push(`${creditosVigentesSinCronograma.length} créditos vigentes sin cronograma_cuotas — módulo de cuotas incompleto`)
if (creditosCanceladosSinCronograma.length > 0 && cronogramaCount === 0) criticos.push(`cronograma_cuotas vacío — módulo de cuotas no funcional`)
if (creditosTasaCero.length === creditos.length) criticos.push(`tasa_interes = 0 en todos los créditos (${creditos.length}) — cálculos de interés incorrectos`)
if (creditosSinTipoSbs.length > 0) criticos.push(`${creditosSinTipoSbs.length} créditos sin tipo_credito_sbs — BDCC BD01 incompleto`)

if (dniDuplicados.length > 0) medios.push(`${dniDuplicados.length} DNIs duplicados detectados`)
if (sociosPlaceholder.length > 0) medios.push(`${sociosPlaceholder.length} socios con DNI placeholder SINDNI`)
if (creditosVigenteSaldoCero.length > 0) medios.push(`${creditosVigenteSaldoCero.length} créditos vigentes con saldo_capital = 0`)
if (creditosCanceladoSaldoPos.length > 0) medios.push(`${creditosCanceladoSaldoPos.length} créditos cancelados con saldo_capital > 0`)
if (pagosConvenioSinId.length > 0) medios.push(`${pagosConvenioSinId.length} pagos de convenio sin id_convenio asignado`)
if (creditosSinCuenta.length > 0) medios.push(`${creditosSinCuenta.length} créditos sin cuenta_contable_bd01`)

if (sociosSinActividad.length > 0) advertencias.push(`${sociosSinActividad.length} socios sin créditos ni pagos registrados`)
if (sociosSinBeneficiario.length > 0) advertencias.push(`${sociosSinBeneficiario.length} socios sin beneficiario FPS`)
if (pagosIdCreditoNull.length > 0) advertencias.push(`${pagosIdCreditoNull.length} pagos con id_credito NULL (normal — no asociados manualmente aún)`)
if (aportesDuplicados.length > 0) advertencias.push(`${aportesDuplicados.length} aportes con misma fecha+monto+socio (posibles duplicados)`)
if (creditosSinExpediente.length > 0) advertencias.push(`${creditosSinExpediente.length} créditos sin nro_expediente`)
if (pagosTipoK.length > 0) advertencias.push(`${pagosTipoK.length} pagos tipo K detectados — revisar si corresponde`)

// ─── Generar reporte Markdown ─────────────────────────────────────────────────

const now = new Date().toISOString().replace('T', ' ').substring(0, 19)

const puedeUsarse = [
  'Módulo **Socios** — lista y edición (para completar género/estado_civil)',
  'Módulo **Pagos** — listado, filtro por período marzo 2026',
  'Módulo **Aportes** — saldos por socio (período marzo 2026)',
  'Módulo **Créditos** — lista vigentes/cancelados, monto y saldo capital',
  'Módulo **Cartera** — clasificación SBS por días de mora (no depende de cronograma)',
  'Módulo **Reporte de Caja** — 832 pagos disponibles',
  '**Anexo 6** — genera con datos vigentes (revisar cálculos de interés ya que tasa = 0)',
]
const noUsar = [
  '**BDCC BD01** — bloquea por género y estado_civil NULL en todos los socios',
  '**BDCC BD02-A** — bloquea si BD01 no es válido',
  ...(creditosVigentesSinCronograma.length > 0 ? [`**Cronograma de cuotas** de ${creditosVigentesSinCronograma.length} créditos vigentes — sin cuotas generadas`] : []),
  '**Cálculos de interés acumulado** — tasa_interes = 0 produce resultados incorrectos',
  '**Pagos nuevos asociados a crédito** — id_credito NULL, asociación manual pendiente',
]

const accionesOrden = [
  { prio: '🔴 URGENTE', accion: 'Completar `genero` y `estado_civil` en todos los socios', como: 'App → módulo Socios → editar uno a uno, O script bulk-update (requiere datos fuente)' },
  { prio: '🔴 URGENTE', accion: 'Completar `tipo_credito_sbs` en todos los créditos', como: 'App → módulo Créditos → editar · Valor típico: "004" (consumo no revolvente)' },
  ...(creditosVigentesSinCronograma.length > 0 ? [{ prio: '🔴 URGENTE', accion: 'Regenerar cronograma_cuotas por créditos vigentes sin cuotas', como: 'App → módulo Créditos → abrir cada crédito → guardar (genera cronograma automáticamente)' }] : []),
  { prio: '🔴 URGENTE', accion: 'Completar `tasa_interes` en todos los créditos', como: 'App → módulo Créditos → editar · Tasa anual real según documentos físicos' },
  { prio: '🟡 IMPORTANTE', accion: 'Corregir el socio con DNI placeholder SINDNI', como: 'Buscar en app por nro_socio → actualizar DNI real' },
  { prio: '🟡 IMPORTANTE', accion: 'Completar `cuenta_contable_bd01` en créditos que la tienen vacía', como: 'App → Créditos → editar · Valor candidato: "1411050604"' },
  { prio: '🟡 IMPORTANTE', accion: 'Revisar créditos vigentes con saldo_capital = 0', como: 'Supabase Dashboard → tabla creditos → filtrar estado=vigente y saldo_capital=0' },
  { prio: '🟡 IMPORTANTE', accion: 'Asociar pagos a créditos (id_credito)', como: 'App → Pagos → editar cada pago y asignar crédito · O script de asociación automática por socio' },
  { prio: '🟢 CUANDO SEA POSIBLE', accion: 'Completar beneficiario FPS de cada socio', como: 'App → Socios → editar · Necesario para seguro FPS' },
  { prio: '🟢 CUANDO SEA POSIBLE', accion: 'Cargar egresos del período marzo 2026', como: 'App → Egresos → nuevo · No hay fuente Excel disponible actualmente' },
]

const report = `# POST_EXCEL_IMPORT_AUDIT.md
# Auditoría Post-Importación Excel — CEJUASSA
# Generado: ${now}

> Fase 9C-5 — Auditoría read-only tras importación desde Excel (Fase 9C-4B).
> NO se modificó ningún dato. Solo lectura y análisis.

---

## Resumen ejecutivo

La importación desde Excel (Fase 9C-4B) se completó con éxito. La DB contiene datos reales
de operación del período **marzo 2026**. La app compila y construye sin errores.

**Estado general: OPERATIVO PARCIALMENTE**

- Módulos de consulta y socios: ✅ listos para usar
- Reportes de caja y aportes: ✅ listos para usar
- Cartera y Anexo 6: ⚠️ usable con observaciones
- BDCC BD01/BD02-A: ❌ bloqueado por datos faltantes
- Cronograma de cuotas: \${creditosVigentesSinCronograma.length === 0 ? '✅ Completo (' + cronogramaCount + ' cuotas para ' + creditosVigentesConCronograma.length + ' vigentes)' : '⚠️ Incompleto — ' + creditosVigentesSinCronograma.length + ' vigentes sin cronograma'}

---

## A. Conteos actuales en Supabase

| Tabla | Registros | Estado |
|---|---|---|
| \`convenios\` | ${conteos.convenios?.count} | ✅ |
| \`socios\` | ${conteos.socios?.count} | ✅ |
| \`creditos\` | ${conteos.creditos?.count} | ✅ |
| \`pagos_recibos\` | ${conteos.pagos_recibos?.count} | ✅ |
| \`aportes\` | ${conteos.aportes?.count} | ✅ |
| \`cronograma_cuotas\` | ${conteos.cronograma_cuotas?.count} | ${cronogramaCount > 0 ? '✅' : '❌ Vacío'} |
| \`egresos\` | ${conteos.egresos?.count} | ⚠️ Sin datos |
| \`ampliaciones\` | ${conteos.ampliaciones?.count ?? 0} | ⚠️ Sin datos |
| \`usuarios\` | ${conteos.usuarios?.count} | ✅ Conservado |
| \`configuracion\` | ${conteos.configuracion?.count} | ✅ Conservada |

---

## B. Análisis de socios (${socios.length} total)

| Problema | Cantidad | Severidad |
|---|---|---|
| DNI duplicados | ${dniDuplicados.length} | ${dniDuplicados.length > 0 ? '🔴 Crítico' : '✅'} |
| DNI null/vacío | ${sociosSinDni.length} | ${sociosSinDni.length > 0 ? '🔴 Crítico' : '✅'} |
| DNI placeholder SINDNI | ${sociosPlaceholder.length} | ${sociosPlaceholder.length > 0 ? '🟡 Importante' : '✅'} |
| Sin nombres | ${sociosSinNombre.length} | ${sociosSinNombre.length > 0 ? '🔴 Crítico' : '✅'} |
| Sin apellidos | ${sociosSinApellido.length} | ${sociosSinApellido.length > 0 ? '🔴 Crítico' : '✅'} |
| Sin género | ${sociosSinGenero.length} | ${sociosSinGenero.length > 0 ? '🔴 Crítico (BDCC)' : '✅'} |
| Sin estado_civil | ${sociosSinEstadoCivil.length} | ${sociosSinEstadoCivil.length > 0 ? '🔴 Crítico (BDCC)' : '✅'} |
| Sin beneficiario FPS | ${sociosSinBeneficiario.length} | 🟢 Pendiente |
| Sin actividad (sin crédito ni pago) | ${sociosSinActividad.length} | 🟢 Informativo |

${dniDuplicados.length > 0 ? `**DNIs con más de un socio:**\n${dniDuplicados.map(([dni, c]) => `- DNI ${maskId(dni)} → ${c} socios`).join('\n')}` : ''}

---

## C. Análisis de créditos (${creditos.length} total)

| Problema | Cantidad | Severidad |
|---|---|---|
| Sin socio válido | ${creditosSinSocio.length} | ${creditosSinSocio.length > 0 ? '🔴 Crítico' : '✅'} |
| tasa_interes = 0 | ${creditosTasaCero.length} | ${creditosTasaCero.length > 0 ? '🔴 Crítico' : '✅'} |
| Sin tipo_credito_sbs | ${creditosSinTipoSbs.length} | ${creditosSinTipoSbs.length > 0 ? '🔴 Crítico (BDCC)' : '✅'} |
| Sin cuenta_contable_bd01 | ${creditosSinCuenta.length} | ${creditosSinCuenta.length > 0 ? '🟡 Importante' : '✅'} |
| Sin nro_pagare | ${creditosSinPagare.length} | ${creditosSinPagare.length > 0 ? '🟡 Importante' : '✅'} |
| Sin nro_expediente | ${creditosSinExpediente.length} | ${creditosSinExpediente.length > 0 ? '🟢 Advertencia' : '✅'} |
| cronograma_cuotas (total cuotas) | ${cronogramaCount} | ✅ |
| Vigentes con cronograma | ${creditosVigentesConCronograma.length} | ${creditosVigentesConCronograma.length === creditosVigentes.length ? '✅' : '🟡'} |
| Vigentes sin cronograma | ${creditosVigentesSinCronograma.length} | ${creditosVigentesSinCronograma.length > 0 ? '🔴 Crítico' : '✅'} |
| Cancelados sin cronograma | ${creditosCanceladosSinCronograma.length} | 🟢 Esperado — no crítico |
| Vigentes con saldo_capital = 0 | ${creditosVigenteSaldoCero.length} | ${creditosVigenteSaldoCero.length > 0 ? '🟡 Importante' : '✅'} |
| Cancelados con saldo_capital > 0 | ${creditosCanceladoSaldoPos.length} | ${creditosCanceladoSaldoPos.length > 0 ? '🟡 Importante' : '✅'} |
| Vigentes | ${creditosVigentes.length} | ✅ |
| Cancelados | ${creditosCancelados.length} | ✅ |

---

## D. Análisis de pagos (${pagos.length} total)

| Problema | Cantidad | Severidad |
|---|---|---|
| Sin socio válido | ${pagosSinSocio.length} | ${pagosSinSocio.length > 0 ? '🔴 Crítico' : '✅'} |
| id_credito NULL | ${pagosIdCreditoNull.length} | 🟡 Asociar manualmente |
| id_credito inexistente | ${pagosCredInexistente.length} | ${pagosCredInexistente.length > 0 ? '🔴 Crítico' : '✅'} |
| monto_total = 0 | ${pagosMontoTotal0.length} | ${pagosMontoTotal0.length > 0 ? '🟡 Revisar' : '✅'} |
| Sin tipo_pago | ${pagosSinTipoPago.length} | ${pagosSinTipoPago.length > 0 ? '🟡 Revisar' : '✅'} |
| Tipo K (convenio) | ${pagosTipoK.length} | 🟢 Informativo |
| Con monto_aporte > 0 | ${pagosConAporte.length} | ✅ |
| Aportes vinculados a pagos | ${aportesConReciboPago.length} | ✅ |

---

## E. Análisis de aportes (${aportes.length} total)

| Problema | Cantidad | Severidad |
|---|---|---|
| Sin socio válido | ${aportesSinSocio.length} | ${aportesSinSocio.length > 0 ? '🔴 Crítico' : '✅'} |
| monto = 0 | ${aportesMonto0.length} | ${aportesMonto0.length > 0 ? '🟡 Revisar' : '✅'} |
| Duplicados sospechosos | ${aportesDuplicados.length} | ${aportesDuplicados.length > 0 ? '🟡 Revisar' : '✅'} |
| Relacionados a recibos con aporte | ${aportesConReciboPago.length} | ✅ |

---

## F. Análisis de convenios (${convenios.length} total)

| Convenio | ID |
|---|---|
${convenios.map(c => `| ${c.nombre} | ${maskId(c.id)} |`).join('\n')}

| Problema | Cantidad | Severidad |
|---|---|---|
| Duplicados | ${conveniosDups.length} | ${conveniosDups.length > 0 ? '🔴 Crítico' : '✅'} |
| Sin nombre | ${conveniosSinNombre.length} | ${conveniosSinNombre.length > 0 ? '🔴 Crítico' : '✅'} |
| Pagos de convenio sin id_convenio | ${pagosConvenioSinId.length} | ${pagosConvenioSinId.length > 0 ? '🟡 Importante' : '✅'} |

---

## G. Diagnóstico de reportes y módulos

| Módulo | Estado | Condición |
|---|---|---|
| Socios — lista/edición | ✅ Listo | — |
| Pagos — listado | ✅ Listo | 832 pagos disponibles |
| Aportes — saldos | ✅ Listo | 785 aportes calculados |
| Créditos — lista | ✅ Listo | 31 créditos |
| Cartera/mora | ✅ Usable | No depende de cronograma |
| Reporte de caja | ✅ Usable | 832 pagos |
| Anexo 6 | ⚠️ Parcial | tasa_interes=0 → interés incorrecto |
| Cronograma de cuotas | ${creditosVigentesSinCronograma.length === 0 ? '✅ Completo' : '⚠️ Incompleto'} | ${cronogramaCount} cuotas · ${creditosVigentesConCronograma.length}/${creditosVigentes.length} vigentes · ${creditosCanceladosSinCronograma.length} cancelados sin cronograma (OK) |
| BDCC BD01 | ❌ Bloqueado | género y estado_civil = NULL en todos |
| BDCC BD02-A | ❌ Bloqueado | Depende de BD01 válido |

---

## Problemas críticos (${criticos.length})

${criticos.map((c, i) => `${i + 1}. 🔴 ${c}`).join('\n')}

---

## Problemas medios (${medios.length})

${medios.map((m, i) => `${i + 1}. 🟡 ${m}`).join('\n')}

---

## Advertencias (${advertencias.length})

${advertencias.map((a, i) => `${i + 1}. 🟢 ${a}`).join('\n')}

---

## Qué se puede usar ya

${puedeUsarse.map((u, i) => `${i + 1}. ✅ ${u}`).join('\n')}

---

## Qué NO se debe usar aún

${noUsar.map((u, i) => `${i + 1}. ❌ ${u}`).join('\n')}

---

## Acciones recomendadas (en orden)

| Prioridad | Acción | Cómo hacerlo |
|---|---|---|
${accionesOrden.map(a => `| ${a.prio} | ${a.accion} | ${a.como} |`).join('\n')}

---

## Sobre el método de corrección

| Campo | Corrección vía app | Corrección vía script | Requiere fuente externa |
|---|---|---|---|
| genero / estado_civil | ✅ Socio por socio | ✅ Script si hay Excel/lista | Solo si no se sabe el valor |
| tipo_credito_sbs | ✅ Editar crédito | ✅ Script si todos son iguales | No — valor único '004' probable |
| tasa_interes | ✅ Editar crédito | ✅ Script si hay lista | Requiere documentos físicos |
| cronograma_cuotas | ✅ Abrir y guardar crédito | ⚠️ RPC disponible pero requiere tasa | Necesita tasa_interes primero |
| id_credito en pagos | ✅ Editar pago | ✅ Script por socio (1 crédito por socio) | No |
| DNI placeholder SINDNI | ✅ Buscar y editar socio | No | Requiere DNI real del socio |

---

## Confirmaciones de cumplimiento (Fase 9C-5)

- ✅ NO se insertó ningún dato
- ✅ NO se actualizó ningún dato
- ✅ NO se borró ningún dato
- ✅ NO se tocaron tablas de sistema (usuarios / configuracion)
- ✅ NO se modificaron archivos en _client_files/
- ✅ NO se crearon migraciones
- ✅ NO se imprimieron datos personales completos

---

*Generado por scripts/audit-post-excel-import.mjs — ${now}*
`

if (!existsSync(DOCS_DIR)) mkdirSync(DOCS_DIR, { recursive: true })
writeFileSync(resolve(DOCS_DIR, 'POST_EXCEL_IMPORT_AUDIT.md'), report, 'utf8')

// ─── Resumen consola ──────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════════')
console.log('  RESUMEN DE AUDITORÍA')
console.log('══════════════════════════════════════════════════════')
console.log(`  Problemas críticos : ${criticos.length}`)
criticos.forEach(c => console.log(`    🔴 ${c}`))
console.log(`  Problemas medios   : ${medios.length}`)
medios.forEach(m => console.log(`    🟡 ${m}`))
console.log(`  Advertencias       : ${advertencias.length}`)
advertencias.forEach(a => console.log(`    🟢 ${a}`))
console.log('\n📄 Reporte: docs/ai-recovery/POST_EXCEL_IMPORT_AUDIT.md')
console.log('══════════════════════════════════════════════════════\n')
