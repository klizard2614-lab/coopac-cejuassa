'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { generarFichaSocioPDF } from './utils/generarFichaSocioPDF'
import { useRol } from '@/lib/useRol'
import { FileText, Users } from 'lucide-react'
import { formatNombrePersona } from '@/lib/formatNombre'
import { PageFrame, PageToolbar, FilterBar, DataTableShell, DataTableHeader, DataTableEmpty, TableSkeleton, RecordMeta, StatusBadge, btnPrimary, btnGhost, btnEdit, inputCls } from '../_components/ui'

type Socio = {
  id: string
  nro_socio: string
  dni: string
  apellidos: string
  nombres: string
  estado: string
  convenios: { nombre: string } | null
}

function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, { variant: 'success' | 'warning' | 'danger' | 'neutral'; label: string }> = {
    activo:     { variant: 'success',  label: 'Activo' },
    retirado:   { variant: 'neutral',  label: 'Retirado' },
    suspendido: { variant: 'warning',  label: 'Suspendido' },
    fallecido:  { variant: 'danger',   label: 'Fallecido' },
  }
  const s = map[estado] ?? map.retirado
  return <StatusBadge label={s.label} variant={s.variant} />
}

export default function SociosPage() {
  const { rol } = useRol()
  const puedeEditar = rol === 'admin' || rol === 'creditos'
  const [socios, setSocios] = useState<Socio[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [generandoPDF, setGenerandoPDF] = useState<string | null>(null)

  async function handlePDF(socioId: string) {
    setGenerandoPDF(socioId)
    try {
      await generarFichaSocioPDF(socioId)
    } catch (err) {
      alert(`Error al generar PDF: ${err instanceof Error ? err.message : 'Error desconocido'}`)
    } finally {
      setGenerandoPDF(null)
    }
  }

  useEffect(() => {
    createClient()
      .from('socios')
      .select('id, nro_socio, dni, apellidos, nombres, estado, convenios(nombre)')
      .order('nro_socio')
      .then(({ data }) => {
        if (data) setSocios(data as unknown as Socio[])
        setLoading(false)
      })
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return socios
    return socios.filter(s =>
      s.dni.includes(q) ||
      s.apellidos.toLowerCase().includes(q) ||
      s.nombres.toLowerCase().includes(q)
    )
  }, [socios, search])

  return (
    <PageFrame>
      <PageToolbar
        title="Socios"
        subtitle={!loading ? `${socios.length} socios registrados` : undefined}
        actions={
          puedeEditar ? (
            <Link href="/dashboard/socios/nuevo" className={btnPrimary}>
              + Nuevo Socio
            </Link>
          ) : undefined
        }
      />

      <FilterBar>
        <input
          type="text"
          placeholder="Buscar por nombre, apellido o DNI..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={`${inputCls} w-full max-w-sm`}
        />
      </FilterBar>

      <DataTableShell>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <DataTableHeader>
              <tr>
                {['Nº Socio', 'DNI', 'Apellidos y Nombres', 'Convenio', 'Estado', 'Acciones'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </DataTableHeader>
            <tbody>
              {loading ? (
                <TableSkeleton rows={6} cols={6} />
              ) : filtered.length === 0 ? (
                <DataTableEmpty
                  cols={6}
                  message={search.trim() ? `Sin resultados para "${search.trim()}"` : 'No hay socios registrados aún.'}
                  suggestion={search.trim() ? 'Intente buscar por nombre, apellido o DNI.' : undefined}
                />
              ) : (
                filtered.map(s => (
                  <tr key={s.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900">{s.nro_socio}</td>
                    <td className="px-4 py-3 text-slate-600">{s.dni}</td>
                    <td className="px-4 py-3 text-slate-800 font-medium">
                      {formatNombrePersona(s.apellidos, s.nombres)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{s.convenios?.nombre ?? '—'}</td>
                    <td className="px-4 py-3">
                      <EstadoBadge estado={s.estado} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Link href={`/dashboard/socios/${s.id}`} className={btnGhost}>
                          Ver
                        </Link>
                        {puedeEditar && (
                          <Link href={`/dashboard/socios/${s.id}/editar`} className={btnEdit}>
                            Editar
                          </Link>
                        )}
                        <button
                          onClick={() => handlePDF(s.id)}
                          disabled={generandoPDF === s.id}
                          className={`${btnGhost} disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {generandoPDF === s.id
                            ? 'Generando...'
                            : <><FileText size={12} />PDF</>}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DataTableShell>

      {!loading && filtered.length > 0 && (
        <RecordMeta>{filtered.length} {filtered.length === 1 ? 'socio encontrado' : 'socios encontrados'}</RecordMeta>
      )}
    </PageFrame>
  )
}
