'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { CheckCircle2 } from 'lucide-react'
import { formatNombrePersona } from '@/lib/formatNombre'
import { PageFrame, PageToolbar, FilterBar, DataTableShell, DataTableHeader, DataTableEmpty, TableSkeleton, RecordMeta, btnGhost, inputCls, selectCls } from '../_components/ui'

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
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
      <p className="text-sm text-slate-500 mt-1">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
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
    <PageFrame>
      <PageToolbar
        title="Cartera en Mora"
        subtitle="Créditos vigentes con cuotas vencidas"
        actions={
          <Link href="/dashboard/creditos" className={btnGhost}>← Créditos</Link>
        }
      />

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <ResumenCard label="Créditos en mora" value={loading ? '—' : String(totalCreditos)} sub="créditos vigentes" color="#dc2626" />
        <ResumenCard label="Socios afectados" value={loading ? '—' : String(totalSocios)} color="#b45309" />
        <ResumenCard label="Monto vencido" value={loading ? '—' : `S/ ${fmt(totalVencido)}`} sub="suma cuotas en mora" color="#dc2626" />
        <ResumenCard label="Capital en riesgo" value={loading ? '—' : `S/ ${fmt(totalEnRiesgo)}`} sub="saldo capital" color="#9333ea" />
      </div>

      <FilterBar>
        <input
          type="text"
          placeholder="Buscar por socio o Nº pagaré..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={`${inputCls} w-full max-w-xs`}
        />
        <select value={filterDias} onChange={e => setFilterDias(e.target.value)} className={selectCls}>
          <option value="">Todos los atrasos</option>
          <option value="1-30">1–30 días</option>
          <option value="31-60">31–60 días</option>
          <option value="61-90">61–90 días</option>
          <option value="+90">+90 días</option>
        </select>
        <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)} className={selectCls}>
          <option value="">Todos los tipos</option>
          {Object.entries(TIPO_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        {hayFiltros && (
          <button onClick={() => { setFilterDias(''); setFilterTipo(''); setSearch('') }} className={btnGhost}>
            Limpiar filtros
          </button>
        )}
      </FilterBar>

      <DataTableShell>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <DataTableHeader>
              <tr>
                {['Nº Socio', 'Apellidos y Nombres', 'Nº Pagaré', 'F. Desembolso', 'Cuotas vencidas', 'Días atraso', 'Saldo Capital', 'Monto Vencido', 'Acciones'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </DataTableHeader>
            <tbody>
              {loading ? (
                <TableSkeleton rows={5} cols={9} />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-14 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-11 h-11 rounded-full bg-emerald-50 flex items-center justify-center">
                        <CheckCircle2 size={20} className="text-emerald-600" />
                      </div>
                      <p className="text-sm text-slate-500">
                        {hayFiltros ? 'Sin resultados para los filtros aplicados' : 'No hay créditos en mora'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(c => (
                  <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-red-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{c.socios?.nro_socio ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-800">
                      {c.socios ? formatNombrePersona(c.socios.apellidos, c.socios.nombres) : '—'}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{c.nro_pagare}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmtFecha(c.fecha_desembolso)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100 text-red-800 text-xs font-bold">
                        {c.cuotas_vencidas}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <DiasAtrasoTag dias={c.dias_atraso} />
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap tabular-nums">S/ {fmt(c.saldo_capital)}</td>
                    <td className="px-4 py-3 font-semibold text-red-700 whitespace-nowrap tabular-nums">S/ {fmt(c.monto_vencido)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/creditos/${c.id}`} className={`${btnGhost} whitespace-nowrap`}>
                        Ver crédito
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DataTableShell>

      {!loading && filtered.length > 0 && (
        <RecordMeta>
          {filtered.length} {filtered.length === 1 ? 'crédito en mora' : 'créditos en mora'}
          {hayFiltros ? ' (filtrado)' : ''}
        </RecordMeta>
      )}
    </PageFrame>
  )
}
