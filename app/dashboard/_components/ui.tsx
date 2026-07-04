'use client'

import React from 'react'
import Link from 'next/link'
import { Inbox, CheckCircle2, AlertTriangle } from 'lucide-react'

// ─── Button class constants ───────────────────────────────────────────────────

export const btnPrimary =
  'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white ' +
  'bg-[#1E3A5F] hover:bg-[#162F4E] transition-transform duration-150 ease-out active:scale-[0.97]'

export const btnGhost =
  'inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-md border border-slate-200 ' +
  'text-slate-600 hover:bg-slate-50 transition-transform duration-150 ease-out active:scale-[0.97]'

export const btnEdit =
  'inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-md text-white ' +
  'bg-[#1E3A5F] hover:bg-[#162F4E] transition-transform duration-150 ease-out active:scale-[0.97]'

export const btnDanger =
  'inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-md border border-red-200 ' +
  'text-red-600 hover:bg-red-50 transition-transform duration-150 ease-out active:scale-[0.97]'

export const inputCls =
  'px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white ' +
  'focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent transition-colors'

export const selectCls =
  'px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white ' +
  'focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent transition-colors'

// ─── PageHeader ───────────────────────────────────────────────────────────────

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: React.ElementType
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="py-16 flex flex-col items-center justify-center text-center gap-3">
      <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center">
        <Icon size={20} strokeWidth={1.5} className="text-slate-400" />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-600">{title}</p>
        {description && <p className="text-xs text-slate-400 mt-1 max-w-xs">{description}</p>}
      </div>
      {action}
    </div>
  )
}

// ─── TableSkeleton ────────────────────────────────────────────────────────────

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b border-slate-100 last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-4 py-3">
              <div
                className={`h-3.5 rounded bg-slate-100 animate-pulse ${
                  c === 0 ? 'w-14' : c === cols - 1 ? 'w-20' : 'w-full max-w-[160px]'
                }`}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

// ─── ResultCount ──────────────────────────────────────────────────────────────

export function ResultCount({ count, singular, plural }: { count: number; singular: string; plural: string }) {
  if (count === 0) return null
  return (
    <p className="text-xs text-slate-400 mt-3">
      {count} {count === 1 ? singular : plural}
    </p>
  )
}

// ─── MetricCard ───────────────────────────────────────────────────────────────

export function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  danger = false,
  loading = false,
}: {
  label: string
  value: string
  sub?: string
  icon?: React.ElementType
  danger?: boolean
  loading?: boolean
}) {
  return (
    <div
      className={`rounded-xl border p-5 flex flex-col gap-3 ${
        danger ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'
      }`}
    >
      <div className="flex items-center justify-between">
        {Icon && (
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              danger ? 'bg-red-100' : 'bg-blue-50'
            }`}
          >
            <Icon
              size={16}
              strokeWidth={1.8}
              className={danger ? 'text-red-600' : 'text-[#1A56DB]'}
            />
          </div>
        )}
        {danger && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
      </div>
      {loading ? (
        <>
          <div className="h-7 w-24 rounded bg-slate-100 animate-pulse" />
          <div className="h-3 w-32 rounded bg-slate-100 animate-pulse" />
        </>
      ) : (
        <>
          <p
            className={`text-2xl font-semibold tracking-tight tabular-nums ${
              danger ? 'text-red-700' : 'text-slate-800'
            }`}
          >
            {value}
          </p>
          <div>
            <p className="text-sm text-slate-500">{label}</p>
            {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
          </div>
        </>
      )}
    </div>
  )
}

// ─── SectionHeader ────────────────────────────────────────────────────────────

export function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
      {children}
    </h2>
  )
}

// ─── ChartCard ────────────────────────────────────────────────────────────────

export function ChartCard({
  title,
  children,
  className = '',
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-4 ${className}`}>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">{title}</p>
      {children}
    </div>
  )
}

// ─── EmptyChartState ──────────────────────────────────────────────────────────

export function EmptyChartState({ height = 200 }: { height?: number }) {
  return (
    <div
      className="flex items-center justify-center text-sm text-slate-400"
      style={{ height }}
    >
      Sin datos disponibles
    </div>
  )
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────

type StatusVariant = 'success' | 'warning' | 'danger' | 'neutral' | 'info'

export function StatusBadge({
  label,
  variant = 'neutral',
}: {
  label: string
  variant?: StatusVariant
}) {
  const cls: Record<StatusVariant, string> = {
    success: 'bg-green-50 text-green-700 border-green-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger:  'bg-red-50 text-red-700 border-red-200',
    neutral: 'bg-slate-50 text-slate-600 border-slate-200',
    info:    'bg-blue-50 text-blue-700 border-blue-200',
  }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${cls[variant]}`}
    >
      {label}
    </span>
  )
}

// ─── TrendIndicator ───────────────────────────────────────────────────────────

export function TrendIndicator({
  value,
  label,
}: {
  value: number
  label?: string
}) {
  const isUp      = value > 0
  const isNeutral = value === 0
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        isNeutral ? 'text-slate-400' : isUp ? 'text-green-600' : 'text-red-600'
      }`}
    >
      {isNeutral ? '—' : isUp ? '▲' : '▼'}
      {Math.abs(value).toFixed(1)}%
      {label && <span className="text-slate-400 font-normal ml-0.5">{label}</span>}
    </span>
  )
}

