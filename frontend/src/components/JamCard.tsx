import Link from 'next/link'
import { Users, Clock, Tag, ArrowRight } from 'lucide-react'
import CountdownTimer from './CountdownTimer'
import type { GameJam } from '@/types'

interface JamCardProps {
  jam: GameJam
  variant?: 'default' | 'featured'
}

const statusConfig = {
  ongoing: {
    label: 'EN COURS',
    accentClass: 'accent-line-red',
    color: 'var(--secondary)',
  },
  upcoming: {
    label: 'À VENIR',
    accentClass: 'accent-line-blue',
    color: 'var(--primary)',
  },
  ended: {
    label: 'TERMINÉ',
    accentClass: 'accent-line-gray',
    color: 'var(--muted-foreground)',
  },
}

const typeLabel = {
  solo: 'Solo',
  team: 'Équipe',
  both: 'Solo & Équipe',
}

export default function JamCard({ jam, variant = 'default' }: JamCardProps) {
  const status = statusConfig[jam.status]
  const isFeatured = variant === 'featured'

  return (
    <Link
      href={`/jam/${jam.id}`}
      className={`block relative overflow-hidden transition-colors ${status.accentClass}`}
      style={{
        background: isFeatured ? 'var(--surface-elevated)' : 'var(--card)',
        border: '1px solid var(--border)',
        display: 'block',
      }}
      aria-label={`${jam.title} — ${status.label}`}
    >
      {/* Contenu */}
      <div className={`p-5 ${isFeatured ? 'p-6' : ''}`}>
        {/* En-tête */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <p
              className="label-tech mb-1"
              style={{ color: status.color }}
              aria-hidden="true"
            >
              {status.label}
            </p>
            <h3
              className={`font-bold leading-tight truncate ${isFeatured ? 'text-xl' : 'text-base'}`}
              style={{ fontFamily: 'var(--font-sans)' }}
            >
              {jam.title}
            </h3>
          </div>
          <ArrowRight
            size={16}
            className="flex-shrink-0 mt-1"
            style={{ color: 'var(--muted-foreground)' }}
            aria-hidden="true"
          />
        </div>

        {/* Thème */}
        <p className="text-sm font-semibold mb-3" style={{ color: 'var(--primary)' }}>
          Thème : {jam.theme}
        </p>

        {/* Description (featured seulement) */}
        {isFeatured && (
          <p
            className="text-sm mb-4 line-clamp-2"
            style={{ color: 'var(--muted-foreground)' }}
          >
            {jam.description}
          </p>
        )}

        {/* Métadonnées */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-1.5">
            <Users size={13} style={{ color: 'var(--muted-foreground)' }} aria-hidden="true" />
            <span className="label-tech" style={{ color: 'var(--muted-foreground)' }}>
              {jam.participants.toLocaleString('fr-FR')}
              {jam.maxParticipants ? `/${jam.maxParticipants}` : ''} participants
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock size={13} style={{ color: 'var(--muted-foreground)' }} aria-hidden="true" />
            <span className="label-tech" style={{ color: 'var(--muted-foreground)' }}>
              {jam.duration}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Tag size={13} style={{ color: 'var(--muted-foreground)' }} aria-hidden="true" />
            <span className="label-tech" style={{ color: 'var(--muted-foreground)' }}>
              {typeLabel[jam.type]}
            </span>
          </div>
        </div>

        {/* Tags */}
        {jam.tags && jam.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4" aria-label="Tags">
            {jam.tags.slice(0, 3).map(tag => (
              <span
                key={tag}
                className="label-tech px-2 py-0.5"
                style={{
                  background: 'var(--surface-elevated)',
                  color: 'var(--muted-foreground)',
                  border: '1px solid var(--border)',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Countdown pour les jams en cours ou à venir */}
        {jam.status !== 'ended' && (
          <div
            className="pt-3"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            <CountdownTimer
              targetDate={jam.status === 'ongoing' ? jam.endDate : jam.startDate}
              size="sm"
              label={jam.status === 'ongoing' ? 'TEMPS RESTANT' : 'COMMENCE DANS'}
            />
          </div>
        )}

        {/* Dates pour les jams terminées */}
        {jam.status === 'ended' && (
          <p
            className="label-tech pt-3"
            style={{
              color: 'var(--muted-foreground)',
              borderTop: '1px solid var(--border)',
            }}
          >
            {jam.startDate.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
          </p>
        )}
      </div>
    </Link>
  )
}
