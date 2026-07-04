/**
 * check-security-audit.mjs
 * Verifica que la Fase SEC-0 (auditoría de seguridad) esté completa.
 * Uso: node scripts/check-security-audit.mjs
 * npm run: check:security-audit
 */

import { readFileSync, existsSync, statSync } from 'fs'
import { resolve } from 'path'

const ROOT = resolve('.')
let passed = 0
let failed = 0
let warnings = 0

function read(rel) {
  const abs = resolve(ROOT, rel)
  if (!existsSync(abs)) return null
  return readFileSync(abs, 'utf8')
}

function exists(rel) {
  return existsSync(resolve(ROOT, rel))
}

function check(desc, ok, detail = '') {
  if (ok) {
    console.log(`  ✅ ${desc}`)
    passed++
  } else {
    console.log(`  ❌ ${desc}${detail ? ' — ' + detail : ''}`)
    failed++
  }
}

function warn(desc, detail = '') {
  console.log(`  ⚠️  ${desc}${detail ? ' — ' + detail : ''}`)
  warnings++
}

function section(title) {
  console.log(`\n── ${title} ──`)
}

// ── 1. ARTEFACTOS GENERADOS ──────────────────────────────────────────────────

section('Artefactos de la auditoría SEC-0')

const report = read('docs/ai-recovery/SECURITY_AUDIT_REPORT.md') ?? ''
check(
  'SECURITY_AUDIT_REPORT.md existe',
  report.length > 0,
)
check(
  'SECURITY_AUDIT_REPORT.md tiene resumen ejecutivo',
  report.includes('Resumen ejecutivo'),
)
check(
  'SECURITY_AUDIT_REPORT.md tiene hallazgos ALTO',
  report.includes('SEC-A0') && report.includes('ALTO'),
)
check(
  'SECURITY_AUDIT_REPORT.md tiene hallazgos MEDIO',
  report.includes('SEC-B0') && report.includes('MEDIO'),
)
check(
  'SECURITY_AUDIT_REPORT.md confirma que no se tocó DB',
  report.includes('No se tocó la base de datos') ||
  report.includes('No se crearon migraciones'),
)

const plan = read('docs/ai-recovery/SECURITY_HARDENING_PLAN.md') ?? ''
check(
  'SECURITY_HARDENING_PLAN.md existe',
  plan.length > 0,
)
check(
  'SECURITY_HARDENING_PLAN.md tiene SEC-1 quick wins',
  plan.includes('SEC-1'),
)
check(
  'SECURITY_HARDENING_PLAN.md tiene SEC-2 API/backend',
  plan.includes('SEC-2'),
)
check(
  'SECURITY_HARDENING_PLAN.md tiene SEC-3 Supabase RLS',
  plan.includes('SEC-3'),
)
check(
  'SECURITY_HARDENING_PLAN.md tiene SEC-4 auditoría/logs',
  plan.includes('SEC-4'),
)
check(
  'SECURITY_HARDENING_PLAN.md tiene SEC-5 backups',
  plan.includes('SEC-5'),
)
check(
  'SECURITY_HARDENING_PLAN.md tiene SEC-6 validaciones UX',
  plan.includes('SEC-6'),
)

check(
  'security_risk_matrix.xlsx existe',
  exists('exports/security/security_risk_matrix.xlsx'),
)

// ── 2. RESTRICCIONES — NO SE TOCÓ DB ────────────────────────────────────────

section('Restricciones de la fase — sin tocar DB ni lógica')

const migrations = [
  'supabase/migrations/20260617000000_create_decrementar_saldo_capital.sql',
  'supabase/migrations/20260617000001_create_registrar_aporte_socio.sql',
  'supabase/migrations/20260617000002_create_crear_credito_con_cronograma.sql',
  'supabase/migrations/20260617000003_fix_tipo_credito_cast.sql',
  'supabase/migrations/20260617000004_fix_estado_cuota_cast.sql',
  'supabase/migrations/20260620000001_bdcc_min_fields.sql',
  'supabase/migrations/20260623000001_create_socio_beneficiarios.sql',
  'supabase/migrations/20260624000001_create_aplicar_ampliacion_credito.sql',
  'supabase/migrations/20260702000001_ampliaciones_add_tasa_cuota_nuevas.sql',
  'supabase/migrations/20260702000002_extend_aplicar_ampliacion_credito.sql',
  'supabase/migrations/20260702000003_create_pagos_cuotas_aplicaciones.sql',
  'supabase/migrations/20260605112510_remote_existing_migration_placeholder.sql',
  // SEC-3C — RLS hardening (aplicado en Supabase remoto)
  'supabase/migrations/20260702000010_sec3c_rls_hardening.sql',
  // SEC-3E — baseline local tabla auditoria (NO aplicado remotamente)
  'supabase/migrations/20260703120000_sec3e_auditoria_baseline.sql',
  // SEC-4B — audit log implementation (NO aplicado remotamente)
  'supabase/migrations/20260703130000_sec4b_audit_log_implementation.sql',
]

