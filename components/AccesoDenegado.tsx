import Link from 'next/link'
import { ShieldOff, ArrowLeft } from 'lucide-react'

interface Props {
  mensaje?: string
}

export default function AccesoDenegado({ mensaje }: Props) {
  return (
    <div className="p-8 max-w-md">
      <div
        className="rounded-xl p-6 text-center border"
        style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA' }}
      >
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <ShieldOff size={22} className="text-red-600" />
        </div>
        <p className="font-semibold mb-1" style={{ color: '#991B1B' }}>
          Acceso restringido
        </p>
        <p className="text-sm mb-4" style={{ color: '#DC2626' }}>
          {mensaje ?? 'No tienes permiso para acceder a esta sección.'}
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium underline"
          style={{ color: '#B91C1C' }}
        >
          <ArrowLeft size={13} />
          Volver al dashboard
        </Link>
      </div>
    </div>
  )
}
