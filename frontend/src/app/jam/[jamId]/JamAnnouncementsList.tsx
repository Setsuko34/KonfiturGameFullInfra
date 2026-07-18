'use client'

import type { Announcement } from '@/types'

// Composant List de LoadMoreList : rendu des annonces d'une jam (contenu extrait de la page
// serveur pour pouvoir être passé en référence à LoadMoreList, cf. LoadMoreList.tsx).
export default function JamAnnouncementsList({ items }: { items: Announcement[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
        Aucune annonce pour l&apos;instant.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {items.map(ann => (
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
  )
}
