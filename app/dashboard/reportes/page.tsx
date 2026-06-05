'use client'

import Link from 'next/link'

type Reporte = {
  titulo: string
  subtitulo: string
  descripcion: string
  href: string
  activo: boolean
}

const REPORTES: Reporte[] = [
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
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Reportes</h1>
        <p className="text-sm text-gray-500 mt-0.5">Reportes regulatorios y de gestión</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {REPORTES.map((r) => (
          <div
            key={r.titulo}
            className={`bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-3 ${!r.activo ? 'opacity-50' : ''}`}
          >
            <div>
              <h2 className="text-lg font-bold text-gray-800">{r.titulo}</h2>
              <p className="text-sm font-medium text-gray-500 mt-0.5">{r.subtitulo}</p>
              {r.descripcion && (
                <p className="text-xs text-gray-400 mt-2">{r.descripcion}</p>
              )}
            </div>

            <div className="mt-auto pt-2">
              {r.activo ? (
                <Link
                  href={r.href}
                  className="inline-flex items-center px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: '#1e3a5f' }}
                >
                  Generar →
                </Link>
              ) : (
                <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-400 border border-gray-200">
                  Próximamente
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
