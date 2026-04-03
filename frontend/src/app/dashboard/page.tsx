import { getDashboardOverview } from '@/lib/actions/dashboard'
import CountdownTimer from '@/components/CountdownTimer'
import Link from 'next/link'
import { Gamepad2, Trophy, Send, ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Vue d\'ensemble' }

export default async function DashboardPage() {
  const { participationsCount, organizedJamsCount, submittedProjectsCount, ongoingJam } =
    await getDashboardOverview()

  return (
    <section aria-labelledby="overview-heading">
      <p className="text-[9px] tracking-widest uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
        Dashboard
      </p>
      <h1 id="overview-heading" className="text-2xl font-bold mb-6">Vue d&apos;ensemble</h1>

      {/* Stats personnelles */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="p-5 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Trophy size={16} style={{ color: 'var(--primary)' }} aria-hidden="true" />
            <span className="text-[9px] tracking-widest uppercase" style={{ color: 'var(--muted-foreground)' }}>
              Participations
            </span>
          </div>
          <p className="text-3xl font-bold" style={{ color: 'var(--primary)' }}>{participationsCount}</p>
        </div>

        <div className="p-5 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Send size={16} style={{ color: 'var(--success)' }} aria-hidden="true" />
            <span className="text-[9px] tracking-widest uppercase" style={{ color: 'var(--muted-foreground)' }}>
              Projets soumis
            </span>
          </div>
          <p className="text-3xl font-bold" style={{ color: 'var(--success)' }}>{submittedProjectsCount}</p>
        </div>

        <div className="p-5 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Gamepad2 size={16} style={{ color: 'var(--secondary)' }} aria-hidden="true" />
            <span className="text-[9px] tracking-widest uppercase" style={{ color: 'var(--muted-foreground)' }}>
              Jams organisées
            </span>
          </div>
          <p className="text-3xl font-bold" style={{ color: 'var(--secondary)' }}>{organizedJamsCount}</p>
        </div>
      </div>

      {/* Feed d'activité récente — déféré Phase 1.5.
          Nécessite un champ `action_type` ou une collection dédiée non présente dans le schéma actuel.
          Phase 1 affiche uniquement les stats et la jam en cours. */}

      {/* Jam en cours */}
      {ongoingJam ? (
        <div>
          <p className="text-[9px] tracking-widest uppercase mb-3" style={{ color: 'var(--muted-foreground)' }}>
            Jam en cours
          </p>
          <div
            className="p-6 border flex items-center justify-between gap-6"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div>
              <h2 className="text-xl font-bold mb-1">{ongoingJam.title}</h2>
              <p className="text-sm mb-4" style={{ color: 'var(--primary)' }}>Thème : {ongoingJam.theme}</p>
              <Link
                href={`/jam/${ongoingJam.id}`}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
                style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                Voir la jam <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
            <div role="timer" aria-label="Temps restant">
              <CountdownTimer targetDate={ongoingJam.endDate} size="lg" label="TEMPS RESTANT" />
            </div>
          </div>
        </div>
      ) : (
        <div
          className="p-8 border text-center"
          style={{ background: 'var(--card)', borderColor: 'var(--border)', borderStyle: 'dashed' }}
        >
          <p className="text-sm mb-3" style={{ color: 'var(--muted-foreground)' }}>
            Aucune jam en cours pour le moment.
          </p>
          <Link
            href="/explore"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
            style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
          >
            Explorer les jams <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      )}
    </section>
  )
}
