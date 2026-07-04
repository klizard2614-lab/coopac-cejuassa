/**
 * Fase 10C — Dry-run: migrar beneficiario legacy a socio_beneficiarios
 *
 * Lee socios con campos beneficiario_nombre / beneficiario_dni / beneficiario_parentesco
 * y reporta cuántos podrían migrarse. NO inserta nada.
 *
 * Uso: node scripts/dry-run-migrate-socio-beneficiarios.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Leer .env.local si existe
function loadEnv() {
  const envPath = resolve(__dirname, '..', '.env.local')
  try {
    const raw = readFileSync(envPath, 'utf8')
    for (const line of raw.split('\n')) {
      const [k, ...rest] = line.split('=')
      if (k && rest.length) process.env[k.trim()] = rest.join('=').trim()
    }
  } catch { /* no .env.local, usar vars del entorno */ }
}

loadEnv()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridas.')
  process.exit(1)
}

const supabase = createClient(url, key)

async function main() {
  console.log('=== DRY-RUN: Migración beneficiario legacy → socio_beneficiarios ===\n')

  // 1. Leer todos los socios
  const { data: socios, error } = await supabase
    .from('socios')
    .select('id, nro_socio, beneficiario_nombre, beneficiario_dni, beneficiario_parentesco')
    .order('id')

  if (error) {
    console.error('Error al leer socios:', error.message)
    process.exit(1)
  }

  const total = socios.length
  const conNombre      = socios.filter(s => s.beneficiario_nombre?.trim())
  const conDni         = socios.filter(s => s.beneficiario_dni?.trim())
  const conParentesco  = socios.filter(s => s.beneficiario_parentesco?.trim())
  const listosMigrar   = socios.filter(s => s.beneficiario_nombre?.trim())

  console.log(`Total socios en base:            ${total}`)
  console.log(`Con beneficiario_nombre:         ${conNombre.length}`)
  console.log(`Con beneficiario_dni:            ${conDni.length}`)
  console.log(`Con beneficiario_parentesco:     ${conParentesco.length}`)
  console.log(`Migrables (tienen nombre):       ${listosMigrar.length}`)

  // 2. Verificar si ya existen registros en socio_beneficiarios (tabla podría no existir aún)
  try {
    const { count, error: countErr } = await supabase
      .from('socio_beneficiarios')
      .select('*', { count: 'exact', head: true })

    if (countErr) {
      console.log('\nTabla socio_beneficiarios: NO EXISTE todavía (migración pendiente)')
    } else {
      console.log(`\nTabla socio_beneficiarios: EXISTE — ${count} registros actuales`)
    }
  } catch {
    console.log('\nTabla socio_beneficiarios: NO EXISTE todavía')
  }

  // 3. Preview de los primeros 5 migrables
  if (listosMigrar.length > 0) {
    console.log('\nPrimeros candidatos a migrar:')
    listosMigrar.slice(0, 5).forEach(s => {
      console.log(`  Socio ${s.nro_socio} (id=${s.id}): "${s.beneficiario_nombre}" DNI=${s.beneficiario_dni ?? '—'} parentesco=${s.beneficiario_parentesco ?? '—'}`)
    })
    if (listosMigrar.length > 5) console.log(`  ... y ${listosMigrar.length - 5} más`)
  }

  console.log('\n=== FIN DRY-RUN — no se insertó nada ===')
  console.log('\nPara aplicar: node scripts/migrate-socio-beneficiarios.mjs --apply --authorized')
}

main()
