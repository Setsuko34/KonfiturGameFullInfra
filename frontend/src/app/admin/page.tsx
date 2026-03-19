import type { Metadata } from 'next'
import Link from 'next/link'
import { Users, List, AlertTriangle, Megaphone } from 'lucide-react'
import { getAdminStats } from '@/lib/actions/admin'

export const metadata: Metadata = { title: "Vue d'ensemble" }

export default async function AdminPage() {
  const stats = await getAdminStats()

  const statCards = [
    { label: 'Utilisateurs', value: stats.totalUsers, icon: Users, href: '/admin/users' },
    { label: 'Jams totales', value: stats.totalJams, icon: List, href: '/admin/jams' },
    { label: 'Jams actives', value: stats.activeJams, icon: List, href: '/admin/jams?status=ongoing' },
    { label: 'Signalements', value: stats.pendingReports, icon: AlertTriangle, href: '/admin/moderation', urgent: stats.pendingReports > 0 },
  ]

  return (
    <div>
      <a href="#main-content" className="sr-only focus:not-sr-only">Aller au contenu principal</a>

      <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'var(--font-mono)' }}>
        Vue d&apos;ensemble
      </h1>
      <p className="text-sm mb-8" style={{ color: 'var(--muted-foreground)' }}>
        Statistiques globales de la plateforme
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {statCards.map(({ label, value, icon: Icon, href, urgent }) => (
          <Link
            key={label}
            href={href}
            className="p-5 border flex flex-col gap-3 transition-opacity hover:opacity-80"
            style={{
              background: 'var(--card)',
              borderColor: urgent ? 'var(--secondary)' : 'var(--border)',
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>
                {label}
              </span>
              <Icon
                size={14}
                aria-hidden="true"
                style={{ color: urgent ? 'var(--secondary)' : 'var(--muted-foreground)' }}
              />
            </div>
            <span
              className="text-3xl font-bold"
              style={{
                fontFamily: 'var(--font-mono)',
                color: urgent ? 'var(--secondary)' : 'var(--foreground)',
              }}
            >
              {value}
            </span>
          </Link>
        ))}
      </div>

      {/* Actions rapides */}
      <h2 className="text-sm uppercase tracking-widest mb-4" style={{ color: 'var(--muted-foreground)' }}>
        Actions rapides
      </h2>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/admin/moderation"
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ background: 'var(--secondary)', color: '#fff' }}
        >
          <AlertTriangle size={14} aria-hidden="true" />
          Voir les signalements ({stats.pendingReports})
        </Link>
        <Link
          href="/admin/announcements"
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border transition-opacity hover:opacity-80"
          style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
        >
          <Megaphone size={14} aria-hidden="true" />
          Nouvelle annonce
        </Link>
      </div>
    </div>
  )
}
