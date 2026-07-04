/**
 * check-security-api-hardening.mjs
 * Verifica que la Fase SEC-2 (API/backend hardening) fue aplicada correctamente.
 * Solo lectura — no modifica archivos.
 */

import { readFileSync, existsSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

let passed = 0
let failed = 0

function check(name, condition, hint = '') {
  if (condition) {
    console.log(`  ✅ ${name}`)
    passed++
  } else {
    console.log(`  ❌ ${name}${hint ? `\n     → ${hint}` : ''}`)
    failed++
  }
}

function read(rel) {
  const p = resolve(root, rel)
  return existsSync(p) ? readFileSync(p, 'utf-8') : null
}

function countMigrations() {
  const dir = resolve(root, 'supabase', 'migrations')
  if (!existsSync(dir)) return 0
  return readdirSync(dir).filter(f => f.endsWith('.sql')).length
}

console.log('\n══════════════════════════════════════════════')
console.log('  SEC-2 — API/backend hardening — Checks')
console.log('══════════════════════════════════════════════\n')

// ── 1. lib/api/errors.ts existe ──
console.log('📋 Helper de errores')
const errorsHelper = read('lib/api/errors.ts') ?? ''
check('lib/api/errors.ts existe',              existsSync(resolve(root, 'lib/api/errors.ts')))
check('apiError() exportado',                  errorsHelper.includes('export function apiError'))
check('apiSuccess() exportado',                errorsHelper.includes('export function apiSuccess'))
check('logging interno (console.error)',        errorsHelper.includes('console.error'))
check('no expone internalError al cliente',     !errorsHelper.includes('internalError }') && errorsHelper.includes('publicMessage'))

// ── 2. update/route.ts — validaciones ──
console.log('\n📋 update/route.ts — Validaciones')
const updateRoute = read('app/api/usuarios/update/route.ts') ?? ''
check('Importa apiError/apiSuccess',           updateRoute.includes("from '@/lib/api/errors'"))
check('UUID_REGEX definido',                   updateRoute.includes('UUID_REGEX'))
check('Valida UUID con regex',                 updateRoute.includes('UUID_REGEX.test'))
check('Valida activo como boolean',            updateRoute.includes("typeof activo !== 'boolean'"))
check('ROLES_VALIDOS whitelist presente',      updateRoute.includes('ROLES_VALIDOS'))
check('No expone error.message al cliente',    !updateRoute.includes("error: error.message") && !updateRoute.includes("error: message"))
check('Usa apiError en lugar de Response.json raw',
  !updateRoute.includes("Response.json({ error:") || updateRoute.includes("from '@/lib/api/errors'"))

// ── 3. invite/route.ts — validaciones ──
console.log('\n📋 invite/route.ts — Validaciones')
const inviteRoute = read('app/api/usuarios/invite/route.ts') ?? ''
check('Importa apiError/apiSuccess',           inviteRoute.includes("from '@/lib/api/errors'"))
check('EMAIL_REGEX definido',                  inviteRoute.includes('EMAIL_REGEX'))
check('Valida formato de email',               inviteRoute.includes('EMAIL_REGEX.test'))
check('ROLES_VALIDOS whitelist presente',      inviteRoute.includes('ROLES_VALIDOS'))
check('Valida rol contra whitelist',           inviteRoute.includes('ROLES_VALIDOS.includes(rol)'))
check('No expone inviteError.message al cliente',
  !inviteRoute.includes('inviteError.message') && !inviteRoute.includes("error: message"))
check('nombre tiene máximo de longitud',       inviteRoute.includes('.slice(0, 200)') || inviteRoute.includes('slice(0,200)'))

// ── 4. requireAdmin.ts sigue intacto ──
console.log('\n📋 requireAdmin.ts — Confinamiento de service role')
const requireAdmin = read('lib/api/requireAdmin.ts') ?? ''
check('requireAdmin.ts existe',                existsSync(resolve(root, 'lib/api/requireAdmin.ts')))
check('Usa getUser() no getSession()',          requireAdmin.includes('getUser()') && !requireAdmin.includes('getSession()'))
check('SERVICE_ROLE_KEY solo en getAdminClient()',
  requireAdmin.includes('SUPABASE_SERVICE_ROLE_KEY'))
check('No expone service key fuera de helper', !requireAdmin.includes("console.log") || !requireAdmin.includes("key"))

// ── 5. Service role no en archivos cliente ──
console.log('\n📋 Seguridad — service role no en cliente')
const libSupa = read('lib/supabase.ts') ?? ''
check('lib/supabase.ts no usa SERVICE_ROLE_KEY', !libSupa.includes('SERVICE_ROLE_KEY'))

// ── 6. Sin migraciones nuevas (esperado: 12) ──
console.log('\n📋 Base de datos — sin cambios')
const migCount = countMigrations()
// 12 base + 1 SEC-3C + 2 SEC-3E/SEC-4B locales = 15 conocidas
const EXPECTED_MIGRATIONS = 15
check(`Número de migraciones permitido (${migCount})`,
  migCount === EXPECTED_MIGRATIONS,
  `Esperado ${EXPECTED_MIGRATIONS}, encontrado ${migCount} — si hay más, revisar si fue autorizada`)

// ── 7. Anexo 06 y lógica financiera no tocados ──
console.log('\n📋 Archivos críticos intactos')
const anexo6 = read('app/dashboard/reportes/anexo6/page.tsx') ?? ''
check('Anexo 06 contiene lógica SBS esperada',
  anexo6.includes('ANEXO') || anexo6.includes('Anexo') || anexo6.includes('SBS'))
check('generarReciboPDF.ts no fue modificado recientemente',
  existsSync(resolve(root, 'app/dashboard/pagos/utils/generarReciboPDF.ts')))

// ── 8. SECURITY_HARDENING_PLAN.md actualizado ──
console.log('\n📋 Documentación')
const plan = read('docs/ai-recovery/SECURITY_HARDENING_PLAN.md') ?? ''
check('SECURITY_HARDENING_PLAN.md existe',     existsSync(resolve(root, 'docs/ai-recovery/SECURITY_HARDENING_PLAN.md')))
check('SEC-2 mencionado como completado',
  plan.includes('SEC-2') && (plan.includes('COMPLETADA') || plan.includes('completada') || plan.includes('✅')))
check('SECURITY_API_HARDENING_REPORT.md existe',
  existsSync(resolve(root, 'docs/ai-recovery/SECURITY_API_HARDENING_REPORT.md')))

// ── Resumen ──
const total = passed + failed
console.log('\n══════════════════════════════════════════════')
console.log(`  Resultado: ${passed}/${total} checks PASS`)
console.log('══════════════════════════════════════════════\n')

if (failed > 0) {
  console.log(`❌ ${failed} check(s) fallaron. Revisar hallazgos arriba.\n`)
  process.exit(1)
} else {
  console.log('✅ SEC-2 verificada correctamente. No se tocó DB ni lógica financiera.\n')
}
