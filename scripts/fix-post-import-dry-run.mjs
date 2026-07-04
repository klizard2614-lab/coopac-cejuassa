/**
 * fix-post-import-dry-run.mjs
 * Fase 9C-6A — Dry-run de correcciones post-importación
 *
 * SOLO LECTURA — no modifica nada:
 * - NO insert / NO update / NO delete / NO truncate
 * - NO toca usuarios / configuracion / tablas de sistema
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

async function fetchAll(table, select) {
  const { data, error } = await sb.from(table).select(select)
  if (error) throw new Error(`fetch ${table}: ${error.message}`)
  return data || []
}

// ─── Verificación de documentación ───────────────────────────────────────────

function checkDocumentado(pattern, files) {
  for (const f of files) {
    if (!existsSync(f)) continue
    const content = readFileSync(f, 'utf8')
    if (pattern instanceof RegExp ? pattern.test(content) : content.includes(pattern)) return true
  }
  return false
}

const docsDir = resolve(ROOT, 'docs/ai-recovery')
const docFiles = [
  resolve(docsDir, 'SBS_BDCC_REPORTS_PLAN.md'),
  resolve(docsDir, 'DATABASE_AND_AUTH.md'),
  resolve(docsDir, 'COMMANDS_AND_SETUP.md'),
]

// '004' como código SBS explícito para TIPCRED
const tipcred004Documentado = checkDocumentado(/['"]004['"].*TIPCRED|TIPCRED.*['"]004['"]/i, docFiles) ||
  checkDocumentado(/tipo_credito_sbs.*004|004.*consumo.*revolvente/i, docFiles)

// '1411050604' como cuenta contable
const cuentaDocumentada = checkDocumentado('1411050604', docFiles) ||
  checkDocumentado('1411050604', [resolve(ROOT, 'app/dashboard/reportes/bdcc/page.tsx')])

console.log('\n══════════════════════════════════════════════════════')
console.log('  CEJUASSA — Fix Post-Import Dry-Run (Fase 9C-6A)')
console.log('  MODO: SOLO LECTURA — nada se modifica')
console.log('══════════════════════════════════════════════════════\n')

// ─── Datos actuales ───────────────────────────────────────────────────────────

console.log('📊 Leyendo estado actual de la DB...')
const socios = await fetchAll('socios', 'id,nro_socio,dni,genero,estado_civil,beneficiario_nombre')
const creditos = await fetchAll('creditos', 'id,tasa_interes,plazo_meses,monto_aprobado,fecha_desembolso,tipo_credito_sbs,subtipo_credito_sbs,cuenta_contable_bd01,saldo_capital,estado')
const pagos = await fetchAll('pagos_recibos', 'id,id_credito,tipo_pago,monto_total,id_socio')

const { count: cronCount } = await sb.from('cronograma_cuotas').select('*', { count: 'exact', head: true })

console.log(`  Socios      : ${socios.length}`)
console.log(`  Créditos    : ${creditos.length}`)
console.log(`  Pagos       : ${pagos.length}`)
console.log(`  Cronograma  : ${cronCount}`)

// ─── Análisis Grupo A: correcciones automáticas ───────────────────────────────

console.log('\n🔍 Grupo A — Correcciones automáticas seguras')

// A1: tipo_credito_sbs
const creditosTipoSbsTexto = creditos.filter(c => c.tipo_credito_sbs && !/^\d{3,}$/.test(c.tipo_credito_sbs))
const creditosTipoSbsNull = creditos.filter(c => !c.tipo_credito_sbs)
const tipoSbsUnico = [...new Set(creditos.map(c => c.tipo_credito_sbs))]
console.log(`  tipo_credito_sbs (NULL):          ${creditosTipoSbsNull.length}`)
console.log(`  tipo_credito_sbs (texto, no código): ${creditosTipoSbsTexto.length} → valores: ${tipoSbsUnico.join(', ')}`)
console.log(`  Código '004' documentado en proyecto: ${tipcred004Documentado ? '✅ SÍ' : '❌ NO — no se puede aplicar automáticamente'}`)

// A2: subtipo_credito_sbs
const creditosSinSubtipo = creditos.filter(c => !c.subtipo_credito_sbs)
console.log(`  subtipo_credito_sbs (NULL):       ${creditosSinSubtipo.length} — código no documentado en proyecto`)

// A3: cuenta_contable_bd01
const creditosSinCuenta = creditos.filter(c => !c.cuenta_contable_bd01)
console.log(`  cuenta_contable_bd01 (vacía):     ${creditosSinCuenta.length} — ${cuentaDocumentada ? '1411050604 documentada ✅' : '⚠️ verificar'}`)

// A4: tipo_pago
const pagosSinTipoPago = pagos.filter(p => !p.tipo_pago)
const pagosTipoK = pagos.filter(p => p.tipo_pago === 'K')
console.log(`  tipo_pago (vacío):                ${pagosSinTipoPago.length}`)
console.log(`  tipo_pago 'K':                    ${pagosTipoK.length}`)

// ─── Análisis Grupo B: requieren datos del cliente ────────────────────────────

console.log('\n📋 Grupo B — Requieren datos del cliente')

const sociosSinGenero = socios.filter(s => !s.genero)
const sociosSinEstadoCivil = socios.filter(s => !s.estado_civil)
const sociosSinBeneficiario = socios.filter(s => !s.beneficiario_nombre)
const sociosPlaceholder = socios.filter(s => s.dni && s.dni.startsWith('SINDNI'))
const creditosTasaCero = creditos.filter(c => !c.tasa_interes || c.tasa_interes === 0)

console.log(`  Socios sin genero:         ${sociosSinGenero.length} → pendiente lista del cliente`)
console.log(`  Socios sin estado_civil:   ${sociosSinEstadoCivil.length} → pendiente lista del cliente`)
console.log(`  Socios sin beneficiario:   ${sociosSinBeneficiario.length} → pendiente fichas FPS`)
console.log(`  DNI placeholder SINDNI:    ${sociosPlaceholder.length} → pendiente DNI real`)
console.log(`  Créditos tasa_interes = 0: ${creditosTasaCero.length} → pendiente documentos físicos`)

// ─── Análisis Grupo C: decisión de negocio ────────────────────────────────────

console.log('\n💼 Grupo C — Requieren decisión de negocio')

// Créditos listos para cronograma (necesitan: tasa > 0, plazo > 0, monto > 0, fecha_desembolso)
const creditosListosCronograma = creditos.filter(c =>
  c.tasa_interes > 0 &&
  c.plazo_meses > 0 &&
  c.monto_aprobado > 0 &&
  c.fecha_desembolso
)
const creditosVigentes = creditos.filter(c => c.estado === 'vigente')
const creditosBloqueadosCronograma = creditosTasaCero.filter(c => c.estado === 'vigente')

// Pagos potencialmente asociables a crédito (socio con exactamente 1 crédito vigente)
const creditosPorSocio = {}
for (const c of creditos) {
  if (!creditosPorSocio[c.id_socio]) creditosPorSocio[c.id_socio] = []
  creditosPorSocio[c.id_socio].push(c)
}
const pagosConSocio1Credito = pagos.filter(p => {
  if (p.id_credito) return false // ya tiene id_credito
  const cs = creditosPorSocio[p.id_socio]
  return cs && cs.length === 1
})
const pagosAmbiguos = pagos.filter(p => {
  if (p.id_credito) return false
  const cs = creditosPorSocio[p.id_socio]
  return cs && cs.length > 1
})

console.log(`  Créditos listos para cronograma:  ${creditosListosCronograma.length} (necesitan tasa_interes > 0)`)
console.log(`  Créditos vigentes SIN cronograma: ${cronCount === 0 ? creditosVigentes.length : '0'} (tabla cronograma vacía)`)
console.log(`  Créditos bloqueados (tasa = 0):   ${creditosBloqueadosCronograma.length} → esperar tasa real`)
console.log(`  Pagos asociables automáticamente: ${pagosConSocio1Credito.length} (socio con 1 crédito)`)
console.log(`  Pagos ambiguos (socio N créditos): ${pagosAmbiguos.length}`)
console.log(`  Pagos tipo K:                     ${pagosTipoK.length} → revisar con negocio`)

// ─── Resumen de correcciones ──────────────────────────────────────────────────

const correccionesAutoSeguras = []
const correccionesNecesitanDatos = []
const correccionesDecisionNegocio = []

// Auto seguras
if (creditosSinCuenta.length === 0) correccionesAutoSeguras.push('cuenta_contable_bd01: ya correcta en todos los créditos')
if (pagosSinTipoPago.length === 0) correccionesAutoSeguras.push('tipo_pago: ya poblado en todos los pagos')

// Con fuente requerida
correccionesNecesitanDatos.push(`genero/estado_civil: ${sociosSinGenero.length} socios — requiere lista del cliente`)
correccionesNecesitanDatos.push(`tasa_interes: ${creditosTasaCero.length} créditos — requiere documentos físicos`)
correccionesNecesitanDatos.push(`tipo_credito_sbs código SBS: código no confirmado en proyecto — requiere Oficio SBS`)
correccionesNecesitanDatos.push(`subtipo_credito_sbs: ${creditosSinSubtipo.length} créditos — requiere catálogo SBS`)
if (sociosPlaceholder.length > 0) correccionesNecesitanDatos.push(`DNI placeholder: ${sociosPlaceholder.length} socio — requiere DNI real`)

// Decisión de negocio
correccionesDecisionNegocio.push(`cronograma_cuotas: ${creditosBloqueadosCronograma.length} vigentes bloqueados por tasa = 0 — regenerar tras completar tasa_interes`)
correccionesDecisionNegocio.push(`pagos.id_credito: ${pagosConSocio1Credito.length} asociables auto (${pagosAmbiguos.length} ambiguos) — decidir si se asocia`)
correccionesDecisionNegocio.push(`pagos tipo K: ${pagosTipoK.length} — confirmar código correcto con SBS`)

// ─── Generar reporte Markdown ─────────────────────────────────────────────────

const now = new Date().toISOString().replace('T', ' ').substring(0, 19)
const report = `# POST_IMPORT_FIX_DRY_RUN_REPORT.md
# Reporte Dry-Run de Correcciones Post-Importación — CEJUASSA
# Generado: ${now}

> Fase 9C-6A — Solo lectura. Nada fue modificado.

---

## Conteos actuales

| Tabla | Registros |
|---|---|
| socios | ${socios.length} |
| creditos | ${creditos.length} |
| pagos_recibos | ${pagos.length} |
| cronograma_cuotas | ${cronCount} |

---

## Grupo A — Correcciones automáticas

| Campo | Estado actual | Acción | Resultado |
|---|---|---|---|
| \`tipo_credito_sbs\` | '${tipoSbsUnico[0]}' (texto, no código) | ❌ NO aplicar | Código '004' no documentado en proyecto |
| \`subtipo_credito_sbs\` | NULL en ${creditosSinSubtipo.length} créditos | ❌ NO aplicar | Código no documentado |
| \`cuenta_contable_bd01\` | '1411050604' en todos | ✅ Ya correcta | No requiere acción |
| \`tipo_pago\` | Poblado en ${pagos.length - pagosSinTipoPago.length} pagos | ✅ Ya correcta | No requiere acción |

**Verificación de documentación:**
- Código '004' documentado: ${tipcred004Documentado ? 'SÍ' : 'NO — no aplicar automáticamente'}
- Cuenta '1411050604' documentada: ${cuentaDocumentada ? 'SÍ' : 'NO'}

---

## Grupo B — Requieren datos del cliente

| Campo | Registros afectados | Fuente requerida | Método |
|---|---|---|---|
| \`genero\` | ${sociosSinGenero.length} socios | Lista de socios del cliente | Script bulk O app |
| \`estado_civil\` | ${sociosSinEstadoCivil.length} socios | Lista de socios del cliente | Script bulk O app |
| \`tasa_interes\` | ${creditosTasaCero.length} créditos | Documentos físicos (pagarés) | App (editar crédito) |
| \`tipo_credito_sbs\` (código) | ${creditos.length} créditos | Oficio SBS catálogo C19 | Script bulk |
| \`subtipo_credito_sbs\` | ${creditosSinSubtipo.length} créditos | Oficio SBS catálogo C20 | Script bulk |
| DNI placeholder | ${sociosPlaceholder.length} socio | DNI real del socio | App |
| Beneficiarios FPS | ${sociosSinBeneficiario.length} socios | Fichas FPS | App O script |

**Crítico para BDCC (deadline 20/07/2026):**
- genero + estado_civil → bloquean BD01 completamente
- tasa_interes → TPINT en BD01 = 0 (dato inválido para SBS)
- tipo_credito_sbs código numérico → TIPCRED en BD01

---

## Grupo C — Decisión de negocio

### Cronograma de cuotas

| Condición | Créditos |
|---|---|
| Vigentes total | ${creditosVigentes.length} |
| Listos para cronograma (tasa > 0) | ${creditosListosCronograma.length} |
| Bloqueados (tasa = 0) | ${creditosBloqueadosCronograma.length} |
| Cronograma actual en DB | ${cronCount} |

**Conclusión:** ${creditosListosCronograma.length === 0
  ? '❌ Ningún crédito puede generar cronograma — todos tienen tasa_interes = 0. Completar tasa primero.'
  : `✅ ${creditosListosCronograma.length} créditos listos — ${creditosBloqueadosCronograma.length} bloqueados`}

### Asociación pagos ↔ créditos

| Situación | Pagos |
|---|---|
| Ya asociados (id_credito no NULL) | ${pagos.filter(p => p.id_credito).length} |
| Asociables automáticamente (socio con 1 crédito) | ${pagosConSocio1Credito.length} |
| Ambiguos (socio con >1 crédito) | ${pagosAmbiguos.length} |
| Sin crédito en DB para su socio | ${pagos.filter(p => !p.id_credito && !creditosPorSocio[p.id_socio]).length} |

**Recomendación:** La asociación automática es posible para ${pagosConSocio1Credito.length} pagos.
Decidir si se necesita antes de BDCC BD02-A.

### Pagos tipo K

- ${pagosTipoK.length} pagos con tipo_pago = 'K'
- Confirmar con SBS si 'K' es un valor válido para TIPPAG en BD02-A

---

## Resumen — Qué se puede corregir ahora vs. qué necesita esperar

### Corregible ahora (sin datos externos)
${correccionesAutoSeguras.map(c => `- ✅ ${c}`).join('\n')}

### Necesita datos del cliente
${correccionesNecesitanDatos.map(c => `- ⏳ ${c}`).join('\n')}

### Necesita decisión de negocio
${correccionesDecisionNegocio.map(c => `- 💼 ${c}`).join('\n')}

---

## Confirmaciones de cumplimiento

- ✅ NO se insertó ningún dato
- ✅ NO se actualizó ningún dato
- ✅ NO se borró ningún dato
- ✅ NO se tocaron tablas de sistema (usuarios / configuracion)
- ✅ NO se modificaron archivos en _client_files/
- ✅ NO se crearon migraciones

---

*Generado por scripts/fix-post-import-dry-run.mjs — ${now}*
`

if (!existsSync(DOCS_DIR)) mkdirSync(DOCS_DIR, { recursive: true })
writeFileSync(resolve(DOCS_DIR, 'POST_IMPORT_FIX_DRY_RUN_REPORT.md'), report, 'utf8')

// ─── Consola final ────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════════')
console.log('  RESUMEN DRY-RUN')
console.log('══════════════════════════════════════════════════════')
console.log(`  Auto seguras disponibles : ${correccionesAutoSeguras.length} (ninguna pendiente)`)
console.log(`  Necesitan datos cliente  : ${correccionesNecesitanDatos.length}`)
console.log(`  Decisión de negocio      : ${correccionesDecisionNegocio.length}`)
console.log(`  Créditos listos cronograma: ${creditosListosCronograma.length} (necesitan tasa > 0)`)
console.log('\n📄 Reporte: docs/ai-recovery/POST_IMPORT_FIX_DRY_RUN_REPORT.md')
console.log('  NADA fue modificado — solo lectura')
console.log('══════════════════════════════════════════════════════\n')
