'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

// ─── tipos ────────────────────────────────────────────────────────────────────

type CanalPago = 'caja' | 'convenio'
type EstadoFlujo = 'registrado' | 'en_correccion' | 'validado' | 'cerrado'
type TipoEgreso = 'retiro_socio' | 'fondo_mortuorio' | 'otro'

type Ingreso = {
  id: number
  nro_recibo: string
  fecha: string
  canal_pago: CanalPago
  estado_flujo: EstadoFlujo
  monto_aporte: number
  monto_capital: number
  monto_interes: number
  monto_fps: number
  monto_fps_extra: number
  monto_otros: number
  monto_total: number
  socios: {
    nro_socio: string
    apellidos: string
    nombres: string
  } | null
}

type Egreso = {
  id: number
  fecha: string
  tipo: TipoEgreso
  monto: number
  beneficiario: string | null
  descripcion: string | null
}

// ─── constantes ───────────────────────────────────────────────────────────────

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

const CANAL_LABELS: Record<CanalPago, string> = {
  caja: 'Caja',
  convenio: 'Convenio',
}

const CANAL_COLORS: Record<CanalPago, string> = {
  caja: 'bg-blue-100 text-blue-700',
  convenio: 'bg-purple-100 text-purple-700',
}

const ESTADO_LABELS: Record<EstadoFlujo, string> = {
  registrado: 'Registrado',
  en_correccion: 'En Corrección',
  validado: 'Validado',
  cerrado: 'Cerrado',
}

const TIPO_EGRESO_LABELS: Record<TipoEgreso, string> = {
  retiro_socio: 'Retiro de Socio',
  fondo_mortuorio: 'Fondo Mortuorio',
  otro: 'Otro',
}

