'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import SocioSearch from '../_components/SocioSearch'
import { useRol } from '@/lib/useRol'
import AccesoDenegado from '@/components/AccesoDenegado'
import { PageFrame, PageToolbar, FormPanel, FormSection, ActionStrip, InlineAlert, btnPrimary, btnGhost, inputCls as uiInputCls, selectCls as uiSelectCls } from '../../_components/ui'

const PUEDE_CREAR_CREDITOS = ['admin', 'creditos']

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Cuota fija: M = P · r(1+r)^n / [(1+r)^n − 1] */
function calcCuota(principal: number, tasaAnual: number, plazo: number): number {
  if (!principal || !plazo) return 0
  const r = tasaAnual / 100 / 12
  if (r === 0) return principal / plazo
  const factor = Math.pow(1 + r, plazo)
  return (principal * r * factor) / (factor - 1)
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

/** Sumar i meses a una fecha 'YYYY-MM-DD' sin problemas de timezone */
function addMonths(fechaStr: string, months: number): string {
  const [y, m, d] = fechaStr.split('-').map(Number)
  const totalMonths = (m - 1) + months
  const newYear = y + Math.floor(totalMonths / 12)
  const newMonth = (totalMonths % 12) + 1
  return `${String(newYear).padStart(4, '0')}-${String(newMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function fmtNum(n: number) {
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

// ── Estilos ──────────────────────────────────────────────────────────────────

const inputCls = uiInputCls
const selectCls = uiSelectCls

const readCls =
  'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 bg-slate-50 cursor-not-allowed'

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

// ── Componente ───────────────────────────────────────────────────────────────

type FormState = {
  nro_pagare: string
  fecha_desembolso: string
  monto_aprobado: string
  tasa_interes: string
  plazo_meses: string
  tipo_credito: string
  descuento_fps: string
  descuento_seguro: string
  descuento_otros: string
  nro_expediente: string
  tipo_credito_sbs: string
  subtipo_credito_sbs: string
  cuenta_contable_bd01: string
  aporte_descontado: string
  tramite: string
}

const EMPTY: FormState = {
  nro_pagare: '', fecha_desembolso: '', monto_aprobado: '',
  tasa_interes: '', plazo_meses: '', tipo_credito: '',
  descuento_fps: '0', descuento_seguro: '0', descuento_otros: '0',
  nro_expediente: '', tipo_credito_sbs: 'consumo_no_revolvente',
  subtipo_credito_sbs: '', cuenta_contable_bd01: '1411050604',
  aporte_descontado: '0', tramite: '0',
}

export default function NuevoCreditoPage() {
  const { rol, loading: checkingRol } = useRol()
  const router = useRouter()
  const [idSocio, setIdSocio] = useState('')
  const [form, setForm] = useState<FormState>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  // Valores derivados (reactivos)
  const monto   = parseFloat(form.monto_aprobado) || 0
  const fps     = parseFloat(form.descuento_fps)   || 0
  const seguro  = parseFloat(form.descuento_seguro) || 0
  const otros   = parseFloat(form.descuento_otros)  || 0
  const tasa    = parseFloat(form.tasa_interes)     || 0
  const plazo   = parseInt(form.plazo_meses)        || 0

  const montoGiradoNeto = round2(monto - fps - seguro - otros)
  const cuotaMensual    = round2(calcCuota(monto, tasa, plazo))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!idSocio) { setError('Debes seleccionar un socio.'); return }
    if (!form.nro_pagare.trim()) { setError('El Nº de pagaré es obligatorio.'); return }
    if (!form.fecha_desembolso) { setError('La fecha de desembolso es obligatoria.'); return }
    if (monto <= 0) { setError('El monto aprobado debe ser mayor a 0.'); return }
    if (tasa < 0) { setError('La tasa de interés no puede ser negativa.'); return }
    if (plazo < 1) { setError('El plazo debe ser mayor a 0 meses.'); return }

    setError(null)
    setLoading(true)

    const supabase = createClient()

    // Construir cronograma de cuotas en memoria
    const r = tasa / 100 / 12
    let saldo = monto
    const p_cuotas = []

    for (let i = 1; i <= plazo; i++) {
      const interes = round2(saldo * r)
      let capital: number
      let cuotaTotal: number

      if (i === plazo) {
        capital    = round2(saldo)
        cuotaTotal = round2(capital + interes)
      } else {
        capital    = round2(cuotaMensual - interes)
        cuotaTotal = cuotaMensual
      }

      saldo = round2(saldo - capital)

      p_cuotas.push({
        nro_cuota:         i,
        fecha_vencimiento: addMonths(form.fecha_desembolso, i),
        capital,
        interes,
        cuota_total:       cuotaTotal,
        capital_pagado:    0,
        interes_pagado:    0,
        estado:            'pendiente',
      })
    }

    const p_credito = {
      id_socio:          idSocio,
      nro_pagare:        form.nro_pagare,
      fecha_desembolso:  form.fecha_desembolso,
      monto_aprobado:    monto,
      monto_girado_neto: montoGiradoNeto,
      descuento_fps:     fps,
      descuento_seguro:  seguro,
      descuento_otros:   otros,
      tasa_interes:      tasa,
      plazo_meses:       plazo,
      cuota_mensual:     cuotaMensual,
      tipo_credito:      form.tipo_credito || null,
      interes_acumulado: 0,
    }

    const { data: creditoId, error: rpcErr } = await supabase.rpc('crear_credito_con_cronograma', {
      p_credito,
      p_cuotas,
    })

    if (rpcErr) {
      setError(rpcErr.message)
      setLoading(false)
      return
    }

    if (creditoId) {
      await supabase.from('creditos').update({
        nro_expediente:       form.nro_expediente || null,
        tipo_credito_sbs:     form.tipo_credito_sbs || null,
        subtipo_credito_sbs:  form.subtipo_credito_sbs || null,
        cuenta_contable_bd01: form.cuenta_contable_bd01 || null,
        aporte_descontado:    parseFloat(form.aporte_descontado) || 0,
        tramite:              parseFloat(form.tramite) || 0,
      }).eq('id', creditoId)
    }

    router.push('/dashboard/creditos')
  }

  if (checkingRol) return <div className="min-h-full bg-slate-50 p-8 text-sm text-slate-400">Verificando acceso...</div>
  if (!PUEDE_CREAR_CREDITOS.includes(rol ?? '')) {
    return <AccesoDenegado mensaje="Solo los roles Administrador y Créditos pueden registrar nuevos créditos." />
  }

  return (
    <PageFrame>
      <PageToolbar
        title="Registrar Nuevo Crédito"
        actions={
          <Link href="/dashboard/creditos" className={btnGhost}>Cancelar</Link>
        }
      />

      <FormPanel>
        <form onSubmit={handleSubmit} className="space-y-6">

          <FormSection title="Socio">
            <Field label="Buscar Socio" required>
              <SocioSearch value={idSocio} onChange={(id) => setIdSocio(id)} />
            </Field>
          </FormSection>

          <FormSection title="Datos del Crédito">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="Nº Pagaré" required>
                <input name="nro_pagare" value={form.nro_pagare} onChange={set} required className={inputCls} />
              </Field>
              <Field label="Fecha de Desembolso" required>
                <input type="date" name="fecha_desembolso" value={form.fecha_desembolso} onChange={set} required className={inputCls} />
              </Field>
              <Field label="Tipo de Crédito">
                <select name="tipo_credito" value={form.tipo_credito} onChange={set} className={selectCls}>
                  <option value="">Seleccionar...</option>
                  <option value="consumo">Consumo</option>
                  <option value="microempresa">Microempresa</option>
                  <option value="hipotecario">Hipotecario</option>
                  <option value="otro">Otro</option>
                </select>
              </Field>
              <Field label="Monto Aprobado (S/)" required>
                <input
                  type="number" step="0.01" min="0.01"
                  name="monto_aprobado" value={form.monto_aprobado}
                  onChange={set} required className={inputCls}
                  placeholder="0.00"
                />
              </Field>
              <Field label="Tasa de interés TEA (%)" required>
                <input
                  type="number" step="0.01" min="0"
                  name="tasa_interes" value={form.tasa_interes}
                  onChange={set} required className={inputCls}
                  placeholder="Ej: 24.00"
                />
              </Field>
              <Field label="Plazo (meses)" required>
                <input
                  type="number" min="1" step="1"
                  name="plazo_meses" value={form.plazo_meses}
                  onChange={set} required className={inputCls}
                  placeholder="Ej: 12"
                />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Descuentos al Desembolso">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Descuento FPS (S/)">
                <input type="number" step="0.01" min="0" name="descuento_fps" value={form.descuento_fps} onChange={set} className={inputCls} />
              </Field>
              <Field label="Descuento Seguro (S/)">
                <input type="number" step="0.01" min="0" name="descuento_seguro" value={form.descuento_seguro} onChange={set} className={inputCls} />
              </Field>
              <Field label="Otros Descuentos (S/)">
                <input type="number" step="0.01" min="0" name="descuento_otros" value={form.descuento_otros} onChange={set} className={inputCls} />
              </Field>
              <Field label="Aporte Descontado (S/)">
                <input type="number" step="0.01" min="0" name="aporte_descontado" value={form.aporte_descontado} onChange={set} className={inputCls} />
              </Field>
              <Field label="Trámite (S/)">
                <input type="number" step="0.01" min="0" name="tramite" value={form.tramite} onChange={set} className={inputCls} />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Datos SBS / BDCC" description="Campos usados para reportes SBS/BDCC. Revisables por Contabilidad/Créditos.">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="Nº Expediente">
                <input name="nro_expediente" value={form.nro_expediente} onChange={set} className={inputCls} placeholder="Ej: EXP-2026-001" />
              </Field>
              <Field label="Tipo Crédito SBS">
                <select name="tipo_credito_sbs" value={form.tipo_credito_sbs} onChange={set} className={selectCls}>
                  <option value="">No especificado</option>
                  <option value="consumo_no_revolvente">Consumo no revolvente</option>
                  <option value="consumo_revolvente">Consumo revolvente</option>
                  <option value="microempresa">Microempresa</option>
                  <option value="pequena_empresa">Pequeña empresa</option>
                  <option value="hipotecario">Hipotecario</option>
                </select>
              </Field>
              <Field label="Subtipo Crédito SBS">
                <input name="subtipo_credito_sbs" value={form.subtipo_credito_sbs} onChange={set} className={inputCls} placeholder="Pendiente de catálogo" />
              </Field>
              <Field label="Cuenta Contable BD01">
                <input name="cuenta_contable_bd01" value={form.cuenta_contable_bd01} onChange={set} className={inputCls} placeholder="1411050604" />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Resumen Calculado">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Monto Girado Neto (S/)">
                <div className={readCls}>S/ {fmtNum(montoGiradoNeto)}</div>
              </Field>
              <Field label="Cuota Mensual (S/)">
                <div className={readCls}>
                  {plazo > 0 && monto > 0
                    ? `S/ ${fmtNum(cuotaMensual)}`
                    : <span className="text-slate-400">Ingresa monto, tasa y plazo</span>
                  }
                </div>
              </Field>
            </div>

            {/* Vista previa del cronograma */}
            {plazo > 0 && monto > 0 && (
              <div className="mt-5">
                <p className="text-xs font-medium text-slate-500 mb-2">
                  Vista previa del cronograma ({plazo} cuotas)
                </p>
                <div className="overflow-x-auto border border-slate-100 rounded-lg max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                      <tr>
                        {['Nº', 'Vencimiento', 'Capital', 'Interés', 'Cuota'].map(h => (
                          <th key={h} className="px-3 py-2 text-left font-medium text-slate-500 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const r = tasa / 100 / 12
                        let saldo = monto
                        return Array.from({ length: plazo }, (_, idx) => {
                          const i = idx + 1
                          const interes = round2(saldo * r)
                          let capital: number
                          let cuotaTotal: number
                          if (i === plazo) {
                            capital = round2(saldo)
                            cuotaTotal = round2(capital + interes)
                          } else {
                            capital = round2(cuotaMensual - interes)
                            cuotaTotal = cuotaMensual
                          }
                          saldo = round2(saldo - capital)
                          return (
                            <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                              <td className="px-3 py-1.5 text-slate-700">{i}</td>
                              <td className="px-3 py-1.5 text-slate-600">
                                {form.fecha_desembolso ? addMonths(form.fecha_desembolso, i).split('-').reverse().join('/') : '—'}
                              </td>
                              <td className="px-3 py-1.5 text-slate-700 tabular-nums">{fmtNum(capital)}</td>
                              <td className="px-3 py-1.5 text-slate-700 tabular-nums">{fmtNum(interes)}</td>
                              <td className="px-3 py-1.5 font-medium text-slate-900 tabular-nums">{fmtNum(cuotaTotal)}</td>
                            </tr>
                          )
                        })
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </FormSection>

          {error && <InlineAlert variant="danger">{error}</InlineAlert>}

          <ActionStrip>
            <Link href="/dashboard/creditos" className={btnGhost}>Cancelar</Link>
            <button
              type="submit"
              disabled={loading}
              className={`${btnPrimary} disabled:opacity-60`}
            >
              {loading ? 'Registrando...' : 'Registrar Crédito'}
            </button>
          </ActionStrip>
        </form>
      </FormPanel>
    </PageFrame>
  )
}
