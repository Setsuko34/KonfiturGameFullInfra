import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Users, Clock, Trophy, MessageSquare, Info, Megaphone } from 'lucide-react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import CountdownTimer from '@/components/CountdownTimer'
import JamChat from '@/components/JamChat'
import { mockJams, mockAnnouncements, mockChatMessages } from '@/lib/mockData'

interface Props {
  params: { jamId: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const jam = mockJams.find(j => j.id === params.jamId)
  if (!jam) return { title: 'Jam introuvable' }
  return {
    title: jam.title,
    description: `${jam.theme} — ${jam.description.slice(0, 160)}`,
  }
}

const statusConfig = {
  ongoing: { label: 'EN COURS', color: 'var(--secondary)' },
  upcoming: { label: 'À VENIR', color: 'var(--primary)' },
  ended: { label: 'TERMINÉ', color: 'var(--muted-foreground)' },
}

export default function JamPage({ params }: Props) {
  const jam = mockJams.find(j => j.id === params.jamId)
  if (!jam) notFound()

  const status = statusConfig[jam.status]
  const announcements = mockAnnouncements.filter(a => a.jamId === jam.id)
  const chatMessages = mockChatMessages.filter(m => m.jamId === jam.id)

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
                      {jam.participants.toLocaleString('fr-FR')} participants
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
              {jam.status !== 'ended' && (
                <div
                  className="p-6 border w-full lg:w-auto lg:min-w-[280px]"
                  style={{ background: 'var(--surface-elevated)', borderColor: 'var(--border)' }}
                >
                  <CountdownTimer
                    targetDate={jam.status === 'ongoing' ? jam.endDate : jam.startDate}
                    size="md"
                    label={jam.status === 'ongoing' ? 'TEMPS RESTANT' : 'COMMENCE DANS'}
                  />
                </div>
              )}
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

              {/* Section Annonces */}
              <section id="announcements" aria-labelledby="ann-heading">
                <h2 id="ann-heading" className="text-xl font-bold mb-4">Annonces</h2>
                {announcements.length > 0 ? (
                  <div className="space-y-3">
                    {announcements.map(ann => (
                      <article
                        key={ann.id}
                        className="p-5 border"
                        style={{
                          background: 'var(--card)',
                          borderColor: ann.important ? 'var(--secondary)' : 'var(--border)',
                          borderLeft: ann.important ? `3px solid var(--secondary)` : undefined,
                        }}
                        aria-label={ann.important ? `Annonce importante : ${ann.title}` : ann.title}
                      >
                        {ann.important && (
                          <p className="label-tech mb-2" style={{ color: 'var(--secondary)' }}>
                            IMPORTANT
                          </p>
                        )}
                        <h3 className="font-semibold mb-2">{ann.title}</h3>
                        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                          {ann.content}
                        </p>
                        <time
                          className="label-tech mt-3 block"
                          style={{ color: 'var(--muted-foreground)' }}
                          dateTime={ann.createdAt.toISOString()}
                        >
                          {ann.createdAt.toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </time>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    Aucune annonce pour l&apos;instant.
                  </p>
                )}
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
