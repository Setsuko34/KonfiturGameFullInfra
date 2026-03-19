'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Gamepad2, LayoutDashboard, Trophy, Users, Send,
  List, Plus, LogOut, Menu, X, Home,
} from 'lucide-react'
import { useAuth } from '@/components/providers/AuthProvider'

export default function DashboardSidebar() {
  const { user, logout } = useAuth()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href)

  const NavLink = ({ href, icon: Icon, label }: { href: string; icon: typeof Home; label: string }) => (
    <Link
      href={href}
      onClick={() => setOpen(false)}
      aria-current={isActive(href) ? 'page' : undefined}
      className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors"
      style={{
        background: isActive(href) ? 'var(--sidebar-accent)' : 'transparent',
        color: isActive(href) ? 'var(--sidebar-primary)' : 'var(--sidebar-foreground)',
      }}
    >
      <Icon size={15} aria-hidden="true" />
      {label}
    </Link>
  )

  const sidebar = (
    <nav
      className="flex flex-col h-full"
      style={{ background: 'var(--sidebar)', borderColor: 'var(--sidebar-border)' }}
      aria-label="Navigation du dashboard"
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: 'var(--sidebar-border)' }}>
        <Gamepad2 size={18} style={{ color: 'var(--primary)' }} aria-hidden="true" />
        <Link href="/" className="font-bold text-sm" style={{ color: 'var(--sidebar-foreground)' }}>
          Konfitur<span style={{ color: 'var(--primary)' }}>Game</span>
        </Link>
      </div>

      {/* Utilisateur */}
      {user && (
        <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--sidebar-border)' }}>
          <p className="text-[9px] tracking-widest mb-1 uppercase" style={{ color: 'var(--muted-foreground)' }}>
            Connecté
          </p>
          <p className="font-semibold text-sm truncate">{user.name || user.email}</p>
        </div>
      )}

      <div className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {/* Vue d'ensemble */}
        <NavLink href="/dashboard" icon={LayoutDashboard} label="Vue d'ensemble" />

        {/* Bloc PARTICIPANT */}
        <p className="px-3 pt-4 pb-1 text-[9px] tracking-widest uppercase" style={{ color: 'var(--muted-foreground)' }}>
          Participant
        </p>
        <NavLink href="/dashboard/participations" icon={Trophy} label="Mes participations" />
        <NavLink href="/dashboard/team" icon={Users} label="Mon équipe" />
        {/* "Mes soumissions" est une sous-section de participations — déférée Phase 1.5.
            Pour l'instant, les soumissions sont visibles dans /dashboard/participations. */}

        {/* Bloc ORGANISATEUR */}
        <p
          className="px-3 pt-4 pb-1 text-[9px] tracking-widest uppercase border-t mt-3"
          style={{ color: 'var(--muted-foreground)', borderColor: 'var(--sidebar-border)' }}
        >
          Organisateur
        </p>
        <NavLink href="/dashboard/my-jams" icon={List} label="Mes jams" />
        <Link
          href="/dashboard/my-jams/new"
          onClick={() => setOpen(false)}
          className="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold transition-opacity hover:opacity-80 mt-1"
          style={{
            border: '1px solid var(--primary)',
            color: 'var(--primary)',
          }}
        >
          <Plus size={15} aria-hidden="true" />
          Créer une jam
        </Link>
      </div>

      {/* Bas de sidebar */}
      <div className="p-3 border-t space-y-0.5" style={{ borderColor: 'var(--sidebar-border)' }}>
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
  )

  return (
    <>
      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 w-60 border-r z-30"
        style={{ borderColor: 'var(--sidebar-border)' }}>
        {sidebar}
      </aside>

      {/* Header mobile */}
      <header
        className="md:hidden fixed top-0 left-0 right-0 flex items-center justify-between px-4 py-3 border-b z-40"
        style={{ background: 'var(--sidebar)', borderColor: 'var(--sidebar-border)' }}
      >
        <div className="flex items-center gap-2 font-bold text-sm">
          <Gamepad2 size={16} style={{ color: 'var(--primary)' }} aria-hidden="true" />
          Dashboard
        </div>
        <button
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
          className="p-2"
        >
          {open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
        </button>
      </header>

      {/* Drawer mobile */}
      {open && (
        <>
          <div
            className="md:hidden fixed inset-0 z-30 bg-black/50"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <aside className="md:hidden fixed inset-y-0 left-0 w-64 z-40 flex flex-col border-r"
            style={{ borderColor: 'var(--sidebar-border)' }}>
            {sidebar}
          </aside>
        </>
      )}

      {/* Spacer mobile pour le header fixe */}
      <div className="md:hidden h-14 flex-shrink-0" />
    </>
  )
}

