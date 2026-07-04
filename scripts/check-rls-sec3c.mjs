#!/usr/bin/env node
/**
 * check-rls-sec3c.mjs
 * Fase SEC-3C — Verifica que la migración de hardening RLS es correcta
 * ANTES de aplicarla en Supabase.
 *
 * Checks:
 *  1. Existe una migración SEC-3C en supabase/migrations/
 *  2. La migración solo toca las 2 tablas objetivo
 *  3. No modifica tablas prohibidas (creditos, socios, pagos_recibos, etc.)
 *  4. Elimina las policies amplias (autenticados_pueden_operar)
 *  5. Crea policies con get_user_rol()
 *  6. No contiene INSERT/UPDATE/DELETE de datos
 *  7. No menciona Anexo 06
 *  8. Incluye rollback documentado en comentario
 *  9. Solo toca las 2 tablas objetivo en sentencias DDL activas
 */
import { readFileSync, readdirSync, existsSync } from 'fs'
import { resolve } from 'path'

const ROOT = process.cwd()
let ok = true
let passed = 0
let failed = 0

function check(label, condition, detail = '') {
  const icon = condition ? '[OK]  ' : '[FAIL]'
  if (condition) { passed++ } else { failed++; ok = false }
  console.log(`${icon} ${label}${detail ? ` — ${detail}` : ''}`)
}

function readFile(path) {
  try { return readFileSync(resolve(ROOT, path), 'utf8') } catch { return '' }
}

function fileExists(path) {
  return existsSync(resolve(ROOT, path))
}

console.log('\n=== CHECK: SEC-3C — Migración de hardening RLS ===\n')

// ── 1. Encontrar la migración SEC-3C ──────────────────────────────────────────
console.log('── Migración SEC-3C ──')

const migrationsDir = resolve(ROOT, 'supabase/migrations')
let migrationFiles = []
try {
  migrationFiles = readdirSync(migrationsDir).filter(f => f.endsWith('.sql'))
} catch { /* dir no existe */ }

const sec3cFile = migrationFiles.find(f =>
  f.toLowerCase().includes('sec3c') || f.toLowerCase().includes('sec-3c')
)

check('Existe migración con "sec3c" en el nombre', !!sec3cFile,
  sec3cFile ? sec3cFile : 'No se encontró archivo sec3c en supabase/migrations/')

if (!sec3cFile) {
  console.log('\n❌ Migración SEC-3C no encontrada — abortando checks.')
  process.exit(1)
}

const migPath = `supabase/migrations/${sec3cFile}`
const sql = readFile(migPath)

check('Migración SEC-3C no está vacía', sql.length > 100)

// ── 2. La migración menciona las 2 tablas objetivo ────────────────────────────
console.log('\n── Tablas objetivo ──')

check('Menciona socio_beneficiarios', sql.includes('socio_beneficiarios'))
check('Menciona pagos_cuotas_aplicaciones', sql.includes('pagos_cuotas_aplicaciones'))

// ── 3. No modifica tablas prohibidas con DDL ──────────────────────────────────
console.log('\n── Tablas prohibidas (no deben ser modificadas) ──')

const tablasForbidden = [
  'creditos',
  'socios',
  'pagos_recibos',
  'cronograma_cuotas',
  'usuarios',
  'configuracion',
]

// Extraer líneas que son sentencias DDL activas (no comentarios)
// Eliminar líneas que empiezan con -- para filtrar comentarios
const sqlLines = sql.split('\n')
const activeSqlLines = sqlLines
  .filter(line => !line.trimStart().startsWith('--'))
  .join('\n')

for (const tabla of tablasForbidden) {
  // La tabla no debe aparecer en sentencias DDL activas como objeto a modificar
  // Patrones: "ON public.tabla", "ALTER TABLE public.tabla", "ON tabla"
  const ddlPattern = new RegExp(
    `(ON\\s+(public\\.)?${tabla}\\b|ALTER\\s+TABLE\\s+(public\\.)?${tabla}\\b|CREATE\\s+TABLE\\s+(public\\.)?${tabla}\\b|DROP\\s+TABLE\\s+(public\\.)?${tabla}\\b)`,
    'i'
  )
  const found = ddlPattern.test(activeSqlLines)
  check(`No modifica tabla prohibida: ${tabla}`, !found,
    found ? `DDL activo encontrado referenciando ${tabla}` : 'OK')
}

