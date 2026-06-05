'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { CheckCircle2 } from 'lucide-react'

// ─── tipos ────────────────────────────────────────────────────────────────────

type CreditoRaw = {
  id: number
  nro_pagare: string
  fecha_desembolso: string | null
  saldo_capital: number
  tipo_credito: string | null
  socios: { nro_socio: string; apellidos: string; nombres: string } | null
}

type CuotaRaw = {
  id_credito: number
  fecha_vencimiento: string
  estado: string
  cuota_total: number
}

type CreditoMora = {
  id: number
  nro_pagare: string
  fecha_desembolso: string | null
  saldo_capital: number
  tipo_credito: string | null
  socios: { nro_socio: string; apellidos: string; nombres: string } | null
  cuotas_vencidas: number
  dias_atraso: number
  monto_vencido: number
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function fmtFecha(d: string | null) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function esMora(cu: CuotaRaw, hoy: Date): boolean {
  if (cu.estado === 'vencida') return true
  if (['pendiente', 'parcial'].includes(cu.estado)) {
    return new Date(cu.fecha_vencimiento + 'T00:00:00') < hoy
  }
  return false
}

function getBandaDias(dias: number): string {
  if (dias <= 30)  return '1-30'
  if (dias <= 60)  return '31-60'
  if (dias <= 90)  return '61-90'
  return '+90'
}

const TIPO_LABELS: Record<string, string> = {
  consumo:       'Consumo',
  microempresa:  'Microempresa',
  hipotecario:   'Hipotecario',
  otro:          'Otro',
}

// ─── badges ───────────────────────────────────────────────────────────────────

function DiasAtrasoTag({ dias }: { dias: number }) {
  const banda = getBandaDias(dias)
  const map: Record<string, string> = {
    '1-30':  'bg-yellow-100 text-yellow-800',
    '31-60': 'bg-orange-100 text-orange-800',
    '61-90': 'bg-red-100 text-red-800',
    '+90':   'bg-red-200 text-red-900 font-bold',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[banda]}`}>
      {dias} días
    </span>
  )
}

// ─── tarjeta resumen ──────────────────────────────────────────────────────────

function ResumenCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className={`text-2xl font-bold`} style={{ color }}>{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── página ───────────────────────────────────────────────────────────────────

export default function MoraPage() {
  const [items, setItems] = useState<CreditoMora[]>([])
  const [loading, setLoading] = useState(true)
  const [filterDias, setFilterDias] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const sb = createClient()
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    Promise.all([
      sb.from('creditos')
        .select('id, nro_pagare, fecha_desembolso, saldo_capital, tipo_credito, socios(nro_socio, apellidos, nombres)')
        .eq('estado', 'vigente'),
      sb.from('cronograma_cuotas')
        .select('id_credito, fecha_vencimiento, estado, cuota_total')
        .in('estado', ['pendiente', 'vencida', 'parcial']),
    ]).then(([credRes, cuotasRes]) => {
      const creditos  = (credRes.data   as unknown as CreditoRaw[]) ?? []
      const cuotas    = (cuotasRes.data as CuotaRaw[])             ?? []

      // Agrupar cuotas en mora por id_credito
      const moraMap: Record<number, { cuotas_vencidas: number; min_fecha: string; monto_vencido: number }> = {}

      for (const cu of cuotas) {
        if (!esMora(cu, hoy)) continue
        if (!moraMap[cu.id_credito]) {
          moraMap[cu.id_credito] = {
            cuotas_vencidas: 0,
            min_fecha: cu.fecha_vencimiento,
            monto_vencido: 0,
          }
        }
        const entry = moraMap[cu.id_credito]
        entry.cuotas_vencidas++
        entry.monto_vencido += cu.cuota_total ?? 0
        if (cu.fecha_vencimiento < entry.min_fecha) {
          entry.min_fecha = cu.fecha_vencimiento
        }
      }

      // Construir lista solo con créditos que tienen mora
      const result: CreditoMora[] = creditos
        .filter(c => moraMap[c.id])
        .map(c => {
          const m = moraMap[c.id]
          const minDate = new Date(m.min_fecha + 'T00:00:00')
          const dias_atraso = Math.max(0, Math.floor((hoy.getTime() - minDate.getTime()) / 86400000))
          return {
            ...c,
            cuotas_vencidas: m.cuotas_vencidas,
            dias_atraso,
            monto_vencido: m.monto_vencido,
          }
        })
        .sort((a, b) => b.dias_atraso - a.dias_atraso)

      setItems(result)
      setLoading(false)
    })
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return items.filter(c => {
      if (filterDias && getBandaDias(c.dias_atraso) !== filterDias) return false
      if (filterTipo && (c.tipo_credito ?? 'otro') !== filterTipo) return false
      if (q) {
        const socio = c.socios
        const matches =
          c.nro_pagare.toLowerCase().includes(q) ||
          (socio?.nro_socio.includes(q) ?? false) ||
          (socio?.apellidos.toLowerCase().includes(q) ?? false) ||
          (socio?.nombres.toLowerCase().includes(q) ?? false)
        if (!matches) return false
      }
      return true
    })
  }, [items, filterDias, filterTipo, search])

  // Totales (sobre lista filtrada)
  const totalCreditos   = filtered.length
  const totalSocios     = new Set(filtered.map(c => c.socios?.nro_socio ?? c.id)).size
  const totalVencido    = filtered.reduce((s, c) => s + c.monto_vencido, 0)
  const totalEnRiesgo   = filtered.reduce((s, c) => s + c.saldo_capital, 0)

  const hayFiltros = filterDias || filterTipo || search

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Cartera en Mora</h1>
          <p className="text-sm text-gray-500 mt-0.5">Créditos vigentes con cuotas vencidas</p>
        </div>
        <Link
          href="/dashboard/creditos"
          className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          ← Créditos
        </Link>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <ResumenCard
          label="Créditos en mora"
          value={loading ? '—' : String(totalCreditos)}
          sub="créditos vigentes"
          color="#dc2626"
        />
        <ResumenCard
          label="Socios afectados"
          value={loading ? '—' : String(totalSocios)}
          color="#b45309"
        />
        <ResumenCard
          label="Monto vencido"
          value={loading ? '—' : `S/ ${fmt(totalVencido)}`}
          sub="suma cuotas en mora"
          color="#dc2626"
        />
        <ResumenCard
          label="Capital en riesgo"
          value={loading ? '—' : `S/ ${fmt(totalEnRiesgo)}`}
          sub="saldo capital"
          color="#9333ea"
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="text"
          placeholder="Buscar por socio o Nº pagaré..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent"
        />
        <select
          value={filterDias}
          onChange={e => setFilterDias(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent"
        >
          <option value="">Todos los atrasos</option>
          <option value="1-30">1–30 días</option>
          <option value="31-60">31–60 días</option>
          <option value="61-90">61–90 días</option>
          <option value="+90">+90 días</option>
        </select>
        <select
          value={filterTipo}
          onChange={e => setFilterTipo(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent"
        >
          <option value="">Todos los tipos</option>
          {Object.entries(TIPO_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        {hayFiltros && (
          <button
            onClick={() => { setFilterDias(''); setFilterTipo(''); setSearch('') }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-colors"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Cargando cartera en mora...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 size={24} className="text-green-600" />
            </div>
            <p className="text-gray-500 text-sm font-medium">
              {hayFiltros ? 'Sin resultados para los filtros aplicados' : 'No hay créditos en mora'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {[
                    'Nº Socio', 'Apellidos y Nombres', 'Nº Pagaré',
                    'F. Desembolso', 'Cuotas vencidas', 'Días atraso',
                    'Saldo Capital', 'Monto Vencido', 'Acciones',
                  ].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-red-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                      {c.socios?.nro_socio ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800">
                      {c.socios ? `${c.socios.apellidos}, ${c.socios.nombres}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                      {c.nro_pagare}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {fmtFecha(c.fecha_desembolso)}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100 text-red-800 text-xs font-bold">
                        {c.cuotas_vencidas}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <DiasAtrasoTag dias={c.dias_atraso} />
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 whitespace-nowrap">
                      S/ {fmt(c.saldo_capital)}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-red-700 whitespace-nowrap">
                      S/ {fmt(c.monto_vencido)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/creditos/${c.id}`}
                        className="px-3 py-1 text-xs font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap"
                      >
                        Ver crédito
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
          {filtered.length} {filtered.length === 1 ? 'crédito en mora' : 'créditos en mora'}
          {hayFiltros ? ' (filtrado)' : ''}
        </p>
      )}
    </div>
  )
}
