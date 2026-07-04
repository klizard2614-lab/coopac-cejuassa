'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { generarReciboPDF } from './utils/generarReciboPDF'
import { useRol } from '@/lib/useRol'
import { FileText, Receipt, X } from 'lucide-react'
import { formatNombrePersona } from '@/lib/formatNombre'
import { PageFrame, PageToolbar, FilterBar, DataTableShell, DataTableHeader, DataTableEmpty, TableSkeleton, RecordMeta, StatusBadge, btnPrimary, btnGhost, selectCls } from '../_components/ui'

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
  const variantMap: Record<string, 'info' | 'warning' | 'success' | 'neutral'> = {
    registrado:    'info',
    en_correccion: 'warning',
    validado:      'success',
    cerrado:       'neutral',
  }
  const s = ESTADO_MAP[estado] ?? ESTADO_MAP.registrado
  return <StatusBadge label={s.label} variant={variantMap[estado] ?? 'neutral'} />
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function formatDate(d: string) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

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
  const { rol } = useRol()
  const puedeRegistrar = rol === 'admin' || rol === 'tesoreria'
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
  const hasFilters = filterPeriodo || filterCanal || filterEstado

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

  function clearFilters() {
    setFilterPeriodo('')
    setFilterCanal('')
    setFilterEstado('')
  }

  return (
    <PageFrame>
      <PageToolbar
        title="Pagos / Recibos"
        subtitle={!loading ? `${pagos.length} recibos registrados` : undefined}
        actions={
          puedeRegistrar ? (
            <Link href="/dashboard/pagos/nuevo" className={btnPrimary}>
              + Registrar Pago
            </Link>
          ) : undefined
        }
      />

      <FilterBar>
        <select
          value={filterPeriodo}
          onChange={e => setFilterPeriodo(e.target.value)}
          className={selectCls}
        >
          <option value="">Todos los periodos</option>
          {periodOptions.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select
          value={filterCanal}
          onChange={e => setFilterCanal(e.target.value)}
          className={selectCls}
        >
          <option value="">Todos los canales</option>
          <option value="convenio">Convenio</option>
          <option value="caja">Caja</option>
        </select>
        <select
          value={filterEstado}
          onChange={e => setFilterEstado(e.target.value)}
          className={selectCls}
        >
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_MAP).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-500 hover:bg-slate-50 transition-colors active:scale-[0.97]"
          >
            <X size={13} /> Limpiar
          </button>
        )}
      </FilterBar>

      <DataTableShell>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <DataTableHeader>
              <tr>
                {['Nº Recibo', 'Fecha', 'Socio', 'Crédito', 'Canal', 'Total', 'Estado', 'Acciones'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </DataTableHeader>
            <tbody>
              {loading ? (
                <TableSkeleton rows={6} cols={8} />
              ) : filtered.length === 0 ? (
                <DataTableEmpty
                  cols={8}
                  message={hasFilters ? 'Sin pagos que coincidan con los filtros aplicados.' : 'No hay pagos registrados aún.'}
                  suggestion={hasFilters ? 'Limpie los filtros para ver todos los pagos.' : undefined}
                />
              ) : (
                filtered.map(p => (
                  <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{p.nro_recibo}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(p.fecha)}</td>
                    <td className="px-4 py-3 text-slate-800">
                      {p.socios ? formatNombrePersona(p.socios.apellidos, p.socios.nombres) : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                      {p.creditos?.nro_pagare ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap capitalize">
                      {p.canal_pago}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                      S/ {fmt(p.monto_total)}
                    </td>
                    <td className="px-4 py-3">
                      <EstadoBadge estado={p.estado_flujo} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Link href={`/dashboard/pagos/${p.id}`} className={btnGhost}>
                          Ver
                        </Link>
                        <button
                          onClick={() => handlePDF(p.id)}
                          disabled={generandoPDF === p.id}
                          className={`${btnGhost} disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {generandoPDF === p.id ? 'Generando...' : <><FileText size={12} />PDF</>}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DataTableShell>

      {!loading && filtered.length > 0 && (
        <div className="flex items-center justify-between mt-2">
          <RecordMeta>{filtered.length} {filtered.length === 1 ? 'pago' : 'pagos'}</RecordMeta>
          <p className="text-sm font-semibold text-slate-700">
            Total del período:{' '}
            <span className="text-[#1E3A5F] tabular-nums">S/ {fmt(totalPeriodo)}</span>
          </p>
        </div>
      )}
    </PageFrame>
  )
}
