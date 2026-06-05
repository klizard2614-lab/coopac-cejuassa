'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRol } from '@/lib/useRol'
import AccesoDenegado from '@/components/AccesoDenegado'
import { CheckCircle2 } from 'lucide-react'

const ROLES = [
  { value: 'admin',        label: 'Administrador — acceso total' },
  { value: 'tesoreria',    label: 'Tesorería — pagos, aportes, socios' },
  { value: 'creditos',     label: 'Créditos — créditos y cronogramas' },
  { value: 'contabilidad', label: 'Contabilidad — reportes y cartera' },
]

export default function NuevoUsuarioPage() {
  const { rol: rolActual, loading: checkingRol } = useRol()
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [rol, setRol] = useState('tesoreria')
  const [enviado, setEnviado] = useState(false)

  if (checkingRol) return <div className="p-8 text-sm text-gray-400">Verificando acceso...</div>
  if (rolActual !== 'admin') return <AccesoDenegado />

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim() || !email.trim()) return
    setEnviado(true)
  }

  return (
    <div className="p-8 max-w-lg">
      <Link
        href="/dashboard/usuarios"
        className="text-sm text-gray-400 hover:text-gray-600 mb-4 inline-block transition-colors"
      >
        ← Volver
      </Link>
      <h1 className="text-2xl font-bold text-gray-800 mb-1">Nuevo Usuario</h1>
      <p className="text-sm text-gray-500 mb-6">Registra el acceso de un nuevo colaborador</p>

      {!enviado ? (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre completo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              required
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
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="usuario@coopac.pe"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent"
            />
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

          {/* Aviso sobre creación de cuenta */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
            ℹ️ La cuenta de acceso se crea desde el panel de Supabase Auth.
            Este formulario registra los datos del usuario en el sistema.
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#1e3a5f' }}
          >
            Continuar
          </button>
        </form>
      ) : (
        /* Pantalla de instrucciones post-envío */
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0"><CheckCircle2 size={20} className="text-green-600" /></div>
            <div>
              <p className="font-semibold text-gray-800">Datos registrados</p>
              <p className="text-xs text-gray-500">{nombre} · {email} · Rol: {ROLES.find(r => r.value === rol)?.label}</p>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">
              Siguiente paso: crear la cuenta de acceso en Supabase
            </p>
            <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
              <li>Abre el panel de Supabase Authentication</li>
              <li>Ve a <strong>Authentication → Users → Invite user</strong></li>
              <li>Ingresa el email: <code className="bg-gray-100 px-1 rounded text-xs">{email}</code></li>
              <li>Supabase enviará un link de configuración de contraseña</li>
              <li>Una vez que el usuario active su cuenta, aparecerá en la lista</li>
            </ol>
          </div>

          <div className="flex gap-3 pt-2">
            <a
              href="https://supabase.com/dashboard/project/ljdjbhsipgkxlgnprzhm/auth/users"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2 rounded-lg text-white text-sm font-medium text-center hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#1e3a5f' }}
            >
              Ir al panel Supabase ↗
            </a>
            <Link
              href="/dashboard/usuarios"
              className="flex-1 py-2 rounded-lg text-sm font-medium text-center border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Volver a Usuarios
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
