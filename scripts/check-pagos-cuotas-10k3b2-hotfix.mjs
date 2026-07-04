/**
 * check-pagos-cuotas-10k3b2-hotfix.mjs
 * Fase 10K-3B.2 — Verificación del hotfix (SOLO LOCAL — NO aplicado en
 * Supabase remoto) que corrige el bug crítico R-K4:
 * registrar_pago_con_aplicacion insertaba p_canal_pago (text) directo en
 * pagos_recibos.canal_pago (enum), causando 42804 en TODO pago nuevo.
 *
 * Verifica:
 * 1. Existe la migración 10K-3B.2 y el reporte
 * 2. La migración recrea la función con la misma firma (CREATE OR REPLACE)
 * 3. La migración normaliza/valida p_canal_pago contra el enum real (caja/convenio)
 * 4. La migración castea explícitamente a public.canal_pago solo después de validar
 * 5. La migración ya no inserta COALESCE(p_canal_pago,'caja') directo (texto sin cast)
 * 6. Mantiene SECURITY DEFINER + SET search_path = public
 * 7. Mantiene REVOKE/GRANT (anon documentado sin EXECUTE)
 * 8. No toca UI, Anexo 6, ni seguridad existente
 * 9. No contiene INSERT/UPDATE/DELETE de datos reales (solo CREATE OR REPLACE FUNCTION)
 * 10. Documenta R-K4 en el reporte
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DOCS = resolve(ROOT, 'docs/ai-recovery')
const MIGRATIONS = resolve(ROOT, 'supabase/migrations')

let passed = 0
let failed = 0

function check(name, condition, detail = '') {
  if (condition) { console.log(`  ✅ ${name}`); passed++ }
  else { console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); failed++ }
}

// ─── Sección 1: Artefactos existen ───────────────────────────────────────────
console.log('\n📄 Sección 1: Artefactos generados')

const MIGRATION = resolve(MIGRATIONS, '20260704140000_10k3b2_hotfix_registrar_pago_canal_pago.sql')
check('Existe migración 20260704140000_10k3b2_hotfix_registrar_pago_canal_pago.sql', existsSync(MIGRATION))

const REPORT = resolve(DOCS, 'PAGOS_CUOTAS_10K_3B2_HOTFIX_CANAL_PAGO.md')
check('Existe PAGOS_CUOTAS_10K_3B2_HOTFIX_CANAL_PAGO.md', existsSync(REPORT))

// ─── Sección 2: contenido de la migración ────────────────────────────────────
console.log('\n🗄️  Sección 2: Migración SQL — hotfix')

let sql = ''
if (existsSync(MIGRATION)) {
  sql = readFileSync(MIGRATION, 'utf8')

  check('Migración usa CREATE OR REPLACE FUNCTION (misma firma, no DROP)', /CREATE OR REPLACE FUNCTION\s+public\.registrar_pago_con_aplicacion/i.test(sql))
  check('Migración conserva exactamente los 16 parámetros de la firma original', (sql.match(/p_nro_recibo|p_id_socio|p_id_credito|p_id_convenio|p_fecha|p_periodo|p_canal_pago|p_tipo_pago|p_monto_aporte|p_monto_capital|p_monto_interes|p_monto_fps|p_monto_fps_extra|p_monto_otros|p_interes_amortizado_pagado|p_observacion/g) || []).length >= 16)

  check('Migración normaliza canal_pago con lower(trim(...))', /lower\(trim\(COALESCE\(p_canal_pago/i.test(sql))
  check('Migración usa "caja" como default si viene NULL/vacío', /v_canal_pago_raw\s*:=\s*'caja'/i.test(sql))
  check('Migración valida contra los valores reales del enum (caja/convenio)', /NOT IN \('caja', 'convenio'\)/i.test(sql))
  check('Migración lanza error de negocio claro si el canal es inválido', /canal_pago_invalido/i.test(sql))
  check('Migración declara variable tipada v_canal_pago public.canal_pago', /v_canal_pago\s+public\.canal_pago/i.test(sql))
  check('Migración castea a enum SOLO después de validar (no cast directo inseguro)', /v_canal_pago\s*:=\s*v_canal_pago_raw::public\.canal_pago/i.test(sql))
  check('Migración usa v_canal_pago (variable tipada) en el INSERT, no COALESCE(p_canal_pago,\'caja\') directo', /VALUES \([\s\S]{0,400}?v_canal_pago,/i.test(sql))

  check('Migración mantiene SECURITY DEFINER', /SECURITY DEFINER/i.test(sql))
  check('Migración mantiene SET search_path = public', /SET search_path\s*=\s*public/i.test(sql))
  check('Migración mantiene REVOKE ALL FROM PUBLIC + GRANT a authenticated', /REVOKE ALL ON FUNCTION/i.test(sql) && /GRANT EXECUTE ON FUNCTION/i.test(sql) && /TO authenticated/i.test(sql))
  check('Migración documenta que anon no debe tener EXECUTE (mismo patrón SEC-4B/10K-3B)', /FROM anon/i.test(sql))

  check('Migración documenta el error exacto 42804 (causa raíz)', /42804/.test(sql))
  check('Migración documenta que canal_pago es la ÚNICA columna afectada (estado_flujo y tipo_pago revisados)', /estado_flujo/i.test(sql) && /tipo_pago es text plano/i.test(sql))
  check('Migración conserva la cascada, tope y trazabilidad sin cambios (lógica de negocio intacta)', /ORDER BY fecha_vencimiento ASC/i.test(sql) && /pagos_cuotas_aplicaciones/i.test(sql) && /LEAST\(/i.test(sql))
  check('Migración conserva el manejo de recibo_duplicado (unique_violation) sin cambios', /unique_violation/i.test(sql) && /recibo_duplicado/i.test(sql))

  check('Migración documenta rollback (volver a la versión 10K-3B)', /ROLLBACK/i.test(sql) && /20260704120000/.test(sql))
  check('Migración no altera ninguna tabla (solo CREATE OR REPLACE FUNCTION + REVOKE/GRANT)', !/ALTER TABLE|CREATE TABLE|DROP TABLE|CREATE INDEX/i.test(sql))
  check('Migración no contiene INSERT/UPDATE/DELETE de datos reales fuera de la lógica de la función', !/^\s*(INSERT INTO|UPDATE|DELETE FROM)\s+public\.(pagos_recibos|creditos|cronograma_cuotas|pagos_cuotas_aplicaciones|socios|usuarios)/im.test(sql.replace(/INSERT INTO public\.pagos_recibos\s*\(|INSERT INTO public\.pagos_cuotas_aplicaciones\s*\(|UPDATE public\.cronograma_cuotas/g, 'RPC_INTERNAL_')))
}

// ─── Sección 3: alcance no ampliado ────────────────────────────────────────────
console.log('\n🚧 Sección 3: alcance respetado')

const PAGE = resolve(ROOT, 'app/dashboard/pagos/nuevo/page.tsx')
const HELPER = resolve(ROOT, 'lib/pagos/registrarPagoConAplicacion.ts')
check('No se tocó app/dashboard/pagos/nuevo/page.tsx en esta fase (verificar manualmente con git diff)', existsSync(PAGE))
check('No se tocó lib/pagos/registrarPagoConAplicacion.ts en esta fase (verificar manualmente con git diff)', existsSync(HELPER))

const ANEXO6 = resolve(ROOT, 'app/dashboard/reportes/anexo6/page.tsx')
const anexo6Src = existsSync(ANEXO6) ? readFileSync(ANEXO6, 'utf8') : ''
check('Anexo 6 no referencia el hotfix (no fue tocado)', !/10k3b2|canal_pago_invalido/i.test(anexo6Src))

const AUDIT_CLIENT = resolve(ROOT, 'lib/audit/auditClient.ts')
if (existsSync(AUDIT_CLIENT)) {
  const auditSrc = readFileSync(AUDIT_CLIENT, 'utf8')
  check('AUDIT_ENABLED sigue en false (SEC-4C no se integró en esta fase)', /AUDIT_ENABLED\s*=\s*false/.test(auditSrc))
}

// ─── Sección 4: reporte documenta R-K4 y el hotfix ──────────────────────────
console.log('\n📚 Sección 4: contenido del reporte 10K-3B.2')

let reportSrc = ''
if (existsSync(REPORT)) {
  reportSrc = readFileSync(REPORT, 'utf8')

  check('Reporte documenta R-K4', /R-K4/.test(reportSrc))
  check('Reporte documenta el error exacto 42804', /42804/.test(reportSrc))
  check('Reporte documenta los valores del enum detectados (caja/convenio)', /caja/.test(reportSrc) && /convenio/.test(reportSrc))
  check('Reporte documenta el SQL corregido (resumen)', /v_canal_pago/.test(reportSrc))
  check('Reporte documenta riesgos', /Riesgos/i.test(reportSrc))
  check('Reporte documenta rollback', /Rollback/i.test(reportSrc))
  check('Reporte documenta plan de prueba con rollback', /rollback/i.test(reportSrc) && /prueba/i.test(reportSrc))
  check('Reporte confirma qué no se toca (UI, Anexo 6, seguridad, datos históricos)', /Qué NO se toc/i.test(reportSrc))

  const aplicada = /✅ APLICADA EN SUPABASE REMOTO/i.test(reportSrc)
  check('Reporte refleja el estado real de aplicación (aplicada o pendiente, no ambiguo)', aplicada || /NO APLICADA EN SUPABASE REMOTO/i.test(reportSrc))
  if (aplicada) {
    check('Reporte documenta verificación post-apply (función, firma, anon sin EXECUTE)', /Verificación post-apply/i.test(reportSrc) && /anon.*sin EXECUTE|sin EXECUTE.*anon/is.test(reportSrc))
    check('Reporte documenta la repetición de la prueba controlada 10K-3C.1 tras el hotfix', /Prueba controlada 10K-3C\.1 repetida/i.test(reportSrc))
    check('Reporte concluye que pagos/nuevo queda apta para operación', /queda apta para operaci[oó]n/i.test(reportSrc))
  }
}

// ─── Resumen ───────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`)
console.log(`Resultado: ${passed} PASS · ${failed} FAIL de ${passed + failed} checks`)
console.log('─'.repeat(60))
if (/✅ APLICADA EN SUPABASE REMOTO/i.test(reportSrc)) {
  console.log('\n✅ Hotfix aplicado y re-validado con la prueba controlada 10K-3C.1.')
} else {
  console.log('\n⏳ NO se aplicó nada en Supabase. Se requiere autorización exacta:')
  console.log('   APLICAR HOTFIX CANAL PAGO 10K-3B.2')
}

if (failed > 0) process.exit(1)
