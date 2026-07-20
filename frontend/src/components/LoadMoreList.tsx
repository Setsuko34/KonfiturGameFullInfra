'use client'

import { useState, useTransition, type ComponentType } from 'react'

interface Props<T> {
  initialItems: T[]
  initialCursor: string | null
  /** Server Action : reçoit le curseur courant, renvoie le lot suivant + le curseur d'après. */
  loadMore: (cursor: string) => Promise<{ items: T[]; nextCursor: string | null }>
  /**
   * Composant client qui affiche la liste accumulée (une référence de composant, pas une
   * closure : une Server Component ne peut pas passer de fonction-rendu à un Client Component,
   * seulement une référence de Client Component ou une Server Action).
   */
  List: ComponentType<{ items: T[] }>
}

/**
 * Accumulation « Voir plus » générique : reçoit le premier lot rendu côté serveur, concatène
 * les lots suivants au clic via une Server Action, masque le bouton quand nextCursor est null.
 * Un seul composant, réutilisé par toutes les listes plafonnées à 50.
 */
export default function LoadMoreList<T>({ initialItems, initialCursor, loadMore, List }: Props<T>) {
  const [items, setItems] = useState(initialItems)
  const [cursor, setCursor] = useState(initialCursor)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleClick = () => {
    if (!cursor || isPending) return
    setError(null)
    startTransition(async () => {
      try {
        const res = await loadMore(cursor)
        setItems(prev => [...prev, ...res.items])
        setCursor(res.nextCursor)
      } catch {
        setError('Impossible de charger la suite. Réessayez.')
      }
    })
  }

  return (
    <>
      <List items={items} />
      {cursor && (
        <div className="flex flex-col items-center gap-2 px-4 py-8">
          <button
            type="button"
            onClick={handleClick}
            disabled={isPending}
            aria-busy={isPending}
            className="min-h-11 px-6 text-sm font-semibold border transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)', background: 'var(--card)' }}
          >
            {isPending ? 'Chargement…' : 'Voir plus'}
          </button>
          {error && (
            <p role="alert" className="text-xs" style={{ color: 'var(--secondary)' }}>
              {error}
            </p>
          )}
        </div>
      )}
    </>
  )
}
