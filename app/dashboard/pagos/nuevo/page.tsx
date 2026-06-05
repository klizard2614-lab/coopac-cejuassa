'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import SocioSearch from '../../creditos/_components/SocioSearch'

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

const inputCls =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white ' +
  'focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent'

const readCls =
  'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 bg-gray-50'

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-xs font-semibold text-[#1e3a5f] uppercase tracking-wider mb-5 pb-2 border-b border-gray-100">
        {title}
      </h2>
      {children}
    </div>
  )
}

function DataChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-gray-800">{value}</p>
    </div>
  )
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function NuevoPagoPage() {
  const router = useRouter()

  const [idSocio, setIdSocio] = useState('')
  const [socio, setSocio] = useState<SocioInfo | null>(null)
  const [credito, setCredito] = useState<CreditoVigente | null>(null)
  const [convenio, setConvenio] = useState<ConvenioInfo | null>(null)
  const [loadingSocio, setLoadingSocio] = useState(false)

  const [form, setForm] = useState<FormState>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    if (!form.periodo) { setError('El periodo es obligatorio.'); return }

    setError(null)
    setLoading(true)

    const supabase = createClient()

    // ── 1. Insertar pagos_recibos ─────────────────────────────────────────────
    const { data: pagoData, error: pagoErr } = await supabase
      .from('pagos_recibos')
      .insert({
        nro_recibo:                form.nro_recibo.trim(),
        id_socio:                  Number(idSocio),
        id_credito:                credito ? Number(credito.id) : null,
        id_convenio:               socio?.id_convenio ? Number(socio.id_convenio) : null,
        fecha:                     form.fecha,
        periodo:                   form.periodo,
        canal_pago:                form.canal_pago,
        monto_aporte:              montoAporte,
        monto_capital:             montoCapital,
        monto_interes:             montoInteres,
        monto_fps:                 montoFps,
        monto_fps_extra:           montoFpsExtra,
        monto_otros:               montoOtros,
        monto_total:               montoTotal,
        interes_amortizado_pagado: parseFloat(form.interes_amortizado_pagado) || 0,
        estado_flujo:              'registrado',
        observacion:               form.observacion.trim() || null,
      })
      .select('id')
      .single()

    if (pagoErr || !pagoData) {
      setError(pagoErr?.message ?? 'Error al registrar el pago.')
      setLoading(false)
      return
    }

    const pagoId = Number(pagoData.id)

    if (credito) {
      const idCredito = Number(credito.id)

      // ── 2. Actualizar saldo_capital (server-side, atomic) ──────────────────
      if (montoCapital > 0) {
        const { error: saldoErr } = await supabase.rpc('decrementar_saldo_capital', {
          p_id_credito:  idCredito,
          p_monto:       montoCapital,
        })

        // rpc fallback: si la función no existe, hacemos el update directo
        if (saldoErr) {
          const { data: cFresh } = await supabase
            .from('creditos')
            .select('saldo_capital')
            .eq('id', idCredito)
            .single()
          const saldoActual = (cFresh as { saldo_capital: number } | null)?.saldo_capital ?? credito.saldo_capital
          const { error: updErr } = await supabase
            .from('creditos')
            .update({ saldo_capital: Math.max(0, saldoActual - montoCapital) })
            .eq('id', idCredito)
          if (updErr) {
            setError(`Pago registrado, pero error al actualizar saldo: ${updErr.message}`)
            setLoading(false)
            return
          }
        }
      }

      // ── 3. Marcar cuota pendiente más antigua como pagada ──────────────────
      const { data: cuotaData } = await supabase
        .from('cronograma_cuotas')
        .select('id')
        .eq('id_credito', idCredito)
        .eq('estado', 'pendiente')
        .order('nro_cuota', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (cuotaData) {
        const { error: cuotaErr } = await supabase
          .from('cronograma_cuotas')
          .update({
            capital_pagado: montoCapital,
            interes_pagado: montoInteres,
            estado:         'pagada',
            fecha_pago:     form.fecha,
          })
          .eq('id', (cuotaData as { id: number }).id)

        if (cuotaErr) {
          setError(`Pago registrado, pero error al actualizar cuota: ${cuotaErr.message}`)
          setLoading(false)
          return
        }
      }
    }

    // ── 4. Insertar en aportes si monto_aporte > 0 ────────────────────────────
    if (montoAporte > 0) {
      // Obtener saldo previo del socio
      const { data: ultimoAporte } = await supabase
        .from('aportes')
        .select('saldo_nuevo')
        .eq('id_socio', Number(idSocio))
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const saldoAnterior = (ultimoAporte as { saldo_nuevo: number } | null)?.saldo_nuevo ?? 0
      const saldoNuevo    = saldoAnterior + montoAporte

      const { error: aporteErr } = await supabase.from('aportes').insert({
        id_socio:       Number(idSocio),
        fecha:          form.fecha,
        tipo:           'aporte',
        monto:          montoAporte,
        saldo_anterior: saldoAnterior,
        saldo_nuevo:    saldoNuevo,
        id_recibo:      pagoId,
        observacion:    form.observacion.trim() || null,
      })

      if (aporteErr) {
        setError(`Pago registrado, pero error al registrar aporte: ${aporteErr.message}`)
        setLoading(false)
        return
      }
    }

    router.push('/dashboard/pagos')
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/dashboard/pagos" className="text-sm text-gray-400 hover:text-gray-600 mb-1 inline-block transition-colors">
          ← Volver a Pagos
        </Link>
        <h1 className="text-2xl font-bold text-gray-800">Registrar Pago</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Buscar Socio */}
        <Section title="Buscar Socio">
          <Field label="Nombre o DNI del socio" required>
            <SocioSearch
              value={idSocio}
              onChange={(id) => { setIdSocio(id) }}
            />
          </Field>

          {loadingSocio && (
            <p className="text-sm text-gray-400 mt-3">Cargando datos del socio...</p>
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
                <div className="col-span-3 bg-amber-50 border border-amber-200 text-amber-700 text-sm px-4 py-2 rounded-lg">
                  Este socio no tiene un crédito vigente.
                </div>
              )}
            </div>
          )}
        </Section>

        {/* Datos del pago */}
        <Section title="Datos del Recibo">
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
              <select name="canal_pago" value={form.canal_pago} onChange={set} className={inputCls}>
                <option value="caja">Caja</option>
                <option value="convenio">Convenio</option>
              </select>
            </Field>
          </div>
        </Section>

        {/* Desglose del pago */}
        <Section title="Desglose del Pago">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Aporte (S/)">
              <input
                type="number" step="0.01" min="0"
                name="monto_aporte" value={form.monto_aporte}
                onChange={set} className={inputCls}
                placeholder="0.00"
              />
            </Field>
            <Field label="Capital (S/)">
              <input
                type="number" step="0.01" min="0"
                name="monto_capital" value={form.monto_capital}
                onChange={set} className={inputCls}
                placeholder="0.00"
              />
            </Field>
            <Field label="Interés (S/)">
              <input
                type="number" step="0.01" min="0"
                name="monto_interes" value={form.monto_interes}
                onChange={set} className={inputCls}
                placeholder="0.00"
              />
            </Field>
            <Field label="FPS (S/)">
              <input
                type="number" step="0.01" min="0"
                name="monto_fps" value={form.monto_fps}
                onChange={set} className={inputCls}
                placeholder="0.00"
              />
            </Field>
            <Field label="FPS Extra (S/)">
              <input
                type="number" step="0.01" min="0"
                name="monto_fps_extra" value={form.monto_fps_extra}
                onChange={set} className={inputCls}
                placeholder="0.00"
              />
            </Field>
            <Field label="Otros (S/)">
              <input
                type="number" step="0.01" min="0"
                name="monto_otros" value={form.monto_otros}
                onChange={set} className={inputCls}
                placeholder="0.00"
              />
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
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Recibo</p>
              <p className="text-2xl font-bold" style={{ color: '#1e3a5f' }}>
                S/ {fmt(montoTotal)}
              </p>
            </div>
          </div>
        </Section>

        {/* Observación */}
        <Section title="Observación">
          <textarea
            name="observacion"
            value={form.observacion}
            onChange={set}
            rows={3}
            placeholder="Observaciones opcionales..."
            className={`${inputCls} resize-none`}
          />
        </Section>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
        )}

        <div className="flex justify-end gap-3 pb-4">
          <Link
            href="/dashboard/pagos"
            className="px-5 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loading || !idSocio}
            className="px-5 py-2.5 rounded-lg text-white text-sm font-medium transition-opacity disabled:opacity-60"
            style={{ backgroundColor: '#1e3a5f' }}
          >
            {loading ? 'Registrando...' : 'Registrar Pago'}
          </button>
        </div>
      </form>
    </div>
  )
}
