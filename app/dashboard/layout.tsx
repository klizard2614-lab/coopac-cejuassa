'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useRol } from '@/lib/useRol'
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Receipt,
  PiggyBank,
  TrendingDown,
  Building2,
  Archive,
  AlertTriangle,
  BarChart2,
  UserCog,
  Settings,
  LogOut,
  RefreshCw,
} from 'lucide-react'

const navItems = [
  { label: 'Dashboard',     href: '/dashboard',                   Icon: LayoutDashboard },
  { label: 'Socios',        href: '/dashboard/socios',            Icon: Users },
  { label: 'Créditos',      href: '/dashboard/creditos',          Icon: CreditCard },
  { label: 'Ampliaciones',  href: '/dashboard/ampliaciones',      Icon: RefreshCw },
  { label: 'Pagos',         href: '/dashboard/pagos',             Icon: Receipt },
  { label: 'Aportes',       href: '/dashboard/aportes',           Icon: PiggyBank },
  { label: 'Egresos',       href: '/dashboard/egresos',           Icon: TrendingDown },
  { label: 'Convenios',     href: '/dashboard/convenios',         Icon: Building2 },
  { label: 'Cartera',       href: '/dashboard/cartera',           Icon: Archive },
  { label: 'Mora',          href: '/dashboard/mora',              Icon: AlertTriangle },
  { label: 'Reportes',      href: '/dashboard/reportes',          Icon: BarChart2 },
  { label: 'Usuarios',      href: '/dashboard/usuarios',          Icon: UserCog },
  { label: 'Configuración', href: '/dashboard/configuracion',     Icon: Settings },
]

const HIDDEN_FOR_ROLE: Record<string, string[]> = {
  tesoreria:    ['/dashboard/usuarios', '/dashboard/configuracion'],
  creditos:     ['/dashboard/egresos', '/dashboard/usuarios', '/dashboard/configuracion'],
  contabilidad: ['/dashboard/convenios', '/dashboard/usuarios', '/dashboard/configuracion'],
}

function getVisibleItems(rol: string | null, loading: boolean) {
  if (loading) return []
  if (!rol || rol === 'admin') return navItems
  const hidden = new Set(HIDDEN_FOR_ROLE[rol] ?? [])
  return navItems.filter(item => !hidden.has(item.href))
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const { rol, loading } = useRol()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      {/* ── Sidebar ── */}
      <aside className="w-64 flex-shrink-0 flex flex-col" style={{ backgroundColor: '#1E3A5F' }}>

        {/* Logo + nombre */}
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-white/10 flex items-center justify-center">
              <Image
                src="/logo-cejuassa.svg"
                alt="Logo COOPAC CEJUASSA"
                width={36}
                height={36}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="leading-tight">
              <p className="text-white font-bold text-sm tracking-wide">COOPAC</p>
              <p className="text-white/70 font-medium text-xs tracking-wider">CEJUASSA</p>
            </div>
          </div>
        </div>

        {/* Navegación */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {getVisibleItems(rol, loading).map(({ label, href, Icon }) => {
            const isActive =
              href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'text-white shadow-sm'
                    : 'text-white/65 hover:text-white hover:bg-white/8'
                }`}
                style={isActive ? { backgroundColor: '#1A56DB' } : undefined}
              >
                <Icon size={17} strokeWidth={isActive ? 2.2 : 1.8} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Cerrar sesión */}
        <div className="px-3 py-4 border-t border-white/10">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/8 transition-all"
          >
            <LogOut size={17} strokeWidth={1.8} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Contenido ── */}
      <main className="flex-1 overflow-auto bg-[#F8FAFC]">
        {children}
      </main>
    </div>
  )
}
