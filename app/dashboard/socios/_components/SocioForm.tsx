'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

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
}

const EMPTY: SocioFormData = {
  nro_socio: '', dni: '', apellidos: '', nombres: '',
  fecha_nacimiento: '', telefono: '', email: '', direccion: '',
  id_convenio: '', fecha_ingreso: '', estado: 'activo',
  beneficiario_nombre: '', beneficiario_dni: '', beneficiario_parentesco: '',
}

type Props = {
  initialData?: Partial<SocioFormData>
  socioId?: string
  mode: 'create' | 'edit'
  cancelHref: string
  redirectTo: string
}

const inputCls =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white ' +
  'focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent'

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
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
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Datos personales */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xs font-semibold text-[#1e3a5f] uppercase tracking-wider mb-5 pb-2 border-b border-gray-100">
          Datos Personales
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Nº Socio" required>
            <input name="nro_socio" value={form.nro_socio} onChange={set} required className={inputCls} />
          </Field>
          <Field label="DNI" required>
            <input name="dni" value={form.dni} onChange={set} required className={inputCls} />
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
        </div>
      </div>

      {/* Datos cooperativa */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xs font-semibold text-[#1e3a5f] uppercase tracking-wider mb-5 pb-2 border-b border-gray-100">
          Datos Cooperativa
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Convenio">
            <select name="id_convenio" value={form.id_convenio} onChange={set} className={inputCls}>
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
            <select name="estado" value={form.estado} onChange={set} className={inputCls}>
              <option value="activo">Activo</option>
              <option value="retirado">Retirado</option>
              <option value="suspendido">Suspendido</option>
              <option value="fallecido">Fallecido</option>
            </select>
          </Field>
        </div>
      </div>

      {/* Beneficiario FPS */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xs font-semibold text-[#1e3a5f] uppercase tracking-wider mb-5 pb-2 border-b border-gray-100">
          Beneficiario FPS
        </h2>
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
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-3 pb-4">
        <Link
          href={cancelHref}
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
          {loading ? 'Guardando...' : mode === 'create' ? 'Registrar Socio' : 'Guardar Cambios'}
        </button>
      </div>
    </form>
  )
}
