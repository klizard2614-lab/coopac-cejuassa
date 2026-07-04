'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { formatNombrePersona } from '@/lib/formatNombre'
import { PageFrame, PageToolbar, FilterBar, DataTableShell, DataTableHeader, DataTableEmpty, TableSkeleton, RecordMeta, InlineAlert, btnPrimary, btnGhost, inputCls, selectCls } from '../_components/ui'

// ─── tipos ────────────────────────────────────────────────────────────────────

type Convenio = { id: number; nombre: string }

type Credito = {
  id: number
  nro_pagare: string
  fecha_desembolso: string
  saldo_capital: number
  cuota_mensual: number
  socios: {
    nombres: string
    apellidos: string
    dni: string
    nro_socio: string
    id_convenio: number | null
    convenios: Convenio | null
  } | null
}

type CuotaPendiente = {
  id_credito: number
  fecha_vencimiento: string
}

type CreditoCalculado = Credito & {
  dias_mora: number
  clasificacion: string
  tasa_provision: number
  provision_requerida: number
  convenio_nombre: string | null
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function diasEntre(fechaStr: string, hoy: Date): number {
  const fecha = new Date(fechaStr + 'T00:00:00')
  const diff = hoy.getTime() - fecha.getTime()
  return Math.floor(diff / 86400000)
}

function getClasificacion(dias_mora: number): string {
  if (dias_mora <= 8)   return 'Normal'
  if (dias_mora <= 30)  return 'CPP'
  if (dias_mora <= 60)  return 'Deficiente'
  if (dias_mora <= 120) return 'Dudoso'
  return 'Pérdida'
}

type TasasProvision = {
  normal: number
  cpp: number
  deficiente: number
  dudoso: number
  perdida: number
}

const TASAS_DEFECTO: TasasProvision = {
  normal: 0.01,
  cpp: 0.05,
  deficiente: 0.25,
  dudoso: 0.60,
  perdida: 1.00,
}

function getTasaProvision(clasificacion: string, t: TasasProvision): number {
  switch (clasificacion) {
    case 'Normal':      return t.normal
    case 'CPP':         return t.cpp
    case 'Deficiente':  return t.deficiente
    case 'Dudoso':      return t.dudoso
    case 'Pérdida':     return t.perdida
    default:            return t.normal
  }
}

const CLASIFICACIONES = ['Normal', 'CPP', 'Deficiente', 'Dudoso', 'Pérdida']

const COLORES: Record<string, { bg: string; text: string; border: string }> = {
  Normal:     { bg: 'bg-green-100',   text: 'text-green-800',   border: 'border-green-200' },
  CPP:        { bg: 'bg-yellow-100',  text: 'text-yellow-800',  border: 'border-yellow-200' },
  Deficiente: { bg: 'bg-orange-100',  text: 'text-orange-800',  border: 'border-orange-200' },
  Dudoso:     { bg: 'bg-red-100',     text: 'text-red-700',     border: 'border-red-200' },
  Pérdida:    { bg: 'bg-red-200',     text: 'text-red-900',     border: 'border-red-300' },
}

function ClasifBadge({ c }: { c: string }) {
  const col = COLORES[c] ?? COLORES['Normal']
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${col.bg} ${col.text}`}>
      {c}
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

function fechaHoy() {
  const d = new Date()
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

// ─── componente ───────────────────────────────────────────────────────────────

export default function CarteraPage() {
  const [creditos, setCreditos] = useState<CreditoCalculado[]>([])
  const [convenios, setConvenios] = useState<Convenio[]>([])
  const [loading, setLoading] = useState(true)
  const [tasasWarning, setTasasWarning] = useState(false)

  // filtros locales
  const [busqueda, setBusqueda] = useState('')
  const [filtroClasif, setFiltroClasif] = useState('Todas')
  const [filtroConvenio, setFiltroConvenio] = useState('0')
  const [applied, setApplied] = useState({ busqueda: '', clasif: 'Todas', convenio: '0' })

  const fetchCartera = useCallback(async () => {
    setLoading(true)
    const sb = createClient()

    let tasasActivas = TASAS_DEFECTO
    const cfgRes = await sb
      .from('configuracion')
      .select('provision_normal,provision_cpp,provision_deficiente,provision_dudoso,provision_perdida')
      .eq('id', 1)
      .single()
    if (cfgRes.data) {
      tasasActivas = {
        normal: cfgRes.data.provision_normal ?? TASAS_DEFECTO.normal,
        cpp: cfgRes.data.provision_cpp ?? TASAS_DEFECTO.cpp,
        deficiente: cfgRes.data.provision_deficiente ?? TASAS_DEFECTO.deficiente,
        dudoso: cfgRes.data.provision_dudoso ?? TASAS_DEFECTO.dudoso,
        perdida: cfgRes.data.provision_perdida ?? TASAS_DEFECTO.perdida,
      }
      setTasasWarning(false)
    } else {
      setTasasWarning(true)
    }

    const [creditosRes, conveniosRes] = await Promise.all([
      sb
        .from('creditos')
        .select(`
          id, nro_pagare, fecha_desembolso, saldo_capital, cuota_mensual,
          socios(nombres, apellidos, dni, nro_socio, id_convenio, convenios(id, nombre))
        `)
        .eq('estado', 'vigente'),
      sb.from('convenios').select('id, nombre').order('nombre'),
    ])

    const creditosData = (creditosRes.data as unknown as Credito[]) ?? []
    const conveniosData = (conveniosRes.data as Convenio[]) ?? []
    setConvenios(conveniosData)

    if (creditosData.length === 0) {
      setCreditos([])
      setLoading(false)
      return
    }

    const ids = creditosData.map(c => c.id)

    // Traer cuotas pendientes/vencidas/parciales de todos los créditos vigentes
    const { data: cuotasData } = await sb
      .from('cronograma_cuotas')
      .select('id_credito, fecha_vencimiento')
      .in('id_credito', ids)
      .in('estado', ['pendiente', 'vencida', 'parcial'])

    const cuotas = (cuotasData as CuotaPendiente[]) ?? []
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    // Agrupar por id_credito → min fecha_vencimiento
    const minFechaPorCredito: Record<number, string> = {}
    for (const cuota of cuotas) {
      const prev = minFechaPorCredito[cuota.id_credito]
      if (!prev || cuota.fecha_vencimiento < prev) {
        minFechaPorCredito[cuota.id_credito] = cuota.fecha_vencimiento
      }
    }

    const calculados: CreditoCalculado[] = creditosData.map(c => {
      const minFecha = minFechaPorCredito[c.id]
      const dias_mora = minFecha ? Math.max(0, diasEntre(minFecha, hoy)) : 0
      const clasificacion = getClasificacion(dias_mora)
      const tasa_provision = getTasaProvision(clasificacion, tasasActivas)
      const provision_requerida = (c.saldo_capital ?? 0) * tasa_provision
      const convenio_nombre = c.socios?.convenios?.nombre ?? null
      return { ...c, dias_mora, clasificacion, tasa_provision, provision_requerida, convenio_nombre }
    })

    // Ordenar por dias_mora DESC
    calculados.sort((a, b) => b.dias_mora - a.dias_mora)
    setCreditos(calculados)
    setLoading(false)
  }, [])

  useEffect(() => { fetchCartera() }, [fetchCartera])

  function handleFiltrar() {
    setApplied({ busqueda: busqueda.trim(), clasif: filtroClasif, convenio: filtroConvenio })
  }

  // Aplicar filtros
  const filtrados = useMemo(() => {
    return creditos.filter(c => {
      if (applied.busqueda) {
        const q = applied.busqueda.toLowerCase()
        const nombre = `${c.socios?.apellidos ?? ''} ${c.socios?.nombres ?? ''}`.toLowerCase()
        const dni = (c.socios?.dni ?? '').toLowerCase()
        if (!nombre.includes(q) && !dni.includes(q)) return false
      }
      if (applied.clasif !== 'Todas' && c.clasificacion !== applied.clasif) return false
      if (applied.convenio !== '0') {
        const cid = c.socios?.id_convenio
        if (String(cid) !== applied.convenio) return false
      }
      return true
    })
  }, [creditos, applied])

  // Resumen por clasificación
  const resumenClasif = useMemo(() => {
    return CLASIFICACIONES.map(cl => {
      const grupo = creditos.filter(c => c.clasificacion === cl)
      return {
        clasificacion: cl,
        n: grupo.length,
        saldo: grupo.reduce((s, c) => s + (c.saldo_capital ?? 0), 0),
        provision: grupo.reduce((s, c) => s + c.provision_requerida, 0),
      }
    })
  }, [creditos])

  const totales = useMemo(() => ({
    n: creditos.length,
    saldo: creditos.reduce((s, c) => s + (c.saldo_capital ?? 0), 0),
    provision: creditos.reduce((s, c) => s + c.provision_requerida, 0),
  }), [creditos])

  const hayFiltrosActivos = applied.busqueda || applied.clasif !== 'Todas' || applied.convenio !== '0'

  function limpiarFiltros() {
    setBusqueda('')
    setFiltroClasif('Todas')
    setFiltroConvenio('0')
    setApplied({ busqueda: '', clasif: 'Todas', convenio: '0' })
  }

  return (
    <PageFrame>
      <PageToolbar
        title="Cartera de Créditos"
        subtitle="Clasificación y provisiones del mes"
        meta={
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            Al {fechaHoy()}
          </span>
        }
      />

      {tasasWarning && !loading && (
        <InlineAlert variant="warning">
          Usando tasas de provisión SBS por defecto. Verifique los parámetros financieros en{' '}
          <Link href="/dashboard/configuracion" className="underline font-medium">Configuración</Link>.
        </InlineAlert>
      )}

      {/* Tarjetas resumen por clasificación */}
      {!loading && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-5">
          {resumenClasif.map(r => {
            const col = COLORES[r.clasificacion]
            return (
              <div key={r.clasificacion} className={`bg-white rounded-xl border p-4 ${col.border}`}>
                <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold mb-2 ${col.bg} ${col.text}`}>
                  {r.clasificacion}
                </div>
                <p className="text-xl font-bold text-slate-800">{r.n}</p>
                <p className="text-xs text-slate-500 mt-0.5 tabular-nums">S/ {fmt(r.saldo)}</p>
                <p className="text-xs text-slate-400 mt-0.5 tabular-nums">Prov: S/ {fmt(r.provision)}</p>
              </div>
            )
          })}
          <div className="bg-white rounded-xl border border-slate-200 p-4" style={{ borderColor: '#1E3A5F' }}>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">TOTAL</p>
            <p className="text-xl font-bold text-[#1E3A5F]">{totales.n}</p>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">S/ {fmt(totales.saldo)}</p>
            <p className="text-xs text-slate-400 mt-0.5 tabular-nums">Prov: S/ {fmt(totales.provision)}</p>
          </div>
        </div>
      )}

      <FilterBar>
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleFiltrar()}
          placeholder="Buscar por nombre o DNI..."
          className={`${inputCls} w-60`}
        />
        <select value={filtroClasif} onChange={e => setFiltroClasif(e.target.value)} className={selectCls}>
          <option value="Todas">Todas las clasificaciones</option>
          {CLASIFICACIONES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filtroConvenio} onChange={e => setFiltroConvenio(e.target.value)} className={selectCls}>
          <option value="0">Todos los convenios</option>
          {convenios.map(cv => <option key={cv.id} value={String(cv.id)}>{cv.nombre}</option>)}
        </select>
        <button onClick={handleFiltrar} className={btnPrimary}>Filtrar</button>
        {hayFiltrosActivos && (
          <button onClick={limpiarFiltros} className={btnGhost}>Limpiar filtros</button>
        )}
      </FilterBar>

      <DataTableShell>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <DataTableHeader>
              <tr>
                {['Socio', 'DNI', 'Pagaré', 'Desembolso', 'Saldo Capital', 'Cuota', 'Días Mora', 'Clasificación', 'Provisión', 'Acciones'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </DataTableHeader>
            <tbody>
              {loading ? (
                <TableSkeleton rows={6} cols={10} />
              ) : filtrados.length === 0 ? (
                <DataTableEmpty
                  cols={10}
                  message={hayFiltrosActivos ? 'Sin créditos que coincidan con los filtros aplicados.' : 'No hay créditos vigentes en cartera.'}
                  suggestion={hayFiltrosActivos ? 'Limpie los filtros para ver todos los créditos.' : undefined}
                />
              ) : (
                filtrados.map(c => (
                  <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                      {c.socios ? formatNombrePersona(c.socios.apellidos, c.socios.nombres) : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{c.socios?.dni ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap font-mono">{c.nro_pagare}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(c.fecha_desembolso)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap tabular-nums">S/ {fmt(c.saldo_capital)}</td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap tabular-nums">S/ {fmt(c.cuota_mensual)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={c.dias_mora > 0 ? 'font-semibold text-red-600 tabular-nums' : 'text-slate-600'}>
                        {c.dias_mora}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <ClasifBadge c={c.clasificacion} />
                    </td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap tabular-nums">S/ {fmt(c.provision_requerida)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/cartera/${c.id}`} className={btnGhost}>Ver</Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DataTableShell>

      {!loading && filtrados.length > 0 && (
        <RecordMeta>{filtrados.length} {filtrados.length === 1 ? 'crédito' : 'créditos'}</RecordMeta>
      )}
    </PageFrame>
  )
}
