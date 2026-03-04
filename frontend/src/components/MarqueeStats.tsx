import type { SiteStats } from '@/types'

interface MarqueeStatsProps {
  stats: SiteStats
}

export default function MarqueeStats({ stats }: MarqueeStatsProps) {
  const items = [
    `${stats.jamsOrganized} JAMS ORGANISÉES`,
    `${stats.participants.toLocaleString('fr-FR')} PARTICIPANTS`,
    `${stats.projectsSubmitted} PROJETS SOUMIS`,
    `${stats.countriesRepresented} PAYS REPRÉSENTÉS`,
    `100% GRATUIT`,
    `COMMUNAUTÉ FRANÇAISE`,
  ]

  // Dupliquer pour le défilement infini
  const doubled = [...items, ...items]

  return (
    <div
      className="overflow-hidden border-y py-3 marquee-container"
      style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
      aria-hidden="true"
    >
      <div className="animate-marquee" aria-hidden="true">
        {doubled.map((item, i) => (
          <span
            key={i}
            className="flex items-center gap-6 px-6"
            aria-hidden="true"
          >
            <span
              className="label-tech whitespace-nowrap"
              style={{ color: 'var(--muted-foreground)' }}
            >
              {item}
            </span>
            <span
              className="w-1 h-1 flex-shrink-0"
              style={{ background: 'var(--primary)', opacity: 0.6 }}
              aria-hidden="true"
            />
          </span>
        ))}
      </div>
    </div>
  )
}
