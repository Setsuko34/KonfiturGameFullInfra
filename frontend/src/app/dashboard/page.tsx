import type { Metadata } from 'next'
import Link from 'next/link'
import { Trophy, Send, Gamepad2, Heart, ArrowRight } from 'lucide-react'
import { getUserDashboard } from '@/lib/actions/dashboard'
import CountdownTimer from '@/components/CountdownTimer'
import StatCard from '@/components/dashboard/StatCard'
import RecentList from '@/components/dashboard/RecentList'
import RefreshButton from '@/components/dashboard/RefreshButton'
import TeamsWidget from './TeamsWidget'

export const metadata: Metadata = { title: "Vue d'ensemble" }

export default async function DashboardPage() {
  const data = await getUserDashboard()

  return (
    <section aria-labelledby="overview-heading">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-[9px] tracking-widest uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
            Dashboard
          </p>
          <h1 id="overview-heading" className="text-2xl font-bold">Vue d&apos;ensemble</h1>
        </div>
        <RefreshButton />
      </div>

      {/* Stats personnelles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Participations" value={data.participationsCount} icon={Trophy} href="/dashboard/participations" />
        <StatCard label="Projets soumis" value={data.submittedProjectsCount} icon={Send} href="/dashboard/participations" />
        <StatCard label="Jams organisées" value={data.organizedJamsCount} icon={Gamepad2} href="/dashboard/my-jams" />
        <StatCard label="Likes reçus" value={data.likesReceived} icon={Heart} href="/dashboard/participations" />
      </div>

      {/* Jam en cours (bloc conservé) */}
      {data.ongoingJam ? (
        <div className="mb-8">
          <p className="text-[9px] tracking-widest uppercase mb-3" style={{ color: 'var(--muted-foreground)' }}>
            Jam en cours
          </p>
          <div
            className="p-6 border flex items-center justify-between gap-6"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div>
              <h2 className="text-xl font-bold mb-1">{data.ongoingJam.title}</h2>
              <p className="text-sm mb-4" style={{ color: 'var(--primary)' }}>Thème : {data.ongoingJam.theme}</p>
              <Link
                href={`/jam/${data.ongoingJam.id}`}
                className="inline-flex items-center gap-2 px-4 py-2 min-h-11 text-sm font-semibold"
                style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                Voir la jam <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
            <div role="timer" aria-label="Temps restant">
              <CountdownTimer targetDate={data.ongoingJam.endDate} size="lg" label="TEMPS RESTANT" />
            </div>
          </div>
        </div>
      ) : (
        <div
          className="p-8 border text-center mb-8"
          style={{ background: 'var(--card)', borderColor: 'var(--border)', borderStyle: 'dashed' }}
        >
          <p className="text-sm mb-3" style={{ color: 'var(--muted-foreground)' }}>
            Aucune jam en cours pour le moment.
          </p>
          <Link
            href="/explore"
            className="inline-flex items-center gap-2 px-4 py-2 min-h-11 text-sm font-semibold"
            style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
          >
            Explorer les jams <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      )}

      {/* À venir */}
      <div className="mb-8">
        <RecentList
          title="À venir"
          href="/explore"
          emptyLabel="Aucune jam annoncée pour le moment."
          items={data.upcomingJams.map(j => ({
            primary: j.title,
            meta: j.startDate.toLocaleDateString('fr-FR'),
          }))}
        />
      </div>

      {/* Feed + équipes */}
      <div className="grid lg:grid-cols-2 gap-4 mb-8">
        <RecentList
          title="Activité récente"
          emptyLabel="Rien de nouveau pour le moment."
          items={data.feed.map(f => ({
            primary: f.label,
            secondary: f.sublabel,
            meta: f.date.toLocaleDateString('fr-FR'),
          }))}
        />
        <TeamsWidget teams={data.teams} />
      </div>

      {/* Mes projets */}
      <RecentList
        title="Mes projets"
        href="/dashboard/participations"
        emptyLabel="Aucun projet pour le moment."
        items={data.myProjects.map(p => ({
          primary: p.title,
          meta: `${p.likes} like${p.likes > 1 ? 's' : ''} · ${p.comments} commentaire${p.comments > 1 ? 's' : ''}`,
        }))}
      />
    </section>
  )
}
