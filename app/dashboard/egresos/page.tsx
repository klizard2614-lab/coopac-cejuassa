'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import SocioSearch from '@/app/dashboard/creditos/_components/SocioSearch'

type TipoEgreso = 'retiro_socio' | 'fondo_mortuorio' | 'otro'

type Egreso = {
  id: number
  fecha: string
  tipo: TipoEgreso
  monto: number
  beneficiario: string | null
  descripcion: string | null
  id_socio: number | null
  created_at: string
  socios: {
    nombres: string
    apellidos: string
    dni: string
    nro_socio: string
  } | null
}

const TIPO_LABELS: Record<TipoEgreso, string> = {
  retiro_socio: 'Retiro de Socio',
  fondo_mortuorio: 'Fondo Mortuorio',
  otro: 'Otro',
}

const TIPO_COLORS: Record<TipoEgreso, string> = {
  retiro_socio: 'bg-blue-100 text-blue-700',
  fondo_mortuorio: 'bg-purple-100 text-purple-700',
  otro: 'bg-gray-100 text-gray-600',
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
  'focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent'

type FormData = {
  fecha: string
  tipo: TipoEgreso | ''
  monto: string
  beneficiario: string
  id_socio: string
  socioLabel: string
  descripcion: string
}

const emptyForm: FormData = {
  fecha: '',
  tipo: '',
  monto: '',
  beneficiario: '',
  id_socio: '',
  socioLabel: '',
  descripcion: '',
}

export default function EgresosPage() {
  const [egresos, setEgresos] = useState<Egreso[]>([])
  const [loading, setLoading] = useState(true)

  const [tipoFilter, setTipoFilter] = useState<TipoEgreso | ''>('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [applied, setApplied] = useState({ tipo: '' as TipoEgreso | '', desde: '', hasta: '' })

  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<Egreso | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  const fetchEgresos = useCallback(async () => {
    setLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = createClient()
      .from('egresos')
      .select('id, fecha, tipo, monto, beneficiario, descripcion, id_socio, created_at, socios(nombres, apellidos, dni, nro_socio)')
      .order('fecha', { ascending: false })

    if (applied.tipo) query = query.eq('tipo', applied.tipo)
    if (applied.desde) query = query.gte('fecha', applied.desde)
    if (applied.hasta) query = query.lte('fecha', applied.hasta)

    const { data } = await query
    setEgresos((data as Egreso[]) ?? [])
    setLoading(false)
  }, [applied])

  useEffect(() => { fetchEgresos() }, [fetchEgresos])

  function handleFiltrar() {
    setApplied({ tipo: tipoFilter, desde: fechaDesde, hasta: fechaHasta })
  }

  function handleLimpiar() {
    setTipoFilter('')
    setFechaDesde('')
    setFechaHasta('')
    setApplied({ tipo: '', desde: '', hasta: '' })
  }

  const total = useMemo(() => egresos.reduce((s, e) => s + (e.monto ?? 0), 0), [egresos])

  function todayISO() {
    return new Date().toISOString().slice(0, 10)
  }

  function openNuevo() {
    setEditando(null)
    setForm({ ...emptyForm, fecha: todayISO() })
    setFormError('')
    setShowModal(true)
  }

  function openEditar(eg: Egreso) {
    setEditando(eg)
    setForm({
      fecha: eg.fecha,
      tipo: eg.tipo,
      monto: String(eg.monto),
      beneficiario: eg.beneficiario ?? '',
      id_socio: eg.id_socio ? String(eg.id_socio) : '',
      socioLabel: eg.socios
        ? `${eg.socios.apellidos}, ${eg.socios.nombres} — DNI: ${eg.socios.dni} | Nº ${eg.socios.nro_socio}`
        : '',
      descripcion: eg.descripcion ?? '',
    })
    setFormError('')
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditando(null)
    setForm(emptyForm)
    setFormError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.fecha) { setFormError('La fecha es obligatoria.'); return }
    if (!form.tipo) { setFormError('El tipo es obligatorio.'); return }
    const monto = parseFloat(form.monto)
    if (!form.monto || isNaN(monto) || monto <= 0) {
      setFormError('El monto debe ser un número mayor a 0.')
      return
    }

    setSaving(true)
    setFormError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const payload: Record<string, unknown> = {
      fecha: form.fecha,
      tipo: form.tipo,
      monto,
      beneficiario: form.beneficiario.trim() || null,
      id_socio: form.id_socio ? parseInt(form.id_socio) : null,
      descripcion: form.descripcion.trim() || null,
    }

    if (!editando) {
      payload.created_by = user?.id ?? null
    }

    let error
    if (editando) {
      const { error: err } = await supabase.from('egresos').update(payload).eq('id', editando.id)
      error = err
    } else {
      const { error: err } = await supabase.from('egresos').insert(payload)
      error = err
    }

    setSaving(false)
    if (error) {
      setFormError(error.message)
      return
    }
    closeModal()
    fetchEgresos()
  }

  async function handleDelete(id: number) {
    const supabase = createClient()
    await supabase.from('egresos').delete().eq('id', id)
    setConfirmDelete(null)
    fetchEgresos()
  }

  const hayFiltrosActivos = applied.tipo || applied.desde || applied.hasta

  return (
    <div className="p-8">
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Egresos</h1>
        <button
          onClick={openNuevo}
          className="px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#1e3a5f' }}
        >
          + Nuevo Egreso
        </button>
      </div>

      {/* Tarjeta total */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total egresos</p>
          <p className="text-2xl font-bold" style={{ color: '#1e3a5f' }}>S/ {fmt(total)}</p>
          <p className="text-xs text-gray-400 mt-1">
            {loading ? 'Cargando...' : `${egresos.length} ${egresos.length === 1 ? 'registro' : 'registros'}`}
            {applied.tipo ? ` · ${TIPO_LABELS[applied.tipo as TipoEgreso]}` : ''}
            {applied.desde ? ` · desde ${formatDate(applied.desde)}` : ''}
            {applied.hasta ? ` · hasta ${formatDate(applied.hasta)}` : ''}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-5 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Tipo</label>
          <select
            value={tipoFilter}
            onChange={e => setTipoFilter(e.target.value as TipoEgreso | '')}
            className={inputCls}
          >
            <option value="">Todos los tipos</option>
            <option value="retiro_socio">Retiro de Socio</option>
            <option value="fondo_mortuorio">Fondo Mortuorio</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Fecha desde</label>
          <input
            type="date"
            value={fechaDesde}
            onChange={e => setFechaDesde(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Fecha hasta</label>
          <input
            type="date"
            value={fechaHasta}
            onChange={e => setFechaHasta(e.target.value)}
            className={inputCls}
          />
        </div>
        <button
          onClick={handleFiltrar}
          className="px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#1e3a5f' }}
        >
          Filtrar
        </button>
        {hayFiltrosActivos && (
          <button
            onClick={handleLimpiar}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Cargando egresos...</div>
        ) : egresos.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            No se encontraron egresos
            {hayFiltrosActivos ? ' con los filtros aplicados.' : '.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['Fecha', 'Tipo', 'Socio / Beneficiario', 'Descripción', 'Monto', 'Acciones'].map(h => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {egresos.map(eg => (
                  <tr key={eg.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {formatDate(eg.fecha)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TIPO_COLORS[eg.tipo]}`}>
                        {TIPO_LABELS[eg.tipo]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {eg.socios
                        ? `${eg.socios.apellidos}, ${eg.socios.nombres}`
                        : eg.beneficiario ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-xs">
                      <span className="block truncate max-w-[200px]" title={eg.descripcion ?? ''}>
                        {eg.descripcion ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 whitespace-nowrap">
                      S/ {fmt(eg.monto)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditar(eg)}
                          className="px-3 py-1 text-xs font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => setConfirmDelete(eg.id)}
                          className="px-3 py-1 text-xs font-medium rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                        >
                          Eliminar
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

      {!loading && egresos.length > 0 && (
        <p className="text-xs text-gray-400 mt-3">
          {egresos.length} {egresos.length === 1 ? 'egreso' : 'egresos'}
        </p>
      )}

      {/* Modal Nuevo / Editar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-800">
                {editando ? 'Editar Egreso' : 'Nuevo Egreso'}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Fecha <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.fecha}
                    onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                    className={inputCls + ' w-full'}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Tipo <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.tipo}
                    onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoEgreso | '' }))}
                    className={inputCls + ' w-full'}
                    required
                  >
                    <option value="">Seleccionar...</option>
                    <option value="retiro_socio">Retiro de Socio</option>
                    <option value="fondo_mortuorio">Fondo Mortuorio</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Monto (S/) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.monto}
                  onChange={e => setForm(f => ({ ...f, monto: e.target.value }))}
                  placeholder="0.00"
                  className={inputCls + ' w-full'}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Beneficiario</label>
                <input
                  type="text"
                  value={form.beneficiario}
                  onChange={e => setForm(f => ({ ...f, beneficiario: e.target.value }))}
                  placeholder="Nombre del beneficiario (opcional)"
                  className={inputCls + ' w-full'}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Socio (opcional)</label>
                <SocioSearch
                  value={form.id_socio}
                  onChange={(id, label) => setForm(f => ({ ...f, id_socio: id, socioLabel: label }))}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
                <textarea
                  value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Descripción adicional (opcional)"
                  rows={2}
                  className={inputCls + ' w-full resize-none'}
                />
              </div>

              {formError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{formError}</p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                  style={{ backgroundColor: '#1e3a5f' }}
                >
                  {saving ? 'Guardando...' : editando ? 'Guardar cambios' : 'Registrar egreso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal confirmación de eliminación */}
      {confirmDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-2">¿Eliminar egreso?</h2>
            <p className="text-sm text-gray-500 mb-5">Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
