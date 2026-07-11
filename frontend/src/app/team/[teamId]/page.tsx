import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Crown, ExternalLink } from 'lucide-react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { getTeamById } from '@/lib/actions/teams'
import { storageFileUrl } from '@/lib/appwrite/file-url'
import { BUCKETS } from '@/lib/appwrite/config'
import CopyInviteButton from './CopyInviteButton'

const roleConfig = {
  dev: { label: 'Développeur', color: 'var(--primary)' },
  artist: { label: 'Artiste', color: 'var(--secondary)' },
  sound: { label: 'Son', color: 'var(--success)' },
  designer: { label: 'Designer', color: '#FFD700' },
  writer: { label: 'Scénariste', color: '#C0C0C0' },
}

interface Props {
  params: Promise<{ teamId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { teamId } = await params
  const data = await getTeamById(teamId)
  if (!data) return { title: 'Équipe introuvable', robots: { index: false } }

  return {
    title: data.team.name,
    description: `Équipe ${data.team.name} — ${data.members.length} membre${data.members.length > 1 ? 's' : ''}`,
    alternates: { canonical: `/team/${teamId}` },
  }
}

export default async function TeamPage({ params }: Props) {
  const { teamId } = await params
  const data = await getTeamById(teamId)
  if (!data) notFound()

  const { team, members, jams, projects } = data

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
                {members.length} membre{members.length > 1 ? 's' : ''}
              </span>
              {jams.length > 0 && (
                <>
                  <span style={{ color: 'var(--border)' }}>·</span>
                  <span className="label-tech" style={{ color: 'var(--muted-foreground)' }}>
                    {jams.length} jam{jams.length > 1 ? 's' : ''}
                  </span>
                </>
              )}
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
              <CopyInviteButton code={team.inviteCode} />
            </div>
            <p className="text-sm mt-2" style={{ color: 'var(--muted-foreground)' }}>
              Partagez ce code à vos coéquipiers pour qu&apos;ils rejoignent votre équipe.
            </p>
          </section>

          {/* Membres */}
          <section aria-labelledby="members-heading">
            <h2 id="members-heading" className="text-xl font-bold mb-4">Membres de l&apos;équipe</h2>
            <ul className="space-y-3" role="list">
              {members.map(member => {
                const roleInfo = roleConfig[member.role]
                return (
                  <li
                    key={member.id}
                    className="flex items-center gap-4 p-4 border"
                    style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                    aria-label={`${member.name}, ${roleInfo.label}${member.isLeader ? ', chef d\'équipe' : ''}`}
                  >
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
                          <Crown size={14} style={{ color: '#FFD700' }} aria-label="Chef d'équipe" />
                        )}
                      </div>
                      <span className="label-tech" style={{ color: roleInfo.color }}>
                        {roleInfo.label.toUpperCase()}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>

          {/* Jams */}
          {jams.length > 0 && (
            <section aria-labelledby="jams-heading">
              <h2 id="jams-heading" className="text-xl font-bold mb-4">
                Game Jams ({jams.length})
              </h2>
              <ul className="space-y-3" role="list">
                {jams.map(jam => (
                  <li key={jam.id}>
                    <a
                      href={`/jam/${jam.id}`}
                      className="flex items-center gap-4 p-4 border"
                      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold">{jam.title}</p>
                        <p className="label-tech" style={{ color: 'var(--muted-foreground)' }}>
                          {jam.status === 'ongoing' ? 'EN COURS' : jam.status === 'upcoming' ? 'À VENIR' : 'TERMINÉE'}
                        </p>
                      </div>
                      <ExternalLink size={14} style={{ color: 'var(--muted-foreground)' }} aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Projets */}
          <section aria-labelledby="projects-heading">
            <h2 id="projects-heading" className="text-xl font-bold mb-4">Projets</h2>
            {projects.length > 0 ? (
              <ul className="space-y-3" role="list">
                {projects.map(project => (
                  <li key={project.id}>
                    <a
                      href={`/project/${project.id}`}
                      className="block p-5 border"
                      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                    >
                      {project.coverImage && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={storageFileUrl(BUCKETS.PROJECT_ASSETS, project.coverImage)}
                          alt="" aria-hidden="true"
                          className="w-full h-28 object-cover border-b mb-3"
                          style={{ borderColor: 'var(--border)' }} />
                      )}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold">{project.title}</p>
                          <p
                            className="text-sm line-clamp-1"
                            style={{ color: 'var(--muted-foreground)' }}
                          >
                            {project.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="label-tech" style={{ color: 'var(--primary)' }}>
                            {project.likesCount} like{project.likesCount !== 1 ? 's' : ''}
                          </span>
                          {project.placement ? (
                            <span className="label-tech" style={{ color: 'var(--success)' }}>
                              ★ {project.placement}{project.placement === 1 ? 'er' : 'e'}
                            </span>
                          ) : null}
                          <ExternalLink size={14} style={{ color: 'var(--muted-foreground)' }} aria-hidden="true" />
                        </div>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
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
