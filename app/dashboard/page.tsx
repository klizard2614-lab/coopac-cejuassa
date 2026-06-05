'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts'
import {
  Users, CreditCard, TrendingUp, FileText, AlertTriangle,
  DollarSign, PiggyBank, Receipt, Shield, BarChart2,
  UserPlus, FilePlus, Wallet, ClipboardList,
  CheckCircle2, AlertCircle,
} from 'lucide-react'

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

function getTasaProvision(dias: number): number {
  if (dias <= 8)   return 0.01
  if (dias <= 30)  return 0.05
  if (dias <= 60)  return 0.25
  if (dias <= 120) return 0.60
  return 1.00
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

// ─── skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-[#F1F5F9] ${className}`} />
}

// ─── tarjeta KPI ──────────────────────────────────────────────────────────────

function Tarjeta({
  label, value, sub, Icon, iconColor, loading, danger,
}: {
  label: string
  value: string
  sub?: string
  Icon: React.ElementType
  iconColor?: string
  loading: boolean
  danger?: boolean
}) {
  return (
    <div
      className={`bg-white rounded-xl border p-5 flex flex-col gap-3 ${
        danger ? 'border-red-200' : 'border-[#E2E8F0]'
      }`}
      style={danger ? { backgroundColor: '#FEF2F2' } : undefined}
    >
      <div className="flex items-center justify-between">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: danger ? '#FEE2E2' : '#EFF6FF' }}
        >
          <Icon
            size={18}
            strokeWidth={1.8}
            style={{ color: danger ? '#DC2626' : (iconColor ?? '#1A56DB') }}
          />
        </div>
        {danger && (
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        )}
      </div>
      {loading ? (
        <>
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-3 w-32" />
        </>
      ) : (
        <>
          <p
            className="text-2xl font-bold tracking-tight"
            style={{ color: danger ? '#DC2626' : '#1E293B' }}
          >
            {value}
          </p>
          <div>
            <p className="text-sm" style={{ color: '#64748B' }}>{label}</p>
            {sub && <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{sub}</p>}
          </div>
        </>
      )}
    </div>
  )
}

// ─── acceso rápido ────────────────────────────────────────────────────────────

function AccesoRapido({ href, label, Icon }: { href: string; label: string; Icon: React.ElementType }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all hover:shadow-sm"
      style={{ borderColor: '#E2E8F0', backgroundColor: '#fff', color: '#1E293B' }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLAnchorElement
        el.style.borderColor = '#1A56DB'
        el.style.color = '#1A56DB'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLAnchorElement
        el.style.borderColor = '#E2E8F0'
        el.style.color = '#1E293B'
      }}
    >
      <Icon size={15} strokeWidth={2} />
      {label}
    </Link>
  )
}

// ─── tooltips personalizados ──────────────────────────────────────────────────

function TooltipBarras({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-lg p-3 shadow-lg text-xs">
      <p className="font-semibold text-[#1E293B] mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }} className="mt-0.5">
          {p.name}: S/ {fmt(p.value ?? 0)}
        </p>
      ))}
    </div>
  )
}

function TooltipAportes({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-lg p-3 shadow-lg text-xs">
      <p className="font-semibold text-[#1E293B] mb-1">{label}</p>
      <p className="text-green-700">Total: S/ {fmt(payload[0]?.value ?? 0)}</p>
    </div>
  )
}

function TooltipCartera({ active, payload }: { active?: boolean; payload?: { payload: GrafCartera }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-lg p-3 shadow-lg text-xs">
      <p className="font-semibold mb-1" style={{ color: d.color }}>{d.label}</p>
      <p style={{ color: '#64748B' }}>{d.cantidad} créditos</p>
      <p style={{ color: '#64748B' }}>S/ {fmt(d.monto)}</p>
    </div>
  )
}

// ─── colores cartera ──────────────────────────────────────────────────────────

const CARTERA_COLORS: Record<string, string> = {
  vigente:      '#1A56DB',
  cancelado:    '#22C55E',
  castigado:    '#EF4444',
  refinanciado: '#F59E0B',
}
const CARTERA_LABELS: Record<string, string> = {
  vigente:      'Vigente',
  cancelado:    'Cancelado',
  castigado:    'Castigado',
  refinanciado: 'Refinanciado',
}

