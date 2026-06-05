'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

type FormData = {
  nro_pagare: string
  tasa_interes: string
  estado: string
  fecha_cancelacion: string
}

const inputCls =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white ' +
  'focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent'

const readCls =
  'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 bg-gray-50 cursor-not-allowed'

export default function EditarCreditoPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()

  const [form, setForm] = useState<FormData>({
    nro_pagare: '', tasa_interes: '', estado: 'vigente', fecha_cancelacion: '',
  })
  const [readOnly, setReadOnly] = useState({
    monto_aprobado: '', plazo_meses: '', cuota_mensual: '', tipo_credito: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    createClient()
      .from('creditos')
      .select('nro_pagare, tasa_interes, estado, fecha_cancelacion, monto_aprobado, plazo_meses, cuota_mensual, tipo_credito')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { setNotFound(true); setLoading(false); return }
        setForm({
          nro_pagare:       data.nro_pagare ?? '',
          tasa_interes:     data.tasa_interes?.toString() ?? '',
          estado:           data.estado ?? 'vigente',
          fecha_cancelacion: data.fecha_cancelacion ?? '',
        })
        setReadOnly({
          monto_aprobado: data.monto_aprobado != null
            ? new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(data.monto_aprobado)
            : '—',
          plazo_meses:  data.plazo_meses ? `${data.plazo_meses} meses` : '—',
          cuota_mensual: data.cuota_mensual != null
            ? new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(data.cuota_mensual)
            : '—',
          tipo_credito: data.tipo_credito ?? '—',
        })
        setLoading(false)
      })
  }, [id])

  function set(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    const { error: err } = await createClient()
      .from('creditos')
      .update({
        nro_pagare:        form.nro_pagare,
        tasa_interes:      parseFloat(form.tasa_interes) || null,
        estado:            form.estado,
        fecha_cancelacion: form.fecha_cancelacion || null,
      })
      .eq('id', id)

    if (err) { setError(err.message); setSaving(false); return }
    router.push(`/dashboard/creditos/${id}`)
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Cargando...</div>
  if (notFound) {
    return (
      <div className="p-8">
        <p className="text-sm text-gray-500">Crédito no encontrado.</p>
        <Link href="/dashboard/creditos" className="text-sm text-[#1e3a5f] underline mt-2 inline-block">
          Volver a Créditos
        </Link>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link
          href={`/dashboard/creditos/${id}`}
          className="text-sm text-gray-400 hover:text-gray-600 mb-1 inline-block transition-colors"
        >
          ← Volver al detalle
        </Link>
        <h1 className="text-2xl font-bold text-gray-800">Editar Crédito</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Campos solo lectura */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xs font-semibold text-[#1e3a5f] uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
            Datos no editables
          </h2>
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4">
            <p className="text-xs text-amber-700">
              El monto, plazo y cuota mensual no son editables para preservar la integridad del cronograma de pagos.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Monto Aprobado (S/)</label>
              <div className={readCls}>S/ {readOnly.monto_aprobado}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Plazo</label>
              <div className={readCls}>{readOnly.plazo_meses}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Cuota Mensual (S/)</label>
              <div className={readCls}>S/ {readOnly.cuota_mensual}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Tipo de Crédito</label>
              <div className={readCls}>{readOnly.tipo_credito}</div>
            </div>
          </div>
        </div>

        {/* Campos editables */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xs font-semibold text-[#1e3a5f] uppercase tracking-wider mb-5 pb-2 border-b border-gray-100">
            Campos editables
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nº Pagaré <span className="text-red-500">*</span>
              </label>
              <input name="nro_pagare" value={form.nro_pagare} onChange={set} required className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tasa de Interés Anual (%)</label>
              <input
                type="number" step="0.01" min="0"
                name="tasa_interes" value={form.tasa_interes}
                onChange={set} className={inputCls}
                placeholder="Ej: 24.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estado <span className="text-red-500">*</span>
              </label>
              <select name="estado" value={form.estado} onChange={set} className={inputCls}>
                <option value="vigente">Vigente</option>
                <option value="cancelado">Cancelado</option>
                <option value="castigado">Castigado</option>
                <option value="refinanciado">Refinanciado</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Cancelación</label>
              <input
                type="date" name="fecha_cancelacion"
                value={form.fecha_cancelacion} onChange={set}
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pb-4">
          <Link
            href={`/dashboard/creditos/${id}`}
            className="px-5 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-lg text-white text-sm font-medium transition-opacity disabled:opacity-60"
            style={{ backgroundColor: '#1e3a5f' }}
          >
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </form>
    </div>
  )
}
