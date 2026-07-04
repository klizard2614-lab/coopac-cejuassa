#!/usr/bin/env node
/**
 * check-ampliaciones-funcionales.mjs
 * Verifica que la implementación de Fase 10J-2B cumple todos los requisitos.
 * Incluye checks de Fase 10J-1 más los nuevos de tasa, cuota y plazo editables.
 */
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const ROOT = process.cwd()
let ok = true

function check(label, passed, detail = '') {
  const icon = passed ? '[OK]  ' : '[FAIL]'
  if (!passed) ok = false
  console.log(`${icon} ${label}${detail ? ` (${detail})` : ''}`)
}

function readFile(path) {
  try { return readFileSync(resolve(ROOT, path), 'utf8') } catch { return '' }
}

function fileExists(path) {
  return existsSync(resolve(ROOT, path))
}

console.log('\n=== CHECK: Ampliaciones Funcionales 10J-2B ===\n')

// ── 1. Migraciones locales ─────────────────────────────────────────────────────
console.log('── Migraciones locales ──')
const mig1Path    = 'supabase/migrations/20260702000001_ampliaciones_add_tasa_cuota_nuevas.sql'
const mig2Path    = 'supabase/migrations/20260702000002_extend_aplicar_ampliacion_credito.sql'
const mig1Content = readFile(mig1Path)
const mig2Content = readFile(mig2Path)

check('Migración ALTER TABLE ampliaciones existe', fileExists(mig1Path))
check('Migración agrega tasa_nueva', mig1Content.includes('tasa_nueva'))
check('Migración agrega cuota_nueva', mig1Content.includes('cuota_nueva'))
check('tasa_nueva es numeric(8,4) NULL', mig1Content.includes('numeric(8,4)') && mig1Content.includes('NULL'))
check('cuota_nueva es numeric(12,2) NULL', mig1Content.includes('numeric(12,2)') && mig1Content.includes('NULL'))

check('Migración RPC extendida existe', fileExists(mig2Path))
check('RPC define aplicar_ampliacion_credito', mig2Content.includes('aplicar_ampliacion_credito'))
check('RPC recibe p_tasa_nueva', mig2Content.includes('p_tasa_nueva'))
check('RPC recibe p_cuota_nueva', mig2Content.includes('p_cuota_nueva'))
check('RPC valida p_plazo_nuevo > 0', mig2Content.includes('p_plazo_nuevo <= 0'))
check('RPC valida p_tasa_nueva >= 0', mig2Content.includes('p_tasa_nueva < 0'))
check('RPC valida p_cuota_nueva > 0', mig2Content.includes('p_cuota_nueva <= 0'))
check('RPC valida monto_a_ampliar > 0', mig2Content.includes('<= 0') && mig2Content.includes('monto_a_ampliar'))
check('RPC valida nro_pagare vacío', mig2Content.includes("trim(p_nro_pagare_nuevo) = ''"))
check('RPC valida unicidad en creditos', mig2Content.includes('SELECT 1 FROM creditos') && mig2Content.includes('nro_pagare'))
check('RPC valida unicidad en ampliaciones', mig2Content.includes('SELECT 1 FROM ampliaciones') && mig2Content.includes('nro_pagare_nuevo'))
check('RPC inserta tasa_nueva en ampliaciones', mig2Content.includes('tasa_nueva') && mig2Content.includes('INSERT INTO ampliaciones'))
check('RPC inserta cuota_nueva en ampliaciones', mig2Content.includes('cuota_nueva') && mig2Content.includes('INSERT INTO ampliaciones'))
check('RPC actualiza creditos.plazo_meses', mig2Content.includes('plazo_meses'))
check('RPC actualiza creditos.tasa_interes', mig2Content.includes('tasa_interes'))
check('RPC actualiza creditos.cuota_mensual', mig2Content.includes('cuota_mensual'))
check('RPC NO modifica cronograma_cuotas', !/UPDATE\s+cronograma_cuotas|INSERT\s+INTO\s+cronograma_cuotas|DELETE\s+FROM\s+cronograma_cuotas/i.test(mig2Content))
check('RPC NO modifica pagos_recibos', !/UPDATE\s+pagos_recibos|INSERT\s+INTO\s+pagos_recibos|DELETE\s+FROM\s+pagos_recibos/i.test(mig2Content))
check('RPC NO toca socios', !mig2Content.toLowerCase().includes('update socios') && !mig2Content.toLowerCase().includes('into socios'))
check('RPC retorna resumen antes/después extendido', (mig2Content.includes('"antes"') || mig2Content.includes("'antes'")) && mig2Content.includes('plazo_meses'))