// ─── MiniStat ─────────────────────────────────────────────────────────────────

export function MiniStat({
  label,
  value,
  accent = false,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span
        className={`text-xs font-semibold tabular-nums ${
          accent ? 'text-[#1A56DB]' : 'text-slate-700'
        }`}
      >
        {value}
      </span>
    </div>
  )
}

// ─── PeriodBadge ──────────────────────────────────────────────────────────────

export function PeriodBadge({ period }: { period: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-200/70 text-slate-600 text-xs font-medium">
      {period}
    </span>
  )
}

// ─── OperationalAlert ─────────────────────────────────────────────────────────

export function OperationalAlert({
  hayVencidos,
  loading = false,
}: {
  hayVencidos?: boolean
  loading?: boolean
}) {
  if (loading) return null
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
        hayVencidos
          ? 'bg-red-50 text-red-700 border-red-200'
          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
          hayVencidos ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'
        }`}
      />
      {hayVencidos ? 'Vencidos activos' : 'Operativo'}
    </span>
  )
}

// ─── ExecutiveMetricPanel ─────────────────────────────────────────────────────

export function ExecutiveMetricPanel({
  saldoCarteraFmt,
  creditosFmt,
  sociosFmt,
  provisionFmt,
  pctFmt,
  loading = false,
}: {
  saldoCarteraFmt: string
  creditosFmt: string
  sociosFmt: string
  provisionFmt: string
  pctFmt: string
  loading?: boolean
}) {
  return (
    <div
      className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col justify-between h-full"
      style={{ borderLeft: '4px solid #1E3A5F' }}
    >
      <div>
        <p className="text-xs font-medium text-slate-400 tracking-wide mb-2">Saldo cartera total</p>
        {loading ? (
          <div className="h-11 w-52 rounded bg-slate-100 animate-pulse" />
        ) : (
          <p
            className="text-4xl font-bold tabular-nums tracking-tight"
            style={{ color: '#1E3A5F' }}
          >
            {saldoCarteraFmt}
          </p>
        )}
      </div>
      <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-slate-400 mb-1">Créditos vigentes</p>
          {loading ? (
            <div className="h-5 w-8 rounded bg-slate-100 animate-pulse" />
          ) : (
            <p className="text-lg font-semibold text-slate-800 tabular-nums">{creditosFmt}</p>
          )}
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-1">Socios activos</p>
          {loading ? (
            <div className="h-5 w-12 rounded bg-slate-100 animate-pulse" />
          ) : (
            <p className="text-lg font-semibold text-slate-800 tabular-nums">{sociosFmt}</p>
          )}
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-1">Provisión req.</p>
          {loading ? (
            <div className="h-5 w-24 rounded bg-slate-100 animate-pulse" />
          ) : (
            <p className="text-base font-semibold text-slate-800 tabular-nums">
              {provisionFmt}
              <span className="text-xs font-normal text-slate-400 ml-1">({pctFmt})</span>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── RiskPanel ────────────────────────────────────────────────────────────────

export function RiskPanel({
  hasMora,
  moraFmt,
  creditosAfectadosFmt,
  creditosCount,
  loading = false,
}: {
  hasMora: boolean
  moraFmt: string
  creditosAfectadosFmt: string
  creditosCount: number
  loading?: boolean
}) {
  return (
    <div
      className={`rounded-xl border p-5 flex flex-col justify-between h-full ${
        hasMora ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'
      }`}
      style={{ borderLeft: hasMora ? '4px solid #DC2626' : '4px solid #059669' }}
    >
      <div>
        <p
          className={`text-xs font-medium tracking-wide mb-2 ${
            hasMora ? 'text-red-400' : 'text-emerald-500'
          }`}
        >
          {hasMora ? 'Cartera en mora' : 'Estado de mora'}
        </p>
        {loading ? (
          <div className="h-9 w-36 rounded bg-slate-100 animate-pulse" />
        ) : hasMora ? (
          <p className="text-3xl font-bold tabular-nums tracking-tight text-red-700">
            {moraFmt}
          </p>
        ) : (
          <div className="flex items-center gap-2 mt-1">
            <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
            <p className="text-xl font-semibold text-emerald-700">Sin mora</p>
          </div>
        )}
      </div>
      <div className={`mt-4 pt-3 border-t ${hasMora ? 'border-red-200' : 'border-emerald-200'}`}>
        {!loading && hasMora ? (
          <>
            <p className="text-sm font-medium text-red-700">
              {creditosAfectadosFmt}{' '}
              {creditosCount === 1 ? 'crédito afectado' : 'créditos afectados'}
            </p>
            <p className="text-xs text-red-500 mt-0.5 mb-3">Cuotas vencidas pendientes</p>
            <Link
              href="/dashboard/mora"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-transform duration-150 ease-out active:scale-[0.97]"
              style={{ backgroundColor: '#DC2626' }}
            >
              <AlertTriangle size={11} />
              Ver detalle de mora
            </Link>
          </>
        ) : !loading ? (
          <p className="text-xs text-emerald-600">Todos los créditos al corriente</p>
        ) : null}
      </div>
    </div>
  )
}

// ─── CompactKpi ───────────────────────────────────────────────────────────────

export function CompactKpi({
  label,
  value,
  loading = false,
}: {
  label: string
  value: string
  loading?: boolean
}) {
  return (
    <div className="px-5 py-4">
      {loading ? (
        <>
          <div className="h-6 w-28 rounded bg-slate-100 animate-pulse mb-1.5" />
          <div className="h-3 w-20 rounded bg-slate-100 animate-pulse" />
        </>
      ) : (
        <>
          <p className="text-xl font-semibold tabular-nums tracking-tight text-slate-800">
            {value}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">{label}</p>
        </>
      )}
    </div>
  )
}

// ─── FinanceChartPanel ────────────────────────────────────────────────────────

export function FinanceChartPanel({
  title,
  subtitle,
  children,
  className = '',
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-5 ${className}`}>
      <div className="mb-4">
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

