'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Lock, CheckCircle2, AlertCircle } from 'lucide-react'
import { PageFrame, PageToolbar, DataTableShell, DataTableHeader, DataTableEmpty, TableSkeleton, RecordMeta, StatusBadge, InlineAlert, btnPrimary, btnGhost, btnEdit, inputCls, selectCls } from '../_components/ui'

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

const ROL_VARIANT: Record<string, 'success' | 'warning' | 'neutral' | 'info'> = {
  admin:        'info',
  tesoreria:    'success',
  creditos:     'warning',
  contabilidad: 'neutral',
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
    return <div className="min-h-full bg-slate-50 p-8 text-sm text-slate-400">Verificando acceso...</div>
  }

  if (rolActual !== 'admin') {
    return (
      <PageFrame>
        <div className="max-w-md bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
            <Lock size={20} className="text-red-600" />
          </div>
          <p className="font-semibold text-red-800 mb-1">Acceso restringido</p>
          <p className="text-sm text-red-600">Solo los administradores pueden gestionar usuarios.</p>
          <Link href="/dashboard" className={`${btnGhost} mt-4 inline-flex`}>Volver al dashboard</Link>
        </div>
      </PageFrame>
    )
  }

  return (
    <PageFrame>
      <PageToolbar
        title="Usuarios"
        subtitle="Gestión de acceso al sistema"
        actions={
          <button onClick={() => setShowModal(true)} className={btnPrimary}>
            + Invitar usuario
          </button>
        }
      />

      {error && <InlineAlert variant="danger">Error: {error}</InlineAlert>}

      <DataTableShell>
        <DataTableHeader>
          <tr>
            {['Nombre', 'Email', 'Rol', 'Estado', 'Registrado', 'Acciones'].map(h => (
              <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </DataTableHeader>
        <tbody>
          {loading ? (
            <TableSkeleton rows={4} cols={6} />
          ) : usuarios.length === 0 ? (
            <DataTableEmpty cols={6} message="No hay usuarios registrados." />
          ) : (
            usuarios.map(u => (
              <tr key={u.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-2.5 font-medium text-slate-800">{u.nombre || '—'}</td>
                <td className="px-4 py-2.5 text-slate-600 text-sm">{u.email}</td>
                <td className="px-4 py-2.5">
                  <StatusBadge
                    label={ROLES.find(r => r.value === u.rol)?.label ?? u.rol}
                    variant={ROL_VARIANT[u.rol] ?? 'neutral'}
                  />
                </td>
                <td className="px-4 py-2.5">
                  <StatusBadge
                    label={u.activo ? 'Activo' : 'Inactivo'}
                    variant={u.activo ? 'success' : 'danger'}
                  />
                </td>
                <td className="px-4 py-2.5 text-sm text-slate-500 whitespace-nowrap">{formatDate(u.created_at)}</td>
                <td className="px-4 py-2.5">
                  <Link href={`/dashboard/usuarios/${u.id}`} className={btnEdit}>Editar</Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </DataTableShell>

      {!loading && !error && usuarios.length > 0 && (
        <RecordMeta>{usuarios.length} {usuarios.length === 1 ? 'usuario' : 'usuarios'}</RecordMeta>
      )}

      {/* Modal invitar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-800">Invitar usuario</h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>

            {invMsg?.type === 'ok' ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-700">
                  <span className="flex items-start gap-2"><CheckCircle2 size={15} className="flex-shrink-0 mt-0.5" />{invMsg.text}</span>
                </div>
                <button onClick={closeModal} className={`w-full ${btnPrimary}`}>Cerrar</button>
              </div>
            ) : (
              <form onSubmit={handleInvitar} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nombre completo</label>
                  <input
                    type="text"
                    value={invNombre}
                    onChange={e => setInvNombre(e.target.value)}
                    placeholder="Ej. Juan Pérez"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Correo electrónico <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={invEmail}
                    onChange={e => setInvEmail(e.target.value)}
                    required
                    placeholder="usuario@coopac.pe"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Rol</label>
                  <select
                    value={invRol}
                    onChange={e => setInvRol(e.target.value)}
                    className={selectCls}
                  >
                    {ROLES.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>

                <InlineAlert variant="info">
                  El usuario recibirá un email de invitación para configurar su contraseña.
                </InlineAlert>

                {invMsg?.type === 'err' && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                    <span className="flex items-start gap-2"><AlertCircle size={15} className="flex-shrink-0 mt-0.5" />{invMsg.text}</span>
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={closeModal} className={`flex-1 ${btnGhost}`}>Cancelar</button>
                  <button
                    type="submit"
                    disabled={invLoading}
                    className={`flex-1 ${btnPrimary} disabled:opacity-50`}
                  >
                    {invLoading ? 'Enviando...' : 'Enviar invitación'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </PageFrame>
  )
}
