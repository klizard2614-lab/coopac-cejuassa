/**
 * check-pagos-cuotas-10k3b-rpc-plan.mjs
 * Fase 10K-3B — Verificación del plan de RPC transaccional
 * registrar_pago_con_aplicacion (SOLO LOCAL, no aplicada en remoto).
 *
 * Verifica:
 * 1. Existe el documento de plan, el Excel y la migración local
 * 2. La migración crea la RPC con SECURITY DEFINER + SET search_path
 * 3. La migración actualiza cuotas con tope (LEAST) y cascada
 * 4. La migración inserta en pagos_cuotas_aplicaciones
 * 5. La migración evita doble aplicación (chequeo de nro_recibo duplicado)
 * 6. La migración retorna JSON con el resumen esperado
 * 7. No aplica pagos históricos (10K-2B), no toca Anexo 6, no toca seguridad existente
 * 8. No modifica la UI (pagos/nuevo/page.tsx sin cambios)
 * 9. No contiene SQL destructivo de datos (DROP TABLE/TRUNCATE de tablas reales,
 *    DELETE sin WHERE)
 * 10. La migración NO fue aplicada en remoto (no hay evidencia de ejecución)
 */

import { readFileSync, existsSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import XLSX from 'xlsx'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DOCS = resolve(ROOT, 'docs/ai-recovery')
const SCRIPTS = resolve(ROOT, 'scripts')
const EXPORTS = resolve(ROOT, 'exports/pagos-cuotas-dryrun')
const MIGRATIONS = resolve(ROOT, 'supabase/migrations')

let passed = 0
let failed = 0

function check(name, condition, detail = '') {
  if (condition) { console.log(`  ✅ ${name}`); passed++ }
  else { console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); failed++ }
}

// ─── Sección 1: Artefactos existen ───────────────────────────────────────────
console.log('\n📄 Sección 1: Artefactos generados')

const DOC = resolve(DOCS, 'PAGOS_CUOTAS_10K_3B_RPC_PLAN.md')
check('Existe PAGOS_CUOTAS_10K_3B_RPC_PLAN.md', existsSync(DOC))

const EXCEL = resolve(EXPORTS, '10k_3b_rpc_plan.xlsx')
check('Existe Excel 10k_3b_rpc_plan.xlsx', existsSync(EXCEL))

const MIGRATION = resolve(MIGRATIONS, '20260704120000_10k3b_registrar_pago_con_aplicacion.sql')
check('Existe migración local 20260704120000_10k3b_registrar_pago_con_aplicacion.sql', existsSync(MIGRATION))

const GEN_SCRIPT = resolve(SCRIPTS, 'generate-pagos-cuotas-10k3b-rpc-plan-excel.mjs')
check('Existe script generador del Excel', existsSync(GEN_SCRIPT))

// ─── Sección 2: Contenido de la migración SQL ────────────────────────────────
console.log('\n🗄️  Sección 2: Migración SQL')

