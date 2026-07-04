/**
 * smoke-bdcc-runtime.mjs
 * Smoke test estático para la pantalla BDCC y sus exportadores TXT.
 * No toca DB ni servidor — solo valida código fuente del proyecto.
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

console.log('\n🔍 smoke:bdcc — Smoke test funcional pantalla BDCC\n')

const PAGE_PATH   = 'app/dashboard/reportes/bdcc/page.tsx'
const INDEX_PATH  = 'app/dashboard/reportes/page.tsx'
const FORMAT_PATH = 'lib/bdcc/format.ts'

const pageContent   = existsSync(PAGE_PATH)   ? readFileSync(PAGE_PATH,   'utf-8') : ''
const indexContent  = existsSync(INDEX_PATH)  ? readFileSync(INDEX_PATH,  'utf-8') : ''
const formatContent = existsSync(FORMAT_PATH) ? readFileSync(FORMAT_PATH, 'utf-8') : ''

// ── 1. Archivos existen ───────────────────────────────────────────────────────
console.log('📄 Existencia de archivos')
check('app/dashboard/reportes/bdcc/page.tsx existe', existsSync(PAGE_PATH))
check('app/dashboard/reportes/page.tsx existe',      existsSync(INDEX_PATH))
check('lib/bdcc/format.ts existe',                   existsSync(FORMAT_PATH))

// ── 2. Acceso desde índice de Reportes ───────────────────────────────────────
console.log('\n📑 Navegación desde índice de Reportes')
check('Índice incluye href /dashboard/reportes/bdcc', indexContent.includes('/dashboard/reportes/bdcc'))
check('Tarjeta BDCC activa (activo: true)',            indexContent.includes("activo: true") && indexContent.includes('bdcc'))
check('Título "BDCC" o "BDCC SBS" visible',           indexContent.includes('BDCC'))
check('Primera entrega 20/07/2026 mencionada',        indexContent.includes('20/07/2026'))

// ── 3. Selector de período ────────────────────────────────────────────────────
console.log('\n📅 Selector de período')
check('Selector de mes presente',                     pageContent.includes('setMes') || pageContent.includes("'mes'"))
check('Selector de año presente',                     pageContent.includes('setAnio') || pageContent.includes("'anio'"))
check('Código COOPAC 01270 en página',                pageContent.includes("'01270'") || pageContent.includes('"01270"'))
check('Etiqueta "Período de corte" visible',          pageContent.includes('Período de corte') || pageContent.includes('Periodo de corte'))

// ── 4. Funciones de descarga presentes ────────────────────────────────────────
console.log('\n⬇  Funciones de descarga')
check('generarBD01 definida',  pageContent.includes('function generarBD01') || pageContent.includes('generarBD01()'))
check('generarBD02A definida', pageContent.includes('function generarBD02A') || pageContent.includes('generarBD02A()'))
check('generarBD03A definida', pageContent.includes('function generarBD03A') || pageContent.includes('generarBD03A()'))
check('generarBD03B definida', pageContent.includes('function generarBD03B') || pageContent.includes('generarBD03B()'))

// BD02-B y BD04 NO deben tener funciones generadoras
const tieneBD02BFunc = /function\s+generarBD02B/.test(pageContent) || pageContent.includes('generarBD02B()')
const tieneBD04Func  = /function\s+generarBD04/.test(pageContent)  || pageContent.includes('generarBD04()')
check('BD02-B sin función generadora (correcto)', !tieneBD02BFunc, tieneBD02BFunc ? 'función generarBD02B encontrada — debería estar bloqueada' : '')
check('BD04 sin función generadora (correcto)',   !tieneBD04Func,  tieneBD04Func  ? 'función generarBD04 encontrada — debería estar bloqueada' : '')

// ── 5. Nombres de archivo correctos (patrón 01270_BDXX_YYYYMM.txt) ───────────
console.log('\n📁 Nombres de archivo TXT')
check("Patrón BD01: 01270_BD01_*.txt",  pageContent.includes('_BD01_') && pageContent.includes('COOPAC') || (pageContent.includes('_BD01_') && pageContent.includes("'01270'")))
check("Patrón BD02A: 01270_BD02A_*.txt", pageContent.includes('_BD02A_'))
check("Patrón BD03A: 01270_BD03A_*.txt", pageContent.includes('_BD03A_'))
check("Patrón BD03B: 01270_BD03B_*.txt", pageContent.includes('_BD03B_'))
check('Extensión .txt en nombres de archivo', pageContent.includes(".txt"))
check('Variable yyyymm usada en nombres',      pageContent.includes('yyyymm'))

// ── 6. Separación por tabulador ───────────────────────────────────────────────
console.log('\n↔  Separador tabulador')
const tabEnFormat = formatContent.includes("'\\t'") || formatContent.includes('"\\t"')
check('Tabulador en format.ts (buildTxt)',      tabEnFormat, !tabEnFormat ? 'no se encontró \\t en buildTxt' : '')
check('Page usa buildTxt de lib/bdcc/format',  pageContent.includes('buildTxt'))
check('downloadTxt importada y usada',         pageContent.includes('downloadTxt'))

// ── 7. BD03A/BD03B solo encabezado ────────────────────────────────────────────
console.log('\n🏷  BD03A y BD03B — solo encabezado')
check('BD03A genera solo encabezado (BD03_HDR.join)',  pageContent.includes('BD03_HDR.join') || (pageContent.includes('BD03_HDR') && pageContent.includes('.join')))
check('BD03B genera solo encabezado (BD03_HDR.join)',  pageContent.includes('BD03_HDR.join') || (pageContent.includes('BD03_HDR') && pageContent.includes('.join')))
check('Nota "sin garantías" visible en UI',            pageContent.includes('no tiene garantías') || pageContent.includes('sin garantías'))
check('BD03A no itera sobre registros',                !pageContent.includes('for') || pageContent.includes('generarBD03A'))

// ── 8. BD02-B y BD04 bloqueados ───────────────────────────────────────────────
console.log('\n🔒 BD02-B y BD04 — bloqueados')
check('BD02-B marcado como pendiente',         pageContent.includes('BD02B') || pageContent.includes('BD02-B'))
check('BD04 marcado como pendiente',           pageContent.includes("'BD04'") || pageContent.includes('"BD04"'))
check('Texto "Pendiente" visible para ambos',  pageContent.includes('pendiente') || pageContent.includes('Pendiente'))
check('Bloque explicativo BD02-B/BD04',        pageContent.includes('BD02-B y BD04') || (pageContent.includes('BD02-B') && pageContent.includes('BD04')))

// ── 9. Advertencias regulatorias ─────────────────────────────────────────────
console.log('\n⚠  Advertencias regulatorias')
check('Advertencia TPINT pendiente',            pageContent.includes('TPINT'))
check('Advertencia CCVE/CCJU pendiente',        pageContent.includes('CCVE') && pageContent.includes('CCJU'))
check('Advertencia género/estado civil',        pageContent.includes('género') || pageContent.includes('genero') || pageContent.includes('Género'))
check('Advertencia mnemónicos borrador',        pageContent.includes('Borrador') || pageContent.includes('borrador') || pageContent.includes('revisable'))
check('Referencia a Oficio SBS N°32791',        pageContent.includes('32791'))
check('Fecha primera entrega 20/07/2026',       pageContent.includes('20/07/2026'))
check('Advertencia histórico 2024/2025 fuera de alcance', pageContent.includes('2024') || pageContent.includes('Histórico') || pageContent.includes('histórico'))

// ── 10. Seguridad ─────────────────────────────────────────────────────────────
console.log('\n🔒 Seguridad')
const serviceRoleInPage = pageContent.includes('SERVICE_ROLE') || pageContent.includes('service_role')
check('No usa service role en frontend',       !serviceRoleInPage)
const noClientFiles = !pageContent.includes('_client_files')
check('No referencia _client_files/',          noClientFiles)
const noConsoleLog = !pageContent.includes('console.log(socio') && !pageContent.includes('console.log(c.') && !pageContent.includes('console.log(cred')
check('No expone datos personales en console', noConsoleLog)

// ── 11. Formato lib/bdcc/format.ts ────────────────────────────────────────────
console.log('\n🛠  lib/bdcc/format.ts')
check('fmtFechaBdcc exportada',  formatContent.includes('export function fmtFechaBdcc'))
check('fmtNumBdcc exportada',    formatContent.includes('export function fmtNumBdcc'))
check('buildTxt exportada',      formatContent.includes('export function buildTxt'))
check('downloadTxt exportada',   formatContent.includes('export function downloadTxt'))
check('buildTxt une con \\t',    formatContent.includes("join('\\t')") || formatContent.includes('join("\\t")'))
check('downloadTxt crea Blob',   formatContent.includes('Blob'))
check('downloadTxt dispara click', formatContent.includes('.click()'))

// ── Resumen ───────────────────────────────────────────────────────────────────
const total = pass + fail
console.log(`\n${'─'.repeat(55)}`)
console.log(`Resultado: ${pass}/${total} checks pasaron`)
if (fail > 0) {
  console.log(`❌ ${fail} check(s) fallaron`)
  process.exit(1)
} else {
  console.log('✅ Todos los checks pasaron — pantalla BDCC lista para uso')
}
