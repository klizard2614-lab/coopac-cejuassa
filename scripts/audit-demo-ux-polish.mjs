/**
 * audit-demo-ux-polish.mjs
 * Validación estática de UX/demo readiness para CEJUASSA.
 * No conecta a Supabase. Solo analiza archivos del proyecto.
 */

import { existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

let passed = 0
let failed = 0
const issues = []

function check(label, ok, detail = '') {
  if (ok) {
    passed++
    console.log(`  ✅ ${label}`)
  } else {
    failed++
    issues.push({ label, detail })
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function fileExists(rel) {
  return existsSync(join(ROOT, rel))
}

function readFile(rel) {
  try { return readFileSync(join(ROOT, rel), 'utf-8') } catch { return '' }
}

function fileContains(rel, ...patterns) {
  const content = readFile(rel)
  return patterns.every(p => content.includes(p))
}

function fileNotContains(rel, pattern) {
  return !readFile(rel).includes(pattern)
}

console.log('\n📋 audit:demo-ux-polish — Validación estática de UX CEJUASSA\n')

// ── 1. Rutas principales existen ─────────────────────────────────────────────
console.log('1. Rutas principales')
const rutas = [
  'app/dashboard/page.tsx',
  'app/dashboard/layout.tsx',
  'app/dashboard/socios/page.tsx',
  'app/dashboard/creditos/page.tsx',
  'app/dashboard/creditos/[id]/page.tsx',
  'app/dashboard/creditos/nuevo/page.tsx',
  'app/dashboard/pagos/page.tsx',
  'app/dashboard/pagos/nuevo/page.tsx',
  'app/dashboard/aportes/page.tsx',
  'app/dashboard/egresos/page.tsx',
  'app/dashboard/cartera/page.tsx',
  'app/dashboard/mora/page.tsx',
  'app/dashboard/convenios/page.tsx',
  'app/dashboard/reportes/page.tsx',
  'app/dashboard/reportes/anexo6/page.tsx',
  'app/dashboard/reportes/bdcc/page.tsx',
  'app/dashboard/ampliaciones/page.tsx',
]
for (const ruta of rutas) {
  check(`Ruta existe: ${ruta}`, fileExists(ruta))
}

// ── 2. Estados vacíos principales ────────────────────────────────────────────
console.log('\n2. Estados vacíos mejorados')

check(
  'Socios: estado vacío con contexto de búsqueda',
  fileContains('app/dashboard/socios/page.tsx', 'Sin resultados para', 'No hay socios registrados')
)
check(
  'Créditos: estado vacío con contexto de búsqueda',
  fileContains('app/dashboard/creditos/page.tsx', 'Sin resultados para', 'No hay créditos registrados')
)
check(
  'Pagos: estado vacío con contexto de filtros',
  fileContains('app/dashboard/pagos/page.tsx', 'Sin pagos que coincidan', 'No hay pagos registrados')
)
check(
  'Aportes: estado vacío con contexto de período',
  fileContains('app/dashboard/aportes/page.tsx', 'Sin aportes registrados en', 'Sin coincidencias para')
)
check(
  'Egresos: estado vacío informativo (DB vacía)',
  fileContains('app/dashboard/egresos/page.tsx', 'Aún no se han registrado egresos', '+ Nuevo Egreso')
)
check(
  'Cartera: estado vacío con contexto de filtros',
  fileContains('app/dashboard/cartera/page.tsx', 'Sin créditos que coincidan', 'No hay créditos vigentes')
)
check(
  'Ampliaciones: estado vacío con contexto',
  fileContains('app/dashboard/ampliaciones/page.tsx', 'Sin ampliaciones que coincidan', 'Sin ampliaciones registradas')
)

// ── 3. Botones "Limpiar filtros" ──────────────────────────────────────────────
console.log('\n3. Limpiar filtros disponibles')

check(
  'Egresos: botón limpiar filtros',
  fileContains('app/dashboard/egresos/page.tsx', 'handleLimpiar', 'Limpiar')
)
check(
  'Pagos: limpiar filtros en empty state',
  fileContains('app/dashboard/pagos/page.tsx', 'Limpiar filtros')
)
check(
  'Cartera: botón limpiar filtros',
  fileContains('app/dashboard/cartera/page.tsx', 'Limpiar filtros')
)
check(
  'Ampliaciones: limpiar filtros',
  fileContains('app/dashboard/ampliaciones/page.tsx', 'limpiarFiltros', 'Limpiar filtros')
)

// ── 4. Banners DEMO ────────────────────────────────────────────────────────────
console.log('\n4. Banners DEMO / No oficial')

check(
  'BDCC: banner DEMO prominente',
  fileContains('app/dashboard/reportes/bdcc/page.tsx', 'DEMO', 'NO ENVIAR A SBS')
)
check(
  'Anexo 6: banner DEMO',
  fileContains('app/dashboard/reportes/anexo6/page.tsx', 'DEMO')
)
check(
  'Ampliaciones: aviso informativo',
  fileContains('app/dashboard/ampliaciones/page.tsx', 'Registros informativos', 'No modifican automáticamente')
)
check(
  'Ampliaciones (sección crédito): aviso',
  fileContains('app/dashboard/creditos/_components/AmpliacionesSection.tsx', 'Registro informativo')
)

// ── 5. Sin TODO/FIXME visibles ────────────────────────────────────────────────
console.log('\n5. Sin marcadores de código incompleto')

const dashboardFiles = [
  'app/dashboard/page.tsx',
  'app/dashboard/socios/page.tsx',
  'app/dashboard/creditos/page.tsx',
  'app/dashboard/pagos/page.tsx',
  'app/dashboard/aportes/page.tsx',
  'app/dashboard/egresos/page.tsx',
  'app/dashboard/cartera/page.tsx',
  'app/dashboard/ampliaciones/page.tsx',
]
const todoPattern = /\bTODO\b|\bFIXME\b|\bhardcoded\b/i
for (const f of dashboardFiles) {
  const content = readFile(f)
  const hasTodo = todoPattern.test(content)
  check(`Sin TODO/FIXME: ${f.replace('app/dashboard/', '')}`, !hasTodo)
}

// ── 6. Sin confirm() nativo en módulos nuevos ─────────────────────────────────
console.log('\n6. Sin confirm() nativo')

const newModuleFiles = [
  'app/dashboard/ampliaciones/page.tsx',
  'app/dashboard/creditos/_components/AmpliacionesSection.tsx',
  'app/dashboard/socios/_components/BeneficiariosSection.tsx',
]
for (const f of newModuleFiles) {
  const content = readFile(f)
  const hasConfirm = /\bwindow\.confirm\b|\bconfirm\(/.test(content)
  check(`Sin confirm() nativo: ${f.split('/').pop()}`, !hasConfirm)
}

// ── 7. Sidebar tiene rutas válidas ────────────────────────────────────────────
console.log('\n7. Sidebar — rutas en navItems')

const sidebarContent = readFile('app/dashboard/layout.tsx')
const expectedSidebarRoutes = [
  '/dashboard/socios',
  '/dashboard/creditos',
  '/dashboard/ampliaciones',
  '/dashboard/pagos',
  '/dashboard/aportes',
  '/dashboard/egresos',
  '/dashboard/convenios',
  '/dashboard/cartera',
  '/dashboard/mora',
  '/dashboard/reportes',
  '/dashboard/usuarios',
  '/dashboard/configuracion',
]
for (const route of expectedSidebarRoutes) {
  check(`Sidebar tiene ruta: ${route}`, sidebarContent.includes(route))
}

// ── 8. NaN/undefined peligrosos ───────────────────────────────────────────────
console.log('\n8. Sin NaN/undefined visibles en UI')

const uiFiles = [
  'app/dashboard/socios/page.tsx',
  'app/dashboard/creditos/page.tsx',
  'app/dashboard/pagos/page.tsx',
  'app/dashboard/aportes/page.tsx',
  'app/dashboard/egresos/page.tsx',
]
for (const f of uiFiles) {
  const content = readFile(f)
  // Buscar patrones peligrosos: {undefined} o {NaN} sueltos en JSX
  const hasDangerous = />\s*\{(undefined|NaN)\}\s*</.test(content)
  check(`Sin NaN/undefined expuesto: ${f.split('/').pop()}`, !hasDangerous)
}

// ── Resumen ───────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60))
console.log(`\nResultado: ${passed} PASS / ${failed} FAIL\n`)

if (issues.length > 0) {
  console.log('Issues encontrados:')
  for (const issue of issues) {
    console.log(`  ❌ ${issue.label}${issue.detail ? ` — ${issue.detail}` : ''}`)
  }
  console.log()
}

if (failed > 0) process.exit(1)
