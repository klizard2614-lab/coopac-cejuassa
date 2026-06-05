'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

type PagoDetalle = {
  id: number
  nro_recibo: string
  fecha: string
  monto_aporte: number
  monto_capital: number
  monto_interes: number
  monto_fps: number
  monto_fps_extra: number
  monto_total: number
  socios: {
    nombres: string
    apellidos: string
    dni: string
    nro_socio: string
  } | null
}

type ConvenioInfo = { id: number; nombre: string }

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function fmt(n: number | null | undefined) {
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function formatDate(d: string) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function ConvenioDetalleInner() {
  const { id } = useParams() as { id: string }
  const searchParams = useSearchParams()

  const now = new Date()
  const mes   = Number(searchParams.get('mes')  ?? now.getMonth() + 1)
  const anio  = Number(searchParams.get('anio') ?? now.getFullYear())

  const [convenio, setConvenio] = useState<ConvenioInfo | null>(null)
  const [pagos, setPagos]       = useState<PagoDetalle[]>([])
  const [loading, setLoading]   = useState(true)
  const [busqueda, setBusqueda] = useState('')

  const periodo     = `${anio}-${String(mes).padStart(2, '0')}`
  const periodoLabel = `${MONTHS[mes - 1]} ${anio}`

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from('convenios').select('id, nombre').eq('id', id).single(),
      sb
        .from('pagos_recibos')
        .select('id, nro_recibo, fecha, monto_aporte, monto_capital, monto_interes, monto_fps, monto_fps_extra, monto_total, socios(nombres, apellidos, dni, nro_socio)')
        .eq('id_convenio', id)
        .eq('canal_pago', 'convenio')
        .eq('periodo', periodo),
    ]).then(([cvRes, pagosRes]) => {
      if (cvRes.data) setConvenio(cvRes.data as ConvenioInfo)
      const sorted = ((pagosRes.data as unknown as PagoDetalle[]) ?? []).sort((a, b) =>
        (a.socios?.apellidos ?? '').localeCompare(b.socios?.apellidos ?? '', 'es')
      )
      setPagos(sorted)
      setLoading(false)
    })
  }, [id, periodo])

  const filtered = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return pagos
    return pagos.filter(p => {
      if (!p.socios) return false
      const nombre = `${p.socios.nombres} ${p.socios.apellidos}`.toLowerCase()
      return nombre.includes(q) || (p.socios.dni ?? '').toLowerCase().includes(q)
    })
  }, [pagos, busqueda])

  const stats = useMemo(() => {
    const total   = pagos.reduce((s, p) => s + (p.monto_total ?? 0), 0)
    const nSocios = new Set(pagos.map(p => p.socios?.dni).filter(Boolean)).size
    const nPagos  = pagos.length
    return { total, nSocios, nPagos, promedio: nSocios > 0 ? total / nSocios : 0 }
  }, [pagos])

  if (loading) return <div className="p-8 text-sm text-gray-400">Cargando...</div>

  return (
    <div className="p-8">
      {/* Encabezado */}
      <div className="mb-6">
        <Link
          href="/dashboard/convenios"
          className="text-sm text-gray-400 hover:text-gray-600 mb-1 inline-block transition-colors"
        >
          ← Volver
        </Link>
        <h1 className="text-2xl font-bold text-gray-800">{convenio?.nombre ?? '—'}</h1>
        <p className="text-sm text-gray-400 mt-1">Pagos de {periodoLabel}</p>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total recaudado',   value: `S/ ${fmt(stats.total)}` },
          { label: 'N° de socios',      value: String(stats.nSocios) },
          { label: 'N° de pagos',       value: String(stats.nPagos) },
          { label: 'Promedio por socio', value: `S/ ${fmt(stats.promedio)}` },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{c.label}</p>
            <p className="text-lg font-bold text-gray-800">{c.value}</p>
          </div>
        ))}
      </div>

      {pagos.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center text-sm text-gray-400">
          No hay pagos para este convenio en {periodoLabel}
        </div>
      ) : (
        <>
          {/* Buscador */}
          <div className="mb-4">
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o DNI..."
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent w-72"
            />
          </div>

          {/* Tabla */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    {['Socio', 'DNI', 'N° Recibo', 'Fecha', 'Aporte', 'Capital', 'Interés', 'FPS', 'Total', 'Acciones'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-10 text-center text-sm text-gray-400">
                        No se encontraron resultados
                      </td>
                    </tr>
                  ) : filtered.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                        {p.socios ? `${p.socios.apellidos}, ${p.socios.nombres}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {p.socios?.dni ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {p.nro_recibo}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {formatDate(p.fecha)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        S/ {fmt(p.monto_aporte)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        S/ {fmt(p.monto_capital)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        S/ {fmt(p.monto_interes)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        S/ {fmt((p.monto_fps ?? 0) + (p.monto_fps_extra ?? 0))}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 whitespace-nowrap">
                        S/ {fmt(p.monto_total)}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/pagos/${p.id}`}
                          className="px-3 py-1 text-xs font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          Ver recibo
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {filtered.length > 0 && (
            <p className="text-xs text-gray-400 mt-3">
              {filtered.length} {filtered.length === 1 ? 'pago' : 'pagos'}
            </p>
          )}
        </>
      )}
    </div>
  )
}

export default function ConvenioDetallePage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-400">Cargando...</div>}>
      <ConvenioDetalleInner />
    </Suspense>
  )
}
