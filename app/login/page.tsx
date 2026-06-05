'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Mail, Lock, AlertCircle, ArrowRight, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router   = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Credenciales incorrectas. Verifica tu email y contraseña.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: '#F8FAFC' }}
    >
      <div className="w-full max-w-sm">

        {/* Logo + nombre centrado */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-md"
            style={{ backgroundColor: '#1A56DB' }}
          >
            <Image
              src="/logo-cejuassa.png"
              alt="Logo COOPAC CEJUASSA"
              width={44}
              height={44}
              className="w-11 h-11 object-contain"
            />
          </div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: '#1E293B' }}>
            COOPAC CEJUASSA
          </h1>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>
            Sistema de Gestión Cooperativa
          </p>
        </div>

        {/* Card del formulario */}
        <div className="bg-white rounded-2xl shadow-sm border px-8 py-8" style={{ borderColor: '#E2E8F0' }}>
          <h2 className="text-base font-semibold mb-6" style={{ color: '#1E293B' }}>
            Iniciar sesión
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium mb-1.5"
                style={{ color: '#1E293B' }}
              >
                Correo electrónico
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: '#94A3B8' }}
                />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@ejemplo.com"
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm outline-none transition-all border"
                  style={{
                    borderColor: '#E2E8F0',
                    color: '#1E293B',
                    backgroundColor: '#fff',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#1A56DB')}
                  onBlur={e  => (e.currentTarget.style.borderColor = '#E2E8F0')}
                />
              </div>
            </div>

            {/* Contraseña */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium mb-1.5"
                style={{ color: '#1E293B' }}
              >
                Contraseña
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: '#94A3B8' }}
                />
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm outline-none transition-all border"
                  style={{
                    borderColor: '#E2E8F0',
                    color: '#1E293B',
                    backgroundColor: '#fff',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#1A56DB')}
                  onBlur={e  => (e.currentTarget.style.borderColor = '#E2E8F0')}
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                className="flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm border"
                style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA', color: '#DC2626' }}
              >
                <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Botón */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white transition-all mt-2 disabled:opacity-60"
              style={{ backgroundColor: '#1A56DB' }}
              onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1447C0' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1A56DB' }}
            >
              {loading ? (
                <><Loader2 size={15} className="animate-spin" /> Ingresando...</>
              ) : (
                <><ArrowRight size={15} /> Ingresar al sistema</>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: '#94A3B8' }}>
          &copy; {new Date().getFullYear()} COOPAC CEJUASSA. Todos los derechos reservados.
        </p>
      </div>
    </div>
  )
}
