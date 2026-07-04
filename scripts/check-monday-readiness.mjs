/**
 * check-monday-readiness.mjs
 * Verifica que la app esté en estado de entrega para el lunes.
 * No toca DB ni servidor — solo valida archivos del proyecto.
 */

import { readFileSync, existsSync } from 'fs'

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

console.log('\n🚀 check:monday-readiness — Estado de entrega para el lunes\n')

const PAGE_BDCC    = 'app/dashboard/reportes/bdcc/page.tsx'
const PAGE_REPORTES = 'app/dashboard/reportes/page.tsx'
const CHECKLIST    = 'docs/ai-recovery/MONDAY_DELIVERY_CHECKLIST.md'
const DEMO_SCRIPT  = 'docs/ai-recovery/MONDAY_DEMO_SCRIPT.md'
const PKG          = 'package.json'

const pageContent     = existsSync(PAGE_BDCC)     ? readFileSync(PAGE_BDCC,     'utf-8') : ''
const reportesContent = existsSync(PAGE_REPORTES) ? readFileSync(PAGE_REPORTES, 'utf-8') : ''
const checklistContent = existsSync(CHECKLIST)    ? readFileSync(CHECKLIST,     'utf-8') : ''
const demoContent     = existsSync(DEMO_SCRIPT)   ? readFileSync(DEMO_SCRIPT,   'utf-8') : ''
const pkgContent      = existsSync(PKG)           ? readFileSync(PKG,           'utf-8') : ''

// ── 1. Archivos de código BDCC existen ────────────────────────────────────────
console.log('📄 Archivos de código')
check('app/dashboard/reportes/bdcc/page.tsx existe', existsSync(PAGE_BDCC))
check('app/dashboard/reportes/page.tsx existe',      existsSync(PAGE_REPORTES))
check('lib/bdcc/format.ts existe',                   existsSync('lib/bdcc/format.ts'))

// ── 2. Card BDCC en índice de Reportes ───────────────────────────────────────
console.log('\n📑 Acceso BDCC desde Reportes')
check('Tarjeta BDCC en índice de Reportes',           reportesContent.includes('bdcc') || reportesContent.includes('BDCC'))
check('href /dashboard/reportes/bdcc presente',       reportesContent.includes('/dashboard/reportes/bdcc'))
check('Tarjeta BDCC activa (no próximamente)',         reportesContent.includes("activo: true") && reportesContent.includes('bdcc'))

// ── 3. Documentos de entrega del lunes ───────────────────────────────────────
console.log('\n📋 Documentos de entrega')
check('MONDAY_DELIVERY_CHECKLIST.md existe',          existsSync(CHECKLIST))
check('MONDAY_DEMO_SCRIPT.md existe',                 existsSync(DEMO_SCRIPT))

if (existsSync(CHECKLIST)) {
  check('Checklist incluye sección de archivos BDCC', checklistContent.includes('BD01') && checklistContent.includes('BD02A'))
  check('Checklist lista pendientes explícitos',       checklistContent.includes('TPINT') && checklistContent.includes('CCVE'))
  check('Checklist incluye mensaje para Gerencia',     checklistContent.includes('Gerencia') || checklistContent.includes('Contabilidad'))
  check('Checklist tiene instrucciones de prueba manual', checklistContent.includes('Descargar BD01') || checklistContent.includes('BD01.txt'))
}

if (existsSync(DEMO_SCRIPT)) {
  check('Demo script cubre módulo Socios',            demoContent.includes('Socios') || demoContent.includes('socios'))
  check('Demo script cubre módulo Créditos',          demoContent.includes('Créditos') || demoContent.includes('créditos'))
  check('Demo script cubre Anexo 6',                  demoContent.includes('Anexo') || demoContent.includes('anexo'))
  check('Demo script cubre BDCC',                     demoContent.includes('BDCC') || demoContent.includes('bdcc'))
  check('Demo script incluye respuesta para "¿listo para SBS?"', demoContent.includes('listo para enviar') || demoContent.includes('revisión interna') || demoContent.includes('enviar a la SBS'))
}

