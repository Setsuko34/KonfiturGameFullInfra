import { getUserParticipations } from '@/lib/actions/dashboard'
import Link from 'next/link'
import { ArrowRight, Trophy } from 'lucide-react'
import type { Metadata } from 'next'
import type { GameJam } from '@/types'

export const metadata: Metadata = { title: 'Mes participations' }

type StatusFilter = 'all' | 'ongoing' | 'upcoming' | 'ended'

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: 'Toutes',
  ongoing: 'En cours',
  upcoming: 'À venir',
  ended: 'Terminées',
}

interface Props {
  searchParams: Promise<{ status?: string }>
}

export default async function ParticipationsPage({ searchParams }: Props) {
  const { status } = await searchParams
  const { jams } = await getUserParticipations()

  const validFilters: StatusFilter[] = ['all', 'ongoing', 'upcoming', 'ended']
  const activeFilter: StatusFilter = validFilters.includes(status as StatusFilter)
    ? (status as StatusFilter)
    : 'all'

  const filteredJams: GameJam[] =
    activeFilter === 'all' ? jams : jams.filter(j => j.status === activeFilter)

  return (
    <section aria-labelledby="participations-heading">
      <p className="text-[9px] tracking-widest uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
        Participant
      </p>
      <h1 id="participations-heading" className="text-2xl font-bold mb-6">Mes participations</h1>

      {/* Filtres de statut */}
      <div className="flex flex-wrap gap-2 mb-6" role="group" aria-label="Filtrer par statut">
        {(Object.keys(STATUS_LABELS) as StatusFilter[]).map(s => (
          <Link
            key={s}
            href={s === 'all' ? '/dashboard/participations' : `/dashboard/participations?status=${s}`}
            className="px-3 py-1.5 text-xs font-semibold"
            style={{
              background: activeFilter === s ? 'var(--primary)' : 'var(--muted)',
              color: activeFilter === s ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
            }}
            aria-current={activeFilter === s ? 'page' : undefined}
          >
            {STATUS_LABELS[s]}
          </Link>
        ))}
      </div>

      {filteredJams.length === 0 ? (
        <div
          className="p-8 border text-center"
          style={{ background: 'var(--card)', borderColor: 'var(--border)', borderStyle: 'dashed' }}
        >
          <Trophy size={32} className="mx-auto mb-3" style={{ color: 'var(--muted-foreground)' }} aria-hidden="true" />
          <p className="text-sm mb-4" style={{ color: 'var(--muted-foreground)' }}>
            {jams.length === 0
              ? 'Tu n\'as pas encore rejoint de jam.'
              : 'Aucune jam pour ce filtre.'}
          </p>
          {jams.length === 0 && (
            <Link
              href="/explore"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
              style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              Explorer les jams <ArrowRight size={14} aria-hidden="true" />
            </Link>
          )}
        </div>
      ) : (
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" role="list">
          {filteredJams.map(jam => (
            <li key={jam.id}>
              <div
                className="p-5 border h-full flex flex-col justify-between"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="text-[9px] tracking-widest uppercase px-2 py-1"
                      style={{
                        background: jam.status === 'ongoing' ? 'rgba(239,35,60,.1)' : 'var(--muted)',
                        color: jam.status === 'ongoing' ? 'var(--secondary)' : 'var(--muted-foreground)',
                      }}
                    >
                      {jam.status === 'ongoing' ? 'En cours' : jam.status === 'upcoming' ? 'À venir' : 'Terminée'}
                    </span>
                  </div>
                  <h2 className="font-bold text-base mb-1">{jam.title}</h2>
                  <p className="text-sm mb-3" style={{ color: 'var(--primary)' }}>Thème : {jam.theme}</p>
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    {jam.startDate.toLocaleDateString('fr-FR')} — {jam.endDate.toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <Link
                  href={`/jam/${jam.id}`}
                  className="inline-flex items-center gap-2 mt-4 text-sm font-semibold"
                  style={{ color: 'var(--primary)' }}
                >
                  Voir la jam <ArrowRight size={13} aria-hidden="true" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
