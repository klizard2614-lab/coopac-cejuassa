'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

type Cuota = {
  id: string
  nro_cuota: number
  fecha_vencimiento: string
  capital: number
  interes: number
  cuota_total: number
  capital_pagado: number
  interes_pagado: number
  estado: string
  fecha_pago: string | null
}

type Credito = {
  id: string
  nro_pagare: string
  fecha_desembolso: string | null
  monto_aprobado: number
  monto_girado_neto: number
  descuento_fps: number
  descuento_seguro: number
  descuento_otros: number
  tasa_interes: number
  plazo_meses: number
  cuota_mensual: number
  tipo_credito: string | null
  saldo_capital: number
  interes_acumulado: number
  estado: string
  fecha_cancelacion: string | null
  socios: {
    apellidos: string
    nombres: string
    dni: string
    nro_socio: string
  } | null
}

// ── Badges ───────────────────────────────────────────────────────────────────

function CreditoBadge({ estado }: { estado: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    vigente:      { bg: 'bg-green-100',  text: 'text-green-800',  label: 'Vigente' },
    cancelado:    { bg: 'bg-gray-100',   text: 'text-gray-600',   label: 'Cancelado' },
    castigado:    { bg: 'bg-red-100',    text: 'text-red-800',    label: 'Castigado' },
    refinanciado: { bg: 'bg-amber-100',  text: 'text-amber-800',  label: 'Refinanciado' },
  }
  const s = map[estado] ?? map.cancelado
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  )
}

