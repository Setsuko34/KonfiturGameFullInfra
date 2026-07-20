'use client'

import { useState, useTransition } from 'react'
import { setProjectPlacement } from '@/lib/actions/admin'

interface Props {
  projectId: string
  placement: number
}

export default function PlacementButtons({ projectId, placement: initialPlacement }: Props) {
  const [isPending, startTransition] = useTransition()
  const [placement, setPlacement] = useState(initialPlacement ?? 0)
  const [error, setError] = useState<string | null>(null)

  const handleClick = (rank: number) => {
    const next = placement === rank ? 0 : rank
    setError(null)
    startTransition(async () => {
      const result = await setProjectPlacement(projectId, next)
      if (result.success) {
        setPlacement(next)
      } else {
        setError(result.error ?? 'Une erreur est survenue.')
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1 flex-shrink-0">
      <div className="flex items-center gap-1">
        {[1, 2, 3].map(rank => (
          <button
            key={rank}
            type="button"
            onClick={() => handleClick(rank)}
            disabled={isPending}
            aria-label={placement === rank
              ? `Retirer la ${rank}${rank === 1 ? 're' : 'e'} place`
              : `Désigner ${rank}${rank === 1 ? 'er' : 'e'}`}
            className="px-2 py-1 text-xs border font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{
              background: placement === rank ? 'var(--primary)' : 'transparent',
              borderColor: placement === rank ? 'var(--primary)' : 'var(--border)',
              color: placement === rank ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
            }}
          >
            {rank}{rank === 1 ? 'er' : 'e'}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-xs" style={{ color: 'var(--secondary)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
