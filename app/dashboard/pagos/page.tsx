'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { generarReciboPDF } from './utils/generarReciboPDF'
import { FileText } from 'lucide-react'

type PagoRecibo = {
  id: string
  nro_recibo: string
  fecha: string
  periodo: string
  canal_pago: string
  monto_total: number
  estado_flujo: string
  socios: { apellidos: string; nombres: string } | null
  creditos: { nro_pagare: string } | null
}

const ESTADO_MAP: Record<string, { bg: string; text: string; label: string }> = {
  registrado:    { bg: 'bg-blue-100',   text: 'text-blue-800',   label: 'Registrado' },
  en_correccion: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'En Corrección' },
  validado:      { bg: 'bg-green-100',  text: 'text-green-800',  label: 'Validado' },
  cerrado:       { bg: 'bg-gray-100',   text: 'text-gray-600',   label: 'Cerrado' },
}

function EstadoBadge({ estado }: { estado: string }) {
  const s = ESTADO_MAP[estado] ?? ESTADO_MAP.registrado
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  )
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function formatDate(d: string) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

// Build list of YYYY-MM options for last 24 months
function buildPeriodOptions() {
  const options: string[] = []
  const now = new Date()
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    options.push(`${y}-${m}`)
  }
  return options
}

export default function PagosPage() {
  const [pagos, setPagos] = useState<PagoRecibo[]>([])
  const [loading, setLoading] = useState(true)
  const [filterPeriodo, setFilterPeriodo] = useState('')
  const [filterCanal, setFilterCanal] = useState('')
  const [filterEstado, setFilterEstado] = useState('')
  const [generandoPDF, setGenerandoPDF] = useState<string | null>(null)

  async function handlePDF(pagoId: string) {
    setGenerandoPDF(pagoId)
    try {
      await generarReciboPDF(pagoId)
    } catch (err) {
      alert(`Error al generar PDF: ${err instanceof Error ? err.message : 'Error desconocido'}`)
    } finally {
      setGenerandoPDF(null)
    }
  }

  const periodOptions = useMemo(() => buildPeriodOptions(), [])

  useEffect(() => {
    createClient()
      .from('pagos_recibos')
      .select('id, nro_recibo, fecha, periodo, canal_pago, monto_total, estado_flujo, socios(apellidos, nombres), creditos(nro_pagare)')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setPagos(data as unknown as PagoRecibo[])
        setLoading(false)
      })
  }, [])

  const filtered = useMemo(() => {
    return pagos.filter(p => {
      if (filterPeriodo && p.periodo !== filterPeriodo) return false
      if (filterCanal && p.canal_pago !== filterCanal) return false
      if (filterEstado && p.estado_flujo !== filterEstado) return false
      return true
    })
  }, [pagos, filterPeriodo, filterCanal, filterEstado])

  const totalPeriodo = useMemo(
    () => filtered.reduce((sum, p) => sum + (p.monto_total ?? 0), 0),
    [filtered]
  )

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Pagos / Recibos</h1>
        <Link
          href="/dashboard/pagos/nuevo"
          className="px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#1e3a5f' }}
        >
          + Registrar Pago
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-5">
        <select
          value={filterPeriodo}
          onChange={e => setFilterPeriodo(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent"
        >
          <option value="">Todos los periodos</option>
          {periodOptions.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <select
          value={filterCanal}
          onChange={e => setFilterCanal(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent"
        >
          <option value="">Todos los canales</option>
          <option value="convenio">Convenio</option>
          <option value="caja">Caja</option>
        </select>

        <select
          value={filterEstado}
          onChange={e => setFilterEstado(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent"
        >
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_MAP).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>

        {(filterPeriodo || filterCanal || filterEstado) && (
          <button
            onClick={() => { setFilterPeriodo(''); setFilterCanal(''); setFilterEstado('') }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-colors"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Cargando pagos...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">No se encontraron pagos</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['Nº Recibo', 'Fecha', 'Socio', 'Crédito', 'Canal', 'Total', 'Estado', 'Acciones'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{p.nro_recibo}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatDate(p.fecha)}</td>
                    <td className="px-4 py-3 text-sm text-gray-800">
                      {p.socios ? `${p.socios.apellidos}, ${p.socios.nombres}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                      {p.creditos?.nro_pagare ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap capitalize">
                      {p.canal_pago}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 whitespace-nowrap">
                      S/ {fmt(p.monto_total)}
                    </td>
                    <td className="px-4 py-3">
                      <EstadoBadge estado={p.estado_flujo} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Link
                          href={`/dashboard/pagos/${p.id}`}
                          className="px-3 py-1 text-xs font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          Ver
                        </Link>
                        <button
                          onClick={() => handlePDF(p.id)}
                          disabled={generandoPDF === p.id}
                          className="px-3 py-1 text-xs font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {generandoPDF === p.id ? 'Generando...' : <span className="flex items-center gap-1"><FileText size={12}/>PDF</span>}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-gray-400">
            {filtered.length} {filtered.length === 1 ? 'pago' : 'pagos'}
          </p>
          <p className="text-sm font-semibold text-gray-700">
            Total del período:{' '}
            <span style={{ color: '#1e3a5f' }}>S/ {fmt(totalPeriodo)}</span>
          </p>
        </div>
      )}
    </div>
  )
}
