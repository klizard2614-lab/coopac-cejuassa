'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { formatNombrePersona } from '@/lib/formatNombre'
import { PageFrame, PageToolbar, FilterBar, DataTableShell, DataTableHeader, DataTableEmpty, RecordMeta, DetailHero, btnGhost, inputCls } from '../../_components/ui'

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

  if (loading) return <div className="min-h-full bg-slate-50 p-8 text-sm text-slate-400">Cargando...</div>

  return (
    <PageFrame>
      <Link href="/dashboard/convenios" className={`${btnGhost} mb-4 inline-flex`}>← Volver</Link>

      <DetailHero
        title={convenio?.nombre ?? '—'}
        subtitle={`Pagos de ${periodoLabel}`}
      />

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Total recaudado',    value: `S/ ${fmt(stats.total)}` },
          { label: 'N° de socios',       value: String(stats.nSocios) },
          { label: 'N° de pagos',        value: String(stats.nPagos) },
          { label: 'Promedio por socio', value: `S/ ${fmt(stats.promedio)}` },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">{c.label}</p>
            <p className="text-lg font-bold text-slate-800 tabular-nums">{c.value}</p>
          </div>
        ))}
      </div>

      {pagos.length === 0 ? (
        <DataTableShell>
          <table className="w-full">
            <tbody>
              <DataTableEmpty cols={1} message={`No hay pagos para este convenio en ${periodoLabel}`} />
            </tbody>
          </table>
        </DataTableShell>
      ) : (
        <>
          <FilterBar>
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o DNI..."
              className={`${inputCls} w-72`}
            />
          </FilterBar>

          <DataTableShell>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <DataTableHeader>
                  <tr>
                    {['Socio', 'DNI', 'N° Recibo', 'Fecha', 'Aporte', 'Capital', 'Interés', 'FPS', 'Total', 'Acciones'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </DataTableHeader>
                <tbody>
                  {filtered.length === 0 ? (
                    <DataTableEmpty cols={10} message="No se encontraron resultados" />
                  ) : filtered.map(p => (
                    <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                        {p.socios ? formatNombrePersona(p.socios.apellidos, p.socios.nombres) : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{p.socios?.dni ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{p.nro_recibo}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(p.fecha)}</td>
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap tabular-nums">S/ {fmt(p.monto_aporte)}</td>
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap tabular-nums">S/ {fmt(p.monto_capital)}</td>
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap tabular-nums">S/ {fmt(p.monto_interes)}</td>
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap tabular-nums">S/ {fmt((p.monto_fps ?? 0) + (p.monto_fps_extra ?? 0))}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap tabular-nums">S/ {fmt(p.monto_total)}</td>
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/pagos/${p.id}`} className={btnGhost}>Ver recibo</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DataTableShell>

          {filtered.length > 0 && (
            <RecordMeta>{filtered.length} {filtered.length === 1 ? 'pago' : 'pagos'}</RecordMeta>
          )}
        </>
      )}
    </PageFrame>
  )
}

export default function ConvenioDetallePage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-400">Cargando...</div>}>
      <ConvenioDetalleInner />
    </Suspense>
  )
}
