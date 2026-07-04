#!/usr/bin/env node
// check-ampliaciones-global-page.mjs — Auditoría de la pantalla global de ampliaciones (Fase 10D-1B)
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const checks = []
let passed = 0
let failed = 0

function check(name, result, detail = '') {
  const ok = Boolean(result)
  const icon = ok ? '✅' : '❌'
  checks.push({ icon, name, detail })
  if (ok) passed++; else failed++
}

function readFile(rel) {
  const full = path.join(root, rel)
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf-8') : null
}

// ── Archivos clave ────────────────────────────────────────────────────────────

const pagePath   = 'app/dashboard/ampliaciones/page.tsx'
const layoutPath = 'app/dashboard/layout.tsx'

const pageSrc   = readFile(pagePath)
const layoutSrc = readFile(layoutPath)

// 1. Existe la ruta global
check('Existe app/dashboard/ampliaciones/page.tsx', pageSrc !== null, pagePath)

// 2. Consulta la tabla ampliaciones
check(
  "Consulta la tabla 'ampliaciones'",
  pageSrc?.includes("from('ampliaciones')") ?? false,
  "from('ampliaciones') encontrado"
)

// 3. Muestra aviso informativo
const tieneAviso =
  pageSrc?.includes('no modifican automáticamente el crédito') ||
  pageSrc?.includes('No modifican automáticamente el crédito') ||
  pageSrc?.includes('no modifica') ||
  pageSrc?.includes('No modifica')
check(
  'Muestra aviso informativo sobre no-modificación',
  tieneAviso ?? false,
  tieneAviso ? 'Aviso encontrado' : 'Aviso NO encontrado'
)

// 4. Tiene enlace al crédito relacionado
const tieneEnlace =
  pageSrc?.includes('/dashboard/creditos/') &&
  (pageSrc?.includes('Ver crédito') || pageSrc?.includes('ver crédito') || pageSrc?.includes('href'))
check(
  "Tiene enlace 'Ver crédito' al crédito relacionado",
  tieneEnlace ?? false,
  tieneEnlace ? 'Enlace encontrado' : 'Enlace NO encontrado'
)

// 5. NO contiene update a creditos
const badCreditos =
  pageSrc?.includes("from('creditos').update") ||
  pageSrc?.includes('from("creditos").update')
check(
  "No contiene update a 'creditos'",
  !badCreditos,
  badCreditos ? '⚠️  ENCONTRADO update a creditos' : 'Limpio'
)

// 6. NO contiene update a cronograma_cuotas
const badCronograma =
  pageSrc?.includes("from('cronograma_cuotas').update") ||
  pageSrc?.includes('from("cronograma_cuotas").update')
check(
  "No contiene update a 'cronograma_cuotas'",
  !badCronograma,
  badCronograma ? '⚠️  ENCONTRADO update a cronograma_cuotas' : 'Limpio'
)

// 7. NO contiene update a pagos_recibos
const badPagos =
  pageSrc?.includes("from('pagos_recibos').update") ||
  pageSrc?.includes('from("pagos_recibos").update')
check(
  "No contiene update a 'pagos_recibos'",
  !badPagos,
  badPagos ? '⚠️  ENCONTRADO update a pagos_recibos' : 'Limpio'
)

// 8. No recalcula saldos (no contiene cálculo de capital ni interés)
const recalcula =
  pageSrc?.includes('saldo_capital') && pageSrc?.includes('update') &&
  (pageSrc?.includes('= saldo') || pageSrc?.includes('recalcul'))
check(
  'No recalcula saldos de crédito',
  !recalcula,
  recalcula ? '⚠️  Posible recálculo de saldo detectado' : 'Sin recálculos'
)

// 9. No crea migraciones (no hay archivo SQL nuevo relacionado)
const migrationsDir = path.join(root, 'supabase', 'migrations')
let newMigration = false
if (fs.existsSync(migrationsDir)) {
  const files = fs.readdirSync(migrationsDir)
  newMigration = files.some(f => f.toLowerCase().includes('ampliacion'))
}
check(
  'No se crearon migraciones para ampliaciones',
  !newMigration,
  newMigration ? '⚠️  Migración encontrada' : 'Sin migraciones nuevas'
)

// 10. Sidebar actualizado con Ampliaciones
const sidebarTieneRuta = layoutSrc?.includes('/dashboard/ampliaciones') ?? false
check(
  'Sidebar actualizado con enlace a /dashboard/ampliaciones',
  sidebarTieneRuta,
  sidebarTieneRuta ? 'Enlace en layout.tsx encontrado' : 'Enlace NO encontrado en layout.tsx'
)

