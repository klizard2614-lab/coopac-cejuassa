'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import SocioSearch from '../../creditos/_components/SocioSearch'
import { useRol } from '@/lib/useRol'
import AccesoDenegado from '@/components/AccesoDenegado'
import { PageFrame, PageToolbar, FormPanel, FormSection, ActionStrip, InlineAlert, btnPrimary, btnGhost, inputCls as uiInputCls, selectCls as uiSelectCls } from '../../_components/ui'
import {
  registrarPagoConAplicacion,
  mensajeErrorAmigable,
  RegistrarPagoError,
  type RegistrarPagoResultado,
} from '@/lib/pagos/registrarPagoConAplicacion'

const PUEDE_CREAR_PAGOS = ['admin', 'tesoreria']

// ── Tipos ────────────────────────────────────────────────────────────────────

type SocioInfo = {
  id: string
  nro_socio: string
  dni: string
  apellidos: string
  nombres: string
  id_convenio: string | null
}

type CreditoVigente = {
  id: string
  nro_pagare: string
  saldo_capital: number
  cuota_mensual: number
  estado: string
}

type ConvenioInfo = {
  id: string
  nombre: string
}

type FormState = {
  nro_recibo: string
  fecha: string
  periodo: string
  canal_pago: string
  tipo_pago: string
  monto_aporte: string
  monto_capital: string
  monto_interes: string
  monto_fps: string
  monto_fps_extra: string
  monto_otros: string
  interes_amortizado_pagado: string
  observacion: string
}

