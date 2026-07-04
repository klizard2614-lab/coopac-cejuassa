'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { FormPanel, FormSection, ActionStrip, InlineAlert, btnPrimary, btnGhost, inputCls as uiInputCls, selectCls as uiSelectCls } from '../../_components/ui'

type Convenio = { id: number; nombre: string }

type BeneficiarioDraft = {
  nombres: string
  dni: string
  parentesco: string
  porcentaje: string
  es_principal: boolean
}

const EMPTY_BENEFICIARIO: BeneficiarioDraft = { nombres: '', dni: '', parentesco: '', porcentaje: '', es_principal: false }

export type SocioFormData = {
  nro_socio: string
  dni: string
  apellidos: string
  nombres: string
  fecha_nacimiento: string
  telefono: string
  email: string
  direccion: string
  id_convenio: string
  fecha_ingreso: string
  estado: string
  beneficiario_nombre: string
  beneficiario_dni: string
  beneficiario_parentesco: string
  genero: string
  estado_civil: string
}

const EMPTY: SocioFormData = {
  nro_socio: '', dni: '', apellidos: '', nombres: '',
  fecha_nacimiento: '', telefono: '', email: '', direccion: '',
  id_convenio: '', fecha_ingreso: '', estado: 'activo',
  beneficiario_nombre: '', beneficiario_dni: '', beneficiario_parentesco: '',
  genero: '', estado_civil: '',
}

type Props = {
  initialData?: Partial<SocioFormData>
  socioId?: string
  mode: 'create' | 'edit'
  cancelHref: string
  redirectTo: string
}

const inputCls = uiInputCls
const selectCls = uiSelectCls

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