let sql = ''
if (existsSync(MIGRATION)) {
  sql = readFileSync(MIGRATION, 'utf8')

  check('Migración crea la función registrar_pago_con_aplicacion', /CREATE OR REPLACE FUNCTION\s+public\.registrar_pago_con_aplicacion/i.test(sql))
  check('Migración usa SECURITY DEFINER', /SECURITY DEFINER/i.test(sql))
  check('Migración usa SET search_path = public', /SET search_path\s*=\s*public/i.test(sql))
  check('Migración documenta por qué usa SECURITY DEFINER (RLS de cronograma_cuotas/creditos)', /admin.*creditos|creditos.*admin/i.test(sql) && /cronograma_cuotas|RLS/i.test(sql))
  check('Migración revalida rol del caller manualmente (admin/tesoreria)', /rol_no_autorizado/i.test(sql) && /'admin', 'tesoreria'/.test(sql))

  check('Migración actualiza cuotas con tope exacto (LEAST)', /LEAST\(/i.test(sql))
  check('Migración ordena la cascada por fecha_vencimiento ASC', /ORDER BY fecha_vencimiento ASC/i.test(sql))
  check('Migración usa FOR UPDATE (row lock) sobre cronograma_cuotas', /cronograma_cuotas[\s\S]{0,200}FOR UPDATE/i.test(sql))
  check('Migración actualiza capital_pagado e interes_pagado', sql.includes('capital_pagado') && sql.includes('interes_pagado'))
  check('Migración actualiza fecha_pago solo cuando la cuota queda pagada', /estado = 'pagada'[\s\S]{0,60}fecha_pago = p_fecha/i.test(sql))

  check('Migración inserta en pagos_cuotas_aplicaciones', /INSERT INTO public\.pagos_cuotas_aplicaciones/i.test(sql))

  check('Migración valida nro_recibo duplicado (evita doble aplicación)', /recibo_duplicado/i.test(sql) && /lower\(trim\(nro_recibo\)\)/i.test(sql))

  check('Migración crea protección fuerte contra duplicados (índice único normalizado)',
    /CREATE UNIQUE INDEX IF NOT EXISTS pagos_recibos_nro_recibo_unique_idx/i.test(sql) &&
    /lower\(trim\(nro_recibo\)\)/i.test(sql) &&
    /WHERE nro_recibo IS NOT NULL AND trim\(nro_recibo\)\s*<>\s*''/i.test(sql))

  check('Migración captura unique_violation del INSERT y lo traduce a recibo_duplicado',
    /EXCEPTION[\s\S]{0,80}WHEN unique_violation THEN[\s\S]{0,200}recibo_duplicado/i.test(sql))

  check('Migración documenta la auditoría de duplicados (0 encontrados) antes de proponer el índice',
    /0 duplicados|duplicados normalizados.*0|confirm[oó].*0/i.test(sql))

  check('Migración incluye DROP INDEX en el rollback del índice único', /DROP INDEX IF EXISTS public\.pagos_recibos_nro_recibo_unique_idx/i.test(sql))

  check('Migración reutiliza decrementar_saldo_capital (no duplica lógica de saldo)', /PERFORM public\.decrementar_saldo_capital/i.test(sql))

  check('Migración retorna JSON con id_pago', /jsonb_build_object\(\s*'id_pago'/i.test(sql))
  check('Migración retorna JSON con cuotas_afectadas', sql.includes("'cuotas_afectadas'"))
  check('Migración retorna JSON con excedente', sql.includes("'excedente'"))
  check('Migración retorna JSON con aplicaciones_insertadas', sql.includes("'aplicaciones_insertadas'"))
  check('Migración retorna JSON con advertencias', sql.includes("'advertencias'"))

  check('Migración rechaza crédito cancelado con monto de capital/interés', /credito_cancelado_no_admite_pagos/i.test(sql))
  check('Migración rechaza monto de capital sin crédito', /monto_credito_sin_credito/i.test(sql))

  check('Migración documenta que el aporte queda diferido (NO se procesa aquí)', /diferid[oa]|10K-3C|10K-3D/i.test(sql) && /aporte/i.test(sql))

  check('Migración tiene GRANT EXECUTE a authenticated', /GRANT EXECUTE ON FUNCTION public\.registrar_pago_con_aplicacion[\s\S]{0,200}TO authenticated/i.test(sql))
  check('Migración tiene bloque de rollback (DROP FUNCTION) documentado', /DROP FUNCTION IF EXISTS public\.registrar_pago_con_aplicacion/i.test(sql))

  check('Migración NO contiene SQL destructivo (DROP TABLE / TRUNCATE de tablas reales)', !/\bDROP TABLE\b|\bTRUNCATE\b/i.test(sql))
  check('Migración NO contiene DELETE sin WHERE', !/DELETE FROM public\.\w+\s*;/i.test(sql))
  check('Migración NO ejecuta pagos históricos (no referencia dry-run-pagos-cuotas-10k2a ni apply masivo)', !/dry-run-pagos-cuotas-10k2a|apply.*masivo|APLICAR PAGOS A CUOTAS 10K-2\b/i.test(sql))
  check('Migración NO referencia Anexo 6', !/anexo6|anexo_6/i.test(sql))
  check('Migración NO modifica policies/RLS existentes (solo GRANT/REVOKE de su propia función)', !/CREATE POLICY|ALTER POLICY|DROP POLICY|DISABLE ROW LEVEL SECURITY/i.test(sql))
  check('Migración marca explícitamente que NO debe aplicarse sin autorización', /NO APLICAR EN SUPABASE SIN AUTORIZACI[OÓ]N EXACTA/i.test(sql) && sql.includes('APLICAR RPC PAGOS NUEVOS 10K-3B'))
} else {
  check('Contenido de la migración verificable', false, 'migración no existe')
}

// ─── Sección 3: Contenido del documento ──────────────────────────────────────
console.log('\n📋 Sección 3: Contenido del documento de plan')

let doc = ''
if (existsSync(DOC)) {
  doc = readFileSync(DOC, 'utf8')

  check('Documento referencia el problema R-K3', doc.includes('R-K3'))
  check('Documento tiene sección "Auditoría de duplicados"', /auditor[ií]a de duplicados/i.test(doc))
  check('Documento reporta 0 duplicados exactos y normalizados encontrados', /\*\*0\*\*/.test(doc) || /\| 0 \|/.test(doc) || /duplicados.*normalizados\)\s*\|\s*\*\*0\*\*/i.test(doc))
  check('Documento tiene sección "Estrategia elegida" (Opción A: índice único)', /estrategia elegida.*opci[oó]n a/i.test(doc))
  check('Documento explica por qué la estrategia es segura', /por qu[eé] es segura/i.test(doc))
  check('Documento confirma rechazo de créditos cancelados sin cambios', /créditos cancelados se \*\*rechazan\*\*|rechaza.*cr[eé]dito.*cancelado/i.test(doc))
  check('Documento confirma que el aporte sigue diferido sin cambios', /aporte \*\*queda fuera\*\*|aporte.*diferid/i.test(doc))
  check('Documento tiene sección "Firma de la RPC"', /firma de la rpc/i.test(doc))
  check('Documento tiene sección "Reglas de negocio"', /reglas de negocio/i.test(doc))
  check('Documento tiene sección sobre cómo se evita la doble aplicación', /doble aplicaci[oó]n/i.test(doc))
  check('Documento tiene sección "Validaciones"', /## validaciones/i.test(doc))
  check('Documento tiene sección "Riesgos"', /##\s*riesgos/i.test(doc))
  check('Documento tiene sección "Rollback"', /##\s*rollback/i.test(doc))
  check('Documento tiene sección "Escenarios de prueba"', /escenarios de prueba/i.test(doc))
  check('Documento define qué queda para 10K-3C (UI)', doc.includes('10K-3C'))
  check('Documento tiene sección "Qué NO se toca"', /qué no se toca/i.test(doc))
  check('Documento confirma que NO se aplicó la migración en remoto', /no se aplic[oó] la migraci[oó]n en supabase remoto|no.*aplic.*remoto/i.test(doc))
  check('Documento confirma que 10K-2B sigue diferida', /10K-2B\)[\s\S]{0,40}sigue diferida|sigue diferid/i.test(doc))
  check('Documento pide la autorización exacta antes de aplicar', doc.includes('APLICAR RPC PAGOS NUEVOS 10K-3B'))
} else {
  check('Contenido del documento verificable', false, 'documento no existe')
}

// ─── Sección 4: Hojas del Excel ───────────────────────────────────────────────
console.log('\n📊 Sección 4: Hojas de la matriz Excel')

const HOJAS_ESPERADAS = [
  'firma_rpc',
  'reglas_negocio',
  'flujo_transaccional',
  'validaciones',
  'escenarios_prueba',
  'riesgos_rollback',
]

if (existsSync(EXCEL)) {
  const wb = XLSX.readFile(EXCEL)
  for (const hoja of HOJAS_ESPERADAS) {
    check(`Hoja "${hoja}" presente`, wb.SheetNames.includes(hoja))
  }
  check('Excel tiene exactamente las 6 hojas esperadas',
    wb.SheetNames.length === HOJAS_ESPERADAS.length &&
    wb.SheetNames.every(s => HOJAS_ESPERADAS.includes(s)))
} else {
  for (const hoja of HOJAS_ESPERADAS) check(`Hoja "${hoja}" presente`, false, 'Excel no existe')
}

// ─── Sección 5: UI no modificada ───────────────────────────────────────────────
console.log('\n🖥️  Sección 5: UI sin modificar')

const PAGOS_NUEVO_PAGE = resolve(ROOT, 'app/dashboard/pagos/nuevo/page.tsx')
if (existsSync(PAGOS_NUEVO_PAGE)) {
  const src = readFileSync(PAGOS_NUEVO_PAGE, 'utf8')
  check('pagos/nuevo/page.tsx NO llama todavía a registrar_pago_con_aplicacion', !src.includes('registrar_pago_con_aplicacion'))
}

// ─── Sección 6: No aplicado en remoto ─────────────────────────────────────────
console.log('\n🔒 Sección 6: No aplicado en remoto')

// Verificar que ninguna otra migración posterior ni script marque esta función como aplicada
// Nota (Fase 10K-3B.2): el hotfix de canal_pago (R-K4) reemplaza esta misma
// función en un archivo aparte por diseño (CREATE OR REPLACE, no una copia
// accidental) — se excluye explícitamente de este chequeo junto con el
// archivo original.
const ARCHIVOS_REFERENCIA_ESPERADA = [
  '20260704120000_10k3b_registrar_pago_con_aplicacion.sql',
  '20260704140000_10k3b2_hotfix_registrar_pago_canal_pago.sql',
]
let migracionesConReferenciaAplicada = false
if (existsSync(MIGRATIONS)) {
  const archivos = readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql') && !ARCHIVOS_REFERENCIA_ESPERADA.includes(f))
  for (const f of archivos) {
    const contenido = readFileSync(resolve(MIGRATIONS, f), 'utf8')
    if (/registrar_pago_con_aplicacion/i.test(contenido)) migracionesConReferenciaAplicada = true
  }
}
check('Ninguna migración inesperada referencia registrar_pago_con_aplicacion (solo 10K-3B y el hotfix 10K-3B.2 documentado)', !migracionesConReferenciaAplicada)
check('El documento no afirma "RPC aplicada en Supabase" ni "migración aplicada en remoto"',
  !/RPC aplicada en supabase|migraci[oó]n aplicada en remoto/i.test(doc))

// ─── Sección 7: package.json ──────────────────────────────────────────────────
console.log('\n📦 Sección 7: Comando npm')

const PKG = resolve(ROOT, 'package.json')
if (existsSync(PKG)) {
  const pkg = JSON.parse(readFileSync(PKG, 'utf8'))
  check('Script npm "check:pagos-cuotas-10k3b" registrado', !!pkg.scripts?.['check:pagos-cuotas-10k3b'])
}

// ─── Resumen ──────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60))
console.log(`\n📊 Resultado: ${passed} PASS · ${failed} FAIL\n`)

if (failed > 0) {
  console.log('❌ Verificación FALLIDA — revisar los items marcados antes de continuar.')
  process.exit(1)
} else {
  console.log('✅ Todos los checks pasan. El plan 10K-3B está listo para revisión del usuario.')
  console.log('\n⏳ NO se aplicó nada en Supabase. Se requiere autorización exacta: APLICAR RPC PAGOS NUEVOS 10K-3B\n')
  process.exit(0)
}
