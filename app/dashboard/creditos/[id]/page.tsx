'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { AmpliacionesSection } from '../_components/AmpliacionesSection'
import { formatNombrePersona } from '@/lib/formatNombre'
import { PageFrame, DetailHero, DetailSection, FieldGrid, FieldItem, StatusBadge, btnEdit, btnGhost } from '../../_components/ui'

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
  const map: Record<string, { variant: 'success' | 'warning' | 'danger' | 'neutral'; label: string }> = {
    vigente:      { variant: 'success',  label: 'Vigente' },
    cancelado:    { variant: 'neutral',  label: 'Cancelado' },
    castigado:    { variant: 'danger',   label: 'Castigado' },
    refinanciado: { variant: 'warning',  label: 'Refinanciado' },
  }
  const s = map[estado] ?? map.cancelado
  return <StatusBadge label={s.label} variant={s.variant} />
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


// ── Componente ────────────────────────────────────────────────────────────────

export default function CreditoDetailPage() {
  const { id } = useParams() as { id: string }
  const [credito, setCredito] = useState<Credito | null>(null)
  const [cuotas, setCuotas] = useState<Cuota[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

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
  }, [id, refreshKey])

  if (loading) return <div className="min-h-full bg-slate-50 p-8 text-sm text-slate-400">Cargando...</div>
  if (!credito) {
    return (
      <PageFrame>
        <p className="text-sm text-slate-500">Crédito no encontrado.</p>
        <Link href="/dashboard/creditos" className={`${btnGhost} mt-2 inline-flex`}>Volver a Créditos</Link>
      </PageFrame>
    )
  }

  // Totales del cronograma
  const totalPagado = cuotas.reduce((s, c) => s + (c.capital_pagado ?? 0) + (c.interes_pagado ?? 0), 0)
  const cuotasPagadas = cuotas.filter(c => c.estado === 'pagada').length
  const cuotasVencidas = cuotas.filter(c => c.estado === 'vencida').length

  return (
    <PageFrame>
      <Link href="/dashboard/creditos" className={`${btnGhost} mb-4 inline-flex`}>← Volver a Créditos</Link>

      <DetailHero
        title={`Pagaré Nº ${credito.nro_pagare}`}
        subtitle={credito.socios ? formatNombrePersona(credito.socios.apellidos, credito.socios.nombres) : '—'}
        badge={<CreditoBadge estado={credito.estado} />}
        actions={
          <Link href={`/dashboard/creditos/${id}/editar`} className={btnEdit}>Editar</Link>
        }
      />

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Monto Aprobado', value: `S/ ${fmt(credito.monto_aprobado)}` },
          { label: 'Saldo Capital',  value: `S/ ${fmt(credito.saldo_capital)}` },
          { label: 'Cuota Mensual',  value: `S/ ${fmt(credito.cuota_mensual)}` },
          { label: 'Total Pagado',   value: `S/ ${fmt(totalPagado)}` },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">{card.label}</p>
            <p className="text-lg font-bold text-slate-800 tabular-nums">{card.value}</p>
          </div>
        ))}
      </div>

      <DetailSection title="Datos del Socio">
        <FieldGrid cols={4}>
          <FieldItem label="Nº Socio" value={credito.socios?.nro_socio} accent />
          <FieldItem label="DNI" value={credito.socios?.dni} mono />
          <FieldItem label="Apellidos" value={credito.socios?.apellidos} />
          <FieldItem label="Nombres" value={credito.socios?.nombres} />
        </FieldGrid>
      </DetailSection>

      <DetailSection title="Datos del Crédito">
        <FieldGrid cols={4}>
          <FieldItem label="Tipo de Crédito" value={credito.tipo_credito} />
          <FieldItem label="Fecha Desembolso" value={formatDate(credito.fecha_desembolso)} />
          <FieldItem label="Tasa TEA" value={credito.tasa_interes != null ? `${credito.tasa_interes}%` : undefined} mono />
          <FieldItem label="Plazo" value={credito.plazo_meses ? `${credito.plazo_meses} meses` : undefined} />
          <FieldItem label="Monto Aprobado" value={`S/ ${fmt(credito.monto_aprobado)}`} mono />
          <FieldItem label="Monto Girado Neto" value={`S/ ${fmt(credito.monto_girado_neto)}`} mono />
          <FieldItem label="Cuota Mensual" value={`S/ ${fmt(credito.cuota_mensual)}`} mono />
          <FieldItem label="Saldo Capital" value={`S/ ${fmt(credito.saldo_capital)}`} mono accent />
          <FieldItem label="Fecha Cancelación" value={formatDate(credito.fecha_cancelacion)} />
        </FieldGrid>
      </DetailSection>

      <DetailSection title="Descuentos al Desembolso">
        <FieldGrid cols={3}>
          <FieldItem label="FPS" value={`S/ ${fmt(credito.descuento_fps)}`} mono />
          <FieldItem label="Seguro" value={`S/ ${fmt(credito.descuento_seguro)}`} mono />
          <FieldItem label="Otros" value={`S/ ${fmt(credito.descuento_otros)}`} mono />
        </FieldGrid>
      </DetailSection>

      {/* Historial de Ampliaciones — no tocar lógica */}
      <AmpliacionesSection
        creditoId={id}
        nroPagareActual={credito.nro_pagare}
        montoAprobado={credito.monto_aprobado}
        saldoCapital={credito.saldo_capital}
        plazoMeses={credito.plazo_meses}
        tasaInteres={credito.tasa_interes}
        cuotaMensual={credito.cuota_mensual}
        onCreditoUpdated={() => setRefreshKey(k => k + 1)}
      />

      {/* Cronograma de cuotas */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-4">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Cronograma de Cuotas</h2>
          <div className="flex gap-3 text-xs text-slate-500">
            <span>Pagadas: <span className="font-semibold text-green-700">{cuotasPagadas}</span></span>
            <span>Vencidas: <span className="font-semibold text-red-700">{cuotasVencidas}</span></span>
            <span>Total: <span className="font-semibold text-slate-700">{cuotas.length}</span></span>
          </div>
        </div>
        {cuotas.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">Sin cronograma generado</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Nº', 'Vencimiento', 'Capital', 'Interés', 'Cuota Total', 'Cap. Pagado', 'Int. Pagado', 'Estado'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cuotas.map(c => (
                  <tr
                    key={c.id}
                    className={`border-b border-slate-100 last:border-0 transition-colors ${
                      c.estado === 'vencida' ? 'bg-red-50/40' : c.estado === 'pagada' ? 'bg-green-50/30' : 'hover:bg-slate-50/50'
                    }`}
                  >
                    <td className="px-4 py-2.5 font-medium text-slate-700">{c.nro_cuota}</td>
                    <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{formatDate(c.fecha_vencimiento)}</td>
                    <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap tabular-nums">{fmt(c.capital)}</td>
                    <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap tabular-nums">{fmt(c.interes)}</td>
                    <td className="px-4 py-2.5 font-semibold text-slate-900 whitespace-nowrap tabular-nums">{fmt(c.cuota_total)}</td>
                    <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap tabular-nums">{fmt(c.capital_pagado)}</td>
                    <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap tabular-nums">{fmt(c.interes_pagado)}</td>
                    <td className="px-4 py-2.5"><CuotaBadge estado={c.estado} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageFrame>
  )
}
