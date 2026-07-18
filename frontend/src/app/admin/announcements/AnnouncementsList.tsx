'use client'

import { useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { deleteAnnouncement } from '@/lib/actions/admin'
import type { Announcement } from '@/types'

// Composant List de LoadMoreList : les annonces supprimées sont masquées localement
// (LoadMoreList ne réinitialise pas son état accumulé depuis les props après revalidatePath).
export default function AnnouncementsList({ items }: { items: Announcement[] }) {
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set())
  const visible = items.filter(a => !removedIds.has(a.id))

  if (visible.length === 0) {
    return <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Aucune annonce.</p>
  }

  return (
    <div className="space-y-3">
      {visible.map(ann => (
        <AnnouncementRow key={ann.id} ann={ann} onRemoved={() => setRemovedIds(prev => new Set(prev).add(ann.id))} />
      ))}
    </div>
  )
}

function AnnouncementRow({ ann, onRemoved }: { ann: Announcement; onRemoved: () => void }) {
  const [isPending, startTransition] = useTransition()

  return (
    <div
      className="p-4 border"
      style={{
        background: 'var(--card)',
        borderColor: ann.important ? 'var(--secondary)' : 'var(--border)',
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm">{ann.title}</span>
            {ann.important && (
              <span
                className="text-[9px] uppercase tracking-widest px-1.5 py-0.5"
                style={{ background: 'rgba(239,35,60,0.15)', color: 'var(--secondary)' }}
              >
                Important
              </span>
            )}
            {ann.jamId !== 'all' && (
              <span
                className="text-[9px] uppercase tracking-widest px-1.5 py-0.5"
                style={{ background: 'rgba(79,106,255,0.15)', color: 'var(--primary)' }}
              >
                Jam ciblée
              </span>
            )}
          </div>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{ann.content}</p>
          <p className="text-xs mt-1.5" style={{ color: 'var(--muted-foreground)' }}>
            {ann.createdAt.toLocaleDateString('fr-FR')}
          </p>
        </div>
        <button
          type="button"
          title="Supprimer l'annonce"
          disabled={isPending}
          onClick={() => startTransition(async () => { await deleteAnnouncement(ann.id); onRemoved() })}
          className="p-1.5 min-h-11 min-w-11 border flex-shrink-0 transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ borderColor: 'var(--secondary)', color: 'var(--secondary)' }}
        >
          <Trash2 size={13} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
