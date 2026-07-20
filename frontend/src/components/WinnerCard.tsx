import { Trophy } from 'lucide-react'
import type { PastWinner } from '@/types'

interface WinnerCardProps {
  winner: PastWinner
}

const placementConfig = {
  1: { label: '1er', color: '#FFD700', bg: 'rgba(255, 215, 0, 0.08)' },
  2: { label: '2e', color: '#C0C0C0', bg: 'rgba(192, 192, 192, 0.08)' },
  3: { label: '3e', color: '#CD7F32', bg: 'rgba(205, 127, 50, 0.08)' },
}

export default function WinnerCard({ winner }: WinnerCardProps) {
  const placement = placementConfig[winner.placement]

  return (
    <article
      className="relative overflow-hidden border transition-colors"
      style={{
        background: 'var(--card)',
        borderColor: 'var(--border)',
      }}
      aria-label={`${placement.label} place, ${winner.projectTitle} par ${winner.teamName}`}
    >
      {/* Badge placement */}
      <div
        className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1"
        style={{ background: placement.bg, border: `1px solid ${placement.color}33` }}
        aria-hidden="true"
      >
        <Trophy size={12} style={{ color: placement.color }} />
        <span
          className="label-tech"
          style={{ color: placement.color }}
        >
          {placement.label.toUpperCase()}
        </span>
      </div>

      {/* Contenu */}
      <div className="p-5 pt-10">
        <p
          className="label-tech mb-1"
          style={{ color: 'var(--muted-foreground)' }}
        >
          {winner.jamTitle} · {winner.jamYear}
        </p>
        <h3 className="font-bold text-base mb-1" style={{ fontFamily: 'var(--font-sans)' }}>
          {winner.projectTitle}
        </h3>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          par {winner.teamName}
        </p>
      </div>
    </article>
  )
}
