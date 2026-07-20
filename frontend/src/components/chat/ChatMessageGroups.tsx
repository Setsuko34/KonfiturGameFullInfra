'use client'

import { Pin, PinOff, Flag } from 'lucide-react'

export interface ChatDisplayMessage {
  id: string
  authorName: string
  content: string
  pinned: boolean
  reported?: boolean
  createdAt: Date
  roleBadge?: { label: string; color: string } | null
}

function groupByDate(messages: ChatDisplayMessage[]) {
  const groups: Record<string, ChatDisplayMessage[]> = {}
  for (const msg of messages) {
    const key = msg.createdAt.toLocaleDateString('fr-FR')
    if (!groups[key]) groups[key] = []
    groups[key].push(msg)
  }
  return groups
}

export function PinnedBanner({ messages, onUnpin }: { messages: ChatDisplayMessage[]; onUnpin?: (id: string) => void }) {
  const pinned = messages.filter(m => m.pinned)
  if (pinned.length === 0) return null
  return (
    <div
      className="px-4 py-2 border-b"
      style={{ background: 'var(--primary-muted)', borderColor: 'var(--border)', flexShrink: 0 }}
    >
      {pinned.map(msg => (
        <div key={msg.id} className="flex items-start gap-2">
          <Pin size={12} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
          <p className="text-xs" style={{ color: 'var(--foreground)' }}>
            <span className="font-semibold">{msg.authorName} : </span>
            {msg.content}
          </p>
          {onUnpin && (
            <button
              type="button"
              onClick={() => onUnpin(msg.id)}
              className="ml-auto flex-shrink-0 flex items-center gap-1 text-xs px-2 py-1 transition-opacity hover:opacity-80"
              style={{ color: 'var(--muted-foreground)' }}
              aria-label={`Désépingler le message de ${msg.authorName}`}
              title="Désépingler"
            >
              <PinOff size={11} aria-hidden="true" />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

export default function ChatMessageGroups({
  messages,
  canReport,
  onReport,
  onPin,
}: {
  messages: ChatDisplayMessage[]
  canReport: boolean
  onReport: (id: string) => void
  onPin?: (id: string) => void
}) {
  const groups = groupByDate(messages.filter(m => !m.pinned))

  return (
    <>
      {Object.entries(groups).map(([date, msgs]) => (
        <div key={date}>
          <div className="flex items-center gap-3 my-4" aria-hidden="true">
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            <span className="label-tech" style={{ color: 'var(--muted-foreground)' }}>{date}</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </div>

          {msgs.map(msg => (
            <article key={msg.id} className="flex gap-3 group" aria-label={`Message de ${msg.authorName}`}>
              <div
                className="w-8 h-8 flex-shrink-0 flex items-center justify-center text-xs font-bold"
                style={{ background: 'var(--surface-elevated)', color: 'var(--foreground)' }}
                aria-hidden="true"
              >
                {msg.authorName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="text-sm font-semibold">{msg.authorName}</span>
                  {msg.roleBadge && (
                    <span
                      className="label-tech"
                      style={{ color: msg.roleBadge.color }}
                      aria-label={`Rôle : ${msg.roleBadge.label}`}
                    >
                      {msg.roleBadge.label}
                    </span>
                  )}
                  <time
                    dateTime={msg.createdAt.toISOString()}
                    className="label-tech"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    {msg.createdAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </time>
                </div>
                <p className="text-sm break-words" style={{ color: 'var(--foreground)' }}>
                  {msg.content}
                </p>
                {(canReport || onPin) && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-1 flex items-center gap-2">
                    {onPin && (
                      <button
                        onClick={() => onPin(msg.id)}
                        className="flex items-center gap-1 text-xs px-2 py-1"
                        style={{ color: 'var(--muted-foreground)', background: 'var(--surface-elevated)' }}
                        aria-label={`Épingler le message de ${msg.authorName}`}
                      >
                        <Pin size={11} aria-hidden="true" />
                        Épingler
                      </button>
                    )}
                    {canReport && (
                      <button
                        onClick={() => onReport(msg.id)}
                        disabled={msg.reported}
                        className="flex items-center gap-1 text-xs px-2 py-1 disabled:opacity-40"
                        style={{ color: 'var(--muted-foreground)', background: 'var(--surface-elevated)' }}
                        aria-label={
                          msg.reported
                            ? 'Message déjà signalé'
                            : `Signaler le message de ${msg.authorName}`
                        }
                      >
                        <Flag size={11} aria-hidden="true" />
                        {msg.reported ? 'Signalé' : 'Signaler'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      ))}
    </>
  )
}
