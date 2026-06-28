'use client'

import Link from 'next/link'
import Image from 'next/image'
import {
  LayoutDashboard, Users, List,
  AlertTriangle, Megaphone, Star, LogOut, Home, Activity,
} from 'lucide-react'
import { useAuth } from '@/components/providers/AuthProvider'
import SidebarNavLink from '@/components/SidebarNavLink'

const ADMIN_LINK_STYLE = {
  activeBackground: 'var(--admin-active-bg)',
  activeColor: 'var(--secondary)',
} as const

export default function AdminSidebar() {
  const { user, logout } = useAuth()

  return (
    <aside
      className="hidden md:flex flex-col fixed inset-y-0 left-0 w-60 border-r z-30"
      style={{ background: 'var(--admin-sidebar-bg)', borderColor: 'var(--admin-accent-border)' }}
    >
      <nav className="flex flex-col h-full" aria-label="Navigation du backoffice">
        {/* Logo + badge */}
        <div
          className="flex flex-col px-5 py-4 border-b"
          style={{ borderColor: 'var(--admin-accent-border)' }}
        >
          <div className="flex items-center gap-2">
            <Image src="/hautequalite.svg" alt="" width={24} height={24} aria-hidden="true" />
            <Link href="/" className="font-bold text-sm" style={{ color: 'var(--sidebar-foreground)' }}>
              Konfitur<span style={{ color: 'var(--secondary)' }}>Game</span>
            </Link>
          </div>
          <span
            className="mt-1.5 text-[9px] tracking-widest uppercase font-bold px-1 py-0.5 w-fit"
            style={{
              background: 'var(--admin-accent-border)',
              color: 'var(--secondary)',
              border: '1px solid var(--admin-badge-border)',
            }}
          >
            Super Admin
          </span>
        </div>

        {/* Utilisateur */}
        {user && (
          <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--admin-accent-border)' }}>
            <p className="text-[9px] tracking-widest mb-1 uppercase" style={{ color: 'var(--muted-foreground)' }}>
              Connecté
            </p>
            <p className="font-semibold text-sm truncate">{user.name || user.email}</p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          <SidebarNavLink href="/admin" icon={LayoutDashboard} label="Vue d'ensemble" exact {...ADMIN_LINK_STYLE} />

          <p
            className="px-3 pt-4 pb-1 text-[9px] tracking-widest uppercase"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Gestion
          </p>
          <SidebarNavLink href="/admin/users" icon={Users} label="Utilisateurs" {...ADMIN_LINK_STYLE} />
          <SidebarNavLink href="/admin/jams" icon={List} label="Jams" {...ADMIN_LINK_STYLE} />

          <p
            className="px-3 pt-4 pb-1 text-[9px] tracking-widest uppercase border-t mt-3"
            style={{ color: 'var(--muted-foreground)', borderColor: 'var(--admin-accent-border)' }}
          >
            Contenu
          </p>
          <SidebarNavLink href="/admin/moderation" icon={AlertTriangle} label="Modération" {...ADMIN_LINK_STYLE} />
          <SidebarNavLink href="/admin/announcements" icon={Megaphone} label="Annonces" {...ADMIN_LINK_STYLE} />
          <SidebarNavLink href="/admin/featured" icon={Star} label="Mise en avant" {...ADMIN_LINK_STYLE} />
          <SidebarNavLink href="/admin/logs" icon={Activity} label="Logs & Monitoring" {...ADMIN_LINK_STYLE} />
        </div>

        {/* Bas de sidebar */}
        <div className="p-3 border-t space-y-0.5" style={{ borderColor: 'var(--admin-accent-border)' }}>
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