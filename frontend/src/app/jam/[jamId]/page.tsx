import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Users, Clock, Trophy, MessageSquare, Info, Megaphone, ChevronDown } from 'lucide-react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import JamChat from '@/components/JamChat'
import LoadMoreList from '@/components/LoadMoreList'
import { getJamById, getAnnouncementsByJam } from '@/lib/actions/jams'
import { generateJamJsonLd, serializeJsonLd, truncateDescription } from '@/lib/seo'
import { getTeamsByJam } from '@/lib/actions/teams'
import { getProjectsByJam } from '@/lib/actions/projects'
import { getChatMessages } from '@/lib/actions/chat'
import { getUserTeams, getCurrentUser } from '@/lib/actions/dashboard'
import { storageFileUrl } from '@/lib/appwrite/file-url'
import { BUCKETS } from '@/lib/appwrite/config'
import JamTeamsSection from './JamTeamsSection'
import JamCountdownClient from './JamCountdownClient'
import JamAnnouncementsList from './JamAnnouncementsList'
import type { Announcement } from '@/types'

interface Props {
  params: Promise<{ jamId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { jamId } = await params
  const jam = await getJamById(jamId)
  if (!jam) return { title: 'Jam introuvable', robots: { index: false } }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://konfiturgame.fr'
  const ogUrl = `/og?type=jam&title=${encodeURIComponent(jam.title)}&theme=${encodeURIComponent(jam.theme)}&status=${jam.status}`

  return {
    title: jam.title,
    description: truncateDescription(jam.description),
    keywords: jam.tags ?? [],
    openGraph: {
      title: jam.title,
      description: truncateDescription(jam.description),
      type: 'website',
      url: `${siteUrl}/jam/${jam.id}`,
      images: [{ url: ogUrl, width: 1200, height: 630, alt: jam.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: jam.title,
      description: truncateDescription(jam.description),
      images: [ogUrl],
    },
    alternates: {
      canonical: `/jam/${jam.id}`,
    },
  }
}

const statusConfig = {
  ongoing: { label: 'EN COURS', color: 'var(--secondary)' },
  upcoming: { label: 'À VENIR', color: 'var(--primary)' },
  ended: { label: 'TERMINÉ', color: 'var(--muted-foreground)' },
}

export default async function JamPage({ params }: Props) {
  const { jamId } = await params

  // Tenter de récupérer l'utilisateur connecté (peut échouer si non connecté)
  let currentUser: { id: string; name: string } | null = null
  let userTeamsData: Awaited<ReturnType<typeof getUserTeams>> = []
  try {
    const [u, t] = await Promise.all([getCurrentUser(), getUserTeams()])
    currentUser = { id: u.$id, name: u.name }
    userTeamsData = t
  } catch {
    // Non connecté — currentUser reste null
  }

  const [jam, { announcements, nextCursor: announcementsNextCursor }, teams, projects, chatMessages] = await Promise.all([
    getJamById(jamId),
    getAnnouncementsByJam(jamId),
    getTeamsByJam(jamId),
    getProjectsByJam(jamId),
    getChatMessages(jamId, 'general'),
  ])

  if (!jam) notFound()

  async function loadMoreAnnouncements(cursor: string): Promise<{ items: Announcement[]; nextCursor: string | null }> {
    'use server'
    const res = await getAnnouncementsByJam(jamId, cursor)
    return { items: res.announcements, nextCursor: res.nextCursor }
  }

  // Team de l'user dans cette jam
  const userTeamInThisJam = currentUser
    ? (userTeamsData.find(({ team }) => team.jamIds.includes(jamId))?.team ?? null)
    : null

  // Teams dont l'user est leader, pas encore inscrites à cette jam
  const leaderTeamsNotInJam = currentUser
    ? userTeamsData
        .filter(({ isLeader, team }) => isLeader && !team.isSolo && !team.jamIds.includes(jamId))
        .map(({ team }) => ({ id: team.id, name: team.name }))
    : []

  // Page publique : le code d'invitation ne doit jamais être servi aux visiteurs
  // (getTeamsByJam renvoie le code brut, contrairement à getTeamById qui le blanchit déjà)
  const publicTeams = teams.map(t => ({ ...t, inviteCode: '' }))

  const now = new Date()
  const effectiveStatus: 'upcoming' | 'ongoing' | 'ended' =
    now >= jam.endDate ? 'ended' : now >= jam.startDate ? 'ongoing' : 'upcoming'

  const status = statusConfig[effectiveStatus]

  // Podium désigné par l'organisateur (rang 1er→3e)
  const podium = projects
    .filter(p => (p.placement ?? 0) > 0)
    .sort((a, b) => (a.placement ?? 0) - (b.placement ?? 0))
  const teamNames = Object.fromEntries(teams.map(t => [t.id, t.name]))

  // Compteur dérivé des inscrits réels (équipes + solos) : le champ stocké
  // jam.participants n'est jamais mis à jour par les inscriptions
  const participantsCount = teams.reduce((sum, t) => sum + t.members.length, 0)

  const tabs = [
    { id: 'info', label: 'Informations', icon: Info },
    { id: 'teams', label: 'Équipes', icon: Users },
    { id: 'projects', label: 'Projets', icon: Trophy },
    { id: 'announcements', label: 'Annonces', icon: Megaphone },
    { id: 'chat', label: 'Chat', icon: MessageSquare },
  ]

  return (
    <>
      <Header />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- JSON-LD sérialisé avec échappement de `<` (serializeJsonLd)
          __html: serializeJsonLd(generateJamJsonLd(jam, process.env.NEXT_PUBLIC_SITE_URL || 'https://konfiturgame.fr')),
        }}
      />
      <main id="main-content">
        {/* Hero de la jam */}
        <div
          className="border-b px-4 sm:px-6 lg:px-8 py-10"
          style={{
            borderColor: 'var(--border)',
            background: 'var(--card)',
            borderTop: `3px solid ${status.color}`,
          }}
        >
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col lg:flex-row gap-8 items-start">
              {/* Infos */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <span className="label-tech" style={{ color: status.color }}>
                    {status.label}
                  </span>
                  <span style={{ color: 'var(--border)' }}>·</span>
                  <span className="label-tech" style={{ color: 'var(--muted-foreground)' }}>
                    {jam.duration}
                  </span>
                  <span style={{ color: 'var(--border)' }}>·</span>
                  <span className="label-tech" style={{ color: 'var(--muted-foreground)' }}>
                    {jam.type === 'solo' ? 'Solo' : jam.type === 'team' ? 'Équipe' : 'Solo & Équipe'}
                  </span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold mb-3">
                  {jam.title}
                </h1>
                <p className="text-xl font-semibold mb-4" style={{ color: 'var(--primary)' }}>
                  Thème : {jam.theme}
                </p>
                <p className="text-base mb-6" style={{ color: 'var(--muted-foreground)' }}>
                  {jam.description}
                </p>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <Users size={14} style={{ color: 'var(--muted-foreground)' }} aria-hidden="true" />
                    <span className="label-tech" style={{ color: 'var(--muted-foreground)' }}>
                      {participantsCount.toLocaleString('fr-FR')} participant{participantsCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={14} style={{ color: 'var(--muted-foreground)' }} aria-hidden="true" />
                    <span className="label-tech" style={{ color: 'var(--muted-foreground)' }}>
                      {jam.startDate.toLocaleDateString('fr-FR')} → {jam.endDate.toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Countdown */}
              <JamCountdownClient
                initialStatus={effectiveStatus}
                startDate={jam.startDate}
                endDate={jam.endDate}
              />
            </div>
          </div>
        </div>

        {/* Onglets */}
        <div
          className="border-b overflow-x-auto"
          style={{ borderColor: 'var(--border)' }}
        >
          <div
            className="max-w-7xl mx-auto flex"
            role="tablist"
            aria-label="Sections de la jam"
          >
            {tabs.map(tab => (
              <a
                key={tab.id}
                href={`#${tab.id}`}
                role="tab"
                className="flex items-center gap-2 px-5 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors"
                style={{
                  borderBottomColor: 'transparent',
                  color: 'var(--muted-foreground)',
                }}
              >
                <tab.icon size={14} aria-hidden="true" />
                {tab.label}
              </a>
            ))}
          </div>
        </div>

        {/* Contenu */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Colonne principale */}
            <div className="lg:col-span-2 space-y-8">
              {/* Section Informations */}
              <section id="info" aria-labelledby="info-heading">
                <h2 id="info-heading" className="text-xl font-bold mb-4">Informations</h2>
                <div className="space-y-6">
                  {/* Règles */}
                  {jam.rules.length > 0 && (
                    <div
                      className="p-5 border"
                      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                    >
                      <h3 className="label-tech mb-3" style={{ color: 'var(--muted-foreground)' }}>
                        RÈGLES
                      </h3>
                      <ul className="space-y-2">
                        {jam.rules.map((rule, i) => (
                          <li key={i} className="flex gap-3 text-sm">
                            <span
                              className="timer-font flex-shrink-0"
                              style={{ color: 'var(--primary)' }}
                              aria-hidden="true"
                            >
                              {String(i + 1).padStart(2, '0')}
                            </span>
                            {rule}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Prix */}
                  {jam.prizes && jam.prizes.length > 0 && (
                    <div
                      className="p-5 border"
                      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                    >
                      <h3 className="label-tech mb-3" style={{ color: 'var(--muted-foreground)' }}>
                        PRIX
                      </h3>
                      <div className="flex gap-4">
                        {jam.prizes.map((prize, i) => (
                          <div
                            key={i}
                            className="flex flex-col items-center p-3 border"
                            style={{ borderColor: 'var(--border)', background: 'var(--surface-elevated)' }}
                          >
                            <span className="label-tech mb-1" style={{ color: 'var(--muted-foreground)' }}>
                              {i + 1}{i === 0 ? 'er' : 'e'}
                            </span>
                            <span className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>
                              {prize}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Podium — encart mis en avant dès qu'un rang est attribué */}
              {podium.length > 0 && (
                <section
                  aria-labelledby="podium-heading"
                  className="p-5 border"
                  style={{
                    background: 'var(--card)',
                    borderColor: 'var(--primary)',
                    borderLeft: '3px solid var(--primary)',
                  }}
                >
                  <p className="label-tech mb-1" style={{ color: 'var(--primary)' }}>PODIUM</p>
                  <h2 id="podium-heading" className="text-xl font-bold mb-4">
                    Palmarès de la jam
                  </h2>
                  <ol className="space-y-3">
                    {podium.map(p => (
                      <li key={p.id} className="flex items-center gap-3">
                        <span
                          className="label-tech w-10 flex-shrink-0"
                          style={{ color: 'var(--success)' }}
                        >
                          ★ {p.placement}{p.placement === 1 ? 'er' : 'e'}
                        </span>
                        <Link
                          href={`/project/${p.id}`}
                          className="font-semibold text-sm truncate transition-opacity hover:opacity-80"
                          style={{ color: 'var(--primary)' }}
                        >
                          {p.title}
                        </Link>
                        {teamNames[p.teamId] && (
                          <span className="text-xs flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
                            par {teamNames[p.teamId]}
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {/* Section Équipes */}
              <JamTeamsSection
                jamId={jam.id}
                jamTitle={jam.title}
                jamStatus={effectiveStatus}
                jamType={jam.type}
                startDate={jam.startDate}
                teams={publicTeams}
                currentUser={currentUser}
                userTeamInThisJam={userTeamInThisJam}
                leaderTeamsNotInJam={leaderTeamsNotInJam}
              />

              {/* Section Projets */}
              <section id="projects" aria-labelledby="projects-heading">
                <details open>
                  <summary className="flex items-center justify-between gap-2 mb-4 min-h-11 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                    <h2 id="projects-heading" className="text-xl font-bold">
                      Projets soumis ({projects.length})
                    </h2>
                    <ChevronDown
                      size={20}
                      className="chevron transition-transform duration-200 flex-shrink-0"
                      style={{ color: 'var(--muted-foreground)' }}
                      aria-hidden="true"
                    />
                  </summary>
                  {projects.length > 0 ? (
                    <div className="grid sm:grid-cols-2 gap-4">
                      {projects.map(project => (
                        <Link
                          key={project.id}
                          href={`/project/${project.id}`}
                          className="p-4 border block"
                          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                        >
                          {project.coverImage && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={storageFileUrl(BUCKETS.PROJECT_ASSETS, project.coverImage)}
                              alt="" aria-hidden="true"
                              className="w-full h-28 object-cover border-b mb-3"
                              style={{ borderColor: 'var(--border)' }} />
                          )}
                          <p className="font-semibold mb-1">{project.title}</p>
                          <p
                            className="text-sm mb-3 line-clamp-2"
                            style={{ color: 'var(--muted-foreground)' }}
                          >
                            {project.description}
                          </p>
                          <div className="flex items-center gap-3">
                            <span className="label-tech" style={{ color: 'var(--primary)' }}>
                              {project.likesCount} like{project.likesCount !== 1 ? 's' : ''}
                            </span>
                            {project.placement ? (
                              <span className="label-tech" style={{ color: 'var(--success)' }}>
                                ★ {project.placement}{project.placement === 1 ? 'er' : 'e'}
                              </span>
                            ) : null}
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                      Aucun projet soumis pour l&apos;instant.
                    </p>
                  )}
                </details>
              </section>

              {/* Section Annonces */}
              <section id="announcements" aria-labelledby="ann-heading">
                <details open>
                  <summary className="flex items-center justify-between gap-2 mb-4 min-h-11 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                    <h2 id="ann-heading" className="text-xl font-bold">Annonces</h2>
                    <ChevronDown
                      size={20}
                      className="chevron transition-transform duration-200 flex-shrink-0"
                      style={{ color: 'var(--muted-foreground)' }}
                      aria-hidden="true"
                    />
                  </summary>
                  <LoadMoreList
                    initialItems={announcements}
                    initialCursor={announcementsNextCursor}
                    loadMore={loadMoreAnnouncements}
                    List={JamAnnouncementsList}
                  />
                </details>
              </section>

              {/* Section Chat */}
              <section id="chat" aria-labelledby="chat-heading">
                <h2 id="chat-heading" className="text-xl font-bold mb-4">Chat en direct</h2>
                <JamChat jamId={jam.id} initialMessages={chatMessages} />
              </section>
            </div>

            {/* Sidebar droite */}
            <aside aria-label="Informations complémentaires">
              <div className="space-y-4 sticky top-20">
                {/* Organisateur */}
                <div
                  className="p-4 border"
                  style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                >
                  <h3 className="label-tech mb-3" style={{ color: 'var(--muted-foreground)' }}>
                    ORGANISATEUR
                  </h3>
                  <p className="font-semibold">{jam.organizer}</p>
                </div>

                {/* Tags */}
                {jam.tags && jam.tags.length > 0 && (
                  <div
                    className="p-4 border"
                    style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                  >
                    <h3 className="label-tech mb-3" style={{ color: 'var(--muted-foreground)' }}>
                      TAGS
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {jam.tags.map(tag => (
                        <span
                          key={tag}
                          className="label-tech px-2 py-1"
                          style={{
                            background: 'var(--surface-elevated)',
                            border: '1px solid var(--border)',
                            color: 'var(--muted-foreground)',
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dates */}
                <div
                  className="p-4 border"
                  style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                >
                  <h3 className="label-tech mb-3" style={{ color: 'var(--muted-foreground)' }}>
                    DATES
                  </h3>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt style={{ color: 'var(--muted-foreground)' }}>Début</dt>
                      <dd className="font-medium">
                        {jam.startDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt style={{ color: 'var(--muted-foreground)' }}>Fin</dt>
                      <dd className="font-medium">
                        {jam.endDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt style={{ color: 'var(--muted-foreground)' }}>Durée</dt>
                      <dd className="font-medium timer-font">{jam.duration}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
