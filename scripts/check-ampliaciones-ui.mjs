#!/usr/bin/env node
// check-ampliaciones-ui.mjs — Auditoría de la UI de ampliaciones (Fase 10D-1)
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

const componentPath = 'app/dashboard/creditos/_components/AmpliacionesSection.tsx'
const detailPath    = 'app/dashboard/creditos/[id]/page.tsx'

const componentSrc = readFile(componentPath)
const detailSrc    = readFile(detailPath)

// 1. Existe el componente
check('Componente AmpliacionesSection.tsx existe', componentSrc !== null, componentPath)

// 2. Integrado en detalle de crédito
check(
  'AmpliacionesSection integrada en creditos/[id]/page.tsx',
  detailSrc?.includes('AmpliacionesSection') ?? false,
  detailPath
)

// 3. Usa la tabla ampliaciones
check(
  "Componente usa la tabla 'ampliaciones'",
  componentSrc?.includes("from('ampliaciones')") ?? false,
  "from('ampliaciones') encontrado"
)

// 4. NO contiene updates a creditos
const badCreditos = componentSrc?.includes("from('creditos').update") ||
                    componentSrc?.includes('from("creditos").update')
check(
  "No contiene updates a 'creditos'",
  !badCreditos,
  badCreditos ? '⚠️  ENCONTRADO update a creditos' : 'Limpio'
)

// 5. NO contiene updates a cronograma_cuotas
const badCronograma = componentSrc?.includes("from('cronograma_cuotas').update") ||
                      componentSrc?.includes('from("cronograma_cuotas").update')
check(
  "No contiene updates a 'cronograma_cuotas'",
  !badCronograma,
  badCronograma ? '⚠️  ENCONTRADO update a cronograma_cuotas' : 'Limpio'
)

// 6. NO contiene updates a pagos_recibos
const badPagos = componentSrc?.includes("from('pagos_recibos').update") ||
                 componentSrc?.includes('from("pagos_recibos").update')
check(
  "No contiene updates a 'pagos_recibos'",
  !badPagos,
  badPagos ? '⚠️  ENCONTRADO update a pagos_recibos' : 'Limpio'
)

// 7. No crea migraciones (no hay archivo SQL nuevo relacionado)
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

// 8. Tiene aviso "no modifica automáticamente"
const hasAviso = componentSrc?.includes('no modifica') || componentSrc?.includes('No modifica')
check(
  "Tiene aviso 'no modifica automáticamente'",
  hasAviso ?? false,
  hasAviso ? 'Aviso encontrado' : 'Aviso NO encontrado'
)

// 9. Guards por rol (useRol + canWrite/canDelete)
const hasRolGuard = componentSrc?.includes('useRol') &&
                    componentSrc?.includes('canWrite') &&
                    componentSrc?.includes('canDelete')
check(
  'Tiene guards por rol (useRol, canWrite, canDelete)',
  hasRolGuard ?? false,
  hasRolGuard ? 'Guards presentes' : 'Guards ausentes'
)

// 10. Admin puede eliminar, creditos no
const adminDelete  = componentSrc?.includes("rol === 'admin'") && componentSrc?.includes('canDelete')
const creditosOnly = componentSrc?.includes("rol === 'creditos'")
check(
  "Admin puede eliminar; creditos solo escribir",
  (adminDelete && creditosOnly) ?? false,
  adminDelete ? 'Control de roles correcto' : 'Revisar control de roles'
)

// ── Reporte ───────────────────────────────────────────────────────────────────

console.log('\n=== check:ampliaciones-ui ===\n')
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
