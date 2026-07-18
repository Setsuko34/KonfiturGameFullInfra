'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toggleJamFeatured } from '@/lib/actions/admin'

interface Props {
  jamId: string
  featured: boolean
  featuredOrder?: number
}

export default function FeaturedToggleButton({ jamId, featured: initialFeatured, featuredOrder }: Props) {
  const [featured, setFeatured] = useState(initialFeatured)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleClick = () => {
    setError(null)
    startTransition(async () => {
      const result = await toggleJamFeatured(jamId, !featured, featuredOrder)
      if (result.success) {
        setFeatured(!featured)
        router.refresh() // resynchronise la bordure/l'icône Star de la ligne parente (rendues côté serveur)
      } else {
        setError(result.error ?? 'Une erreur est survenue.')
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1 flex-shrink-0">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="px-2 py-1 text-xs border font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
        style={{
          background: featured ? 'var(--primary)' : 'transparent',
          borderColor: featured ? 'var(--primary)' : 'var(--border)',
          color: featured ? '#fff' : 'var(--muted-foreground)',
        }}
      >
        {featured ? 'Retirer' : 'Mettre en avant'}
      </button>
      {error && (
        <p role="alert" className="text-xs" style={{ color: 'var(--secondary)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
