/**
 * Fase 10C — Check: módulo socio_beneficiarios
 *
 * Verifica que todos los artefactos del módulo existen y los campos
 * legacy de socios no fueron eliminados.
 *
 * Uso: node scripts/check-socio-beneficiarios-module.mjs
 */

import { existsSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const PASS = '  ✓'
const FAIL = '  ✗'

let failures = 0

function check(label, ok, detail = '') {
  if (ok) {
    console.log(`${PASS} ${label}`)
  } else {
    console.log(`${FAIL} ${label}${detail ? ': ' + detail : ''}`)
    failures++
  }
}

function fileExists(rel) {
  return existsSync(resolve(root, rel))
}

function fileContains(rel, ...strings) {
  if (!fileExists(rel)) return false
  const content = readFileSync(resolve(root, rel), 'utf8')
  return strings.every(s => content.includes(s))
}

console.log('=== CHECK: Módulo socio_beneficiarios (Fase 10C) ===\n')

// 1. Migración existe
console.log('[ Migración SQL ]')
check(
  'supabase/migrations/20260623000001_create_socio_beneficiarios.sql existe',
  fileExists('supabase/migrations/20260623000001_create_socio_beneficiarios.sql')
)
check(
  'Migración define CREATE TABLE IF NOT EXISTS socio_beneficiarios',
  fileContains('supabase/migrations/20260623000001_create_socio_beneficiarios.sql', 'CREATE TABLE IF NOT EXISTS socio_beneficiarios')
)
check(
  'Migración contiene socio_id FK a socios',
  fileContains('supabase/migrations/20260623000001_create_socio_beneficiarios.sql', 'REFERENCES socios(id)')
)
check(
  'Migración contiene RLS ENABLE ROW LEVEL SECURITY',
  fileContains('supabase/migrations/20260623000001_create_socio_beneficiarios.sql', 'ENABLE ROW LEVEL SECURITY')
)
check(
  'Migración contiene índice por socio_id',
  fileContains('supabase/migrations/20260623000001_create_socio_beneficiarios.sql', 'idx_socio_beneficiarios_socio_id')
)

// 2. Scripts
console.log('\n[ Scripts ]')
check(
  'scripts/dry-run-migrate-socio-beneficiarios.mjs existe',
  fileExists('scripts/dry-run-migrate-socio-beneficiarios.mjs')
)
check(
  'scripts/migrate-socio-beneficiarios.mjs existe',
  fileExists('scripts/migrate-socio-beneficiarios.mjs')
)
check(
  'migrate-apply requiere --apply --authorized',
  fileContains('scripts/migrate-socio-beneficiarios.mjs', '--apply', '--authorized')
)

// 3. UI
console.log('\n[ UI — Componente BeneficiariosSection ]')
check(
  'app/dashboard/socios/_components/BeneficiariosSection.tsx existe',
  fileExists('app/dashboard/socios/_components/BeneficiariosSection.tsx')
)
check(
  'BeneficiariosSection exporta función',
  fileContains('app/dashboard/socios/_components/BeneficiariosSection.tsx', 'export function BeneficiariosSection')
)
check(
  'BeneficiariosSection maneja es_principal',
  fileContains('app/dashboard/socios/_components/BeneficiariosSection.tsx', 'es_principal')
)
check(
  'BeneficiariosSection muestra legacy si sin registros nuevos',
  fileContains('app/dashboard/socios/_components/BeneficiariosSection.tsx', 'campo legacy')
)

// 4. UI integrado en páginas socio
console.log('\n[ UI — Integración en páginas de socio ]')
check(
  'app/dashboard/socios/[id]/page.tsx importa BeneficiariosSection',
  fileContains('app/dashboard/socios/[id]/page.tsx', 'BeneficiariosSection')
)
check(
  'app/dashboard/socios/[id]/editar/page.tsx importa BeneficiariosSection',
  fileContains('app/dashboard/socios/[id]/editar/page.tsx', 'BeneficiariosSection')
)

// 5. Campos legacy NO eliminados
console.log('\n[ Campos legacy preservados ]')
check(
  'SocioForm.tsx mantiene beneficiario_nombre',
  fileContains('app/dashboard/socios/_components/SocioForm.tsx', 'beneficiario_nombre')
)
check(
  'SocioForm.tsx mantiene beneficiario_dni',
  fileContains('app/dashboard/socios/_components/SocioForm.tsx', 'beneficiario_dni')
)
check(
  'SocioForm.tsx mantiene beneficiario_parentesco',
  fileContains('app/dashboard/socios/_components/SocioForm.tsx', 'beneficiario_parentesco')
)
check(
  'Detalle de socio muestra campo legacy Beneficiario FPS',
  fileContains('app/dashboard/socios/[id]/page.tsx', 'beneficiario_nombre', 'beneficiario_dni', 'beneficiario_parentesco')
)

// 6. Tablas protegidas NO tocadas
console.log('\n[ Tablas protegidas ]')
const migracion = fileExists('supabase/migrations/20260623000001_create_socio_beneficiarios.sql')
  ? readFileSync(resolve(root, 'supabase/migrations/20260623000001_create_socio_beneficiarios.sql'), 'utf8')
  : ''
check('Migración NO modifica pagos_recibos',     !migracion.includes('pagos_recibos'))
check('Migración NO modifica creditos',           !migracion.includes('ALTER TABLE creditos'))
check('Migración NO modifica cronograma_cuotas', !migracion.includes('cronograma_cuotas'))
check('Migración NO modifica usuarios',           !migracion.includes('ALTER TABLE usuarios'))

// 7. npm scripts en package.json
console.log('\n[ npm scripts ]')
check(
  'package.json contiene beneficiarios:dry-run',
  fileContains('package.json', 'beneficiarios:dry-run')
)
check(
  'package.json contiene check:beneficiarios-module',
  fileContains('package.json', 'check:beneficiarios-module')
)

// Resumen
console.log(`\n=== RESULTADO: ${failures === 0 ? 'PASS — todos los checks OK' : `FAIL — ${failures} check(s) fallaron`} ===`)
if (failures > 0) process.exit(1)
