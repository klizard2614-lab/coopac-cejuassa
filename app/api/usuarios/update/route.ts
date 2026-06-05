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

export async function PUT(request: Request) {
  try {
    const callerRol = await getCallerRol()
    if (!callerRol) return Response.json({ error: 'No autenticado' }, { status: 401 })
    if (callerRol !== 'admin') return Response.json({ error: 'Se requiere rol admin' }, { status: 403 })

    const { id, rol, activo, nombre } = await request.json()

    if (!id) {
      return Response.json({ error: 'id es requerido' }, { status: 400 })
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (rol !== undefined) updates.rol = rol
    if (activo !== undefined) updates.activo = activo
    if (nombre !== undefined) updates.nombre = nombre

    const supabaseAdmin = getAdminClient()

    const { error } = await supabaseAdmin
      .from('usuarios')
      .update(updates)
      .eq('id', id)

    if (error) return Response.json({ error: error.message }, { status: 400 })

    return Response.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return Response.json({ error: message }, { status: 500 })
  }
}
