'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

type Aporte = {
  id: number
  fecha: string
  monto: number
  saldo_nuevo: number
  id_recibo: number | null
  socios: {
    nombres: string
    apellidos: string
    dni: string
  } | null
  pagos_recibos: {
    nro_recibo: string
  } | null
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function formatDate(d: string) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function nowYM() {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

function buildYearOptions() {
  const current = new Date().getFullYear()
  return Array.from({ length: 5 }, (_, i) => current - i)
}

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export default function AportesPage() {
  const { year: currentYear, month: currentMonth } = nowYM()

  const [aportes, setAportes] = useState<Aporte[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [mesFilter, setMesFilter] = useState(currentMonth)
  const [anioFilter, setAnioFilter] = useState(currentYear)
  const [applied, setApplied] = useState({ mes: currentMonth, anio: currentYear, texto: '' })

  const yearOptions = useMemo(() => buildYearOptions(), [])

  const fetchAportes = useCallback(async () => {
    setLoading(true)
    const mesStr = String(applied.mes).padStart(2, '0')
    const dateFrom = `${applied.anio}-${mesStr}-01`
    const lastDay = new Date(applied.anio, applied.mes, 0).getDate()
    const dateTo = `${applied.anio}-${mesStr}-${String(lastDay).padStart(2, '0')}`

    let query = createClient()
      .from('aportes')
      .select('id, fecha, monto, saldo_nuevo, id_recibo, socios(nombres, apellidos, dni), pagos_recibos(nro_recibo)')
      .gte('fecha', dateFrom)
      .lte('fecha', dateTo)
      .order('fecha', { ascending: false })

    const { data } = await query
    setAportes((data as unknown as Aporte[]) ?? [])
    setLoading(false)
  }, [applied])

  useEffect(() => { fetchAportes() }, [fetchAportes])

  function handleBuscar() {
    setApplied({ mes: mesFilter, anio: anioFilter, texto: busqueda.trim() })
  }

  const filtered = useMemo(() => {
    if (!applied.texto) return aportes
    const q = applied.texto.toLowerCase()
    return aportes.filter(a => {
      if (!a.socios) return false
      const nombre = `${a.socios.nombres} ${a.socios.apellidos}`.toLowerCase()
      const dni = a.socios.dni?.toLowerCase() ?? ''
      return nombre.includes(q) || dni.includes(q)
    })
  }, [aportes, applied.texto])

  // Tarjetas resumen
  const totalMes = useMemo(() => aportes.reduce((s, a) => s + (a.monto ?? 0), 0), [aportes])

  const totalAnio = useMemo(async () => 0, []) // se calcula abajo
  const [sumaAnio, setSumaAnio] = useState<number | null>(null)
  const [sociosMes, setSociosMes] = useState<number | null>(null)

  useEffect(() => {
    const mesStr = String(applied.mes).padStart(2, '0')
    const dateFrom = `${applied.anio}-${mesStr}-01`
    const lastDay = new Date(applied.anio, applied.mes, 0).getDate()
    const dateTo = `${applied.anio}-${mesStr}-${String(lastDay).padStart(2, '0')}`

    // socios distintos del mes
    createClient()
      .from('aportes')
      .select('id_socio')
      .gte('fecha', dateFrom)
      .lte('fecha', dateTo)
      .then(({ data }) => {
        if (data) {
          const uniq = new Set(data.map((r: { id_socio: number }) => r.id_socio))
          setSociosMes(uniq.size)
        }
      })

    // total del año
    createClient()
      .from('aportes')
      .select('monto')
      .gte('fecha', `${applied.anio}-01-01`)
      .lte('fecha', `${applied.anio}-12-31`)
      .then(({ data }) => {
        if (data) setSumaAnio(data.reduce((s: number, r: { monto: number }) => s + (r.monto ?? 0), 0))
      })
  }, [applied.anio, applied.mes])

  return (
    <div className="p-8">
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Aportes</h1>
        <Link
          href="/dashboard/aportes/nuevo"
          className="px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#1e3a5f' }}
        >
          + Nuevo Aporte
        </Link>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total aportes del mes</p>
          <p className="text-2xl font-bold" style={{ color: '#1e3a5f' }}>S/ {fmt(totalMes)}</p>
          <p className="text-xs text-gray-400 mt-1">{MONTHS[applied.mes - 1]} {applied.anio}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total aportes del año</p>
          <p className="text-2xl font-bold" style={{ color: '#1e3a5f' }}>
            {sumaAnio === null ? '...' : `S/ ${fmt(sumaAnio)}`}
          </p>
          <p className="text-xs text-gray-400 mt-1">Año {applied.anio}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Socios con aportes este mes</p>
          <p className="text-2xl font-bold" style={{ color: '#1e3a5f' }}>
            {sociosMes === null ? '...' : sociosMes}
          </p>
          <p className="text-xs text-gray-400 mt-1">{MONTHS[applied.mes - 1]} {applied.anio}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleBuscar()}
          placeholder="Buscar por nombre o DNI..."
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent w-64"
        />
        <select
          value={mesFilter}
          onChange={e => setMesFilter(Number(e.target.value))}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent"
        >
          {MONTHS.map((m, i) => (
            <option key={i + 1} value={i + 1}>{m}</option>
          ))}
        </select>
        <select
          value={anioFilter}
          onChange={e => setAnioFilter(Number(e.target.value))}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent"
        >
          {yearOptions.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <button
          onClick={handleBuscar}
          className="px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#1e3a5f' }}
        >
          Buscar
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Cargando aportes...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">No se encontraron aportes</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['Socio', 'DNI', 'Fecha', 'Monto', 'Saldo Acumulado', 'Recibo', 'Acciones'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {a.socios ? `${a.socios.apellidos}, ${a.socios.nombres}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {a.socios?.dni ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {formatDate(a.fecha)}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 whitespace-nowrap">
                      S/ {fmt(a.monto)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                      S/ {fmt(a.saldo_nuevo)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {a.pagos_recibos?.nro_recibo ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/aportes/${a.id}`}
                        className="px-3 py-1 text-xs font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <p className="text-xs text-gray-400 mt-3">
          {filtered.length} {filtered.length === 1 ? 'aporte' : 'aportes'}
        </p>
      )}
    </div>
  )
}
