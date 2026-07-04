'use client'

import Link from 'next/link'
import SocioForm from '../_components/SocioForm'
import { useRol } from '@/lib/useRol'
import AccesoDenegado from '@/components/AccesoDenegado'
import { PageFrame, PageToolbar, btnGhost } from '../../_components/ui'

const PUEDE_CREAR_SOCIOS = ['admin', 'creditos']

export default function NuevoSocioPage() {
  const { rol, loading: checkingRol } = useRol()

  if (checkingRol) return <div className="min-h-full bg-slate-50 p-8 text-sm text-slate-400">Verificando acceso...</div>
  if (!PUEDE_CREAR_SOCIOS.includes(rol ?? '')) {
    return <AccesoDenegado mensaje="Solo los roles Administrador y Créditos pueden registrar nuevos socios." />
  }

  return (
    <PageFrame>
      <PageToolbar
        title="Registrar Nuevo Socio"
        actions={
          <Link href="/dashboard/socios" className={btnGhost}>Cancelar</Link>
        }
      />
      <SocioForm
        mode="create"
        cancelHref="/dashboard/socios"
        redirectTo="/dashboard/socios"
      />
    </PageFrame>
  )
}