// ─── encabezado de sección ───────────────────────────────────────────────────

function SeccionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#94A3B8' }}>
      {children}
    </h2>
  )
}

// ─── página ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData]               = useState<Indicadores | null>(null)
  const [loading, setLoading]         = useState(true)
  const [grafMeses, setGrafMeses]     = useState<GrafMes[]>([])
  const [grafAportes, setGrafAportes] = useState<GrafAporte[]>([])
  const [grafCartera, setGrafCartera] = useState<GrafCartera[]>([])
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
          provisionTotal += (c.saldo_capital ?? 0) * getTasaProvision(dias)

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

  return (
    <div className="p-8 max-w-6xl">

      {/* Encabezado */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#1E293B' }}>Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>
            Resumen al {fechaHoy()}
          </p>
        </div>
        {!loading && (
          <span
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
              data?.hayVencidos
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-green-50 text-green-700 border-green-200'
            }`}
          >
            {data?.hayVencidos
              ? <><AlertCircle size={12} /> Hay créditos vencidos</>
              : <><CheckCircle2 size={12} /> Sin vencimientos</>
            }
          </span>
        )}
      </div>

      {/* Alerta de mora */}
      {!loading && (
        <div
          className={`mb-6 rounded-xl border px-5 py-4 flex items-center justify-between gap-4 ${
            (data?.creditosEnMora ?? 0) > 0
              ? 'bg-red-50 border-red-200'
              : 'bg-green-50 border-green-200'
          }`}
        >
          <div className="flex items-center gap-3">
            {(data?.creditosEnMora ?? 0) > 0 ? (
              <AlertTriangle size={20} className="flex-shrink-0 text-red-600" />
            ) : (
              <CheckCircle2 size={20} className="flex-shrink-0 text-green-600" />
            )}
            {(data?.creditosEnMora ?? 0) > 0 ? (
              <div>
                <p className="text-sm font-semibold text-red-800">
                  {data?.creditosEnMora}{' '}
                  {data?.creditosEnMora === 1 ? 'crédito en mora' : 'créditos en mora'}
                  {' '}— S/ {fmt(data?.moraActual ?? 0)} en riesgo
                </p>
                <p className="text-xs text-red-600 mt-0.5">Hay cuotas vencidas que requieren atención</p>
              </div>
            ) : (
              <p className="text-sm font-semibold text-green-800">Sin mora — todos los créditos al día</p>
            )}
          </div>
          {(data?.creditosEnMora ?? 0) > 0 && (
            <Link
              href="/dashboard/mora"
              className="px-4 py-2 rounded-lg text-sm font-medium text-white whitespace-nowrap flex items-center gap-1.5 transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#DC2626' }}
            >
              Ver detalle
            </Link>
          )}
        </div>
      )}

      {/* Sección 1 — Socios */}
      <div className="mb-6">
        <SeccionLabel>Socios</SeccionLabel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Tarjeta label="Socios activos"      value={data ? fmtInt(data.sociosActivos)   : '—'} Icon={Users}      loading={loading} />
          <Tarjeta label="Con crédito vigente" value={data ? fmtInt(data.sociosConCredito) : '—'} Icon={CreditCard} loading={loading} />
        </div>
      </div>

      {/* Sección 2 — Cartera */}
      <div className="mb-6">
        <SeccionLabel>Cartera</SeccionLabel>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Tarjeta label="Saldo total cartera" value={data ? `S/ ${fmt(data.saldoCartera)}`     : '—'} Icon={TrendingUp}    loading={loading} />
          <Tarjeta label="Créditos vigentes"   value={data ? fmtInt(data.creditosVigentes)       : '—'} Icon={FileText}      loading={loading} />
          <Tarjeta
            label="Mora actual"
            value={data ? `S/ ${fmt(data.moraActual)}` : '—'}
            sub={data && data.creditosEnMora > 0
              ? `${data.creditosEnMora} ${data.creditosEnMora === 1 ? 'crédito afectado' : 'créditos afectados'}`
              : 'Sin cuotas vencidas'}
            Icon={AlertTriangle}
            loading={loading}
            danger={!!data && data.moraActual > 0}
          />
        </div>
      </div>

      {/* Sección 3 — Mes actual */}
      <div className="mb-6">
        <SeccionLabel>Mes actual: {mesNombre}</SeccionLabel>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Tarjeta label="Total recaudado"   value={data ? `S/ ${fmt(data.recaudadoMes)}` : '—'} Icon={DollarSign} loading={loading} />
          <Tarjeta label="Total aportes"     value={data ? `S/ ${fmt(data.aportesMes)}`   : '—'} Icon={PiggyBank}  loading={loading} />
          <Tarjeta label="Pagos registrados" value={data ? fmtInt(data.pagosMes)          : '—'} Icon={Receipt}    loading={loading} />
        </div>
      </div>

      {/* Sección 4 — Evolución histórica */}
      <div className="mb-6">
        <SeccionLabel>Evolución histórica — últimos 6 meses</SeccionLabel>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[0, 1, 2].map(i => (
              <div key={i} className="bg-white rounded-xl border border-[#E2E8F0] p-4">
                <Skeleton className="h-4 w-36 mb-3" />
                <Skeleton className="h-[220px] w-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm">
              <h3 className="text-sm font-semibold mb-3" style={{ color: '#64748B' }}>Ingresos vs Egresos</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={grafMeses} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                  <YAxis tickFormatter={fmtEje} tick={{ fontSize: 10, fill: '#94A3B8' }} width={36} />
                  <Tooltip content={<TooltipBarras />} />
                  <Bar dataKey="ingresos" name="Ingresos" fill="#1A56DB" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="egresos"  name="Egresos"  fill="#EF4444" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm">
              <h3 className="text-sm font-semibold mb-3" style={{ color: '#64748B' }}>Evolución de Aportes</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={grafAportes} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradAportes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#2D5A27" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#2D5A27" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                  <YAxis tickFormatter={fmtEje} tick={{ fontSize: 10, fill: '#94A3B8' }} width={36} />
                  <Tooltip content={<TooltipAportes />} />
                  <Area
                    type="monotone" dataKey="total" name="Aportes"
                    stroke="#2D5A27" strokeWidth={2} fill="url(#gradAportes)"
                    dot={{ r: 3, fill: '#2D5A27' }} activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm">
              <h3 className="text-sm font-semibold mb-2" style={{ color: '#64748B' }}>Estado de Cartera</h3>
              {grafCartera.length === 0 ? (
                <div className="h-[220px] flex items-center justify-center text-sm" style={{ color: '#94A3B8' }}>
                  Sin datos
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={grafCartera} cx="50%" cy="50%" innerRadius={45} outerRadius={72} dataKey="monto" nameKey="label">
                        {grafCartera.map((entry, i) => (
                          <Cell key={`cell-${i}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<TooltipCartera />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-1 space-y-1">
                    {grafCartera.map(g => (
                      <div key={g.estado} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} />
                          <span style={{ color: '#64748B' }}>{g.label}</span>
                        </div>
                        <span className="font-medium" style={{ color: '#94A3B8' }}>{g.cantidad}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sección 5 — Provisiones */}
      <div className="mb-8">
        <SeccionLabel>Provisiones</SeccionLabel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Tarjeta label="Provisión requerida" value={data ? `S/ ${fmt(data.provisionTotal)}` : '—'} Icon={Shield}   loading={loading} />
          <Tarjeta
            label="% sobre cartera"
            value={data ? `${pctProvision.toFixed(2)}%` : '—'}
            sub="Provisión / Saldo total"
            Icon={BarChart2}
            loading={loading}
          />
        </div>
      </div>

      {/* Accesos rápidos */}
      <div>
        <SeccionLabel>Accesos rápidos</SeccionLabel>
        <div className="flex flex-wrap gap-3">
          <AccesoRapido href="/dashboard/socios/nuevo"    label="Nuevo Socio"       Icon={UserPlus}      />
          <AccesoRapido href="/dashboard/creditos/nuevo"  label="Nuevo Crédito"     Icon={FilePlus}      />
          <AccesoRapido href="/dashboard/pagos/nuevo"     label="Nuevo Pago"        Icon={Wallet}        />
          <AccesoRapido href="/dashboard/mora"            label="Ver Mora"          Icon={AlertTriangle} />
          <AccesoRapido href="/dashboard/reportes/anexo6" label="Generar Anexo N°6" Icon={ClipboardList} />
        </div>
      </div>

    </div>
  )
}
