'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

type AporteDetalle = {
  id: number
  fecha: string
  tipo: string
  monto: number
  saldo_anterior: number
  saldo_nuevo: number
  observacion: string | null
  id_recibo: number | null
  created_at: string
  created_by: string | null
  socios: {
    nombres: string
    apellidos: string
    dni: string
    nro_socio: string
  } | null
  pagos_recibos: {
    nro_recibo: string
  } | null
}

function fmt(n: number | null | undefined) {
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  const parts = d.split('T')[0].split('-')
  if (parts.length !== 3) return d
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

function DataField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value ?? '—'}</p>
    </div>
  )
}

export default function AporteDetallePage() {
  const { id } = useParams() as { id: string }
  const [aporte, setAporte] = useState<AporteDetalle | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    createClient()
      .from('aportes')
      .select('*, socios(nombres, apellidos, dni, nro_socio), pagos_recibos(nro_recibo)')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) setAporte(data as AporteDetalle)
        setLoading(false)
      })
  }, [id])

  if (loading) return <div className="p-8 text-sm text-gray-400">Cargando...</div>

  if (!aporte) {
    return (
      <div className="p-8">
        <p className="text-sm text-gray-500">Aporte no encontrado.</p>
        <Link href="/dashboard/aportes" className="text-sm underline mt-2 inline-block" style={{ color: '#1e3a5f' }}>
          Volver a Aportes
        </Link>
      </div>
    )
  }

  const socioNombre = aporte.socios
    ? `${aporte.socios.apellidos}, ${aporte.socios.nombres}`
    : '—'

  return (
    <div className="p-8">
      {/* Encabezado */}
      <div className="mb-6">
        <Link
          href="/dashboard/aportes"
          className="text-sm text-gray-400 hover:text-gray-600 mb-1 inline-block transition-colors"
        >
          ← Volver
        </Link>
        <h1 className="text-2xl font-bold text-gray-800">Detalle de Aporte</h1>
      </div>

      <div className="space-y-5">
        {/* Datos del socio */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-4 pb-2 border-b border-gray-100" style={{ color: '#1e3a5f' }}>
            Datos del Socio
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            <DataField label="Socio" value={socioNombre} />
            <DataField label="Nº Socio" value={aporte.socios?.nro_socio} />
            <DataField label="DNI" value={aporte.socios?.dni} />
          </div>
        </div>

        {/* Detalle del aporte */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-4 pb-2 border-b border-gray-100" style={{ color: '#1e3a5f' }}>
            Detalle del Movimiento
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            <DataField label="Fecha" value={formatDate(aporte.fecha)} />
            <DataField label="Tipo de Movimiento" value={aporte.tipo} />
            <DataField label="Monto Aportado" value={`S/ ${fmt(aporte.monto)}`} />
            <DataField label="Saldo Anterior" value={`S/ ${fmt(aporte.saldo_anterior)}`} />
            <DataField label="Saldo Nuevo (Acumulado)" value={`S/ ${fmt(aporte.saldo_nuevo)}`} />
            <DataField
              label="Recibo Vinculado"
              value={
                aporte.id_recibo && aporte.pagos_recibos
                  ? aporte.pagos_recibos.nro_recibo
                  : null
              }
            />
          </div>

          {aporte.id_recibo && aporte.pagos_recibos && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Enlace al Recibo</p>
              <Link
                href={`/dashboard/pagos/${aporte.id_recibo}`}
                className="text-sm underline hover:opacity-80 transition-opacity"
                style={{ color: '#1e3a5f' }}
              >
                Ver recibo Nº {aporte.pagos_recibos.nro_recibo}
              </Link>
            </div>
          )}

          {aporte.observacion && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Observación</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
                {aporte.observacion}
              </p>
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-4 pb-2 border-b border-gray-100" style={{ color: '#1e3a5f' }}>
            Información de Registro
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            <DataField label="Registrado por" value={aporte.created_by} />
            <DataField label="Fecha de Registro" value={formatDate(aporte.created_at)} />
          </div>
        </div>
      </div>
    </div>
  )
}
