/**
 * Genera exports/security/audit_log_scope.xlsx
 * Fase SEC-4A — Matriz de alcance del audit log
 * No toca DB. Solo genera el Excel.
 */

import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

async function main() {
  const xlsx = await import('xlsx')
  const XLSX = xlsx.default ?? xlsx

  const rows = [
    // Encabezado
    [
      'Módulo',
      'Acción',
      'Código de acción',
      'Criticidad',
      'Tabla afectada',
      'Método recomendado',
      'Campos mínimos',
      'Fase sugerida',
      'Riesgo si no se audita',
    ],

    // ── Créditos ──────────────────────────────────────────────────────────────
    [
      'creditos',
      'Crear crédito',
      'CREAR_CREDITO',
      'ALTA',
      'creditos + cronograma_cuotas',
      'RPC registrar_auditoria (desde frontend tras RPC crear_credito_con_cronograma)',
      'actor_user_id, actor_email, actor_rol, registro_id (id_credito), descripcion (nro_pagare, monto), metadata: {monto_aprobado, plazo, tasa}',
      'SEC-4C',
      'Sin registro de quién aprobó el crédito — violación de control interno financiero',
    ],
    [
      'creditos',
      'Editar crédito (tasa, monto, plazo)',
      'EDITAR_CREDITO',
      'ALTA',
      'creditos',
      'RPC registrar_auditoria (desde frontend tras update)',
      'actor_user_id, actor_email, actor_rol, registro_id (id_credito), descripcion (campos cambiados), metadata: {antes, después}',
      'SEC-4C',
      'No se puede auditar quién modificó tasas o montos de un crédito existente',
    ],
    [
      'creditos',
      'Aplicar ampliación',
      'APLICAR_AMPLIACION',
      'ALTA',
      'creditos + ampliaciones',
      'RPC registrar_auditoria (desde frontend tras RPC aplicar_ampliacion_credito)',
      'actor_user_id, actor_email, actor_rol, registro_id (id_credito), descripcion (monto ampliar, nro_pagare_nuevo)',
      'SEC-4C',
      'No se puede saber quién aumentó el monto de una deuda — riesgo de fraude interno',
    ],

    // ── Pagos ─────────────────────────────────────────────────────────────────
    [
      'pagos',
      'Registrar pago',
      'REGISTRAR_PAGO',
      'ALTA',
      'pagos_recibos',
      'RPC registrar_auditoria (desde frontend tras insert en pagos_recibos)',
      'actor_user_id, actor_email, actor_rol, registro_id (id_recibo), descripcion (nro_recibo, monto_total, socio), metadata: {monto_capital, monto_interes, monto_aporte}',
      'SEC-4C',
      'Sin trazabilidad de quién registró un pago — permite alteraciones no detectables',
    ],

    // ── Aportes ───────────────────────────────────────────────────────────────
    [
      'aportes',
      'Registrar aporte',
      'REGISTRAR_APORTE',
      'ALTA',
      'aportes',
      'RPC registrar_auditoria (desde frontend tras RPC registrar_aporte_socio)',
      'actor_user_id, actor_email, actor_rol, registro_id (id_aporte), descripcion (socio, monto, tipo), metadata: {saldo_anterior, saldo_nuevo}',
      'SEC-4C',
      'Aportes son depósitos de socios — sin trazabilidad es imposible auditar diferencias de saldo',
    ],

    // ── Egresos ───────────────────────────────────────────────────────────────
    [
      'egresos',
      'Crear egreso',
      'CREAR_EGRESO',
      'ALTA',
      'egresos',
      'RPC registrar_auditoria (desde frontend tras insert)',
      'actor_user_id, actor_email, actor_rol, registro_id (id_egreso), descripcion (tipo, monto, beneficiario)',
      'SEC-4C',
      'Salidas de dinero sin registro de autor — riesgo de fraude o apropiación indebida',
    ],
    [
      'egresos',
      'Eliminar egreso',
      'ELIMINAR_EGRESO',
      'ALTA',
      'egresos',
      'RPC registrar_auditoria (desde frontend antes del DELETE)',
      'actor_user_id, actor_email, actor_rol, registro_id (id_egreso), descripcion (tipo, monto, beneficiario eliminado), metadata: {datos_completos}',
      'SEC-4C',
      'DELETE de egreso sin log es la acción de mayor riesgo — permite borrar evidencia de salidas',
    ],

    // ── Socios ────────────────────────────────────────────────────────────────
    [
      'socios',
      'Crear socio',
      'CREAR_SOCIO',
      'MEDIA',
      'socios',
      'RPC registrar_auditoria (desde frontend tras insert)',
      'actor_user_id, actor_email, actor_rol, registro_id (id_socio), descripcion (nro_socio, nombre completo — sin DNI)',
      'SEC-4D',
      'Alta de socios sin control — no se puede auditar quién incorporó a un miembro',
    ],
    [
      'socios',
      'Editar socio',
      'EDITAR_SOCIO',
      'MEDIA',
      'socios',
      'RPC registrar_auditoria (desde frontend tras update)',
      'actor_user_id, actor_email, actor_rol, registro_id (id_socio), descripcion (campos editados — sin PII completa)',
      'SEC-4D',
      'Cambios de datos PII sin trazabilidad — riesgo LPDP (Ley de Protección de Datos Peruana)',
    ],
    [
      'socios',
      'Editar beneficiarios',
      'EDITAR_BENEFICIARIOS',
      'MEDIA',
      'socio_beneficiarios',
      'RPC registrar_auditoria (desde frontend tras insert/update/delete en BeneficiariosSection)',
      'actor_user_id, actor_email, actor_rol, registro_id (socio_id), descripcion (acción en beneficiario)',
      'SEC-4D',
      'Cambios en beneficiarios afectan herencia de aportes — dato sensible sin trazabilidad',
    ],

    // ── Ampliaciones ──────────────────────────────────────────────────────────
    [
      'ampliaciones',
      'Registrar ampliación informativa',
      'REGISTRAR_AMPLIACION_INFO',
      'MEDIA',
      'ampliaciones',
      'RPC registrar_auditoria (desde AmpliacionesSection)',
      'actor_user_id, actor_email, actor_rol, registro_id (id_credito), descripcion (nro_pagare_nuevo, monto_nuevo)',
      'SEC-4D',
      'Historial de ampliaciones sin autor identificado',
    ],

    // ── Usuarios ──────────────────────────────────────────────────────────────
    [
      'usuarios',
      'Invitar usuario',
      'INVITAR_USUARIO',
      'MEDIA',
      'usuarios + auth.users',
      'Desde API route /api/usuarios/invite (server-side) — más seguro que frontend',
      'actor_user_id, actor_email, actor_rol, descripcion (email invitado, rol asignado)',
      'SEC-4C',
      'Sin registro de quién creó un nuevo acceso al sistema — control de acceso no auditable',
    ],
    [
      'usuarios',
      'Activar/desactivar usuario',
      'CAMBIAR_ESTADO_USUARIO',
      'MEDIA',
      'usuarios',
      'Desde API route /api/usuarios/update (server-side)',
      'actor_user_id, actor_email, actor_rol, registro_id (id_usuario_afectado), descripcion (activo: true/false)',
      'SEC-4C',
      'Desactivación de usuarios sin log — no se puede auditar accesos bloqueados o rehabilitados',
    ],

    // ── Configuración ─────────────────────────────────────────────────────────
    [
      'configuracion',
      'Editar configuración (tasas, parámetros)',
      'EDITAR_CONFIGURACION',
      'MEDIA',
      'configuracion',
      'RPC registrar_auditoria (desde frontend tras update en configuracion/page.tsx)',
      'actor_user_id, actor_email, actor_rol, descripcion (campos cambiados), metadata: {tasa_interes_antes, tasa_interes_despues}',
      'SEC-4D',
      'Cambios de tasas de provisión sin auditoría — afecta cálculo de cartera y Anexo 6 sin trazabilidad',
    ],

    // ── Reportes ──────────────────────────────────────────────────────────────
    [
      'reportes',
      'Exportar Anexo N°6',
      'EXPORTAR_ANEXO6',
      'BAJA',
      'N/A (solo lectura — exportación Excel)',
      'RPC registrar_auditoria (desde frontend en handleExportar de anexo6/page.tsx)',
      'actor_user_id, actor_email, actor_rol, descripcion (período exportado, fecha exportación)',
      'SEC-4E',
      'No es posible saber cuándo y quién generó reportes para SBS — útil para cumplimiento',
    ],
  ]

  const ws = XLSX.utils.aoa_to_sheet(rows)

  // Ancho de columnas
  ws['!cols'] = [
    { wch: 15 },  // Módulo
    { wch: 35 },  // Acción
    { wch: 28 },  // Código de acción
    { wch: 10 },  // Criticidad
    { wch: 30 },  // Tabla afectada
    { wch: 55 },  // Método recomendado
    { wch: 70 },  // Campos mínimos
    { wch: 10 },  // Fase sugerida
    { wch: 60 },  // Riesgo
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Alcance Audit Log')

  const outPath = join(ROOT, 'exports', 'security', 'audit_log_scope.xlsx')
  XLSX.writeFile(wb, outPath)

  console.log(`✅ Generado: exports/security/audit_log_scope.xlsx`)
  console.log(`   Filas de datos: ${rows.length - 1}`)
  console.log(`   Módulos cubiertos: creditos, pagos, aportes, egresos, socios, ampliaciones, usuarios, configuracion, reportes`)
}

main().catch(err => {
  console.error('Error generando xlsx:', err)
  process.exit(1)
})