// ── 4. Elimina las policies amplias ───────────────────────────────────────────
console.log('\n── Eliminación de policies amplias ──')

check(
  'Elimina policy autenticados_pueden_operar (socio_beneficiarios)',
  /DROP\s+POLICY\s+(IF\s+EXISTS\s+)?autenticados_pueden_operar\s+ON\s+(public\.)?socio_beneficiarios/i.test(activeSqlLines)
)

check(
  'Elimina policy autenticados_pueden_operar_pca (pagos_cuotas_aplicaciones)',
  /DROP\s+POLICY\s+(IF\s+EXISTS\s+)?autenticados_pueden_operar_pca\s+ON\s+(public\.)?pagos_cuotas_aplicaciones/i.test(activeSqlLines)
)

// ── 5. Crea policies con get_user_rol() ───────────────────────────────────────
console.log('\n── Policies granulares con get_user_rol() ──')

check('Usa get_user_rol() en policies', activeSqlLines.includes('get_user_rol()'))

// SELECT debe usar get_user_rol(), no solo auth.uid() IS NOT NULL
check('sb_select usa get_user_rol() (no solo auth.uid())',
  /CREATE\s+POLICY\s+sb_select[\s\S]*?get_user_rol\s*\(\)/i.test(activeSqlLines))
check('pca_select usa get_user_rol() (no solo auth.uid())',
  /CREATE\s+POLICY\s+pca_select[\s\S]*?get_user_rol\s*\(\)/i.test(activeSqlLines))
check('SELECT no usa solo auth.uid() IS NOT NULL',
  !(/CREATE\s+POLICY\s+(sb|pca)_select[\s\S]{0,100}auth\.uid\(\)\s+IS\s+NOT\s+NULL/i.test(activeSqlLines)))

// UPDATE debe tener WITH CHECK además de USING
check('sb_update tiene WITH CHECK',
  /CREATE\s+POLICY\s+sb_update[\s\S]*?WITH\s+CHECK/i.test(activeSqlLines))
check('pca_update tiene WITH CHECK',
  /CREATE\s+POLICY\s+pca_update[\s\S]*?WITH\s+CHECK/i.test(activeSqlLines))

// Verificar que hay al menos 4 CREATE POLICY para cada tabla
const createPoliciesSB = (activeSqlLines.match(/CREATE\s+POLICY\s+sb_\w+\s+ON\s+(public\.)?socio_beneficiarios/gi) || []).length
const createPoliciesPCA = (activeSqlLines.match(/CREATE\s+POLICY\s+pca_\w+\s+ON\s+(public\.)?pagos_cuotas_aplicaciones/gi) || []).length

check(
  'Crea 4 policies para socio_beneficiarios (sb_select, sb_insert, sb_update, sb_delete)',
  createPoliciesSB >= 4,
  `Encontradas: ${createPoliciesSB}`
)

check(
  'Crea 4 policies para pagos_cuotas_aplicaciones (pca_select, pca_insert, pca_update, pca_delete)',
  createPoliciesPCA >= 4,
  `Encontradas: ${createPoliciesPCA}`
)

// Verificar operaciones cubiertas por tabla
const ops = ['SELECT', 'INSERT', 'UPDATE', 'DELETE']
for (const op of ops) {
  check(
    `socio_beneficiarios tiene policy FOR ${op}`,
    new RegExp(`FOR\\s+${op}.*ON\\s+(public\\.)?socio_beneficiarios|ON\\s+(public\\.)?socio_beneficiarios.*FOR\\s+${op}`, 'i').test(activeSqlLines) ||
    (op === 'SELECT' && activeSqlLines.includes('sb_select')) ||
    (op === 'INSERT' && activeSqlLines.includes('sb_insert')) ||
    (op === 'UPDATE' && activeSqlLines.includes('sb_update')) ||
    (op === 'DELETE' && activeSqlLines.includes('sb_delete'))
  )
}

for (const op of ops) {
  check(
    `pagos_cuotas_aplicaciones tiene policy FOR ${op}`,
    (op === 'SELECT' && activeSqlLines.includes('pca_select')) ||
    (op === 'INSERT' && activeSqlLines.includes('pca_insert')) ||
    (op === 'UPDATE' && activeSqlLines.includes('pca_update')) ||
    (op === 'DELETE' && activeSqlLines.includes('pca_delete'))
  )
}

