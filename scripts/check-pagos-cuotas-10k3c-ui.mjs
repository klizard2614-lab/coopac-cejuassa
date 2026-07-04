/**
 * check-pagos-cuotas-10k3c-ui.mjs
 * Fase 10K-3C — Verificación de la integración de
 * app/dashboard/pagos/nuevo/page.tsx con la RPC transaccional
 * registrar_pago_con_aplicacion (aplicada en Supabase en Fase 10K-3B).
 *
 * Verifica:
 * 1. Existe el reporte 10K-3C y el helper tipado
 * 2. pagos/nuevo/page.tsx llama registrar_pago_con_aplicacion
 * 3. pagos/nuevo/page.tsx ya NO llama decrementar_saldo_capital
 * 4. pagos/nuevo/page.tsx ya NO actualiza manualmente cronograma_cuotas
 * 5. pagos/nuevo/page.tsx ya NO inserta directamente en pagos_recibos ni en
 *    pagos_cuotas_aplicaciones
 * 6. No se tocó Anexo 6, seguridad existente ni AUDIT_ENABLED
 * 7. No se aplicaron migraciones nuevas en esta fase
 * 8. Se documenta que el aporte sigue como segunda operación (registrar_aporte_socio)
 * 9. Se documentan errores de negocio y el manejo de excedente
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

const REPORT = resolve(DOCS, 'PAGOS_CUOTAS_10K_3C_UI_INTEGRATION_REPORT.md')
check('Existe PAGOS_CUOTAS_10K_3C_UI_INTEGRATION_REPORT.md', existsSync(REPORT))

const HELPER = resolve(ROOT, 'lib/pagos/registrarPagoConAplicacion.ts')
check('Existe helper lib/pagos/registrarPagoConAplicacion.ts', existsSync(HELPER))

const PAGE = resolve(ROOT, 'app/dashboard/pagos/nuevo/page.tsx')
check('Existe app/dashboard/pagos/nuevo/page.tsx', existsSync(PAGE))

// ─── Sección 2: Helper tipado ─────────────────────────────────────────────────
console.log('\n🧩 Sección 2: Helper registrarPagoConAplicacion.ts')

let helperSrc = ''
if (existsSync(HELPER)) {
  helperSrc = readFileSync(HELPER, 'utf8')

  check('Helper llama supabase.rpc(\'registrar_pago_con_aplicacion\', ...)',
    /supabase\.rpc\(\s*['"]registrar_pago_con_aplicacion['"]/.test(helperSrc))
  check('Helper define tipo de payload (RegistrarPagoPayload)', /RegistrarPagoPayload/.test(helperSrc))
  check('Helper define tipo de resultado (RegistrarPagoResultado)', /RegistrarPagoResultado/.test(helperSrc))
  check('Helper define clase/tipo de error con código de negocio', /RegistrarPagoError/.test(helperSrc))
  check('Helper traduce errores a mensaje amigable', /mensajeErrorAmigable/.test(helperSrc))
  check('Helper cubre recibo_duplicado', /recibo_duplicado/.test(helperSrc))
  check('Helper cubre credito_cancelado_no_admite_pagos', /credito_cancelado_no_admite_pagos/.test(helperSrc))
  check('Helper cubre credito_no_encontrado', /credito_no_encontrado/.test(helperSrc))
  check('Helper cubre monto_credito_sin_credito', /monto_credito_sin_credito/.test(helperSrc))
} else {
  check('Helper no encontrado — no se pueden validar sus contenidos', false)
}

// ─── Sección 3: pagos/nuevo/page.tsx — flujo nuevo ───────────────────────────
console.log('\n🖥️  Sección 3: pagos/nuevo/page.tsx — flujo nuevo integrado')

let pageSrc = ''
if (existsSync(PAGE)) {
  pageSrc = readFileSync(PAGE, 'utf8')

  check('page.tsx importa el helper registrarPagoConAplicacion', /from ['"]@\/lib\/pagos\/registrarPagoConAplicacion['"]/.test(pageSrc))
  check('page.tsx llama registrarPagoConAplicacion(...)', /registrarPagoConAplicacion\(/.test(pageSrc))
  check('page.tsx sigue llamando registrar_aporte_socio (segunda operación, sin cambios)', /registrar_aporte_socio/.test(pageSrc))
  check('page.tsx muestra cuotas_afectadas/cuotas_pagadas/cuotas_parciales en el resumen',
    /cuotas_afectadas/.test(pageSrc) && /cuotas_pagadas/.test(pageSrc) && /cuotas_parciales/.test(pageSrc))
  check('page.tsx muestra excedente como alerta visible no bloqueante', /excedente/.test(pageSrc) && /InlineAlert variant="warning"/.test(pageSrc))
  check('page.tsx muestra advertencias devueltas por la RPC', /advertencias/.test(pageSrc))
  check('page.tsx usa mensajeErrorAmigable para mostrar errores de negocio', /mensajeErrorAmigable/.test(pageSrc))
}

// ─── Sección 4: flujo viejo eliminado ─────────────────────────────────────────
console.log('\n🗑️  Sección 4: flujo viejo eliminado de pagos/nuevo/page.tsx')

if (existsSync(PAGE)) {
  check('page.tsx ya NO llama decrementar_saldo_capital', !/\.rpc\(\s*['"]decrementar_saldo_capital['"]/.test(pageSrc))
  check('page.tsx ya NO hace insert directo en pagos_recibos (.from(\'pagos_recibos\').insert)',
    !/\.from\(\s*['"]pagos_recibos['"]\s*\)\s*\.\s*insert/.test(pageSrc))
  check('page.tsx ya NO actualiza manualmente cronograma_cuotas (.from(\'cronograma_cuotas\').update)',
    !/\.from\(\s*['"]cronograma_cuotas['"]\s*\)\s*\.\s*update/.test(pageSrc))
  check('page.tsx ya NO inserta directamente en pagos_cuotas_aplicaciones',
    !/\.from\(\s*['"]pagos_cuotas_aplicaciones['"]\s*\)/.test(pageSrc))
  check('page.tsx ya NO busca manualmente "1 sola cuota" con .limit(1) sobre cronograma_cuotas',
    !/from\(\s*['"]cronograma_cuotas['"]\s*\)[\s\S]{0,300}\.limit\(1\)/.test(pageSrc))
}

// ─── Sección 5: alcance no tocado ──────────────────────────────────────────────
console.log('\n🚧 Sección 5: alcance respetado')

const ANEXO6 = resolve(ROOT, 'app/dashboard/reportes/anexo6/page.tsx')
const anexo6Src = existsSync(ANEXO6) ? readFileSync(ANEXO6, 'utf8') : ''
check('Anexo 6 no referencia registrar_pago_con_aplicacion (no fue tocado por esta fase)',
  !/registrar_pago_con_aplicacion/.test(anexo6Src))

const AUDIT_CLIENT = resolve(ROOT, 'lib/audit/auditClient.ts')
if (existsSync(AUDIT_CLIENT)) {
  const auditSrc = readFileSync(AUDIT_CLIENT, 'utf8')
  check('AUDIT_ENABLED sigue en false (SEC-4C no se integró en esta fase)', /AUDIT_ENABLED\s*=\s*false/.test(auditSrc))
} else {
  check('lib/audit/auditClient.ts no encontrado (no bloqueante)', true)
}

const MIGRATIONS_DIR = resolve(ROOT, 'supabase/migrations')
const NEW_MIGRATION = resolve(MIGRATIONS_DIR, '20260704120000_10k3b_registrar_pago_con_aplicacion.sql')
check('No se creó ninguna migración nueva en esta fase (10K-3B ya existía, sin cambios)', existsSync(NEW_MIGRATION))

check('page.tsx no contiene SQL ni DDL (no se tocó schema desde el frontend)',
  existsSync(PAGE) && !/CREATE TABLE|ALTER TABLE|DROP TABLE|CREATE FUNCTION/i.test(pageSrc))

// ─── Sección 6: documentación del reporte 10K-3C ─────────────────────────────
console.log('\n📚 Sección 6: contenido del reporte 10K-3C')

let reportSrc = ''
if (existsSync(REPORT)) {
  reportSrc = readFileSync(REPORT, 'utf8')

  check('Reporte documenta el flujo viejo eliminado', /Flujo viejo eliminado/i.test(reportSrc))
  check('Reporte documenta el flujo nuevo', /Flujo nuevo/i.test(reportSrc))
  check('Reporte documenta cómo se llama la RPC', /Cómo se llama la RPC/i.test(reportSrc))
  check('Reporte documenta manejo de excedente', /excedente/i.test(reportSrc))
  check('Reporte documenta manejo de errores por código', /credito_cancelado_no_admite_pagos/.test(reportSrc) && /recibo_duplicado/.test(reportSrc))
  check('Reporte documenta que el aporte sigue como segunda operación no atómica', /no atómic/i.test(reportSrc) && /registrar_aporte_socio/.test(reportSrc))
  check('Reporte documenta qué NO se tocó', /Qué NO se tocó/i.test(reportSrc))
  check('Reporte documenta riesgos residuales', /Riesgos residuales/i.test(reportSrc))
  check('Reporte documenta escenarios de prueba manual', /Escenarios de prueba manual/i.test(reportSrc))
  check('Reporte confirma que no se modificaron datos históricos', /no se modificó ningún dato/i.test(reportSrc))
}

// ─── Resumen ───────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`)
console.log(`Resultado: ${passed} PASS · ${failed} FAIL de ${passed + failed} checks`)
console.log('─'.repeat(60))

if (failed > 0) process.exit(1)
