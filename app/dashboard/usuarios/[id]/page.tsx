'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useRol } from '@/lib/useRol'
import AccesoDenegado from '@/components/AccesoDenegado'

type Usuario = {
  id: string
  nombre: string
  email: string
  rol: string
  activo: boolean
  created_at: string
  updated_at: string
}

const ROLES = [
  { value: 'admin',        label: 'Administrador' },
  { value: 'tesoreria',    label: 'Tesorería' },
  { value: 'creditos',     label: 'Créditos' },
  { value: 'contabilidad', label: 'Contabilidad' },
]

const ROL_STYLE: Record<string, string> = {
  admin:        'bg-blue-100 text-blue-800',
  tesoreria:    'bg-green-100 text-green-800',
  creditos:     'bg-purple-100 text-purple-800',
  contabilidad: 'bg-orange-100 text-orange-800',
}

function formatDateTime(d: string) {
  if (!d) return '—'
  const dt = new Date(d)
  return dt.toLocaleString('es-PE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function UsuarioDetallePage() {
  const { rol: rolActual, loading: checkingRol } = useRol()
  const { id } = useParams() as { id: string }

  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // form state
  const [nombre, setNombre] = useState('')
  const [rol, setRol] = useState('tesoreria')
  const [activo, setActivo] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    createClient()
      .from('usuarios')
      .select('id, nombre, email, rol, activo, created_at, updated_at')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { setNotFound(true); setLoading(false); return }
        const u = data as Usuario
        setUsuario(u)
        setNombre(u.nombre ?? '')
        setRol(u.rol)
        setActivo(u.activo)
        setLoading(false)
      })
  }, [id])

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMsg(null)
    const { error } = await createClient()
      .from('usuarios')
      .update({ nombre: nombre.trim(), rol, activo, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      setMsg({ type: 'err', text: `Error: ${error.message}` })
    } else {
      setMsg({ type: 'ok', text: 'Cambios guardados correctamente.' })
      setUsuario(prev => prev ? { ...prev, nombre: nombre.trim(), rol, activo } : prev)
    }
    setSaving(false)
  }

  if (checkingRol) return <div className="p-8 text-sm text-gray-400">Verificando acceso...</div>
  if (rolActual !== 'admin') return <AccesoDenegado />
  if (loading) return <div className="p-8 text-sm text-gray-400">Cargando...</div>
  if (notFound || !usuario) return <div className="p-8 text-sm text-gray-400">Usuario no encontrado.</div>

  return (
    <div className="p-8 max-w-lg">
      <Link
        href="/dashboard/usuarios"
        className="text-sm text-gray-400 hover:text-gray-600 mb-4 inline-block transition-colors"
      >
        ← Volver
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{usuario.nombre || usuario.email}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{usuario.email}</p>
        </div>
        <span className={`ml-auto px-2.5 py-0.5 rounded-full text-xs font-semibold ${ROL_STYLE[usuario.rol] ?? 'bg-gray-100 text-gray-600'}`}>
          {ROLES.find(r => r.value === usuario.rol)?.label ?? usuario.rol}
        </span>
      </div>

      <form onSubmit={handleGuardar} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
          <input
            type="text"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
          <input
            type="email"
            value={usuario.email}
            readOnly
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-400 bg-gray-50 cursor-not-allowed"
          />
          <p className="text-xs text-gray-400 mt-1">El email se gestiona desde Supabase Auth.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
          <select
            value={rol}
            onChange={e => setRol(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent"
          >
            {ROLES.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
          <button
            type="button"
            onClick={() => setActivo(v => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              activo ? 'bg-green-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                activo ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <span className="ml-3 text-sm text-gray-600">{activo ? 'Activo' : 'Inactivo'}</span>
        </div>

        {msg && (
          <div className={`text-sm rounded-lg px-3 py-2 ${
            msg.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {msg.text}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-2.5 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          style={{ backgroundColor: '#1e3a5f' }}
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>

      {/* Metadatos */}
      <div className="mt-4 bg-gray-50 rounded-lg border border-gray-200 px-4 py-3 text-xs text-gray-400 space-y-1">
        <p>ID: <span className="font-mono">{usuario.id}</span></p>
        <p>Registrado: {formatDateTime(usuario.created_at)}</p>
        <p>Última actualización: {formatDateTime(usuario.updated_at)}</p>
      </div>
    </div>
  )
}