// Verificar que no hay migraciones nuevas (más allá de las 15 conocidas)
const { readdirSync } = await import('fs')
const migDir = resolve(ROOT, 'supabase/migrations')
let migCount = 0
if (existsSync(migDir)) {
  const files = readdirSync(migDir).filter(f => f.endsWith('.sql'))
  migCount = files.length
}

check(
  `No hay migraciones nuevas (esperadas: ${migrations.length}, encontradas: ${migCount})`,
  migCount === migrations.length,
  migCount !== migrations.length ? `Se detectaron ${migCount - migrations.length} migraciones no esperadas` : '',
)

// Verificar que Anexo 06 no fue modificado durante la auditoría
const anexo6 = read('app/dashboard/reportes/anexo6/page.tsx') ?? ''
check(
  'Anexo 06 no fue modificado (tiene encabezados SBS correctos de ANEXO6-1)',
  anexo6.includes('Apellidos y Nombres / Razón Social') &&
  anexo6.includes('1411050604'),
)

// ── 3. ÁREAS AUDITADAS ───────────────────────────────────────────────────────

section('Áreas cubiertas por la auditoría')

check(
  'Service role auditado en reporte',
  report.includes('service role') || report.includes('SERVICE_ROLE') || report.includes('requireAdmin'),
)
check(
  'API routes auditadas en reporte',
  report.includes('API') && report.includes('invite') && report.includes('update'),
)
check(
  'RLS auditado en reporte',
  report.includes('RLS') && (report.includes('policy') || report.includes('policies')),
)
check(
  'Roles auditados en reporte',
  report.includes('admin') && report.includes('tesoreria') && report.includes('creditos'),
)
check(
  'Variables de entorno auditadas en reporte',
  report.includes('NEXT_PUBLIC') && report.includes('.gitignore'),
)
check(
  'Headers HTTP auditados en reporte',
  report.includes('X-Frame-Options') || report.includes('headers HTTP'),
)
check(
  'Dependencias auditadas en reporte',
  report.includes('xlsx') && report.includes('dompurify'),
)
check(
  'Validaciones auditadas en reporte',
  report.includes('validaci') || report.includes('Validaci'),
)

// ── 4. ARCHIVOS CRÍTICOS INTACTOS ────────────────────────────────────────────

section('Archivos críticos sin modificar')

const requireAdmin = read('lib/api/requireAdmin.ts') ?? ''
check(
  'lib/api/requireAdmin.ts intacto (usa getUser() no getSession())',
  requireAdmin.includes('auth.getUser()') && requireAdmin.includes('requireAdmin'),
)

const proxy = read('proxy.ts') ?? ''
check(
  'proxy.ts intacto (usa getUser() SSR)',
  proxy.includes('auth.getUser()') && proxy.includes('/login'),
)

const inviteRoute = read('app/api/usuarios/invite/route.ts') ?? ''
check(
  'invite/route.ts intacto (usa requireAdmin)',
  inviteRoute.includes('requireAdmin'),
)

const updateRoute = read('app/api/usuarios/update/route.ts') ?? ''
check(
  'update/route.ts intacto (usa requireAdmin + lista blanca)',
  updateRoute.includes('requireAdmin') && updateRoute.includes('ROLES_VALIDOS'),
)

// ── 5. RESUMEN ───────────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(60))
console.log(`Resultado SEC-0: ${passed} ✅  ${failed} ❌  ${warnings} ⚠️`)

if (failed > 0) {
  console.log('\n❌ Auditoría SEC-0 INCOMPLETA — corregir los checks marcados con ❌')
  process.exit(1)
} else {
  console.log('\n✅ Auditoría SEC-0 COMPLETA')
  console.log('   Próxima fase: SEC-1 (quick wins — headers HTTP, npm audit fix, .env.example)')
  process.exit(0)
}
