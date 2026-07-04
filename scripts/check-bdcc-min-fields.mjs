import { readFileSync, readdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const MIGRATION_FILE = '20260620000001_bdcc_min_fields.sql'
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations')

function readFileSafe(p) {
  try { return readFileSync(p, 'utf-8') } catch { return '' }
}

function walkTsx(dir, acc = []) {
  try {
    for (const f of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, f.name)
      if (f.isDirectory()) walkTsx(p, acc)
      else if (f.name.endsWith('.tsx') || f.name.endsWith('.ts')) acc.push(p)
    }
  } catch {}
  return acc
}

const migration = readFileSafe(join(MIGRATIONS_DIR, MIGRATION_FILE))

const checks = [
  {
    id: 'migration-exists',
    desc: `Migración ${MIGRATION_FILE} existe`,
    pass: migration.length > 0,
  },
  {
    id: 'col-genero',
    desc: 'socios.genero en migración (ADD COLUMN IF NOT EXISTS)',
    pass: /ADD COLUMN IF NOT EXISTS genero/i.test(migration),
  },
  {
    id: 'col-estado-civil',
    desc: 'socios.estado_civil en migración',
    pass: /ADD COLUMN IF NOT EXISTS estado_civil/i.test(migration),
  },
  {
    id: 'col-nro-expediente',
    desc: 'creditos.nro_expediente en migración',
    pass: /ADD COLUMN IF NOT EXISTS nro_expediente/i.test(migration),
  },
  {
    id: 'col-tipo-credito-sbs',
    desc: 'creditos.tipo_credito_sbs en migración',
    pass: /ADD COLUMN IF NOT EXISTS tipo_credito_sbs/i.test(migration),
  },
  {
    id: 'col-subtipo-credito-sbs',
    desc: 'creditos.subtipo_credito_sbs en migración',
    pass: /ADD COLUMN IF NOT EXISTS subtipo_credito_sbs/i.test(migration),
  },
  {
    id: 'col-cuenta-contable-bd01',
    desc: 'creditos.cuenta_contable_bd01 en migración',
    pass: /ADD COLUMN IF NOT EXISTS cuenta_contable_bd01/i.test(migration),
  },
  {
    id: 'col-aporte-descontado',
    desc: 'creditos.aporte_descontado en migración',
    pass: /ADD COLUMN IF NOT EXISTS aporte_descontado/i.test(migration),
  },
  {
    id: 'col-tramite',
    desc: 'creditos.tramite en migración',
    pass: /ADD COLUMN IF NOT EXISTS tramite/i.test(migration),
  },
  {
    id: 'col-tipo-pago',
    desc: 'pagos_recibos.tipo_pago en migración',
    pass: /ADD COLUMN IF NOT EXISTS tipo_pago/i.test(migration),
  },
  {
    id: 'codigo-coopac-01270',
    desc: 'codigo_coopac 01270 contemplado en migración',
    pass: /01270/.test(migration),
  },
  {
    id: 'no-historico',
    desc: 'Sin referencias a histórico 2024/2025 en migración',
    pass: !/2024|2025/.test(migration),
  },
  {
    id: 'no-create-table',
    desc: 'Sin CREATE TABLE en migración (solo ADD COLUMN)',
    pass: !/CREATE\s+TABLE/i.test(migration),
  },
  {
    id: 'idempotent',
    desc: 'Migración usa IF NOT EXISTS (idempotente)',
    pass: /IF NOT EXISTS/i.test(migration),
  },
  {
    id: 'no-service-role-frontend',
    desc: 'Sin SUPABASE_SERVICE_ROLE_KEY en componentes frontend',
    pass: (() => {
      const appFiles = walkTsx(join(ROOT, 'app')).filter(p => !p.includes(`${join('app', 'api')}`))
      return !appFiles.some(p => readFileSafe(p).includes('SUPABASE_SERVICE_ROLE_KEY'))
    })(),
  },
  {
    id: 'no-bdcc-exporters',
    desc: 'Sin exportadores BDCC implementados en esta fase',
    pass: (() => {
      try {
        const files = readdirSync(join(ROOT, 'scripts'))
        return !files.some(f => /export.*bd0[1-4]|bd0[1-4].*export|generate.*bd0[1-4]/i.test(f))
      } catch { return true }
    })(),
  },
]

let passed = 0
let failed = 0

console.log('\ncheck:bdcc:min-fields — Fase 8A-2 (Migraciones mínimas BDCC/SBS)\n')

for (const c of checks) {
  if (c.pass) {
    console.log(`  ✓ ${c.desc}`)
    passed++
  } else {
    console.log(`  ✗ FAIL: ${c.desc}`)
    failed++
  }
}

console.log(`\n${passed}/${checks.length} checks passed`)

if (failed > 0) {
  console.log(`\n⚠ ${failed} check(s) fallaron. Revisar migración antes de aplicar.`)
  process.exit(1)
} else {
  console.log('\n✓ Fase 8A-2: Migración lista. Campos mínimos BDCC/SBS presentes. Sin exportadores, sin histórico, sin service role en frontend.')
  process.exit(0)
}
