/**
 * check-pagos-cuotas-10k3a-logica.mjs
 * Fase 10K-3A — Verificación del diseño de lógica para pagos nuevos contra cuotas.
 *
 * Verifica:
 * 1. Existe el documento de diseño y la matriz Excel
 * 2. El documento declara 10K-2B diferido (no cancelado)
 * 3. El documento cubre flujo actual, flujo propuesto, reglas de negocio,
 *    arquitectura recomendada, SQL/RPC propuesto, riesgos, rollback, plan por fases
 * 4. El documento recomienda una arquitectura segura (RPC transaccional)
 * 5. El documento define la siguiente fase de implementación (10K-3B)
 * 6. El Excel tiene las 6 hojas esperadas
 * 7. La hoja escenarios_prueba cubre los 8 escenarios mínimos
 * 8. Nada de esto modificó datos, migraciones, Anexo 6 ni seguridad
 * 9. No se creó ninguna migración SQL nueva para aplicar_pago_a_cuotas
 * 10. pagos/nuevo/page.tsx no fue modificado en esta fase
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
const MIGRATIONS = resolve(ROOT, 'supabase/migrations')

let passed = 0
let failed = 0

function check(name, condition, detail = '') {
  if (condition) { console.log(`  ✅ ${name}`); passed++ }
  else { console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); failed++ }
}

// ─── Sección 1: Artefactos existen ───────────────────────────────────────────
console.log('\n📄 Sección 1: Artefactos generados')

const DOC = resolve(DOCS, 'PAGOS_CUOTAS_10K_3A_LOGICA_NUEVOS_PAGOS.md')
check('Existe PAGOS_CUOTAS_10K_3A_LOGICA_NUEVOS_PAGOS.md', existsSync(DOC))

const EXCEL = resolve(EXPORTS, '10k_3a_matriz_logica_pagos_nuevos.xlsx')
check('Existe Excel 10k_3a_matriz_logica_pagos_nuevos.xlsx', existsSync(EXCEL))

const GEN_SCRIPT = resolve(SCRIPTS, 'generate-pagos-cuotas-10k3a-matriz-excel.mjs')
check('Existe script generador de la matriz', existsSync(GEN_SCRIPT))

// ─── Sección 2: Contenido del documento ──────────────────────────────────────
console.log('\n📋 Sección 2: Contenido del documento de diseño')

let doc = ''
if (existsSync(DOC)) {
  doc = readFileSync(DOC, 'utf8')

  check('Documento tiene sección Objetivo', /##\s*objetivo/i.test(doc))
  check('Documento declara 10K-2B diferido (no cancelado)', /10K-2B.*diferid/is.test(doc) && /no.*cancelad/i.test(doc))
  check('Documento menciona que NO se revisó pago 411**** en esta fase', /no bloquean este dise[nñ]o[\s\S]{0,20}no se[\s\S]{0,20}revisaron/i.test(doc))
  check('Documento tiene sección "Flujo actual"', /##\s*flujo actual/i.test(doc))
  check('Documento audita app\\/dashboard\\/pagos\\/nuevo', doc.includes('pagos/nuevo/page.tsx'))
  check('Documento tiene sección "Flujo propuesto"', /##\s*flujo propuesto/i.test(doc))
  check('Documento tiene sección "Reglas de negocio"', /reglas de negocio/i.test(doc))
  check('Documento define orden de cuotas (fecha_vencimiento ASC)', /fecha_vencimiento\s*ASC|fecha_vencimiento ascendente/i.test(doc))
  check('Documento tiene sección "Arquitectura recomendada"', /arquitectura recomendada/i.test(doc))
  check('Documento compara opciones A (frontend), B (API route) y C (RPC)', doc.includes('A. Frontend') && doc.includes('B. API route') && doc.includes('C. RPC transaccional'))
  check('Documento recomienda la opción RPC transaccional', /recomendaci[oó]n:\s*\*?\*?opci[oó]n c/i.test(doc) || /recomendada.*opci[oó]n c/i.test(doc))
  check('Documento tiene SQL/RPC propuesto a alto nivel', doc.includes('aplicar_pago_a_cuotas') && /CREATE OR REPLACE FUNCTION/i.test(doc))
  check('Documento marca el SQL como boceto NO ejecutado', /NO aplicar sin aprobaci[oó]n|no.*ejecutable|boceto de dise[nñ]o/i.test(doc))
  check('Documento tiene sección Riesgos', /##\s*riesgos/i.test(doc))
  check('Documento tiene sección Rollback', /##\s*rollback/i.test(doc))
  check('Documento tiene "Plan por fases"', /plan por fases/i.test(doc))
  check('Documento define la fase 10K-3B como próxima implementación', doc.includes('10K-3B'))
  check('Documento tiene sección "Qué no se tocará"', /qué no se tocar[aá]/i.test(doc))
  check('Documento confirma que NO se modificaron datos reales', /no.*se modific.*ning[uú]n dato/i.test(doc))
  check('Documento confirma que NO se aplicó ninguna migración', /no.*se aplic.*ninguna migraci[oó]n/i.test(doc))
  check('Documento confirma que NO se tocó Anexo 6', /no.*se toc[oó] anexo 6/i.test(doc))
  check('Documento confirma que NO se tocó seguridad', /no.*se toc[oó] seguridad/i.test(doc))
  check('Documento NO afirma que se aplicó la RPC en Supabase', !/rpc aplicada en supabase|migraci[oó]n aplicada en remoto/i.test(doc))
} else {
  check('Contenido del documento verificable', false, 'documento no existe')
}

// ─── Sección 3: Hojas del Excel ───────────────────────────────────────────────
console.log('\n📊 Sección 3: Hojas de la matriz Excel')

const HOJAS_ESPERADAS = [
  'flujo_actual',
  'flujo_propuesto',
  'reglas_negocio',
  'escenarios_prueba',
  'riesgos',
  'decision_tecnica',
]

let wb = null
if (existsSync(EXCEL)) {
  wb = XLSX.readFile(EXCEL)
  for (const hoja of HOJAS_ESPERADAS) {
    check(`Hoja "${hoja}" presente`, wb.SheetNames.includes(hoja))
  }
  check('Excel tiene exactamente las 6 hojas esperadas',
    wb.SheetNames.length === HOJAS_ESPERADAS.length &&
    wb.SheetNames.every(s => HOJAS_ESPERADAS.includes(s)))
} else {
  for (const hoja of HOJAS_ESPERADAS) check(`Hoja "${hoja}" presente`, false, 'Excel no existe')
}

// ─── Sección 4: Escenarios mínimos cubiertos ──────────────────────────────────
console.log('\n🧪 Sección 4: Escenarios mínimos')

const ESCENARIOS_MINIMOS = [
  'exacto de una cuota',
  'parcial',
  'varias cuotas',
  'sobrante',
  'sin crédito',
  'cancelado',
  'mixto',
  'ya pagada',
]

if (wb && wb.SheetNames.includes('escenarios_prueba')) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['escenarios_prueba'])
  const textoEscenarios = rows.map(r => (r.escenario || '') + ' ' + (r.entrada || '')).join(' ').toLowerCase()
  for (const esc of ESCENARIOS_MINIMOS) {
    check(`Escenario cubierto: "${esc}"`, textoEscenarios.includes(esc.toLowerCase()))
  }
  check('Hoja escenarios_prueba tiene al menos 8 filas', rows.length >= 8)
} else {
  for (const esc of ESCENARIOS_MINIMOS) check(`Escenario cubierto: "${esc}"`, false, 'hoja no existe')
}

// ─── Sección 5: No se modificaron datos / migraciones / Anexo 6 / seguridad ──
console.log('\n🔒 Sección 5: Nada real fue tocado')

check('El script generador de la matriz no importa @supabase/supabase-js', existsSync(GEN_SCRIPT) && !readFileSync(GEN_SCRIPT, 'utf8').includes('@supabase/supabase-js'))

const APPLY_RPC_MIGRATION_PATTERN = /aplicar_pago_a_cuotas/i
let migracionNuevaExiste = false
if (existsSync(MIGRATIONS)) {
  const { readdirSync } = await import('fs')
  const archivos = readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql'))
  for (const f of archivos) {
    const contenido = readFileSync(resolve(MIGRATIONS, f), 'utf8')
    if (APPLY_RPC_MIGRATION_PATTERN.test(contenido)) migracionNuevaExiste = true
  }
}
check('NO existe ninguna migración con aplicar_pago_a_cuotas todavía (10K-3B no iniciada)', !migracionNuevaExiste)

const PAGOS_NUEVO_PAGE = resolve(ROOT, 'app/dashboard/pagos/nuevo/page.tsx')
if (existsSync(PAGOS_NUEVO_PAGE)) {
  const src = readFileSync(PAGOS_NUEVO_PAGE, 'utf8')
  check('pagos/nuevo/page.tsx NO llama todavía a aplicar_pago_a_cuotas (frontend sin modificar)', !src.includes('aplicar_pago_a_cuotas'))
}

check('El documento confirma que anexo6/page.tsx no fue tocado (no describe cambios ahí)', doc.includes('anexo6/page.tsx') && /no.*se toc[oó] anexo 6/i.test(doc))
check('El documento no describe cambios en policies/RLS existentes', !/alter policy|drop policy|create policy/i.test(doc))

// ─── Sección 6: package.json ──────────────────────────────────────────────────
console.log('\n📦 Sección 6: Comando npm')

const PKG = resolve(ROOT, 'package.json')
if (existsSync(PKG)) {
  const pkg = JSON.parse(readFileSync(PKG, 'utf8'))
  check('Script npm "check:pagos-cuotas-10k3a" registrado', !!pkg.scripts?.['check:pagos-cuotas-10k3a'])
}

// ─── Resumen ──────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60))
console.log(`\n📊 Resultado: ${passed} PASS · ${failed} FAIL\n`)

if (failed > 0) {
  console.log('❌ Verificación FALLIDA — revisar los items marcados antes de continuar.')
  process.exit(1)
} else {
  console.log('✅ Todos los checks pasan. El diseño 10K-3A está listo para revisión del usuario.')
  console.log('\n⏳ Próxima fase: 10K-3B — SQL final ejecutable, requiere aprobación explícita antes de aplicar.\n')
  process.exit(0)
}
