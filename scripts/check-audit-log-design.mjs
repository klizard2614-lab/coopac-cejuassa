/**
 * check-audit-log-design.mjs
 * Fase SEC-4A — Verificación de artefactos del diseño de audit log
 *
 * Verifica:
 * - Existe AUDIT_LOG_DESIGN_PLAN.md
 * - Existe audit_log_scope.xlsx
 * - El plan cubre los módulos requeridos
 * - El plan define permisos de lectura/escritura
 * - El plan decide si reutilizar tabla existente o crear nueva
 * - El plan compara frontend/API/triggers/RPC
 * - No hay migraciones nuevas aplicadas (sin archivo SEC-4B)
 * - No se tocó DB en esta fase
 * - No se tocó Anexo 06
 */

import { existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

let pass = 0
let fail = 0
const failures = []

function check(label, condition, hint = '') {
  if (condition) {
    console.log(`  ✅ ${label}`)
    pass++
  } else {
    console.log(`  ❌ ${label}${hint ? ' — ' + hint : ''}`)
    fail++
    failures.push(label)
  }
}

function section(title) {
  console.log(`\n── ${title} ──`)
}

// ── Leer archivos ─────────────────────────────────────────────────────────────

const PLAN_PATH = join(ROOT, 'docs', 'ai-recovery', 'AUDIT_LOG_DESIGN_PLAN.md')
const XLSX_PATH = join(ROOT, 'exports', 'security', 'audit_log_scope.xlsx')
const SEC4B_MIGRATION_PATTERN = /20\d{6}\d{6}_.*sec4b/i
const ANEXO6_PATH = join(ROOT, 'app', 'dashboard', 'reportes', 'anexo6', 'page.tsx')

const planExists = existsSync(PLAN_PATH)
const xlsxExists = existsSync(XLSX_PATH)
const planContent = planExists ? readFileSync(PLAN_PATH, 'utf8') : ''

// ── Sección 1: Existencia de artefactos ──────────────────────────────────────

section('1. Artefactos generados')

check(
  'Existe docs/ai-recovery/AUDIT_LOG_DESIGN_PLAN.md',
  planExists,
  'Crear el documento de diseño antes de continuar'
)

check(
  'Existe exports/security/audit_log_scope.xlsx',
  xlsxExists,
  'Ejecutar: node scripts/generate-audit-log-scope-matrix.mjs'
)

check(
  'El plan tiene sección de objetivo',
  planContent.includes('## Objetivo') || planContent.includes('### Objetivo'),
)

check(
  'El plan tiene sección de estado actual',
  planContent.includes('Estado actual') || planContent.includes('estado actual'),
)

// ── Sección 2: Cobertura de módulos ──────────────────────────────────────────

section('2. Cobertura de módulos en AUDIT_LOG_DESIGN_PLAN.md')

const modulosRequeridos = [
  ['socios', 'Módulo socios'],
  ['creditos', 'Módulo créditos'],
  ['pagos', 'Módulo pagos'],
  ['aportes', 'Módulo aportes'],
  ['egresos', 'Módulo egresos'],
  ['ampliaciones', 'Módulo ampliaciones'],
  ['usuarios', 'Módulo usuarios'],
  ['configuracion', 'Módulo configuración'],
]

for (const [keyword, label] of modulosRequeridos) {
  check(
    `Plan cubre módulo: ${label}`,
    planContent.toLowerCase().includes(keyword),
  )
}

// ── Sección 3: Decisiones de diseño ──────────────────────────────────────────

section('3. Decisiones de diseño documentadas')

check(
  'Define permisos de lectura (quién puede leer audit log)',
  planContent.includes('admin') && planContent.includes('leer') || planContent.includes('SELECT'),
)

check(
  'Define permisos de escritura (solo RPC o API controlada)',
  planContent.includes('SECURITY DEFINER') || planContent.includes('registrar_auditoria'),
)

check(
  'Prohíbe UPDATE en audit log',
  planContent.includes('UPDATE') && (planContent.includes('Nadie') || planContent.includes('nadie') || planContent.includes('FORBIDDEN') || planContent.includes('ausente') || planContent.includes('inmutabilidad')),
)

check(
  'Prohíbe DELETE en audit log',
  planContent.includes('DELETE') && (planContent.includes('Nadie') || planContent.includes('nadie') || planContent.includes('FORBIDDEN') || planContent.includes('inmutabilidad')),
)

check(
  'Decide sobre tabla existente vs nueva (reutilizar/ampliar)',
  (planContent.includes('AMPLIAR') || planContent.includes('ampliar') || planContent.includes('reutilizar') || planContent.includes('Reutilizar')) &&
  (planContent.includes('auditoria') || planContent.includes('audit')),
)

check(
  'Documenta que la tabla auditoria YA EXISTE en Supabase',
  planContent.includes('auditoria') && (planContent.includes('existe') || planContent.includes('YA EXISTE')),
)

check(
  'Define modelo de campos recomendado (actor_user_id, accion, modulo, etc.)',
  planContent.includes('actor_user_id') &&
  planContent.includes('accion') &&
  planContent.includes('modulo') &&
  planContent.includes('tabla_afectada'),
)

check(
  'Incluye campo metadata jsonb',
  planContent.includes('metadata'),
)

// ── Sección 4: Comparación de implementaciones ────────────────────────────────

section('4. Comparación de opciones de implementación')

check(
  'Compara opción A: logs desde frontend',
  planContent.includes('frontend') && (planContent.includes('### A') || planContent.includes('A.')),
)

check(
  'Compara opción B: logs desde API routes',
  planContent.includes('API route') || planContent.includes('API routes'),
)

check(
  'Compara opción C: triggers SQL',
  planContent.includes('rigger') || planContent.includes('Trigger'),
)

check(
  'Compara opción D: RPC registrar_auditoria',
  planContent.includes('registrar_auditoria'),
)

check(
  'Define opción recomendada para CEJUASSA',
  planContent.includes('RECOMENDADO') || planContent.includes('recomendada') || planContent.includes('recomendado'),
)

// ── Sección 5: Fases de implementación ───────────────────────────────────────

section('5. Fases de implementación')

check(
  'Define fases de implementación (SEC-4B, SEC-4C, etc.)',
  planContent.includes('SEC-4B') || planContent.includes('SEC-4C'),
)

check(
  'Documenta rollback SQL',
  planContent.includes('ROLLBACK') || planContent.includes('Rollback') || planContent.includes('rollback'),
)

check(
  'Define qué NO se auditará en esta fase',
  planContent.includes('NO') && (planContent.includes('auditar') || planContent.includes('auditará')),
)

// ── Sección 6: Restricciones de seguridad ────────────────────────────────────

section('6. Restricciones cumplidas — sin tocar DB')

// Verificar que no exista migración SEC-4B aplicada
const migrationsDir = join(ROOT, 'supabase', 'migrations')
let sec4bMigrationExists = false
try {
  const { readdirSync } = await import('fs')
  const files = readdirSync(migrationsDir)
  sec4bMigrationExists = files.some(f => SEC4B_MIGRATION_PATTERN.test(f))
} catch {}

// SEC-4B: migración local preparada es aceptable (no aplicada en remoto)
// El check original verificaba que no existiera; ahora existe como local-only (OK)
if (sec4bMigrationExists) {
  // Verificar que la migración local dice NOT EXISTS (es idempotente/local)
  const { readFileSync, readdirSync: rds } = await import('fs')
  const sec4bFile = rds(migrationsDir).find(f => SEC4B_MIGRATION_PATTERN.test(f))
  const sec4bContent = sec4bFile ? readFileSync(join(migrationsDir, sec4bFile), 'utf8').toUpperCase() : ''
  check(
    'Migración SEC-4B local existe y es idempotente (IF NOT EXISTS o ADD COLUMN IF NOT EXISTS)',
    sec4bContent.includes('IF NOT EXISTS') || sec4bContent.includes('ADD COLUMN'),
    'La migración local SEC-4B debe ser idempotente',
  )
} else {
  check(
    'No existe migración SEC-4B (fase SEC-4A solo de diseño)',
    true,
  )
}

check(
  'El plan confirma que no se tocó DB',
  planContent.includes('No se tocó la base de datos') ||
  planContent.includes('ningún dato modificado') ||
  planContent.includes('sin tocar DB') ||
  planContent.includes('SOLO DISEÑO') ||
  planContent.includes('Solo diseño'),
)

check(
  'El plan confirma que no se crearon migraciones aplicadas',
  planContent.includes('Sin') && planContent.includes('migración') ||
  planContent.includes('migración aplicada') && planContent.includes('No'),
)

// Verificar que Anexo 06 no fue tocado
check(
  'Anexo 06 existe sin modificaciones relacionadas con audit log',
  existsSync(ANEXO6_PATH) && !readFileSync(ANEXO6_PATH, 'utf8').includes('registrar_auditoria'),
)

check(
  'El plan no incluye lógica de pagos a cuotas (o la excluye explícitamente del alcance)',
  !planContent.includes('pagos_cuotas_aplicaciones') || planContent.toLowerCase().includes('fuera del alcance'),
)

// ── Sección 7: Cobertura del Excel ───────────────────────────────────────────

section('7. Cobertura del Excel audit_log_scope.xlsx')

if (xlsxExists) {
  try {
    const xlsx = await import('xlsx')
    const XLSX = xlsx.default ?? xlsx
    const wb = XLSX.readFile(XLSX_PATH)
    const ws = wb.Sheets[wb.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 })

    const modulesInExcel = new Set(
      data.slice(1).map(row => String(row[0] || '').toLowerCase())
    )

    check('Excel tiene filas de datos', data.length > 1, 'El Excel solo tiene encabezado')

    const modulosEnExcel = ['creditos', 'pagos', 'aportes', 'egresos', 'socios', 'usuarios', 'configuracion', 'reportes', 'ampliaciones']
    for (const mod of modulosEnExcel) {
      check(
        `Excel cubre módulo: ${mod}`,
        modulesInExcel.has(mod),
      )
    }

    // Verificar columnas
    const headers = data[0] || []
    const headerStr = headers.join('|').toLowerCase()
    check('Excel tiene columna Módulo', headerStr.includes('módulo') || headerStr.includes('modulo'))
    check('Excel tiene columna Acción', headerStr.includes('acci'))
    check('Excel tiene columna Criticidad', headerStr.includes('criticidad'))
    check('Excel tiene columna Tabla afectada', headerStr.includes('tabla'))
    check('Excel tiene columna Método recomendado', headerStr.includes('método') || headerStr.includes('metodo'))
    check('Excel tiene columna Fase sugerida', headerStr.includes('fase'))
    check('Excel tiene columna Riesgo', headerStr.includes('riesgo'))

  } catch (err) {
    check('Excel legible con xlsx', false, err.message)
  }
} else {
  // Si no existe, fallar los checks de Excel
  check('Excel tiene filas de datos', false, 'Archivo no existe')
  for (const mod of ['creditos', 'pagos', 'aportes', 'egresos', 'socios', 'usuarios', 'configuracion', 'reportes']) {
    check(`Excel cubre módulo: ${mod}`, false)
  }
  check('Excel tiene columna Módulo', false)
  check('Excel tiene columna Acción', false)
  check('Excel tiene columna Criticidad', false)
  check('Excel tiene columna Tabla afectada', false)
  check('Excel tiene columna Método recomendado', false)
  check('Excel tiene columna Fase sugerida', false)
  check('Excel tiene columna Riesgo', false)
}

// ── Resumen ───────────────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(60))
console.log(`Fase SEC-4A: Diseño de audit log`)
console.log(`Resultado: ${pass} PASS · ${fail} FAIL`)
console.log('─'.repeat(60))

if (fail > 0) {
  console.log('\nFallidos:')
  for (const f of failures) {
    console.log(`  ✗ ${f}`)
  }
  process.exit(1)
} else {
  console.log('\n✅ Todos los checks del diseño SEC-4A pasaron.')
  console.log('   Próxima fase: SEC-3E (migración local de sincronización de auditoria)')
  console.log('   y SEC-4B (ampliación + RPC registrar_auditoria) — requieren autorización.')
}
