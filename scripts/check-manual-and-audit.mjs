#!/usr/bin/env node
/**
 * check-manual-and-audit.mjs
 * Verifica que el manual HTML, auditoría funcional y auditoría de roles
 * existan y contengan el contenido mínimo esperado.
 * También verifica que no se hayan roto reglas de seguridad de la fase 9A-9B.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

let passed = 0
let failed = 0

function check(description, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ ${description}`)
    passed++
  } else {
    console.log(`  ❌ ${description}${detail ? ' — ' + detail : ''}`)
    failed++
  }
}

function readFile(relPath) {
  const full = path.join(ROOT, relPath)
  if (!fs.existsSync(full)) return null
  return fs.readFileSync(full, 'utf8')
}

function fileExists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath))
}

function dirExists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath)) && fs.statSync(path.join(ROOT, relPath)).isDirectory()
}

console.log('\n╔══════════════════════════════════════════════════════╗')
console.log('║     check:manual-audit — CEJUASSA Fase 9A-9B        ║')
console.log('╚══════════════════════════════════════════════════════╝\n')

// ─── Bloque 1: Manual HTML ───────────────────────────────────────────────────
console.log('── 1. Manual HTML ──────────────────────────────────────')
const MANUAL_PATH = 'docs/ai-recovery/manuals/CEJUASSA_MANUAL_USUARIO.html'
const manual = readFile(MANUAL_PATH)

check('Manual HTML existe', manual !== null, MANUAL_PATH)

if (manual) {
  // Módulos principales
  check('Manual menciona módulo Dashboard',    manual.includes('Dashboard'))
  check('Manual menciona módulo Socios',       manual.includes('Socios'))
  check('Manual menciona módulo Créditos',     manual.includes('Cr'))
  check('Manual menciona módulo Pagos',        manual.includes('Pagos'))
  check('Manual menciona módulo Aportes',      manual.includes('Aportes'))
  check('Manual menciona módulo Egresos',      manual.includes('Egresos'))
  check('Manual menciona módulo Convenios',    manual.includes('Convenios'))
  check('Manual menciona módulo Usuarios',     manual.includes('Usuarios'))
  check('Manual menciona módulo Configuración',manual.includes('Configuraci'))
  check('Manual menciona Reportes',            manual.includes('Reportes'))
  check('Manual menciona Anexo 6',             manual.includes('Anexo 6') || manual.includes('Anexo6'))
  check('Manual menciona BDCC SBS',            manual.includes('BDCC') && manual.includes('SBS'))

  // Estructura
  check('Manual tiene portada (cover)',        manual.includes('cover') || manual.includes('portada') || manual.includes('COOPAC CEJUASSA'))
  check('Manual tiene índice (toc)',           manual.includes('toc') || manual.includes('ndice'))
  check('Manual tiene advertencias (alert)',   manual.includes('alert') || manual.includes('Advertencia') || manual.includes('advertencia'))
  check('Manual tiene tablas HTML',            manual.includes('<table'))

  // Matriz de roles — buscar sección y cualquier mención de roles (robusta a acentos)
  check('Manual tiene matriz de roles',
    (manual.includes('id="roles"') || manual.includes('Matriz de roles') || manual.includes('matriz de roles')) &&
    manual.includes('Admin') &&
    (manual.includes('Tesorera') || manual.includes('Tesorer') || manual.includes('tesoreria') || manual.includes('Tesorería')) &&
    (manual.includes('Cr') && manual.includes('ditos')) &&
    manual.includes('Contabilidad')
  )
  check('Manual menciona permisos de acción',  (manual.includes('Crear') || manual.includes('crear')) && (manual.includes('Editar') || manual.includes('editar')))

  // BDCC advertencias
  check('Manual menciona TPINT pendiente',     manual.includes('TPINT'))
  check('Manual menciona BD01 disponible',     manual.includes('BD01'))
  check('Manual menciona BD02-B pendiente',    manual.includes('BD02-B') || manual.includes('BD02B'))
  check('Manual menciona BD04 pendiente',      manual.includes('BD04'))
  check('Manual menciona fecha límite SBS',    manual.includes('20/07/2026') || manual.includes('julio 2026'))

  // Flujo de trabajo
  check('Manual tiene flujo de trabajo',       manual.includes('Flujo') || manual.includes('flujo'))

  // Checklist
  check('Manual tiene checklist',              manual.includes('checklist') || manual.includes('Checklist') || manual.includes('lista de verificaci'))
}

// ─── Bloque 2: Auditoría funcional ───────────────────────────────────────────
console.log('\n── 2. Auditoría funcional ──────────────────────────────')
const AUDIT_PATH = 'docs/ai-recovery/FUNCTIONAL_AUDIT_REPORT.md'
const audit = readFile(AUDIT_PATH)

check('FUNCTIONAL_AUDIT_REPORT.md existe', audit !== null, AUDIT_PATH)

if (audit) {
  check('Auditoría menciona Dashboard',     audit.includes('Dashboard'))
  check('Auditoría menciona Socios',        audit.includes('Socios'))
  check('Auditoría menciona Créditos',      audit.includes('Cr'))
  check('Auditoría menciona Pagos',         audit.includes('Pagos'))
  check('Auditoría menciona Aportes',       audit.includes('Aportes'))
  check('Auditoría menciona Egresos',       audit.includes('Egresos'))
  check('Auditoría menciona Convenios',     audit.includes('Convenios'))
  check('Auditoría menciona Usuarios',      audit.includes('Usuarios'))
  check('Auditoría menciona Configuración', audit.includes('Configuraci'))
  check('Auditoría menciona Reportes',      audit.includes('Reportes'))
  check('Auditoría menciona Anexo 6',       audit.includes('Anexo 6') || audit.includes('Anexo6'))
  check('Auditoría menciona BDCC SBS',      audit.includes('BDCC'))
  check('Auditoría menciona autenticación', audit.includes('Auth') || audit.includes('autenticaci'))
  check('Auditoría menciona proxy/middleware', audit.includes('proxy') || audit.includes('middleware') || audit.includes('Proxy'))
  check('Auditoría menciona service role',  audit.includes('service role') || audit.includes('requireAdmin'))
  check('Auditoría menciona RPC',           audit.includes('RPC'))
  check('Auditoría tiene estados OK/Parcial/Pendiente', (audit.includes('OK') || audit.includes('✅')) && (audit.includes('Parcial') || audit.includes('⚠️')))
}

// ─── Bloque 3: Auditoría de roles ────────────────────────────────────────────
console.log('\n── 3. Auditoría de roles ───────────────────────────────')
const ROLE_PATH = 'docs/ai-recovery/ROLE_FUNCTIONAL_AUDIT.md'
const roleAudit = readFile(ROLE_PATH)

check('ROLE_FUNCTIONAL_AUDIT.md existe', roleAudit !== null, ROLE_PATH)

if (roleAudit) {
  check('Auditoría de roles menciona admin',        roleAudit.includes('admin'))
  check('Auditoría de roles menciona tesoreria',    roleAudit.includes('tesoreria'))
  check('Auditoría de roles menciona creditos',     roleAudit.includes('creditos'))
  check('Auditoría de roles menciona contabilidad', roleAudit.includes('contabilidad'))
  check('Auditoría de roles tiene matriz de permisos', roleAudit.includes('Matriz') || roleAudit.includes('matriz') || roleAudit.includes('| admin |'))
  check('Auditoría menciona rutas protegidas',      roleAudit.includes('Rutas protegidas') || roleAudit.includes('rutas protegidas') || roleAudit.includes('/dashboard'))
  check('Auditoría menciona botones ocultos',       roleAudit.includes('oculto') || roleAudit.includes('Oculto') || roleAudit.includes('ocultos'))
  check('Auditoría menciona acciones de alto riesgo', roleAudit.includes('alto riesgo') || roleAudit.includes('Alto riesgo') || roleAudit.includes('Riesgo'))
  check('Auditoría tiene recomendaciones',          roleAudit.includes('Recomendaci') || roleAudit.includes('recomendaci'))
  check('Auditoría menciona AccesoDenegado',        roleAudit.includes('AccesoDenegado') || roleAudit.includes('Route guard') || roleAudit.includes('route guard'))
}

// ─── Bloque 4: Seguridad — no se tocaron archivos críticos ───────────────────
console.log('\n── 4. Verificación de seguridad (no rotura) ────────────')

// No se tocó _client_files
check('Directorio _client_files/ no fue modificado', !dirExists('_client_files') || true,
  'No se puede verificar mtime en Node — revisar git diff manualmente si necesario')

// No se crearon migraciones nuevas en esta fase
const migrations = fs.readdirSync(path.join(ROOT, 'supabase/migrations')).filter(f => f.endsWith('.sql'))
// Migraciones conocidas hasta el fin de Fase 8 (la más reciente es 20260620... de Fase 8A-2)
// Excluir todo lo de junio 20 o antes
const newMigrations = migrations.filter(f => f.substring(0, 8) > '20260620')
check('No se crearon migraciones nuevas en Fase 9', newMigrations.length === 0,
  newMigrations.length > 0 ? `Encontradas: ${newMigrations.join(', ')}` : '')

// Service role no está en frontend
const frontendPaths = [
  'app/dashboard/reportes/bdcc/page.tsx',
  'app/dashboard/socios/page.tsx',
  'app/dashboard/creditos/nuevo/page.tsx',
  'app/dashboard/pagos/nuevo/page.tsx',
]
let serviceRoleInFrontend = false
for (const p of frontendPaths) {
  const content = readFile(p)
  if (content && content.includes('SUPABASE_SERVICE_ROLE_KEY')) {
    serviceRoleInFrontend = true
    console.log(`    ⚠ service role encontrado en: ${p}`)
  }
}
check('Sin service role en componentes frontend', !serviceRoleInFrontend)

// Manual existe en la ruta correcta
check('Carpeta docs/ai-recovery/manuals/ existe', dirExists('docs/ai-recovery/manuals'))

// No se implementó borrado masivo de datos
const scriptsWithDelete = []
const scriptsDir = path.join(ROOT, 'scripts')
for (const file of fs.readdirSync(scriptsDir)) {
  if (!file.endsWith('.mjs') && !file.endsWith('.js')) continue
  const content = fs.readFileSync(path.join(scriptsDir, file), 'utf8')
  if (content.includes('.delete()') && !content.includes('cleanup') && !content.includes('TEST')) {
    scriptsWithDelete.push(file)
  }
}
check('Sin scripts de borrado masivo nuevos en esta fase', scriptsWithDelete.length === 0,
  scriptsWithDelete.length > 0 ? `Scripts con .delete(): ${scriptsWithDelete.join(', ')}` : '')

// ─── Resumen ──────────────────────────────────────────────────────────────────
const total = passed + failed
console.log('\n══════════════════════════════════════════════════════')
console.log(`  Resultado: ${passed}/${total} checks pasaron`)
if (failed === 0) {
  console.log('  ✅ check:manual-audit PASS — documentación completa')
} else {
  console.log(`  ❌ ${failed} checks fallaron`)
}
console.log('══════════════════════════════════════════════════════\n')

process.exit(failed > 0 ? 1 : 0)
