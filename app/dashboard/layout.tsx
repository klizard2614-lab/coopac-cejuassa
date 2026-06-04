'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: '▦' },
  { label: 'Socios', href: '/dashboard/socios', icon: '👥' },
  { label: 'Créditos', href: '/dashboard/creditos', icon: '💳' },
  { label: 'Pagos', href: '/dashboard/pagos', icon: '💰' },
  { label: 'Aportes', href: '/dashboard/aportes', icon: '📥' },
  { label: 'Cartera', href: '/dashboard/cartera', icon: '📂' },
  { label: 'Reportes', href: '/dashboard/reportes', icon: '📊' },
  { label: 'Configuración', href: '/dashboard/configuracion', icon: '⚙️' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex min-h-screen">
      <aside
        className="w-64 flex-shrink-0 flex flex-col"
        style={{ backgroundColor: '#1e3a5f' }}
      >
        <div className="px-6 py-6 border-b border-white/10">
          <span className="text-white font-bold text-base leading-tight">
            COOPAC CEJUASSA
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="px-3 py-4 border-t border-white/10">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors"
          >
            <span className="text-base">🚪</span>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 bg-gray-50 overflow-auto">
        {children}
      </main>
    </div>
  )
}