// ── 4. Comandos en package.json ───────────────────────────────────────────────
console.log('\n📦 Comandos npm')
check('"smoke:bdcc" en package.json',                 pkgContent.includes('"smoke:bdcc"'))
check('"check:bdcc:mvp-exporters" en package.json',   pkgContent.includes('"check:bdcc:mvp-exporters"'))
check('"check:bdcc:ui-fields" en package.json',       pkgContent.includes('"check:bdcc:ui-fields"'))
check('"check:bdcc:min-fields" en package.json',      pkgContent.includes('"check:bdcc:min-fields"'))
check('"verify:cejuassa" en package.json',            pkgContent.includes('"verify:cejuassa"'))
check('"check:monday-readiness" en package.json',     pkgContent.includes('"check:monday-readiness"'))

// ── 5. BD02-B y BD04 siguen bloqueados ────────────────────────────────────────
console.log('\n🔒 BD02-B y BD04 siguen pendientes (no implementados)')
const tieneBD02BFunc = /function\s+generarBD02B/.test(pageContent) || pageContent.includes('generarBD02B()')
const tieneBD04Func  = /function\s+generarBD04/.test(pageContent)  || pageContent.includes('generarBD04()')
check('BD02-B sin función generadora activa',          !tieneBD02BFunc, tieneBD02BFunc ? '⚠ se encontró generarBD02B — revisar' : '')
check('BD04 sin función generadora activa',            !tieneBD04Func,  tieneBD04Func  ? '⚠ se encontró generarBD04 — revisar' : '')
check('BD02-B marcado como pendiente en UI',           pageContent.includes('BD02B') || pageContent.includes('BD02-B'))
check('BD04 marcado como pendiente en UI',             pageContent.includes("'BD04'") || pageContent.includes('"BD04"'))

// ── 6. Histórico 2024/2025 fuera de alcance ───────────────────────────────────
console.log('\n📅 Histórico 2024/2025 — fuera de alcance')
const tieneAccesoHistorico =
  pageContent.includes("'2024-") || pageContent.includes('"2024-') ||
  pageContent.includes("'2025-") || pageContent.includes('"2025-') ||
  pageContent.includes('importarHistorico') || pageContent.includes('import_historico')
check('No hay filtro de fecha fija 2024/2025 en página BDCC', !tieneAccesoHistorico,
  tieneAccesoHistorico ? 'filtro histórico detectado — revisar antes de entrega' : '')
check('Checklist menciona histórico fuera de alcance',  checklistContent.includes('2024') || checklistContent.includes('Histórico') || checklistContent.includes('histórico'))

// ── 7. _client_files/ no fue tocado ──────────────────────────────────────────
console.log('\n📁 Archivos del cliente intactos')
check('Página BDCC no referencia _client_files/',    !pageContent.includes('_client_files'))
check('Índice de Reportes no referencia _client_files/', !reportesContent.includes('_client_files'))

// ── 8. Advertencias regulatorias visibles en la pantalla ─────────────────────
console.log('\n⚠  Advertencias regulatorias en pantalla BDCC')
check('Advertencia TPINT visible',                    pageContent.includes('TPINT'))
check('Advertencia CCVE/CCJU visible',                pageContent.includes('CCVE') && pageContent.includes('CCJU'))
check('Nota "Borrador revisable" visible',            pageContent.includes('Borrador') || pageContent.includes('borrador'))
check('Bloque de advertencias permanentes presente',  pageContent.includes('Advertencias permanentes') || pageContent.includes('advertencias permanentes') || pageContent.includes('permanentes'))

// ── 9. Código COOPAC 01270 presente ───────────────────────────────────────────
console.log('\n🏷  Código COOPAC')
check('COOPAC 01270 en página BDCC',                  pageContent.includes("'01270'") || pageContent.includes('"01270"'))

// ── 10. Seguridad ─────────────────────────────────────────────────────────────
console.log('\n🔒 Seguridad')
const serviceRoleInPage = pageContent.includes('SERVICE_ROLE') || pageContent.includes('service_role')
check('Sin service role en página BDCC',              !serviceRoleInPage)

// ── Resumen ───────────────────────────────────────────────────────────────────
const total = pass + fail
console.log(`\n${'─'.repeat(55)}`)
console.log(`Resultado: ${pass}/${total} checks pasaron`)
if (fail > 0) {
  console.log(`❌ ${fail} check(s) fallaron — revisar antes del lunes`)
  process.exit(1)
} else {
  console.log('✅ App lista para entrega del lunes')
}
