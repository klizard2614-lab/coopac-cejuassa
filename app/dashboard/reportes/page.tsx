'use client'

import Link from 'next/link'
import { PageFrame, PageToolbar, btnPrimary } from '../_components/ui'

type Reporte = {
  titulo: string
  subtitulo: string
  descripcion: string
  href: string
  activo: boolean
}

const REPORTES_ACTIVOS: Reporte[] = [
  {
    titulo: 'Anexo N°6',
    subtitulo: 'Reporte de Deudores SBS',
    descripcion: 'Formato 1106, Anexo 03. Clasificación y provisiones de cartera.',
    href: '/dashboard/reportes/anexo6',
    activo: true,
  },
  {
    titulo: 'Reporte de Aportes',
    subtitulo: 'Resumen mensual de aportes por socio',
    descripcion: 'Movimientos de aportes y retiros. Filtros por tipo y socio. Exportación a Excel.',
    href: '/dashboard/reportes/aportes',
    activo: true,
  },
  {
    titulo: 'Reporte de Caja',
    subtitulo: 'Ingresos y egresos del período',
    descripcion: 'Balance de caja: pagos recibidos vs egresos. Saldo del período. Exportación Excel con 2 hojas.',
    href: '/dashboard/reportes/caja',
    activo: true,
  },
]

export default function ReportesPage() {
  return (
    <PageFrame>
      <PageToolbar
        title="Reportes"
        subtitle="Reportes regulatorios y de gestión"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {REPORTES_ACTIVOS.map((r) => (
          <div
            key={r.titulo}
            className={`bg-white rounded-xl border border-slate-200 p-6 flex flex-col gap-3 ${!r.activo ? 'opacity-50' : ''}`}
          >
            <div>
              <h2 className="text-base font-semibold text-slate-800">{r.titulo}</h2>
              <p className="text-sm font-medium text-slate-500 mt-0.5">{r.subtitulo}</p>
              {r.descripcion && (
                <p className="text-xs text-slate-400 mt-2">{r.descripcion}</p>
              )}
            </div>
            <div className="mt-auto pt-2">
              {r.activo ? (
                <Link href={r.href} className={btnPrimary}>
                  Generar →
                </Link>
              ) : (
                <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-400 border border-slate-200">
                  Próximamente
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Archivado / fuera de alcance actual ── */}
      <div className="mt-10">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Archivado / fuera de alcance actual</h2>
          <div className="flex-1 h-px bg-slate-200" />
        </div>
        <div className="max-w-md">
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 flex flex-col gap-2 opacity-60">
            <div>
              <h3 className="text-base font-semibold text-slate-500">BDCC SBS</h3>
              <p className="text-sm text-slate-400 mt-0.5">Base de Datos de Cartera Crediticia</p>
              <p className="text-xs text-slate-400 mt-2">
                Fuera del alcance actual. La cooperativa confirmó que el único reporte regulatorio activo es Anexo N°6.
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageFrame>
  )
}
