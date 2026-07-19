import { cache } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Query } from 'node-appwrite'
import { Crown, ExternalLink } from 'lucide-react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { getTeamById } from '@/lib/actions/teams'
import { getProjectByTeamAndJam } from '@/lib/actions/projects'
import { serverDatabases } from '@/lib/appwrite/server'
import { DATABASE_ID, COLLECTIONS, BUCKETS } from '@/lib/appwrite/config'
import { mapDocToGameJam } from '@/lib/appwrite/types'
import { storageFileUrl } from '@/lib/appwrite/file-url'
import TeamCard from './TeamCard'
import TeamChat from '@/components/TeamChat'
import type { Project } from '@/types'

// generateMetadata + le composant de page appellent tous deux getTeamById : cache() par requête
// évite de dupliquer les 3 requêtes Appwrite (membres/projets/jams) pour un seul rendu.
const getTeamCached = cache(getTeamById)

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
  const data = await getTeamCached(teamId)
  if (!data) return { title: 'Équipe introuvable', robots: { index: false } }

  return {
    title: data.team.name,
    description: `Équipe ${data.team.name}, ${data.members.length} membre${data.members.length > 1 ? 's' : ''}`,
    alternates: { canonical: `/team/${teamId}` },
  }
}

export default async function TeamPage({ params }: Props) {
  const { teamId } = await params
  const data = await getTeamCached(teamId)
  if (!data) notFound()

  const { team, members, jams, projects, viewerRole, viewerId } = data
  const isMember = viewerRole !== 'visitor'
  const currentUserId = viewerId ?? ''

  // Contexte de gestion (membres uniquement)
  const projectsByJam: Record<string, Project | null> = {}
  let availableJamsToRegister: { id: string; title: string; status: 'upcoming' | 'ongoing' | 'ended' }[] = []
  if (isMember) {
    const ongoing = jams.filter(j => j.status === 'ongoing')
    await Promise.all(ongoing.map(async j => {
      projectsByJam[j.id] = await getProjectByTeamAndJam(team.id, j.id)
    }))

    if (viewerRole === 'leader' && !team.isSolo) {
      const availableJamsRes = await serverDatabases.listDocuments(
        DATABASE_ID, COLLECTIONS.GAME_JAMS,
        [Query.notEqual('status', 'ended'), Query.limit(50)]
      )
      const teamJamIds = new Set(team.jamIds)
      availableJamsToRegister = availableJamsRes.documents.map(mapDocToGameJam)
        .filter(j => j.type !== 'solo' && !teamJamIds.has(j.id))
        .map(j => ({ id: j.id, title: j.title, status: j.status }))
    }
  }

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
              {team.isSolo ? 'PARTICIPANT SOLO' : 'ÉQUIPE'}
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
          {/* Hub membre : gestion complète (code, membres, soumission, suppression) */}
          {isMember && (
            <TeamCard
              team={team}
              members={members}
              viewerRole={viewerRole === 'leader' ? 'leader' : 'member'}
              currentUserId={currentUserId}
              jams={jams.map(j => ({ id: j.id, title: j.title, status: j.status }))}
              projectsByJam={projectsByJam}
              availableJamsToRegister={availableJamsToRegister}
            />
          )}

          {/* Tchat privé (membres uniquement — la vraie barrière est la row security Appwrite) */}
          {isMember && (
            <section aria-labelledby="team-chat-heading">
              <h2 id="team-chat-heading" className="text-xl font-bold mb-4">Tchat d&apos;équipe</h2>
              <TeamChat teamId={team.id} currentUserId={currentUserId} />
            </section>
          )}

          {/* Vitrine : membres en lecture seule (visiteurs uniquement, TeamCard liste déjà les membres) */}
          {!isMember && (
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
                          <Link href={`/profile/${member.userId}`} className="font-semibold">
                            {member.name}
                          </Link>
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
          )}

          {/* Participations (tous les visiteurs) */}
          {jams.length > 0 && (
            <section aria-labelledby="jams-heading">
              <h2 id="jams-heading" className="text-xl font-bold mb-4">
                Participations ({jams.length})
              </h2>
              <ul className="space-y-3" role="list">
                {jams.map(jam => (
                  <li key={jam.id}>
                    <Link
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
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Projets soumis (tous les visiteurs) */}
          <section aria-labelledby="projects-heading">
            <h2 id="projects-heading" className="text-xl font-bold mb-4">Projets</h2>
            {projects.length > 0 ? (
              <ul className="space-y-3" role="list">
                {projects.map(project => (
                  <li key={project.id}>
                    <Link
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
                    </Link>
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