const EMPTY: FormState = {
  nro_recibo: '',
  fecha: '',
  periodo: '',
  canal_pago: 'caja',
  tipo_pago: 'A',
  monto_aporte: '0',
  monto_capital: '0',
  monto_interes: '0',
  monto_fps: '0',
  monto_fps_extra: '0',
  monto_otros: '0',
  interes_amortizado_pagado: '0',
  observacion: '',
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const inputCls = uiInputCls
const selectCls = uiSelectCls

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

function DataChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-lg px-4 py-3 border border-slate-100">
      <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-slate-800 tabular-nums">{value}</p>
    </div>
  )
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function NuevoPagoPage() {
  const { rol, loading: checkingRol } = useRol()

  const [idSocio, setIdSocio] = useState('')
  const [socio, setSocio] = useState<SocioInfo | null>(null)
  const [credito, setCredito] = useState<CreditoVigente | null>(null)
  const [convenio, setConvenio] = useState<ConvenioInfo | null>(null)
  const [loadingSocio, setLoadingSocio] = useState(false)

  const [form, setForm] = useState<FormState>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<RegistrarPagoResultado | null>(null)

  // Fetch socio info + credito vigente + convenio when socio selected
  useEffect(() => {
    if (!idSocio) {
      setSocio(null)
      setCredito(null)
      setConvenio(null)
      return
    }

    setLoadingSocio(true)
    const supabase = createClient()

    Promise.all([
      supabase
        .from('socios')
        .select('id, nro_socio, dni, apellidos, nombres, id_convenio')
        .eq('id', idSocio)
        .single(),
      supabase
        .from('creditos')
        .select('id, nro_pagare, saldo_capital, cuota_mensual, estado')
        .eq('id_socio', idSocio)
        .eq('estado', 'vigente')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]).then(([{ data: s }, { data: c }]) => {
      const socioData = s as SocioInfo | null
      setSocio(socioData)
      setCredito(c as CreditoVigente | null)

      if (socioData?.id_convenio) {
        supabase
          .from('convenios')
          .select('id, nombre')
          .eq('id', socioData.id_convenio)
          .single()
          .then(({ data: cv }) => setConvenio(cv as ConvenioInfo | null))
      } else {
        setConvenio(null)
      }

      // Pre-fill cuota mensual fields if credito found
      if (c) {
        const cred = c as CreditoVigente
        setForm(prev => ({
          ...prev,
          monto_capital: String(cred.cuota_mensual ?? 0),
        }))
      }

      setLoadingSocio(false)
    })
  }, [idSocio])

  function set(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  // Derived: monto_total
  const montoAporte   = parseFloat(form.monto_aporte)   || 0
  const montoCapital  = parseFloat(form.monto_capital)  || 0
  const montoInteres  = parseFloat(form.monto_interes)  || 0
  const montoFps      = parseFloat(form.monto_fps)      || 0
  const montoFpsExtra = parseFloat(form.monto_fps_extra)|| 0
  const montoOtros    = parseFloat(form.monto_otros)    || 0
  const montoTotal    = montoAporte + montoCapital + montoInteres + montoFps + montoFpsExtra + montoOtros

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!idSocio) { setError('Debes seleccionar un socio.'); return }
    if (!form.nro_recibo.trim()) { setError('El Nº de recibo es obligatorio.'); return }
    if (!form.fecha) { setError('La fecha es obligatoria.'); return }
    if (!form.periodo) { setError('El periodo es obligatorio (formato YYYY-MM).'); return }
    if (!/^\d{4}-\d{2}$/.test(form.periodo)) { setError('El periodo debe tener el formato YYYY-MM (ej: 2026-03).'); return }
    if (montoTotal <= 0) { setError('El monto total del recibo debe ser mayor a 0.'); return }

    if (credito && montoCapital > 0 && montoCapital > credito.saldo_capital) {
      setError(`El monto capital (S/ ${fmt(montoCapital)}) supera el saldo disponible del crédito (S/ ${fmt(credito.saldo_capital)}).`)
      return
    }

    if ((montoCapital > 0 || montoInteres > 0) && !credito) {
      setError('Para registrar capital o interés debes tener un crédito vigente seleccionado.')
      return
    }

    setError(null)
    setLoading(true)

    const supabase = createClient()

    // ── 1. Registrar el pago y aplicarlo en cascada contra cuotas ─────────────
    // Reemplaza el flujo viejo (insert directo + decrementar_saldo_capital +
    // update manual de 1 sola cuota) por la RPC transaccional 10K-3B, que
    // hace todo en una sola transacción con tope exacto y trazabilidad.
    let resultadoPago: RegistrarPagoResultado
    try {
      resultadoPago = await registrarPagoConAplicacion(supabase, {
        nroRecibo: form.nro_recibo.trim(),
        idSocio: Number(idSocio),
        idCredito: credito ? Number(credito.id) : null,
        idConvenio: socio?.id_convenio ? Number(socio.id_convenio) : null,
        fecha: form.fecha,
        periodo: form.periodo,
        canalPago: form.canal_pago,
        tipoPago: form.tipo_pago || null,
        montoAporte,
        montoCapital,
        montoInteres,
        montoFps,
        montoFpsExtra,
        montoOtros,
        interesAmortizadoPagado: parseFloat(form.interes_amortizado_pagado) || 0,
        observacion: form.observacion.trim() || null,
      })
    } catch (err) {
      const rpcError = err instanceof RegistrarPagoError
        ? err
        : new RegistrarPagoError('desconocido', err instanceof Error ? err.message : 'Error al registrar el pago.')
      setError(mensajeErrorAmigable(rpcError))
      setLoading(false)
      return
    }

    // ── 2. Aporte: sigue como segunda operación no atómica (fuera de la RPC) ──
    // Solo se llama después de que el pago ya se registró y aplicó con éxito.
    if (montoAporte > 0) {
      const { error: aporteErr } = await supabase.rpc('registrar_aporte_socio', {
        p_id_socio:    Number(idSocio),
        p_id_recibo:   resultadoPago.id_pago,
        p_fecha:       form.fecha,
        p_monto:       montoAporte,
        p_observacion: form.observacion.trim() || null,
      })

      if (aporteErr) {
        setError(`Pago registrado y aplicado a cuotas correctamente, pero hubo un error al registrar el aporte: ${aporteErr.message}`)
        setLoading(false)
        return
      }
    }

    setResultado(resultadoPago)
    setLoading(false)
  }

  function handleRegistrarOtroPago() {
    setResultado(null)
    setForm(EMPTY)
    setIdSocio('')
    setError(null)
  }

  if (checkingRol) return <div className="min-h-full bg-slate-50 p-8 text-sm text-slate-400">Verificando acceso...</div>
  if (!PUEDE_CREAR_PAGOS.includes(rol ?? '')) {
    return <AccesoDenegado mensaje="Solo los roles Administrador y Tesorería pueden registrar pagos." />
  }

  if (resultado) {
    const advertenciasVisibles = resultado.advertencias.filter(a => !a.startsWith('monto_aporte'))
    return (
      <PageFrame>
        <PageToolbar title="Pago registrado" />
        <FormPanel>
          <div className="space-y-5">
            <InlineAlert variant="success">
              Pago Nº {resultado.id_pago} registrado correctamente{resultado.id_credito ? ' y aplicado contra el cronograma de cuotas.' : '.'}
            </InlineAlert>

            {resultado.id_credito && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <DataChip label="Cuotas afectadas" value={String(resultado.cuotas_afectadas.length)} />
                <DataChip label="Cuotas pagadas" value={String(resultado.cuotas_pagadas)} />
                <DataChip label="Cuotas parciales" value={String(resultado.cuotas_parciales)} />
                <DataChip label="Aplicado a crédito" value={`S/ ${fmt(resultado.monto_credito_aplicado)}`} />
              </div>
            )}

            {resultado.excedente > 0.005 && (
              <InlineAlert variant="warning">
                Este pago tiene S/ {fmt(resultado.excedente)} sin aplicar a ninguna cuota — verifica el monto ingresado.
              </InlineAlert>
            )}

            {advertenciasVisibles.map((adv, i) => (
              <InlineAlert key={i} variant="warning">{adv}</InlineAlert>
            ))}

            <ActionStrip>
              <button type="button" className={btnGhost} onClick={handleRegistrarOtroPago}>
                Registrar otro pago
              </button>
              <Link href="/dashboard/pagos" className={btnPrimary}>Ver pagos</Link>
            </ActionStrip>
          </div>
        </FormPanel>
      </PageFrame>
    )
  }

  return (
    <PageFrame>
      <PageToolbar
        title="Registrar Pago"
        actions={
          <Link href="/dashboard/pagos" className={btnGhost}>Cancelar</Link>
        }
      />

      <FormPanel>
        <form onSubmit={handleSubmit} className="space-y-6">

          <FormSection title="Buscar Socio">
            <Field label="Nombre o DNI del socio" required>
              <SocioSearch
                value={idSocio}
                onChange={(id) => { setIdSocio(id) }}
              />
            </Field>

            {loadingSocio && (
              <p className="text-sm text-slate-400 mt-3">Cargando datos del socio...</p>
            )}

            {socio && !loadingSocio && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <DataChip label="Nº Socio"  value={socio.nro_socio} />
                <DataChip label="DNI"       value={socio.dni} />
                <DataChip label="Apellidos" value={socio.apellidos} />
                <DataChip label="Nombres"   value={socio.nombres} />
                <DataChip label="Convenio"  value={convenio?.nombre ?? '—'} />
                {credito ? (
                  <>
                    <DataChip label="Nº Pagaré"    value={credito.nro_pagare} />
                    <DataChip label="Saldo Capital" value={`S/ ${fmt(credito.saldo_capital)}`} />
                    <DataChip label="Cuota Mensual" value={`S/ ${fmt(credito.cuota_mensual)}`} />
                  </>
                ) : (
                  <div className="col-span-3">
                    <InlineAlert variant="warning">Este socio no tiene un crédito vigente.</InlineAlert>
                  </div>
                )}
              </div>
            )}
          </FormSection>

          <FormSection title="Datos del Recibo">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Field label="Nº Recibo" required>
                <input
                  name="nro_recibo"
                  value={form.nro_recibo}
                  onChange={set}
                  required
                  className={inputCls}
                  placeholder="Ej: R-000123"
                />
              </Field>
              <Field label="Fecha" required>
                <input
                  type="date"
                  name="fecha"
                  value={form.fecha}
                  onChange={set}
                  required
                  className={inputCls}
                />
              </Field>
              <Field label="Periodo (YYYY-MM)" required>
                <input
                  name="periodo"
                  value={form.periodo}
                  onChange={set}
                  required
                  pattern="\d{4}-\d{2}"
                  placeholder="Ej: 2025-06"
                  className={inputCls}
                />
              </Field>
              <Field label="Canal de Pago" required>
                <select name="canal_pago" value={form.canal_pago} onChange={set} className={selectCls}>
                  <option value="caja">Caja</option>
                  <option value="convenio">Convenio</option>
                </select>
              </Field>
              <Field label="Tipo de Pago (SBS)">
                <select name="tipo_pago" value={form.tipo_pago} onChange={set} className={selectCls}>
                  <option value="A">A — Pago normal / amortización</option>
                  <option value="K">K — Cancelación total (pendiente de confirmación)</option>
                  <option value="">No especificado</option>
                </select>
              </Field>
            </div>
          </FormSection>

          <FormSection title="Desglose del Pago">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="Aporte (S/)">
                <input type="number" step="0.01" min="0" name="monto_aporte" value={form.monto_aporte} onChange={set} className={inputCls} placeholder="0.00" />
              </Field>
              <Field label="Capital (S/)">
                <input type="number" step="0.01" min="0" name="monto_capital" value={form.monto_capital} onChange={set} className={inputCls} placeholder="0.00" />
              </Field>
              <Field label="Interés (S/)">
                <input type="number" step="0.01" min="0" name="monto_interes" value={form.monto_interes} onChange={set} className={inputCls} placeholder="0.00" />
              </Field>
              <Field label="FPS (S/)">
                <input type="number" step="0.01" min="0" name="monto_fps" value={form.monto_fps} onChange={set} className={inputCls} placeholder="0.00" />
              </Field>
              <Field label="FPS Extra (S/)">
                <input type="number" step="0.01" min="0" name="monto_fps_extra" value={form.monto_fps_extra} onChange={set} className={inputCls} placeholder="0.00" />
              </Field>
              <Field label="Otros (S/)">
                <input type="number" step="0.01" min="0" name="monto_otros" value={form.monto_otros} onChange={set} className={inputCls} placeholder="0.00" />
              </Field>
            </div>

            {/* Total calculado */}
            <div className="mt-5 flex items-center gap-6 p-4 bg-[#1e3a5f]/5 rounded-xl border border-[#1e3a5f]/10">
              <div className="flex-1">
                <Field label="Interés Amortizado Pagado (S/)">
                  <input
                    type="number" step="0.01" min="0"
                    name="interes_amortizado_pagado"
                    value={form.interes_amortizado_pagado}
                    onChange={set} className={inputCls}
                    placeholder="0.00"
                  />
                </Field>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Total Recibo</p>
                <p className="text-2xl font-bold tabular-nums" style={{ color: '#1e3a5f' }}>
                  S/ {fmt(montoTotal)}
                </p>
              </div>
            </div>
          </FormSection>

          <FormSection title="Observación">
            <textarea
              name="observacion"
              value={form.observacion}
              onChange={set}
              rows={3}
              placeholder="Observaciones opcionales..."
              className={`${inputCls} resize-none`}
            />
          </FormSection>

          {error && <InlineAlert variant="danger">{error}</InlineAlert>}

          <ActionStrip>
            <Link href="/dashboard/pagos" className={btnGhost}>Cancelar</Link>
            <button
              type="submit"
              disabled={loading || !idSocio}
              className={`${btnPrimary} disabled:opacity-60`}
            >
              {loading ? 'Registrando...' : 'Registrar Pago'}
            </button>
          </ActionStrip>
        </form>
      </FormPanel>
    </PageFrame>
  )
}
