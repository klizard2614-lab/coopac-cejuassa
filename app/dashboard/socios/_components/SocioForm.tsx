'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { FormPanel, FormSection, ActionStrip, InlineAlert, btnPrimary, btnGhost, inputCls as uiInputCls, selectCls as uiSelectCls } from '../../_components/ui'

type Convenio = { id: number; nombre: string }

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.nro_socio.trim()) { setError('El Nº Socio es obligatorio.'); return }
    if (!form.apellidos.trim()) { setError('Los apellidos son obligatorios.'); return }
    if (!form.nombres.trim()) { setError('Los nombres son obligatorios.'); return }
    const dniTrim = form.dni.trim()
    if (!dniTrim) { setError('El DNI es obligatorio.'); return }
    if (!/^\d{7,8}$/.test(dniTrim)) { setError('El DNI debe tener 7 u 8 dígitos numéricos.'); return }

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

    const { error: err } = mode === 'create'
      ? await supabase.from('socios').insert(payload)
      : await supabase.from('socios').update(payload).eq('id', socioId!)

    if (err) {
      setError(err.message)
      setLoading(false)
      return
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

        <FormSection title="Beneficiario FPS">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Nombre del Beneficiario">
              <input name="beneficiario_nombre" value={form.beneficiario_nombre} onChange={set} className={inputCls} />
            </Field>
            <Field label="DNI del Beneficiario">
              <input name="beneficiario_dni" value={form.beneficiario_dni} onChange={set} className={inputCls} />
            </Field>
            <Field label="Parentesco">
              <input name="beneficiario_parentesco" value={form.beneficiario_parentesco} onChange={set} className={inputCls} placeholder="Ej: Cónyuge, Hijo/a" />
            </Field>
          </div>
        </FormSection>

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
