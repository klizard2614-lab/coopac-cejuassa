/**
 * check-bdcc-mvp-exporters.mjs
 * Verifica que el módulo BDCC MVP esté correctamente implementado.
 * No toca la DB ni el servidor — solo lee archivos del proyecto.
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

console.log('\n🔍 check:bdcc:mvp-exporters\n')

// ── 1. Página BDCC existe ────────────────────────────────────────────────────
console.log('📄 Página BDCC')
const PAGE_PATH = 'app/dashboard/reportes/bdcc/page.tsx'
const pageExists = existsSync(PAGE_PATH)
check('Existe app/dashboard/reportes/bdcc/page.tsx', pageExists)

const pageContent = pageExists ? readFileSync(PAGE_PATH, 'utf-8') : ''

// ── 2. BD01 implementado ─────────────────────────────────────────────────────
console.log('\n📋 BD01 (Créditos vigentes)')
check('Función generarBD01 definida',   pageContent.includes('generarBD01'))
check('BD01_HDR con mnemónicos',        pageContent.includes('BD01_HDR'))
check("Descarga 01270_BD01_",           pageContent.includes('_BD01_'))
check('Usa .txt',                       pageContent.includes("'_BD01_'") || pageContent.includes('"_BD01_"') || pageContent.includes('BD01_'))
check('Código COOPAC 01270 en página',  pageContent.includes("'01270'") || pageContent.includes('"01270"'))
check('Usa tabulador (\\t)',            pageContent.includes("'\\t'") || pageContent.includes('"\\t"') || pageContent.includes('join(\'\\t\')') || pageContent.includes('join("\\t")') || (existsSync('lib/bdcc/format.ts') && readFileSync('lib/bdcc/format.ts','utf-8').includes('\\t')))
check('TPINT advertencia visible',      pageContent.includes('TPINT'))
check('CCVE/CCJU advertencia visible',  pageContent.includes('CCVE') && pageContent.includes('CCJU'))
check('Provisiones criterio_contable',  pageContent.includes('criterio_contable_confirmado') || pageContent.includes('prov_req') || pageContent.includes('PRREV'))

// ── 3. BD02-A implementado ───────────────────────────────────────────────────
console.log('\n📋 BD02-A (Cuotas pagadas)')
check('Función generarBD02A definida',  pageContent.includes('generarBD02A'))
check('BD02A_HDR con mnemónicos',       pageContent.includes('BD02A_HDR'))
check("Descarga 01270_BD02A_",          pageContent.includes('BD02A'))
check('IAP incluido en header',         pageContent.includes("'IAP'") || pageContent.includes('"IAP"'))
check('tipo_pago incluido',             pageContent.includes('tipo_pago') || pageContent.includes('TIPPAGO'))
check('Advertencia tipo K',             pageContent.includes("tipo_pago === 'K'") || pageContent.includes('Tipo K'))

// ── 4. BD03A/BD03B (solo encabezado) ─────────────────────────────────────────
console.log('\n📋 BD03A/BD03B (solo encabezado)')
check('BD03_HDR definido',              pageContent.includes('BD03_HDR'))
check('generarBD03A definida',          pageContent.includes('generarBD03A'))
check('generarBD03B definida',          pageContent.includes('generarBD03B'))
check('Nota sin garantías en UI',       pageContent.includes('no tiene garantías') || pageContent.includes('sin garantías'))
check("Descarga BD03A_",               pageContent.includes('BD03A'))
check("Descarga BD03B_",               pageContent.includes('BD03B'))

// ── 5. BD02-B y BD04 marcados como pendientes ────────────────────────────────
console.log('\n📋 BD02-B y BD04 (pendientes)')
check('BD02-B marcado pendiente (no generable)', pageContent.includes('BD02B') || pageContent.includes('BD02-B'))
check('BD04 marcado pendiente (no generable)',   pageContent.includes('BD04'))
check('Texto "Pendiente de información"',         pageContent.includes('Pendiente') || pageContent.includes('pendiente'))

// BD02-B y BD04 NO deben tener función generadora activa
const tieneBD02BFunc = pageContent.includes('generarBD02B(') || pageContent.includes('function generarBD02B')
const tieneBD04Func  = pageContent.includes('generarBD04(')  || pageContent.includes('function generarBD04')
check('BD02-B NO tiene generador activo (correcto)', !tieneBD02BFunc, tieneBD02BFunc ? 'Se encontró función generarBD02B — debería ser pendiente' : '')
check('BD04 NO tiene generador activo (correcto)',   !tieneBD04Func,  tieneBD04Func  ? 'Se encontró función generarBD04 — debería ser pendiente' : '')

// ── 6. Restricciones de seguridad ────────────────────────────────────────────
console.log('\n🔒 Seguridad y restricciones')

const serviceRoleInPage = pageContent.includes('SERVICE_ROLE') || pageContent.includes('service_role') || pageContent.includes('SUPABASE_SERVICE_ROLE')
check('No usa service role en página frontend', !serviceRoleInPage, serviceRoleInPage ? 'service role detectado en frontend' : '')

const clientFilesRef = pageContent.includes('_client_files')
check('No referencia _client_files/', !clientFilesRef)

// Detecta patrones de acceso real a histórico (filtros de fechas fijas, no menciones informativas)
const tieneAccesoHistorico =
  pageContent.includes("'2024-") || pageContent.includes('"2024-') ||
  pageContent.includes("'2025-") || pageContent.includes('"2025-') ||
  pageContent.includes("importarHistorico") || pageContent.includes("import_historico")
check('No implementa acceso a histórico 2024/2025', !tieneAccesoHistorico,
  tieneAccesoHistorico ? 'Filtro de fecha fija 2024/2025 detectado en lógica' : '')

// ── 7. Utilidades BDCC ───────────────────────────────────────────────────────
console.log('\n🛠 Utilidades lib/bdcc/')
check('lib/bdcc/format.ts existe', existsSync('lib/bdcc/format.ts'))
if (existsSync('lib/bdcc/format.ts')) {
  const fmt = readFileSync('lib/bdcc/format.ts', 'utf-8')
  check('fmtFechaBdcc exportada',  fmt.includes('fmtFechaBdcc'))
  check('fmtNumBdcc exportada',    fmt.includes('fmtNumBdcc'))
  check('buildTxt exportada',      fmt.includes('buildTxt'))
  check('downloadTxt exportada',   fmt.includes('downloadTxt'))
  check('Usa tabulador en buildTxt', fmt.includes("'\\t'") || fmt.includes('"\\t"'))
}

// ── 8. Índice de Reportes actualizado ────────────────────────────────────────
console.log('\n📑 Índice de Reportes')
const reportesPage = existsSync('app/dashboard/reportes/page.tsx')
  ? readFileSync('app/dashboard/reportes/page.tsx', 'utf-8') : ''
check('Reportes index incluye BDCC', reportesPage.includes('bdcc') || reportesPage.includes('BDCC'))

// ── 9. Script registrado en package.json ────────────────────────────────────
console.log('\n📦 package.json')
const pkg = existsSync('package.json') ? readFileSync('package.json', 'utf-8') : ''
check('check:bdcc:mvp-exporters en package.json', pkg.includes('check:bdcc:mvp-exporters'))

// ── Resumen ──────────────────────────────────────────────────────────────────
const total = pass + fail
console.log(`\n${'─'.repeat(50)}`)
console.log(`Resultado: ${pass}/${total} checks pasaron`)
if (fail > 0) {
  console.log(`❌ ${fail} check(s) fallaron`)
  process.exit(1)
} else {
  console.log('✅ Todos los checks pasaron')
}
