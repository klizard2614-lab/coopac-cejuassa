/**
 * check-pagos-cuotas-10k3c1-prueba.mjs
 * Fase 10K-3C.1 — Verificación de la prueba controlada EJECUTADA de
 * registrar_pago_con_aplicacion (autorización recibida: EJECUTAR PRUEBA
 * CONTROLADA PAGOS 10K-3C.1). La prueba encontró un bug crítico bloqueante
 * (canal_pago text vs enum) — ver el reporte para el detalle completo.
 *
 * Verifica:
 * 1. Existe el reporte y el script de candidatos de solo lectura
 * 2. El reporte declara su estado real (ejecutada, con hallazgo crítico)
 * 3. El reporte documenta el método usado (statement único autocontenido,
 *    sin depender de BEGIN/ROLLBACK en llamadas separadas)
 * 4. El reporte documenta el usuario de prueba real usado (enmascarado)
 * 5. El reporte documenta conteos antes/después idénticos (rollback real)
 * 6. El reporte documenta el hallazgo crítico (canal_pago) con causa raíz
 * 7. El reporte confirma que no quedó ningún dato de prueba persistente
 * 8. El reporte declara que la pantalla NO queda apta para operación hasta
 *    corregir el bug
 * 9. El reporte no toca Anexo 6, ni seguridad, ni pagos históricos, y
 *    mantiene 10K-2B diferida
 * 10. El script de candidatos es de solo lectura (sin insert/update/delete/rpc)
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DOCS = resolve(ROOT, 'docs/ai-recovery')

let passed = 0
let failed = 0

function check(name, condition, detail = '') {
  if (condition) { console.log(`  ✅ ${name}`); passed++ }
  else { console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); failed++ }
}

// ─── Sección 1: Artefactos existen ───────────────────────────────────────────
console.log('\n📄 Sección 1: Artefactos generados')

const REPORT = resolve(DOCS, 'PAGOS_CUOTAS_10K3C1_PRUEBA_CONTROLADA_REPORT.md')
check('Existe PAGOS_CUOTAS_10K3C1_PRUEBA_CONTROLADA_REPORT.md', existsSync(REPORT))

const CANDIDATES_SCRIPT = resolve(ROOT, 'scripts/dry-run-pagos-cuotas-10k3c1-candidates.mjs')
check('Existe script de candidatos de solo lectura', existsSync(CANDIDATES_SCRIPT))

// ─── Sección 2: contenido del reporte ─────────────────────────────────────────
console.log('\n📚 Sección 2: contenido del reporte')

let reportSrc = ''
if (existsSync(REPORT)) {
  reportSrc = readFileSync(REPORT, 'utf8')

  check('Reporte declara su estado real (ejecutada, hallazgo crítico)', /EJECUTADA/i.test(reportSrc) && /HALLAZGO CRÍTICO/i.test(reportSrc))
  check('Reporte registra la autorización explícita recibida', /EJECUTAR PRUEBA CONTROLADA PAGOS 10K-3C\.1/.test(reportSrc))
  check('Reporte documenta el método (statement único autocontenido, sin BEGIN/ROLLBACK en llamadas separadas)', /DO \$\$/.test(reportSrc) && /una sola sesión|misma sesión|una única sentencia/i.test(reportSrc))
  check('Reporte documenta el usuario de prueba real usado (enmascarado, no inventado)', /55f7e60f\.\.\./.test(reportSrc) && /sin UUID inventado/i.test(reportSrc))
  check('Reporte documenta conteos "antes" (832 / 0)', /832/.test(reportSrc) && /pagos_recibos/.test(reportSrc))
  check('Reporte documenta conteos "después" idénticos a "antes"', /Conteos DESPUÉS/i.test(reportSrc) && /✅ Sí/.test(reportSrc))
  check('Reporte confirma explícitamente el rollback', /Confirmación explícita de rollback/i.test(reportSrc))
  check('Reporte confirma que no quedó ningún recibo de prueba', /TEST_10K3C1_%.*0 filas|0 filas.*TEST_10K3C1/is.test(reportSrc) || /recibos_prueba_restantes.*0|0.*recibos_prueba_restantes/is.test(reportSrc) || /Ninguno quedó/i.test(reportSrc))
  check('Reporte documenta el hallazgo crítico (canal_pago text vs enum)', /canal_pago/.test(reportSrc) && /42804/.test(reportSrc))
  check('Reporte explica por qué afecta a todos los pagos (no solo crédito)', /TODOS los pagos|todos los pagos nuevos/i.test(reportSrc))
  check('Reporte recomienda una fase de hotfix con su propia autorización', /10K-3B\.2|hotfix/i.test(reportSrc) && /autorización/i.test(reportSrc))
  check('Reporte declara explícitamente que la pantalla NO queda apta para operación', /\*\*No\.\*\*/i.test(reportSrc) || /no debe usarse en producción/i.test(reportSrc))
  check('Reporte confirma explícitamente que Anexo 6 no fue tocado', /Anexo 6.{0,40}sin cambios/i.test(reportSrc))
  check('Reporte no propone tocar seguridad (RLS/policies/auditoria)', !/ALTER.*POLICY|CREATE POLICY|DROP POLICY/i.test(reportSrc))
  check('Reporte no toca pagos históricos ni ejecuta 10K-2B', /10K-2B/.test(reportSrc) && /diferid/i.test(reportSrc))
  check('Reporte confirma que no se usó db push ni se aplicó ninguna migración', /db push.*no se us|no se us.*db push/is.test(reportSrc) && /[Nn]inguna migración/.test(reportSrc))
}

// ─── Sección 3: script de candidatos es de solo lectura ─────────────────────
console.log('\n🔍 Sección 3: script de candidatos — solo lectura')

if (existsSync(CANDIDATES_SCRIPT)) {
  const src = readFileSync(CANDIDATES_SCRIPT, 'utf8')
  check('Script de candidatos declara explícitamente que es solo lectura', /SOLO LECTURA/i.test(src))
  check('Script de candidatos no hace .insert(', !/\.insert\(/.test(src))
  check('Script de candidatos no hace .update(', !/\.update\(/.test(src))
  check('Script de candidatos no hace .delete(', !/\.delete\(/.test(src))
  check('Script de candidatos no llama ninguna RPC (.rpc()', !/\.rpc\(/.test(src))
}

// ─── Resumen ───────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`)
console.log(`Resultado: ${passed} PASS · ${failed} FAIL de ${passed + failed} checks`)
console.log('─'.repeat(60))
if (/CORREGIDO Y RE-VALIDADO/i.test(reportSrc)) {
  console.log('\n✅ El bug canal_pago fue corregido en 10K-3B.2 y esta misma prueba se')
  console.log('   repitió con éxito. pagos/nuevo queda apta para operación.')
} else {
  console.log('\n🚨 Recordatorio: la prueba SÍ se ejecutó (con rollback automático confirmado)')
  console.log('   y encontró un bug bloqueante (canal_pago). pagos/nuevo NO está apta para')
  console.log('   producción hasta corregirlo. Ver el reporte para el plan de hotfix sugerido.')
}

if (failed > 0) process.exit(1)
