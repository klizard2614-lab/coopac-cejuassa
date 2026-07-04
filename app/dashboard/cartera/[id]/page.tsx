'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { formatNombrePersona } from '@/lib/formatNombre'
import { PageFrame, DetailHero, DetailSection, FieldGrid, FieldItem, btnGhost } from '../../_components/ui'

// ─── tipos ────────────────────────────────────────────────────────────────────

type Credito = {
  id: number
  nro_pagare: string
  fecha_desembolso: string
  monto_aprobado: number
  monto_girado_neto: number
  tasa_interes: number
  plazo_meses: number
  cuota_mensual: number
  tipo_credito: string
  saldo_capital: number
  interes_acumulado: number
  socios: {
    nombres: string
    apellidos: string
    dni: string
    nro_socio: string
    convenios: { nombre: string } | null
  } | null
}

type Cuota = {
  id: number
  nro_cuota: number
  fecha_vencimiento: string
  capital: number
  interes: number
  cuota_total: number
  capital_pagado: number
  interes_pagado: number
  estado: string
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function diasEntre(fechaStr: string, hoy: Date): number {
  const fecha = new Date(fechaStr + 'T00:00:00')
  const diff = hoy.getTime() - fecha.getTime()
  return Math.floor(diff / 86400000)
}

function getClasificacion(dias_mora: number): string {
  if (dias_mora <= 8)   return 'Normal'
  if (dias_mora <= 30)  return 'CPP'
  if (dias_mora <= 60)  return 'Deficiente'
  if (dias_mora <= 120) return 'Dudoso'
  return 'Pérdida'
}

function getTasaProvision(clasificacion: string): number {
  switch (clasificacion) {
    case 'Normal':      return 0.01
    case 'CPP':         return 0.05
    case 'Deficiente':  return 0.25
    case 'Dudoso':      return 0.60
    case 'Pérdida':     return 1.00
    default:            return 0.01
  }
}

const COLORES: Record<string, { bg: string; text: string }> = {
  Normal:     { bg: 'bg-green-100',  text: 'text-green-800' },
  CPP:        { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  Deficiente: { bg: 'bg-orange-100', text: 'text-orange-800' },
  Dudoso:     { bg: 'bg-red-100',    text: 'text-red-700' },
  Pérdida:    { bg: 'bg-red-200',    text: 'text-red-900' },
}

const ESTADO_CUOTA: Record<string, { bg: string; text: string; label: string }> = {
  pendiente: { bg: 'bg-gray-100',   text: 'text-gray-600',   label: 'Pendiente' },
  pagada:    { bg: 'bg-green-100',  text: 'text-green-800',  label: 'Pagada' },
  vencida:   { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Vencida' },
  parcial:   { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Parcial' },
}

function ClasifBadge({ c }: { c: string }) {
  const col = COLORES[c] ?? COLORES['Normal']
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${col.bg} ${col.text}`}>
      {c}
    </span>
  )
}

function EstadoBadge({ e }: { e: string }) {
  const col = ESTADO_CUOTA[e] ?? ESTADO_CUOTA['pendiente']
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${col.bg} ${col.text}`}>
      {col.label}
    </span>
  )
}

function fmt(n: number | null | undefined) {
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function formatDate(d: string) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}


// ─── componente ───────────────────────────────────────────────────────────────

export default function CarteraDetallePage() {
  const { id } = useParams() as { id: string }

  const [credito, setCredito] = useState<Credito | null>(null)
  const [cuotas, setCuotas] = useState<Cuota[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Métricas calculadas
  const [diasMora, setDiasMora] = useState(0)
  const [clasificacion, setClasificacion] = useState('Normal')
  const [tasaProvision, setTasaProvision] = useState(0.01)
  const [provisionRequerida, setProvisionRequerida] = useState(0)

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb
        .from('creditos')
        .select(`
          id, nro_pagare, fecha_desembolso, monto_aprobado, monto_girado_neto,
          tasa_interes, plazo_meses, cuota_mensual, tipo_credito, saldo_capital, interes_acumulado,
          socios(nombres, apellidos, dni, nro_socio, convenios(nombre))
        `)
        .eq('id', id)
        .single(),
      sb
        .from('cronograma_cuotas')
        .select('id, nro_cuota, fecha_vencimiento, capital, interes, cuota_total, capital_pagado, interes_pagado, estado')
        .eq('id_credito', id)
        .order('nro_cuota'),
    ]).then(([credRes, cuotasRes]) => {
      if (!credRes.data) {
        setNotFound(true)
        setLoading(false)
        return
      }

      const cred = credRes.data as unknown as Credito
      const cuotasData = (cuotasRes.data as Cuota[]) ?? []

      setCredito(cred)
      setCuotas(cuotasData)

      // Calcular mora
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)

      const pendientes = cuotasData.filter(cu =>
        cu.estado === 'pendiente' || cu.estado === 'vencida' || cu.estado === 'parcial'
      )

      let dias = 0
      if (pendientes.length > 0) {
        const minFecha = pendientes.reduce((min, cu) =>
          cu.fecha_vencimiento < min ? cu.fecha_vencimiento : min,
          pendientes[0].fecha_vencimiento
        )
        dias = Math.max(0, diasEntre(minFecha, hoy))
      }

      const clasif = getClasificacion(dias)
      const tasa = getTasaProvision(clasif)
      const provision = (cred.saldo_capital ?? 0) * tasa

      setDiasMora(dias)
      setClasificacion(clasif)
      setTasaProvision(tasa)
      setProvisionRequerida(provision)
      setLoading(false)
    })
  }, [id])

  if (loading) return <div className="min-h-full bg-slate-50 p-8 text-sm text-slate-400">Cargando...</div>
  if (notFound || !credito) {
    return (
      <PageFrame>
        <p className="text-sm text-slate-500">Crédito no encontrado.</p>
        <Link href="/dashboard/cartera" className={`${btnGhost} mt-2 inline-flex`}>Volver a Cartera</Link>
      </PageFrame>
    )
  }

  const nombreCompleto = credito.socios
    ? formatNombrePersona(credito.socios.apellidos, credito.socios.nombres)
    : '—'

  const cuotasPendientes = cuotas.filter(c => c.estado === 'pendiente' || c.estado === 'parcial' || c.estado === 'vencida')

  return (
    <PageFrame>
      <Link href="/dashboard/cartera" className={`${btnGhost} mb-4 inline-flex`}>← Volver a Cartera</Link>

      <DetailHero
        title={nombreCompleto}
        subtitle={`DNI: ${credito.socios?.dni ?? '—'} · Nº Socio: ${credito.socios?.nro_socio ?? '—'}`}
        badge={<ClasifBadge c={clasificacion} />}
      />

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Saldo Capital',      value: `S/ ${fmt(credito.saldo_capital)}` },
          { label: 'Días de Mora',       value: `${diasMora} días`, danger: diasMora > 0 },
          { label: 'Provisión Requerida',value: `S/ ${fmt(provisionRequerida)}` },
          { label: 'Cuotas Pendientes',  value: String(cuotasPendientes.length) },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">{card.label}</p>
            <p className={`text-lg font-bold tabular-nums ${card.danger ? 'text-red-600' : 'text-slate-800'}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <DetailSection title="Datos del Crédito">
        <FieldGrid cols={4}>
          <FieldItem label="Nº Pagaré" value={credito.nro_pagare} accent />
          <FieldItem label="Fecha Desembolso" value={formatDate(credito.fecha_desembolso)} />
          <FieldItem label="Tipo de Crédito" value={credito.tipo_credito ?? undefined} />
          <FieldItem label="Convenio" value={credito.socios?.convenios?.nombre ?? undefined} />
          <FieldItem label="Monto Aprobado" value={`S/ ${fmt(credito.monto_aprobado)}`} mono />
          <FieldItem label="Monto Girado Neto" value={`S/ ${fmt(credito.monto_girado_neto)}`} mono />
          <FieldItem label="Tasa TEA" value={`${fmt(credito.tasa_interes)}%`} mono />
          <FieldItem label="Plazo" value={`${credito.plazo_meses} meses`} />
          <FieldItem label="Cuota Mensual" value={`S/ ${fmt(credito.cuota_mensual)}`} mono />
        </FieldGrid>
      </DetailSection>

      <DetailSection title="Estado de Cartera">
        <FieldGrid cols={4}>
          <FieldItem label="Saldo Capital" value={`S/ ${fmt(credito.saldo_capital)}`} mono accent />
          <FieldItem label="Días de Mora" value={`${diasMora} días`} mono />
          <FieldItem label="Clasificación" value={<ClasifBadge c={clasificacion} />} />
          <FieldItem label="Tasa de Provisión" value={`${(tasaProvision * 100).toFixed(0)}%`} mono />
          <FieldItem label="Provisión Requerida" value={`S/ ${fmt(provisionRequerida)}`} mono />
          <FieldItem label="Provisión Constituida" value={`S/ ${fmt(provisionRequerida)}`} mono />
        </FieldGrid>
      </DetailSection>

      {/* Cronograma de cuotas */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-4">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Cronograma de Cuotas</h2>
          {cuotasPendientes.length > 0 && (
            <span className="text-xs text-slate-500">
              {cuotasPendientes.length} {cuotasPendientes.length === 1 ? 'cuota pendiente' : 'cuotas pendientes'}
            </span>
          )}
        </div>

        {cuotas.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">No hay cuotas registradas</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['N°', 'Vencimiento', 'Capital', 'Interés', 'Total', 'Capital Pagado', 'Estado'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cuotas.map(cu => {
                  const esVencida = cu.estado === 'vencida'
                  return (
                    <tr
                      key={cu.id}
                      className={`border-b border-slate-100 last:border-0 transition-colors ${
                        esVencida ? 'bg-red-50/40' : cu.estado === 'pagada' ? 'bg-green-50/30' : 'hover:bg-slate-50/50'
                      }`}
                    >
                      <td className="px-4 py-2.5 font-medium text-slate-700">{cu.nro_cuota}</td>
                      <td className={`px-4 py-2.5 whitespace-nowrap ${esVencida ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
                        {formatDate(cu.fecha_vencimiento)}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap tabular-nums">S/ {fmt(cu.capital)}</td>
                      <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap tabular-nums">S/ {fmt(cu.interes)}</td>
                      <td className="px-4 py-2.5 font-semibold text-slate-900 whitespace-nowrap tabular-nums">S/ {fmt(cu.cuota_total)}</td>
                      <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap tabular-nums">S/ {fmt(cu.capital_pagado)}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <EstadoBadge e={cu.estado} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageFrame>
  )
}
