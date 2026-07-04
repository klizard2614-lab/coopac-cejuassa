'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useRol } from '@/lib/useRol'
import { BeneficiariosSection } from '../_components/BeneficiariosSection'
import { PageFrame, DetailHero, DetailSection, FieldGrid, FieldItem, StatusBadge, btnEdit, btnGhost } from '../../_components/ui'

type Socio = {
  id: string
  nro_socio: string
  dni: string
  apellidos: string
  nombres: string
  fecha_nacimiento: string | null
  telefono: string | null
  email: string | null
  direccion: string | null
  fecha_ingreso: string | null
  fecha_retiro: string | null
  estado: string
  beneficiario_nombre: string | null
  beneficiario_dni: string | null
  beneficiario_parentesco: string | null
  genero: string | null
  estado_civil: string | null
  convenios: { nombre: string } | null
}

const GENERO_LABEL: Record<string, string> = { M: 'M — Masculino', F: 'F — Femenino' }
const ESTADO_CIVIL_LABEL: Record<string, string> = {
  soltero: 'Soltero/a',
  casado: 'Casado/a',
  conviviente: 'Conviviente',
  divorciado: 'Divorciado/a',
  viudo: 'Viudo/a',
}

function SocioEstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, { variant: 'success' | 'warning' | 'danger' | 'neutral'; label: string }> = {
    activo:     { variant: 'success',  label: 'Activo' },
    retirado:   { variant: 'neutral',  label: 'Retirado' },
    suspendido: { variant: 'warning',  label: 'Suspendido' },
    fallecido:  { variant: 'danger',   label: 'Fallecido' },
  }
  const s = map[estado] ?? map.retirado
  return <StatusBadge label={s.label} variant={s.variant} />
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  const parts = d.split('-')
  if (parts.length !== 3) return d
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

export default function SocioDetailPage() {
  const { id } = useParams() as { id: string }
  const [socio, setSocio] = useState<Socio | null>(null)
  const [loading, setLoading] = useState(true)
  const { rol } = useRol()

  useEffect(() => {
    createClient()
      .from('socios')
      .select('*, convenios(nombre)')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) setSocio(data as Socio)
        setLoading(false)
      })
  }, [id])

  if (loading) {
    return <div className="min-h-full bg-slate-50 p-8 text-sm text-slate-400">Cargando...</div>
  }

  if (!socio) {
    return (
      <PageFrame>
        <p className="text-sm text-slate-500">Socio no encontrado.</p>
        <Link href="/dashboard/socios" className={`${btnGhost} mt-2 inline-flex`}>Volver a Socios</Link>
      </PageFrame>
    )
  }

  return (
    <PageFrame>
      <Link href="/dashboard/socios" className={`${btnGhost} mb-4 inline-flex`}>← Volver a Socios</Link>

      <DetailHero
        title={`${socio.apellidos}, ${socio.nombres}`}
        subtitle={`Nº Socio: ${socio.nro_socio}`}
        badge={<SocioEstadoBadge estado={socio.estado} />}
        actions={
          <Link href={`/dashboard/socios/${id}/editar`} className={btnEdit}>
            Editar
          </Link>
        }
      />

      <DetailSection title="Datos Personales">
        <FieldGrid cols={4}>
          <FieldItem label="DNI" value={socio.dni} mono />
          <FieldItem label="Apellidos" value={socio.apellidos} />
          <FieldItem label="Nombres" value={socio.nombres} />
          <FieldItem label="Fecha de Nacimiento" value={formatDate(socio.fecha_nacimiento)} />
          <FieldItem label="Teléfono" value={socio.telefono} />
          <FieldItem label="Email" value={socio.email} />
          <FieldItem label="Género" value={socio.genero ? GENERO_LABEL[socio.genero] ?? socio.genero : null} />
          <FieldItem label="Estado Civil" value={socio.estado_civil ? ESTADO_CIVIL_LABEL[socio.estado_civil] ?? socio.estado_civil : null} />
          <FieldItem label="Dirección" value={socio.direccion} span />
        </FieldGrid>
      </DetailSection>

      <DetailSection title="Datos Cooperativa">
        <FieldGrid cols={3}>
          <FieldItem label="Convenio" value={socio.convenios?.nombre} />
          <FieldItem label="Fecha de Ingreso" value={formatDate(socio.fecha_ingreso)} />
          <FieldItem label="Fecha de Retiro" value={formatDate(socio.fecha_retiro)} />
        </FieldGrid>
      </DetailSection>

      <DetailSection title="Beneficiario FPS (campo legacy)">
        <FieldGrid cols={3}>
          <FieldItem label="Nombre" value={socio.beneficiario_nombre} />
          <FieldItem label="DNI" value={socio.beneficiario_dni} mono />
          <FieldItem label="Parentesco" value={socio.beneficiario_parentesco} />
        </FieldGrid>
      </DetailSection>

      <DetailSection title="Beneficiarios">
        <BeneficiariosSection
          socioId={Number(id)}
          legacy={{
            beneficiario_nombre: socio.beneficiario_nombre,
            beneficiario_dni: socio.beneficiario_dni,
            beneficiario_parentesco: socio.beneficiario_parentesco,
          }}
          rol={rol}
        />
      </DetailSection>
    </PageFrame>
  )
}