function CuotaBadge({ estado }: { estado: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    pendiente: { bg: 'bg-blue-50',   text: 'text-blue-700',  label: 'Pendiente' },
    pagada:    { bg: 'bg-green-100', text: 'text-green-800', label: 'Pagada' },
    vencida:   { bg: 'bg-red-100',   text: 'text-red-800',   label: 'Vencida' },
    parcial:   { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Parcial' },
  }
  const s = map[estado] ?? map.pendiente
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined) {
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
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
      <p className="text-sm font-medium text-gray-800">{value ?? '—'}</p>
    </div>
  )
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function CreditoDetailPage() {
  const { id } = useParams() as { id: string }
  const [credito, setCredito] = useState<Credito | null>(null)
  const [cuotas, setCuotas] = useState<Cuota[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase
        .from('creditos')
        .select('*, socios(apellidos, nombres, dni, nro_socio)')
        .eq('id', id)
        .single(),
      supabase
        .from('cronograma_cuotas')
        .select('*')
        .eq('id_credito', id)
        .order('nro_cuota'),
    ]).then(([{ data: c }, { data: cc }]) => {
      if (c) setCredito(c as Credito)
      if (cc) setCuotas(cc as Cuota[])
      setLoading(false)
    })
  }, [id])

  if (loading) return <div className="p-8 text-sm text-gray-400">Cargando...</div>
  if (!credito) {
    return (
      <div className="p-8">
        <p className="text-sm text-gray-500">Crédito no encontrado.</p>
        <Link href="/dashboard/creditos" className="text-sm text-[#1e3a5f] underline mt-2 inline-block">
          Volver a Créditos
        </Link>
      </div>
    )
  }

  // Totales del cronograma
  const totalPagado = cuotas.reduce((s, c) => s + (c.capital_pagado ?? 0) + (c.interes_pagado ?? 0), 0)
  const cuotasPagadas = cuotas.filter(c => c.estado === 'pagada').length
  const cuotasVencidas = cuotas.filter(c => c.estado === 'vencida').length

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <Link href="/dashboard/creditos" className="text-sm text-gray-400 hover:text-gray-600 mb-1 inline-block transition-colors">
            ← Volver a Créditos
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">Pagaré Nº {credito.nro_pagare}</h1>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-sm text-gray-600">
              {credito.socios ? `${credito.socios.apellidos}, ${credito.socios.nombres}` : '—'}
            </span>
            <CreditoBadge estado={credito.estado} />
          </div>
        </div>
        <Link
          href={`/dashboard/creditos/${id}/editar`}
          className="px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#1e3a5f' }}
        >
          Editar
        </Link>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Monto Aprobado', value: `S/ ${fmt(credito.monto_aprobado)}` },
          { label: 'Saldo Capital', value: `S/ ${fmt(credito.saldo_capital)}` },
          { label: 'Cuota Mensual', value: `S/ ${fmt(credito.cuota_mensual)}` },
          { label: 'Total Pagado', value: `S/ ${fmt(totalPagado)}` },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{card.label}</p>
            <p className="text-lg font-bold text-gray-800">{card.value}</p>
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
            <DataField label="Nº Socio" value={credito.socios?.nro_socio} />
            <DataField label="DNI" value={credito.socios?.dni} />
            <DataField label="Apellidos" value={credito.socios?.apellidos} />
            <DataField label="Nombres" value={credito.socios?.nombres} />
          </div>
        </div>

        {/* Datos del crédito */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xs font-semibold text-[#1e3a5f] uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
            Datos del Crédito
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            <DataField label="Tipo de Crédito" value={credito.tipo_credito} />
            <DataField label="Fecha Desembolso" value={formatDate(credito.fecha_desembolso)} />
            <DataField label="Tasa Interés Anual" value={credito.tasa_interes != null ? `${credito.tasa_interes}%` : undefined} />
            <DataField label="Plazo" value={credito.plazo_meses ? `${credito.plazo_meses} meses` : undefined} />
            <DataField label="Monto Aprobado" value={`S/ ${fmt(credito.monto_aprobado)}`} />
            <DataField label="Monto Girado Neto" value={`S/ ${fmt(credito.monto_girado_neto)}`} />
            <DataField label="Cuota Mensual" value={`S/ ${fmt(credito.cuota_mensual)}`} />
            <DataField label="Saldo Capital" value={`S/ ${fmt(credito.saldo_capital)}`} />
            <DataField label="Fecha Cancelación" value={formatDate(credito.fecha_cancelacion)} />
          </div>
        </div>

        {/* Descuentos */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xs font-semibold text-[#1e3a5f] uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
            Descuentos al Desembolso
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            <DataField label="FPS" value={`S/ ${fmt(credito.descuento_fps)}`} />
            <DataField label="Seguro" value={`S/ ${fmt(credito.descuento_seguro)}`} />
            <DataField label="Otros" value={`S/ ${fmt(credito.descuento_otros)}`} />
          </div>
        </div>

        {/* Cronograma de cuotas */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-[#1e3a5f] uppercase tracking-wider">
              Cronograma de Cuotas
            </h2>
            <div className="flex gap-3 text-xs text-gray-500">
              <span>Pagadas: <span className="font-semibold text-green-700">{cuotasPagadas}</span></span>
              <span>Vencidas: <span className="font-semibold text-red-700">{cuotasVencidas}</span></span>
              <span>Total: <span className="font-semibold text-gray-700">{cuotas.length}</span></span>
            </div>
          </div>

          {cuotas.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">Sin cronograma generado</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['Nº', 'Vencimiento', 'Capital', 'Interés', 'Cuota Total', 'Cap. Pagado', 'Int. Pagado', 'Estado'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {cuotas.map(c => (
                    <tr
                      key={c.id}
                      className={`transition-colors ${c.estado === 'vencida' ? 'bg-red-50/40' : c.estado === 'pagada' ? 'bg-green-50/30' : 'hover:bg-gray-50'}`}
                    >
                      <td className="px-4 py-2.5 text-sm font-medium text-gray-700">{c.nro_cuota}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-600 whitespace-nowrap">{formatDate(c.fecha_vencimiento)}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-700 whitespace-nowrap">{fmt(c.capital)}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-700 whitespace-nowrap">{fmt(c.interes)}</td>
                      <td className="px-4 py-2.5 text-sm font-semibold text-gray-900 whitespace-nowrap">{fmt(c.cuota_total)}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-700 whitespace-nowrap">{fmt(c.capital_pagado)}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-700 whitespace-nowrap">{fmt(c.interes_pagado)}</td>
                      <td className="px-4 py-2.5"><CuotaBadge estado={c.estado} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
