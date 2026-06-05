'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Lock, CheckCircle2, AlertCircle } from 'lucide-react'

type Usuario = {
  id: string
  nombre: string
  email: string
  rol: 'admin' | 'tesoreria' | 'creditos' | 'contabilidad'
  activo: boolean
  created_at: string
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

function formatDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rolActual, setRolActual] = useState<string | null>(null)
  const [checkingRol, setCheckingRol] = useState(true)

  // Modal invitar
  const [showModal, setShowModal] = useState(false)
  const [invEmail, setInvEmail] = useState('')
  const [invNombre, setInvNombre] = useState('')
  const [invRol, setInvRol] = useState('tesoreria')
  const [invLoading, setInvLoading] = useState(false)
  const [invMsg, setInvMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const fetchUsuarios = useCallback(async () => {
    setLoading(true)
    const { data, error } = await createClient()
      .from('usuarios')
      .select('id, nombre, email, rol, activo, created_at')
      .order('nombre')
    if (error) setError(error.message)
    else setUsuarios((data as Usuario[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setCheckingRol(false); return }

      const { data } = await supabase
        .from('usuarios')
        .select('rol')
        .eq('id', user.id)
        .maybeSingle()

      setRolActual(data?.rol ?? null)
      setCheckingRol(false)
      await fetchUsuarios()
    }
    init()
  }, [fetchUsuarios])

  async function handleInvitar(e: React.FormEvent) {
    e.preventDefault()
    setInvLoading(true)
    setInvMsg(null)

    const res = await fetch('/api/usuarios/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: invEmail.trim(), nombre: invNombre.trim(), rol: invRol }),
    })
    const json = await res.json()

    if (!res.ok) {
      setInvMsg({ type: 'err', text: json.error ?? 'Error al invitar' })
    } else {
      setInvMsg({ type: 'ok', text: `Invitación enviada a ${invEmail}. El usuario recibirá un email para configurar su contraseña.` })
      setInvEmail('')
      setInvNombre('')
      setInvRol('tesoreria')
      await fetchUsuarios()
    }
    setInvLoading(false)
  }

  function closeModal() {
    setShowModal(false)
    setInvEmail('')
    setInvNombre('')
    setInvRol('tesoreria')
    setInvMsg(null)
  }

  if (checkingRol) {
    return <div className="p-8 text-sm text-gray-400">Verificando acceso...</div>
  }

  if (rolActual !== 'admin') {
    return (
      <div className="p-8 max-w-md">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3"><Lock size={20} className="text-red-600" /></div>
          <p className="font-semibold text-red-800 mb-1">Acceso restringido</p>
          <p className="text-sm text-red-600">Solo los administradores pueden gestionar usuarios.</p>
          <Link href="/dashboard" className="mt-4 inline-block text-sm underline text-red-700">
            Volver al dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Usuarios</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestión de acceso al sistema</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#1e3a5f' }}
        >
          + Invitar usuario
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Cargando usuarios...</div>
        ) : error ? (
          <div className="p-12 text-center text-red-400 text-sm">Error: {error}</div>
        ) : usuarios.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            No hay usuarios registrados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['Nombre', 'Email', 'Rol', 'Estado', 'Registrado', 'Acciones'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usuarios.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{u.nombre || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${ROL_STYLE[u.rol] ?? 'bg-gray-100 text-gray-600'}`}>
                        {ROLES.find(r => r.value === u.rol)?.label ?? u.rol}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                        u.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{formatDate(u.created_at)}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/usuarios/${u.id}`}
                        className="px-3 py-1 text-xs font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && !error && usuarios.length > 0 && (
        <p className="text-xs text-gray-400 mt-3">{usuarios.length} {usuarios.length === 1 ? 'usuario' : 'usuarios'}</p>
      )}

      {/* Modal invitar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-800">Invitar usuario</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            {invMsg?.type === 'ok' ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-700">
                  <span className="flex items-start gap-2"><CheckCircle2 size={15} className="flex-shrink-0 mt-0.5" />{invMsg.text}</span>
                </div>
                <button
                  onClick={closeModal}
                  className="w-full py-2.5 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: '#1e3a5f' }}
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <form onSubmit={handleInvitar} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre completo
                  </label>
                  <input
                    type="text"
                    value={invNombre}
                    onChange={e => setInvNombre(e.target.value)}
                    placeholder="Ej. Juan Pérez"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Correo electrónico <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={invEmail}
                    onChange={e => setInvEmail(e.target.value)}
                    required
                    placeholder="usuario@coopac.pe"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                  <select
                    value={invRol}
                    onChange={e => setInvRol(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent"
                  >
                    {ROLES.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                  El usuario recibirá un email de invitación para configurar su contraseña.
                </div>

                {invMsg?.type === 'err' && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                    <span className="flex items-start gap-2"><AlertCircle size={15} className="flex-shrink-0 mt-0.5" />{invMsg.text}</span>
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={invLoading}
                    className="flex-1 py-2.5 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                    style={{ backgroundColor: '#1e3a5f' }}
                  >
                    {invLoading ? 'Enviando...' : 'Enviar invitación'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