// ─── DividerLabel ─────────────────────────────────────────────────────────────

export function DividerLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="text-xs font-medium text-slate-400">{children}</span>
      <div className="flex-1 h-px bg-slate-200" />
    </div>
  )
}

// ─── PageFrame ────────────────────────────────────────────────────────────────
// Wrapper de página con fondo institucional
export function PageFrame({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`min-h-full bg-slate-50 p-6 lg:p-8 ${className}`}>
      {children}
    </div>
  )
}

// ─── PageToolbar ──────────────────────────────────────────────────────────────
// Header de página con título, subtítulo y slot de acciones
export function PageToolbar({
  title,
  subtitle,
  actions,
  meta,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  meta?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <h1 className="text-lg font-semibold text-slate-800 leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
        {meta && <div className="mt-1">{meta}</div>}
      </div>
      {actions && <div className="flex items-center gap-2 ml-4 flex-shrink-0">{actions}</div>}
    </div>
  )
}

// ─── FilterBar ────────────────────────────────────────────────────────────────
// Barra de filtros compacta
export function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {children}
    </div>
  )
}

// ─── DataTableShell ───────────────────────────────────────────────────────────
// Contenedor de tabla con borde institucional
export function DataTableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {children}
    </div>
  )
}

// ─── DataTableHeader ──────────────────────────────────────────────────────────
// Cabecera de tabla con fondo institucional suave
export function DataTableHeader({ children }: { children: React.ReactNode }) {
  return (
    <thead className="bg-slate-50 border-b border-slate-200">
      {children}
    </thead>
  )
}

// ─── DataTableEmpty ───────────────────────────────────────────────────────────
// Estado vacío dentro de tabla (en tbody)
export function DataTableEmpty({
  cols,
  message = 'Sin registros',
  suggestion,
}: {
  cols: number
  message?: string
  suggestion?: string
}) {
  return (
    <tr>
      <td colSpan={cols} className="py-14 text-center">
        <div className="flex flex-col items-center gap-2">
          <Inbox size={20} strokeWidth={1.5} className="text-slate-300" />
          <p className="text-sm text-slate-500">{message}</p>
          {suggestion && <p className="text-xs text-slate-400">{suggestion}</p>}
        </div>
      </td>
    </tr>
  )
}

