'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { AlertTriangle } from 'lucide-react'

type Credito = {
  id: string
  nro_pagare: string
  monto_aprobado: number
  saldo_capital: number
  cuota_mensual: number
  estado: string
  socios: { apellidos: string; nombres: string; nro_socio: string } | null
}

type CuotaMin = {
  id_credito: number
  fecha_vencimiento: string
  estado: string
}

function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    vigente:      { bg: 'bg-green-100',  text: 'text-green-800',  label: 'Vigente' },
    cancelado:    { bg: 'bg-gray-100',   text: 'text-gray-600',   label: 'Cancelado' },
    castigado:    { bg: 'bg-red-100',    text: 'text-red-800',    label: 'Castigado' },
    refinanciado: { bg: 'bg-amber-100',  text: 'text-amber-800',  label: 'Refinanciado' },
  }
  const s = map[estado] ?? map.cancelado
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  )
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

export default function CreditosPage() {
  const [creditos, setCreditos] = useState<Credito[]>([])
  const [moraSet, setMoraSet] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterMora, setFilterMora] = useState(false)

  useEffect(() => {
    const sb = createClient()
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    Promise.all([
      sb.from('creditos')
        .select('id, nro_pagare, monto_aprobado, saldo_capital, cuota_mensual, estado, socios(apellidos, nombres, nro_socio)')
        .order('created_at', { ascending: false }),
      sb.from('cronograma_cuotas')
        .select('id_credito, fecha_vencimiento, estado')
        .in('estado', ['pendiente', 'vencida', 'parcial']),
    ]).then(([credRes, cuotasRes]) => {
      if (credRes.data) setCreditos(credRes.data as unknown as Credito[])

      const cuotas = (cuotasRes.data as CuotaMin[]) ?? []
      const set = new Set<string>()
      for (const cu of cuotas) {
        const enMora =
          cu.estado === 'vencida' ||
          (['pendiente', 'parcial'].includes(cu.estado) &&
            new Date(cu.fecha_vencimiento + 'T00:00:00') < hoy)
        if (enMora) set.add(String(cu.id_credito))
      }
      setMoraSet(set)
      setLoading(false)
    })
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return creditos.filter(c => {
      if (filterMora && !(moraSet.has(c.id) && c.estado === 'vigente')) return false
      if (!q) return true
      return (
        c.nro_pagare.toLowerCase().includes(q) ||
        (c.socios?.apellidos.toLowerCase().includes(q) ?? false) ||
        (c.socios?.nombres.toLowerCase().includes(q) ?? false)
      )
    })
  }, [creditos, search, filterMora, moraSet])

  const cantidadEnMora = useMemo(
    () => creditos.filter(c => moraSet.has(c.id) && c.estado === 'vigente').length,
    [creditos, moraSet]
  )

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Créditos</h1>
        <Link
          href="/dashboard/creditos/nuevo"
          className="px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#1e3a5f' }}
        >
          + Nuevo Crédito
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar por nombre del socio o Nº pagaré..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-sm px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent"
        />
        <button
          onClick={() => setFilterMora(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
            filterMora
              ? 'bg-red-100 border-red-300 text-red-700'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <AlertTriangle size={14} /> Solo en mora
          {!loading && cantidadEnMora > 0 && (
            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-semibold ${
              filterMora ? 'bg-red-200 text-red-800' : 'bg-red-100 text-red-700'
            }`}>
              {cantidadEnMora}
            </span>
          )}
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Cargando créditos...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">No se encontraron créditos</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['Nº Pagaré', 'Socio', 'Monto Aprobado', 'Saldo Capital', 'Cuota Mensual', 'Estado', 'Acciones'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(c => {
                  const enMora = moraSet.has(c.id) && c.estado === 'vigente'
                  return (
                    <tr key={c.id} className={`transition-colors ${enMora ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}`}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{c.nro_pagare}</td>
                      <td className="px-4 py-3 text-sm text-gray-800">
                        {c.socios ? `${c.socios.apellidos}, ${c.socios.nombres}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">S/ {fmt(c.monto_aprobado)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">S/ {fmt(c.saldo_capital)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">S/ {fmt(c.cuota_mensual)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <EstadoBadge estado={c.estado} />
                          {enMora && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                              EN MORA
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Link
                            href={`/dashboard/creditos/${c.id}`}
                            className="px-3 py-1 text-xs font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            Ver
                          </Link>
                          <Link
                            href={`/dashboard/creditos/${c.id}/editar`}
                            className="px-3 py-1 text-xs font-medium rounded-md text-white hover:opacity-90 transition-opacity"
                            style={{ backgroundColor: '#1e3a5f' }}
                          >
                            Editar
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <p className="text-xs text-gray-400 mt-3">
          {filtered.length} {filtered.length === 1 ? 'crédito' : 'créditos'}
          {filterMora && ' en mora'}
        </p>
      )}
    </div>
  )
}
