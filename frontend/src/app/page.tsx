import Link from 'next/link'
import type { Metadata } from 'next'
import { Users, Trophy, Gamepad2, Globe, ArrowRight, Zap, Heart } from 'lucide-react'
import { generateOrganizationJsonLd } from '@/lib/seo'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import JamCard from '@/components/JamCard'
import MarqueeStats from '@/components/MarqueeStats'
import WinnerCard from '@/components/WinnerCard'
import StatBlock from '@/components/StatBlock'
import CountdownTimer from '@/components/CountdownTimer'
import { getHomePageData } from '@/lib/actions/home'

export const metadata: Metadata = {
  title: 'KonfiturGame — Plateforme Game Jam',
  description: 'La plateforme française de game jams. Crée, jam, ship.',
  openGraph: {
    title: 'KonfiturGame — Plateforme Game Jam',
    description: 'La plateforme française de game jams. Crée, jam, ship.',
    images: [{ url: '/og?title=CRÉE.+JAM.+SHIP_', width: 1200, height: 630, alt: 'KonfiturGame' }],
  },
  alternates: { canonical: '/' },
}

export default async function HomePage() {
  const { ongoingJam, upcomingJams, winners, popularProjects, stats } = await getHomePageData()

  return (
    <>
      <Header />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(generateOrganizationJsonLd(
            process.env.NEXT_PUBLIC_SITE_URL || 'https://konfiturgame.fr'
          )),
        }}
      />
      <main id="main-content">
        {/* ═══ HERO ═══ */}
        <section
          className="relative px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center overflow-hidden"
          aria-labelledby="hero-heading"
        >
          <div className="max-w-4xl mx-auto relative z-10">
            <p className="label-tech mb-6" style={{ color: 'var(--primary)' }}>
              LA PLATEFORME FRANÇAISE DE GAME JAMS
            </p>
            <h1
              id="hero-heading"
              className="text-5xl sm:text-7xl lg:text-8xl font-bold leading-none tracking-tight mb-6"
              style={{ fontFamily: 'var(--font-sans)' }}
            >
              CRÉE.{' '}
              <span style={{ color: 'var(--primary)' }}>JAM.</span>{' '}
              <span style={{ color: 'var(--secondary)' }}>SHIP_</span>
            </h1>
            <p
              className="text-lg sm:text-xl max-w-2xl mx-auto mb-10"
              style={{ color: 'var(--muted-foreground)' }}
            >
              Rejoins des centaines de développeurs et créatifs pour créer des jeux
              en un temps limité. Gratuit, ouvert à tous, 100% passion.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/auth/register"
                className="flex items-center gap-2 px-8 py-4 font-bold text-base transition-opacity hover:opacity-90"
                style={{
                  background: 'var(--primary)',
                  color: 'var(--primary-foreground)',
                }}
              >
                <Zap size={18} aria-hidden="true" />
                Commencer gratuitement
              </Link>
              <Link
                href="/explore"
                className="flex items-center gap-2 px-8 py-4 font-bold text-base transition-colors"
                style={{
                  border: '1px solid var(--border)',
                  color: 'var(--foreground)',
                }}
              >
                Explorer les jams
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {/* ═══ MARQUEE ═══ */}
        <MarqueeStats stats={stats} />

        {/* ═══ JAM EN COURS (live widget) ═══ */}
        {ongoingJam && (
          <section
            className="px-4 sm:px-6 lg:px-8 py-16 border-b"
            style={{ borderColor: 'var(--border)' }}
            aria-labelledby="live-jam-heading"
          >
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center gap-3 mb-8">
                <div
                  className="w-2 h-2 animate-pulse-urgent"
                  style={{ background: 'var(--secondary)' }}
                  aria-hidden="true"
                />
                <p className="label-tech" style={{ color: 'var(--secondary)' }}>
                  JAM EN COURS
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div>
                  <h2
                    id="live-jam-heading"
                    className="text-3xl sm:text-4xl font-bold mb-3"
                    style={{ fontFamily: 'var(--font-sans)' }}
                  >
                    {ongoingJam.title}
                  </h2>
                  <p className="text-xl font-semibold mb-4" style={{ color: 'var(--primary)' }}>
                    Thème : {ongoingJam.theme}
                  </p>
                  <p className="text-base mb-6" style={{ color: 'var(--muted-foreground)' }}>
                    {ongoingJam.description}
                  </p>
                  <div className="flex items-center gap-4 mb-6">
                    <span className="label-tech" style={{ color: 'var(--muted-foreground)' }}>
                      {ongoingJam.participants} participants
                    </span>
                    <span style={{ color: 'var(--border)' }}>·</span>
                    <span className="label-tech" style={{ color: 'var(--muted-foreground)' }}>
                      {ongoingJam.duration}
                    </span>
                  </div>
                  <Link
                    href={`/jam/${ongoingJam.id}`}
                    className="inline-flex items-center gap-2 px-6 py-3 font-bold transition-opacity hover:opacity-90"
                    style={{
                      background: 'var(--secondary)',
                      color: 'var(--secondary-foreground)',
                    }}
                  >
                    Rejoindre la jam
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </div>

                <div
                  className="p-8 border"
                  style={{
                    background: 'var(--card)',
                    borderColor: 'var(--border)',
                  }}
                  aria-live="off"
                >
                  <CountdownTimer
                    targetDate={ongoingJam.endDate}
                    size="lg"
                    label="TEMPS RESTANT"
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ═══ JAMS À VENIR ═══ */}
        {upcomingJams.length > 0 && (
          <section
            className="px-4 sm:px-6 lg:px-8 py-16 border-b"
            style={{ borderColor: 'var(--border)' }}
            aria-labelledby="upcoming-heading"
          >
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <p className="label-tech mb-2" style={{ color: 'var(--muted-foreground)' }}>
                    PROCHAINEMENT
                  </p>
                  <h2 id="upcoming-heading" className="text-2xl font-bold">
                    Jams à venir
                  </h2>
                </div>
                <Link
                  href="/explore"
                  className="flex items-center gap-2 text-sm font-semibold"
                  style={{ color: 'var(--primary)' }}
                >
                  Tout voir
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcomingJams.map(jam => (
                  <JamCard key={jam.id} jam={jam} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ═══ STATISTIQUES ═══ */}
        <section
          className="px-4 sm:px-6 lg:px-8 py-16 border-b"
          style={{ borderColor: 'var(--border)' }}
          aria-labelledby="stats-heading"
        >
          <div className="max-w-7xl mx-auto">
            <p className="label-tech mb-2" style={{ color: 'var(--muted-foreground)' }}>
              EN CHIFFRES
            </p>
            <h2 id="stats-heading" className="text-2xl font-bold mb-8">
              La communauté KonfiturGame
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatBlock
                icon={Gamepad2}
                value={stats.jamsOrganized}
                label="JAMS ORGANISÉES"
                trend="+12%"
              />
              <StatBlock
                icon={Users}
                value={stats.participants}
                label="PARTICIPANTS"
                trend="+24%"
                accentColor="var(--secondary)"
              />
              <StatBlock
                icon={Trophy}
                value={stats.projectsSubmitted}
                label="PROJETS SOUMIS"
                trend="+18%"
                accentColor="var(--success)"
              />
              <StatBlock
                icon={Globe}
                value={stats.countriesRepresented}
                label="PAYS REPRÉSENTÉS"
                trend="+3"
                accentColor="var(--primary)"
              />
            </div>
          </div>
        </section>

        {/* ═══ PROJETS POPULAIRES ═══ */}
        {popularProjects.length > 0 && (
          <section
            className="px-4 sm:px-6 lg:px-8 py-16 border-b"
            style={{ borderColor: 'var(--border)' }}
            aria-labelledby="popular-heading"
          >
            <div className="max-w-7xl mx-auto">
              <p className="label-tech mb-2" style={{ color: 'var(--muted-foreground)' }}>
                POPULARITÉ
              </p>
              <h2 id="popular-heading" className="text-2xl font-bold mb-8">
                Projets les plus aimés
              </h2>
              <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {popularProjects.map(p => (
                  <li key={p.id}>
                    <Link
                      href={`/project/${p.id}`}
                      className="block p-5 border h-full transition-opacity hover:opacity-80"
                      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                    >
                      <p className="font-semibold mb-2 truncate">{p.title}</p>
                      <p className="text-sm mb-3" style={{ color: 'var(--muted-foreground)' }}>
                        {p.technologies.slice(0, 3).join(', ')}
                      </p>
                      <span
                        className="inline-flex items-center gap-1 text-sm font-medium"
                        style={{ color: 'var(--secondary)' }}
                      >
                        <Heart size={14} aria-hidden="true" fill="currentColor" />
                        {p.likesCount} like{p.likesCount !== 1 ? 's' : ''}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* ═══ HALL OF FAME ═══ */}
        <section
          className="px-4 sm:px-6 lg:px-8 py-16 border-b"
          style={{ borderColor: 'var(--border)' }}
          aria-labelledby="winners-heading"
        >
          <div className="max-w-7xl mx-auto">
            <p className="label-tech mb-2" style={{ color: 'var(--muted-foreground)' }}>
              HALL OF FAME
            </p>
            <h2 id="winners-heading" className="text-2xl font-bold mb-8">
              Gagnants des dernières jams
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {winners.map(winner => (
                <WinnerCard key={winner.id} winner={winner} />
              ))}
            </div>
          </div>
        </section>

        {/* ═══ CTA FINAL ═══ */}
        <section
          className="px-4 sm:px-6 lg:px-8 py-24 text-center"
          aria-labelledby="cta-heading"
        >
          <div className="max-w-2xl mx-auto">
            <p className="label-tech mb-4" style={{ color: 'var(--primary)' }}>
              PRÊT ?
            </p>
            <h2
              id="cta-heading"
              className="text-4xl sm:text-5xl font-bold mb-6"
              style={{ fontFamily: 'var(--font-sans)' }}
            >
              Ta prochaine création<br />commence ici.
            </h2>
            <p className="text-lg mb-10" style={{ color: 'var(--muted-foreground)' }}>
              Inscris-toi gratuitement et rejoins la prochaine game jam.
              Aucune expérience préalable requise.
            </p>
            <Link
              href="/auth/register"
              className="inline-flex items-center gap-2 px-10 py-5 font-bold text-lg transition-opacity hover:opacity-90"
              style={{
                background: 'var(--primary)',
                color: 'var(--primary-foreground)',
              }}
            >
              <Zap size={20} aria-hidden="true" />
              Créer mon compte
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