// 11. Tiene filtros (socio, pagaré, crédito, fecha)
const tieneFiltroSocio   = pageSrc?.includes('buscarSocio') ?? false
const tieneFiltroPagere  = pageSrc?.includes('buscarPagare') ?? false
const tieneFiltroCredito = pageSrc?.includes('buscarCredito') ?? false
const tieneFechaDesde    = pageSrc?.includes('fechaDesde') ?? false
const tieneFechaHasta    = pageSrc?.includes('fechaHasta') ?? false
check(
  'Tiene filtro por socio',
  tieneFiltroSocio,
  tieneFiltroSocio ? 'buscarSocio encontrado' : 'buscarSocio NO encontrado'
)
check(
  'Tiene filtro por pagaré',
  tieneFiltroPagere,
  tieneFiltroPagere ? 'buscarPagare encontrado' : 'buscarPagare NO encontrado'
)
check(
  'Tiene filtro por crédito',
  tieneFiltroCredito,
  tieneFiltroCredito ? 'buscarCredito encontrado' : 'buscarCredito NO encontrado'
)
check(
  'Tiene filtro fecha desde / hasta',
  tieneFechaDesde && tieneFechaHasta,
  (tieneFechaDesde && tieneFechaHasta) ? 'fechaDesde + fechaHasta encontrados' : 'Filtros de fecha incompletos'
)

// 12. Tiene botón limpiar filtros
const tieneLimpiar = pageSrc?.includes('limpiarFiltros') || pageSrc?.includes('Limpiar filtros')
check(
  'Tiene botón limpiar filtros',
  tieneLimpiar ?? false,
  tieneLimpiar ? 'limpiarFiltros encontrado' : 'Botón limpiar NO encontrado'
)

// 13. Maneja estados vacíos (sin null/undefined/NaN expuesto)
const tieneEstadoVacio = pageSrc?.includes('Sin ampliaciones registradas') || pageSrc?.includes('Sin ampliaciones')
const tieneEstadoLoading = pageSrc?.includes('Cargando') || pageSrc?.includes('loading')
const tieneEstadoError = pageSrc?.includes('error') && pageSrc?.includes('Error')
check(
  'Maneja estado vacío (sin ampliaciones)',
  tieneEstadoVacio ?? false,
  tieneEstadoVacio ? 'Mensaje de estado vacío encontrado' : 'NO encontrado'
)
check(
  'Maneja estado de carga (loading)',
  tieneEstadoLoading ?? false,
  tieneEstadoLoading ? 'Estado loading encontrado' : 'NO encontrado'
)
check(
  'Maneja estado de error',
  tieneEstadoError ?? false,
  tieneEstadoError ? 'Estado error encontrado' : 'NO encontrado'
)

// 14. Roles permitidos declarados
const tieneRolesPermitidos =
  pageSrc?.includes('ROLES_PERMITIDOS') ||
  (pageSrc?.includes("'admin'") && pageSrc?.includes("'creditos'") && pageSrc?.includes("'contabilidad'"))
check(
  'Tiene control de acceso por rol',
  tieneRolesPermitidos ?? false,
  tieneRolesPermitidos ? 'Roles encontrados' : 'Control de roles NO encontrado'
)

// 15. No inserta ni actualiza ampliaciones desde esta pantalla (sin formulario de creación)
const sinFormCreacion = !(pageSrc?.includes('.insert(') || pageSrc?.includes('.upsert('))
check(
  'No tiene formulario de creación/edición de ampliaciones',
  sinFormCreacion,
  sinFormCreacion ? 'Solo lectura — sin insert ni upsert' : '⚠️  Detectado insert/upsert en pantalla global'
)

// ── Reporte ───────────────────────────────────────────────────────────────────

console.log('\n=== check:ampliaciones-global (Fase 10D-1B) ===\n')
for (const c of checks) {
  console.log(`${c.icon} ${c.name}`)
  if (c.detail) console.log(`     ${c.detail}`)
}
console.log(`\nResultado: ${passed}/${passed + failed} checks PASS`)

if (failed > 0) {
  console.error(`\n❌  ${failed} check(s) fallaron.\n`)
  process.exit(1)
} else {
  console.log('\n✅  Todos los checks pasaron.\n')
}
