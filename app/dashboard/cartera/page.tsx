'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

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

function getTasaProvision(clasificacion: string): number {
  switch (clasificacion) {
    case 'Normal':      return 0.01
    case 'CPP':         return 0.05
    case 'Deficiente':  return 0.25
    case 'Dudoso':      return 0.60
    case 'Pérdida':     return 1.00
    default:            return 0.01
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

  // filtros locales
  const [busqueda, setBusqueda] = useState('')
  const [filtroClasif, setFiltroClasif] = useState('Todas')
  const [filtroConvenio, setFiltroConvenio] = useState('0')
  const [applied, setApplied] = useState({ busqueda: '', clasif: 'Todas', convenio: '0' })

  const fetchCartera = useCallback(async () => {
    setLoading(true)
    const sb = createClient()

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
      const tasa_provision = getTasaProvision(clasificacion)
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

  return (
    <div className="p-8">
      {/* Encabezado */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Cartera de Créditos</h1>
            <p className="text-sm text-gray-500 mt-0.5">Clasificación y provisiones del mes</p>
          </div>
          <span className="ml-auto px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            Al {fechaHoy()}
          </span>
        </div>
      </div>

      {/* Tarjetas resumen por clasificación */}
      {!loading && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
          {resumenClasif.map(r => {
            const col = COLORES[r.clasificacion]
            return (
              <div key={r.clasificacion} className={`bg-white rounded-xl border p-4 ${col.border}`}>
                <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold mb-2 ${col.bg} ${col.text}`}>
                  {r.clasificacion}
                </div>
                <p className="text-xl font-bold text-gray-800">{r.n}</p>
                <p className="text-xs text-gray-500 mt-0.5">S/ {fmt(r.saldo)}</p>
                <p className="text-xs text-gray-400 mt-0.5">Prov: S/ {fmt(r.provision)}</p>
              </div>
            )
          })}
          {/* Tarjeta totales */}
          <div className="bg-white rounded-xl border border-gray-200 p-4" style={{ borderColor: '#1e3a5f' }}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">TOTAL</p>
            <p className="text-xl font-bold" style={{ color: '#1e3a5f' }}>{totales.n}</p>
            <p className="text-xs text-gray-500 mt-0.5">S/ {fmt(totales.saldo)}</p>
            <p className="text-xs text-gray-400 mt-0.5">Prov: S/ {fmt(totales.provision)}</p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleFiltrar()}
          placeholder="Buscar por nombre o DNI..."
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent w-60"
        />
        <select
          value={filtroClasif}
          onChange={e => setFiltroClasif(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent"
        >
          <option value="Todas">Todas las clasificaciones</option>
          {CLASIFICACIONES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={filtroConvenio}
          onChange={e => setFiltroConvenio(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent"
        >
          <option value="0">Todos los convenios</option>
          {convenios.map(cv => <option key={cv.id} value={String(cv.id)}>{cv.nombre}</option>)}
        </select>
        <button
          onClick={handleFiltrar}
          className="px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#1e3a5f' }}
        >
          Filtrar
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Cargando cartera...</div>
        ) : filtrados.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">No se encontraron créditos</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['Socio', 'DNI', 'Pagaré', 'Desembolso', 'Saldo Capital', 'Cuota', 'Días Mora', 'Clasificación', 'Provisión', 'Acciones'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtrados.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                      {c.socios ? `${c.socios.apellidos}, ${c.socios.nombres}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {c.socios?.dni ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap font-mono">
                      {c.nro_pagare}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {formatDate(c.fecha_desembolso)}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 whitespace-nowrap">
                      S/ {fmt(c.saldo_capital)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                      S/ {fmt(c.cuota_mensual)}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      <span className={c.dias_mora > 0 ? 'font-semibold text-red-600' : 'text-gray-600'}>
                        {c.dias_mora}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <ClasifBadge c={c.clasificacion} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                      S/ {fmt(c.provision_requerida)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/cartera/${c.id}`}
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

      {!loading && filtrados.length > 0 && (
        <p className="text-xs text-gray-400 mt-3">
          {filtrados.length} {filtrados.length === 1 ? 'crédito' : 'créditos'}
        </p>
      )}
    </div>
  )
}
