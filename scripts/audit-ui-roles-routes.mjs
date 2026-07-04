/**
 * audit-ui-roles-routes.mjs
 * Auditoría estática de guards de rol en rutas y botones de la app CEJUASSA.
 * Uso: node scripts/audit-ui-roles-routes.mjs
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const ROOT = resolve('.')

let passed = 0
let failed = 0
let warnings = 0

function read(rel) {
  const abs = resolve(ROOT, rel)
  if (!existsSync(abs)) return null
  return readFileSync(abs, 'utf8')
}

function check(desc, ok, detail = '') {
  if (ok) {
    console.log(`  ✅ ${desc}`)
    passed++
  } else {
    console.log(`  ❌ ${desc}${detail ? ' — ' + detail : ''}`)
    failed++
  }
}

function warn(desc, detail = '') {
  console.log(`  ⚠️  ${desc}${detail ? ' — ' + detail : ''}`)
  warnings++
}

function section(title) {
  console.log(`\n── ${title} ──`)
}

// ── 1. SIDEBAR ──────────────────────────────────────────────────────────────

section('Sidebar (layout.tsx)')

const layout = read('app/dashboard/layout.tsx') ?? ''

check(
  'HIDDEN_FOR_ROLE existe',
  layout.includes('HIDDEN_FOR_ROLE'),
)
check(
  'tesoreria oculta Usuarios y Configuración',
  layout.includes("tesoreria:") &&
  layout.includes("'/dashboard/usuarios'") &&
  layout.includes("'/dashboard/configuracion'"),
)
check(
  'creditos oculta Egresos, Usuarios y Configuración',
  layout.includes("creditos:") &&
  layout.includes("'/dashboard/egresos'"),
)
check(
  'contabilidad oculta Convenios, Usuarios y Configuración',
  layout.includes("contabilidad:") &&
  layout.includes("'/dashboard/convenios'"),
)
check(
  'getVisibleItems usa loading para evitar flash',
  layout.includes('if (loading) return []'),
)
check(
  'useRol llamado correctamente en layout',
  layout.includes("const { rol, loading } = useRol()"),
)

// ── 2. ROUTE GUARDS — FORMULARIOS CRÍTICOS ───────────────────────────────

section('Route guards — formularios críticos')

const sociosNuevo = read('app/dashboard/socios/nuevo/page.tsx') ?? ''
check(
  'socios/nuevo: guard admin+creditos',
  sociosNuevo.includes("PUEDE_CREAR_SOCIOS") &&
  sociosNuevo.includes("'admin'") &&
  sociosNuevo.includes("'creditos'") &&
  sociosNuevo.includes('AccesoDenegado'),
)

const sociosEditar = read('app/dashboard/socios/[id]/editar/page.tsx') ?? ''
check(
  'socios/[id]/editar: guard admin+creditos',
  sociosEditar.includes("PUEDE_EDITAR_SOCIOS") &&
  sociosEditar.includes("'admin'") &&
  sociosEditar.includes("'creditos'") &&
  sociosEditar.includes('AccesoDenegado'),
)

const creditosNuevo = read('app/dashboard/creditos/nuevo/page.tsx') ?? ''
check(
  'creditos/nuevo: guard admin+creditos',
  creditosNuevo.includes("PUEDE_CREAR_CREDITOS") &&
  creditosNuevo.includes("'admin'") &&
  creditosNuevo.includes("'creditos'") &&
  creditosNuevo.includes('AccesoDenegado'),
)

const creditosEditar = read('app/dashboard/creditos/[id]/editar/page.tsx') ?? ''
check(
  'creditos/[id]/editar: guard admin+creditos',
  creditosEditar.includes("PUEDE_EDITAR_CREDITOS") &&
  creditosEditar.includes("'admin'") &&
  creditosEditar.includes("'creditos'") &&
  creditosEditar.includes('AccesoDenegado'),
)

const pagosNuevo = read('app/dashboard/pagos/nuevo/page.tsx') ?? ''
check(
  'pagos/nuevo: guard admin+tesoreria',
  pagosNuevo.includes("PUEDE_CREAR_PAGOS") &&
  pagosNuevo.includes("'admin'") &&
  pagosNuevo.includes("'tesoreria'") &&
  pagosNuevo.includes('AccesoDenegado'),
)

// ── 3. ROUTE GUARDS — MÓDULOS ADMINISTRATIVOS ────────────────────────────

section('Route guards — módulos administrativos')

const usuariosPage = read('app/dashboard/usuarios/page.tsx') ?? ''
check(
  'usuarios/page.tsx: guard admin (AccesoDenegado o inline)',
  (usuariosPage.includes("AccesoDenegado") || usuariosPage.includes("Acceso restringido")) &&
  (usuariosPage.includes("!== 'admin'") || usuariosPage.includes("rolActual !== 'admin'")),
)

const usuariosNuevo = read('app/dashboard/usuarios/nuevo/page.tsx') ?? ''
check(
  'usuarios/nuevo/page.tsx: guard admin',
  usuariosNuevo.includes("AccesoDenegado") &&
  (usuariosNuevo.includes("rol !== 'admin'") || usuariosNuevo.includes("!== 'admin'")),
)

const configPage = read('app/dashboard/configuracion/page.tsx') ?? ''
check(
  'configuracion/page.tsx: guard admin',
  configPage.includes("AccesoDenegado") &&
  (configPage.includes("rol !== 'admin'") || configPage.includes("!== 'admin'")),
)

// ── 4. ROUTE GUARDS — MÓDULOS CON RESTRICCIÓN DE ROL ────────────────────

section('Route guards — módulos con restricción específica')

const egresosPage = read('app/dashboard/egresos/page.tsx') ?? ''
check(
  "egresos/page.tsx: importa AccesoDenegado",
  egresosPage.includes("import AccesoDenegado"),
)
check(
  "egresos/page.tsx: bloquea rol 'creditos'",
  egresosPage.includes("rol === 'creditos'") && egresosPage.includes("AccesoDenegado"),
)
check(
  "egresos/page.tsx: PUEDE_EDITAR_EGRESOS = ['admin', 'tesoreria']",
  egresosPage.includes("PUEDE_EDITAR_EGRESOS") &&
  egresosPage.includes("'admin'") &&
  egresosPage.includes("'tesoreria'"),
)

const bdccPage = read('app/dashboard/reportes/bdcc/page.tsx') ?? ''
check(
  "reportes/bdcc/page.tsx: importa useRol y AccesoDenegado",
  bdccPage.includes("import { useRol }") &&
  bdccPage.includes("import AccesoDenegado"),
)
check(
  "reportes/bdcc/page.tsx: PUEDE_VER_BDCC = ['admin', 'contabilidad']",
  bdccPage.includes("PUEDE_VER_BDCC") &&
  bdccPage.includes("'admin'") &&
  bdccPage.includes("'contabilidad'"),
)
check(
  "reportes/bdcc/page.tsx: guard activo",
  bdccPage.includes("PUEDE_VER_BDCC.includes") && bdccPage.includes("AccesoDenegado"),
)

// ── 5. BOTONES EN LISTAS ────────────────────────────────────────────────

section('Botones en listas')

const sociosPage = read('app/dashboard/socios/page.tsx') ?? ''
check(
  "socios/page.tsx: botón Nuevo Socio condicional (puedeEditar)",
  sociosPage.includes("puedeEditar") &&
  sociosPage.includes("Nuevo Socio") &&
  (sociosPage.includes("rol === 'admin' || rol === 'creditos'") ||
   sociosPage.includes("'admin'") && sociosPage.includes("'creditos'")),
)

const creditosPageFile = read('app/dashboard/creditos/page.tsx') ?? ''
check(
  "creditos/page.tsx: botón Nuevo Crédito condicional (puedeEditar)",
  creditosPageFile.includes("puedeEditar") &&
  (creditosPageFile.includes("Nuevo Crédito") || creditosPageFile.includes("Nuevo Cr")),
)

const pagosPage = read('app/dashboard/pagos/page.tsx') ?? ''
check(
  "pagos/page.tsx: botón Registrar Pago condicional (puedeRegistrar)",
  pagosPage.includes("puedeRegistrar") &&
  (pagosPage.includes("Registrar Pago") || pagosPage.includes("Registrar")),
)

const aportesPage = read('app/dashboard/aportes/page.tsx') ?? ''
check(
  "aportes/page.tsx: botón aporte condicional (admin/tesoreria)",
  aportesPage.includes("'admin'") &&
  aportesPage.includes("'tesoreria'"),
)

// ── 6. USO CORRECTO DE useRol ────────────────────────────────────────────

section('Uso correcto de useRol')

const filesToCheckUseRol = [
  'app/dashboard/socios/nuevo/page.tsx',
  'app/dashboard/socios/[id]/editar/page.tsx',
  'app/dashboard/creditos/nuevo/page.tsx',
  'app/dashboard/creditos/[id]/editar/page.tsx',
  'app/dashboard/pagos/nuevo/page.tsx',
  'app/dashboard/egresos/page.tsx',
  'app/dashboard/reportes/bdcc/page.tsx',
]

for (const f of filesToCheckUseRol) {
  const content = read(f) ?? ''
  const usesRol = content.includes('useRol()')
  const hasLoading = content.includes('loading') || content.includes('checkingRol')
  if (!usesRol) {
    warn(`${f}: no usa useRol()`)
  } else if (!hasLoading) {
    warn(`${f}: usa useRol() pero no verifica loading`)
  } else {
    passed++
    console.log(`  ✅ ${f}: useRol() + loading OK`)
  }
}

// ── 7. API ROUTES ────────────────────────────────────────────────────────

section('API routes (service role confinado)')

const inviteRoute = read('app/api/usuarios/invite/route.ts') ?? ''
check(
  'invite/route.ts: usa requireAdmin',
  inviteRoute.includes('requireAdmin'),
)

const updateRoute = read('app/api/usuarios/update/route.ts') ?? ''
check(
  'update/route.ts: usa requireAdmin',
  updateRoute.includes('requireAdmin'),
)

const requireAdmin = read('lib/api/requireAdmin.ts') ?? ''
check(
  'lib/api/requireAdmin.ts: existe',
  requireAdmin.length > 0,
)

// ── RESUMEN ──────────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(50))
console.log(`Resultado: ${passed} ✅  ${failed} ❌  ${warnings} ⚠️`)
if (failed > 0) {
  console.log('\n❌ Auditoría FALLIDA — corregir los checks marcados con ❌')
  process.exit(1)
} else {
  console.log('\n✅ Auditoría PASADA')
}
