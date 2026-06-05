'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

type PagoRow = {
  id: number
  id_convenio: number | null
  monto_aporte: number
  monto_capital: number
  monto_interes: number
  monto_fps: number
  monto_fps_extra: number
  monto_otros: number
  monto_total: number
  convenios: { id: number; nombre: string } | null
}

type ConvenioResumen = {
  id: number
  nombre: string
  nPagos: number
  total: number
  capital: number
  interes: number
  aporte: number
  fps: number
}

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function fmt(n: number) {
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function buildYearOptions() {
  const y = new Date().getFullYear()
  return Array.from({ length: 5 }, (_, i) => y - i)
}

export default function ConveniosPage() {
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [anio, setAnio] = useState(now.getFullYear())
  const [applied, setApplied] = useState({ mes: now.getMonth() + 1, anio: now.getFullYear() })
  const [pagos, setPagos] = useState<PagoRow[]>([])
  const [loading, setLoading] = useState(true)

  const yearOptions = useMemo(() => buildYearOptions(), [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const periodo = `${applied.anio}-${String(applied.mes).padStart(2, '0')}`
    const { data } = await createClient()
      .from('pagos_recibos')
      .select('id, id_convenio, monto_aporte, monto_capital, monto_interes, monto_fps, monto_fps_extra, monto_otros, monto_total, convenios(id, nombre)')
      .eq('canal_pago', 'convenio')
      .eq('periodo', periodo)
    setPagos((data as unknown as PagoRow[]) ?? [])
    setLoading(false)
  }, [applied])

  useEffect(() => { fetchData() }, [fetchData])

  const resumen = useMemo<ConvenioResumen[]>(() => {
    const map = new Map<number, ConvenioResumen>()
    for (const p of pagos) {
      if (!p.id_convenio || !p.convenios) continue
      const key = p.id_convenio
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          nombre: p.convenios.nombre,
          nPagos: 0, total: 0, capital: 0, interes: 0, aporte: 0, fps: 0,
        })
      }
      const r = map.get(key)!
      r.nPagos++
      r.total   += p.monto_total   ?? 0
      r.capital += p.monto_capital ?? 0
      r.interes += p.monto_interes ?? 0
      r.aporte  += p.monto_aporte  ?? 0
      r.fps     += (p.monto_fps ?? 0) + (p.monto_fps_extra ?? 0)
    }
    return [...map.values()].sort((a, b) => b.total - a.total)
  }, [pagos])

  const totales = useMemo(() => resumen.reduce(
    (acc, r) => ({
      nPagos:  acc.nPagos  + r.nPagos,
      total:   acc.total   + r.total,
      capital: acc.capital + r.capital,
      interes: acc.interes + r.interes,
      aporte:  acc.aporte  + r.aporte,
      fps:     acc.fps     + r.fps,
    }),
    { nPagos: 0, total: 0, capital: 0, interes: 0, aporte: 0, fps: 0 }
  ), [resumen])

  const periodoLabel = `${MONTHS[applied.mes - 1]} ${applied.anio}`
  const mesPad = String(applied.mes).padStart(2, '0')

  return (
    <div className="p-8">
      {/* Encabezado */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Convenios</h1>
        <p className="text-sm text-gray-400 mt-1">Pagos por descuento de planilla</p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={mes}
          onChange={e => setMes(Number(e.target.value))}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent"
        >
          {MONTHS.map((m, i) => (
            <option key={i + 1} value={i + 1}>{m}</option>
          ))}
        </select>
        <select
          value={anio}
          onChange={e => setAnio(Number(e.target.value))}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent"
        >
          {yearOptions.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <button
          onClick={() => setApplied({ mes, anio })}
          className="px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#1e3a5f' }}
        >
          Buscar
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-sm text-gray-400">Cargando...</div>
      ) : resumen.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center text-sm text-gray-400">
          No hay pagos por convenio en {periodoLabel}
        </div>
      ) : (
        <>
          {/* Tarjetas por convenio */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {resumen.map(r => (
              <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="text-base font-bold text-gray-800">{r.nombre}</h2>
                    <p className="text-xs text-gray-400">{periodoLabel}</p>
                  </div>
                  <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-medium whitespace-nowrap">
                    {r.nPagos} {r.nPagos === 1 ? 'pago' : 'pagos'}
                  </span>
                </div>
                <p className="text-2xl font-bold mb-3" style={{ color: '#1e3a5f' }}>
                  S/ {fmt(r.total)}
                </p>
                <div className="space-y-1.5 text-xs text-gray-500 border-t border-gray-100 pt-3">
                  <div className="flex justify-between">
                    <span>Capital</span>
                    <span className="font-medium text-gray-700">S/ {fmt(r.capital)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Intereses</span>
                    <span className="font-medium text-gray-700">S/ {fmt(r.interes)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Aportes</span>
                    <span className="font-medium text-gray-700">S/ {fmt(r.aporte)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>FPS</span>
                    <span className="font-medium text-gray-700">S/ {fmt(r.fps)}</span>
                  </div>
                </div>
                <div className="mt-4">
                  <Link
                    href={`/dashboard/convenios/${r.id}?mes=${mesPad}&anio=${applied.anio}`}
                    className="block text-center px-3 py-2 rounded-lg text-white text-xs font-medium hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: '#1e3a5f' }}
                  >
                    Ver detalle →
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Tabla resumen */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">Resumen — {periodoLabel}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    {['Convenio', 'Pagos', 'Aportes', 'Capital', 'Intereses', 'FPS', 'Total'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {resumen.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium">
                        <Link
                          href={`/dashboard/convenios/${r.id}?mes=${mesPad}&anio=${applied.anio}`}
                          className="hover:underline"
                          style={{ color: '#1e3a5f' }}
                        >
                          {r.nombre}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{r.nPagos}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">S/ {fmt(r.aporte)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">S/ {fmt(r.capital)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">S/ {fmt(r.interes)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">S/ {fmt(r.fps)}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 whitespace-nowrap">S/ {fmt(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td className="px-4 py-3 text-sm font-bold text-gray-800">TOTAL GENERAL</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-800">{totales.nPagos}</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-800 whitespace-nowrap">S/ {fmt(totales.aporte)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-800 whitespace-nowrap">S/ {fmt(totales.capital)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-800 whitespace-nowrap">S/ {fmt(totales.interes)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-800 whitespace-nowrap">S/ {fmt(totales.fps)}</td>
                    <td className="px-4 py-3 text-sm font-bold whitespace-nowrap" style={{ color: '#1e3a5f' }}>S/ {fmt(totales.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
