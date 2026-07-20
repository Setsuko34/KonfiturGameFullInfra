'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { CheckCircle, Trash2, ExternalLink } from 'lucide-react'
import { deleteTeamMessage, resolveTeamMessageReport } from '@/lib/actions/admin'
import type { TeamChatMessage } from '@/types'

// Composant List de LoadMoreList : les items résolus/supprimés sont masqués localement
export default function ReportedTeamMessagesList({ items }: { items: TeamChatMessage[] }) {
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set())
  const visible = items.filter(m => !removedIds.has(m.id))

  if (visible.length === 0) {
    return <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Aucun message de team signalé.</p>
  }

  return (
    <div className="space-y-3">
      {visible.map(msg => (
        <MessageRow key={msg.id} msg={msg} onRemoved={() => setRemovedIds(prev => new Set(prev).add(msg.id))} />
      ))}
    </div>
  )
}

function MessageRow({ msg, onRemoved }: { msg: TeamChatMessage; onRemoved: () => void }) {
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
            href={`/team/${msg.teamId}`}
            className="inline-flex items-center gap-1 text-xs mt-2 underline"
            style={{ color: 'var(--primary)' }}
          >
            <ExternalLink size={11} aria-hidden="true" /> Voir l&apos;équipe (contexte du tchat)
          </Link>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            type="button"
            title="Marquer comme résolu"
            aria-label="Marquer comme résolu"
            disabled={isPending}
            onClick={() => startTransition(async () => { await resolveTeamMessageReport(msg.id); onRemoved() })}
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
            onClick={() => startTransition(async () => { await deleteTeamMessage(msg.id); onRemoved() })}
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
