#!/usr/bin/env node
/**
 * generate-rls-audit-matrix.mjs
 * Genera exports/security/rls_audit_matrix.xlsx con el estado real de RLS
 * auditado en Fase SEC-3A (2026-07-02).
 * Datos obtenidos de Supabase remoto (proyecto ljdjbhsipgkxlgnprzhm) en modo solo lectura.
 */
import { mkdirSync } from 'fs'
import { resolve } from 'path'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')
const ROOT = process.cwd()

const outputDir  = resolve(ROOT, 'exports/security')
const outputPath = resolve(outputDir, 'rls_audit_matrix.xlsx')

mkdirSync(outputDir, { recursive: true })

// Datos reales auditados en SEC-3A — NO modificar sin re-auditar
const rows = [
  // tabla | rls_enabled | policy_name | command | roles | using_expression | with_check_expression | riesgo | recomendacion
  ['usuarios', true, 'usuarios_select', 'SELECT', 'public', 'auth.uid() IS NOT NULL', null, 'BAJO', 'Migrar TO public → TO authenticated en SEC-3D'],
  ['usuarios', true, 'usuarios_insert', 'INSERT', 'public', null, "get_user_rol() = 'admin'", 'BAJO', 'Solo admin — correcto. Migrar TO authenticated en SEC-3D'],
  ['usuarios', true, 'usuarios_update', 'UPDATE', 'public', "get_user_rol() = 'admin'", null, 'BAJO', 'Solo admin — correcto. Migrar TO authenticated en SEC-3D'],
  ['usuarios', true, 'usuarios_delete', 'DELETE', 'public', "get_user_rol() = 'admin'", null, 'BAJO', 'Solo admin — correcto. Migrar TO authenticated en SEC-3D'],

  ['socios', true, 'socios_select', 'SELECT', 'public', 'auth.uid() IS NOT NULL', null, 'BAJO', 'Correcto — todos los autenticados pueden leer socios'],
  ['socios', true, 'socios_insert', 'INSERT', 'public', null, "get_user_rol() IN ('admin','creditos')", 'BAJO', 'Correcto por rol. Migrar TO authenticated en SEC-3D'],
  ['socios', true, 'socios_update', 'UPDATE', 'public', "get_user_rol() IN ('admin','creditos')", null, 'BAJO', 'Correcto por rol. Migrar TO authenticated en SEC-3D'],
  ['socios', true, 'socios_delete', 'DELETE', 'public', "get_user_rol() = 'admin'", null, 'BAJO', 'Solo admin elimina socios — correcto'],

  ['creditos', true, 'creditos_select', 'SELECT', 'public', 'auth.uid() IS NOT NULL', null, 'BAJO', 'Correcto — lectura libre para autenticados'],
  ['creditos', true, 'creditos_insert', 'INSERT', 'public', null, "get_user_rol() IN ('admin','creditos')", 'BAJO', 'Correcto por rol. Migrar TO authenticated'],
  ['creditos', true, 'creditos_update', 'UPDATE', 'public', "get_user_rol() IN ('admin','creditos')", null, 'BAJO', 'Correcto por rol. Migrar TO authenticated'],
  ['creditos', true, 'creditos_delete', 'DELETE', 'public', "get_user_rol() = 'admin'", null, 'BAJO', 'Solo admin elimina — correcto'],

  ['pagos_recibos', true, 'pagos_select', 'SELECT', 'public', 'auth.uid() IS NOT NULL', null, 'BAJO', 'Correcto'],
  ['pagos_recibos', true, 'pagos_insert', 'INSERT', 'public', null, "get_user_rol() IN ('admin','tesoreria')", 'BAJO', 'Correcto — tesorería registra pagos'],
  ['pagos_recibos', true, 'pagos_update', 'UPDATE', 'public', "get_user_rol() IN ('admin','tesoreria')", null, 'BAJO', 'Correcto por rol'],
  ['pagos_recibos', true, 'pagos_delete', 'DELETE', 'public', "get_user_rol() = 'admin'", null, 'BAJO', 'Solo admin — correcto'],

  ['aportes', true, 'aportes_select', 'SELECT', 'public', 'auth.uid() IS NOT NULL', null, 'BAJO', 'Correcto'],
  ['aportes', true, 'aportes_insert', 'INSERT', 'public', null, "get_user_rol() IN ('admin','tesoreria')", 'BAJO', 'Correcto — tesorería registra aportes'],
  ['aportes', true, 'aportes_update', 'UPDATE', 'public', "get_user_rol() IN ('admin','tesoreria')", null, 'BAJO', 'Correcto por rol'],
  ['aportes', true, 'aportes_delete', 'DELETE', 'public', "get_user_rol() = 'admin'", null, 'BAJO', 'Solo admin — correcto'],

  ['egresos', true, 'egresos_select', 'SELECT', 'public', 'auth.uid() IS NOT NULL', null, 'BAJO', 'Correcto'],
  ['egresos', true, 'egresos_insert', 'INSERT', 'public', null, "get_user_rol() IN ('admin','tesoreria')", 'BAJO', 'Correcto — tesorería registra egresos'],
  ['egresos', true, 'egresos_update', 'UPDATE', 'public', "get_user_rol() IN ('admin','tesoreria')", null, 'BAJO', 'Correcto por rol'],
  ['egresos', true, 'egresos_delete', 'DELETE', 'public', "get_user_rol() = 'admin'", null, 'BAJO', 'Solo admin — correcto'],

  ['cronograma_cuotas', true, 'cronograma_select', 'SELECT', 'public', 'auth.uid() IS NOT NULL', null, 'BAJO', 'Correcto'],
  ['cronograma_cuotas', true, 'cronograma_insert', 'INSERT', 'public', null, "get_user_rol() IN ('admin','creditos')", 'BAJO', 'Correcto (RPC usar SECURITY DEFINER)'],
  ['cronograma_cuotas', true, 'cronograma_update', 'UPDATE', 'public', "get_user_rol() IN ('admin','creditos')", null, 'BAJO', 'Correcto por rol'],
  ['cronograma_cuotas', true, 'cronograma_delete', 'DELETE', 'public', "get_user_rol() = 'admin'", null, 'BAJO', 'Solo admin — correcto'],

  ['ampliaciones', true, 'ampliaciones_select', 'SELECT', 'public', 'auth.uid() IS NOT NULL', null, 'BAJO', 'Correcto'],
  ['ampliaciones', true, 'ampliaciones_insert', 'INSERT', 'public', null, "get_user_rol() IN ('admin','creditos')", 'BAJO', 'Correcto por rol'],
  ['ampliaciones', true, 'ampliaciones_update', 'UPDATE', 'public', "get_user_rol() IN ('admin','creditos')", null, 'BAJO', 'Correcto por rol'],
  ['ampliaciones', true, 'ampliaciones_delete', 'DELETE', 'public', "get_user_rol() = 'admin'", null, 'BAJO', 'Solo admin — correcto'],

  ['socio_beneficiarios', true, 'autenticados_pueden_operar', 'ALL', 'authenticated', 'true', 'true', 'ALTO', '❌ POLICY AMPLIA — reemplazar con 4 policies por rol en SEC-3C'],

  ['pagos_cuotas_aplicaciones', true, 'autenticados_pueden_operar_pca', 'ALL', 'authenticated', 'true', 'true', 'ALTO', '❌ POLICY AMPLIA — reemplazar con 4 policies por rol en SEC-3C'],

  ['configuracion', true, 'config_select', 'SELECT', 'public', 'auth.uid() IS NOT NULL', null, 'BAJO', 'Correcto'],
  ['configuracion', true, 'config_insert', 'INSERT', 'public', null, "get_user_rol() = 'admin'", 'BAJO', '⭐ Solo admin — muy bien protegida'],
  ['configuracion', true, 'config_update', 'UPDATE', 'public', "get_user_rol() = 'admin'", null, 'BAJO', '⭐ Solo admin — muy bien protegida'],
  ['configuracion', true, 'config_delete', 'DELETE', 'public', "get_user_rol() = 'admin'", null, 'BAJO', '⭐ Solo admin — muy bien protegida'],

  ['convenios', true, 'convenios_select', 'SELECT', 'public', 'auth.uid() IS NOT NULL', null, 'BAJO', 'Correcto'],
  ['convenios', true, 'convenios_insert', 'INSERT', 'public', null, "get_user_rol() IN ('admin','tesoreria')", 'BAJO', 'Correcto por rol'],
  ['convenios', true, 'convenios_update', 'UPDATE', 'public', "get_user_rol() IN ('admin','tesoreria')", null, 'BAJO', 'Correcto por rol'],
  ['convenios', true, 'convenios_delete', 'DELETE', 'public', "get_user_rol() = 'admin'", null, 'BAJO', 'Solo admin — correcto'],

  ['auditoria', true, 'auditoria_select', 'SELECT', 'public', 'auth.uid() IS NOT NULL', null, 'BAJO', 'Correcto para lectura'],
  ['auditoria', true, 'auditoria_insert', 'INSERT', 'public', null, 'auth.uid() IS NOT NULL', 'BAJO-MEDIO', 'Cualquier autenticado puede insertar — evaluar RPC SECURITY DEFINER en SEC-4'],

  ['cartera_mes', true, 'cartera_mes_select', 'SELECT', 'public', 'auth.uid() IS NOT NULL', null, 'BAJO', 'Correcto'],
  ['cartera_mes', true, 'cartera_mes_insert', 'INSERT', 'public', null, "get_user_rol() IN ('admin','creditos')", 'BAJO', 'Correcto por rol. Sin migración local — crear en SEC-3E'],
  ['cartera_mes', true, 'cartera_mes_update', 'UPDATE', 'public', "get_user_rol() IN ('admin','creditos')", null, 'BAJO', 'Correcto por rol'],
  ['cartera_mes', true, 'cartera_mes_delete', 'DELETE', 'public', "get_user_rol() = 'admin'", null, 'BAJO', 'Solo admin — correcto'],

  ['cartera_resumen_mes', true, 'cartera_resumen_select', 'SELECT', 'public', 'auth.uid() IS NOT NULL', null, 'BAJO', 'Correcto'],
  ['cartera_resumen_mes', true, 'cartera_resumen_insert', 'INSERT', 'public', null, "get_user_rol() IN ('admin','creditos')", 'BAJO', 'Correcto por rol. Sin migración local — crear en SEC-3E'],
  ['cartera_resumen_mes', true, 'cartera_resumen_update', 'UPDATE', 'public', "get_user_rol() IN ('admin','creditos')", null, 'BAJO', 'Correcto por rol'],
  ['cartera_resumen_mes', true, 'cartera_resumen_delete', 'DELETE', 'public', "get_user_rol() = 'admin'", null, 'BAJO', 'Solo admin — correcto'],

  ['validacion_cuadre_mes', true, 'validacion_select', 'SELECT', 'public', 'auth.uid() IS NOT NULL', null, 'BAJO', 'Correcto'],
  ['validacion_cuadre_mes', true, 'validacion_insert', 'INSERT', 'public', null, "get_user_rol() IN ('admin','contabilidad')", 'BAJO', 'Correcto por rol. Sin migración local — crear en SEC-3E'],
  ['validacion_cuadre_mes', true, 'validacion_update', 'UPDATE', 'public', "get_user_rol() IN ('admin','contabilidad')", null, 'BAJO', 'Correcto por rol'],
  ['validacion_cuadre_mes', true, 'validacion_delete', 'DELETE', 'public', "get_user_rol() = 'admin'", null, 'BAJO', 'Solo admin — correcto'],
]

const headers = [
  'tabla',
  'rls_enabled',
  'policy_name',
  'command',
  'roles',
  'using_expression',
  'with_check_expression',
  'riesgo',
  'recomendacion',
]

const wsData = [headers, ...rows]
const ws = XLSX.utils.aoa_to_sheet(wsData)

// Anchos de columna
ws['!cols'] = [
  { wch: 30 }, // tabla
  { wch: 12 }, // rls_enabled
  { wch: 35 }, // policy_name
  { wch: 10 }, // command
  { wch: 14 }, // roles
  { wch: 40 }, // using_expression
  { wch: 45 }, // with_check_expression
  { wch: 12 }, // riesgo
  { wch: 70 }, // recomendacion
]

const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, 'RLS Audit SEC-3A')

XLSX.writeFile(wb, outputPath)
console.log(`✅ Matriz generada: ${outputPath}`)
console.log(`   Filas: ${rows.length} (${rows.filter(r => r[7] === 'ALTO').length} ALTO, ${rows.filter(r => r[7] === 'BAJO-MEDIO').length} BAJO-MEDIO, ${rows.filter(r => r[7] === 'BAJO').length} BAJO)`)
