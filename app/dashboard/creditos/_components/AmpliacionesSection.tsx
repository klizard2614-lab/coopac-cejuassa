'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRol } from '@/lib/useRol'

type Ampliacion = {
  id: string
  id_credito: string
  fecha: string
  nro_pagare_anterior: string | null
  nro_pagare_nuevo: string
  monto_nuevo: number
  plazo_nuevo: number
  saldo_nuevo: number
  tasa_nueva: number | null
  cuota_nueva: number | null
  observacion: string | null
  created_at: string
  created_by: string | null
}

type EditFormData = {
  fecha: string
  nro_pagare_anterior: string
  nro_pagare_nuevo: string
  monto_nuevo: string
  plazo_nuevo: string
  saldo_nuevo: string
  observacion: string
}

type ApplyFormData = {
  fecha: string
  nro_pagare_nuevo: string
  monto_a_ampliar: string
  plazo_nuevo: string
  tasa_nueva: string
  cuota_nueva: string
  observacion: string
}

const EMPTY_EDIT: EditFormData = {
  fecha: '',
  nro_pagare_anterior: '',
  nro_pagare_nuevo: '',
  monto_nuevo: '',
  plazo_nuevo: '',
  saldo_nuevo: '',
  observacion: '',
}

const EMPTY_APPLY: ApplyFormData = {
  fecha: '',
  nro_pagare_nuevo: '',
  monto_a_ampliar: '',
  plazo_nuevo: '',
  tasa_nueva: '',
  cuota_nueva: '',
  observacion: '',
}

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  const parts = d.split('T')[0].split('-')
  if (parts.length !== 3) return d
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

interface Props {
  creditoId: string
  nroPagareActual?: string | null
  montoAprobado?: number | null
  saldoCapital?: number | null
  plazoMeses?: number | null
  tasaInteres?: number | null
  cuotaMensual?: number | null
  onCreditoUpdated?: () => void
}

