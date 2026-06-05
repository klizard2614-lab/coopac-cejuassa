'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

// ─── tipos ────────────────────────────────────────────────────────────────────

type Socio = {
  nombres: string
  apellidos: string
  dni: string
  nro_socio: string
  fecha_nacimiento: string | null
  direccion: string | null
  id_convenio: number | null
  convenios: { nombre: string } | null
}

type Credito = {
  id: number
  nro_pagare: string
  fecha_desembolso: string
  monto_aprobado: number
  tasa_interes: number
  plazo_meses: number
  saldo_capital: number
  socios: Socio | null
}

type Cuota = {
  id_credito: number
  nro_cuota: number
  fecha_vencimiento: string
  estado: string
}

type FilaReporte = {
  fila: number
  credito: Credito
  dias_mora: number
  clasificacion: string
  clasif_num: number
  tasa_provision: number
  provision_requerida: number
  cuotas_pagadas: number
  fecha_ultima_cuota: string
  capital_vigente: number
  capital_vencido: number
  capital_judicial: number
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function getClasificacion(dias: number): { label: string; num: number; tasa: number } {
  if (dias <= 8)   return { label: 'Normal',     num: 0, tasa: 0.01 }
  if (dias <= 30)  return { label: 'CPP',        num: 1, tasa: 0.05 }
  if (dias <= 60)  return { label: 'Deficiente', num: 2, tasa: 0.25 }
  if (dias <= 120) return { label: 'Dudoso',     num: 3, tasa: 0.60 }
  return             { label: 'Pérdida',     num: 4, tasa: 1.00 }
}

function diasEntre(fechaStr: string, hoy: Date): number {
  const f = new Date(fechaStr + 'T00:00:00')
  return Math.floor((hoy.getTime() - f.getTime()) / 86400000)
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function formatDate(d: string) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function toYMD(d: string | null | undefined): string {
  if (!d) return ''
  return d.replace(/-/g, '').slice(0, 8)
}

function buildYearOptions() {
  const y = new Date().getFullYear()
  return [y, y - 1, y - 2, y - 3]
}

const COLORES: Record<string, { bg: string; text: string }> = {
  Normal:     { bg: 'bg-green-100',  text: 'text-green-800' },
  CPP:        { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  Deficiente: { bg: 'bg-orange-100', text: 'text-orange-800' },
  Dudoso:     { bg: 'bg-red-100',    text: 'text-red-700' },
  Pérdida:    { bg: 'bg-red-200',    text: 'text-red-900' },
}

function ClasifBadge({ c }: { c: string }) {
  const col = COLORES[c] ?? COLORES['Normal']
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${col.bg} ${col.text}`}>
      {c}
    </span>
  )
}

const PAGE_SIZE = 50

// ─── componente ───────────────────────────────────────────────────────────────

export default function Anexo6Page() {
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [anio, setAnio] = useState(now.getFullYear())
  const [filas, setFilas] = useState<FilaReporte[]>([])
  const [loading, setLoading] = useState(false)
  const [generado, setGenerado] = useState(false)
  const [pagina, setPagina] = useState(1)

  const yearOptions = useMemo(() => buildYearOptions(), [])

  async function handleGenerar() {
    setLoading(true)
    setGenerado(false)
    setPagina(1)
    const sb = createClient()

    const [creditosRes, cuotasRes] = await Promise.all([
      sb
        .from('creditos')
        .select(`
          id, nro_pagare, fecha_desembolso, monto_aprobado, tasa_interes,
          plazo_meses, saldo_capital,
          socios(nombres, apellidos, dni, nro_socio, fecha_nacimiento, direccion, id_convenio, convenios(nombre))
        `)
        .eq('estado', 'vigente'),
      sb
        .from('cronograma_cuotas')
        .select('id_credito, nro_cuota, fecha_vencimiento, estado')
        .order('nro_cuota'),
    ])

    const creditos = (creditosRes.data as unknown as Credito[]) ?? []
    const todasCuotas = (cuotasRes.data as Cuota[]) ?? []

    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    // Agrupar cuotas por crédito
    const cuotasPorCredito: Record<number, Cuota[]> = {}
    for (const cu of todasCuotas) {
      if (!cuotasPorCredito[cu.id_credito]) cuotasPorCredito[cu.id_credito] = []
      cuotasPorCredito[cu.id_credito].push(cu)
    }

    const resultado: FilaReporte[] = creditos.map((c, idx) => {
      const cuotas = cuotasPorCredito[c.id] ?? []

      // Mora: cuota pendiente/vencida/parcial más antigua
      const pendientes = cuotas.filter(cu =>
        cu.estado === 'pendiente' || cu.estado === 'vencida' || cu.estado === 'parcial'
      )
      let dias_mora = 0
      if (pendientes.length > 0) {
        const minFecha = pendientes.reduce((min, cu) =>
          cu.fecha_vencimiento < min ? cu.fecha_vencimiento : min,
          pendientes[0].fecha_vencimiento
        )
        dias_mora = Math.max(0, diasEntre(minFecha, hoy))
      }

      const { label, num, tasa } = getClasificacion(dias_mora)
      const provision_requerida = (c.saldo_capital ?? 0) * tasa
      const cuotas_pagadas = cuotas.filter(cu => cu.estado === 'pagada').length
      const ultima = cuotas.length > 0
        ? cuotas.reduce((max, cu) => cu.fecha_vencimiento > max ? cu.fecha_vencimiento : max, cuotas[0].fecha_vencimiento)
        : ''

      const capital_vigente  = dias_mora === 0 ? (c.saldo_capital ?? 0) : 0
      const capital_judicial = dias_mora > 120 ? (c.saldo_capital ?? 0) : 0
      const capital_vencido  = dias_mora > 0 && dias_mora <= 120 ? (c.saldo_capital ?? 0) : 0

      return {
        fila: idx + 1,
        credito: c,
        dias_mora,
        clasificacion: label,
        clasif_num: num,
        tasa_provision: tasa,
        provision_requerida,
        cuotas_pagadas,
        fecha_ultima_cuota: ultima,
        capital_vigente,
        capital_vencido,
        capital_judicial,
      }
    })

    // Ordenar: clasificación DESC (Pérdida primero)
    resultado.sort((a, b) => b.clasif_num - a.clasif_num)
    // Reasignar fila tras ordenar
    resultado.forEach((r, i) => { r.fila = i + 1 })

    setFilas(resultado)
    setGenerado(true)
    setLoading(false)
  }

  async function handleExportar() {
    const { utils, writeFile } = await import('xlsx')

    const headers = [
      'Fila',
      'Apellidos y Nombres',
      'Fecha de Nacimiento',
      'Género',
      'Estado Civil',
      'Sigla Empresa',
      'Código Socio',
      'Partida Registral',
      'Tipo de Documento',
      'Número de Documento',
      'Tipo de Persona',
      'Domicilio',
      'Relación Laboral Coop.',
      'Clasificación Deudor',
      'Clasif. Alineam. Interno',
      'Código Agencia',
      'Moneda',
      'Número de Crédito',
      'Tipo de Crédito',
      'Sub Tipo de Crédito',
      'Fecha de Desembolso',
      'Monto de Desembolso',
      'Tasa de Interés Anual',
      'Saldo de Colocaciones',
      'Cuenta Contable',
      'Capital Vigente',
      'Capital Reestructurado',
      'Capital Refinanciado',
      'Capital Vencido',
      'Capital en Cobranza Judicial',
      'Capital Contingente',
      'Cta. Contable Cap. Contingente',
      'Días de Mora',
      'Saldo Garantías Preferidas',
      'Saldo Garantías Autoliquidables',
      'Provisiones Requeridas',
      'Provisiones Constituidas',
      'Saldo Créditos Castigados',
      'Cta. Contable Créd. Castigado',
      'Rendimiento Devengado',
      'Intereses en Suspenso',
      'Ingresos Diferidos',
      'Tipo de Producto',
      'N° Cuotas Programadas',
      'N° Cuotas Pagadas',
      'Periodicidad de la Cuota',
      'Periodo de Gracia',
      'Fecha Vencimiento Original',
      'Fecha Vencimiento Actual',
      'Col50','Col51','Col52','Col53','Col54',
      'Col55','Col56','Col57','Col58','Col59','Col60',
    ]

    const rows = filas.map(f => {
      const s = f.credito.socios
      return [
        f.fila,
        s ? `${s.apellidos} ${s.nombres}` : '',
        toYMD(s?.fecha_nacimiento),
        'M',
        'S',
        s?.convenios?.nombre ?? '',
        s?.nro_socio ?? '',
        '',
        1,
        s?.dni ?? '',
        1,
        s?.direccion ?? '',
        0,
        f.clasif_num,
        f.clasif_num,
        '001',
        '01',
        f.credito.nro_pagare,
        '',
        '',
        toYMD(f.credito.fecha_desembolso),
        f.credito.monto_aprobado,
        f.credito.tasa_interes,
        f.credito.saldo_capital,
        '1411030604',
        f.capital_vigente,
        0,
        0,
        f.capital_vencido,
        f.capital_judicial,
        0,
        '',
        f.dias_mora,
        0,
        0,
        f.provision_requerida,
        f.provision_requerida,
        0,
        '',
        0,
        0,
        0,
        '18',
        f.credito.plazo_meses,
        f.cuotas_pagadas,
        30,
        '',
        toYMD(f.fecha_ultima_cuota),
        toYMD(f.fecha_ultima_cuota),
        0,0,0,0,0,0,0,0,0,0,0,
      ]
    })

    const ws = utils.aoa_to_sheet([headers, ...rows])
    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, 'Anexo6')

    const mesStr = String(mes).padStart(2, '0')
    writeFile(wb, `Anexo6_CEJUASSA_${mesStr}${anio}.xlsx`)
  }

  // Totales
  const totales = useMemo(() => ({
    deudores: filas.length,
    saldo: filas.reduce((s, f) => s + (f.credito.saldo_capital ?? 0), 0),
    provision: filas.reduce((s, f) => s + f.provision_requerida, 0),
    conMora: filas.filter(f => f.dias_mora > 0).length,
  }), [filas])

  // Paginación
  const totalPaginas = Math.ceil(filas.length / PAGE_SIZE)
  const filasPagina = filas.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE)

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
            <h1 className="text-2xl font-bold text-gray-800">Anexo N°6 — Reporte de Deudores</h1>
            <p className="text-sm text-gray-500 mt-0.5">Superintendencia de Banca, Seguros y AFP</p>
          </div>
          <span
            className="px-3 py-1 rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: '#1e3a5f' }}
          >
            COOPAC CEJUASSA
          </span>
        </div>
      </div>

      {/* Controles */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <p className="text-sm font-medium text-gray-600 mb-3">Período de referencia</p>
        <div className="flex flex-wrap gap-3 items-center">
          <select
            value={mes}
            onChange={e => setMes(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
          >
            {MESES.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={anio}
            onChange={e => setAnio(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            onClick={handleGenerar}
            disabled={loading}
            className="px-5 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: '#1e3a5f' }}
          >
            {loading ? 'Generando...' : 'Generar Reporte'}
          </button>
          {generado && filas.length > 0 && (
            <button
              onClick={handleExportar}
              className="px-5 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <span>⬇</span> Exportar Excel
            </button>
          )}
        </div>
      </div>

      {/* Tarjetas resumen */}
      {generado && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total deudores',           value: totales.deudores.toString() },
              { label: 'Saldo total cartera',      value: `S/ ${fmt(totales.saldo)}` },
              { label: 'Provisión total requerida', value: `S/ ${fmt(totales.provision)}` },
              { label: 'Créditos con mora',        value: totales.conMora.toString() },
            ].map(t => (
              <div key={t.label} className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{t.label}</p>
                <p className="text-xl font-bold" style={{ color: '#1e3a5f' }}>{t.value}</p>
              </div>
            ))}
          </div>

          {filas.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-16 text-center text-sm text-gray-400">
              No hay créditos vigentes para el período seleccionado.
            </div>
          ) : (
            <>
              {/* Tabla */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-600">
                    {filas.length} registros — {MESES[mes - 1]} {anio}
                  </p>
                  {totalPaginas > 1 && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <button
                        onClick={() => setPagina(p => Math.max(1, p - 1))}
                        disabled={pagina === 1}
                        className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                      >
                        ‹
                      </button>
                      <span>Pág. {pagina} / {totalPaginas}</span>
                      <button
                        onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                        disabled={pagina === totalPaginas}
                        className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                      >
                        ›
                      </button>
                    </div>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        {['Fila','Socio','DNI','Cód. Socio','Nº Crédito','Fecha Desemb.','Monto','Tasa','Saldo Capital','Cap. Vigente','Días Mora','Clasificación','Provisión Req.','Provisión Const.','Cuotas Prog.','Cuotas Pagadas'].map(h => (
                          <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filasPagina.map(f => (
                        <tr key={f.credito.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-3 py-2.5 text-xs text-gray-400">{f.fila}</td>
                          <td className="px-3 py-2.5 text-sm font-medium text-gray-900 whitespace-nowrap">
                            {f.credito.socios ? `${f.credito.socios.apellidos}, ${f.credito.socios.nombres}` : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-sm text-gray-600 whitespace-nowrap">
                            {f.credito.socios?.dni ?? '—'}
                          </td>
                          <td className="px-3 py-2.5 text-sm text-gray-600 whitespace-nowrap">
                            {f.credito.socios?.nro_socio ?? '—'}
                          </td>
                          <td className="px-3 py-2.5 text-sm text-gray-600 whitespace-nowrap font-mono">
                            {f.credito.nro_pagare}
                          </td>
                          <td className="px-3 py-2.5 text-sm text-gray-600 whitespace-nowrap">
                            {formatDate(f.credito.fecha_desembolso)}
                          </td>
                          <td className="px-3 py-2.5 text-sm text-gray-700 whitespace-nowrap">
                            S/ {fmt(f.credito.monto_aprobado)}
                          </td>
                          <td className="px-3 py-2.5 text-sm text-gray-600 whitespace-nowrap">
                            {fmt(f.credito.tasa_interes)}%
                          </td>
                          <td className="px-3 py-2.5 text-sm font-semibold text-gray-900 whitespace-nowrap">
                            S/ {fmt(f.credito.saldo_capital)}
                          </td>
                          <td className="px-3 py-2.5 text-sm text-gray-700 whitespace-nowrap">
                            S/ {fmt(f.capital_vigente)}
                          </td>
                          <td className="px-3 py-2.5 text-sm whitespace-nowrap">
                            <span className={f.dias_mora > 0 ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                              {f.dias_mora}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <ClasifBadge c={f.clasificacion} />
                          </td>
                          <td className="px-3 py-2.5 text-sm text-gray-700 whitespace-nowrap">
                            S/ {fmt(f.provision_requerida)}
                          </td>
                          <td className="px-3 py-2.5 text-sm text-gray-700 whitespace-nowrap">
                            S/ {fmt(f.provision_requerida)}
                          </td>
                          <td className="px-3 py-2.5 text-sm text-gray-600 whitespace-nowrap text-center">
                            {f.credito.plazo_meses}
                          </td>
                          <td className="px-3 py-2.5 text-sm text-gray-600 whitespace-nowrap text-center">
                            {f.cuotas_pagadas}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {totalPaginas > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4 text-sm text-gray-500">
                  <button
                    onClick={() => setPagina(p => Math.max(1, p - 1))}
                    disabled={pagina === 1}
                    className="px-3 py-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                  >
                    ← Anterior
                  </button>
                  <span>Página {pagina} de {totalPaginas}</span>
                  <button
                    onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                    disabled={pagina === totalPaginas}
                    className="px-3 py-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                  >
                    Siguiente →
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
