/**
 * auditClient.ts
 * Helper para registrar eventos de auditoría via RPC `registrar_auditoria`.
 *
 * SEC-4B — Preparado localmente. NO ACTIVO hasta que la RPC exista en remoto.
 * Para activar: aplicar migración SEC-4B y habilitar llamadas en módulos críticos.
 *
 * IMPORTANTE: Este helper NO llama a la RPC si está en modo preparación.
 * Cambiar AUDIT_ENABLED a true solo después de que la RPC esté desplegada en Supabase.
 */

import { createClient } from '@/lib/supabase';
import type { AuditParams } from './types';

/** Cambiar a true solo después de APLICAR AUDIT LOG SEC-4B en Supabase remoto */
const AUDIT_ENABLED = false;

/**
 * Registra una acción crítica en el audit log.
 * Silencia errores — nunca debe bloquear la operación principal.
 *
 * Uso (cuando AUDIT_ENABLED = true):
 *   await registrarAudit({ accion: 'REGISTRAR_PAGO', modulo: 'pagos', registro_id: String(id) });
 */
export async function registrarAudit(params: AuditParams): Promise<void> {
  if (!AUDIT_ENABLED) return;

  try {
    const supabase = createClient();
    await supabase.rpc('registrar_auditoria', {
      p_accion:         params.accion,
      p_modulo:         params.modulo,
      p_tabla_afectada: params.tabla_afectada ?? null,
      p_registro_id:    params.registro_id ?? null,
      p_descripcion:    params.descripcion ?? null,
      p_metadata:       params.metadata ?? null,
    });
  } catch {
    // Silenciar — el audit log nunca debe romper el flujo principal
  }
}
