'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Plus, Pencil, Trash2, Star, StarOff } from 'lucide-react'

type Beneficiario = {
  id: number
  socio_id: number
  nombres: string
  dni: string | null
  parentesco: string | null
  porcentaje: number | null
  es_principal: boolean
  observacion: string | null
  created_at: string
}

type LegacyBeneficiario = {
  beneficiario_nombre: string | null
  beneficiario_dni: string | null
  beneficiario_parentesco: string | null
}

type Props = {
  socioId: number
  legacy?: LegacyBeneficiario
  /** admin | tesoreria pueden crear/editar; admin puede eliminar */
  rol: string | null
  readOnly?: boolean
}

const EMPTY_FORM = { nombres: '', dni: '', parentesco: '', porcentaje: '', es_principal: false, observacion: '' }

export function BeneficiariosSection({ socioId, legacy, rol, readOnly }: Props) {
  const supabase = createClient()
  const [items, setItems] = useState<Beneficiario[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Beneficiario | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tableExists, setTableExists] = useState(true)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  const canEdit   = !readOnly && (rol === 'admin' || rol === 'tesoreria')
  const canDelete = !readOnly && rol === 'admin'

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('socio_beneficiarios')
      .select('*')
      .eq('socio_id', socioId)
      .order('es_principal', { ascending: false })
      .order('created_at')

    if (err) {
      if (err.code === '42P01') setTableExists(false) // tabla no existe aún
      else setError(err.message)
    } else {
      setItems(data ?? [])
    }
    setLoading(false)
  }, [socioId, supabase])

  useEffect(() => { load() }, [load])

  function openNew() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setError(null)
    setShowForm(true)
  }

  function openEdit(b: Beneficiario) {
    setEditing(b)
    setForm({
      nombres:     b.nombres,
      dni:         b.dni ?? '',
      parentesco:  b.parentesco ?? '',
      porcentaje:  b.porcentaje != null ? String(b.porcentaje) : '',
      es_principal: b.es_principal,
      observacion: b.observacion ?? '',
    })
    setError(null)
    setShowForm(true)
  }

  function cancel() {
    setShowForm(false)
    setEditing(null)
    setError(null)
  }

  async function save() {
    if (!form.nombres.trim()) { setError('El nombre es requerido.'); return }
    if (form.dni.trim() && !/^\d{7,8}$/.test(form.dni.trim())) {
      setError('El DNI debe tener 7 u 8 dígitos numéricos.')
      return
    }
    if (form.porcentaje !== '') {
      const pct = parseFloat(form.porcentaje)
      if (isNaN(pct) || pct < 0 || pct > 100) {
        setError('El porcentaje debe estar entre 0 y 100.')
        return
      }
    }
    setSaving(true)
    setError(null)

    const payload = {
      socio_id:    socioId,
      nombres:     form.nombres.trim(),
      dni:         form.dni.trim() || null,
      parentesco:  form.parentesco.trim() || null,
      porcentaje:  form.porcentaje ? parseFloat(form.porcentaje) : null,
      es_principal: form.es_principal,
      observacion: form.observacion.trim() || null,
      updated_at:  new Date().toISOString(),
    }

    let err
    if (editing) {
      const res = await supabase.from('socio_beneficiarios').update(payload).eq('id', editing.id)
      err = res.error
    } else {
      const res = await supabase.from('socio_beneficiarios').insert(payload)
      err = res.error
    }

    if (err) { setError(err.message) }
    else { cancel(); await load() }
    setSaving(false)
  }

  async function remove(id: number) {
    const { error: err } = await supabase.from('socio_beneficiarios').delete().eq('id', id)
    setConfirmDeleteId(null)
    if (err) setError(err.message)
    else await load()
  }

  async function togglePrincipal(b: Beneficiario) {
    await supabase
      .from('socio_beneficiarios')
      .update({ es_principal: !b.es_principal, updated_at: new Date().toISOString() })
      .eq('id', b.id)
    await load()
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  if (!tableExists) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
        La tabla <code>socio_beneficiarios</code> aún no existe en la base de datos.
        Aplica la migración <code>20260623000001_create_socio_beneficiarios.sql</code> en Supabase Dashboard para activar este módulo.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Beneficiario legacy */}
      {legacy?.beneficiario_nombre && items.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          <span className="font-semibold">Beneficiario registrado (campo legacy): </span>
          {legacy.beneficiario_nombre}
          {legacy.beneficiario_dni ? ` — DNI ${legacy.beneficiario_dni}` : ''}
          {legacy.beneficiario_parentesco ? ` — ${legacy.beneficiario_parentesco}` : ''}
          <span className="block mt-1 text-amber-600 text-xs">Datos en campo legacy. Agrega un beneficiario arriba para migrar al nuevo sistema.</span>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <p className="text-sm text-gray-500">Cargando beneficiarios…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">Sin beneficiarios registrados.</p>
      ) : (
        <div className="space-y-2">
          {items.map(b => (
            <div key={b.id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2 min-w-0">
                {b.es_principal && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                    <Star size={10} className="fill-current" /> Principal
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{b.nombres}</p>
                  <p className="text-xs text-gray-500">
                    {[b.parentesco, b.dni ? `DNI ${b.dni}` : null, b.porcentaje != null ? `${b.porcentaje}%` : null]
                      .filter(Boolean).join(' · ')}
                  </p>
                  {b.observacion && <p className="text-xs text-gray-400 truncate">{b.observacion}</p>}
                </div>
              </div>
              {canEdit && (
                <div className="flex items-center gap-1 ml-2 shrink-0">
                  <button
                    onClick={() => togglePrincipal(b)}
                    title={b.es_principal ? 'Quitar principal' : 'Marcar principal'}
                    className="p-1.5 text-gray-400 hover:text-yellow-500 rounded"
                  >
                    {b.es_principal ? <Star size={15} className="fill-current text-yellow-400" /> : <StarOff size={15} />}
                  </button>
                  <button onClick={() => openEdit(b)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded">
                    <Pencil size={14} />
                  </button>
                  {canDelete && confirmDeleteId !== b.id && (
                    <button onClick={() => setConfirmDeleteId(b.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded">
                      <Trash2 size={14} />
                    </button>
                  )}
                  {canDelete && confirmDeleteId === b.id && (
                    <span className="flex items-center gap-1 text-xs">
                      <button onClick={() => remove(b.id)} className="px-2 py-0.5 rounded bg-red-600 text-white hover:bg-red-700">Sí</button>
                      <button onClick={() => setConfirmDeleteId(null)} className="px-2 py-0.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50">No</button>
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Formulario */}
      {showForm && (
        <div className="border border-blue-200 rounded-xl p-4 bg-blue-50 space-y-3">
          <p className="text-sm font-semibold text-[#1e3a5f]">{editing ? 'Editar beneficiario' : 'Nuevo beneficiario'}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Nombres <span className="text-red-500">*</span></label>
              <input className={inputCls} value={form.nombres} onChange={e => setForm(f => ({ ...f, nombres: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">DNI</label>
              <input className={inputCls} value={form.dni} onChange={e => setForm(f => ({ ...f, dni: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Parentesco</label>
              <input className={inputCls} placeholder="Ej: Cónyuge, Hijo/a" value={form.parentesco} onChange={e => setForm(f => ({ ...f, parentesco: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Porcentaje (%)</label>
              <input className={inputCls} type="number" min="0" max="100" step="0.01" value={form.porcentaje} onChange={e => setForm(f => ({ ...f, porcentaje: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-600 mb-1">Observación</label>
              <input className={inputCls} value={form.observacion} onChange={e => setForm(f => ({ ...f, observacion: e.target.value }))} />
            </div>
            <div className="sm:col-span-2 flex items-center gap-2">
              <input type="checkbox" id="es_principal" checked={form.es_principal} onChange={e => setForm(f => ({ ...f, es_principal: e.target.checked }))} className="rounded" />
              <label htmlFor="es_principal" className="text-sm text-gray-700">Marcar como beneficiario principal</label>
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 bg-[#1A56DB] text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'Guardando…' : editing ? 'Actualizar' : 'Agregar'}
            </button>
            <button onClick={cancel} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Botón agregar */}
      {canEdit && !showForm && (
        <button onClick={openNew} className="flex items-center gap-1.5 text-sm text-[#1A56DB] hover:underline">
          <Plus size={15} /> Agregar beneficiario
        </button>
      )}

      {error && !showForm && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
