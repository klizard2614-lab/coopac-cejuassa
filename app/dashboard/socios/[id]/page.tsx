'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

type Socio = {
  id: string
  nro_socio: string
  dni: string
  apellidos: string
  nombres: string
  fecha_nacimiento: string | null
  telefono: string | null
  email: string | null
  direccion: string | null
  fecha_ingreso: string | null
  fecha_retiro: string | null
  estado: string
  beneficiario_nombre: string | null
  beneficiario_dni: string | null
  beneficiario_parentesco: string | null
  convenios: { nombre: string } | null
}

function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    activo:     { bg: 'bg-green-100',  text: 'text-green-800',  label: 'Activo' },
    retirado:   { bg: 'bg-gray-100',   text: 'text-gray-600',   label: 'Retirado' },
    suspendido: { bg: 'bg-amber-100',  text: 'text-amber-800',  label: 'Suspendido' },
    fallecido:  { bg: 'bg-gray-800',   text: 'text-white',      label: 'Fallecido' },
  }
  const s = map[estado] ?? map.retirado
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  )
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  const parts = d.split('-')
  if (parts.length !== 3) return d
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

function DataField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value || '—'}</p>
    </div>
  )
}

export default function SocioDetailPage() {
  const { id } = useParams() as { id: string }
  const [socio, setSocio] = useState<Socio | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    createClient()
      .from('socios')
      .select('*, convenios(nombre)')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) setSocio(data as Socio)
        setLoading(false)
      })
  }, [id])

  if (loading) {
    return <div className="p-8 text-sm text-gray-400">Cargando...</div>
  }

  if (!socio) {
    return (
      <div className="p-8">
        <p className="text-sm text-gray-500">Socio no encontrado.</p>
        <Link href="/dashboard/socios" className="text-sm text-[#1e3a5f] underline mt-2 inline-block">
          Volver a Socios
        </Link>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <Link href="/dashboard/socios" className="text-sm text-gray-400 hover:text-gray-600 mb-1 inline-block transition-colors">
            ← Volver a Socios
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">
            {socio.apellidos}, {socio.nombres}
          </h1>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-sm text-gray-500">
              Nº Socio: <span className="font-semibold text-gray-800">{socio.nro_socio}</span>
            </span>
            <EstadoBadge estado={socio.estado} />
          </div>
        </div>
        <Link
          href={`/dashboard/socios/${id}/editar`}
          className="px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#1e3a5f' }}
        >
          Editar
        </Link>
      </div>

      <div className="space-y-5">
        {/* Datos personales */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xs font-semibold text-[#1e3a5f] uppercase tracking-wider mb-5 pb-2 border-b border-gray-100">
            Datos Personales
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            <DataField label="DNI" value={socio.dni} />
            <DataField label="Apellidos" value={socio.apellidos} />
            <DataField label="Nombres" value={socio.nombres} />
            <DataField label="Fecha de Nacimiento" value={formatDate(socio.fecha_nacimiento)} />
            <DataField label="Teléfono" value={socio.telefono} />
            <DataField label="Email" value={socio.email} />
            <DataField label="Dirección" value={socio.direccion} />
          </div>
        </div>

        {/* Datos cooperativa */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xs font-semibold text-[#1e3a5f] uppercase tracking-wider mb-5 pb-2 border-b border-gray-100">
            Datos Cooperativa
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            <DataField label="Convenio" value={socio.convenios?.nombre} />
            <DataField label="Fecha de Ingreso" value={formatDate(socio.fecha_ingreso)} />
            <DataField label="Fecha de Retiro" value={formatDate(socio.fecha_retiro)} />
          </div>
        </div>

        {/* Beneficiario FPS */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xs font-semibold text-[#1e3a5f] uppercase tracking-wider mb-5 pb-2 border-b border-gray-100">
            Beneficiario FPS
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            <DataField label="Nombre" value={socio.beneficiario_nombre} />
            <DataField label="DNI" value={socio.beneficiario_dni} />
            <DataField label="Parentesco" value={socio.beneficiario_parentesco} />
          </div>
        </div>
      </div>
    </div>
  )
}
