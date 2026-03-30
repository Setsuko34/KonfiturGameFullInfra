'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Gamepad2, LayoutDashboard, Users, List,
  AlertTriangle, Megaphone, Star, LogOut, Home, Activity,
} from 'lucide-react'
import { useAuth } from '@/components/providers/AuthProvider'

const ADMIN_BG = '#0A0E16'
const ADMIN_BORDER = 'rgba(239, 35, 60, 0.15)'

export default function AdminSidebar() {
  const { user, logout } = useAuth()
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === '/admin' ? pathname === href : pathname.startsWith(href)

  const NavLink = ({
    href,
    icon: Icon,
    label,
  }: {
    href: string
    icon: typeof Home
    label: string
  }) => (
    <Link
      href={href}
      aria-current={isActive(href) ? 'page' : undefined}
      className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors"
      style={{
        background: isActive(href) ? 'rgba(239, 35, 60, 0.12)' : 'transparent',
        color: isActive(href) ? 'var(--secondary)' : 'var(--sidebar-foreground)',
      }}
    >
      <Icon size={15} aria-hidden="true" />
      {label}
    </Link>
  )

  return (
    <aside
      className="hidden md:flex flex-col fixed inset-y-0 left-0 w-60 border-r z-30"
      style={{ background: ADMIN_BG, borderColor: ADMIN_BORDER }}
    >
      <nav className="flex flex-col h-full" aria-label="Navigation du backoffice">
        {/* Logo + badge */}
        <div
          className="flex flex-col px-5 py-4 border-b"
          style={{ borderColor: ADMIN_BORDER }}
        >
          <div className="flex items-center gap-2">
            <Gamepad2 size={18} style={{ color: 'var(--secondary)' }} aria-hidden="true" />
            <Link href="/" className="font-bold text-sm" style={{ color: 'var(--sidebar-foreground)' }}>
              Konfitur<span style={{ color: 'var(--secondary)' }}>Game</span>
            </Link>
          </div>
          <span
            className="mt-1.5 text-[9px] tracking-widest uppercase font-bold px-1 py-0.5 w-fit"
            style={{
              background: 'rgba(239, 35, 60, 0.15)',
              color: 'var(--secondary)',
              border: '1px solid rgba(239, 35, 60, 0.3)',
            }}
          >
            Super Admin
          </span>
        </div>

        {/* Utilisateur */}
        {user && (
          <div className="px-5 py-3 border-b" style={{ borderColor: ADMIN_BORDER }}>
            <p className="text-[9px] tracking-widest mb-1 uppercase" style={{ color: 'var(--muted-foreground)' }}>
              Connecté
            </p>
            <p className="font-semibold text-sm truncate">{user.name || user.email}</p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          <NavLink href="/admin" icon={LayoutDashboard} label="Vue d'ensemble" />

          <p
            className="px-3 pt-4 pb-1 text-[9px] tracking-widest uppercase"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Gestion
          </p>
          <NavLink href="/admin/users" icon={Users} label="Utilisateurs" />
          <NavLink href="/admin/jams" icon={List} label="Jams" />

          <p
            className="px-3 pt-4 pb-1 text-[9px] tracking-widest uppercase border-t mt-3"
            style={{ color: 'var(--muted-foreground)', borderColor: ADMIN_BORDER }}
          >
            Contenu
          </p>
          <NavLink href="/admin/moderation" icon={AlertTriangle} label="Modération" />
          <NavLink href="/admin/announcements" icon={Megaphone} label="Annonces" />
          <NavLink href="/admin/featured" icon={Star} label="Mise en avant" />
          <NavLink href="/admin/logs" icon={Activity} label="Logs & Monitoring" />
        </div>

        {/* Bas de sidebar */}
        <div className="p-3 border-t space-y-0.5" style={{ borderColor: ADMIN_BORDER }}>
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <Home size={15} aria-hidden="true" />
            Retour au site
          </Link>
          <button
            onClick={() => logout()}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <LogOut size={15} aria-hidden="true" />
            Déconnexion
          </button>
        </div>
      </nav>
    </aside>
  )
}
