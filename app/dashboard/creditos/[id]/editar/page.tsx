'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useRol } from '@/lib/useRol'
import AccesoDenegado from '@/components/AccesoDenegado'
import { PageFrame, PageToolbar, FormPanel, FormSection, ActionStrip, InlineAlert, btnPrimary, btnGhost, inputCls as uiInputCls, selectCls as uiSelectCls } from '../../../_components/ui'

const PUEDE_EDITAR_CREDITOS = ['admin', 'creditos']

type FormData = {
  nro_pagare: string
  tasa_interes: string
  estado: string
  fecha_cancelacion: string
  nro_expediente: string
  tipo_credito_sbs: string
  subtipo_credito_sbs: string
  cuenta_contable_bd01: string
  aporte_descontado: string
  tramite: string
}

const inputCls = uiInputCls
const selectCls = uiSelectCls

const readCls =
  'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-500 bg-slate-50 cursor-not-allowed'

export default function EditarCreditoPage() {
  const { rol, loading: checkingRol } = useRol()
  const { id } = useParams() as { id: string }
  const router = useRouter()

  const [form, setForm] = useState<FormData>({
    nro_pagare: '', tasa_interes: '', estado: 'vigente', fecha_cancelacion: '',
    nro_expediente: '', tipo_credito_sbs: 'consumo_no_revolvente',
    subtipo_credito_sbs: '', cuenta_contable_bd01: '1411050604',
    aporte_descontado: '0', tramite: '0',
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
      .select('nro_pagare, tasa_interes, estado, fecha_cancelacion, monto_aprobado, plazo_meses, cuota_mensual, tipo_credito, nro_expediente, tipo_credito_sbs, subtipo_credito_sbs, cuenta_contable_bd01, aporte_descontado, tramite')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { setNotFound(true); setLoading(false); return }
        setForm({
          nro_pagare:          data.nro_pagare ?? '',
          tasa_interes:        data.tasa_interes?.toString() ?? '',
          estado:              data.estado ?? 'vigente',
          fecha_cancelacion:   data.fecha_cancelacion ?? '',
          nro_expediente:      data.nro_expediente ?? '',
          tipo_credito_sbs:    data.tipo_credito_sbs ?? 'consumo_no_revolvente',
          subtipo_credito_sbs: data.subtipo_credito_sbs ?? '',
          cuenta_contable_bd01: data.cuenta_contable_bd01 ?? '1411050604',
          aporte_descontado:   data.aporte_descontado?.toString() ?? '0',
          tramite:             data.tramite?.toString() ?? '0',
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
        nro_pagare:          form.nro_pagare,
        tasa_interes:        parseFloat(form.tasa_interes) || null,
        estado:              form.estado,
        fecha_cancelacion:   form.fecha_cancelacion || null,
        nro_expediente:      form.nro_expediente || null,
        tipo_credito_sbs:    form.tipo_credito_sbs || null,
        subtipo_credito_sbs: form.subtipo_credito_sbs || null,
        cuenta_contable_bd01: form.cuenta_contable_bd01 || null,
        aporte_descontado:   parseFloat(form.aporte_descontado) || 0,
        tramite:             parseFloat(form.tramite) || 0,
      })
      .eq('id', id)

    if (err) { setError(err.message); setSaving(false); return }
    router.push(`/dashboard/creditos/${id}`)
  }

  if (checkingRol) return <div className="min-h-full bg-slate-50 p-8 text-sm text-slate-400">Verificando acceso...</div>
  if (!PUEDE_EDITAR_CREDITOS.includes(rol ?? '')) {
    return <AccesoDenegado mensaje="Solo los roles Administrador y Créditos pueden editar créditos." />
  }

  if (loading) return <div className="min-h-full bg-slate-50 p-8 text-sm text-slate-400">Cargando...</div>
  if (notFound) {
    return (
      <PageFrame>
        <p className="text-sm text-slate-500">Crédito no encontrado.</p>
        <Link href="/dashboard/creditos" className={`${btnGhost} mt-2 inline-flex`}>Volver a Créditos</Link>
      </PageFrame>
    )
  }

  return (
    <PageFrame>
      <PageToolbar
        title="Editar Crédito"
        actions={
          <Link href={`/dashboard/creditos/${id}`} className={btnGhost}>Cancelar</Link>
        }
      />

      <FormPanel>
        <form onSubmit={handleSubmit} className="space-y-6">

          <FormSection title="Datos no editables" description="El monto, plazo y cuota mensual no son editables para preservar la integridad del cronograma de pagos.">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Monto Aprobado (S/)</label>
                <div className={readCls}>S/ {readOnly.monto_aprobado}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Plazo</label>
                <div className={readCls}>{readOnly.plazo_meses}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Cuota Mensual (S/)</label>
                <div className={readCls}>S/ {readOnly.cuota_mensual}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Tipo de Crédito</label>
                <div className={readCls}>{readOnly.tipo_credito}</div>
              </div>
            </div>
          </FormSection>

          <FormSection title="Campos Editables">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nº Pagaré <span className="text-red-500">*</span>
                </label>
                <input name="nro_pagare" value={form.nro_pagare} onChange={set} required className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tasa de interés TEA (%)</label>
                <input
                  type="number" step="0.01" min="0"
                  name="tasa_interes" value={form.tasa_interes}
                  onChange={set} className={inputCls}
                  placeholder="Ej: 24.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Estado <span className="text-red-500">*</span>
                </label>
                <select name="estado" value={form.estado} onChange={set} className={selectCls}>
                  <option value="vigente">Vigente</option>
                  <option value="cancelado">Cancelado</option>
                  <option value="castigado">Castigado</option>
                  <option value="refinanciado">Refinanciado</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de Cancelación</label>
                <input
                  type="date" name="fecha_cancelacion"
                  value={form.fecha_cancelacion} onChange={set}
                  className={inputCls}
                />
              </div>
            </div>
          </FormSection>

          <FormSection title="Datos SBS / BDCC" description="Campos usados para reportes SBS/BDCC. Revisables por Contabilidad/Créditos.">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nº Expediente</label>
                <input name="nro_expediente" value={form.nro_expediente} onChange={set} className={inputCls} placeholder="Ej: EXP-2026-001" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo Crédito SBS</label>
                <select name="tipo_credito_sbs" value={form.tipo_credito_sbs} onChange={set} className={selectCls}>
                  <option value="">No especificado</option>
                  <option value="consumo_no_revolvente">Consumo no revolvente</option>
                  <option value="consumo_revolvente">Consumo revolvente</option>
                  <option value="microempresa">Microempresa</option>
                  <option value="pequena_empresa">Pequeña empresa</option>
                  <option value="hipotecario">Hipotecario</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Subtipo Crédito SBS</label>
                <input name="subtipo_credito_sbs" value={form.subtipo_credito_sbs} onChange={set} className={inputCls} placeholder="Pendiente de catálogo" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cuenta Contable BD01</label>
                <input name="cuenta_contable_bd01" value={form.cuenta_contable_bd01} onChange={set} className={inputCls} placeholder="1411050604" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Aporte Descontado (S/)</label>
                <input type="number" step="0.01" min="0" name="aporte_descontado" value={form.aporte_descontado} onChange={set} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Trámite (S/)</label>
                <input type="number" step="0.01" min="0" name="tramite" value={form.tramite} onChange={set} className={inputCls} />
              </div>
            </div>
          </FormSection>

          {error && <InlineAlert variant="danger">{error}</InlineAlert>}

          <ActionStrip>
            <Link href={`/dashboard/creditos/${id}`} className={btnGhost}>Cancelar</Link>
            <button
              type="submit"
              disabled={saving}
              className={`${btnPrimary} disabled:opacity-60`}
            >
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </ActionStrip>
        </form>
      </FormPanel>
    </PageFrame>
  )
}
