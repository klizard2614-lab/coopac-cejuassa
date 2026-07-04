import { requireAdmin } from '@/lib/api/requireAdmin'
import { apiError, apiSuccess } from '@/lib/api/errors'

const ROLES_VALIDOS = ['admin', 'tesoreria', 'creditos', 'contabilidad'] as const
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(request)
    if (auth instanceof Response) return auth
    const { adminClient } = auth

    const { email, rol, nombre } = await request.json()

    if (!email || !rol) {
      return apiError(400, 'Solicitud inválida.')
    }
    if (!EMAIL_REGEX.test(String(email))) {
      return apiError(400, 'Solicitud inválida.')
    }
    if (!ROLES_VALIDOS.includes(rol)) {
      return apiError(400, 'Solicitud inválida.')
    }

    const { data, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email)
    if (inviteError) {
      return apiError(400, 'No se pudo crear el usuario.', inviteError)
    }

    const userId = data.user?.id
    if (!userId) {
      return apiError(500, 'No se pudo crear el usuario.')
    }

    const nombreTrimmed = nombre ? String(nombre).trim().slice(0, 200) : ''

    const { data: existing } = await adminClient
      .from('usuarios')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (existing) {
      const { error: updateError } = await adminClient
        .from('usuarios')
        .update({ rol, nombre: nombreTrimmed, activo: true, updated_at: new Date().toISOString() })
        .eq('id', userId)
      if (updateError) return apiError(400, 'No se pudo crear el usuario.', updateError)
    } else {
      const { error: insertError } = await adminClient
        .from('usuarios')
        .insert({ id: userId, auth_id: userId, nombre: nombreTrimmed, email, rol, activo: true })
      if (insertError) return apiError(400, 'No se pudo crear el usuario.', insertError)
    }

    return apiSuccess({ userId })
  } catch (err) {
    return apiError(500, 'Error interno del servidor.', err)
  }
}
