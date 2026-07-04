'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import SocioForm, { type SocioFormData } from '../../_components/SocioForm'
import { BeneficiariosSection } from '../../_components/BeneficiariosSection'
import { useRol } from '@/lib/useRol'
import AccesoDenegado from '@/components/AccesoDenegado'
import { PageFrame, PageToolbar, FormPanel, FormSection, btnGhost } from '../../../_components/ui'

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
            genero:                 data.genero ?? '',
            estado_civil:           data.estado_civil ?? '',
          })
        }
        setLoading(false)
      })
  }, [id])

  if (checkingRol) return <div className="min-h-full bg-slate-50 p-8 text-sm text-slate-400">Verificando acceso...</div>
  if (!PUEDE_EDITAR_SOCIOS.includes(rol ?? '')) {
    return <AccesoDenegado mensaje="Solo los roles Administrador y Créditos pueden editar socios." />
  }

  if (loading) {
    return <div className="min-h-full bg-slate-50 p-8 text-sm text-slate-400">Cargando...</div>
  }

  if (notFound || !initialData) {
    return (
      <PageFrame>
        <p className="text-sm text-slate-500">Socio no encontrado.</p>
        <Link href="/dashboard/socios" className={`${btnGhost} mt-2 inline-flex`}>Volver a Socios</Link>
      </PageFrame>
    )
  }

  return (
    <PageFrame>
      <PageToolbar
        title="Editar Socio"
        actions={
          <Link href={`/dashboard/socios/${id}`} className={btnGhost}>Cancelar</Link>
        }
      />

      <SocioForm
        mode="edit"
        socioId={id}
        initialData={initialData}
        cancelHref={`/dashboard/socios/${id}`}
        redirectTo={`/dashboard/socios/${id}`}
      />

      {/* Beneficiarios múltiples — sección independiente del formulario principal */}
      <FormPanel>
        <FormSection title="Beneficiarios">
          <BeneficiariosSection
            socioId={Number(id)}
            legacy={{
              beneficiario_nombre:    initialData.beneficiario_nombre ?? null,
              beneficiario_dni:       initialData.beneficiario_dni ?? null,
              beneficiario_parentesco: initialData.beneficiario_parentesco ?? null,
            }}
            rol={rol}
          />
        </FormSection>
      </FormPanel>
    </PageFrame>
  )
}
