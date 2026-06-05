'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { generarFichaSocioPDF } from './utils/generarFichaSocioPDF'
import { FileText } from 'lucide-react'

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
  const map: Record<string, { bg: string; text: string; label: string }> = {
    activo:     { bg: 'bg-green-100',  text: 'text-green-800',  label: 'Activo' },
    retirado:   { bg: 'bg-gray-100',   text: 'text-gray-600',   label: 'Retirado' },
    suspendido: { bg: 'bg-amber-100',  text: 'text-amber-800',  label: 'Suspendido' },
    fallecido:  { bg: 'bg-gray-800',   text: 'text-white',      label: 'Fallecido' },
  }
  const s = map[estado] ?? map.retirado
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  )
}

export default function SociosPage() {
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
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Socios</h1>
        <Link
          href="/dashboard/socios/nuevo"
          className="px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#1e3a5f' }}
        >
          + Nuevo Socio
        </Link>
      </div>

      {/* Buscador */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por nombre, apellido o DNI..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-sm px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent"
        />
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Cargando socios...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">No se encontraron socios</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Nº Socio</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">DNI</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Apellidos y Nombres</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Convenio</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.nro_socio}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{s.dni}</td>
                    <td className="px-4 py-3 text-sm text-gray-800 font-medium">
                      {s.apellidos}, {s.nombres}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{s.convenios?.nombre ?? '—'}</td>
                    <td className="px-4 py-3">
                      <EstadoBadge estado={s.estado} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Link
                          href={`/dashboard/socios/${s.id}`}
                          className="px-3 py-1 text-xs font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          Ver
                        </Link>
                        <Link
                          href={`/dashboard/socios/${s.id}/editar`}
                          className="px-3 py-1 text-xs font-medium rounded-md text-white hover:opacity-90 transition-opacity"
                          style={{ backgroundColor: '#1e3a5f' }}
                        >
                          Editar
                        </Link>
                        <button
                          onClick={() => handlePDF(s.id)}
                          disabled={generandoPDF === s.id}
                          className="px-3 py-1 text-xs font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {generandoPDF === s.id ? 'Generando...' : <span className="flex items-center gap-1"><FileText size={12}/>PDF</span>}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <p className="text-xs text-gray-400 mt-3">
          {filtered.length} {filtered.length === 1 ? 'socio encontrado' : 'socios encontrados'}
        </p>
      )}
    </div>
  )
}