// ── 6. No contiene INSERT/UPDATE/DELETE de datos ──────────────────────────────
console.log('\n── No modifica datos ──')

// Verificar que no hay DML activo (no en comentarios)
// INSERT INTO, UPDATE <tabla> SET, DELETE FROM (que no sean DROP POLICY)
const hasDMLInsert = /^\s*INSERT\s+INTO\s+\w/im.test(activeSqlLines)
const hasDMLUpdate = /^\s*UPDATE\s+\w+\s+SET\s/im.test(activeSqlLines)
const hasDMLDelete = /^\s*DELETE\s+FROM\s+\w/im.test(activeSqlLines)

check('No contiene INSERT INTO datos', !hasDMLInsert,
  hasDMLInsert ? 'Se detectó INSERT INTO — revisar urgente' : 'OK')
check('No contiene UPDATE ... SET datos', !hasDMLUpdate,
  hasDMLUpdate ? 'Se detectó UPDATE SET — revisar urgente' : 'OK')
check('No contiene DELETE FROM datos', !hasDMLDelete,
  hasDMLDelete ? 'Se detectó DELETE FROM — revisar urgente' : 'OK')

// ── 7. No toca Anexo 06 ───────────────────────────────────────────────────────
console.log('\n── No toca Anexo 06 ──')

const hasAnexo6DDL = /anexo.?06|anexo6/i.test(activeSqlLines)
check('No hay DDL activo relacionado con Anexo 06', !hasAnexo6DDL,
  hasAnexo6DDL ? 'Se detectó referencia a Anexo 06 en SQL activo' : 'OK')

// ── 8. Incluye rollback documentado ───────────────────────────────────────────
console.log('\n── Rollback documentado ──')

const hasRollbackComment = /ROLLBACK/i.test(sql)
check('Incluye sección de ROLLBACK en comentario', hasRollbackComment)
check('Rollback cubre socio_beneficiarios', /ROLLBACK[\s\S]*socio_beneficiarios/i.test(sql))
check('Rollback cubre pagos_cuotas_aplicaciones', /ROLLBACK[\s\S]*pagos_cuotas_aplicaciones/i.test(sql))
check('Rollback restaura autenticados_pueden_operar', sql.includes('autenticados_pueden_operar'))
check('Rollback restaura autenticados_pueden_operar_pca', sql.includes('autenticados_pueden_operar_pca'))

// ── 9. RLS sigue habilitado ────────────────────────────────────────────────────
console.log('\n── RLS habilitado ──')

check('ALTER TABLE socio_beneficiarios ENABLE ROW LEVEL SECURITY',
  /ALTER\s+TABLE\s+(public\.)?socio_beneficiarios\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(activeSqlLines))
check('ALTER TABLE pagos_cuotas_aplicaciones ENABLE ROW LEVEL SECURITY',
  /ALTER\s+TABLE\s+(public\.)?pagos_cuotas_aplicaciones\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(activeSqlLines))

// ── 10. Usa TO authenticated (no TO public) ───────────────────────────────────
console.log('\n── Seguridad de políticas ──')

check('Policies usan TO authenticated (no TO public)',
  activeSqlLines.includes('TO authenticated') && !/ TO\s+public\b/i.test(activeSqlLines))

// ── 11. Contiene BEGIN / COMMIT ───────────────────────────────────────────────
const hasTx = /^\s*BEGIN\s*;/im.test(sql) && /^\s*COMMIT\s*;/im.test(sql)
check('Migración está envuelta en BEGIN/COMMIT', hasTx)

// ── Resultado ─────────────────────────────────────────────────────────────────
const total = passed + failed
console.log(`\n=== RESULTADO: ${passed}/${total} checks ===`)

if (ok) {
  console.log('✅ SEC-3C VERIFICADO — La migración es segura para revisión.')
  console.log('   Para aplicar, proporcionar autorización exacta: APLICAR RLS TABLAS SEC-3C')
} else {
  console.log(`❌ ${failed} checks fallaron — revisar migración antes de continuar`)
}

process.exit(ok ? 0 : 1)
