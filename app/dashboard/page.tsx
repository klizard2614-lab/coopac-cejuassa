'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts'
import {
  ExecutiveMetricPanel,
  RiskPanel,
  CompactKpi,
  FinanceChartPanel,
  PeriodBadge,
  OperationalAlert,
  EmptyChartState,
} from './_components/ui'

// ─── paleta institucional ─────────────────────────────────────────────────────

const PALETTE = {
  institutional: '#1E3A5F',
  slate300:      '#CBD5E1',
  teal:          '#0F766E',
  risk:          '#DC2626',
  success:       '#059669',
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n ?? 0)
}

function fmtInt(n: number) {
  return new Intl.NumberFormat('es-PE').format(n)
}

function fmtEje(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(0)}k`
  return String(Math.round(v))
}

function getCurrentPeriodo() {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${d.getFullYear()}-${mm}`
}

function fechaHoy() {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function getMesNombre() {
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  return MESES[new Date().getMonth()]
}

function diasEntre(fechaStr: string, hoy: Date): number {
  const f = new Date(fechaStr + 'T00:00:00')
  return Math.floor((hoy.getTime() - f.getTime()) / 86400000)
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

function getTasaProvision(dias: number, t: TasasProvision): number {
  if (dias <= 8)   return t.normal
  if (dias <= 30)  return t.cpp
  if (dias <= 60)  return t.deficiente
  if (dias <= 120) return t.dudoso
  return t.perdida
}

const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function getUltimos6Meses(): { mes: string; label: string }[] {
  const result: { mes: string; label: string }[] = []
  const hoy = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
    const mes   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = `${MESES_CORTOS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
    result.push({ mes, label })
  }
  return result
}

// ─── tipos ────────────────────────────────────────────────────────────────────

type CreditoMin = { id: number; saldo_capital: number; id_socio: number }
type CuotaMin   = { id_credito: number; fecha_vencimiento: string; estado: string }
type PagoMin    = { monto_total: number; monto_aporte: number }

type Indicadores = {
  sociosActivos: number
  sociosConCredito: number
  saldoCartera: number
  creditosVigentes: number
  moraActual: number
  creditosEnMora: number
  recaudadoMes: number
  aportesMes: number
  pagosMes: number
  provisionTotal: number
  hayVencidos: boolean
}

type GrafMes     = { mes: string; label: string; ingresos: number; egresos: number }
type GrafAporte  = { mes: string; label: string; total: number }
type GrafCartera = { estado: string; label: string; cantidad: number; monto: number; color: string }

// ─── colores cartera ──────────────────────────────────────────────────────────

const CARTERA_COLORS: Record<string, string> = {
  vigente:      PALETTE.institutional,
  cancelado:    PALETTE.success,
  castigado:    PALETTE.risk,
  refinanciado: '#F59E0B',
}
const CARTERA_LABELS: Record<string, string> = {
  vigente:      'Vigente',
  cancelado:    'Cancelado',
  castigado:    'Castigado',
  refinanciado: 'Refinanciado',
}

// ─── tooltips minimalistas ────────────────────────────────────────────────────

function TooltipBarras({ active, payload, label }: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 shadow-sm text-xs">
      <p className="font-semibold text-slate-700 mb-1.5">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }} className="mt-0.5 tabular-nums">
          {p.name}: S/ {fmt(p.value ?? 0)}
        </p>
      ))}
    </div>
  )
}

function TooltipAportes({ active, payload, label }: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 shadow-sm text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      <p className="tabular-nums" style={{ color: PALETTE.teal }}>S/ {fmt(payload[0]?.value ?? 0)}</p>
    </div>
  )
}

function TooltipCartera({ active, payload }: {
  active?: boolean
  payload?: { payload: GrafCartera }[]
}) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 shadow-sm text-xs">
      <p className="font-semibold mb-1.5" style={{ color: d.color }}>{d.label}</p>
      <p className="text-slate-500 tabular-nums">{d.cantidad} créditos</p>
      <p className="text-slate-700 font-medium tabular-nums">S/ {fmt(d.monto)}</p>
    </div>
  )
}

// ─── acción rápida ────────────────────────────────────────────────────────────

function AccionRapida({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="text-xs text-slate-500 hover:text-[#1E3A5F] transition-colors duration-150"
    >
      {label}
    </Link>
  )
}

// ─── página ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData]                 = useState<Indicadores | null>(null)
  const [loading, setLoading]           = useState(true)
  const [tasasWarning, setTasasWarning] = useState(false)
  const [grafMeses, setGrafMeses]       = useState<GrafMes[]>([])
  const [grafAportes, setGrafAportes]   = useState<GrafAporte[]>([])
  const [grafCartera, setGrafCartera]   = useState<GrafCartera[]>([])
  const mesNombre = getMesNombre()

  useEffect(() => {
    async function fetchAll() {
      const sb      = createClient()
      const periodo = getCurrentPeriodo()
      const hoy     = new Date()
      hoy.setHours(0, 0, 0, 0)

      const inicio6m    = new Date(hoy.getFullYear(), hoy.getMonth() - 5, 1)
      const inicio6mStr = `${inicio6m.getFullYear()}-${String(inicio6m.getMonth() + 1).padStart(2, '0')}-01`

      try {
        let tasasActivas = TASAS_DEFECTO
        const cfgRes = await sb
          .from('configuracion')
          .select('provision_normal,provision_cpp,provision_deficiente,provision_dudoso,provision_perdida')
          .eq('id', 1)
          .single()
        if (cfgRes.data) {
          tasasActivas = {
            normal:     cfgRes.data.provision_normal     ?? TASAS_DEFECTO.normal,
            cpp:        cfgRes.data.provision_cpp        ?? TASAS_DEFECTO.cpp,
            deficiente: cfgRes.data.provision_deficiente ?? TASAS_DEFECTO.deficiente,
            dudoso:     cfgRes.data.provision_dudoso     ?? TASAS_DEFECTO.dudoso,
            perdida:    cfgRes.data.provision_perdida    ?? TASAS_DEFECTO.perdida,
          }
          setTasasWarning(false)
        } else {
          setTasasWarning(true)
        }

        const [
          sociosRes, creditosRes, cuotasRes, pagosRes,
          pagosHistRes, egresosHistRes, aportesHistRes, carteraEstadoRes,
        ] = await Promise.all([
          sb.from('socios').select('id', { count: 'exact', head: true }).eq('estado', 'activo'),
          sb.from('creditos').select('id, saldo_capital, id_socio').eq('estado', 'vigente'),
          sb.from('cronograma_cuotas').select('id_credito, fecha_vencimiento, estado').in('estado', ['pendiente', 'vencida', 'parcial']),
          sb.from('pagos_recibos').select('monto_total, monto_aporte').eq('periodo', periodo),
          sb.from('pagos_recibos').select('fecha, monto_total').gte('fecha', inicio6mStr),
          sb.from('egresos').select('fecha, monto').gte('fecha', inicio6mStr),
          sb.from('aportes').select('fecha, monto').eq('tipo', 'aporte').gte('fecha', inicio6mStr),
          sb.from('creditos').select('estado, saldo_capital'),
        ])

        const creditos      = (creditosRes.data as CreditoMin[]) ?? []
        const cuotas        = (cuotasRes.data  as CuotaMin[])   ?? []
        const pagos         = (pagosRes.data   as PagoMin[])    ?? []
        const sociosActivos = sociosRes.count ?? 0

        const creditosVigentes = creditos.length
        const sociosConCredito = new Set(creditos.map(c => c.id_socio)).size
        const saldoCartera     = creditos.reduce((s, c) => s + (c.saldo_capital ?? 0), 0)

        const minFechaPorCredito: Record<number, string> = {}
        for (const cu of cuotas) {
          const prev = minFechaPorCredito[cu.id_credito]
          if (!prev || cu.fecha_vencimiento < prev) {
            minFechaPorCredito[cu.id_credito] = cu.fecha_vencimiento
          }
        }

        let moraActual = 0, creditosEnMora = 0, provisionTotal = 0, hayVencidos = false

        for (const c of creditos) {
          const minFecha = minFechaPorCredito[c.id]
          const dias     = minFecha ? Math.max(0, diasEntre(minFecha, hoy)) : 0
          provisionTotal += (c.saldo_capital ?? 0) * getTasaProvision(dias, tasasActivas)

          const tieneEnMora = cuotas.some(cu => {
            if (cu.id_credito !== c.id) return false
            if (cu.estado === 'vencida') return true
            if (['pendiente', 'parcial'].includes(cu.estado)) {
              return new Date(cu.fecha_vencimiento + 'T00:00:00') < hoy
            }
            return false
          })
          if (tieneEnMora) { moraActual += c.saldo_capital ?? 0; creditosEnMora++; hayVencidos = true }
        }

        const recaudadoMes = pagos.reduce((s, p) => s + (p.monto_total ?? 0), 0)
        const aportesMes   = pagos.reduce((s, p) => s + (p.monto_aporte ?? 0), 0)
        const pagosMes     = pagos.length

        setData({ sociosActivos, sociosConCredito, saldoCartera, creditosVigentes,
          moraActual, creditosEnMora, recaudadoMes, aportesMes, pagosMes, provisionTotal, hayVencidos })

        // Gráficos
        const meses6 = getUltimos6Meses()
        const ingresosMap: Record<string, number> = {}
        for (const p of (pagosHistRes.data ?? []) as { fecha: string; monto_total: number }[]) {
          const m = p.fecha.slice(0, 7)
          ingresosMap[m] = (ingresosMap[m] ?? 0) + (p.monto_total ?? 0)
        }
        const egresosMap: Record<string, number> = {}
        for (const e of (egresosHistRes.data ?? []) as { fecha: string; monto: number }[]) {
          const m = e.fecha.slice(0, 7)
          egresosMap[m] = (egresosMap[m] ?? 0) + (e.monto ?? 0)
        }
        setGrafMeses(meses6.map(({ mes, label }) => ({
          mes, label, ingresos: ingresosMap[mes] ?? 0, egresos: egresosMap[mes] ?? 0,
        })))

        const aportesMap: Record<string, number> = {}
        for (const a of (aportesHistRes.data ?? []) as { fecha: string; monto: number }[]) {
          const m = a.fecha.slice(0, 7)
          aportesMap[m] = (aportesMap[m] ?? 0) + (a.monto ?? 0)
        }
        setGrafAportes(meses6.map(({ mes, label }) => ({ mes, label, total: aportesMap[mes] ?? 0 })))

        const carteraMap: Record<string, { cantidad: number; monto: number }> = {}
        for (const c of (carteraEstadoRes.data ?? []) as { estado: string; saldo_capital: number }[]) {
          if (!carteraMap[c.estado]) carteraMap[c.estado] = { cantidad: 0, monto: 0 }
          carteraMap[c.estado].cantidad++
          carteraMap[c.estado].monto += c.saldo_capital ?? 0
        }
        setGrafCartera(
          Object.entries(carteraMap)
            .map(([estado, { cantidad, monto }]) => ({
              estado, label: CARTERA_LABELS[estado] ?? estado, cantidad, monto,
              color: CARTERA_COLORS[estado] ?? '#94A3B8',
            }))
            .sort((a, b) => b.monto - a.monto)
        )
      } catch (err) {
        console.error('Error cargando dashboard:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  const pctProvision = data && data.saldoCartera > 0
    ? (data.provisionTotal / data.saldoCartera) * 100
    : 0

  const hasMora = (data?.creditosEnMora ?? 0) > 0

  return (
    <div className="p-6 min-h-screen" style={{ backgroundColor: '#F1F5F9' }}>

      {/* [A] Header ejecutivo */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-base font-semibold tracking-tight" style={{ color: '#1E3A5F' }}>
            Panel Ejecutivo
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
            COOPAC CEJUASSA · {fechaHoy()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodBadge period={mesNombre} />
          <OperationalAlert hayVencidos={data?.hayVencidos} loading={loading} />
        </div>
      </div>

      {/* [B] Financial Overview — cartera + mora */}
      <div className="grid grid-cols-12 gap-4 mb-4">
        <div className="col-span-7">
          <ExecutiveMetricPanel
            saldoCarteraFmt={data ? `S/ ${fmt(data.saldoCartera)}` : '—'}
            creditosFmt={data ? fmtInt(data.creditosVigentes) : '—'}
            sociosFmt={data ? fmtInt(data.sociosActivos) : '—'}
            provisionFmt={data ? `S/ ${fmt(data.provisionTotal)}` : '—'}
            pctFmt={`${pctProvision.toFixed(1)}%`}
            loading={loading}
          />
        </div>
        <div className="col-span-5">
          <RiskPanel
            hasMora={hasMora}
            moraFmt={data ? `S/ ${fmt(data.moraActual)}` : '—'}
            creditosAfectadosFmt={data ? fmtInt(data.creditosEnMora) : '—'}
            creditosCount={data?.creditosEnMora ?? 0}
            loading={loading}
          />
        </div>
      </div>

      {/* [C] KPIs compactos — fila única sin cards individuales */}
      <div className="bg-white rounded-xl border border-slate-200 grid grid-cols-4 divide-x divide-slate-100 mb-4 overflow-hidden">
        <CompactKpi
          label={`Recaudado · ${mesNombre}`}
          value={data ? `S/ ${fmt(data.recaudadoMes)}` : '—'}
          loading={loading}
        />
        <CompactKpi
          label={`Aportes · ${mesNombre}`}
          value={data ? `S/ ${fmt(data.aportesMes)}` : '—'}
          loading={loading}
        />
        <CompactKpi
          label="Pagos del mes"
          value={data ? fmtInt(data.pagosMes) : '—'}
          loading={loading}
        />
        <CompactKpi
          label="Socios con crédito"
          value={data ? fmtInt(data.sociosConCredito) : '—'}
          loading={loading}
        />
      </div>

      {/* [D] Gráficos — distribución asimétrica 7/5 */}
      {loading ? (
        <div className="grid grid-cols-12 gap-4 mb-4">
          <div className="col-span-7 bg-white rounded-xl border border-slate-200 p-5">
            <div className="h-4 w-36 rounded bg-slate-100 animate-pulse mb-4" />
            <div className="h-[220px] rounded bg-slate-100 animate-pulse" />
          </div>
          <div className="col-span-5 bg-white rounded-xl border border-slate-200 p-5">
            <div className="h-4 w-28 rounded bg-slate-100 animate-pulse mb-4" />
            <div className="h-[220px] rounded bg-slate-100 animate-pulse" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-4 mb-4">

          {/* Ingresos vs Egresos */}
          <FinanceChartPanel
            title="Ingresos vs Egresos"
            subtitle="Últimos 6 meses"
            className="col-span-7"
          >
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={grafMeses} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={3}>
                <CartesianGrid strokeDasharray="3 0" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtEje} tick={{ fontSize: 10, fill: '#94A3B8' }} width={36} axisLine={false} tickLine={false} />
                <Tooltip content={<TooltipBarras />} cursor={{ fill: '#F8FAFC' }} />
                <Bar dataKey="ingresos" name="Ingresos" fill={PALETTE.institutional} radius={[3, 3, 0, 0]} maxBarSize={26} />
                <Bar dataKey="egresos"  name="Egresos"  fill={PALETTE.slate300}      radius={[3, 3, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2 rounded-sm" style={{ backgroundColor: PALETTE.institutional }} />
                <span className="text-xs text-slate-500">Ingresos</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2 rounded-sm" style={{ backgroundColor: PALETTE.slate300 }} />
                <span className="text-xs text-slate-500">Egresos</span>
              </div>
            </div>
          </FinanceChartPanel>

          {/* Estado de Cartera */}
          <FinanceChartPanel
            title="Estado de Cartera"
            subtitle="Por monto (S/)"
            className="col-span-5"
          >
            {grafCartera.length === 0 ? (
              <EmptyChartState height={200} />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={grafCartera} cx="50%" cy="50%"
                      innerRadius={48} outerRadius={72}
                      dataKey="monto" nameKey="label"
                      strokeWidth={2} stroke="#F1F5F9"
                      paddingAngle={2}
                    >
                      {grafCartera.map((entry, i) => (
                        <Cell key={`cell-${i}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<TooltipCartera />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 space-y-2 border-t border-slate-100 pt-2">
                  {grafCartera.map(g => (
                    <div key={g.estado} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} />
                        <span className="text-xs text-slate-600">{g.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 tabular-nums">{g.cantidad}</span>
                        <span className="text-xs font-medium text-slate-700 tabular-nums">
                          S/ {fmt(g.monto)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </FinanceChartPanel>

        </div>
      )}

      {/* [E] Evolución de Aportes — ancho completo */}
      {!loading && (
        <FinanceChartPanel
          title="Evolución de Aportes"
          subtitle="Últimos 6 meses"
          className="mb-4"
        >
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={grafAportes} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradAportes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={PALETTE.teal} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={PALETTE.teal} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 0" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtEje} tick={{ fontSize: 10, fill: '#94A3B8' }} width={36} axisLine={false} tickLine={false} />
              <Tooltip content={<TooltipAportes />} />
              <Area
                type="monotone" dataKey="total" name="Aportes"
                stroke={PALETTE.teal} strokeWidth={2} fill="url(#gradAportes)"
                dot={{ r: 3, fill: PALETTE.teal, strokeWidth: 0 }}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </FinanceChartPanel>
      )}

      {/* [F] Acciones — texto limpio, sin chips */}
      <div className="flex items-center gap-3 flex-wrap pt-1 pb-2">
        <span className="text-xs text-slate-400">Acciones rápidas</span>
        <span className="w-px h-3 bg-slate-300" />
        <AccionRapida href="/dashboard/socios/nuevo"    label="Nuevo socio" />
        <span className="text-slate-300 text-xs">·</span>
        <AccionRapida href="/dashboard/creditos/nuevo"  label="Nuevo crédito" />
        <span className="text-slate-300 text-xs">·</span>
        <AccionRapida href="/dashboard/pagos/nuevo"     label="Registrar pago" />
        <span className="text-slate-300 text-xs">·</span>
        <AccionRapida href="/dashboard/mora"            label="Ver mora" />
        <span className="text-slate-300 text-xs">·</span>
        <AccionRapida href="/dashboard/reportes/anexo6" label="Generar Anexo N°6" />
      </div>

      {/* Advertencia tasas por defecto */}
      {tasasWarning && !loading && (
        <div className="mt-3 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
          ⚠ Usando tasas de provisión SBS por defecto. Verificar en{' '}
          <Link href="/dashboard/configuracion" className="underline font-medium">Configuración</Link>.
        </div>
      )}

    </div>
  )
}
