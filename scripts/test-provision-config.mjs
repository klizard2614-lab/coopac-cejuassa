/**
 * test-provision-config.mjs
 * L1 — Verifica que la tabla `configuracion` tiene tasas de provisión válidas.
 * No escribe datos. Seguro de ejecutar siempre.
 */

import { readFileSync } from 'fs'
import https from 'node:https'
import { URL } from 'node:url'

function loadEnv() {
  try {
    const raw = readFileSync('.env.local', 'utf8')
    return Object.fromEntries(
      raw.split('\n')
        .filter(l => l.includes('=') && !l.startsWith('#') && l.trim())
        .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
    )
  } catch { return {} }
}

const env = { ...loadEnv(), ...process.env }

const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SUPA_SRK = env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPA_URL || !SUPA_SRK) {
  console.error('✗ FAIL: NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY faltantes en .env.local')
  process.exit(1)
}

const CAMPOS = ['provision_normal', 'provision_cpp', 'provision_deficiente', 'provision_dudoso', 'provision_perdida']
const LABELS = {
  provision_normal:     'Normal',
  provision_cpp:        'CPP',
  provision_deficiente: 'Deficiente',
  provision_dudoso:     'Dudoso',
  provision_perdida:    'Pérdida',
}

let passed = 0, failed = 0

function pass(msg) { console.log(`  ✓ PASS: ${msg}`); passed++ }
function fail(msg) { console.error(`  ✗ FAIL: ${msg}`); failed++ }

function httpsGet(urlStr, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr)
    const req = https.get({ host: u.host, path: u.pathname + u.search, headers }, res => {
      let body = ''
      res.on('data', d => { body += d })
      res.on('end', () => resolve({ status: res.statusCode, body }))
    })
    req.on('error', reject)
    req.end()
  })
}

console.log('\n=== test:provision:config — Verificación de tasas en configuracion ===\n')

const apiUrl = `${SUPA_URL}/rest/v1/configuracion?id=eq.1&select=${CAMPOS.join(',')}`
let rows
try {
  const { status, body } = await httpsGet(apiUrl, {
    apikey: SUPA_SRK,
    Authorization: `Bearer ${SUPA_SRK}`,
    Accept: 'application/json',
  })
  if (status !== 200) {
    console.error(`ERROR: HTTP ${status} al leer configuracion. ${body}`)
    process.exit(1)
  }
  rows = JSON.parse(body)
} catch (e) {
  console.error(`ERROR: No se pudo conectar a Supabase. ${e.message}`)
  process.exit(1)
}

const data = rows[0]
if (!data) {
  console.error('ERROR: La tabla configuracion no tiene fila con id=1.')
  process.exit(1)
}

// T1 — Todos los campos existen y son números
console.log('[T1] Campos existen y son números válidos')
for (const campo of CAMPOS) {
  const val = data[campo]
  if (val === null || val === undefined) {
    fail(`${campo} es null o undefined`)
  } else if (typeof val !== 'number' || isNaN(val)) {
    fail(`${campo} no es número válido (valor: ${val})`)
  } else {
    pass(`${campo} = ${(val * 100).toFixed(4)}% (${LABELS[campo]})`)
  }
}

// T2 — Todos son >= 0
console.log('\n[T2] Todos los valores son >= 0')
for (const campo of CAMPOS) {
  const val = data[campo]
  if (typeof val === 'number' && val >= 0) {
    pass(`${campo} >= 0`)
  } else {
    fail(`${campo} tiene valor negativo (${val})`)
  }
}

// T3 — Orden creciente: normal <= cpp <= deficiente <= dudoso <= perdida
console.log('\n[T3] Orden creciente de tasas')
const [normal, cpp, def_, dudoso, perdida] = CAMPOS.map(c => data[c])

if (normal <= cpp)     pass(`normal (${normal}) <= cpp (${cpp})`)
else                   fail(`provision_normal (${normal}) debería ser <= provision_cpp (${cpp})`)

if (cpp <= def_)       pass(`cpp (${cpp}) <= deficiente (${def_})`)
else                   fail(`provision_cpp (${cpp}) debería ser <= provision_deficiente (${def_})`)

if (def_ <= dudoso)    pass(`deficiente (${def_}) <= dudoso (${dudoso})`)
else                   fail(`provision_deficiente (${def_}) debería ser <= provision_dudoso (${dudoso})`)

if (dudoso <= perdida) pass(`dudoso (${dudoso}) <= perdida (${perdida})`)
else                   fail(`provision_dudoso (${dudoso}) debería ser <= provision_perdida (${perdida})`)

// T4 — Pérdida = 1.00 (SBS exige 100%)
console.log('\n[T4] provision_perdida = 1.00 (requisito SBS)')
if (perdida === 1.00) {
  pass('provision_perdida = 1.00 (100% — conforme SBS)')
} else {
  fail(`provision_perdida = ${perdida} — SBS exige 1.00 (100%) para categoría Pérdida`)
}

// Resumen
console.log(`\n--- Resumen ---`)
console.log(`PASS: ${passed}  FAIL: ${failed}`)

if (failed > 0) {
  console.error('\n⚠ Algunos tests fallaron. Revise los parámetros financieros en Configuración.\n')
  process.exit(1)
} else {
  console.log('\n✅ Todos los tests pasaron. Las tasas de provisión están configuradas correctamente.\n')
  process.exit(0)
}
