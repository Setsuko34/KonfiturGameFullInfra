'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { CheckCircle, Trash2, ExternalLink } from 'lucide-react'
import { deleteMessage, resolveMessageReport } from '@/lib/actions/admin'
import type { ChatMessage } from '@/types'

// Composant List de LoadMoreList : les items résolus/supprimés sont masqués localement
// (LoadMoreList ne réinitialise pas son état accumulé depuis les props après revalidatePath).
export default function ReportedMessagesList({ items }: { items: ChatMessage[] }) {
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set())
  const visible = items.filter(m => !removedIds.has(m.id))

  if (visible.length === 0) {
    return <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Aucun message signalé.</p>
  }

  return (
    <div className="space-y-3">
      {visible.map(msg => (
        <MessageRow key={msg.id} msg={msg} onRemoved={() => setRemovedIds(prev => new Set(prev).add(msg.id))} />
      ))}
    </div>
  )
}

function MessageRow({ msg, onRemoved }: { msg: ChatMessage; onRemoved: () => void }) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="p-4 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold">{msg.authorName}</span>
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {msg.createdAt.toLocaleDateString('fr-FR')}
            </span>
          </div>
          <p className="text-sm break-words" style={{ color: 'var(--muted-foreground)' }}>
            {msg.content}
          </p>
          <Link
            href={`/jam/${msg.jamId}`}
            className="inline-flex items-center gap-1 text-xs mt-2 underline"
            style={{ color: 'var(--primary)' }}
          >
            <ExternalLink size={11} aria-hidden="true" /> Voir la jam (contexte du chat)
          </Link>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            type="button"
            title="Marquer comme résolu"
            aria-label="Marquer comme résolu"
            disabled={isPending}
            onClick={() => startTransition(async () => { await resolveMessageReport(msg.id); onRemoved() })}
            className="p-1.5 min-h-11 min-w-11 border transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
          >
            <CheckCircle size={13} aria-hidden="true" />
          </button>
          <button
            type="button"
            title="Supprimer le message"
            aria-label="Supprimer le message"
            disabled={isPending}
            onClick={() => startTransition(async () => { await deleteMessage(msg.id); onRemoved() })}
            className="p-1.5 min-h-11 min-w-11 border transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ borderColor: 'var(--secondary)', color: 'var(--secondary)' }}
          >
            <Trash2 size={13} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}
