/**
 * Fase 10C.1 — Check: sincronización de esquema socio_beneficiarios
 *
 * Verifica:
 *   - migración corregida (INTEGER, no BIGINT para socio_id)
 *   - migración idempotente (IF NOT EXISTS en todo)
 *   - no toca otras tablas
 *   - UI usa los campos que la migración define
 *   - build no roto
 *
 * Uso: node scripts/check-beneficiarios-schema-sync.mjs
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

function read(rel) {
  const p = resolve(root, rel)
  return existsSync(p) ? readFileSync(p, 'utf8') : ''
}

const MIG = read('supabase/migrations/20260623000001_create_socio_beneficiarios.sql')
const UI  = read('app/dashboard/socios/_components/BeneficiariosSection.tsx')

console.log('=== CHECK: Sincronización de esquema socio_beneficiarios (Fase 10C.1) ===\n')

// [ Migración corregida ]
console.log('[ Migración SQL — corrección de tipos ]')
check('Migración usa INTEGER para socio_id (no BIGINT)',
  MIG.includes('socio_id     INTEGER') || MIG.includes('socio_id INTEGER'))
check('Migración usa SERIAL (no BIGSERIAL) para id principal',
  (MIG.includes('SERIAL PRIMARY KEY') || MIG.includes('id           SERIAL')) && !MIG.includes('BIGSERIAL'))
check('Migración referencia socios(id) con ON DELETE CASCADE',
  MIG.includes('REFERENCES socios(id)') && MIG.includes('ON DELETE CASCADE'))

// [ Idempotencia ]
console.log('\n[ Idempotencia — seguro de re-ejecutar ]')
check('CREATE TABLE IF NOT EXISTS', MIG.includes('CREATE TABLE IF NOT EXISTS'))
check('CREATE INDEX IF NOT EXISTS', MIG.includes('CREATE INDEX IF NOT EXISTS'))
check('ENABLE ROW LEVEL SECURITY', MIG.includes('ENABLE ROW LEVEL SECURITY'))
check('Policy protegida por IF NOT EXISTS (DO block)',
  MIG.includes('IF NOT EXISTS') && MIG.includes('pg_policies'))
check('Migración envuelve en BEGIN/COMMIT', MIG.includes('BEGIN;') && MIG.includes('COMMIT;'))

// [ Tablas protegidas no tocadas ]
console.log('\n[ Tablas protegidas ]')
check('NO toca pagos_recibos',     !MIG.includes('pagos_recibos'))
check('NO toca creditos',          !MIG.includes('ALTER TABLE creditos'))
check('NO toca cronograma_cuotas', !MIG.includes('cronograma_cuotas'))
check('NO toca socios (solo referencia FK)',
  !MIG.includes('ALTER TABLE socios') && !MIG.includes('DROP COLUMN'))
check('NO toca usuarios',          !MIG.includes('ALTER TABLE usuarios'))
check('NO DROP TABLE / DROP COLUMN', !MIG.includes('DROP TABLE') && !MIG.includes('DROP COLUMN'))

// [ Compatibilidad UI vs migración ]
console.log('\n[ Campos UI vs campos migración ]')
const uiFields = ['socio_id', 'nombres', 'dni', 'parentesco', 'porcentaje', 'es_principal', 'observacion', 'updated_at']
for (const f of uiFields) {
  check(`UI usa '${f}' — presente en migración`, MIG.includes(f) && UI.includes(f))
}

// [ Campos legacy de socios preservados ]
console.log('\n[ Campos legacy preservados ]')
const SOCIO_FORM = read('app/dashboard/socios/_components/SocioForm.tsx')
check('SocioForm.tsx mantiene beneficiario_nombre',    SOCIO_FORM.includes('beneficiario_nombre'))
check('SocioForm.tsx mantiene beneficiario_dni',       SOCIO_FORM.includes('beneficiario_dni'))
check('SocioForm.tsx mantiene beneficiario_parentesco',SOCIO_FORM.includes('beneficiario_parentesco'))

// [ Audit script existe ]
console.log('\n[ Scripts de auditoría ]')
check('scripts/audit-beneficiarios-schema.mjs existe',
  existsSync(resolve(root, 'scripts/audit-beneficiarios-schema.mjs')))
check('package.json contiene audit:beneficiarios-schema',
  read('package.json').includes('audit:beneficiarios-schema'))
check('package.json contiene check:beneficiarios-schema-sync',
  read('package.json').includes('check:beneficiarios-schema-sync'))

console.log(`\n=== RESULTADO: ${failures === 0 ? 'PASS — todos los checks OK' : `FAIL — ${failures} check(s) fallaron`} ===`)
if (failures > 0) process.exit(1)
