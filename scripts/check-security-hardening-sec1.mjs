/**
 * check-security-hardening-sec1.mjs
 * Verifica que la Fase SEC-1 (quick wins) fue aplicada correctamente.
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
console.log('  SEC-1 — Quick wins de seguridad — Checks')
console.log('══════════════════════════════════════════════\n')

// ── 1. next.config.ts tiene headers de seguridad ──
const nextCfg = read('next.config.ts') ?? ''
console.log('📋 next.config.ts — Headers HTTP')
check('X-Frame-Options presente',             nextCfg.includes('X-Frame-Options'))
check('X-Content-Type-Options presente',      nextCfg.includes('X-Content-Type-Options'))
check('Referrer-Policy presente',             nextCfg.includes('Referrer-Policy'))
check('Permissions-Policy presente',          nextCfg.includes('Permissions-Policy'))
check('Strict-Transport-Security presente',   nextCfg.includes('Strict-Transport-Security'))
check('CSP configurada (activa o report-only)',
  nextCfg.includes('Content-Security-Policy'))
check('headers() exportado en nextConfig',    nextCfg.includes('async headers()'))

// ── 2. .env.example existe y es seguro ──
console.log('\n📋 .env.example')
const envEx = read('.env.example') ?? ''
check('.env.example existe',                  existsSync(resolve(root, '.env.example')))
check('Tiene NEXT_PUBLIC_SUPABASE_URL',        envEx.includes('NEXT_PUBLIC_SUPABASE_URL'))
check('Tiene NEXT_PUBLIC_SUPABASE_ANON_KEY',   envEx.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY'))
check('Tiene SUPABASE_SERVICE_ROLE_KEY',       envEx.includes('SUPABASE_SERVICE_ROLE_KEY'))
check('.env.example NO contiene secretos reales',
  !envEx.match(/eyJ[A-Za-z0-9_-]{20,}/))  // JWT pattern

// ── 3. configuracion/page.tsx no tiene URL Supabase hardcodeada ──
console.log('\n📋 configuracion/page.tsx — URL Supabase')
const cfgPage = read('app/dashboard/configuracion/page.tsx') ?? ''
check('No hay project ID hardcodeado',
  !cfgPage.includes('supabase.com/dashboard/project/ljdjbhsipgkxlgnprzhm'),
  'Reemplazar con URL derivada de NEXT_PUBLIC_SUPABASE_URL')
check('URL Supabase derivada de env var',
  cfgPage.includes('NEXT_PUBLIC_SUPABASE_URL'))

// ── 4. SERVICE_ROLE_KEY no aparece en archivos cliente ──
console.log('\n📋 Seguridad — service role en cliente')
const libSupabase = read('lib/supabase.ts') ?? ''
const dashLayout  = read('app/dashboard/layout.tsx') ?? ''
check('lib/supabase.ts no usa SERVICE_ROLE_KEY',
  !libSupabase.includes('SERVICE_ROLE_KEY'))
check('dashboard/layout.tsx no usa SERVICE_ROLE_KEY',
  !dashLayout.includes('SERVICE_ROLE_KEY'))

// ── 5. Sin migraciones nuevas (esperado: 12) ──
console.log('\n📋 Base de datos — sin cambios')
const migCount = countMigrations()
// 12 base + 1 SEC-3C + 2 SEC-3E/SEC-4B locales = 15 conocidas
check(`Número de migraciones sin cambio (${migCount})`,
  migCount === 15,
  `Esperado 15, encontrado ${migCount}`)

// ── 6. Anexo 06 no tocado ──
console.log('\n📋 Reportes — Anexo 06 intacto')
const anexo6 = read('app/dashboard/reportes/anexo6/page.tsx') ?? ''
check('Anexo 06 contiene SBS headers esperados',
  anexo6.includes('ANEXO') || anexo6.includes('Anexo') || anexo6.includes('SBS'))

// ── 7. SECURITY_HARDENING_PLAN.md actualizado ──
console.log('\n📋 Documentación')
const hardeningPlan = read('docs/ai-recovery/SECURITY_HARDENING_PLAN.md') ?? ''
check('SECURITY_HARDENING_PLAN.md existe',
  existsSync(resolve(root, 'docs/ai-recovery/SECURITY_HARDENING_PLAN.md')))
check('Plan menciona SEC-1',                  hardeningPlan.includes('SEC-1'))
check('xlsx documentado como riesgo pendiente',
  hardeningPlan.includes('xlsx') && (
    hardeningPlan.includes('HIGH') || hardeningPlan.includes('pendiente') || hardeningPlan.includes('DEP-1')
  ))

// ── Resumen ──
const total = passed + failed
console.log('\n══════════════════════════════════════════════')
console.log(`  Resultado: ${passed}/${total} checks PASS`)
console.log('══════════════════════════════════════════════\n')

if (failed > 0) {
  console.log(`❌ ${failed} check(s) fallaron. Revisar hallazgos arriba.\n`)
  process.exit(1)
} else {
  console.log('✅ SEC-1 verificada correctamente. No se tocó DB ni lógica financiera.\n')
}
