'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useRol } from '@/lib/useRol'
import AccesoDenegado from '@/components/AccesoDenegado'

type Convenio = {
  id: number
  nombre: string
  ruc: string | null
  contacto: string | null
  telefono: string | null
  activo: boolean
  created_at: string
}

export default function ConveniosConfigPage() {
  const { rol, loading: checkingRol } = useRol()
  const [convenios, setConvenios] = useState<Convenio[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Nuevo convenio (formulario inline)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [nuevoNombre, setNuevoNombre]   = useState('')
  const [nuevoRuc, setNuevoRuc]         = useState('')
  const [nuevoContacto, setNuevoContacto] = useState('')
  const [nuevoTelefono, setNuevoTelefono] = useState('')
  const [savingNuevo, setSavingNuevo]   = useState(false)
  const [msgNuevo, setMsgNuevo]         = useState<string | null>(null)

  // Edición inline
  const [editId, setEditId]     = useState<number | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Socios con convenio (para saber si se puede desactivar)
  const [sociosPorConvenio, setSociosPorConvenio] = useState<Record<number, number>>({})

  async function fetchConvenios() {
    const sb = createClient()
    const [cvRes, sociosRes] = await Promise.all([
      sb.from('convenios').select('id, nombre, ruc, contacto, telefono, activo, created_at').order('nombre'),
      sb.from('socios').select('id_convenio').not('id_convenio', 'is', null),
    ])
    if (cvRes.error) { setError(cvRes.error.message); setLoading(false); return }
    setConvenios((cvRes.data as Convenio[]) ?? [])

    // contar socios por convenio
    const counts: Record<number, number> = {}
    for (const s of (sociosRes.data ?? []) as { id_convenio: number }[]) {
      counts[s.id_convenio] = (counts[s.id_convenio] ?? 0) + 1
    }
    setSociosPorConvenio(counts)
    setLoading(false)
  }

  useEffect(() => { fetchConvenios() }, [])

  async function handleNuevo(e: React.FormEvent) {
    e.preventDefault()
    if (!nuevoNombre.trim()) return
    setSavingNuevo(true)
    setMsgNuevo(null)
    const { error } = await createClient()
      .from('convenios')
      .insert({
        nombre:   nuevoNombre.trim(),
        ruc:      nuevoRuc.trim() || null,
        contacto: nuevoContacto.trim() || null,
        telefono: nuevoTelefono.trim() || null,
      })
    if (error) {
      setMsgNuevo(`Error: ${error.message}`)
    } else {
      setNuevoNombre('')
      setNuevoRuc('')
      setNuevoContacto('')
      setNuevoTelefono('')
      setMostrarForm(false)
      setMsgNuevo(null)
      await fetchConvenios()
    }
    setSavingNuevo(false)
  }

  function startEdit(cv: Convenio) {
    setEditId(cv.id)
    setEditNombre(cv.nombre)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  async function handleSaveEdit(id: number) {
    if (!editNombre.trim()) return
    setSavingEdit(true)
    await createClient().from('convenios').update({ nombre: editNombre.trim() }).eq('id', id)
    setEditId(null)
    setSavingEdit(false)
    await fetchConvenios()
  }

  async function handleDesactivar(id: number) {
    if (!confirm('¿Desactivar este convenio? Los socios asociados mantendrán su vínculo.')) return
    await createClient().from('convenios').update({ activo: false }).eq('id', id)
    await fetchConvenios()
  }

  async function handleActivar(id: number) {
    await createClient().from('convenios').update({ activo: true }).eq('id', id)
    await fetchConvenios()
  }

  if (checkingRol) return <div className="p-8 text-sm text-gray-400">Verificando acceso...</div>
  if (rol !== 'admin') return <AccesoDenegado mensaje="Solo los administradores pueden gestionar convenios." />

  return (
    <div className="p-8 max-w-3xl">
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            href="/dashboard/configuracion"
            className="text-sm text-gray-400 hover:text-gray-600 mb-1 inline-block transition-colors"
          >
            ← Configuración
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">Convenios</h1>
          <p className="text-sm text-gray-500 mt-0.5">Instituciones empleadoras</p>
        </div>
        <button
          onClick={() => { setMostrarForm(v => !v); setMsgNuevo(null) }}
          className="px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#1e3a5f' }}
        >
          {mostrarForm ? 'Cancelar' : '+ Nuevo Convenio'}
        </button>
      </div>

      {/* Formulario nuevo convenio (inline) */}
      {mostrarForm && (
        <form
          onSubmit={handleNuevo}
          className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-5 space-y-3"
        >
          <p className="text-sm font-semibold text-blue-800 mb-1">Nuevo convenio</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Nombre <span className="text-red-500">*</span>
              </label>
              <input
                autoFocus
                value={nuevoNombre}
                onChange={e => setNuevoNombre(e.target.value)}
                required
                placeholder="Ej. UGEL Piura"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">RUC</label>
              <input
                value={nuevoRuc}
                onChange={e => setNuevoRuc(e.target.value)}
                placeholder="20XXXXXXXXX"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Teléfono</label>
              <input
                value={nuevoTelefono}
                onChange={e => setNuevoTelefono(e.target.value)}
                placeholder="(073) 000-000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Contacto</label>
              <input
                value={nuevoContacto}
                onChange={e => setNuevoContacto(e.target.value)}
                placeholder="Nombre del responsable"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              />
            </div>
          </div>
          {msgNuevo && <p className="text-xs text-red-600">{msgNuevo}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={savingNuevo}
              className="px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              style={{ backgroundColor: '#1e3a5f' }}
            >
              {savingNuevo ? 'Guardando...' : 'Guardar convenio'}
            </button>
            <button
              type="button"
              onClick={() => setMostrarForm(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Cargando convenios...</div>
        ) : error ? (
          <div className="p-12 text-center text-red-400 text-sm">Error: {error}</div>
        ) : convenios.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            No hay convenios registrados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['Nombre', 'RUC', 'Contacto', 'Socios', 'Estado', 'Acciones'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {convenios.map(cv => (
                  <tr key={cv.id} className="hover:bg-gray-50 transition-colors">
                    {/* Nombre editable inline */}
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {editId === cv.id ? (
                        <input
                          ref={inputRef}
                          value={editNombre}
                          onChange={e => setEditNombre(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSaveEdit(cv.id)
                            if (e.key === 'Escape') setEditId(null)
                          }}
                          onBlur={() => handleSaveEdit(cv.id)}
                          disabled={savingEdit}
                          className="px-2 py-1 border border-blue-300 rounded text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] w-full"
                        />
                      ) : (
                        <button
                          onClick={() => startEdit(cv)}
                          className="text-left hover:text-blue-600 transition-colors w-full"
                          title="Click para editar"
                        >
                          {cv.nombre}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {cv.ruc || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {cv.contacto || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 text-center whitespace-nowrap">
                      {sociosPorConvenio[cv.id] ?? 0}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                        cv.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {cv.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(cv)}
                          className="px-2 py-1 text-xs font-medium rounded border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          Editar
                        </button>
                        {cv.activo ? (
                          <button
                            onClick={() => handleDesactivar(cv.id)}
                            className="px-2 py-1 text-xs font-medium rounded border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                          >
                            Desactivar
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivar(cv.id)}
                            className="px-2 py-1 text-xs font-medium rounded border border-green-200 text-green-700 hover:bg-green-50 transition-colors"
                          >
                            Activar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && !error && convenios.length > 0 && (
        <p className="text-xs text-gray-400 mt-3">
          {convenios.length} {convenios.length === 1 ? 'convenio' : 'convenios'} ·
          {' '}{convenios.filter(c => c.activo).length} activos
        </p>
      )}
    </div>
  )
}
