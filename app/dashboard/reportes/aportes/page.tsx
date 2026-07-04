'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

type TipoAporte = 'aporte' | 'retiro_parcial' | 'retiro_total'

type AporteRow = {
  id: number
  fecha: string
  tipo: TipoAporte
  monto: number
  saldo_anterior: number
  saldo_nuevo: number
  observacion: string | null
  socios: {
    nro_socio: string
    apellidos: string
    nombres: string
  } | null
}

function observacionVisible(obs: string | null): string {
  if (!obs) return ''
  return /^importado desde/i.test(obs.trim()) ? '' : obs
}

const TIPO_LABELS: Record<TipoAporte, string> = {
  aporte: 'Aporte',
  retiro_parcial: 'Retiro Parcial',
  retiro_total: 'Retiro Total',
}

const TIPO_COLORS: Record<TipoAporte, string> = {
  aporte: 'bg-green-100 text-green-700',
  retiro_parcial: 'bg-yellow-100 text-yellow-700',
  retiro_total: 'bg-red-100 text-red-700',
}

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

function buildYearOptions() {
  const y = new Date().getFullYear()
  return [y, y - 1, y - 2, y - 3]
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function formatDate(d: string) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

const inputCls =
  'px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white ' +
  'focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]'

export default function ReporteAportesPage() {
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [anio, setAnio] = useState(now.getFullYear())
  const [tipoFilter, setTipoFilter] = useState<TipoAporte | ''>('')
  const [busquedaSocio, setBusquedaSocio] = useState('')

  const [filas, setFilas] = useState<AporteRow[]>([])
  const [loading, setLoading] = useState(false)
  const [generado, setGenerado] = useState(false)

  const yearOptions = useMemo(() => buildYearOptions(), [])

  async function handleGenerar() {
    setLoading(true)
    setGenerado(false)
    setBusquedaSocio('')

    const sb = createClient()
    const mesStr = String(mes).padStart(2, '0')
    const lastDay = new Date(anio, mes, 0).getDate()
    const dateFrom = `${anio}-${mesStr}-01`
    const dateTo = `${anio}-${mesStr}-${String(lastDay).padStart(2, '0')}`

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = sb
      .from('aportes')
      .select('id, fecha, tipo, monto, saldo_anterior, saldo_nuevo, observacion, socios(nro_socio, apellidos, nombres)')
      .gte('fecha', dateFrom)
      .lte('fecha', dateTo)
      .order('fecha', { ascending: false })

    if (tipoFilter) query = query.eq('tipo', tipoFilter)

    const { data } = await query
    setFilas((data as AporteRow[]) ?? [])
    setGenerado(true)
    setLoading(false)
  }

  const filasFiltradas = useMemo(() => {
    if (!busquedaSocio.trim()) return filas
    const q = busquedaSocio.toLowerCase()
    return filas.filter(f => {
      if (!f.socios) return false
      const nombre = `${f.socios.apellidos} ${f.socios.nombres}`.toLowerCase()
      const nro = f.socios.nro_socio.toLowerCase()
      return nombre.includes(q) || nro.includes(q)
    })
  }, [filas, busquedaSocio])

  const totales = useMemo(() => {
    const totalAportes = filasFiltradas
      .filter(f => f.tipo === 'aporte')
      .reduce((s, f) => s + (f.monto ?? 0), 0)
    const totalRetiros = filasFiltradas
      .filter(f => f.tipo === 'retiro_parcial' || f.tipo === 'retiro_total')
      .reduce((s, f) => s + (f.monto ?? 0), 0)
    return { totalAportes, totalRetiros, cantidad: filasFiltradas.length }
  }, [filasFiltradas])

  async function handleExportar() {
    const { utils, writeFile } = await import('xlsx')

    const headers = [
      'Nro Socio',
      'Apellidos y Nombres',
      'Tipo',
      'Fecha',
      'Saldo Anterior (S/)',
      'Monto (S/)',
      'Saldo Nuevo (S/)',
      'Observación',
    ]

    const rows = filasFiltradas.map(f => [
      f.socios?.nro_socio ?? '',
      f.socios ? `${f.socios.apellidos}, ${f.socios.nombres}` : '',
      TIPO_LABELS[f.tipo],
      formatDate(f.fecha),
      f.saldo_anterior,
      f.monto,
      f.saldo_nuevo,
      observacionVisible(f.observacion),
    ])

    rows.push([] as unknown as (string | number)[])
    rows.push(['', 'TOTAL APORTES', '', '', '', totales.totalAportes, '', ''])
    rows.push(['', 'TOTAL RETIROS', '', '', '', totales.totalRetiros, '', ''])
    rows.push(['', 'TOTAL MOVIMIENTOS', '', '', '', totales.cantidad, '', ''])

    const ws = utils.aoa_to_sheet([headers, ...rows])
    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, 'ReporteAportes')

    const mesStr = String(mes).padStart(2, '0')
    writeFile(wb, `ReporteAportes_CEJUASSA_${mesStr}${anio}.xlsx`)
  }

  return (
    <div className="p-8">
      {/* Encabezado */}
      <div className="mb-6">
        <Link
          href="/dashboard/reportes"
          className="text-sm text-gray-400 hover:text-gray-600 mb-2 inline-block transition-colors"
        >
          ← Reportes
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Reporte de Aportes</h1>
            <p className="text-sm text-gray-500 mt-0.5">Movimientos de aportes y retiros por período</p>
          </div>
          <span
            className="px-3 py-1 rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: '#1e3a5f' }}
          >
            COOPAC CEJUASSA
          </span>
        </div>
      </div>

      {/* Controles / Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <p className="text-sm font-medium text-gray-600 mb-3">Período y filtros</p>
        <div className="flex flex-wrap gap-3 items-center">
          <select
            value={mes}
            onChange={e => setMes(Number(e.target.value))}
            className={inputCls}
          >
            {MESES.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={anio}
            onChange={e => setAnio(Number(e.target.value))}
            className={inputCls}
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select
            value={tipoFilter}
            onChange={e => setTipoFilter(e.target.value as TipoAporte | '')}
            className={inputCls}
          >
            <option value="">Todos los tipos</option>
            <option value="aporte">Aporte</option>
            <option value="retiro_parcial">Retiro Parcial</option>
            <option value="retiro_total">Retiro Total</option>
          </select>
          <button
            onClick={handleGenerar}
            disabled={loading}
            className="px-5 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: '#1e3a5f' }}
          >
            {loading ? 'Generando...' : 'Generar Reporte'}
          </button>
          {generado && filasFiltradas.length > 0 && (
            <button
              onClick={handleExportar}
              className="px-5 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <span>⬇</span> Exportar Excel
            </button>
          )}
        </div>

        {/* Búsqueda por socio — aparece luego de generar */}
        {generado && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <input
              value={busquedaSocio}
              onChange={e => setBusquedaSocio(e.target.value)}
              placeholder="Filtrar por nombre o Nro Socio..."
              className={inputCls + ' w-72'}
            />
          </div>
        )}
      </div>

      {/* Contenido del reporte */}
      {generado && (
        <>
          {/* Tarjetas resumen */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total aportes del período</p>
              <p className="text-xl font-bold text-green-700">S/ {fmt(totales.totalAportes)}</p>
              <p className="text-xs text-gray-400 mt-1">{MESES[mes - 1]} {anio}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total retiros del período</p>
              <p className="text-xl font-bold text-red-600">S/ {fmt(totales.totalRetiros)}</p>
              <p className="text-xs text-gray-400 mt-1">{MESES[mes - 1]} {anio}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total movimientos</p>
              <p className="text-xl font-bold" style={{ color: '#1e3a5f' }}>{totales.cantidad}</p>
              <p className="text-xs text-gray-400 mt-1">{MESES[mes - 1]} {anio}</p>
            </div>
          </div>

          {filasFiltradas.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-16 text-center text-sm text-gray-400">
              No hay movimientos para el período y filtros seleccionados.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-600">
                  {filasFiltradas.length} {filasFiltradas.length === 1 ? 'registro' : 'registros'} — {MESES[mes - 1]} {anio}
                  {busquedaSocio && ` · filtrado por "${busquedaSocio}"`}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      {['Nro Socio', 'Apellidos y Nombres', 'Tipo', 'Fecha', 'Saldo Anterior', 'Monto', 'Saldo Nuevo', 'Observación'].map(h => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filasFiltradas.map(f => (
                      <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap font-mono">
                          {f.socios?.nro_socio ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                          {f.socios ? `${f.socios.apellidos}, ${f.socios.nombres}` : '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TIPO_COLORS[f.tipo]}`}>
                            {TIPO_LABELS[f.tipo]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {formatDate(f.fecha)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                          S/ {fmt(f.saldo_anterior)}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900 whitespace-nowrap">
                          S/ {fmt(f.monto)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                          S/ {fmt(f.saldo_nuevo)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 max-w-[180px]">
                          <span className="block truncate" title={observacionVisible(f.observacion)}>
                            {observacionVisible(f.observacion) || '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