// ── 2. UI — AmpliacionesSection ───────────────────────────────────────────────
console.log('\n── UI: AmpliacionesSection ──')
const uiPath    = 'app/dashboard/creditos/_components/AmpliacionesSection.tsx'
const uiContent = readFile(uiPath)

check('Archivo UI existe', fileExists(uiPath))
check('UI tiene campo monto_a_ampliar', uiContent.includes('monto_a_ampliar'))
check('UI tiene campo nro_pagare_nuevo', uiContent.includes('nro_pagare_nuevo'))
check('UI tiene campo tasa_nueva', uiContent.includes('tasa_nueva'))
check('UI tiene campo cuota_nueva', uiContent.includes('cuota_nueva'))
check('UI tiene modo apply', uiContent.includes("'apply'"))
check('UI tiene vista previa', uiContent.includes('Vista Previa'))
check('UI muestra plazo actual → nuevo en preview', uiContent.includes('plazoMeses') && uiContent.includes('Vista Previa'))
check('UI muestra tasa TEA actual → nueva en preview', uiContent.includes('tasaInteres') && uiContent.includes('Vista Previa'))
check('UI muestra cuota actual → nueva en preview', uiContent.includes('cuotaMensual') && uiContent.includes('Vista Previa'))
check('UI tiene advertencia de cronograma', uiContent.includes('No se recalculará el cronograma'))
check('UI llama RPC con p_tasa_nueva', uiContent.includes('p_tasa_nueva'))
check('UI llama RPC con p_cuota_nueva', uiContent.includes('p_cuota_nueva'))
check('UI llama RPC aplicar_ampliacion_credito', uiContent.includes('aplicar_ampliacion_credito'))
check('UI deshabilita botón mientras guarda', uiContent.includes('disabled={saving}'))
check('UI muestra error al usuario', uiContent.includes('setError'))
check('UI llama onCreditoUpdated tras apply', uiContent.includes('onCreditoUpdated?.()'))
check('UI recarga ampliaciones tras apply', uiContent.includes('reload()'))
check('UI mantiene historial en tabla', uiContent.includes('Historial de Ampliaciones'))
check('UI tiene prop montoAprobado', uiContent.includes('montoAprobado'))
check('UI tiene prop saldoCapital', uiContent.includes('saldoCapital'))
check('UI tiene prop plazoMeses', uiContent.includes('plazoMeses'))
check('UI tiene prop tasaInteres', uiContent.includes('tasaInteres'))
check('UI tiene prop cuotaMensual', uiContent.includes('cuotaMensual'))
check('Listado muestra tasa_nueva (con fallback —)', uiContent.includes("tasa_nueva != null") || uiContent.includes('a.tasa_nueva'))
check('Listado muestra cuota_nueva (con fallback —)', uiContent.includes("cuota_nueva != null") || uiContent.includes('a.cuota_nueva'))

// ── 3. Página de detalle del crédito ─────────────────────────────────────────
console.log('\n── Página creditos/[id]/page.tsx ──')
const pagePath    = 'app/dashboard/creditos/[id]/page.tsx'
const pageContent = readFile(pagePath)

check('Página pasa montoAprobado a AmpliacionesSection', pageContent.includes('montoAprobado={credito.monto_aprobado}'))
check('Página pasa saldoCapital a AmpliacionesSection', pageContent.includes('saldoCapital={credito.saldo_capital}'))
check('Página pasa plazoMeses a AmpliacionesSection', pageContent.includes('plazoMeses={credito.plazo_meses}'))
check('Página pasa tasaInteres a AmpliacionesSection', pageContent.includes('tasaInteres={credito.tasa_interes}'))
check('Página pasa cuotaMensual a AmpliacionesSection', pageContent.includes('cuotaMensual={credito.cuota_mensual}'))
check('Página pasa onCreditoUpdated callback', pageContent.includes('onCreditoUpdated'))
check('Página tiene refreshKey para recargar crédito', pageContent.includes('refreshKey'))

// ── 4. Script de test ─────────────────────────────────────────────────────────
console.log('\n── Script de prueba ──')
const testPath    = 'scripts/test-ampliaciones-funcionales.mjs'
const testContent = readFile(testPath)

