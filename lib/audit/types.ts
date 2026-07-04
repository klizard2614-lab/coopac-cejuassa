/**
 * Tipos para el sistema de audit log de CEJUASSA.
 * Preparado en SEC-4B — helpers sin uso activo hasta que la RPC exista en remoto.
 * Debe coincidir exactamente con las whitelists de la RPC `registrar_auditoria`
 * en supabase/migrations/20260703130000_sec4b_audit_log_implementation.sql —
 * cualquier acción o módulo fuera de estas listas es rechazado en silencio por la RPC.
 */

export type AuditAccion =
  | 'CREAR_SOCIO'
  | 'EDITAR_SOCIO'
  | 'EDITAR_BENEFICIARIOS'
  | 'CREAR_CREDITO'
  | 'EDITAR_CREDITO'
  | 'APLICAR_AMPLIACION'
  | 'REGISTRAR_PAGO'
  | 'REGISTRAR_APORTE'
  | 'CREAR_EGRESO'
  | 'ELIMINAR_EGRESO'
  | 'INVITAR_USUARIO'
  | 'CAMBIAR_ESTADO_USUARIO'
  | 'EDITAR_CONFIGURACION'
  | 'EXPORTAR_ANEXO6';

export type AuditModulo =
  | 'socios'
  | 'creditos'
  | 'beneficiarios'
  | 'ampliaciones'
  | 'pagos'
  | 'aportes'
  | 'egresos'
  | 'usuarios'
  | 'configuracion'
  | 'reportes';

export interface AuditParams {
  accion: AuditAccion;
  modulo: AuditModulo;
  tabla_afectada?: string;
  registro_id?: string;
  descripcion?: string;
  /** NUNCA incluir: DNI, contraseñas, tokens, saldos individuales completos, PII */
  metadata?: Record<string, unknown>;
}
