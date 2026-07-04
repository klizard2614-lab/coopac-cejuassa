/**
 * check-pagos-cuotas-10k2a-revision-manual.mjs
 * Fase 10K-2A.1 — Verificación del paquete de revisión manual para Tesorería/Créditos.
 *
 * Verifica:
 * 1. Existe el documento manual y el Excel de revisión
 * 2. El documento contiene los 3 bloques de revisión (pago 411, match_medio, crédito cancelado 1145)
 * 3. El documento no describe ningún cambio real de datos (no toca DB/Anexo 6/seguridad)
 * 4. El documento contiene las preguntas exactas para Tesorería/Créditos
 * 5. El documento contiene una matriz de decisión (aprobar/excluir/corregir)
 * 6. El Excel tiene las 5 hojas esperadas, con las columnas requeridas en decisiones_requeridas
 * 7. El script generador es solo lectura (no escribe en tablas de negocio)
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import XLSX from 'xlsx'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DOCS = resolve(ROOT, 'docs/ai-recovery')
const SCRIPTS = resolve(ROOT, 'scripts')
const EXPORTS = resolve(ROOT, 'exports/pagos-cuotas-dryrun')

let passed = 0
let failed = 0

function check(name, condition, detail = '') {
  if (condition) { console.log(`  ✅ ${name}`); passed++ }
  else { console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); failed++ }
}

// ─── Sección 1: Artefactos existen ───────────────────────────────────────────
console.log('\n📄 Sección 1: Artefactos generados')

const DOC = resolve(DOCS, 'PAGOS_CUOTAS_10K_2A_REVISION_MANUAL.md')
check('Existe PAGOS_CUOTAS_10K_2A_REVISION_MANUAL.md', existsSync(DOC))

const EXCEL = resolve(EXPORTS, '10k_2a_casos_para_revision_manual.xlsx')
check('Existe Excel 10k_2a_casos_para_revision_manual.xlsx', existsSync(EXCEL))

const GEN_SCRIPT = resolve(SCRIPTS, 'generate-pagos-cuotas-10k2a-revision-manual-excel.mjs')
check('Existe script generador del Excel', existsSync(GEN_SCRIPT))

// ─── Sección 2: Contenido del documento ──────────────────────────────────────
console.log('\n📋 Sección 2: Contenido del documento manual')

if (existsSync(DOC)) {
  const doc = readFileSync(DOC, 'utf8')

  check('Documento tiene resumen en lenguaje simple', /resumen en lenguaje simple/i.test(doc))
  check('Documento explica qué significa "aplicar pagos a cuotas"', /qué significa .aplicar pagos a cuotas./i.test(doc))
  check('Documento explica qué pasaría si se aprueba', /qué pasaría si se aprueba/i.test(doc))
  check('Documento lista qué casos necesitan respuesta', /qué casos necesitan respuesta/i.test(doc))

  // Bloque 1: pago 411
  check('Bloque caso pago 411**** presente (R-K2)', /caso 1.*pago 411/i.test(doc) && doc.includes('411****') && doc.includes('R-K2'))
  // Bloque 2: match_medio
  check('Bloque caso match_medio presente (3 pagos)', /caso 2.*match_medio/i.test(doc) && doc.includes('412****') && doc.includes('413****') && doc.includes('422****'))
  // Bloque 3: crédito cancelado 1145
  check('Bloque caso crédito cancelado 1145**** presente', /caso 3.*1145/i.test(doc) && doc.includes('1145****'))

  check('Documento tiene preguntas exactas para Tesorería/Créditos', /preguntas exactas para tesorería.créditos/i.test(doc))
  check('Documento tiene recomendación por cada caso', /recomendación por cada caso/i.test(doc))
  check('Documento tiene matriz de decisión (aprobar/excluir/corregir)',
    /decisión requerida.*aprobar.*excluir.*corregir/is.test(doc))

  check('Documento confirma que NO se modificó cronograma_cuotas', doc.includes('NO** se modificó `cronograma_cuotas`'))
  check('Documento confirma que NO se tocó pagos_cuotas_aplicaciones', /no.*se insertó nada en `pagos_cuotas_aplicaciones`/i.test(doc))
  check('Documento confirma que NO se tocó Anexo 6', /no.*se tocó anexo 6/i.test(doc))
  check('Documento confirma que NO se tocó seguridad (RLS/auditoría)', /no.*se tocó seguridad/i.test(doc))
  check('Documento indica que 10K-2B sigue bloqueada', /10k-2b sigue bloqueada/i.test(doc))
  check('Documento NO afirma que se aplicó algún pago', !/pagos aplicados exitosamente|apply completado|apply ejecutado/i.test(doc))
} else {
  check('Contenido del documento verificable', false, 'documento no existe')
}

// ─── Sección 3: Hojas y columnas del Excel ───────────────────────────────────
console.log('\n📊 Sección 3: Excel de revisión')

const HOJAS_ESPERADAS = [
  'resumen_para_tesoreria',
  'caso_pago_411',
  'match_medio_pendientes',
  'credito_cancelado_1145',
  'decisiones_requeridas',
]

if (existsSync(EXCEL)) {
  const wb = XLSX.readFile(EXCEL)
  for (const hoja of HOJAS_ESPERADAS) {
    check(`Hoja "${hoja}" presente`, wb.SheetNames.includes(hoja))
  }
  check('Excel tiene exactamente las 5 hojas esperadas',
    wb.SheetNames.length === HOJAS_ESPERADAS.length &&
    wb.SheetNames.every(s => HOJAS_ESPERADAS.includes(s)))

  if (wb.SheetNames.includes('decisiones_requeridas')) {
    const ws = wb.Sheets['decisiones_requeridas']
    const rows = XLSX.utils.sheet_to_json(ws)
    const COLUMNAS_ESPERADAS = [
      'caso', 'problema', 'monto', 'credito', 'socio', 'decision_requerida',
      'opcion_a', 'opcion_b', 'opcion_c', 'respuesta_tesoreria_creditos', 'observaciones',
    ]
    const columnasPresentes = rows.length > 0 ? Object.keys(rows[0]) : []
    for (const col of COLUMNAS_ESPERADAS) {
      check(`Columna "${col}" presente en decisiones_requeridas`, columnasPresentes.includes(col))
    }
    check('Hoja decisiones_requeridas tiene 3 filas (uno por caso)', rows.length === 3)
  } else {
    check('Columnas de decisiones_requeridas verificables', false, 'hoja no existe')
  }
} else {
  for (const hoja of HOJAS_ESPERADAS) check(`Hoja "${hoja}" presente`, false, 'Excel no existe')
}

// ─── Sección 4: Script generador es solo lectura ─────────────────────────────
console.log('\n🔒 Sección 4: El script generador no toca datos reales')

if (existsSync(GEN_SCRIPT)) {
  const src = readFileSync(GEN_SCRIPT, 'utf8')
  check('El script no importa @supabase/supabase-js (no consulta la DB)', !src.includes('@supabase/supabase-js'))

  const tablasNegocio = ['cronograma_cuotas', 'pagos_recibos', 'creditos', 'socios', 'aportes', 'egresos', 'pagos_cuotas_aplicaciones']
  let sinEscrituras = true
  for (const tabla of tablasNegocio) {
    const re = new RegExp(`\\.from\\(['"\`]${tabla}['"\`]\\)\\s*\\.(insert|update|delete|upsert)`, 'i')
    if (re.test(src)) sinEscrituras = false
  }
  check('El script no llama insert/update/delete/upsert sobre ninguna tabla de negocio', sinEscrituras)
  check('El script no referencia Anexo 6', !/anexo6|anexo_6/i.test(src))
  check('El script no toca tabla auditoria', !src.includes("from('auditoria')"))
  check('El script no toca tabla usuarios', !src.includes("from('usuarios')"))
  check('El script no modifica RLS / policies', !/create policy|alter policy|drop policy|enable row level security/i.test(src))
  check('El script no crea ni modifica migraciones', !src.includes('supabase/migrations'))
} else {
  check('Script generador verificable', false, 'no existe')
}

// ─── Sección 5: 10K-2B sigue bloqueada ────────────────────────────────────────
console.log('\n⏳ Sección 5: 10K-2B sigue bloqueada')

const APPLY_SCRIPT = resolve(SCRIPTS, 'apply-pagos-cuotas.mjs')
check('NO existe scripts/apply-pagos-cuotas.mjs todavía (10K-2B no iniciada)', !existsSync(APPLY_SCRIPT))

// ─── Sección 6: package.json ──────────────────────────────────────────────────
console.log('\n📦 Sección 6: Comando npm')

const PKG = resolve(ROOT, 'package.json')
if (existsSync(PKG)) {
  const pkg = JSON.parse(readFileSync(PKG, 'utf8'))
  check('Script npm "check:pagos-cuotas-10k2a-revision" registrado', !!pkg.scripts?.['check:pagos-cuotas-10k2a-revision'])
}

// ─── Resumen ──────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60))
console.log(`\n📊 Resultado: ${passed} PASS · ${failed} FAIL\n`)

if (failed > 0) {
  console.log('❌ Verificación FALLIDA — revisar los items marcados antes de continuar.')
  process.exit(1)
} else {
  console.log('✅ Todos los checks pasan. El paquete de revisión manual está listo para Tesorería/Créditos.')
  console.log('\n⏳ 10K-2B sigue bloqueada hasta recibir las 3 decisiones en decisiones_requeridas.\n')
  process.exit(0)
}
