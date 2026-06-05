'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

// ── Tipos ─────────────────────────────────────────────────────────────────────

type PagoDetalle = {
  id: string
  nro_recibo: string
  fecha: string
  periodo: string
  canal_pago: string
  monto_aporte: number
  monto_capital: number
  monto_interes: number
  monto_fps: number
  monto_fps_extra: number
  monto_otros: number
  monto_total: number
  interes_amortizado_pagado: number
  estado_flujo: string
  observacion: string | null
  created_at: string
  created_by: string | null
  socios: {
    nro_socio: string
    dni: string
    apellidos: string
    nombres: string
  } | null
  creditos: {
    nro_pagare: string
    saldo_capital: number
    cuota_mensual: number
  } | null
  convenios: {
    nombre: string
  } | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ESTADO_MAP: Record<string, { bg: string; text: string; label: string }> = {
  registrado:    { bg: 'bg-blue-100',   text: 'text-blue-800',   label: 'Registrado' },
  en_correccion: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'En Corrección' },
  validado:      { bg: 'bg-green-100',  text: 'text-green-800',  label: 'Validado' },
  cerrado:       { bg: 'bg-gray-100',   text: 'text-gray-600',   label: 'Cerrado' },
}

function EstadoBadge({ estado }: { estado: string }) {
  const s = ESTADO_MAP[estado] ?? ESTADO_MAP.registrado
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  )
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

function MontoRow({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2.5 px-1 ${highlight ? 'border-t border-gray-200 mt-1 pt-3' : 'border-b border-gray-50'}`}>
      <span className={`text-sm ${highlight ? 'font-bold text-gray-900' : 'text-gray-600'}`}>{label}</span>
      <span className={`text-sm tabular-nums ${highlight ? 'font-bold text-lg' : 'text-gray-800'}`}
        style={highlight ? { color: '#1e3a5f' } : undefined}
      >
        S/ {fmt(value)}
      </span>
    </div>
  )
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function PagoDetallePage() {
  const { id } = useParams() as { id: string }
  const [pago, setPago] = useState<PagoDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatingEstado, setUpdatingEstado] = useState(false)
  const [estadoError, setEstadoError] = useState<string | null>(null)

  useEffect(() => {
    createClient()
      .from('pagos_recibos')
      .select('*, socios(nro_socio, dni, apellidos, nombres), creditos(nro_pagare, saldo_capital, cuota_mensual), convenios(nombre)')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) setPago(data as PagoDetalle)
        setLoading(false)
      })
  }, [id])

  async function pasarACorreccion() {
    if (!pago || pago.estado_flujo !== 'registrado') return
    setUpdatingEstado(true)
    setEstadoError(null)

    const { error } = await createClient()
      .from('pagos_recibos')
      .update({ estado_flujo: 'en_correccion' })
      .eq('id', id)

    if (error) {
      setEstadoError(error.message)
    } else {
      setPago(prev => prev ? { ...prev, estado_flujo: 'en_correccion' } : prev)
    }
    setUpdatingEstado(false)
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Cargando...</div>
  if (!pago) {
    return (
      <div className="p-8">
        <p className="text-sm text-gray-500">Pago no encontrado.</p>
        <Link href="/dashboard/pagos" className="text-sm text-[#1e3a5f] underline mt-2 inline-block">
          Volver a Pagos
        </Link>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <Link href="/dashboard/pagos" className="text-sm text-gray-400 hover:text-gray-600 mb-1 inline-block transition-colors">
            ← Volver a Pagos
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">Recibo Nº {pago.nro_recibo}</h1>
          <div className="flex items-center gap-3 mt-2">
            <EstadoBadge estado={pago.estado_flujo} />
            <span className="text-sm text-gray-500">
              {pago.socios ? `${pago.socios.apellidos}, ${pago.socios.nombres}` : '—'}
            </span>
          </div>
        </div>

        {pago.estado_flujo === 'registrado' && (
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={pasarACorreccion}
              disabled={updatingEstado}
              className="px-4 py-2 rounded-lg border border-yellow-400 text-yellow-700 bg-yellow-50 text-sm font-medium hover:bg-yellow-100 transition-colors disabled:opacity-60"
            >
              {updatingEstado ? 'Actualizando...' : 'Pasar a En Corrección'}
            </button>
            {estadoError && (
              <p className="text-xs text-red-600">{estadoError}</p>
            )}
          </div>
        )}
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Fecha',   value: formatDate(pago.fecha) },
          { label: 'Periodo', value: pago.periodo },
          { label: 'Canal',   value: pago.canal_pago.charAt(0).toUpperCase() + pago.canal_pago.slice(1) },
          { label: 'Total',   value: `S/ ${fmt(pago.monto_total)}` },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{card.label}</p>
            <p className="text-base font-bold text-gray-800">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-5">
        {/* Datos del socio */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xs font-semibold text-[#1e3a5f] uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
            Datos del Socio
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            <DataField label="Nº Socio"  value={pago.socios?.nro_socio} />
            <DataField label="DNI"       value={pago.socios?.dni} />
            <DataField label="Apellidos" value={pago.socios?.apellidos} />
            <DataField label="Nombres"   value={pago.socios?.nombres} />
            <DataField label="Convenio"  value={pago.convenios?.nombre} />
          </div>
        </div>

        {/* Crédito asociado */}
        {pago.creditos && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-xs font-semibold text-[#1e3a5f] uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
              Crédito Asociado
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
              <DataField label="Nº Pagaré"    value={pago.creditos.nro_pagare} />
              <DataField label="Saldo Capital" value={`S/ ${fmt(pago.creditos.saldo_capital)}`} />
              <DataField label="Cuota Mensual" value={`S/ ${fmt(pago.creditos.cuota_mensual)}`} />
            </div>
          </div>
        )}

        {/* Desglose del pago */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xs font-semibold text-[#1e3a5f] uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
            Desglose del Pago
          </h2>
          <div className="max-w-sm">
            <MontoRow label="Aporte"              value={pago.monto_aporte} />
            <MontoRow label="Capital"             value={pago.monto_capital} />
            <MontoRow label="Interés"             value={pago.monto_interes} />
            <MontoRow label="FPS"                 value={pago.monto_fps} />
            <MontoRow label="FPS Extra"           value={pago.monto_fps_extra} />
            <MontoRow label="Otros"               value={pago.monto_otros} />
            <MontoRow label="Total Recibo"        value={pago.monto_total} highlight />
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <DataField
              label="Interés Amortizado Pagado"
              value={`S/ ${fmt(pago.interes_amortizado_pagado)}`}
            />
          </div>
        </div>

        {/* Observación y metadatos */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xs font-semibold text-[#1e3a5f] uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
            Información Adicional
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            <DataField label="Estado del Flujo" value={ESTADO_MAP[pago.estado_flujo]?.label ?? pago.estado_flujo} />
            <DataField label="Registrado el"    value={formatDate(pago.created_at)} />
            <DataField label="Registrado por"   value={pago.created_by} />
          </div>
          {pago.observacion && (
            <div className="mt-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Observación</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
                {pago.observacion}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
