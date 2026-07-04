'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { formatNombrePersona } from '@/lib/formatNombre'
import { PageFrame, DetailHero, DetailSection, FieldGrid, FieldItem, btnGhost } from '../../_components/ui'

type AporteDetalle = {
  id: number
  fecha: string
  tipo: string
  monto: number
  saldo_anterior: number
  saldo_nuevo: number
  observacion: string | null
  id_recibo: number | null
  created_at: string
  created_by: string | null
  socios: {
    nombres: string
    apellidos: string
    dni: string
    nro_socio: string
  } | null
  pagos_recibos: {
    nro_recibo: string
  } | null
}

function fmt(n: number | null | undefined) {
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  const parts = d.split('T')[0].split('-')
  if (parts.length !== 3) return d
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

export default function AporteDetallePage() {
  const { id } = useParams() as { id: string }
  const [aporte, setAporte] = useState<AporteDetalle | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    createClient()
      .from('aportes')
      .select('*, socios(nombres, apellidos, dni, nro_socio), pagos_recibos(nro_recibo)')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) setAporte(data as AporteDetalle)
        setLoading(false)
      })
  }, [id])

  if (loading) return <div className="min-h-full bg-slate-50 p-8 text-sm text-slate-400">Cargando...</div>

  if (!aporte) {
    return (
      <PageFrame>
        <p className="text-sm text-slate-500">Aporte no encontrado.</p>
        <Link href="/dashboard/aportes" className={`${btnGhost} mt-2 inline-flex`}>Volver a Aportes</Link>
      </PageFrame>
    )
  }

  const socioNombre = aporte.socios
    ? formatNombrePersona(aporte.socios.apellidos, aporte.socios.nombres)
    : '—'

  return (
    <PageFrame>
      <Link href="/dashboard/aportes" className={`${btnGhost} mb-4 inline-flex`}>← Volver a Aportes</Link>

      <DetailHero
        title="Detalle de Aporte"
        subtitle={socioNombre}
      />

      <DetailSection title="Datos del Socio">
        <FieldGrid cols={3}>
          <FieldItem label="Socio" value={socioNombre} />
          <FieldItem label="Nº Socio" value={aporte.socios?.nro_socio} accent />
          <FieldItem label="DNI" value={aporte.socios?.dni} mono />
        </FieldGrid>
      </DetailSection>

      <DetailSection title="Detalle del Movimiento">
        <FieldGrid cols={3}>
          <FieldItem label="Fecha" value={formatDate(aporte.fecha)} />
          <FieldItem label="Tipo de Movimiento" value={aporte.tipo} />
          <FieldItem label="Monto Aportado" value={`S/ ${fmt(aporte.monto)}`} mono accent />
          <FieldItem label="Saldo Anterior" value={`S/ ${fmt(aporte.saldo_anterior)}`} mono />
          <FieldItem label="Saldo Nuevo (Acumulado)" value={`S/ ${fmt(aporte.saldo_nuevo)}`} mono />
          <FieldItem
            label="Recibo Vinculado"
            value={
              aporte.id_recibo && aporte.pagos_recibos
                ? aporte.pagos_recibos.nro_recibo
                : undefined
            }
          />
        </FieldGrid>

        {aporte.id_recibo && aporte.pagos_recibos && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Enlace al Recibo</p>
            <Link
              href={`/dashboard/pagos/${aporte.id_recibo}`}
              className={btnGhost}
            >
              Ver recibo Nº {aporte.pagos_recibos.nro_recibo} →
            </Link>
          </div>
        )}

        {aporte.observacion && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Observación</p>
            <p className="text-sm text-slate-700 bg-slate-50 rounded-lg px-4 py-3 border border-slate-100">
              {aporte.observacion}
            </p>
          </div>
        )}
      </DetailSection>

      <DetailSection title="Información de Registro">
        <FieldGrid cols={3}>
          <FieldItem label="Registrado por" value={aporte.created_by ?? undefined} />
          <FieldItem label="Fecha de Registro" value={formatDate(aporte.created_at)} />
        </FieldGrid>
      </DetailSection>
    </PageFrame>
  )
}
