'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useRol } from '@/lib/useRol'
import AccesoDenegado from '@/components/AccesoDenegado'
import { Building2, UserCog, ExternalLink } from 'lucide-react'

type Config = {
  id: number
  nombre_cooperativa: string
  codigo_coopac: string
  ruc: string | null
  direccion: string | null
  telefono: string | null
  email: string | null
  tasa_interes_anual: number
  tasa_fps: number
  provision_normal: number
  provision_cpp: number
  provision_deficiente: number
  provision_dudoso: number
  provision_perdida: number
  updated_at: string
}

function pct(n: number) {
  return (n * 100).toFixed(4)
}

function fromPct(s: string): number {
  return parseFloat(s) / 100
}

export default function ConfiguracionPage() {
  const { rol, loading: checkingRol } = useRol()
  const [cfg, setCfg] = useState<Config | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Datos cooperativa
  const [nombre, setNombre]         = useState('')
  const [codigoCoop, setCodigoCoop] = useState('')
  const [ruc, setRuc]               = useState('')
  const [direccion, setDireccion]   = useState('')
  const [telefono, setTelefono]     = useState('')
  const [email, setEmail]           = useState('')
  const [savingDatos, setSavingDatos] = useState(false)
  const [msgDatos, setMsgDatos]       = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Parámetros financieros
  const [tasaInteres,   setTasaInteres]   = useState('')
  const [tasaFps,       setTasaFps]       = useState('')
  const [provNormal,    setProvNormal]    = useState('')
  const [provCpp,       setProvCpp]       = useState('')
  const [provDeficiente,setProvDeficiente]= useState('')
  const [provDudoso,    setProvDudoso]    = useState('')
  const [provPerdida,   setProvPerdida]   = useState('')
  const [savingParams, setSavingParams]   = useState(false)
  const [msgParams, setMsgParams]         = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    createClient()
      .from('configuracion')
      .select('*')
      .eq('id', 1)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { setError(error?.message ?? 'No se encontró la configuración'); setLoading(false); return }
        const c = data as Config
        setCfg(c)
        setNombre(c.nombre_cooperativa ?? '')
        setCodigoCoop(c.codigo_coopac ?? '')
        setRuc(c.ruc ?? '')
        setDireccion(c.direccion ?? '')
        setTelefono(c.telefono ?? '')
        setEmail(c.email ?? '')
        setTasaInteres(pct(c.tasa_interes_anual))
        setTasaFps(pct(c.tasa_fps))
        setProvNormal(pct(c.provision_normal))
        setProvCpp(pct(c.provision_cpp))
        setProvDeficiente(pct(c.provision_deficiente))
        setProvDudoso(pct(c.provision_dudoso))
        setProvPerdida(pct(c.provision_perdida))
        setLoading(false)
      })
  }, [])

  async function handleSaveDatos(e: React.FormEvent) {
    e.preventDefault()
    setSavingDatos(true)
    setMsgDatos(null)
    const { error } = await createClient()
      .from('configuracion')
      .update({
        nombre_cooperativa: nombre.trim(),
        codigo_coopac: codigoCoop.trim(),
        ruc: ruc.trim() || null,
        direccion: direccion.trim() || null,
        telefono: telefono.trim() || null,
        email: email.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)
    setMsgDatos(error
      ? { type: 'err', text: `Error: ${error.message}` }
      : { type: 'ok', text: 'Datos de la cooperativa guardados.' }
    )
    setSavingDatos(false)
  }

  async function handleSaveParams(e: React.FormEvent) {
    e.preventDefault()
    setSavingParams(true)
    setMsgParams(null)
    const { error } = await createClient()
      .from('configuracion')
      .update({
        tasa_interes_anual: fromPct(tasaInteres),
        tasa_fps: fromPct(tasaFps),
        provision_normal: fromPct(provNormal),
        provision_cpp: fromPct(provCpp),
        provision_deficiente: fromPct(provDeficiente),
        provision_dudoso: fromPct(provDudoso),
        provision_perdida: fromPct(provPerdida),
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)
    setMsgParams(error
      ? { type: 'err', text: `Error: ${error.message}` }
      : { type: 'ok', text: 'Parámetros financieros guardados.' }
    )
    setSavingParams(false)
  }

  if (checkingRol) return <div className="p-8 text-sm text-gray-400">Verificando acceso...</div>
  if (rol !== 'admin') return <AccesoDenegado mensaje="Solo los administradores pueden acceder a la configuración del sistema." />
  if (loading) return <div className="p-8 text-sm text-gray-400">Cargando configuración...</div>
  if (error)   return <div className="p-8 text-sm text-red-400">Error: {error}</div>

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Configuración</h1>
        <p className="text-sm text-gray-500 mt-0.5">Parámetros del sistema</p>
      </div>

      {/* ── Sección 1: Datos de la Cooperativa ── */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Datos de la Cooperativa
        </h2>
        <form onSubmit={handleSaveDatos} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la cooperativa</label>
              <input
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Código COOPAC</label>
              <input
                value={codigoCoop}
                onChange={e => setCodigoCoop(e.target.value)}
                placeholder="Ej. 001"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">RUC</label>
              <input
                value={ruc}
                onChange={e => setRuc(e.target.value)}
                placeholder="20XXXXXXXXX"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
              <input
                value={direccion}
                onChange={e => setDireccion(e.target.value)}
                placeholder="Av. Principal 123, ciudad"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input
                value={telefono}
                onChange={e => setTelefono(e.target.value)}
                placeholder="(01) 234-5678"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="contacto@coopac.pe"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              />
            </div>
          </div>

          {msgDatos && (
            <div className={`text-sm rounded-lg px-3 py-2 ${
              msgDatos.type === 'ok'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {msgDatos.text}
            </div>
          )}

          <button
            type="submit"
            disabled={savingDatos}
            className="px-5 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: '#1e3a5f' }}
          >
            {savingDatos ? 'Guardando...' : 'Guardar datos'}
          </button>
        </form>
      </section>

      {/* ── Sección 2: Parámetros Financieros ── */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Parámetros Financieros
        </h2>
        <form onSubmit={handleSaveParams} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tasa de interés anual (%)</label>
              <input
                type="number"
                step="0.0001"
                min="0"
                value={tasaInteres}
                onChange={e => setTasaInteres(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              />
              <p className="text-xs text-gray-400 mt-1">Tasa por defecto al crear créditos</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tasa FPS (%)</label>
              <input
                type="number"
                step="0.0001"
                min="0"
                value={tasaFps}
                onChange={e => setTasaFps(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              />
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Tasas de provisión por clasificación (%)</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: 'Normal',     val: provNormal,     set: setProvNormal,     color: 'text-green-700' },
                { label: 'CPP',        val: provCpp,        set: setProvCpp,        color: 'text-yellow-700' },
                { label: 'Deficiente', val: provDeficiente, set: setProvDeficiente, color: 'text-orange-700' },
                { label: 'Dudoso',     val: provDudoso,     set: setProvDudoso,     color: 'text-red-600' },
                { label: 'Pérdida',    val: provPerdida,    set: setProvPerdida,    color: 'text-red-900' },
              ].map(({ label, val, set, color }) => (
                <div key={label}>
                  <label className={`block text-xs font-semibold mb-1 ${color}`}>{label}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={val}
                    onChange={e => set(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                  />
                </div>
              ))}
            </div>
          </div>

          {msgParams && (
            <div className={`text-sm rounded-lg px-3 py-2 ${
              msgParams.type === 'ok'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {msgParams.text}
            </div>
          )}

          <button
            type="submit"
            disabled={savingParams}
            className="px-5 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: '#1e3a5f' }}
          >
            {savingParams ? 'Guardando...' : 'Guardar parámetros'}
          </button>
        </form>
      </section>

      {/* ── Sección 3: Accesos rápidos ── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Administración
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href="/dashboard/configuracion/convenios"
            className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center mb-3"><Building2 size={18} className="text-blue-600" /></div>
            <p className="text-sm font-semibold text-gray-800">Gestionar Convenios</p>
            <p className="text-xs text-gray-400 mt-1">Agregar o editar instituciones empleadoras</p>
          </Link>
          <Link
            href="/dashboard/usuarios"
            className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center mb-3"><UserCog size={18} className="text-blue-600" /></div>
            <p className="text-sm font-semibold text-gray-800">Gestionar Usuarios</p>
            <p className="text-xs text-gray-400 mt-1">Roles y accesos al sistema</p>
          </Link>
          <a
            href="https://supabase.com/dashboard/project/ljdjbhsipgkxlgnprzhm"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all"
          >
            <p className="text-2xl mb-2">🗄️</p>
            <p className="text-sm font-semibold text-gray-800">Panel Supabase ↗</p>
            <p className="text-xs text-gray-400 mt-1">Administración directa de base de datos</p>
          </a>
        </div>

        {cfg?.updated_at && (
          <p className="text-xs text-gray-400 mt-4">
            Última modificación: {new Date(cfg.updated_at).toLocaleString('es-PE')}
          </p>
        )}
      </section>
    </div>
  )
}