export default function SocioForm({ initialData, socioId, mode, cancelHref, redirectTo }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<SocioFormData>({ ...EMPTY, ...initialData })
  const [convenios, setConvenios] = useState<Convenio[]>([])
  const [beneficiarios, setBeneficiarios] = useState<BeneficiarioDraft[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    createClient()
      .from('convenios')
      .select('id, nombre')
      .order('nombre')
      .then(({ data }) => { if (data) setConvenios(data as Convenio[]) })
  }, [])

  function set(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function addBeneficiario() {
    setBeneficiarios(prev => [...prev, { ...EMPTY_BENEFICIARIO }])
  }

  function updateBeneficiario(index: number, field: keyof BeneficiarioDraft, value: string | boolean) {
    setBeneficiarios(prev => prev.map((b, i) => i === index ? { ...b, [field]: value } : b))
  }

  function removeBeneficiario(index: number) {
    setBeneficiarios(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.nro_socio.trim()) { setError('El Nº Socio es obligatorio.'); return }
    if (!form.apellidos.trim()) { setError('Los apellidos son obligatorios.'); return }
    if (!form.nombres.trim()) { setError('Los nombres son obligatorios.'); return }
    const dniTrim = form.dni.trim()
    if (!dniTrim) { setError('El DNI es obligatorio.'); return }
    if (!/^\d{7,8}$/.test(dniTrim)) { setError('El DNI debe tener 7 u 8 dígitos numéricos.'); return }

    const beneficiariosValidos = beneficiarios.filter(b => b.nombres.trim())
    for (const b of beneficiariosValidos) {
      if (b.dni.trim() && !/^\d{7,8}$/.test(b.dni.trim())) {
        setError(`El DNI del beneficiario "${b.nombres}" debe tener 7 u 8 dígitos numéricos.`)
        return
      }
      if (b.porcentaje.trim()) {
        const pct = parseFloat(b.porcentaje)
        if (isNaN(pct) || pct < 0 || pct > 100) {
          setError(`El porcentaje del beneficiario "${b.nombres}" debe estar entre 0 y 100.`)
          return
        }
      }
    }

    setLoading(true)

    const supabase = createClient()
    const payload = {
      nro_socio: form.nro_socio,
      dni: form.dni,
      apellidos: form.apellidos,
      nombres: form.nombres,
      fecha_nacimiento: form.fecha_nacimiento || null,
      telefono: form.telefono || null,
      email: form.email || null,
      direccion: form.direccion || null,
      id_convenio: form.id_convenio ? Number(form.id_convenio) : null,
      fecha_ingreso: form.fecha_ingreso || null,
      estado: form.estado,
      beneficiario_nombre: form.beneficiario_nombre || null,
      beneficiario_dni: form.beneficiario_dni || null,
      beneficiario_parentesco: form.beneficiario_parentesco || null,
      genero: form.genero || null,
      estado_civil: form.estado_civil || null,
    }

    if (mode === 'create') {
      const { data, error: err } = await supabase.from('socios').insert(payload).select('id').single()
      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }
      if (beneficiariosValidos.length > 0) {
        const rows = beneficiariosValidos.map(b => ({
          socio_id: data!.id,
          nombres: b.nombres.trim(),
          dni: b.dni.trim() || null,
          parentesco: b.parentesco.trim() || null,
          porcentaje: b.porcentaje ? parseFloat(b.porcentaje) : null,
          es_principal: b.es_principal,
        }))
        const { error: benErr } = await supabase.from('socio_beneficiarios').insert(rows)
        if (benErr) {
          setError(`Socio registrado, pero no se pudieron guardar los beneficiarios: ${benErr.message}`)
          setLoading(false)
          return
        }
      }
    } else {
      const { error: err } = await supabase.from('socios').update(payload).eq('id', socioId!)
      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }
    }

    router.push(redirectTo)
  }

  return (
    <FormPanel>
      <form onSubmit={handleSubmit} className="space-y-6">

        <FormSection title="Datos Personales">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Nº Socio" required>
              <input name="nro_socio" value={form.nro_socio} onChange={set} required className={inputCls} />
            </Field>
            <Field label="DNI" required>
              <input name="dni" value={form.dni} onChange={set} required maxLength={8} inputMode="numeric" placeholder="8 dígitos" className={inputCls} />
            </Field>
            <Field label="Apellidos" required>
              <input name="apellidos" value={form.apellidos} onChange={set} required className={inputCls} />
            </Field>
            <Field label="Nombres" required>
              <input name="nombres" value={form.nombres} onChange={set} required className={inputCls} />
            </Field>
            <Field label="Fecha de Nacimiento">
              <input type="date" name="fecha_nacimiento" value={form.fecha_nacimiento} onChange={set} className={inputCls} />
            </Field>
            <Field label="Teléfono">
              <input name="telefono" value={form.telefono} onChange={set} className={inputCls} placeholder="Ej: 987654321" />
            </Field>
            <Field label="Email">
              <input type="email" name="email" value={form.email} onChange={set} className={inputCls} placeholder="correo@ejemplo.com" />
            </Field>
            <Field label="Dirección">
              <input name="direccion" value={form.direccion} onChange={set} className={inputCls} />
            </Field>
            <Field label="Género">
              <select name="genero" value={form.genero} onChange={set} className={selectCls}>
                <option value="">No registrado</option>
                <option value="M">M — Masculino</option>
                <option value="F">F — Femenino</option>
              </select>
            </Field>
            <Field label="Estado Civil">
              <select name="estado_civil" value={form.estado_civil} onChange={set} className={selectCls}>
                <option value="">No registrado</option>
                <option value="soltero">Soltero/a</option>
                <option value="casado">Casado/a</option>
                <option value="conviviente">Conviviente</option>
                <option value="divorciado">Divorciado/a</option>
                <option value="viudo">Viudo/a</option>
              </select>
            </Field>
          </div>
          <InlineAlert variant="info">
            Género y estado civil son requeridos para reportes SBS/BDCC. Pueden completarse manualmente.
          </InlineAlert>
        </FormSection>

        <FormSection title="Datos Cooperativa">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Convenio">
              <select name="id_convenio" value={form.id_convenio} onChange={set} className={selectCls}>
                <option value="">Sin convenio</option>
                {convenios.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </Field>
            <Field label="Fecha de Ingreso">
              <input type="date" name="fecha_ingreso" value={form.fecha_ingreso} onChange={set} className={inputCls} />
            </Field>
            <Field label="Estado">
              <select name="estado" value={form.estado} onChange={set} className={selectCls}>
                <option value="activo">Activo</option>
                <option value="retirado">Retirado</option>
                <option value="suspendido">Suspendido</option>
                <option value="fallecido">Fallecido</option>
              </select>
            </Field>
          </div>
        </FormSection>

        {mode === 'create' && (
          <FormSection title="Beneficiarios FPS" description="Puedes registrar uno o varios beneficiarios para este socio.">
            <div className="space-y-3">
              {beneficiarios.map((b, i) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <Field label="Nombres">
                    <input value={b.nombres} onChange={e => updateBeneficiario(i, 'nombres', e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="DNI">
                    <input value={b.dni} onChange={e => updateBeneficiario(i, 'dni', e.target.value)} maxLength={8} inputMode="numeric" className={inputCls} />
                  </Field>
                  <Field label="Parentesco">
                    <input value={b.parentesco} onChange={e => updateBeneficiario(i, 'parentesco', e.target.value)} placeholder="Ej: Cónyuge, Hijo/a" className={inputCls} />
                  </Field>
                  <Field label="Porcentaje (%)">
                    <input type="number" min="0" max="100" step="0.01" value={b.porcentaje} onChange={e => updateBeneficiario(i, 'porcentaje', e.target.value)} className={inputCls} />
                  </Field>
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-slate-600">
                      <input type="checkbox" checked={b.es_principal} onChange={e => updateBeneficiario(i, 'es_principal', e.target.checked)} className="rounded" />
                      Principal
                    </label>
                    <button type="button" onClick={() => removeBeneficiario(i)} className="p-1.5 text-slate-400 hover:text-red-600 rounded">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addBeneficiario}
                className="flex items-center gap-1.5 text-sm text-[#1A56DB] hover:underline"
              >
                <Plus size={15} /> Agregar beneficiario
              </button>
            </div>
          </FormSection>
        )}

        {error && (
          <InlineAlert variant="danger">{error}</InlineAlert>
        )}

        <ActionStrip>
          <Link href={cancelHref} className={btnGhost}>Cancelar</Link>
          <button
            type="submit"
            disabled={loading}
            className={`${btnPrimary} disabled:opacity-60`}
          >
            {loading ? 'Guardando...' : mode === 'create' ? 'Registrar Socio' : 'Guardar Cambios'}
          </button>
        </ActionStrip>
      </form>
    </FormPanel>
  )
}
