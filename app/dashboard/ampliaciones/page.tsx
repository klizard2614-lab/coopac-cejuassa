'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useRol } from '@/lib/useRol'
import { formatNombrePersona } from '@/lib/formatNombre'
import { PageFrame, PageToolbar, FilterBar, DataTableShell, DataTableHeader, DataTableEmpty, TableSkeleton, RecordMeta, InlineAlert, btnGhost, inputCls } from '../_components/ui'
import { Search, X, AlertTriangle } from 'lucide-react'

type SocioInfo = {
  nombres: string | null
  apellidos: string | null
  nro_socio: string | null
}

type CreditoInfo = {
  nro_pagare: string | null
  id_socio: string | null
  socio: SocioInfo | null
}

type AmpliacionRow = {
  id: string
  id_credito: string
  fecha: string
  nro_pagare_anterior: string | null
  nro_pagare_nuevo: string
  monto_nuevo: number
  plazo_nuevo: number
  saldo_nuevo: number
  observacion: string | null
  created_at: string
  credito: CreditoInfo | null
}

const ROLES_PERMITIDOS = ['admin', 'creditos', 'contabilidad', 'tesoreria']

function fmt(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  const parts = d.split('T')[0].split('-')
  if (parts.length !== 3) return d
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

function socioNombre(row: AmpliacionRow): string {
  const s = row.credito?.socio
  if (!s) return '—'
  return formatNombrePersona(s.apellidos, s.nombres)
}

export default function AmpliacionesPage() {
  const { rol, loading: rolLoading } = useRol()
  const [ampliaciones, setAmpliaciones] = useState<AmpliacionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [buscarSocio, setBuscarSocio] = useState('')
  const [buscarPagare, setBuscarPagare] = useState('')
  const [buscarCredito, setBuscarCredito] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const supabase = createClient()
      const { data, error: err } = await supabase
        .from('ampliaciones')
        .select(`
          *,
          credito:creditos(
            nro_pagare,
            id_socio,
            socio:socios(nombres, apellidos, nro_socio)
          )
        `)
        .order('fecha', { ascending: false })
      if (cancelled) return
      if (err) { setError(err.message); setLoading(false); return }
      setAmpliaciones((data ?? []) as AmpliacionRow[])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    let rows = ampliaciones
    if (buscarSocio.trim()) {
      const q = buscarSocio.trim().toLowerCase()
      rows = rows.filter(r => {
        const nombre = socioNombre(r).toLowerCase()
        const nroSocio = (r.credito?.socio?.nro_socio ?? '').toLowerCase()
        return nombre.includes(q) || nroSocio.includes(q)
      })
    }
    if (buscarPagare.trim()) {
      const q = buscarPagare.trim().toLowerCase()
      rows = rows.filter(r =>
        r.nro_pagare_nuevo.toLowerCase().includes(q) ||
        (r.nro_pagare_anterior ?? '').toLowerCase().includes(q)
      )
    }
    if (buscarCredito.trim()) {
      const q = buscarCredito.trim().toLowerCase()
      rows = rows.filter(r =>
        r.id_credito.toLowerCase().includes(q) ||
        (r.credito?.nro_pagare ?? '').toLowerCase().includes(q)
      )
    }
    if (fechaDesde) rows = rows.filter(r => r.fecha >= fechaDesde)
    if (fechaHasta) rows = rows.filter(r => r.fecha <= fechaHasta)
    return rows
  }, [ampliaciones, buscarSocio, buscarPagare, buscarCredito, fechaDesde, fechaHasta])

  function limpiarFiltros() {
    setBuscarSocio('')
    setBuscarPagare('')
    setBuscarCredito('')
    setFechaDesde('')
    setFechaHasta('')
  }

  const hayFiltros = !!(buscarSocio || buscarPagare || buscarCredito || fechaDesde || fechaHasta)

  if (!rolLoading && !ROLES_PERMITIDOS.includes(rol ?? '')) {
    return (
      <PageFrame>
        <p className="text-lg font-medium text-slate-700">Acceso denegado</p>
        <p className="text-sm text-slate-500 mt-1">No tienes permiso para ver este módulo.</p>
      </PageFrame>
    )
  }

  return (
    <PageFrame>
      <PageToolbar
        title="Ampliaciones"
        subtitle="Historial global de ampliaciones registradas"
      />

      <InlineAlert variant="info">
        <div className="flex items-start gap-2">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>
            <strong>Ampliaciones funcionales.</strong>{' '}
            Al registrar una ampliación se actualiza el crédito: pagaré, monto aprobado, saldo capital, plazo, tasa TEA y cuota mensual.
            El cronograma no se recalcula automáticamente; revísalo manualmente si corresponde.
            Para registrar una nueva ampliación, ingresa al detalle del crédito.
          </span>
        </div>
      </InlineAlert>

      {error && (
        <InlineAlert variant="danger">Error al cargar datos: {error}</InlineAlert>
      )}

      <FilterBar>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Buscar por socio..." value={buscarSocio} onChange={e => setBuscarSocio(e.target.value)} className={`${inputCls} pl-8`} />
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Buscar por pagaré..." value={buscarPagare} onChange={e => setBuscarPagare(e.target.value)} className={`${inputCls} pl-8`} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Fecha desde</label>
          <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Fecha hasta</label>
          <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} className={inputCls} />
        </div>
        {hayFiltros && (
          <button onClick={limpiarFiltros} className={`${btnGhost} self-end`}>
            <X size={13} /> Limpiar filtros
          </button>
        )}
      </FilterBar>

      <DataTableShell>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <DataTableHeader>
              <tr>
                {['Fecha', 'Socio', 'Crédito', 'Pagaré Anterior', 'Pagaré Nuevo', 'Monto Nuevo', 'Plazo', 'Saldo Nuevo', 'Observación', ''].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-medium text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </DataTableHeader>
            <tbody>
              {loading ? (
                <TableSkeleton rows={5} cols={10} />
              ) : filtered.length === 0 ? (
                <DataTableEmpty
                  cols={10}
                  message={hayFiltros ? 'Sin ampliaciones que coincidan con los filtros.' : 'Sin ampliaciones registradas.'}
                />
              ) : (
                filtered.map(a => (
                  <tr key={a.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                    <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{formatDate(a.fecha)}</td>
                    <td className="px-3 py-2.5 text-slate-700" style={{ maxWidth: '160px' }}>
                      <span className="block truncate">{socioNombre(a)}</span>
                      {a.credito?.socio?.nro_socio && (
                        <span className="text-xs text-slate-400">#{a.credito.socio.nro_socio}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                      {a.credito?.nro_pagare ?? `${a.id_credito.slice(0, 8)}…`}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{a.nro_pagare_anterior ?? '—'}</td>
                    <td className="px-3 py-2.5 font-medium text-slate-800 whitespace-nowrap">{a.nro_pagare_nuevo}</td>
                    <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap tabular-nums">S/ {fmt(a.monto_nuevo)}</td>
                    <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{a.plazo_nuevo > 0 ? `${a.plazo_nuevo} m` : '—'}</td>
                    <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap tabular-nums">S/ {fmt(a.saldo_nuevo)}</td>
                    <td className="px-3 py-2.5 text-slate-500 truncate" style={{ maxWidth: '180px' }} title={a.observacion ?? ''}>
                      {a.observacion || '—'}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <Link href={`/dashboard/creditos/${a.id_credito}`} className={btnGhost}>
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
          {filtered.length} {filtered.length === 1 ? 'ampliación' : 'ampliaciones'}
          {hayFiltros && ` de ${ampliaciones.length} en total`}
        </RecordMeta>
      )}
    </PageFrame>
  )
}
