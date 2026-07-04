/**
 * check-apply-credit-interest-preview.mjs
 * Fase 9C-6B — Verificar que el script apply cumple todas las reglas de seguridad
 *
 * SOLO LECTURA — solo lee archivos, no modifica nada.
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const SCRIPT_PATH = resolve(ROOT, 'scripts/apply-credit-interest-from-preview.mjs')
const PREVIEW_PATH = resolve(ROOT, 'docs/ai-recovery/proposed_credit_field_updates_preview.json')

let passed = 0
let failed = 0

function ok(label, detail = '') { console.log(`   ✅ ${label}${detail ? ' — ' + detail : ''}`); passed++ }
function fail(label, detail = '') { console.log(`   ❌ ${label}${detail ? ' — ' + detail : ''}`); failed++ }
function section(title) { console.log(`\n${title}`) }

console.log('\n══════════════════════════════════════════════════════════')
console.log('  check-apply-credit-interest-preview — Fase 9C-6B')
console.log('══════════════════════════════════════════════════════════\n')

// ─── 1. Existencia de archivos ────────────────────────────────────────────────
section('1. Existencia de archivos')

if (existsSync(SCRIPT_PATH)) ok('Script apply existe', 'scripts/apply-credit-interest-from-preview.mjs')
else fail('Script apply NO encontrado', 'scripts/apply-credit-interest-from-preview.mjs')

if (existsSync(PREVIEW_PATH)) ok('Preview existe', 'docs/ai-recovery/proposed_credit_field_updates_preview.json')
else fail('Preview NO encontrado', 'docs/ai-recovery/proposed_credit_field_updates_preview.json')

// ─── 2. Análisis estático del script ─────────────────────────────────────────
section('2. Análisis estático del script apply')

if (!existsSync(SCRIPT_PATH)) {
  fail('No se puede analizar — script no existe')
  console.log(`\n❌ ${failed} fallo(s) / ${passed} OK`)
  process.exit(1)
}

const scriptContent = readFileSync(SCRIPT_PATH, 'utf8')

// Modo dry-run
if (scriptContent.includes('--dry-run') || scriptContent.includes('IS_DRY') || scriptContent.includes('DRY-RUN')) {
  ok('Soporta modo --dry-run')
} else {
  fail('No tiene modo --dry-run')
}

// Modo apply
if (scriptContent.includes('--apply') || scriptContent.includes('IS_APPLY')) {
  ok('Soporta modo --apply')
} else {
  fail('No tiene modo --apply')
}

// Guard de autorización
if (scriptContent.includes('APPLY_AUTH') && scriptContent.includes('APLICAR TASA ANEXO6 9C-6B')) {
  ok('Guard de autorización presente', 'APPLY_AUTH="APLICAR TASA ANEXO6 9C-6B"')
} else {
  fail('Guard de autorización ausente o incorrecto')
}

// Lee el preview
if (scriptContent.includes('proposed_credit_field_updates_preview.json')) {
  ok('Lee el archivo preview correctamente')
} else {
  fail('No lee el archivo preview')
}

// Solo actualiza tasa_interes
if (scriptContent.includes("update({ tasa_interes: tasa })") ||
    scriptContent.includes("update({ tasa_interes:")) {
  ok('Solo actualiza tasa_interes en el UPDATE')
} else {
  fail('UPDATE no está limitado a tasa_interes')
}

// ─── 3. Verificar que NO toca campos prohibidos ───────────────────────────────
section('3. Verificar campos prohibidos (deben estar ausentes del UPDATE)')

const FORBIDDEN_UPDATE = [
  'tipo_credito_sbs',
  'subtipo_credito_sbs',
  'cuenta_contable_bd01',
]

// Buscar si aparecen en contexto de update (no en comentarios o strings de verificación)
// Solo buscamos en la línea del .update({...})
const updateLines = scriptContent.split('\n').filter(l =>
  l.includes('.update(') && !l.trim().startsWith('//')
)

for (const field of FORBIDDEN_UPDATE) {
  const inUpdate = updateLines.some(l => l.includes(field))
  if (inUpdate) {
    fail(`"${field}" aparece en línea de UPDATE — NO debe modificarse`)
  } else {
    ok(`"${field}" NO está en el UPDATE`)
  }
}

// ─── 4. Verificar ausencia de operaciones prohibidas ─────────────────────────
section('4. Verificar ausencia de operaciones prohibidas')

// Solo buscar en líneas que no sean comentarios (no empiezan con * o //)
const codeLines = scriptContent.split('\n')
  .filter(l => !l.trim().startsWith('*') && !l.trim().startsWith('//') && !l.trim().startsWith('/*'))
  .join('\n')

const FORBIDDEN_OPS = [
  { pattern: /\.from\(['"]usuarios['"]\).*\.(insert|update|delete|upsert)/s, label: 'Modifica tabla usuarios', src: codeLines },
  { pattern: /\.from\(['"]configuracion['"]\).*\.(insert|update|delete|upsert)/s, label: 'Modifica tabla configuracion', src: codeLines },
  { pattern: /admin\.(?:listUsers|deleteUser|updateUserById)|auth\.admin.*users/s, label: 'Toca auth.users via admin API', src: codeLines },
  { pattern: /supabase\/migrations/s, label: 'Crea migraciones', src: codeLines },
  { pattern: /readFileSync.*_client_files|writeFileSync.*_client_files/s, label: 'Lee/escribe _client_files', src: codeLines },
  { pattern: /cronograma_cuotas.*\.insert|\.insert.*cronograma_cuotas/s, label: 'Regenera cronograma_cuotas', src: codeLines },
  { pattern: /\.from\(['"]creditos['"]\)\s*\n?\s*\.delete\(\)/s, label: 'Borra créditos', src: codeLines },
]

for (const { pattern, label, src } of FORBIDDEN_OPS) {
  if (pattern.test(src)) {
    fail(`DETECTADO: ${label}`)
  } else {
    ok(`NO detectado: ${label}`)
  }
}

// ─── 5. Validar estructura del preview ────────────────────────────────────────
section('5. Validar estructura del preview')

if (existsSync(PREVIEW_PATH)) {
  let preview
  try {
    preview = JSON.parse(readFileSync(PREVIEW_PATH, 'utf8'))
    ok('Preview es JSON válido')
  } catch (e) {
    fail(`Preview inválido: ${e.message}`)
    preview = null
  }

  if (preview) {
    if (Array.isArray(preview)) ok(`Preview es array`)
    else fail(`Preview no es array`)

    if (preview.length === 31) ok(`Preview tiene 31 entradas`)
    else fail(`Preview tiene ${preview.length} entradas (esperadas 31)`)

    const allHaveId = preview.every(e => e.credito_id !== undefined)
    if (allHaveId) ok('Todas las entradas tienen credito_id')
    else fail('Faltan entradas sin credito_id')

    const tasasValidas = preview.every(e => {
      const t = parseFloat(String(e.tasa_interes_propuesta || '').replace(',', '.'))
      return !isNaN(t) && t > 0 && t <= 1
    })
    if (tasasValidas) ok('Todas las tasas propuestas son numéricas y válidas (0 < t ≤ 1)')
    else fail('Hay tasas propuestas inválidas')

    const tasasUnicas = [...new Set(preview.map(e => String(e.tasa_interes_propuesta)))]
    ok(`Tasas únicas en preview: ${tasasUnicas.join(', ')}`)

    const tipoNulls = preview.every(e => e.tipo_credito_sbs_propuesto === null)
    if (tipoNulls) ok('tipo_credito_sbs_propuesto = null en todas (NO se aplicará)')
    else fail('tipo_credito_sbs_propuesto tiene valores no-null')

    const subtipoNulls = preview.every(e => e.subtipo_credito_sbs_propuesto === null)
    if (subtipoNulls) ok('subtipo_credito_sbs_propuesto = null en todas (NO se aplicará)')
    else fail('subtipo_credito_sbs_propuesto tiene valores no-null')

    const fuentes = [...new Set(preview.map(e => e.fuente))]
    ok(`Fuente del preview: ${fuentes.join(', ')}`)

    const confianzas = [...new Set(preview.map(e => e.match_confidence))]
    ok(`Niveles de confianza: ${confianzas.join(', ')}`)
  }
}

// ─── Resumen ──────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════')
console.log(`  Resultado: ${passed} OK | ${failed} FALLO(S)`)
console.log('══════════════════════════════════════════════════════════')

if (failed === 0) {
  console.log('\n  ✅ Script apply verificado. Listo para dry-run y (con autorización) apply.')
  console.log('\n  Para dry-run:  npm run apply:tasa-anexo6:dry-run')
  console.log('  Para apply:    $env:APPLY_AUTH="APLICAR TASA ANEXO6 9C-6B"; npm run apply:tasa-anexo6:apply\n')
} else {
  console.log('\n  ❌ Verificación fallida. Corregir antes de continuar.\n')
}

process.exit(failed > 0 ? 1 : 0)
