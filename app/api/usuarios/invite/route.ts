import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Faltan variables de entorno de Supabase')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function getCallerRol(): Promise<string | null> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', user.id)
    .maybeSingle()
  return data?.rol ?? null
}

export async function POST(request: Request) {
  try {
    const callerRol = await getCallerRol()
    if (!callerRol) return Response.json({ error: 'No autenticado' }, { status: 401 })
    if (callerRol !== 'admin') return Response.json({ error: 'Se requiere rol admin' }, { status: 403 })

    const { email, rol, nombre } = await request.json()

    if (!email || !rol) {
      return Response.json({ error: 'email y rol son requeridos' }, { status: 400 })
    }

    const supabaseAdmin = getAdminClient()

    const { data, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email)
    if (inviteError) {
      return Response.json({ error: inviteError.message }, { status: 400 })
    }

    const userId = data.user?.id
    if (!userId) {
      return Response.json({ error: 'No se obtuvo ID del usuario invitado' }, { status: 500 })
    }

    const { data: existing } = await supabaseAdmin
      .from('usuarios')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (existing) {
      const { error: updateError } = await supabaseAdmin
        .from('usuarios')
        .update({ rol, nombre: nombre?.trim() || '', activo: true, updated_at: new Date().toISOString() })
        .eq('id', userId)
      if (updateError) return Response.json({ error: updateError.message }, { status: 400 })
    } else {
      const { error: insertError } = await supabaseAdmin
        .from('usuarios')
        .insert({ id: userId, auth_id: userId, nombre: nombre?.trim() || '', email, rol, activo: true })
      if (insertError) return Response.json({ error: insertError.message }, { status: 400 })
    }

    return Response.json({ success: true, userId })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return Response.json({ error: message }, { status: 500 })
  }
}
