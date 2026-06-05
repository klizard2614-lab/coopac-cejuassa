'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import SocioForm, { type SocioFormData } from '../../_components/SocioForm'
import { useRol } from '@/lib/useRol'
import AccesoDenegado from '@/components/AccesoDenegado'

const PUEDE_EDITAR_SOCIOS = ['admin', 'creditos']

export default function EditarSocioPage() {
  const { rol, loading: checkingRol } = useRol()
  const { id } = useParams() as { id: string }
  const [initialData, setInitialData] = useState<Partial<SocioFormData> | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    createClient()
      .from('socios')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setNotFound(true)
        } else {
          setInitialData({
            nro_socio:              data.nro_socio ?? '',
            dni:                    data.dni ?? '',
            apellidos:              data.apellidos ?? '',
            nombres:                data.nombres ?? '',
            fecha_nacimiento:       data.fecha_nacimiento ?? '',
            telefono:               data.telefono ?? '',
            email:                  data.email ?? '',
            direccion:              data.direccion ?? '',
            id_convenio:            data.id_convenio ? String(data.id_convenio) : '',
            fecha_ingreso:          data.fecha_ingreso ?? '',
            estado:                 data.estado ?? 'activo',
            beneficiario_nombre:    data.beneficiario_nombre ?? '',
            beneficiario_dni:       data.beneficiario_dni ?? '',
            beneficiario_parentesco: data.beneficiario_parentesco ?? '',
          })
        }
        setLoading(false)
      })
  }, [id])

  if (checkingRol) return <div className="p-8 text-sm text-gray-400">Verificando acceso...</div>
  if (!PUEDE_EDITAR_SOCIOS.includes(rol ?? '')) {
    return <AccesoDenegado mensaje="Solo los roles Administrador y Créditos pueden editar socios." />
  }

  if (loading) {
    return <div className="p-8 text-sm text-gray-400">Cargando...</div>
  }

  if (notFound || !initialData) {
    return (
      <div className="p-8">
        <p className="text-sm text-gray-500">Socio no encontrado.</p>
        <Link href="/dashboard/socios" className="text-sm text-[#1e3a5f] underline mt-2 inline-block">
          Volver a Socios
        </Link>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link
          href={`/dashboard/socios/${id}`}
          className="text-sm text-gray-400 hover:text-gray-600 mb-1 inline-block transition-colors"
        >
          ← Volver al detalle
        </Link>
        <h1 className="text-2xl font-bold text-gray-800">Editar Socio</h1>
      </div>

      <SocioForm
        mode="edit"
        socioId={id}
        initialData={initialData}
        cancelHref={`/dashboard/socios/${id}`}
        redirectTo={`/dashboard/socios/${id}`}
      />
    </div>
  )
}
