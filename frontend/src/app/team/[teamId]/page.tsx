import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Crown, Copy, ExternalLink } from 'lucide-react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

const roleConfig = {
  dev: { label: 'Développeur', color: 'var(--primary)' },
  artist: { label: 'Artiste', color: 'var(--secondary)' },
  sound: { label: 'Son', color: 'var(--success)' },
  designer: { label: 'Designer', color: '#FFD700' },
  writer: { label: 'Scénariste', color: '#C0C0C0' },
}

// Données de démonstration
const mockTeam = {
  id: 'team-001',
  jamId: 'jam-001',
  name: 'Les Pixels Renaissants',
  inviteCode: 'PXL-REN-2025',
  leaderId: 'user-002',
  projectId: undefined as string | undefined,
  members: [
    { id: 'm1', userId: 'user-002', name: 'DevPixel', role: 'dev' as const, isLeader: true },
    { id: 'm2', userId: 'user-003', name: 'ArtistMH', role: 'artist' as const, isLeader: false },
    { id: 'm3', userId: 'user-004', name: 'SoundWave', role: 'sound' as const, isLeader: false },
  ],
}

interface Props {
  params: Promise<{ teamId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { teamId } = await params
  return {
    title: 'Équipe',
    alternates: { canonical: `/team/${teamId}` },
  }
}

export default async function TeamPage({ params }: Props) {
  const { teamId } = await params
  const team = teamId === mockTeam.id ? mockTeam : null
  if (!team) notFound()

  return (
    <>
      <Header />
      <main id="main-content">
        {/* En-tête */}
        <div
          className="border-b px-4 sm:px-6 lg:px-8 py-10"
          style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
        >
          <div className="max-w-4xl mx-auto">
            <p className="label-tech mb-2" style={{ color: 'var(--muted-foreground)' }}>
              ÉQUIPE
            </p>
            <h1 className="text-3xl font-bold mb-4">{team.name}</h1>
            <div className="flex items-center gap-3">
              <span className="label-tech" style={{ color: 'var(--muted-foreground)' }}>
                {team.members.length} membre{team.members.length > 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          {/* Code d'invitation */}
          <section aria-labelledby="invite-heading">
            <h2 id="invite-heading" className="text-xl font-bold mb-4">Code d&apos;invitation</h2>
            <div
              className="flex items-center gap-4 p-5 border"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <code
                className="timer-font text-2xl font-bold flex-1"
                style={{ color: 'var(--primary)' }}
                aria-label={`Code d'invitation : ${team.inviteCode}`}
              >
                {team.inviteCode}
              </code>
              <button
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold"
                style={{
                  border: '1px solid var(--border)',
                  color: 'var(--foreground)',
                  background: 'var(--surface-elevated)',
                }}
                onClick={() => navigator.clipboard.writeText(team.inviteCode)}
                aria-label="Copier le code d'invitation"
              >
                <Copy size={14} aria-hidden="true" />
                Copier
              </button>
            </div>
            <p className="text-sm mt-2" style={{ color: 'var(--muted-foreground)' }}>
              Partagez ce code à vos coéquipiers pour qu&apos;ils rejoignent votre équipe.
            </p>
          </section>

          {/* Membres */}
          <section aria-labelledby="members-heading">
            <h2 id="members-heading" className="text-xl font-bold mb-4">Membres de l&apos;équipe</h2>
            <ul className="space-y-3" role="list">
              {team.members.map(member => {
                const roleInfo = roleConfig[member.role]
                return (
                  <li
                    key={member.id}
                    className="flex items-center gap-4 p-4 border"
                    style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                    aria-label={`${member.name}, ${roleInfo.label}${member.isLeader ? ', chef d\'équipe' : ''}`}
                  >
                    {/* Avatar */}
                    <div
                      className="w-10 h-10 flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{ background: 'var(--surface-elevated)', color: 'var(--foreground)' }}
                      aria-hidden="true"
                    >
                      {member.name.charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{member.name}</span>
                        {member.isLeader && (
                          <Crown
                            size={14}
                            style={{ color: '#FFD700' }}
                            aria-label="Chef d'équipe"
                          />
                        )}
                      </div>
                      <span
                        className="label-tech"
                        style={{ color: roleInfo.color }}
                      >
                        {roleInfo.label.toUpperCase()}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>

          {/* Projet de l'équipe */}
          <section aria-labelledby="project-heading">
            <h2 id="project-heading" className="text-xl font-bold mb-4">Projet</h2>
            {team.projectId ? (
              <a
                href={`/project/${team.projectId}`}
                className="flex items-center gap-2 p-5 border transition-colors"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <span className="font-semibold flex-1">Voir le projet</span>
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            ) : (
              <div
                className="p-5 border text-center"
                style={{
                  background: 'var(--card)',
                  borderColor: 'var(--border)',
                  borderStyle: 'dashed',
                }}
              >
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Aucun projet soumis pour le moment.
                </p>
              </div>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </>
  )
}
