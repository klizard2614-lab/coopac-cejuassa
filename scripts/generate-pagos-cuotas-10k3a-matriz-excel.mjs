/**
 * generate-pagos-cuotas-10k3a-matriz-excel.mjs
 * Fase 10K-3A — Genera la matriz de diseño de lógica para pagos nuevos.
 *
 * SOLO LECTURA — no toca la base de datos. Contiene datos estáticos de
 * diseño extraídos de docs/ai-recovery/PAGOS_CUOTAS_10K_3A_LOGICA_NUEVOS_PAGOS.md
 *
 * Ejecutar: node scripts/generate-pagos-cuotas-10k3a-matriz-excel.mjs
 */

import XLSX from 'xlsx'
import { existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const EXPORT_DIR = resolve(ROOT, 'exports/pagos-cuotas-dryrun')

const wb = XLSX.utils.book_new()

// ─── Hoja: flujo_actual ─────────────────────────────────────────────────────

const flujoActualRows = [
  { paso: 1, accion: 'INSERT pagos_recibos', donde: 'Cliente (pagos/nuevo/page.tsx)', atomico: 'N/A (paso único)' },
  { paso: 2, accion: 'RPC decrementar_saldo_capital (con fallback UPDATE directo)', donde: 'Cliente → RPC Supabase', atomico: 'Sí (dentro de la RPC), pero separado del paso 3' },
  { paso: 3, accion: 'Buscar 1 sola cuota más antigua pendiente/vencida/parcial y sumar monto_capital/monto_interes sin tope ni cascada', donde: 'Cliente (2 queries + 1 update)', atomico: 'No' },
  { paso: 4, accion: 'RPC registrar_aporte_socio si monto_aporte > 0', donde: 'Cliente → RPC Supabase', atomico: 'Sí (dentro de la RPC)' },
  { paso: '—', accion: 'GAP: no inserta en pagos_cuotas_aplicaciones', donde: 'N/A', atomico: 'N/A' },
  { paso: '—', accion: 'GAP: no hay cascada a más de 1 cuota', donde: 'N/A', atomico: 'N/A' },
  { paso: '—', accion: 'GAP: no hay tope por cuota (puede sobre-aplicar capital_pagado/interes_pagado)', donde: 'N/A', atomico: 'N/A' },
  { paso: '—', accion: 'GAP: crédito sin cuotas pendientes no genera aviso', donde: 'N/A', atomico: 'N/A' },
]
const wsFlujoActual = XLSX.utils.json_to_sheet(flujoActualRows, { header: ['paso', 'accion', 'donde', 'atomico'] })
wsFlujoActual['!cols'] = [{ wch: 8 }, { wch: 75 }, { wch: 35 }, { wch: 45 }]
XLSX.utils.book_append_sheet(wb, wsFlujoActual, 'flujo_actual')

// ─── Hoja: flujo_propuesto ───────────────────────────────────────────────────

const flujoPropuestoRows = [
  { paso: 1, accion: 'INSERT pagos_recibos', donde: 'Cliente (sin cambios)' },
  { paso: 2, accion: 'RPC aplicar_pago_a_cuotas(id_pago, id_credito, monto_capital, monto_interes, fecha, created_by)', donde: 'Cliente → RPC transaccional Supabase' },
  { paso: '2a', accion: 'Lock del crédito (FOR UPDATE)', donde: 'Dentro de la RPC' },
  { paso: '2b', accion: 'Cascada sobre cuotas pendiente/vencida/parcial, ordenadas por fecha_vencimiento ASC, con FOR UPDATE', donde: 'Dentro de la RPC' },
  { paso: '2c', accion: 'UPDATE cronograma_cuotas por cada cuota tocada (capital_pagado, interes_pagado, estado, fecha_pago)', donde: 'Dentro de la RPC' },
  { paso: '2d', accion: 'INSERT pagos_cuotas_aplicaciones por cada cuota tocada', donde: 'Dentro de la RPC' },
  { paso: '2e', accion: 'Actualiza saldo_capital (llama o integra decrementar_saldo_capital)', donde: 'Dentro de la RPC' },
  { paso: '2f', accion: 'Retorna JSON: cuotas_tocadas, excedente, motivo_excedente', donde: 'Dentro de la RPC → Cliente' },
  { paso: 3, accion: 'Si hay excedente > 0: mostrar alerta visible al usuario', donde: 'Cliente (UI)' },
  { paso: 4, accion: 'RPC registrar_aporte_socio si monto_aporte > 0 (sin cambios)', donde: 'Cliente → RPC Supabase' },
]
const wsFlujoPropuesto = XLSX.utils.json_to_sheet(flujoPropuestoRows, { header: ['paso', 'accion', 'donde'] })
wsFlujoPropuesto['!cols'] = [{ wch: 8 }, { wch: 85 }, { wch: 40 }]
XLSX.utils.book_append_sheet(wb, wsFlujoPropuesto, 'flujo_propuesto')

// ─── Hoja: reglas_negocio ────────────────────────────────────────────────────

const reglasRows = [
  { regla: 'Orden de cuotas', definicion: 'fecha_vencimiento ASC (la más antigua primero)' },
  { regla: 'Monto aplicable', definicion: 'monto_capital + monto_interes (excluye aporte/FPS/FPS extra/otros)' },
  { regla: 'Prioridad interés/capital', definicion: 'Proporcional al ratio capital/(capital+interes) del monto disponible cuando no alcanza para la cuota completa' },
  { regla: 'Pago no cubre cuota completa', definicion: 'Cuota queda parcial; capital_pagado/interes_pagado se incrementan; fecha_pago NO se toca' },
  { regla: 'Pago cubre varias cuotas', definicion: 'Cascada: cuota queda pagada con fecha_pago, excedente pasa a la siguiente cuota pendiente del mismo crédito' },
  { regla: 'Sobra monto tras cubrir todas las cuotas', definicion: 'NO se inventa cuota ni se aplica a otro crédito. Se retorna como excedente explícito con motivo, y la UI debe alertar' },
  { regla: 'Crédito cancelado / sin cuotas pendientes', definicion: 'No se aplica nada a cuotas; se retorna excedente = monto total con motivo "sin_cuotas_pendientes"; el pago igual se registra en pagos_recibos' },
  { regla: 'Cuota ya pagada', definicion: 'Nunca se selecciona (filtro estado IN pendiente/vencida/parcial la excluye por diseño)' },
  { regla: 'Campos que se actualizan por cuota', definicion: 'capital_pagado (incremento), interes_pagado (incremento), estado (pagada/parcial), fecha_pago (solo si queda pagada)' },
  { regla: 'Campos que NUNCA se tocan', definicion: 'capital, interes, cuota_total, nro_cuota, fecha_vencimiento (inmutables una vez generado el cronograma)' },
  { regla: 'Estado final de la cuota', definicion: 'pagada si capital_pagado >= capital AND interes_pagado >= interes (tolerancia 0.01); parcial en cualquier otro caso con pago > 0' },
  { regla: 'Trazabilidad', definicion: 'Una fila en pagos_cuotas_aplicaciones por cada cuota tocada por el pago (id_pago, id_cuota, id_credito, capital_aplicado, interes_aplicado, fecha_aplicacion, created_by)' },
  { regla: 'Pago sin crédito (id_credito NULL)', definicion: 'La RPC de aplicación no se llama; el pago queda solo en pagos_recibos (y aportes si corresponde) — sin cambios respecto a hoy' },
  { regla: 'Pago mixto (crédito + aporte/FPS)', definicion: 'Cada componente sigue su propio camino en paralelo: capital/interés a la RPC de cuotas, aporte a registrar_aporte_socio, FPS/otros no generan escritura adicional' },
]
const wsReglas = XLSX.utils.json_to_sheet(reglasRows, { header: ['regla', 'definicion'] })
wsReglas['!cols'] = [{ wch: 38 }, { wch: 95 }]
XLSX.utils.book_append_sheet(wb, wsReglas, 'reglas_negocio')

// ─── Hoja: escenarios_prueba ─────────────────────────────────────────────────

const escenariosRows = [
  {
    escenario: 'Pago exacto de una cuota',
    entrada: 'monto_capital + monto_interes = cuota_total de la cuota más antigua pendiente',
    resultado_esperado: '1 cuota queda pagada con fecha_pago = fecha del pago; 1 fila en pagos_cuotas_aplicaciones; excedente = 0',
  },
  {
    escenario: 'Pago parcial',
    entrada: 'monto_capital + monto_interes < cuota_total de la cuota más antigua',
    resultado_esperado: 'Cuota queda parcial; capital_pagado/interes_pagado incrementados proporcionalmente; fecha_pago sigue NULL; 1 fila de trazabilidad; excedente = 0',
  },
  {
    escenario: 'Pago que cubre varias cuotas',
    entrada: 'monto_capital + monto_interes > cuota_total de 2 o más cuotas consecutivas',
    resultado_esperado: 'Cada cuota cubierta queda pagada en cascada (fecha_vencimiento ASC); N filas de trazabilidad (una por cuota); la última cuota tocada puede quedar parcial si el monto se agota a mitad de camino',
  },
  {
    escenario: 'Pago con sobrante (excedente total)',
    entrada: 'monto_capital + monto_interes > suma de todas las cuotas pendientes del crédito',
    resultado_esperado: 'Todas las cuotas pendientes quedan pagadas; excedente > 0 retornado explícitamente con motivo; UI debe mostrar alerta; NO se aplica a otro crédito ni se inventa cuota',
  },
  {
    escenario: 'Pago sin crédito (id_credito NULL)',
    entrada: 'Pago registrado sin id_credito asociado (ej. solo aporte)',
    resultado_esperado: 'La RPC aplicar_pago_a_cuotas NO se invoca; cronograma_cuotas y pagos_cuotas_aplicaciones no se tocan; comportamiento idéntico al actual',
  },
  {
    escenario: 'Pago a crédito cancelado (sin cuotas pendientes)',
    entrada: 'id_credito válido pero sin ninguna cuota en pendiente/vencida/parcial',
    resultado_esperado: 'excedente = monto total del pago; motivo_excedente = "sin_cuotas_pendientes"; pago se registra igual en pagos_recibos; UI debe alertar que no se aplicó a ninguna cuota',
  },
  {
    escenario: 'Pago mixto crédito + aporte',
    entrada: 'monto_capital > 0 (aplica a cuotas) Y monto_aporte > 0 (aplica a aportes) en el mismo recibo',
    resultado_esperado: 'aplicar_pago_a_cuotas procesa solo capital/interés; registrar_aporte_socio procesa el aporte por separado; ambos resultados son independientes y no se mezclan',
  },
  {
    escenario: 'Cuota ya pagada',
    entrada: 'Cronograma con cuotas anteriores ya en estado pagada',
    resultado_esperado: 'La cascada las omite automáticamente (filtro por estado); nunca se re-procesan ni se duplica trazabilidad sobre ellas',
  },
]
const wsEscenarios = XLSX.utils.json_to_sheet(escenariosRows, { header: ['escenario', 'entrada', 'resultado_esperado'] })
wsEscenarios['!cols'] = [{ wch: 35 }, { wch: 55 }, { wch: 80 }]
XLSX.utils.book_append_sheet(wb, wsEscenarios, 'escenarios_prueba')

// ─── Hoja: riesgos ────────────────────────────────────────────────────────────

const riesgosRows = [
  { riesgo: 'Row lock en cascada sobre múltiples cuotas', severidad: 'Baja', mitigacion: 'FOR UPDATE fila por fila es el comportamiento esperado para evitar carreras; espera perceptible solo si hay pagos masivos concurrentes sobre el mismo crédito (escenario poco común aquí)' },
  { riesgo: 'Cambio de comportamiento visible al usuario', severidad: 'Media', mitigacion: 'Hoy solo se actualiza 1 cuota (bug); con la RPC se verán más cuotas actualizadas correctamente. Documentar el cambio en release notes / capacitación de Tesorería' },
  { riesgo: 'Excedente sin aplicar requiere decisión operativa', severidad: 'Media', mitigacion: 'Esta fase solo diseña que se reporte, no la resolución automática; queda a criterio de Tesorería caso por caso (igual que 10K-2A)' },
  { riesgo: 'Convivencia con 10K-2B diferida', severidad: 'Media', mitigacion: 'Cuando se retome 10K-2B, filtrar pagos ya aplicados por este flujo nuevo (por fecha o flag origen) para no duplicar aplicaciones' },
  { riesgo: 'Reutilización del algoritmo de cascada en 2 lenguajes (JS y SQL)', severidad: 'Media', mitigacion: 'Pruebas unitarias que repliquen los mismos escenarios en ambas implementaciones antes de aplicar en 10K-3B' },
  { riesgo: 'Dependencia de decrementar_saldo_capital dentro de la nueva RPC', severidad: 'Baja', mitigacion: 'Documentar la dependencia; ambas funciones viven en el mismo dominio de negocio (pagos de crédito)' },
]
const wsRiesgos = XLSX.utils.json_to_sheet(riesgosRows, { header: ['riesgo', 'severidad', 'mitigacion'] })
wsRiesgos['!cols'] = [{ wch: 55 }, { wch: 12 }, { wch: 90 }]
XLSX.utils.book_append_sheet(wb, wsRiesgos, 'riesgos')

// ─── Hoja: decision_tecnica ───────────────────────────────────────────────────

const decisionRows = [
  { opcion: 'A. Aplicación desde frontend', descripcion: 'Estado actual: llamadas secuenciales del cliente', riesgo: 'Alto', recomendada: 'NO' },
  { opcion: 'B. Aplicación desde API route', descripcion: 'Endpoint Next.js que ejecuta los mismos pasos desde el servidor', riesgo: 'Medio', recomendada: 'NO' },
  { opcion: 'C. RPC transaccional en Supabase', descripcion: 'Función plpgsql aplicar_pago_a_cuotas con lock + cascada + updates + trazabilidad en una sola transacción', riesgo: 'Bajo', recomendada: 'SÍ — consistente con decrementar_saldo_capital, registrar_aporte_socio, crear_credito_con_cronograma' },
  { opcion: '—', descripcion: 'Próxima fase: 10K-3B — SQL final ejecutable con formato completo del skill cejuassa-db-plan (requiere aprobación explícita antes de aplicar)', riesgo: '—', recomendada: '—' },
]
const wsDecision = XLSX.utils.json_to_sheet(decisionRows, { header: ['opcion', 'descripcion', 'riesgo', 'recomendada'] })
wsDecision['!cols'] = [{ wch: 32 }, { wch: 80 }, { wch: 10 }, { wch: 70 }]
XLSX.utils.book_append_sheet(wb, wsDecision, 'decision_tecnica')

// ─── Guardar ────────────────────────────────────────────────────────────────────

if (!existsSync(EXPORT_DIR)) mkdirSync(EXPORT_DIR, { recursive: true })
const outPath = resolve(EXPORT_DIR, '10k_3a_matriz_logica_pagos_nuevos.xlsx')
XLSX.writeFile(wb, outPath)

console.log(`✅ Excel generado: exports/pagos-cuotas-dryrun/10k_3a_matriz_logica_pagos_nuevos.xlsx`)
console.log('   Hojas: flujo_actual, flujo_propuesto, reglas_negocio, escenarios_prueba, riesgos, decision_tecnica')
console.log('\n🔒 SOLO DISEÑO — ningún dato fue modificado, ninguna migración fue aplicada.\n')
