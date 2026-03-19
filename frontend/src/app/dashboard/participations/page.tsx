import { getUserParticipations } from '@/lib/actions/dashboard'
import Link from 'next/link'
import { ArrowRight, Trophy } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Mes participations' }

export default async function ParticipationsPage() {
  const { jams } = await getUserParticipations()

  return (
    <section aria-labelledby="participations-heading">
      <p className="text-[9px] tracking-widest uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
        Participant
      </p>
      <h1 id="participations-heading" className="text-2xl font-bold mb-6">Mes participations</h1>

      {/* Filtre En cours / Terminées — déféré Phase 1.5 (nécessite searchParams + Server Component).
          Phase 1 affiche toutes les participations sans filtre. */}

      {jams.length === 0 ? (
        <div
          className="p-8 border text-center"
          style={{ background: 'var(--card)', borderColor: 'var(--border)', borderStyle: 'dashed' }}
        >
          <Trophy size={32} className="mx-auto mb-3" style={{ color: 'var(--muted-foreground)' }} aria-hidden="true" />
          <p className="text-sm mb-4" style={{ color: 'var(--muted-foreground)' }}>
            Tu n&apos;as pas encore rejoint de jam.
          </p>
          <Link
            href="/explore"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            Explorer les jams <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" role="list">
          {jams.map(jam => (
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