const TIPO_EGRESO_COLORS: Record<TipoEgreso, string> = {
  retiro_socio: 'bg-blue-100 text-blue-700',
  fondo_mortuorio: 'bg-purple-100 text-purple-700',
  otro: 'bg-gray-100 text-gray-600',
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function buildYearOptions() {
  const y = new Date().getFullYear()
  return [y, y - 1, y - 2, y - 3]
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function formatDate(d: string) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

const inputCls =
  'px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white ' +
  'focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]'

// ─── componente ───────────────────────────────────────────────────────────────

export default function ReporteCajaPage() {
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [anio, setAnio] = useState(now.getFullYear())
  const [canalFilter, setCanalFilter] = useState<CanalPago | ''>('')

  const [ingresos, setIngresos] = useState<Ingreso[]>([])
  const [egresos, setEgresos] = useState<Egreso[]>([])
  const [loading, setLoading] = useState(false)
  const [generado, setGenerado] = useState(false)

  const yearOptions = useMemo(() => buildYearOptions(), [])

  async function handleGenerar() {
    setLoading(true)
    setGenerado(false)

    const sb = createClient()
    const mesStr = String(mes).padStart(2, '0')
    const lastDay = new Date(anio, mes, 0).getDate()
    const dateFrom = `${anio}-${mesStr}-01`
    const dateTo   = `${anio}-${mesStr}-${String(lastDay).padStart(2, '0')}`

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ingresosQuery: any = sb
      .from('pagos_recibos')
      .select(`
        id, nro_recibo, fecha, canal_pago, estado_flujo,
        monto_aporte, monto_capital, monto_interes, monto_fps, monto_fps_extra, monto_otros, monto_total,
        socios(nro_socio, apellidos, nombres)
      `)
      .gte('fecha', dateFrom)
      .lte('fecha', dateTo)
      .order('fecha', { ascending: false })

    if (canalFilter) ingresosQuery = ingresosQuery.eq('canal_pago', canalFilter)

    const egresosQuery = sb
      .from('egresos')
      .select('id, fecha, tipo, monto, beneficiario, descripcion')
      .gte('fecha', dateFrom)
      .lte('fecha', dateTo)
      .order('fecha', { ascending: false })

    const [ingresosRes, egresosRes] = await Promise.all([ingresosQuery, egresosQuery])

    setIngresos((ingresosRes.data as Ingreso[]) ?? [])
    setEgresos((egresosRes.data as Egreso[]) ?? [])
    setGenerado(true)
    setLoading(false)
  }

  const totales = useMemo(() => {
    const totalIngresos = ingresos.reduce((s, r) => s + (r.monto_total ?? 0), 0)
    const totalEgresos  = egresos.reduce((s, e) => s + (e.monto ?? 0), 0)
    const saldo = totalIngresos - totalEgresos
    return { totalIngresos, totalEgresos, saldo }
  }, [ingresos, egresos])

  async function handleExportar() {
    const { utils, writeFile } = await import('xlsx')

    // Hoja 1: Ingresos
    const headersIngresos = [
      'Nro Recibo', 'Fecha', 'Socio', 'Canal', 'Estado',
      'Aporte (S/)', 'Capital (S/)', 'Interés (S/)', 'FPS (S/)', 'Otros (S/)', 'Total (S/)',
    ]
    const rowsIngresos = ingresos.map(r => [
      r.nro_recibo,
      formatDate(r.fecha),
      r.socios ? `${r.socios.apellidos}, ${r.socios.nombres}` : '',
      CANAL_LABELS[r.canal_pago],
      ESTADO_LABELS[r.estado_flujo],
      r.monto_aporte,
      r.monto_capital,
      r.monto_interes,
      r.monto_fps,
      (r.monto_fps_extra ?? 0) + (r.monto_otros ?? 0),
      r.monto_total,
    ])
    rowsIngresos.push([] as unknown as (string | number)[])
    rowsIngresos.push(['', '', '', '', 'TOTAL INGRESOS', '', '', '', '', '', totales.totalIngresos])

    // Hoja 2: Egresos
    const headersEgresos = ['Fecha', 'Tipo', 'Beneficiario', 'Descripción', 'Monto (S/)']
    const rowsEgresos = egresos.map(e => [
      formatDate(e.fecha),
      TIPO_EGRESO_LABELS[e.tipo],
      e.beneficiario ?? '',
      e.descripcion ?? '',
      e.monto,
    ])
    rowsEgresos.push([] as unknown as (string | number)[])
    rowsEgresos.push(['', '', '', 'TOTAL EGRESOS', totales.totalEgresos])
    rowsEgresos.push(['', '', '', 'SALDO DEL PERÍODO', totales.saldo])

    const wsIngresos = utils.aoa_to_sheet([headersIngresos, ...rowsIngresos])
    const wsEgresos  = utils.aoa_to_sheet([headersEgresos, ...rowsEgresos])
    const wb = utils.book_new()
    utils.book_append_sheet(wb, wsIngresos, 'Ingresos')
    utils.book_append_sheet(wb, wsEgresos, 'Egresos')

    const mesStr = String(mes).padStart(2, '0')
    writeFile(wb, `ReporteCaja_CEJUASSA_${mesStr}${anio}.xlsx`)
  }

  return (
    <div className="p-8">
      {/* Encabezado */}
      <div className="mb-6">
        <Link
          href="/dashboard/reportes"
          className="text-sm text-gray-400 hover:text-gray-600 mb-2 inline-block transition-colors"
        >
          ← Reportes
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Reporte de Caja</h1>
            <p className="text-sm text-gray-500 mt-0.5">Ingresos y egresos del período</p>
          </div>
          <span
            className="px-3 py-1 rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: '#1e3a5f' }}
          >
            COOPAC CEJUASSA
          </span>
        </div>
      </div>

      {/* Controles / Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <p className="text-sm font-medium text-gray-600 mb-3">Período y filtros</p>
        <div className="flex flex-wrap gap-3 items-center">
          <select
            value={mes}
            onChange={e => setMes(Number(e.target.value))}
            className={inputCls}
          >
            {MESES.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={anio}
            onChange={e => setAnio(Number(e.target.value))}
            className={inputCls}
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select
            value={canalFilter}
            onChange={e => setCanalFilter(e.target.value as CanalPago | '')}
            className={inputCls}
          >
            <option value="">Todos los canales</option>
            <option value="caja">Caja</option>
            <option value="convenio">Convenio</option>
          </select>
          <button
            onClick={handleGenerar}
            disabled={loading}
            className="px-5 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: '#1e3a5f' }}
          >
            {loading ? 'Generando...' : 'Generar Reporte'}
          </button>
          {generado && (ingresos.length > 0 || egresos.length > 0) && (
            <button
              onClick={handleExportar}
              className="px-5 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <span>⬇</span> Exportar Excel
            </button>
          )}
        </div>
        {canalFilter && (
          <p className="text-xs text-gray-400 mt-2">
            * El filtro de canal aplica solo a Ingresos. Los Egresos siempre se muestran completos.
          </p>
        )}
      </div>

      {/* Contenido del reporte */}
      {generado && (
        <>
          {/* Resumen destacado */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-5 mb-6">
            <p className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Resumen del período — {MESES[mes - 1]} {anio}</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                <p className="text-xs text-green-600 uppercase tracking-wide mb-1 font-medium">Total Ingresos</p>
                <p className="text-2xl font-bold text-green-700">S/ {fmt(totales.totalIngresos)}</p>
                <p className="text-xs text-green-500 mt-1">{ingresos.length} {ingresos.length === 1 ? 'recibo' : 'recibos'}</p>
              </div>
              <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                <p className="text-xs text-red-600 uppercase tracking-wide mb-1 font-medium">Total Egresos</p>
                <p className="text-2xl font-bold text-red-600">S/ {fmt(totales.totalEgresos)}</p>
                <p className="text-xs text-red-400 mt-1">{egresos.length} {egresos.length === 1 ? 'egreso' : 'egresos'}</p>
              </div>
              <div className={`rounded-xl p-4 border ${totales.saldo >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-red-50 border-red-200'}`}>
                <p className={`text-xs uppercase tracking-wide mb-1 font-medium ${totales.saldo >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  Saldo del Período
                </p>
                <p className={`text-2xl font-bold ${totales.saldo >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {totales.saldo >= 0 ? '' : '−'} S/ {fmt(Math.abs(totales.saldo))}
                </p>
                <p className={`text-xs mt-1 ${totales.saldo >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                  {totales.saldo >= 0 ? 'Superávit' : 'Déficit'}
                </p>
              </div>
            </div>
          </div>

          {/* Sección Ingresos */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-lg font-semibold text-gray-800">Ingresos</h2>
              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                {ingresos.length} {ingresos.length === 1 ? 'recibo' : 'recibos'}
              </span>
              {canalFilter && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CANAL_COLORS[canalFilter]}`}>
                  {CANAL_LABELS[canalFilter]}
                </span>
              )}
            </div>

            {ingresos.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-sm text-gray-400">
                No hay ingresos para el período{canalFilter ? ` con canal "${CANAL_LABELS[canalFilter]}"` : ''}.
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        {['Fecha', 'Nro Recibo', 'Socio', 'Canal', 'Aporte', 'Capital', 'Interés', 'FPS', 'Otros', 'Total'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {ingresos.map(r => (
                        <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                            {formatDate(r.fecha)}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-gray-700 whitespace-nowrap">
                            {r.nro_recibo}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                            {r.socios ? `${r.socios.apellidos}, ${r.socios.nombres}` : '—'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CANAL_COLORS[r.canal_pago]}`}>
                              {CANAL_LABELS[r.canal_pago]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                            {r.monto_aporte > 0 ? `S/ ${fmt(r.monto_aporte)}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                            {r.monto_capital > 0 ? `S/ ${fmt(r.monto_capital)}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                            {r.monto_interes > 0 ? `S/ ${fmt(r.monto_interes)}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                            {r.monto_fps > 0 ? `S/ ${fmt(r.monto_fps)}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                            {((r.monto_fps_extra ?? 0) + (r.monto_otros ?? 0)) > 0
                              ? `S/ ${fmt((r.monto_fps_extra ?? 0) + (r.monto_otros ?? 0))}`
                              : '—'}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900 whitespace-nowrap">
                            S/ {fmt(r.monto_total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-green-50 border-t-2 border-green-100">
                        <td colSpan={9} className="px-4 py-3 text-sm font-semibold text-green-700 text-right">
                          Total Ingresos
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-green-700 whitespace-nowrap">
                          S/ {fmt(totales.totalIngresos)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Sección Egresos */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-lg font-semibold text-gray-800">Egresos</h2>
              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                {egresos.length} {egresos.length === 1 ? 'egreso' : 'egresos'}
              </span>
            </div>

            {egresos.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-sm text-gray-400">
                No hay egresos para el período seleccionado.
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        {['Fecha', 'Tipo', 'Beneficiario', 'Descripción', 'Monto'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {egresos.map(e => (
                        <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                            {formatDate(e.fecha)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TIPO_EGRESO_COLORS[e.tipo]}`}>
                              {TIPO_EGRESO_LABELS[e.tipo]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                            {e.beneficiario ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 max-w-[220px]">
                            <span className="block truncate" title={e.descripcion ?? ''}>
                              {e.descripcion ?? '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900 whitespace-nowrap">
                            S/ {fmt(e.monto)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-red-50 border-t-2 border-red-100">
                        <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-red-600 text-right">
                          Total Egresos
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-red-600 whitespace-nowrap">
                          S/ {fmt(totales.totalEgresos)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