export function AmpliacionesSection({
  creditoId,
  nroPagareActual,
  montoAprobado,
  saldoCapital,
  plazoMeses,
  tasaInteres,
  cuotaMensual,
  onCreditoUpdated,
}: Props) {
  const { rol } = useRol()
  const [ampliaciones, setAmpliaciones] = useState<Ampliacion[]>([])
  const [loading, setLoading] = useState(true)

  // 'apply' = nueva ampliación funcional (RPC), 'edit' = editar registro histórico
  const [formMode, setFormMode] = useState<null | 'apply' | 'edit'>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [editForm, setEditForm] = useState<EditFormData>(EMPTY_EDIT)
  const [applyForm, setApplyForm] = useState<ApplyFormData>(EMPTY_APPLY)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const canWrite = rol === 'admin' || rol === 'creditos'
  const canDelete = rol === 'admin'

  function reload() { setRefreshKey(k => k + 1) }

  useEffect(() => {
    let cancelled = false
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('ampliaciones')
        .select('*')
        .eq('id_credito', creditoId)
        .order('fecha', { ascending: false })
      if (!cancelled) {
        setAmpliaciones((data as Ampliacion[]) ?? [])
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [creditoId, refreshKey])

  function openApply() {
    setApplyForm({
      ...EMPTY_APPLY,
      fecha: new Date().toISOString().split('T')[0],
      plazo_nuevo: plazoMeses != null ? String(plazoMeses) : '',
      tasa_nueva:  tasaInteres != null ? String(tasaInteres) : '',
      cuota_nueva: cuotaMensual != null ? String(cuotaMensual) : '',
    })
    setFormMode('apply')
    setError(null)
  }

  function openEdit(a: Ampliacion) {
    setEditForm({
      fecha: a.fecha,
      nro_pagare_anterior: a.nro_pagare_anterior ?? '',
      nro_pagare_nuevo: a.nro_pagare_nuevo,
      monto_nuevo: String(a.monto_nuevo),
      plazo_nuevo: String(a.plazo_nuevo),
      saldo_nuevo: String(a.saldo_nuevo),
      observacion: a.observacion ?? '',
    })
    setEditingId(a.id)
    setFormMode('edit')
    setError(null)
  }

  function closeForm() {
    setFormMode(null)
    setEditingId(null)
    setError(null)
  }

  // Vista previa calculada en tiempo real
  const montoAAmpliar = Number(applyForm.monto_a_ampliar) || 0
  const previewMontoNuevo = (montoAprobado ?? 0) + montoAAmpliar
  const previewSaldoNuevo = (saldoCapital ?? 0) + montoAAmpliar

  async function applyAmpliacion() {
    if (!applyForm.fecha) { setError('La fecha es requerida.'); return }
    if (!applyForm.nro_pagare_nuevo.trim()) { setError('El Nº pagaré nuevo es requerido.'); return }
    if (montoAAmpliar <= 0) { setError('El monto a ampliar debe ser mayor a 0.'); return }
    if (!applyForm.plazo_nuevo || Number(applyForm.plazo_nuevo) <= 0) { setError('El plazo nuevo debe ser mayor a 0.'); return }
    if (applyForm.tasa_nueva === '' || Number(applyForm.tasa_nueva) < 0) { setError('La tasa TEA no puede ser negativa.'); return }
    if (!applyForm.cuota_nueva || Number(applyForm.cuota_nueva) <= 0) { setError('La cuota nueva debe ser mayor a 0.'); return }

    setSaving(true)
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { error: rpcError } = await supabase.rpc('aplicar_ampliacion_credito', {
      p_id_credito:       creditoId,
      p_fecha:            applyForm.fecha,
      p_nro_pagare_nuevo: applyForm.nro_pagare_nuevo.trim(),
      p_monto_a_ampliar:  montoAAmpliar,
      p_plazo_nuevo:      Number(applyForm.plazo_nuevo),
      p_tasa_nueva:       Number(applyForm.tasa_nueva),
      p_cuota_nueva:      Number(applyForm.cuota_nueva),
      p_observacion:      applyForm.observacion.trim() || null,
      p_created_by:       user?.id ?? null,
    })

    setSaving(false)
    if (rpcError) { setError(rpcError.message); return }
    closeForm()
    reload()
    onCreditoUpdated?.()
  }

  async function saveEdit() {
    if (!editForm.fecha) { setError('La fecha es requerida.'); return }
    if (!editForm.nro_pagare_nuevo.trim()) { setError('El Nº pagaré nuevo es requerido.'); return }
    if (!editForm.monto_nuevo || Number(editForm.monto_nuevo) <= 0) { setError('El monto nuevo debe ser mayor a 0.'); return }
    if (!editForm.plazo_nuevo || Number(editForm.plazo_nuevo) <= 0) { setError('El plazo nuevo debe ser mayor a 0.'); return }
    if (editForm.saldo_nuevo === '' || Number(editForm.saldo_nuevo) < 0) { setError('El saldo nuevo debe ser mayor o igual a 0.'); return }

    setSaving(true)
    setError(null)
    const supabase = createClient()

    const { error: err } = await supabase.from('ampliaciones').update({
      fecha:               editForm.fecha,
      nro_pagare_anterior: editForm.nro_pagare_anterior.trim() || null,
      nro_pagare_nuevo:    editForm.nro_pagare_nuevo.trim(),
      monto_nuevo:         Number(editForm.monto_nuevo),
      plazo_nuevo:         Number(editForm.plazo_nuevo),
      saldo_nuevo:         Number(editForm.saldo_nuevo),
      observacion:         editForm.observacion.trim() || null,
    }).eq('id', editingId!)

    setSaving(false)
    if (err) { setError(err.message); return }
    closeForm()
    reload()
  }

  async function remove(id: string) {
    const supabase = createClient()
    const { error: err } = await supabase.from('ampliaciones').delete().eq('id', id)
    setConfirmDeleteId(null)
    if (err) setError(err.message)
    else reload()
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-[#1e3a5f] uppercase tracking-wider">
          Historial de Ampliaciones
        </h2>
        {canWrite && formMode === null && (
          <button
            onClick={openApply}
            className="px-3 py-1.5 rounded-lg text-white text-xs font-medium hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#1e3a5f' }}
          >
            + Registrar Ampliación
          </button>
        )}
      </div>

      {/* Formulario funcional: Aplicar ampliación */}
      {formMode === 'apply' && canWrite && (
        <div className="mx-6 mt-4 rounded-xl border border-blue-200 bg-blue-50 p-5">
          <h3 className="text-sm font-semibold text-blue-900 mb-1">Aplicar Ampliación de Crédito</h3>
          <p className="text-xs text-blue-700 mb-4">
            Actualiza el crédito (pagaré, monto, saldo, plazo, tasa TEA y cuota) y registra el historial de forma atómica e irreversible.
          </p>

          {/* Advertencia cronograma */}
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 mb-4">
            <span className="mt-0.5 text-red-500 shrink-0">⚠</span>
            <span><strong>No se recalculará el cronograma de cuotas en esta fase.</strong></span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Fecha *</label>
              <input
                type="date"
                value={applyForm.fecha}
                onChange={e => setApplyForm(f => ({ ...f, fecha: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nuevo Nº Pagaré *</label>
              <input
                type="text"
                value={applyForm.nro_pagare_nuevo}
                onChange={e => setApplyForm(f => ({ ...f, nro_pagare_nuevo: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="Ej: 2024-001-A"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Monto a Ampliar (S/) *</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={applyForm.monto_a_ampliar}
                onChange={e => setApplyForm(f => ({ ...f, monto_a_ampliar: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Plazo Nuevo (meses) *</label>
              <input
                type="number"
                min="1"
                step="1"
                value={applyForm.plazo_nuevo}
                onChange={e => setApplyForm(f => ({ ...f, plazo_nuevo: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tasa TEA nueva (%) *</label>
              <input
                type="number"
                min="0"
                step="0.0001"
                value={applyForm.tasa_nueva}
                onChange={e => setApplyForm(f => ({ ...f, tasa_nueva: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Cuota Nueva (S/) *</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={applyForm.cuota_nueva}
                onChange={e => setApplyForm(f => ({ ...f, cuota_nueva: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="0.00"
              />
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-xs text-gray-500 mb-1">Observación</label>
              <textarea
                value={applyForm.observacion}
                onChange={e => setApplyForm(f => ({ ...f, observacion: e.target.value }))}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                placeholder="Notas adicionales..."
              />
            </div>
          </div>

          {/* Vista Previa del Resultado */}
          {montoAAmpliar > 0 && (
            <div className="mt-4 rounded-lg border border-blue-300 bg-white p-4">
              <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-3">Vista Previa del Resultado</p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Pagaré actual</p>
                  <p className="font-medium text-gray-700">{nroPagareActual ?? '—'}</p>
                  <p className="text-xs text-gray-300 mt-0.5">→</p>
                  <p className="font-semibold text-blue-900">{applyForm.nro_pagare_nuevo || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Monto aprobado</p>
                  <p className="font-medium text-gray-700">S/ {fmt(montoAprobado)}</p>
                  <p className="text-xs text-gray-300 mt-0.5">→</p>
                  <p className="font-semibold text-blue-900">S/ {fmt(previewMontoNuevo)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Saldo capital</p>
                  <p className="font-medium text-gray-700">S/ {fmt(saldoCapital)}</p>
                  <p className="text-xs text-gray-300 mt-0.5">→</p>
                  <p className="font-semibold text-blue-900">S/ {fmt(previewSaldoNuevo)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Plazo</p>
                  <p className="font-medium text-gray-700">{plazoMeses != null ? `${plazoMeses} m` : '—'}</p>
                  <p className="text-xs text-gray-300 mt-0.5">→</p>
                  <p className="font-semibold text-blue-900">{applyForm.plazo_nuevo ? `${applyForm.plazo_nuevo} m` : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Tasa TEA</p>
                  <p className="font-medium text-gray-700">{tasaInteres != null ? `${tasaInteres}%` : '—'}</p>
                  <p className="text-xs text-gray-300 mt-0.5">→</p>
                  <p className="font-semibold text-blue-900">{applyForm.tasa_nueva !== '' ? `${applyForm.tasa_nueva}%` : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Cuota mensual</p>
                  <p className="font-medium text-gray-700">S/ {fmt(cuotaMensual)}</p>
                  <p className="text-xs text-gray-300 mt-0.5">→</p>
                  <p className="font-semibold text-blue-900">{applyForm.cuota_nueva ? `S/ ${fmt(Number(applyForm.cuota_nueva))}` : '—'}</p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 mt-4">
            <button
              onClick={applyAmpliacion}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              style={{ backgroundColor: '#1e3a5f' }}
            >
              {saving ? 'Aplicando...' : 'Aplicar ampliación'}
            </button>
            <button
              onClick={closeForm}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Formulario de edición de registro histórico */}
      {formMode === 'edit' && canWrite && (
        <div className="mx-6 mt-4 rounded-xl border border-gray-200 bg-gray-50 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Editar Registro de Ampliación</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Fecha *</label>
              <input
                type="date"
                value={editForm.fecha}
                onChange={e => setEditForm(f => ({ ...f, fecha: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nº Pagaré Anterior</label>
              <input
                type="text"
                value={editForm.nro_pagare_anterior}
                onChange={e => setEditForm(f => ({ ...f, nro_pagare_anterior: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nº Pagaré Nuevo *</label>
              <input
                type="text"
                value={editForm.nro_pagare_nuevo}
                onChange={e => setEditForm(f => ({ ...f, nro_pagare_nuevo: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Monto Nuevo (S/) *</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={editForm.monto_nuevo}
                onChange={e => setEditForm(f => ({ ...f, monto_nuevo: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Plazo Nuevo (meses) *</label>
              <input
                type="number"
                min="1"
                step="1"
                value={editForm.plazo_nuevo}
                onChange={e => setEditForm(f => ({ ...f, plazo_nuevo: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Saldo Nuevo (S/) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={editForm.saldo_nuevo}
                onChange={e => setEditForm(f => ({ ...f, saldo_nuevo: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                placeholder="0.00"
              />
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-xs text-gray-500 mb-1">Observación</label>
              <textarea
                value={editForm.observacion}
                onChange={e => setEditForm(f => ({ ...f, observacion: e.target.value }))}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 resize-none"
                placeholder="Notas adicionales..."
              />
            </div>
          </div>
          {error && (
            <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex gap-3 mt-4">
            <button
              onClick={saveEdit}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              style={{ backgroundColor: '#1e3a5f' }}
            >
              {saving ? 'Guardando...' : 'Actualizar'}
            </button>
            <button
              onClick={closeForm}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista de historial */}
      <div className="p-6">
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-4">Cargando...</p>
        ) : ampliaciones.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Sin ampliaciones registradas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border border-gray-200 rounded-lg">
                  {['Fecha', 'Pagaré Anterior', 'Pagaré Nuevo', 'Monto Nuevo', 'Plazo Nuevo', 'Tasa TEA', 'Cuota Nueva', 'Saldo Nuevo', 'Observación', 'Registrado', ''].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ampliaciones.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2.5 text-sm text-gray-700 whitespace-nowrap">{formatDate(a.fecha)}</td>
                    <td className="px-3 py-2.5 text-sm text-gray-600 whitespace-nowrap">{a.nro_pagare_anterior ?? '—'}</td>
                    <td className="px-3 py-2.5 text-sm font-medium text-gray-800 whitespace-nowrap">{a.nro_pagare_nuevo}</td>
                    <td className="px-3 py-2.5 text-sm text-gray-700 whitespace-nowrap">S/ {fmt(a.monto_nuevo)}</td>
                    <td className="px-3 py-2.5 text-sm text-gray-700 whitespace-nowrap">{a.plazo_nuevo} m</td>
                    <td className="px-3 py-2.5 text-sm text-gray-700 whitespace-nowrap">{a.tasa_nueva != null ? `${a.tasa_nueva}%` : '—'}</td>
                    <td className="px-3 py-2.5 text-sm text-gray-700 whitespace-nowrap">{a.cuota_nueva != null ? `S/ ${fmt(a.cuota_nueva)}` : '—'}</td>
                    <td className="px-3 py-2.5 text-sm text-gray-700 whitespace-nowrap">S/ {fmt(a.saldo_nuevo)}</td>
                    <td className="px-3 py-2.5 text-sm text-gray-500 max-w-[200px] truncate">{a.observacion ?? '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-400 whitespace-nowrap">{formatDate(a.created_at)}</td>
                    <td className="px-3 py-2.5 text-sm whitespace-nowrap">
                      {canWrite && (
                        <button
                          onClick={() => openEdit(a)}
                          className="text-xs text-[#1e3a5f] hover:underline mr-3"
                        >
                          Editar
                        </button>
                      )}
                      {canDelete && confirmDeleteId !== a.id && (
                        <button
                          onClick={() => setConfirmDeleteId(a.id)}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Eliminar
                        </button>
                      )}
                      {canDelete && confirmDeleteId === a.id && (
                        <span className="inline-flex items-center gap-1 text-xs">
                          <button onClick={() => remove(a.id)} className="px-2 py-0.5 rounded bg-red-600 text-white hover:bg-red-700">Sí</button>
                          <button onClick={() => setConfirmDeleteId(null)} className="px-2 py-0.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50">No</button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
