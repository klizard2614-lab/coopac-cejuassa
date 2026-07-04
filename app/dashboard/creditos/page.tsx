'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useRol } from '@/lib/useRol'
import { AlertTriangle, CreditCard } from 'lucide-react'
import { formatNombrePersona } from '@/lib/formatNombre'
import { PageFrame, PageToolbar, FilterBar, DataTableShell, DataTableHeader, DataTableEmpty, TableSkeleton, RecordMeta, StatusBadge, btnPrimary, btnGhost, btnEdit, inputCls } from '../_components/ui'

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
  const map: Record<string, { variant: 'success' | 'warning' | 'danger' | 'neutral'; label: string }> = {
    vigente:      { variant: 'success',  label: 'Vigente' },
    cancelado:    { variant: 'neutral',  label: 'Cancelado' },
    castigado:    { variant: 'danger',   label: 'Castigado' },
    refinanciado: { variant: 'warning',  label: 'Refinanciado' },
  }
  const s = map[estado] ?? map.cancelado
  return <StatusBadge label={s.label} variant={s.variant} />
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

export default function CreditosPage() {
  const { rol } = useRol()
  const puedeEditar = rol === 'admin' || rol === 'creditos'
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
    <PageFrame>
      <PageToolbar
        title="Créditos"
        subtitle={!loading ? `${creditos.length} créditos registrados` : undefined}
        actions={
          puedeEditar ? (
            <Link href="/dashboard/creditos/nuevo" className={btnPrimary}>
              + Nuevo Crédito
            </Link>
          ) : undefined
        }
      />

      <FilterBar>
        <input
          type="text"
          placeholder="Buscar por nombre del socio o Nº pagaré..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={`${inputCls} w-full max-w-sm`}
        />
        <button
          onClick={() => setFilterMora(v => !v)}
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors active:scale-[0.97] ${
            filterMora
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <AlertTriangle size={14} /> Solo en mora
          {!loading && cantidadEnMora > 0 && (
            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-semibold ${
              filterMora ? 'bg-red-100 text-red-800' : 'bg-red-100 text-red-700'
            }`}>
              {cantidadEnMora}
            </span>
          )}
        </button>
      </FilterBar>

      <DataTableShell>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <DataTableHeader>
              <tr>
                {['Nº Pagaré', 'Socio', 'Monto Aprobado', 'Saldo Capital', 'Cuota Mensual', 'Estado', 'Acciones'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </DataTableHeader>
            <tbody>
              {loading ? (
                <TableSkeleton rows={6} cols={7} />
              ) : filtered.length === 0 ? (
                <DataTableEmpty
                  cols={7}
                  message={
                    filterMora
                      ? 'Sin créditos en mora.'
                      : search.trim()
                        ? `Sin resultados para "${search.trim()}"`
                        : 'No hay créditos registrados aún.'
                  }
                  suggestion={(search.trim() || filterMora) ? 'Ajuste los filtros o limpie la búsqueda.' : undefined}
                />
              ) : (
                filtered.map(c => {
                  const enMora = moraSet.has(c.id) && c.estado === 'vigente'
                  return (
                    <tr key={c.id} className={`border-b border-slate-100 last:border-0 transition-colors ${enMora ? 'bg-red-50 hover:bg-red-100/70' : 'hover:bg-slate-50/50'}`}>
                      <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{c.nro_pagare}</td>
                      <td className="px-4 py-3 text-slate-800">
                        {c.socios ? formatNombrePersona(c.socios.apellidos, c.socios.nombres) : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap tabular-nums">S/ {fmt(c.monto_aprobado)}</td>
                      <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap tabular-nums">S/ {fmt(c.saldo_capital)}</td>
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap tabular-nums">S/ {fmt(c.cuota_mensual)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <EstadoBadge estado={c.estado} />
                          {enMora && (
                            <StatusBadge label="En mora" variant="danger" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Link href={`/dashboard/creditos/${c.id}`} className={btnGhost}>
                            Ver
                          </Link>
                          {puedeEditar && (
                            <Link href={`/dashboard/creditos/${c.id}/editar`} className={btnEdit}>
                              Editar
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </DataTableShell>

      {!loading && filtered.length > 0 && (
        <RecordMeta>
          {filtered.length} {filterMora ? (filtered.length === 1 ? 'crédito en mora' : 'créditos en mora') : (filtered.length === 1 ? 'crédito' : 'créditos')}
        </RecordMeta>
      )}
    </PageFrame>
  )
}
