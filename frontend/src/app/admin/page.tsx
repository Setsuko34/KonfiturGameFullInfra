import type { Metadata } from 'next'
import { Users, List, UsersRound, Send, AlertTriangle, Bot, Ban, Bug } from 'lucide-react'
import { getAdminDashboard } from '@/lib/actions/admin'
import StatCard from '@/components/dashboard/StatCard'
import DailyBarChart from '@/components/dashboard/DailyBarChart'
import RecentList from '@/components/dashboard/RecentList'
import RefreshButton from '@/components/dashboard/RefreshButton'
import QuickActions from './QuickActions'

export const metadata: Metadata = { title: "Vue d'ensemble" }

const JAM_STATUS_LABELS: Record<string, string> = {
  upcoming: 'À venir',
  ongoing: 'En cours',
  ended: 'Terminée',
}

export default async function AdminPage() {
  const data = await getAdminDashboard()

  return (
    <div>
      <a href="#main-content" className="sr-only focus:not-sr-only">Aller au contenu principal</a>

      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'var(--font-mono)' }}>
            Vue d&apos;ensemble
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Statistiques globales de la plateforme
          </p>
        </div>
        <RefreshButton />
      </div>

      {/* Compteurs plateforme */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard label="Utilisateurs" value={data.totalUsers} icon={Users} href="/admin/users" />
        <StatCard label="Jams" value={`${data.totalJams} / ${data.activeJams} actives`} icon={List} href="/admin/jams" />
        <StatCard label="Équipes" value={data.totalTeams} icon={UsersRound} href="/admin/teams" />
        <StatCard label="Projets soumis" value={data.totalProjects} icon={Send} href="/admin/featured" />
      </div>

      {/* Compteurs sécurité et modération */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard label="Signalements" value={data.pendingReports} icon={AlertTriangle} href="/admin/moderation" urgent={data.pendingReports > 0} />
        <StatCard label="Bots bloqués 24 h" value={data.botsBlocked24h} icon={Bot} href="/admin/logs?type=bot_blocked" />
        <StatCard label="IPs bannies" value={data.bannedIPs} icon={Ban} href="/admin/logs" />
        <StatCard label="Erreurs 24 h" value={data.errors24h} icon={Bug} href="/admin/logs?type=error" urgent={data.errors24h > 0} />
      </div>

      {/* Actions rapides (position validée : avant les graphes) */}
      <div className="mb-10">
        <QuickActions pendingReports={data.pendingReports} />
      </div>

      {/* Graphes 14 jours */}
      <div className="grid lg:grid-cols-2 gap-4 mb-10">
        <DailyBarChart
          title="Inscriptions (14 jours)"
          data={data.registrationsByDay}
          total={data.registrationsByDay.reduce((s, d) => s + d.count, 0)}
        />
        <DailyBarChart
          title="Connexions (14 jours)"
          data={data.loginsByDay}
          total={data.loginsByDay.reduce((s, d) => s + d.count, 0)}
        />
      </div>

      {/* Listes récentes */}
      <div className="grid lg:grid-cols-3 gap-4">
        <RecentList
          title="Dernières inscriptions"
          href="/admin/users"
          emptyLabel="Aucune inscription récente."
          items={data.recentRegistrations.map(r => ({
            primary: r.name,
            secondary: r.country,
            meta: r.date.toLocaleDateString('fr-FR'),
          }))}
        />
        <RecentList
          title="Dernières jams"
          href="/admin/jams"
          emptyLabel="Aucune jam créée."
          items={data.recentJams.map(j => ({
            primary: j.title,
            secondary: JAM_STATUS_LABELS[j.status] ?? j.status,
          }))}
        />
        <div className="flex flex-col gap-4">
          <RecentList
            title="Santé"
            href="/admin/logs?type=error"
            emptyLabel="Aucune erreur récente."
            items={data.recentErrors.map(e => ({
              primary: e.message,
              secondary: e.path,
              meta: e.date.toLocaleDateString('fr-FR'),
            }))}
          />
          <RecentList
            title="Top pays (14 jours)"
            emptyLabel="Aucune connexion enregistrée."
            items={data.topCountries.map(c => ({
              primary: c.country,
              meta: String(c.count),
            }))}
          />
        </div>
      </div>
    </div>
  )
}
