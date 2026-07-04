/**
 * generate-pagos-cuotas-10k3b-rpc-plan-excel.mjs
 * Fase 10K-3B — Genera la matriz Excel del plan de RPC transaccional
 * registrar_pago_con_aplicacion.
 *
 * SOLO LECTURA — no toca la base de datos ni Supabase. Datos estáticos
 * extraídos de docs/ai-recovery/PAGOS_CUOTAS_10K_3B_RPC_PLAN.md y de la
 * migración local supabase/migrations/20260704120000_10k3b_registrar_pago_con_aplicacion.sql
 *
 * Ejecutar: node scripts/generate-pagos-cuotas-10k3b-rpc-plan-excel.mjs
 */

import XLSX from 'xlsx'
import { existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const EXPORT_DIR = resolve(ROOT, 'exports/pagos-cuotas-dryrun')

const wb = XLSX.utils.book_new()

// ─── Hoja: firma_rpc ────────────────────────────────────────────────────────

const firmaRows = [
  { parametro: 'p_nro_recibo', tipo: 'text', default: '(requerido)', descripcion: 'Número de recibo del pago' },
  { parametro: 'p_id_socio', tipo: 'bigint', default: '(requerido)', descripcion: 'Socio al que pertenece el pago' },
  { parametro: 'p_id_credito', tipo: 'bigint', default: 'NULL', descripcion: 'Crédito vinculado, si aplica' },
  { parametro: 'p_id_convenio', tipo: 'bigint', default: 'NULL', descripcion: 'Convenio del socio, si aplica' },
  { parametro: 'p_fecha', tipo: 'date', default: 'NULL (validado como requerido)', descripcion: 'Fecha del pago' },
  { parametro: 'p_periodo', tipo: 'text', default: 'NULL (validado formato YYYY-MM)', descripcion: 'Periodo contable del pago' },
  { parametro: 'p_canal_pago', tipo: 'text', default: "'caja'", descripcion: 'Canal por el que se recibió el pago' },
  { parametro: 'p_tipo_pago', tipo: 'text', default: 'NULL', descripcion: 'Tipo de pago SBS (A/K)' },
  { parametro: 'p_monto_aporte', tipo: 'numeric', default: '0', descripcion: 'Monto de aporte (NO procesado por esta RPC, ver reglas)' },
  { parametro: 'p_monto_capital', tipo: 'numeric', default: '0', descripcion: 'Monto de capital aplicable a cuotas' },
  { parametro: 'p_monto_interes', tipo: 'numeric', default: '0', descripcion: 'Monto de interés aplicable a cuotas' },
  { parametro: 'p_monto_fps', tipo: 'numeric', default: '0', descripcion: 'Monto FPS (no toca cuotas)' },
  { parametro: 'p_monto_fps_extra', tipo: 'numeric', default: '0', descripcion: 'Monto FPS extra (no toca cuotas)' },
  { parametro: 'p_monto_otros', tipo: 'numeric', default: '0', descripcion: 'Otros montos (no toca cuotas)' },
  { parametro: 'p_interes_amortizado_pagado', tipo: 'numeric', default: '0', descripcion: 'Campo informativo SBS' },
  { parametro: 'p_observacion', tipo: 'text', default: 'NULL', descripcion: 'Observación libre' },
  { parametro: '— RETURNS —', tipo: 'jsonb', default: '', descripcion: 'id_pago, id_credito, monto_credito_aplicado, cuotas_afectadas, cuotas_pagadas, cuotas_parciales, excedente, aplicaciones_insertadas, advertencias' },
]
const wsFirma = XLSX.utils.json_to_sheet(firmaRows, { header: ['parametro', 'tipo', 'default', 'descripcion'] })
wsFirma['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 32 }, { wch: 70 }]
XLSX.utils.book_append_sheet(wb, wsFirma, 'firma_rpc')

// ─── Hoja: reglas_negocio ────────────────────────────────────────────────────

const reglasRows = [
  { regla: 'Orden de cuotas', definicion: 'fecha_vencimiento ASC dentro de pendiente/vencida/parcial' },
  { regla: 'Monto aplicable', definicion: 'monto_capital + monto_interes (excluye aporte/FPS/otros)' },
  { regla: 'Tope exacto por cuota', definicion: 'capital_aplicar/interes_aplicar nunca superan lo que falta de esa cuota — corrige el bug central de R-K3' },
  { regla: 'Split proporcional', definicion: 'Ratio capital/(capital+interes) del monto disponible cuando no alcanza para la cuota completa' },
  { regla: 'Cascada', definicion: 'Excedente de una cuota pagada pasa automáticamente a la siguiente cuota pendiente del mismo crédito' },
  { regla: 'Excedente final', definicion: 'Si sobra tras cubrir todas las cuotas, se retorna explícito en "excedente" + advertencia — nunca se inventa cuota' },
  { regla: 'Crédito cancelado', definicion: 'Rechaza con credito_cancelado_no_admite_pagos si trae monto de capital/interés (regla explícita por defecto: rechazo)' },
  { regla: 'Monto de capital sin crédito', definicion: 'Rechaza con monto_credito_sin_credito' },
  { regla: 'Pago sin componente de crédito', definicion: 'La sección de cuotas se omite completamente — sin cambios respecto al flujo actual' },
  { regla: 'Trazabilidad', definicion: 'Una fila en pagos_cuotas_aplicaciones por cada cuota tocada, con created_by = auth.uid()' },
  { regla: 'Saldo del crédito', definicion: 'Se actualiza reutilizando la RPC existente decrementar_saldo_capital (no se duplica lógica)' },
  { regla: 'Cuota ya pagada', definicion: 'Nunca se selecciona (filtro por estado la excluye)' },
  { regla: 'Aporte', definicion: 'NO procesado por esta RPC — diferido explícitamente a 10K-3C/10K-3D, el frontend sigue llamando registrar_aporte_socio() por separado' },
]
const wsReglas = XLSX.utils.json_to_sheet(reglasRows, { header: ['regla', 'definicion'] })
wsReglas['!cols'] = [{ wch: 32 }, { wch: 95 }]
XLSX.utils.book_append_sheet(wb, wsReglas, 'reglas_negocio')

// ─── Hoja: flujo_transaccional ────────────────────────────────────────────────

const flujoRows = [
  { paso: 'A', accion: 'Validar rol del caller (admin/tesoreria), socio, fecha, periodo, monto>0, crédito no cancelado, recibo no duplicado', tabla: 'usuarios, socios, pagos_recibos, creditos (SELECT)' },
  { paso: 'B', accion: 'INSERT pagos_recibos', tabla: 'pagos_recibos (INSERT)' },
  { paso: 'C.1', accion: 'Lock del crédito (FOR UPDATE) si hay id_credito', tabla: 'creditos (SELECT FOR UPDATE)' },
  { paso: 'C.2', accion: 'Cascada sobre cronograma_cuotas ordenado por fecha_vencimiento ASC (FOR UPDATE)', tabla: 'cronograma_cuotas (SELECT FOR UPDATE)' },
  { paso: 'C.3', accion: 'UPDATE cronograma_cuotas por cada cuota tocada (capital_pagado, interes_pagado, estado, fecha_pago)', tabla: 'cronograma_cuotas (UPDATE)' },
  { paso: 'C.4', accion: 'INSERT pagos_cuotas_aplicaciones por cada cuota tocada', tabla: 'pagos_cuotas_aplicaciones (INSERT)' },
  { paso: 'C.5', accion: 'PERFORM decrementar_saldo_capital(id_credito, monto_capital)', tabla: 'creditos (UPDATE, vía RPC existente)' },
  { paso: 'C.6', accion: 'Si sobra monto: se agrega advertencia, no se aplica a nada más', tabla: '(sin escritura)' },
  { paso: 'D', accion: 'Si monto_aporte>0: se agrega advertencia (NO se procesa aquí)', tabla: '(sin escritura — diferido)' },
  { paso: 'F', accion: 'RETURN jsonb con resumen completo', tabla: '(sin escritura)' },
]
const wsFlujo = XLSX.utils.json_to_sheet(flujoRows, { header: ['paso', 'accion', 'tabla'] })
wsFlujo['!cols'] = [{ wch: 8 }, { wch: 85 }, { wch: 45 }]
XLSX.utils.book_append_sheet(wb, wsFlujo, 'flujo_transaccional')

// ─── Hoja: validaciones ────────────────────────────────────────────────────────

const validacionesRows = [
  { n: 1, validacion: 'Sesión activa (auth.uid() no nulo)', error_si_falla: 'sin_sesion' },
  { n: 2, validacion: 'Rol del caller es admin o tesoreria', error_si_falla: 'rol_no_autorizado' },
  { n: 3, validacion: 'nro_recibo no vacío', error_si_falla: 'nro_recibo_requerido' },
  { n: 4, validacion: 'id_socio existe en socios', error_si_falla: 'socio_no_encontrado' },
  { n: 5, validacion: 'fecha no nula', error_si_falla: 'fecha_requerida' },
  { n: 6, validacion: 'periodo formato YYYY-MM', error_si_falla: 'periodo_invalido' },
  { n: 7, validacion: 'Monto total (suma de todos los componentes) > 0', error_si_falla: 'monto_invalido' },
  { n: 8, validacion: 'nro_recibo no duplicado (validación de aplicación, no hay UNIQUE en schema)', error_si_falla: 'recibo_duplicado' },
  { n: 9, validacion: 'Si monto_capital/monto_interes > 0, debe haber id_credito', error_si_falla: 'monto_credito_sin_credito' },
  { n: 10, validacion: 'id_credito (si viene) existe en creditos', error_si_falla: 'credito_no_encontrado' },
  { n: 11, validacion: 'Crédito no cancelado si trae monto de capital/interés', error_si_falla: 'credito_cancelado_no_admite_pagos' },
]
const wsValidaciones = XLSX.utils.json_to_sheet(validacionesRows, { header: ['n', 'validacion', 'error_si_falla'] })
wsValidaciones['!cols'] = [{ wch: 5 }, { wch: 75 }, { wch: 40 }]
XLSX.utils.book_append_sheet(wb, wsValidaciones, 'validaciones')

// ─── Hoja: escenarios_prueba ─────────────────────────────────────────────────

const escenariosRows = [
  { escenario: 'Pago exacto de una cuota', verificacion_esperada: '1 fila en cuotas_afectadas, cuotas_pagadas=1, excedente=0, 1 fila en pagos_cuotas_aplicaciones' },
  { escenario: 'Pago parcial', verificacion_esperada: 'cuotas_parciales=1, capital_pagado/interes_pagado incrementados sin superar capital/interes, fecha_pago sigue NULL' },
  { escenario: 'Pago que cubre varias cuotas', verificacion_esperada: 'Cascada: N cuotas en cuotas_afectadas, la última puede quedar parcial' },
  { escenario: 'Pago con sobrante', verificacion_esperada: 'Todas las cuotas del crédito quedan pagadas, excedente>0, advertencia presente' },
  { escenario: 'Pago sin crédito', verificacion_esperada: 'Sección C se omite completamente; cuotas_afectadas=[]; pagos_cuotas_aplicaciones sin filas nuevas' },
  { escenario: 'Pago a crédito cancelado con monto de capital', verificacion_esperada: 'RAISE credito_cancelado_no_admite_pagos; pagos_recibos no llega a insertarse (rollback completo)' },
  { escenario: 'Monto de capital sin id_credito', verificacion_esperada: 'RAISE monto_credito_sin_credito antes de insertar nada' },
  { escenario: 'nro_recibo duplicado (verificación previa)', verificacion_esperada: 'RAISE recibo_duplicado; no se crea un segundo pago' },
  { escenario: 'nro_recibo duplicado con variación de mayúsculas/espacios', verificacion_esperada: 'El índice normalizado (lower+trim) lo detecta igual; RAISE recibo_duplicado' },
  { escenario: 'Carrera simulada: 2 llamadas casi simultáneas con el mismo nro_recibo', verificacion_esperada: 'La segunda es rechazada por el índice único (unique_violation capturado); mismo mensaje recibo_duplicado' },
  { escenario: 'Usuario con rol no autorizado (ej. contabilidad)', verificacion_esperada: 'RAISE rol_no_autorizado' },
  { escenario: 'Cuota ya pagada en el cronograma', verificacion_esperada: 'Se omite automáticamente de la cascada (filtro por estado)' },
]
const wsEscenarios = XLSX.utils.json_to_sheet(escenariosRows, { header: ['escenario', 'verificacion_esperada'] })
wsEscenarios['!cols'] = [{ wch: 45 }, { wch: 95 }]
XLSX.utils.book_append_sheet(wb, wsEscenarios, 'escenarios_prueba')

// ─── Hoja: riesgos_rollback ────────────────────────────────────────────────────

const riesgosRollbackRows = [
  { tipo: 'Riesgo', detalle: 'SECURITY DEFINER bypasea RLS en todas las tablas tocadas', mitigacion: 'Revalidación manual de rol (admin/tesoreria) al inicio de la función, igual que registrar_auditoria (SEC-4B)' },
  { tipo: 'Resuelto (10K-3B.1)', detalle: 'Ausencia de constraint UNIQUE en nro_recibo', mitigacion: 'Auditoría de solo lectura confirmó 0 duplicados (exactos y normalizados) sobre 832 pagos; se agregó pagos_recibos_nro_recibo_unique_idx (índice único parcial normalizado) + captura de unique_violation en la RPC' },
  { tipo: 'Riesgo', detalle: 'Rechazo estricto de crédito cancelado', mitigacion: 'Decisión conservadora documentada; se puede relajar si el usuario confirma un caso legítimo' },
  { tipo: 'Riesgo', detalle: 'Aporte queda fuera de esta transacción (no 100% atómico entre crédito y aporte)', mitigacion: 'Documentado explícitamente como pendiente para 10K-3C/10K-3D' },
  { tipo: 'Riesgo', detalle: 'Cambio de comportamiento visible en producción al implementar la UI', mitigacion: 'Comunicar a Tesorería antes de desplegar 10K-3C' },
  { tipo: 'Riesgo', detalle: 'DROP FUNCTION no revierte pagos ya registrados con la RPC', mitigacion: 'Documentado: rollback solo afecta la función, no los datos ya escritos' },
  { tipo: 'Rollback', detalle: 'DROP FUNCTION IF EXISTS public.registrar_pago_con_aplicacion(text, bigint, bigint, bigint, date, text, text, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text);', mitigacion: 'No implica pérdida de datos ya escritos' },
]
const wsRiesgosRollback = XLSX.utils.json_to_sheet(riesgosRollbackRows, { header: ['tipo', 'detalle', 'mitigacion'] })
wsRiesgosRollback['!cols'] = [{ wch: 12 }, { wch: 65 }, { wch: 75 }]
XLSX.utils.book_append_sheet(wb, wsRiesgosRollback, 'riesgos_rollback')

// ─── Guardar ────────────────────────────────────────────────────────────────────

if (!existsSync(EXPORT_DIR)) mkdirSync(EXPORT_DIR, { recursive: true })
const outPath = resolve(EXPORT_DIR, '10k_3b_rpc_plan.xlsx')
XLSX.writeFile(wb, outPath)

console.log(`✅ Excel generado: exports/pagos-cuotas-dryrun/10k_3b_rpc_plan.xlsx`)
console.log('   Hojas: firma_rpc, reglas_negocio, flujo_transaccional, validaciones, escenarios_prueba, riesgos_rollback')
console.log('\n🔒 SOLO PLAN — la migración NO fue aplicada en Supabase remoto.\n')
