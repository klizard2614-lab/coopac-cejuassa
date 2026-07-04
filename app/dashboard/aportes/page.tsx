'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useRol } from '@/lib/useRol'
import { PiggyBank } from 'lucide-react'
import { formatNombrePersona } from '@/lib/formatNombre'
import { PageFrame, PageToolbar, FilterBar, DataTableShell, DataTableHeader, DataTableEmpty, TableSkeleton, RecordMeta, btnPrimary, btnGhost, inputCls, selectCls } from '../_components/ui'

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
  const { rol } = useRol()

  const [aportes, setAportes] = useState<Aporte[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [mesFilter, setMesFilter] = useState(currentMonth)
  const [anioFilter, setAnioFilter] = useState(currentYear)
  const [applied, setApplied] = useState({ mes: currentMonth, anio: currentYear, texto: '' })
  const [sumaAnio, setSumaAnio] = useState<number | null>(null)
  const [sociosMes, setSociosMes] = useState<number | null>(null)

  const yearOptions = useMemo(() => buildYearOptions(), [])

  const fetchAportes = useCallback(async () => {
    setLoading(true)
    const mesStr = String(applied.mes).padStart(2, '0')
    const dateFrom = `${applied.anio}-${mesStr}-01`
    const lastDay = new Date(applied.anio, applied.mes, 0).getDate()
    const dateTo = `${applied.anio}-${mesStr}-${String(lastDay).padStart(2, '0')}`

    const query = createClient()
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

  const totalMes = useMemo(() => aportes.reduce((s, a) => s + (a.monto ?? 0), 0), [aportes])

  useEffect(() => {
    const mesStr = String(applied.mes).padStart(2, '0')
    const dateFrom = `${applied.anio}-${mesStr}-01`
    const lastDay = new Date(applied.anio, applied.mes, 0).getDate()
    const dateTo = `${applied.anio}-${mesStr}-${String(lastDay).padStart(2, '0')}`

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
    <PageFrame>
      <PageToolbar
        title="Aportes"
        subtitle={`${MONTHS[applied.mes - 1]} ${applied.anio}`}
        actions={
          ['admin', 'tesoreria'].includes(rol ?? '') ? (
            <Link href="/dashboard/pagos/nuevo" className={btnPrimary}>
              + Registrar aporte vía pago
            </Link>
          ) : undefined
        }
      />

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Total aportes del mes</p>
          <p className="text-2xl font-bold text-[#1E3A5F] tabular-nums">S/ {fmt(totalMes)}</p>
          <p className="text-xs text-slate-400 mt-1">{MONTHS[applied.mes - 1]} {applied.anio}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Total aportes del año</p>
          <p className="text-2xl font-bold text-[#1E3A5F] tabular-nums">
            {sumaAnio === null ? '...' : `S/ ${fmt(sumaAnio)}`}
          </p>
          <p className="text-xs text-slate-400 mt-1">Año {applied.anio}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Socios con aportes este mes</p>
          <p className="text-2xl font-bold text-[#1E3A5F]">
            {sociosMes === null ? '...' : sociosMes}
          </p>
          <p className="text-xs text-slate-400 mt-1">{MONTHS[applied.mes - 1]} {applied.anio}</p>
        </div>
      </div>

      <FilterBar>
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleBuscar()}
          placeholder="Buscar por nombre o DNI..."
          className={`${inputCls} w-64`}
        />
        <select
          value={mesFilter}
          onChange={e => setMesFilter(Number(e.target.value))}
          className={selectCls}
        >
          {MONTHS.map((m, i) => (
            <option key={i + 1} value={i + 1}>{m}</option>
          ))}
        </select>
        <select
          value={anioFilter}
          onChange={e => setAnioFilter(Number(e.target.value))}
          className={selectCls}
        >
          {yearOptions.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <button onClick={handleBuscar} className={btnPrimary}>
          Buscar
        </button>
      </FilterBar>

      <DataTableShell>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <DataTableHeader>
              <tr>
                {['Socio', 'DNI', 'Fecha', 'Monto', 'Saldo Acumulado', 'Recibo', 'Acciones'].map(h => (
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
                    applied.texto
                      ? `Sin coincidencias para "${applied.texto}" en ${MONTHS[applied.mes - 1]} ${applied.anio}.`
                      : `Sin aportes en ${MONTHS[applied.mes - 1]} ${applied.anio}.`
                  }
                  suggestion={applied.texto ? 'Pruebe cambiar el término o seleccionar otro período.' : undefined}
                />
              ) : (
                filtered.map(a => (
                  <tr key={a.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {a.socios ? formatNombrePersona(a.socios.apellidos, a.socios.nombres) : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {a.socios?.dni ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {formatDate(a.fecha)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                      S/ {fmt(a.monto)}
                    </td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap tabular-nums">
                      S/ {fmt(a.saldo_nuevo)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {a.pagos_recibos?.nro_recibo ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/aportes/${a.id}`} className={btnGhost}>
                        Ver
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
        <RecordMeta>{filtered.length} {filtered.length === 1 ? 'aporte' : 'aportes'}</RecordMeta>
      )}
    </PageFrame>
  )
}
