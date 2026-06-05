'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

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

function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-800 text-right">{value}</span>
    </div>
  )
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

  if (loading) return <div className="p-8 text-sm text-gray-400">Cargando...</div>
  if (notFound || !credito) return <div className="p-8 text-sm text-gray-400">Crédito no encontrado.</div>

  const nombreCompleto = credito.socios
    ? `${credito.socios.apellidos}, ${credito.socios.nombres}`
    : '—'

  const cuotasPendientes = cuotas.filter(c => c.estado === 'pendiente' || c.estado === 'parcial' || c.estado === 'vencida')

  return (
    <div className="p-8 max-w-5xl">
      {/* Encabezado */}
      <div className="mb-6">
        <Link
          href="/dashboard/cartera"
          className="text-sm text-gray-400 hover:text-gray-600 mb-2 inline-block transition-colors"
        >
          ← Volver
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-800">{nombreCompleto}</h1>
          <ClasifBadge c={clasificacion} />
        </div>
        <p className="text-sm text-gray-500 mt-1">DNI: {credito.socios?.dni ?? '—'} · Nº Socio: {credito.socios?.nro_socio ?? '—'}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Datos del crédito */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-700 mb-3">Datos del crédito</h2>
          <DataRow label="Nº Pagaré" value={credito.nro_pagare} />
          <DataRow label="Fecha desembolso" value={formatDate(credito.fecha_desembolso)} />
          <DataRow label="Monto aprobado" value={`S/ ${fmt(credito.monto_aprobado)}`} />
          <DataRow label="Monto girado neto" value={`S/ ${fmt(credito.monto_girado_neto)}`} />
          <DataRow label="Tasa de interés anual" value={`${fmt(credito.tasa_interes)}%`} />
          <DataRow label="Plazo" value={`${credito.plazo_meses} meses`} />
          <DataRow label="Cuota mensual" value={`S/ ${fmt(credito.cuota_mensual)}`} />
          <DataRow label="Tipo de crédito" value={credito.tipo_credito ?? '—'} />
          <DataRow label="Convenio" value={credito.socios?.convenios?.nombre ?? '—'} />
        </div>

        {/* Estado actual */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-700 mb-3">Estado actual</h2>
          <DataRow label="Saldo capital actual" value={`S/ ${fmt(credito.saldo_capital)}`} />
          <DataRow
            label="Días de mora"
            value={
              <span className={diasMora > 0 ? 'text-red-600 font-semibold' : 'text-gray-800'}>
                {diasMora} días
              </span>
            }
          />
          <DataRow label="Clasificación" value={<ClasifBadge c={clasificacion} />} />
          <DataRow
            label="Tasa de provisión"
            value={`${(tasaProvision * 100).toFixed(0)}%`}
          />
          <DataRow label="Provisión requerida" value={`S/ ${fmt(provisionRequerida)}`} />
          <DataRow label="Provisión constituida" value={`S/ ${fmt(provisionRequerida)}`} />
          {cuotasPendientes.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                {cuotasPendientes.length} {cuotasPendientes.length === 1 ? 'cuota pendiente' : 'cuotas pendientes'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Cronograma de cuotas */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-700">Cronograma de cuotas</h2>
          {cuotasPendientes.length > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">
              {cuotasPendientes.length} {cuotasPendientes.length === 1 ? 'cuota pendiente' : 'cuotas pendientes'}
            </p>
          )}
        </div>

        {cuotas.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400">No hay cuotas registradas</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['N°', 'Vencimiento', 'Capital', 'Interés', 'Total', 'Capital Pagado', 'Estado'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cuotas.map(cu => {
                  const esVencida = cu.estado === 'vencida'
                  return (
                    <tr key={cu.id} className={`transition-colors ${esVencida ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}`}>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {cu.nro_cuota}
                      </td>
                      <td className={`px-4 py-3 text-sm whitespace-nowrap ${esVencida ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                        {formatDate(cu.fecha_vencimiento)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        S/ {fmt(cu.capital)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        S/ {fmt(cu.interes)}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 whitespace-nowrap">
                        S/ {fmt(cu.cuota_total)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        S/ {fmt(cu.capital_pagado)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
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
    </div>
  )
}