// ─── DetailHero ───────────────────────────────────────────────────────────────
// Hero de ficha de detalle
export function DetailHero({
  title,
  subtitle,
  badge,
  actions,
  meta,
}: {
  title: string
  subtitle?: string
  badge?: React.ReactNode
  actions?: React.ReactNode
  meta?: React.ReactNode
}) {
  return (
    <div
      className="bg-white rounded-xl border border-slate-200 p-5 mb-5"
      style={{ borderLeft: '4px solid #1E3A5F' }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {badge}
          </div>
          <h1 className="text-xl font-semibold text-slate-800 leading-tight truncate">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
          {meta && <div className="mt-2 text-xs text-slate-400">{meta}</div>}
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── DetailSection ────────────────────────────────────────────────────────────
// Sección con título dentro de un detalle
export function DetailSection({
  title,
  children,
  action,
}: {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  )
}

// ─── FieldGrid ────────────────────────────────────────────────────────────────
// Grid de campos en detalle
export function FieldGrid({
  cols = 2,
  children,
}: {
  cols?: 2 | 3 | 4
  children: React.ReactNode
}) {
  const colCls = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-2 md:grid-cols-4' }[cols]
  return (
    <div className={`grid ${colCls} gap-4`}>
      {children}
    </div>
  )
}

// ─── FieldItem ────────────────────────────────────────────────────────────────
// Campo etiqueta/valor en detalle
export function FieldItem({
  label,
  value,
  mono = false,
  accent = false,
  span,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
  accent?: boolean
  span?: boolean
}) {
  return (
    <div className={span ? 'col-span-full' : ''}>
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p
        className={`text-sm font-medium ${mono ? 'tabular-nums' : ''} ${
          accent ? 'text-[#1E3A5F]' : 'text-slate-800'
        }`}
      >
        {value ?? '—'}
      </p>
    </div>
  )
}

// ─── FormPanel ────────────────────────────────────────────────────────────────
// Panel de formulario con fondo blanco y borde
export function FormPanel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-6 ${className}`}>
      {children}
    </div>
  )
}

// ─── FormSection ──────────────────────────────────────────────────────────────
// Sección dentro de un formulario
export function FormSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-6 last:mb-0">
      <div className="mb-3 pb-2 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  )
}

// ─── ActionStrip ──────────────────────────────────────────────────────────────
// Barra de acciones al pie de un formulario o detalle
export function ActionStrip({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center justify-end gap-3 pt-4 border-t border-slate-100 mt-6 ${className}`}>
      {children}
    </div>
  )
}

// ─── InlineAlert ──────────────────────────────────────────────────────────────
// Alerta inline sin modal
export function InlineAlert({
  variant = 'info',
  children,
}: {
  variant?: 'info' | 'warning' | 'danger' | 'success'
  children: React.ReactNode
}) {
  const cls = {
    info:    'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    danger:  'bg-red-50 border-red-200 text-red-800',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  }[variant]
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm mb-4 ${cls}`}>
      {children}
    </div>
  )
}

// ─── FinancialValue ───────────────────────────────────────────────────────────
// Valor monetario formateado con S/
export function FinancialValue({
  amount,
  large = false,
  danger = false,
  muted = false,
}: {
  amount: number | null | undefined
  large?: boolean
  danger?: boolean
  muted?: boolean
}) {
  if (amount === null || amount === undefined) return <span className="text-slate-400">—</span>
  const fmt = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
  const cls = danger ? 'text-red-700' : muted ? 'text-slate-500' : 'text-slate-800'
  const sizeCls = large ? 'text-2xl font-bold' : 'text-sm font-medium'
  return (
    <span className={`tabular-nums ${cls} ${sizeCls}`}>
      S/ {fmt}
    </span>
  )
}

// ─── RiskBadge ────────────────────────────────────────────────────────────────
// Badge de clasificación de riesgo SBS
export function RiskBadge({ clasif }: { clasif: string }) {
  const map: Record<string, string> = {
    normal:      'bg-emerald-50 text-emerald-700 border-emerald-200',
    cpp:         'bg-amber-50 text-amber-700 border-amber-200',
    deficiente:  'bg-orange-50 text-orange-700 border-orange-200',
    dudoso:      'bg-red-50 text-red-700 border-red-200',
    perdida:     'bg-red-100 text-red-900 border-red-300',
  }
  const cls = map[clasif?.toLowerCase()] ?? 'bg-slate-50 text-slate-600 border-slate-200'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${cls}`}>
      {clasif ?? '—'}
    </span>
  )
}

// ─── CompactStat ──────────────────────────────────────────────────────────────
// Estadística compacta horizontal para barras de resumen
export function CompactStat({
  label,
  value,
  accent = false,
}: {
  label: string
  value: string | number
  accent?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`text-sm font-semibold tabular-nums ${accent ? 'text-[#1E3A5F]' : 'text-slate-800'}`}>
        {value}
      </p>
    </div>
  )
}

// ─── RecordMeta ───────────────────────────────────────────────────────────────
// Metadata de registro (creado por, fecha, etc.)
export function RecordMeta({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-slate-400 mt-1">{children}</p>
  )
}
