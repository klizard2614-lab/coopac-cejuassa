/**
 * generate-pagos-cuotas-10k2a-revision-manual-excel.mjs
 * Fase 10K-2A.1 — Genera el Excel de revisión manual para Tesorería/Créditos.
 *
 * SOLO LECTURA — no toca la base de datos ni ninguna tabla. Usa datos ya
 * enmascarados y documentados en:
 * - docs/ai-recovery/PAGOS_CUOTAS_10K_2A_DRY_RUN_REPORT.md
 * - docs/ai-recovery/pagos_cuotas_10k2a_dryrun_preview.json
 * - docs/ai-recovery/PAGOS_MATCH_MEDIO_REVIEW.md
 *
 * Ejecutar: node scripts/generate-pagos-cuotas-10k2a-revision-manual-excel.mjs
 */

import XLSX from 'xlsx'
import { existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const EXPORT_DIR = resolve(ROOT, 'exports/pagos-cuotas-dryrun')

const wb = XLSX.utils.book_new()

// ─── Hoja: resumen_para_tesoreria ─────────────────────────────────────────────

const resumenRows = [
  { dato: 'Fase', valor: '10K-2A.1 — Paquete de revisión manual' },
  { dato: 'Modo', valor: 'SOLO DOCUMENTACIÓN — ningún dato fue modificado' },
  { dato: 'Total pagos_recibos auditados', valor: 832 },
  { dato: 'Pagos aplicables a cuotas (con crédito, monto>0)', valor: 26 },
  { dato: 'Cuotas que quedarían PAGADAS si se aprueba', valor: 8 },
  { dato: 'Cuotas que quedarían PARCIALES si se aprueba', valor: 26 },
  { dato: 'Cuotas únicas afectadas', valor: 33 },
  { dato: 'Monto total propuesto a aplicar (S/)', valor: 8870.70 },
  { dato: 'Filas en pagos_cuotas_aplicaciones (confirmado)', valor: 0 },
  { dato: 'Casos que requieren decisión de Tesorería/Créditos', valor: 3 },
  { dato: '1. Pago con monto excesivo', valor: '411**** (R-K2) — ver hoja caso_pago_411' },
  { dato: '2. Pagos con crédito no confirmado', valor: '3 match_medio — ver hoja match_medio_pendientes' },
  { dato: '3. Pago sobre crédito cancelado sin cronograma', valor: '1145**** — ver hoja credito_cancelado_1145' },
  { dato: 'Próxima fase (bloqueada hasta decisión)', valor: '10K-2B — apply real de pagos a cuotas' },
  { dato: 'Autorización que se pedirá luego de decidir', valor: 'APLICAR PAGOS A CUOTAS 10K-2' },
]
const wsResumen = XLSX.utils.json_to_sheet(resumenRows, { header: ['dato', 'valor'] })
wsResumen['!cols'] = [{ wch: 48 }, { wch: 60 }]
XLSX.utils.book_append_sheet(wb, wsResumen, 'resumen_para_tesoreria')

// ─── Hoja: caso_pago_411 ───────────────────────────────────────────────────────

const caso411Rows = [
  { campo: 'Pago (enmascarado)', valor: '411****' },
  { campo: 'Crédito (enmascarado)', valor: '1138****' },
  { campo: 'Monto aplicable (capital + interés)', valor: 'S/ 1,896.96' },
  { campo: 'Monto normal de una cuota de este crédito', valor: 'S/ 285.59' },
  { campo: 'Efecto si se aplica tal cual', valor: 'Cubriría ~6 cuotas completas + 1 parcial' },
  { campo: 'Riesgo documentado', valor: 'R-K2 (RISKS_AND_BUGS.md)' },
  { campo: 'Posible explicación 1', valor: 'Prepago real de varias cuotas por el socio' },
  { campo: 'Posible explicación 2', valor: 'Error de digitación al importar (ej. S/189.69 → S/1,896.96, dígito de más)' },
  { campo: 'Recomendación', valor: 'Verificar contra el recibo físico antes de aplicar. NO aprobar sin confirmación de Tesorería.' },
  { campo: 'Decisión requerida', valor: 'Aprobar / Excluir / Corregir (ver hoja decisiones_requeridas)' },
]
const wsCaso411 = XLSX.utils.json_to_sheet(caso411Rows, { header: ['campo', 'valor'] })
wsCaso411['!cols'] = [{ wch: 42 }, { wch: 70 }]
XLSX.utils.book_append_sheet(wb, wsCaso411, 'caso_pago_411')

// ─── Hoja: match_medio_pendientes ──────────────────────────────────────────────

const matchMedioRows = [
  {
    pago: '412****',
    socio: '3336****',
    credito_propuesto: '1147****',
    monto: 500.00,
    motivo_duda: 'Fecha de pago fuera del rango esperado del crédito',
    decision_creditos: '',
    observacion: '',
  },
  {
    pago: '413****',
    socio: '3336****',
    credito_propuesto: '1147****',
    monto: 150.00,
    motivo_duda: 'Fecha de pago fuera del rango esperado del crédito',
    decision_creditos: '',
    observacion: '',
  },
  {
    pago: '422****',
    socio: '3344****',
    credito_propuesto: '1159****',
    monto: 100.00,
    motivo_duda: 'Fecha de pago fuera del rango esperado del crédito; es solo interés',
    decision_creditos: '',
    observacion: '',
  },
]
const wsMatchMedio = XLSX.utils.json_to_sheet(matchMedioRows, {
  header: ['pago', 'socio', 'credito_propuesto', 'monto', 'motivo_duda', 'decision_creditos', 'observacion'],
})
wsMatchMedio['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 50 }, { wch: 30 }, { wch: 30 }]
XLSX.utils.book_append_sheet(wb, wsMatchMedio, 'match_medio_pendientes')

// ─── Hoja: credito_cancelado_1145 ──────────────────────────────────────────────

const credito1145Rows = [
  { campo: 'Crédito (enmascarado)', valor: '1145****' },
  { campo: 'Estado del crédito', valor: 'Cancelado' },
  { campo: 'Cronograma de cuotas', valor: 'No existe (no se generó al importar los datos)' },
  { campo: 'Efecto', valor: 'El pago asociado no tiene dónde aplicarse — no hay cuotas contra las cuales vincularlo' },
  { campo: 'Posible explicación', valor: 'El crédito fue cancelado antes de que se generaran cuotas en el sistema (normal para créditos ya cerrados al importar)' },
  { campo: 'Recomendación', valor: 'Si el crédito ya fue liquidado y contabilizado por otra vía, marcar el pago como "no aplicable permanentemente"' },
  { campo: 'Alternativa (más compleja)', valor: 'Generar cronograma retroactivo para este crédito cancelado' },
  { campo: 'Decisión requerida', valor: 'Aprobar / Excluir / Corregir (ver hoja decisiones_requeridas)' },
]
const wsCredito1145 = XLSX.utils.json_to_sheet(credito1145Rows, { header: ['campo', 'valor'] })
wsCredito1145['!cols'] = [{ wch: 30 }, { wch: 80 }]
XLSX.utils.book_append_sheet(wb, wsCredito1145, 'credito_cancelado_1145')

// ─── Hoja: decisiones_requeridas ───────────────────────────────────────────────

const decisionesRows = [
  {
    caso: '1. Pago 411**** monto excesivo (R-K2)',
    problema: 'Monto aplicable S/1,896.96 para una cuota de S/285.59 — posible error de digitación o prepago real',
    monto: 1896.96,
    credito: '1138****',
    socio: '(no disponible en este dry-run — consultar con Créditos)',
    decision_requerida: 'Aprobar / Excluir / Corregir',
    opcion_a: 'Aprobar: aplicar el monto tal cual (6 cuotas pagadas + 1 parcial)',
    opcion_b: 'Excluir: no aplicar este pago, dejarlo pendiente',
    opcion_c: 'Corregir: el monto real es otro (indicar en observaciones)',
    respuesta_tesoreria_creditos: '',
    observaciones: '',
  },
  {
    caso: '2. Pagos match_medio (412****, 413****, 422****)',
    problema: '3 pagos sin id_credito confirmado — fecha fuera del rango esperado del crédito propuesto',
    monto: 750.00,
    credito: '1147**** / 1159****',
    socio: '3336**** / 3344****',
    decision_requerida: 'Aprobar / Excluir / Corregir (por cada pago, ver hoja match_medio_pendientes)',
    opcion_a: 'Aprobar: vincular cada pago al crédito propuesto',
    opcion_b: 'Excluir: no vincular, dejar id_credito = NULL',
    opcion_c: 'Corregir: indicar el crédito real si existe otro no importado',
    respuesta_tesoreria_creditos: '',
    observaciones: '',
  },
  {
    caso: '3. Pago sobre crédito cancelado 1145****',
    problema: 'El crédito no tiene cronograma de cuotas generado — no hay dónde aplicar el pago',
    monto: null,
    credito: '1145****',
    socio: '(no disponible en este dry-run — consultar con Créditos)',
    decision_requerida: 'Aprobar / Excluir / Corregir',
    opcion_a: 'Aprobar: marcar como "no aplicable permanentemente" (sin generar cronograma)',
    opcion_b: 'Excluir: dejar pendiente sin decisión, revisar más adelante',
    opcion_c: 'Corregir: generar cronograma retroactivo para este crédito',
    respuesta_tesoreria_creditos: '',
    observaciones: '',
  },
]
const wsDecisiones = XLSX.utils.json_to_sheet(decisionesRows, {
  header: [
    'caso', 'problema', 'monto', 'credito', 'socio', 'decision_requerida',
    'opcion_a', 'opcion_b', 'opcion_c', 'respuesta_tesoreria_creditos', 'observaciones',
  ],
})
wsDecisiones['!cols'] = [
  { wch: 40 }, { wch: 60 }, { wch: 12 }, { wch: 18 }, { wch: 45 },
  { wch: 45 }, { wch: 45 }, { wch: 40 }, { wch: 40 }, { wch: 30 }, { wch: 30 },
]
XLSX.utils.book_append_sheet(wb, wsDecisiones, 'decisiones_requeridas')

// ─── Guardar ────────────────────────────────────────────────────────────────────

if (!existsSync(EXPORT_DIR)) mkdirSync(EXPORT_DIR, { recursive: true })
const outPath = resolve(EXPORT_DIR, '10k_2a_casos_para_revision_manual.xlsx')
XLSX.writeFile(wb, outPath)

console.log(`✅ Excel generado: exports/pagos-cuotas-dryrun/10k_2a_casos_para_revision_manual.xlsx`)
console.log('   Hojas: resumen_para_tesoreria, caso_pago_411, match_medio_pendientes, credito_cancelado_1145, decisiones_requeridas')
console.log('\n🔒 SOLO DOCUMENTACIÓN — ningún dato fue modificado en la base de datos.\n')
