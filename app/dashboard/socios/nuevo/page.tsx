'use client'

import Link from 'next/link'
import SocioForm from '../_components/SocioForm'
import { useRol } from '@/lib/useRol'
import AccesoDenegado from '@/components/AccesoDenegado'

const PUEDE_CREAR_SOCIOS = ['admin', 'creditos']

export default function NuevoSocioPage() {
  const { rol, loading: checkingRol } = useRol()

  if (checkingRol) return <div className="p-8 text-sm text-gray-400">Verificando acceso...</div>
  if (!PUEDE_CREAR_SOCIOS.includes(rol ?? '')) {
    return <AccesoDenegado mensaje="Solo los roles Administrador y Créditos pueden registrar nuevos socios." />
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/dashboard/socios" className="text-sm text-gray-500 hover:text-gray-700 mb-1 inline-block">
          ← Volver a Socios
        </Link>
        <h1 className="text-2xl font-bold text-gray-800">Registrar Nuevo Socio</h1>
      </div>

      <SocioForm
        mode="create"
        cancelHref="/dashboard/socios"
        redirectTo="/dashboard/socios"
      />
    </div>
  )
}
