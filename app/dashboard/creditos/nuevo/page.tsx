'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import SocioSearch from '../_components/SocioSearch'

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

const inputCls =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white ' +
  'focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent'

const readCls =
  'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-gray-50'

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
}

const EMPTY: FormState = {
  nro_pagare: '', fecha_desembolso: '', monto_aprobado: '',
  tasa_interes: '', plazo_meses: '', tipo_credito: '',
  descuento_fps: '0', descuento_seguro: '0', descuento_otros: '0',
}

export default function NuevoCreditoPage() {
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
    if (!form.fecha_desembolso) { setError('La fecha de desembolso es obligatoria.'); return }
    if (plazo < 1) { setError('El plazo debe ser mayor a 0.'); return }
    if (monto <= 0) { setError('El monto aprobado debe ser mayor a 0.'); return }

    setError(null)
    setLoading(true)

    const supabase = createClient()

    // 1. Insertar crédito
    const { data: creditoData, error: creditoErr } = await supabase
      .from('creditos')
      .insert({
        id_socio:         idSocio,
        nro_pagare:       form.nro_pagare,
        fecha_desembolso: form.fecha_desembolso,
        monto_aprobado:   monto,
        monto_girado_neto: montoGiradoNeto,
        descuento_fps:    fps,
        descuento_seguro: seguro,
        descuento_otros:  otros,
        tasa_interes:     tasa,
        plazo_meses:      plazo,
        cuota_mensual:    cuotaMensual,
        tipo_credito:     form.tipo_credito || null,
        saldo_capital:    monto,
        interes_acumulado: 0,
        estado:           'vigente',
      })
      .select('id')
      .single()

    if (creditoErr || !creditoData) {
      setError(creditoErr?.message ?? 'Error al registrar el crédito.')
      setLoading(false)
      return
    }

    // 2. Generar cronograma de cuotas
    const r = tasa / 100 / 12
    let saldo = monto
    const cuotas = []

    for (let i = 1; i <= plazo; i++) {
      const interes = round2(saldo * r)
      let capital: number
      let cuotaTotal: number

      if (i === plazo) {
        // Última cuota: usar saldo exacto para evitar desfase por redondeo
        capital    = round2(saldo)
        cuotaTotal = round2(capital + interes)
      } else {
        capital    = round2(cuotaMensual - interes)
        cuotaTotal = cuotaMensual
      }

      saldo = round2(saldo - capital)

      cuotas.push({
        id_credito:        creditoData.id,
        nro_cuota:         i,
        fecha_vencimiento: addMonths(form.fecha_desembolso, i),
        capital,
        interes,
        cuota_total:       cuotaTotal,
        capital_pagado:    0,
        interes_pagado:    0,
        estado:            'pendiente',
        fecha_pago:        null,
      })
    }

    const { error: cronErr } = await supabase.from('cronograma_cuotas').insert(cuotas)

    if (cronErr) {
      setError(cronErr.message)
      setLoading(false)
      return
    }

    router.push('/dashboard/creditos')
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/dashboard/creditos" className="text-sm text-gray-400 hover:text-gray-600 mb-1 inline-block transition-colors">
          ← Volver a Créditos
        </Link>
        <h1 className="text-2xl font-bold text-gray-800">Registrar Nuevo Crédito</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Socio */}
        <Section title="Socio">
          <Field label="Buscar Socio" required>
            <SocioSearch value={idSocio} onChange={(id) => setIdSocio(id)} />
          </Field>
        </Section>

        {/* Datos del crédito */}
        <Section title="Datos del Crédito">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Nº Pagaré" required>
              <input name="nro_pagare" value={form.nro_pagare} onChange={set} required className={inputCls} />
            </Field>
            <Field label="Fecha de Desembolso" required>
              <input type="date" name="fecha_desembolso" value={form.fecha_desembolso} onChange={set} required className={inputCls} />
            </Field>
            <Field label="Tipo de Crédito">
              <select name="tipo_credito" value={form.tipo_credito} onChange={set} className={inputCls}>
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
            <Field label="Tasa de Interés Anual (%)" required>
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
        </Section>

        {/* Descuentos */}
        <Section title="Descuentos al Desembolso">
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
          </div>
        </Section>

        {/* Resumen calculado */}
        <Section title="Resumen Calculado">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Monto Girado Neto (S/)">
              <div className={readCls}>
                S/ {fmtNum(montoGiradoNeto)}
              </div>
            </Field>
            <Field label="Cuota Mensual (S/)">
              <div className={readCls}>
                {plazo > 0 && monto > 0
                  ? `S/ ${fmtNum(cuotaMensual)}`
                  : <span className="text-gray-400">Ingresa monto, tasa y plazo</span>
                }
              </div>
            </Field>
          </div>

          {/* Vista previa del cronograma */}
          {plazo > 0 && monto > 0 && (
            <div className="mt-5">
              <p className="text-xs font-medium text-gray-500 mb-2">
                Vista previa del cronograma ({plazo} cuotas)
              </p>
              <div className="overflow-x-auto border border-gray-100 rounded-lg max-h-48 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      {['Nº', 'Vencimiento', 'Capital', 'Interés', 'Cuota'].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
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
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-3 py-1.5 text-gray-700">{i}</td>
                            <td className="px-3 py-1.5 text-gray-600">
                              {form.fecha_desembolso ? addMonths(form.fecha_desembolso, i).split('-').reverse().join('/') : '—'}
                            </td>
                            <td className="px-3 py-1.5 text-gray-700">{fmtNum(capital)}</td>
                            <td className="px-3 py-1.5 text-gray-700">{fmtNum(interes)}</td>
                            <td className="px-3 py-1.5 font-medium text-gray-900">{fmtNum(cuotaTotal)}</td>
                          </tr>
                        )
                      })
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Section>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
        )}

        <div className="flex justify-end gap-3 pb-4">
          <Link
            href="/dashboard/creditos"
            className="px-5 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 rounded-lg text-white text-sm font-medium transition-opacity disabled:opacity-60"
            style={{ backgroundColor: '#1e3a5f' }}
          >
            {loading ? 'Registrando...' : 'Registrar Crédito'}
          </button>
        </div>
      </form>
    </div>
  )
}
