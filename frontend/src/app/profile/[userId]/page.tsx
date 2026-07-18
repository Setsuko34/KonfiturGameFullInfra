import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Trophy, Gamepad2, Rocket } from 'lucide-react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import EmptyState from '@/components/EmptyState'
import { serverUsers } from '@/lib/appwrite/server'
import { COLLECTIONS } from '@/lib/appwrite/config'
import { Query } from 'node-appwrite'
import { mapDocToGameJam } from '@/lib/appwrite/types'
import { fetchAllDocs } from '@/lib/appwrite/fetch-all'
import { getPublicProfileProjects } from '@/lib/actions/profile'

interface Props { params: Promise<{ userId: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { userId } = await params
  try {
    const user = await serverUsers.get(userId)
    return { title: user.name || 'Profil' }
  } catch {
    return { title: 'Profil introuvable' }
  }
}

export default async function PublicProfilePage({ params }: Props) {
  const { userId } = await params
  let userName!: string
  let userBio: string | undefined
  let memberSince!: Date

  try {
    const user = await serverUsers.get(userId)
    userName = user.name || 'Anonyme'
    userBio = (user.prefs as Record<string, unknown>)?.bio as string | undefined
    memberSince = new Date(user.$createdAt)
  } catch {
    notFound()
  }

  // Jams organisées — TOUTES, pas de plafond : borné par l'effort humain d'organiser
  // une jam, pas par la croissance de la plateforme (fetchAllDocs, pas de « voir plus »)
  const organizedDocs = await fetchAllDocs(COLLECTIONS.GAME_JAMS, [
    Query.equal('organizer_id', userId),
    Query.orderDesc('$createdAt'),
  ])
  const organizedJams = organizedDocs.map(mapDocToGameJam)

  // Projets postés (team_members → team_id → projects) — l'information qu'un visiteur
  // cherche réellement pour un participant qui n'a jamais organisé de jam
  const postedProjects = await getPublicProfileProjects(userId)

  return (
    <>
      <Header />
      <main id="main-content" className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm mb-8"
          style={{ color: 'var(--muted-foreground)' }}
        >
          <ArrowLeft size={14} aria-hidden="true" /> Retour
        </Link>

        {/* En-tête profil */}
        <div className="p-6 border mb-8" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="flex items-start gap-4">
            <div
              className="w-16 h-16 flex items-center justify-center text-2xl font-bold flex-shrink-0"
              style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
              aria-hidden="true"
            >
              {userName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold">{userName}</h1>
              {userBio && (
                <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>{userBio}</p>
              )}
              <p className="text-xs mt-2" style={{ color: 'var(--muted-foreground)' }}>
                Membre depuis {memberSince.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        </div>

        {/* Jams organisées */}
        {organizedJams.length > 0 && (
          <section aria-labelledby="org-heading">
            <h2 id="org-heading" className="text-base font-bold mb-4 flex items-center gap-2">
              <Gamepad2 size={14} aria-hidden="true" />
              Jams organisées
            </h2>
            <ul className="space-y-2" role="list">
              {organizedJams.map(jam => (
                <li key={jam.id}>
                  <Link
                    href={`/jam/${jam.id}`}
                    className="block px-4 py-3 border transition-opacity hover:opacity-80"
                    style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                  >
                    <p className="font-semibold text-sm">{jam.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--primary)' }}>
                      Thème : {jam.theme}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="label-tech text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        {jam.status === 'ongoing' ? 'EN COURS' : jam.status === 'upcoming' ? 'À VENIR' : 'TERMINÉ'}
                      </span>
                      <span className="label-tech text-xs flex items-center gap-1" style={{ color: 'var(--muted-foreground)' }}>
                        <Trophy size={10} aria-hidden="true" /> {jam.participants} participants
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Projets postés */}
        {postedProjects.length > 0 && (
          <section aria-labelledby="projects-heading" className={organizedJams.length > 0 ? 'mt-8' : undefined}>
            <h2 id="projects-heading" className="text-base font-bold mb-4 flex items-center gap-2">
              <Rocket size={14} aria-hidden="true" />
              Projets postés
            </h2>
            <ul className="space-y-2" role="list">
              {postedProjects.map(project => (
                <li key={project.id}>
                  <Link
                    href={`/project/${project.id}`}
                    className="block px-4 py-3 border transition-opacity hover:opacity-80 min-h-11"
                    style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                  >
                    <p className="font-semibold text-sm">{project.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                      {project.likesCount} like{project.likesCount !== 1 ? 's' : ''}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Profil sans contenu public : ni jams organisées, ni projets postés */}
        {organizedJams.length === 0 && postedProjects.length === 0 && (
          <EmptyState
            icon={Gamepad2}
            title="Aucun contenu public pour l'instant"
            subtitle="Ce joueur n'a encore organisé aucune jam ni posté de projet."
          />
        )}
      </main>
      <Footer />
    </>
  )
}
