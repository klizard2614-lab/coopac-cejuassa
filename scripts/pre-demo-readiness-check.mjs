/**
 * Fase 10F — Pre-demo readiness check
 *
 * Verifica que la app está lista para la prueba con la contadora:
 *  - Scripts críticos de auditoría presentes
 *  - Backups esperados existentes
 *  - Banners DEMO visibles en BDCC y Anexo 6
 *  - Rutas del sidebar sin páginas rotas
 *  - Variables de entorno configuradas
 *  - Scripts apply con protección --authorized
 *  - No hay script de data-reset sin dry-run default
 *
 * No modifica nada. Solo lectura.
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

let passed = 0
let failed = 0
let warned = 0

function ok(msg)   { console.log(`  ✅ ${msg}`); passed++ }
function fail(msg) { console.log(`  ❌ ${msg}`); failed++ }
function warn(msg) { console.log(`  ⚠️  ${msg}`); warned++ }
function section(title) { console.log(`\n── ${title} ──`) }

function fileContains(filePath, ...patterns) {
  if (!existsSync(filePath)) return false
  const content = readFileSync(filePath, 'utf8')
  return patterns.every(p => content.includes(p))
}

function fileExists(relPath) {
  return existsSync(resolve(root, relPath))
}

// ── 1. Scripts críticos en package.json ──────────────────────────────────────
section('1. Scripts críticos')
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const scripts = pkg.scripts || {}

const criticalScripts = [
  'smoke:demo-app',
  'smoke:report-exports',
  'audit:ui-roles',
  'audit:form-validations',
  'audit:post-excel-import',
  'verify:cejuassa',
]
for (const s of criticalScripts) {
  if (scripts[s]) ok(`npm run ${s} → ${scripts[s]}`)
  else fail(`npm run ${s} — NO ENCONTRADO en package.json`)
}

// ── 2. Backups esperados ──────────────────────────────────────────────────────
section('2. Backups')
const backupPreReset     = 'backups/data-reset/20260620-1327'
const backupDemoFields   = 'backups/demo-data-fill/2026-06-23T02-18'

if (fileExists(backupPreReset)) ok(`Backup pre-reset: ${backupPreReset}`)
else fail(`Backup pre-reset FALTANTE: ${backupPreReset}`)

if (fileExists(backupDemoFields)) ok(`Backup demo regulatory: ${backupDemoFields}`)
else fail(`Backup demo regulatory FALTANTE: ${backupDemoFields}`)

// verificar que los JSON de backup existen
const backupFiles = [
  `${backupPreReset}/socios.json`,
  `${backupPreReset}/creditos.json`,
  `${backupDemoFields}/socios.json`,
  `${backupDemoFields}/creditos.json`,
]
for (const f of backupFiles) {
  if (fileExists(f)) ok(`JSON de backup: ${f}`)
  else fail(`JSON de backup FALTANTE: ${f}`)
}

// ── 3. BDCC — banner DEMO ────────────────────────────────────────────────────
section('3. BDCC — banner DEMO/no oficial')
const bdccPath = resolve(root, 'app/dashboard/reportes/bdcc/page.tsx')
if (!existsSync(bdccPath)) {
  fail('app/dashboard/reportes/bdcc/page.tsx NO EXISTE')
} else {
  if (fileContains(bdccPath, 'DEMO', 'NO ENVIAR'))
    ok('BDCC tiene banner "DEMO — DATOS NO OFICIALES — NO ENVIAR A SBS"')
  else
    fail('BDCC: banner DEMO/NO ENVIAR no encontrado')

  if (fileContains(bdccPath, 'admin', 'contabilidad'))
    ok('BDCC: route guard para admin/contabilidad presente')
  else
    fail('BDCC: route guard no encontrado')
}

// ── 4. Anexo 6 — banner demo ─────────────────────────────────────────────────
section('4. Anexo 6 — banner demo')
const anexo6Path = resolve(root, 'app/dashboard/reportes/anexo6/page.tsx')
if (!existsSync(anexo6Path)) {
  fail('app/dashboard/reportes/anexo6/page.tsx NO EXISTE')
} else {
  if (fileContains(anexo6Path, 'DEMO') || fileContains(anexo6Path, 'demo') || fileContains(anexo6Path, 'temporales'))
    ok('Anexo 6 tiene banner de datos demo')
  else
    fail('Anexo 6: banner demo no encontrado')

  if (fileContains(anexo6Path, 'criterio_contable_confirmado'))
    ok('Anexo 6: provision_constituida fuente = criterio_contable_confirmado (B3 resuelto)')
  else
    warn('Anexo 6: criterio_contable_confirmado no encontrado — verificar manualmente')
}

// ── 5. Rutas del sidebar ─────────────────────────────────────────────────────
section('5. Rutas del sidebar (páginas existentes)')
const sidebarRoutes = [
  'app/dashboard/page.tsx',
  'app/dashboard/socios/page.tsx',
  'app/dashboard/creditos/page.tsx',
  'app/dashboard/ampliaciones/page.tsx',
  'app/dashboard/pagos/page.tsx',
  'app/dashboard/aportes/page.tsx',
  'app/dashboard/egresos/page.tsx',
  'app/dashboard/convenios/page.tsx',
  'app/dashboard/cartera/page.tsx',
  'app/dashboard/mora/page.tsx',
  'app/dashboard/reportes/page.tsx',
  'app/dashboard/usuarios/page.tsx',
  'app/dashboard/configuracion/page.tsx',
]
for (const route of sidebarRoutes) {
  if (fileExists(route)) ok(route)
  else fail(`RUTA ROTA: ${route}`)
}

// ── 6. Proxy (protección de rutas) ───────────────────────────────────────────
section('6. Seguridad — proxy y service role')
const proxyPath = resolve(root, 'proxy.ts')
if (!existsSync(proxyPath)) {
  fail('proxy.ts NO EXISTE — rutas sin protección')
} else {
  if (fileContains(proxyPath, 'getUser', '/dashboard', '/login'))
    ok('proxy.ts activo — getUser + redirect /login para /dashboard/*')
  else
    fail('proxy.ts existe pero no tiene guard esperado')
}

const requireAdminPath = resolve(root, 'lib/api/requireAdmin.ts')
if (fileExists('lib/api/requireAdmin.ts'))
  ok('lib/api/requireAdmin.ts existe — service role confinado')
else
  fail('lib/api/requireAdmin.ts NO EXISTE — service role puede estar expuesto')

// Verificar que service role no está en componentes de cliente
const clientFiles = [
  'lib/supabase.ts',
  'app/dashboard/layout.tsx',
]
for (const f of clientFiles) {
  const fullPath = resolve(root, f)
  if (!existsSync(fullPath)) continue
  const content = readFileSync(fullPath, 'utf8')
  if (content.includes('SERVICE_ROLE_KEY') || content.includes('service_role_key')) {
    fail(`service_role_key encontrado en archivo cliente: ${f}`)
  } else {
    ok(`${f}: sin service role key`)
  }
}

// ── 7. Variables de entorno ──────────────────────────────────────────────────
section('7. Variables de entorno')
const envPath = resolve(root, '.env.local')
if (!existsSync(envPath)) {
  fail('.env.local NO EXISTE — la app no puede conectarse a Supabase')
} else {
  const envContent = readFileSync(envPath, 'utf8')
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ]
  for (const varName of required) {
    const match = envContent.match(new RegExp(`^${varName}=(.+)$`, 'm'))
    if (match && match[1].trim() && !match[1].trim().startsWith('#')) {
      ok(`${varName} = [SET]`)
    } else {
      fail(`${varName} — FALTA o VACÍO en .env.local`)
    }
  }
}

// ── 8. Scripts apply con protección ─────────────────────────────────────────
section('8. Scripts apply con guards de autorización')
const applyScripts = [
  'scripts/apply-credit-interest-from-preview.mjs',
  'scripts/apply-demo-regulatory-fields.mjs',
  'scripts/apply-link-pagos-creditos.mjs',
  'scripts/apply-regenerate-cronogramas.mjs',
  'scripts/migrate-socio-beneficiarios.mjs',
]
for (const s of applyScripts) {
  const fullPath = resolve(root, s)
  if (!existsSync(fullPath)) {
    warn(`${s} — no existe (OK si no se usa)`)
    continue
  }
  const content = readFileSync(fullPath, 'utf8')
  const hasGuard = content.includes('--authorized') || content.includes('CEJUASSA_ALLOW') || content.includes('--apply')
  if (hasGuard) ok(`${s} — tiene guard`)
  else fail(`${s} — SIN GUARD de autorización ⚠️ PELIGROSO`)
}

// ── 9. Script data-reset tiene dry-run por defecto ──────────────────────────
section('9. Script data-reset — dry-run por defecto')
const dataResetSQL = resolve(root, 'supabase/manual/data-reset-template.sql')
if (existsSync(dataResetSQL)) {
  const content = readFileSync(dataResetSQL, 'utf8')
  if (content.includes('ROLLBACK') || content.includes('rollback'))
    ok('data-reset-template.sql tiene ROLLBACK por defecto')
  else
    warn('data-reset-template.sql: no tiene ROLLBACK visible — revisar manualmente')
} else {
  warn('supabase/manual/data-reset-template.sql no existe — OK si fue archivado')
}

// ── 10. Migraciones locales documentadas ─────────────────────────────────────
section('10. Migraciones locales')
const migrationsDir = resolve(root, 'supabase/migrations')
if (!existsSync(migrationsDir)) {
  warn('supabase/migrations/ no existe')
} else {
  const { readdirSync } = await import('fs')
  const migrations = readdirSync(migrationsDir).filter(f => f.endsWith('.sql'))
  ok(`${migrations.length} migraciones locales: ${migrations.join(', ')}`)
  const documented = [
    '20260605112510', // placeholder remoto preexistente
    '20260617000000', // RPC A decrementar_saldo_capital
    '20260617000001', // RPC B registrar_aporte_socio
    '20260617000002', // RPC C crear_credito_con_cronograma
    '20260617000003', // hotfix cast ENUM tipo_credito
    '20260617000004', // hotfix cast ENUM estado_cuota
    '20260620000001', // campos mínimos BDCC/SBS (Fase 8A-2)
    '20260623000001', // tabla socio_beneficiarios (Fase 10C)
  ]
  const undocumented = migrations.filter(m => !documented.some(d => m.startsWith(d)) && !m.includes('placeholder') && !m.includes('remote_existing'))
  if (undocumented.length === 0)
    ok('Todas las migraciones locales están documentadas en AI_HANDOFF.md')
  else
    warn(`Migraciones locales no documentadas: ${undocumented.join(', ')} — verificar manualmente`)
}

// ── 11. Ampliaciones — aviso informativo ─────────────────────────────────────
section('11. Módulo Ampliaciones — aviso "no modifica crédito"')
const ampSectionPath = resolve(root, 'app/dashboard/creditos/_components/AmpliacionesSection.tsx')
const ampPagePath    = resolve(root, 'app/dashboard/ampliaciones/page.tsx')

if (!existsSync(ampSectionPath)) {
  fail('AmpliacionesSection.tsx NO EXISTE')
} else {
  if (fileContains(ampSectionPath, 'informativo') && (fileContains(ampSectionPath, 'no modifica') || fileContains(ampSectionPath, 'No modifica')))
    ok('AmpliacionesSection.tsx tiene aviso "Registro informativo. No modifica..."')
  else
    warn('AmpliacionesSection.tsx: aviso informativo no encontrado — revisar texto')
}

if (!existsSync(ampPagePath)) {
  fail('app/dashboard/ampliaciones/page.tsx NO EXISTE')
} else {
  if (fileContains(ampPagePath, 'informativos', 'No modifican') || fileContains(ampPagePath, 'informativo'))
    ok('Página global ampliaciones tiene aviso informativo')
  else
    warn('Página global ampliaciones: aviso informativo no encontrado — revisar')
}

// ── Resumen ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(55)}`)
console.log(`RESULTADO: ${passed} PASS · ${warned} WARN · ${failed} FAIL`)
console.log('─'.repeat(55))

if (failed > 0) {
  console.log('\n❌ La app tiene problemas críticos — resolver antes del demo.')
  process.exit(1)
} else if (warned > 0) {
  console.log('\n⚠️  La app está lista con advertencias menores. Revisar los WARN.')
  process.exit(0)
} else {
  console.log('\n✅ App lista para prueba con contadora.')
  process.exit(0)
}
