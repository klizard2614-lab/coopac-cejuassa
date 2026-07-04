import { requireAdmin } from '@/lib/api/requireAdmin'
import { apiError, apiSuccess } from '@/lib/api/errors'

const ROLES_VALIDOS = ['admin', 'tesoreria', 'creditos', 'contabilidad'] as const
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function PUT(request: Request) {
  try {
    const auth = await requireAdmin(request)
    if (auth instanceof Response) return auth
    const { adminClient } = auth

    const { id, rol, activo, nombre } = await request.json()

    if (!id) {
      return apiError(400, 'Solicitud inválida.')
    }
    if (!UUID_REGEX.test(String(id))) {
      return apiError(400, 'Solicitud inválida.')
    }
    if (rol !== undefined && !ROLES_VALIDOS.includes(rol)) {
      return apiError(400, 'Solicitud inválida.')
    }
    if (activo !== undefined && typeof activo !== 'boolean') {
      return apiError(400, 'Solicitud inválida.')
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (rol !== undefined) updates.rol = rol
    if (activo !== undefined) updates.activo = activo
    if (nombre !== undefined) updates.nombre = String(nombre).trim().slice(0, 200)

    const { error } = await adminClient
      .from('usuarios')
      .update(updates)
      .eq('id', id)

    if (error) return apiError(400, 'No se pudo actualizar el usuario.', error)

    return apiSuccess()
  } catch (err) {
    return apiError(500, 'Error interno del servidor.', err)
  }
}
