'use client'

import { useState, useTransition } from 'react'
import { Megaphone, Loader2, Trash2 } from 'lucide-react'
import { createOrganizerAnnouncement, deleteOrganizerAnnouncement } from '@/lib/actions/announcements'
import type { Announcement } from '@/types'

interface Props {
  jamId: string
  announcements: Announcement[]
}

export default function AnnouncementForm({ jamId, announcements }: Props) {
  const [isPending, startTransition] = useTransition()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [important, setImportant] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handlePublish = () => {
    startTransition(async () => {
      setMsg(null)
      const result = await createOrganizerAnnouncement(jamId, { title, content, important })
      if (result.success) {
        setTitle('')
        setContent('')
        setImportant(false)
        setMsg({ type: 'success', text: 'Annonce publiée' })
      } else {
        setMsg({ type: 'error', text: result.error ?? 'Erreur' })
      }
    })
  }

  const handleDelete = (announcementId: string) => {
    startTransition(async () => {
      const result = await deleteOrganizerAnnouncement(jamId, announcementId)
      if (!result.success) {
        setMsg({ type: 'error', text: result.error ?? 'Impossible de supprimer l\'annonce' })
      }
    })
  }

  const fieldStyle = {
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border)',
    color: 'var(--foreground)',
  }

  return (
    <div className="mb-8">
      <h2 className="text-base font-bold mb-4 flex items-center gap-2">
        <Megaphone size={15} aria-hidden="true" />
        Annonces
      </h2>

      {/* Formulaire publication */}
      <div className="p-5 border mb-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <h3 className="text-xs tracking-widest uppercase mb-3" style={{ color: 'var(--muted-foreground)' }}>
          Publier une annonce
        </h3>
        <div className="space-y-3">
          <div>
            <label htmlFor="ann-title" className="sr-only">Titre de l&apos;annonce</label>
            <input
              id="ann-title"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Titre de l'annonce"
              maxLength={100}
              className="w-full px-3 py-2 text-sm"
              style={fieldStyle}
            />
          </div>
          <div>
            <label htmlFor="ann-content" className="sr-only">Contenu de l&apos;annonce</label>
            <textarea
              id="ann-content"
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Contenu..."
              maxLength={2000}
              rows={3}
              className="w-full px-3 py-2 text-sm resize-none"
              style={fieldStyle}
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={important}
              onChange={e => setImportant(e.target.checked)}
              className="accent-secondary"
            />
            <span>Marquer comme important</span>
          </label>

          {msg && (
            <p role="alert" className="text-sm" style={{
              color: msg.type === 'success' ? 'var(--success)' : 'var(--secondary)',
            }}>
              {msg.text}
            </p>
          )}

          <button
            onClick={handlePublish}
            disabled={isPending || !title.trim() || !content.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
            aria-busy={isPending}
          >
            {isPending
              ? <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              : <Megaphone size={14} aria-hidden="true" />
            }
            Publier
          </button>
        </div>
      </div>

      {/* Liste des annonces existantes */}
      {announcements.length > 0 && (
        <ul className="space-y-2" role="list" aria-label="Annonces publiées">
          {announcements.map(ann => (
            <li
              key={ann.id}
              className="px-4 py-3 border flex items-start justify-between gap-4"
              style={{
                background: 'var(--card)',
                borderColor: ann.important ? 'var(--secondary)' : 'var(--border)',
                borderLeft: ann.important ? '3px solid var(--secondary)' : undefined,
              }}
            >
              <div className="flex-1 min-w-0">
                {ann.important && (
                  <p className="label-tech text-xs mb-1" style={{ color: 'var(--secondary)' }}>IMPORTANT</p>
                )}
                <p className="font-semibold text-sm truncate">{ann.title}</p>
                <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--muted-foreground)' }}>
                  {ann.content}
                </p>
                <time className="text-xs mt-1 block" style={{ color: 'var(--muted-foreground)' }}
                  dateTime={ann.createdAt.toISOString()}>
                  {ann.createdAt.toLocaleDateString('fr-FR')}
                </time>
              </div>
              <button
                onClick={() => handleDelete(ann.id)}
                disabled={isPending}
                className="p-1.5 transition-opacity hover:opacity-70 flex-shrink-0"
                style={{ color: 'var(--muted-foreground)' }}
                aria-label={`Supprimer l'annonce : ${ann.title}`}
              >
                <Trash2 size={13} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {announcements.length === 0 && (
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Aucune annonce publiée.</p>
      )}
    </div>
  )
}
