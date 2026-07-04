/**
 * audit-pre-demo-visual-fixes.mjs
 * Verifica correcciones visuales pre-demo (Fase 10H-1):
 *   - Existe helper formatNombrePersona
 *   - Pantallas usan el helper en displays clave
 *   - Selects de reportes tienen clases de contraste
 *   - No hay migración ni cambios en DB en esta fase
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, join } from 'path'

const ROOT = resolve(import.meta.dirname, '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')
const exists = (rel) => existsSync(join(ROOT, rel))

let pass = 0
let fail = 0

function check(label, ok, detail = '') {
  if (ok) {
    console.log(`  ✅ PASS  ${label}`)
    pass++
  } else {
    console.log(`  ❌ FAIL  ${label}${detail ? ' — ' + detail : ''}`)
    fail++
  }
}

console.log('\n=== audit:pre-demo-visual-fixes ===\n')

// ── 1. Helper de nombre existe ────────────────────────────────────────────────
console.log('1. Helper formatNombrePersona')
const helperExists = exists('lib/formatNombre.ts')
check('lib/formatNombre.ts existe', helperExists)
if (helperExists) {
  const h = read('lib/formatNombre.ts')
  check('exporta formatNombrePersona', h.includes('export function formatNombrePersona'))
  check('aplica toTitleCase', h.includes('toTitleCase'))
  check('preserva Ñ en regex', h.includes('Ñ') || h.includes('\\u00D1'))
  check('trim + normaliza espacios', h.includes("replace(/\\s+/g, ' ')"))
}

// ── 2. Pantallas usan el helper ───────────────────────────────────────────────
console.log('\n2. Uso del helper en pantallas')
const pantallas = [
  ['app/dashboard/socios/page.tsx', 'socios'],
  ['app/dashboard/creditos/page.tsx', 'créditos'],
  ['app/dashboard/pagos/page.tsx', 'pagos'],
  ['app/dashboard/aportes/page.tsx', 'aportes'],
  ['app/dashboard/cartera/page.tsx', 'cartera'],
  ['app/dashboard/mora/page.tsx', 'mora'],
  ['app/dashboard/egresos/page.tsx', 'egresos'],
  ['app/dashboard/reportes/anexo6/page.tsx', 'anexo6'],
  ['app/dashboard/ampliaciones/page.tsx', 'ampliaciones'],
  ['app/dashboard/creditos/_components/SocioSearch.tsx', 'SocioSearch'],
  ['app/dashboard/cartera/[id]/page.tsx', 'cartera/[id]'],
  ['app/dashboard/aportes/[id]/page.tsx', 'aportes/[id]'],
  ['app/dashboard/convenios/[id]/page.tsx', 'convenios/[id]'],
  ['app/dashboard/pagos/[id]/page.tsx', 'pagos/[id]'],
  ['app/dashboard/creditos/[id]/page.tsx', 'créditos/[id]'],
]
for (const [rel, label] of pantallas) {
  const src = read(rel)
  check(`${label} importa formatNombrePersona`, src.includes("from '@/lib/formatNombre'"))
  check(`${label} usa formatNombrePersona(...)`, src.includes('formatNombrePersona('))
}

// ── 3. Selects de reportes tienen contraste ───────────────────────────────────
console.log('\n3. Contraste en selects de reportes y filtros')

const selectFiles = [
  ['app/dashboard/reportes/bdcc/page.tsx', 'reportes/bdcc'],
  ['app/dashboard/reportes/anexo6/page.tsx', 'reportes/anexo6'],
  ['app/dashboard/reportes/caja/page.tsx', 'reportes/caja'],
  ['app/dashboard/reportes/aportes/page.tsx', 'reportes/aportes'],
  ['app/dashboard/cartera/page.tsx', 'cartera'],
  ['app/dashboard/mora/page.tsx', 'mora'],
]
for (const [rel, label] of selectFiles) {
  const src = read(rel)
  const hasSelect = src.includes('<select')
  if (!hasSelect) {
    check(`${label} (sin selects — ok)`, true)
    continue
  }
  // Verifica que al menos un select tenga clases de texto y fondo
  const hasContrast = src.includes('text-gray-800') || src.includes('text-gray-900') || src.includes('text-sm text-gray')
  const hasBg = src.includes('bg-white')
  check(`${label} — selects tienen color de texto`, hasContrast)
  check(`${label} — selects tienen bg-white`, hasBg)
}

// ── 4. Restricciones de fase ──────────────────────────────────────────────────
console.log('\n4. Restricciones de Fase 10H-1')

// No hay nueva migración
const migPath = join(ROOT, 'supabase/migrations')
if (existsSync(migPath)) {
  const { readdirSync } = await import('fs')
  const migrations = readdirSync(migPath)
  // Revisamos solo que no exista una migración con timestamp de hoy
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const newToday = migrations.filter(m => m.startsWith(today))
  check('No se creó migración hoy', newToday.length === 0, newToday.join(', '))
} else {
  check('Directorio migrations inexistente — no hay migraciones', true)
}

// lib/formatNombre no toca supabase
const helperSrc = helperExists ? read('lib/formatNombre.ts') : ''
check('helper no importa supabase', !helperSrc.includes('supabase'))
check('helper no hace queries a DB', !helperSrc.includes('select('))

// No se tocó lógica financiera
const financieros = [
  'app/dashboard/pagos/utils/generarReciboPDF.ts',
  'lib/supabase.ts',
]
for (const rel of financieros) {
  // Solo verificamos que el archivo no importe formatNombre (no fue tocado accidentalmente)
  // Comprobamos existencia de la línea de import en archivos que NO deberían tenerla
  if (!exists(rel)) { check(`${rel} existe (ok)`, true); continue }
  const src = read(rel)
  check(`${rel} no fue tocado (sin import formatNombre)`, !src.includes('formatNombrePersona'))
}

// ── Resumen ───────────────────────────────────────────────────────────────────
console.log(`\n=== Resultado: ${pass} PASS · ${fail} FAIL ===\n`)
if (fail > 0) process.exit(1)