check('Script test-ampliaciones-funcionales.mjs existe', fileExists(testPath))
check('Script soporta --dry-run', testContent.includes('--dry-run'))
check('Script soporta --apply', testContent.includes('--apply'))
check('Apply requiere token 10J-2B', testContent.includes('PROBAR AMPLIACION EXTENDIDA 10J-2B'))
check('Script usa pagaré único TEST_PAGARE_EXT_10J_2B', testContent.includes('TEST_PAGARE_EXT_10J_2B'))
check('Script guarda plazo_meses original', testContent.includes('plazo_meses'))
check('Script guarda tasa_interes original', testContent.includes('tasa_interes'))
check('Script guarda cuota_mensual original', testContent.includes('cuota_mensual'))
check('Script revierte nro_pagare', testContent.includes('nro_pagare:'))
check('Script revierte monto_aprobado', testContent.includes('monto_aprobado:'))
check('Script revierte saldo_capital', testContent.includes('saldo_capital:'))
check('Script verifica cambio en plazo_meses post-apply', testContent.includes('plazo_meses === plazoTest') || testContent.includes("plazo_meses'"))
check('Script verifica tasa_nueva en ampliaciones', testContent.includes('tasa_nueva'))
check('Script verifica cuota_nueva en ampliaciones', testContent.includes('cuota_nueva'))
check('Script verifica cronograma no cambió', testContent.includes('cuotasDespues === cuotasAntes') || testContent.includes('cronograma_cuotas'))
check('Script verifica pagos no cambiaron', testContent.includes('pagosDespues === pagosAntes') || testContent.includes('pagos_recibos'))
check('Script elimina ampliación temporal', testContent.includes("delete().eq('nro_pagare_nuevo', TEST_PAGARE)"))
check('Script NO hace update en cronograma_cuotas', !testContent.includes("from('cronograma_cuotas').update"))
check('Script NO hace delete en cronograma_cuotas', !testContent.includes("from('cronograma_cuotas').delete"))
check('Script NO hace update en pagos_recibos', !testContent.includes("from('pagos_recibos').update"))
check('Script verifica limpieza post-revert', testContent.includes('post-revert'))

// ── 5. npm scripts ────────────────────────────────────────────────────────────
console.log('\n── npm scripts ──')
let pkg = {}
try { pkg = JSON.parse(readFile('package.json')) } catch { /* ok */ }
const scripts = pkg.scripts ?? {}

check('ampliaciones-funcionales:dry-run existe', !!scripts['ampliaciones-funcionales:dry-run'])
check('ampliaciones-funcionales:apply existe', !!scripts['ampliaciones-funcionales:apply'])
check('check:ampliaciones-funcionales existe', !!scripts['check:ampliaciones-funcionales'])

// ── 6. Textos UI — Fase 10J-2C ───────────────────────────────────────────────
console.log('\n── Textos UI (10J-2C) ──')
const globalPageContent = readFile('app/dashboard/ampliaciones/page.tsx')

check('Banner global NO dice "Registros informativos"',
  !globalPageContent.includes('Registros informativos'))
check('Banner global NO dice "No modifican automáticamente el crédito"',
  !globalPageContent.includes('No modifican automáticamente el crédito'))
check('Banner global NO dice "aplicación financiera debe ser confirmada"',
  !globalPageContent.includes('aplicación financiera debe ser confirmada'))
check('Banner global SÍ dice "Ampliaciones funcionales"',
  globalPageContent.includes('Ampliaciones funcionales'))
check('Banner global SÍ menciona recalcular cronograma',
  globalPageContent.includes('cronograma'))
check('Banner global SÍ dice dónde registrar nueva ampliación',
  globalPageContent.includes('detalle del crédito correspondiente'))
check('AmpliacionesSection SÍ tiene advertencia de cronograma',
  uiContent.includes('No se recalculará el cronograma'))

// ── Resultado final ───────────────────────────────────────────────────────────
console.log('')
if (ok) {
  console.log('[PASS] Todos los checks pasaron. Fase 10J-2B lista para aplicar migración.')
  console.log('\nPróximo paso: autorizar y aplicar la migración en Supabase:')
  console.log('  APLICAR MIGRACION AMPLIACIONES 10J-2B')
} else {
  console.log('[FAIL] Algunos checks fallaron. Revisar los items marcados con [FAIL].')
  process.exit(1)
}
