/**
 * Fase 10C — Apply: migrar beneficiario legacy → socio_beneficiarios
 *
 * REQUIERE autorización explícita: --apply --authorized
 * No borra columnas legacy de socios. Evita duplicados.
 *
 * Uso: node scripts/migrate-socio-beneficiarios.mjs --apply --authorized
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)

if (!args.includes('--apply') || !args.includes('--authorized')) {
  console.error('DETENIDO: Este script modifica datos reales.')
  console.error('Para ejecutar: node scripts/migrate-socio-beneficiarios.mjs --apply --authorized')
  console.error('Primero ejecuta el dry-run: npm run beneficiarios:dry-run')
  process.exit(1)
}

function loadEnv() {
  const envPath = resolve(__dirname, '..', '.env.local')
  try {
    const raw = readFileSync(envPath, 'utf8')
    for (const line of raw.split('\n')) {
      const [k, ...rest] = line.split('=')
      if (k && rest.length) process.env[k.trim()] = rest.join('=').trim()
    }
  } catch { /* no .env.local */ }
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
  console.log('=== APPLY: Migración beneficiario legacy → socio_beneficiarios ===\n')

  const { data: socios, error } = await supabase
    .from('socios')
    .select('id, nro_socio, beneficiario_nombre, beneficiario_dni, beneficiario_parentesco')
    .not('beneficiario_nombre', 'is', null)
    .order('id')

  if (error) {
    console.error('Error al leer socios:', error.message)
    process.exit(1)
  }

  const candidatos = socios.filter(s => s.beneficiario_nombre?.trim())
  console.log(`Candidatos a migrar: ${candidatos.length}`)

  let insertados = 0
  let omitidos = 0
  let errores = 0

  for (const s of candidatos) {
    // Verificar si ya existe un beneficiario para este socio con el mismo nombre
    const { data: existentes, error: checkErr } = await supabase
      .from('socio_beneficiarios')
      .select('id')
      .eq('socio_id', s.id)
      .eq('nombres', s.beneficiario_nombre.trim())
      .limit(1)

    if (checkErr) {
      console.error(`  Error verificando socio ${s.nro_socio}: ${checkErr.message}`)
      errores++
      continue
    }

    if (existentes.length > 0) {
      omitidos++
      continue
    }

    const { error: insertErr } = await supabase
      .from('socio_beneficiarios')
      .insert({
        socio_id:    s.id,
        nombres:     s.beneficiario_nombre.trim(),
        dni:         s.beneficiario_dni?.trim() || null,
        parentesco:  s.beneficiario_parentesco?.trim() || null,
        es_principal: true,
      })

    if (insertErr) {
      console.error(`  Error insertando beneficiario de socio ${s.nro_socio}: ${insertErr.message}`)
      errores++
    } else {
      insertados++
    }
  }

  console.log(`\nInsertados:  ${insertados}`)
  console.log(`Omitidos (ya existían): ${omitidos}`)
  console.log(`Errores:     ${errores}`)
  console.log('\nColumnas legacy de socios NO modificadas.')
  console.log('=== FIN APPLY ===')
}

main()
