'use client'

import { useState, useTransition } from 'react'
import { Heart, Send, Flag, Download, Github, ExternalLink } from 'lucide-react'
import { useAuth } from '@/components/providers/AuthProvider'
import { toggleLike, reportProject } from '@/lib/actions/projects'
import { addComment } from '@/lib/actions/comments'
import type { Comment } from '@/types'

interface Props {
  projectId: string
  initialLikesCount: number
  initialLiked: boolean
  downloadUrl?: string
  repoUrl?: string
  initialComments: Comment[]
  initialReported: boolean
}

export default function ProjectInteractions({
  projectId,
  initialLikesCount,
  initialLiked,
  downloadUrl,
  repoUrl,
  initialComments,
  initialReported,
}: Props) {
  const { user } = useAuth()
  const [liked, setLiked] = useState(initialLiked)
  const [likes, setLikes] = useState(initialLikesCount)
  const [comment, setComment] = useState('')
  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [isReported, setIsReported] = useState(initialReported)
  const [isPending, startTransition] = useTransition()

  const handleLike = () => {
    if (!user || isPending) return
    startTransition(async () => {
      const result = await toggleLike(projectId)
      if (result.success) {
        setLiked(result.liked)
        setLikes(result.likesCount)
      }
    })
  }

  const handleComment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!comment.trim() || !user || isPending) return
    const content = comment.trim()
    setComment('')
    startTransition(async () => {
      const result = await addComment({ projectId, content })
      if (result.success && result.comment) {
        setComments(prev => [...prev, result.comment!])
      }
    })
  }

  const handleReport = () => {
    if (!user || isReported || isPending) return
    startTransition(async () => {
      const result = await reportProject(projectId)
      if (result.success) setIsReported(true)
    })
  }

  return (
    <>
      {/* Boutons d'action */}
      <div className="flex flex-wrap gap-3 mb-8">
        <button
          onClick={handleLike}
          disabled={!user || isPending}
          className="flex items-center gap-2 px-5 py-2.5 font-semibold text-sm transition-opacity disabled:opacity-50"
          style={{
            background: liked ? 'var(--secondary)' : 'var(--primary)',
            color: 'var(--primary-foreground)',
          }}
          aria-label={liked ? `Retirer le like — ${likes} likes` : `Aimer ce projet — ${likes} likes actuels`}
          aria-pressed={liked}
        >
          <Heart size={15} aria-hidden="true" fill={liked ? 'currentColor' : 'none'} />
          {likes} like{likes !== 1 ? 's' : ''}
        </button>

        {downloadUrl && (
          <a
            href={downloadUrl}
            className="flex items-center gap-2 px-5 py-2.5 font-semibold text-sm"
            style={{
              border: '1px solid var(--border)',
              color: 'var(--foreground)',
              background: 'var(--surface-elevated)',
            }}
            aria-label="Télécharger le jeu"
          >
            <Download size={15} aria-hidden="true" />
            Télécharger
          </a>
        )}

        {repoUrl && (
          <a
            href={repoUrl}
            className="flex items-center gap-2 px-5 py-2.5 font-semibold text-sm"
            style={{
              border: '1px solid var(--border)',
              color: 'var(--foreground)',
              background: 'var(--surface-elevated)',
            }}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Voir le code source (s'ouvre dans un nouvel onglet)"
          >
            <Github size={15} aria-hidden="true" />
            Code source
            <ExternalLink size={12} aria-hidden="true" />
          </a>
        )}

        {user && (
          <button
            onClick={handleReport}
            disabled={isReported || isPending}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
            style={{
              border: '1px solid var(--border)',
              color: 'var(--muted-foreground)',
              background: 'transparent',
            }}
            aria-label={isReported ? 'Projet déjà signalé' : 'Signaler ce projet comme inapproprié'}
          >
            <Flag size={13} aria-hidden="true" />
            {isReported ? 'Signalé' : 'Signaler'}
          </button>
        )}
      </div>

      {/* Section commentaires */}
      <section aria-labelledby="comments-heading">
        <h2 id="comments-heading" className="text-xl font-bold mb-4">
          Commentaires ({comments.length})
        </h2>

        <div className="space-y-4 mb-6">
          {comments.map(c => (
            <article
              key={c.id}
              className="p-4 border"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
              aria-label={`Commentaire de ${c.authorName}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-7 h-7 flex items-center justify-center text-xs font-bold"
                  style={{ background: 'var(--surface-elevated)' }}
                  aria-hidden="true"
                >
                  {c.authorName.charAt(0)}
                </div>
                <span className="font-semibold text-sm">{c.authorName}</span>
                <time
                  className="label-tech"
                  style={{ color: 'var(--muted-foreground)' }}
                  dateTime={c.createdAt.toISOString()}
                >
                  {c.createdAt.toLocaleDateString('fr-FR')}
                </time>
              </div>
              <p className="text-sm" style={{ color: 'var(--foreground)' }}>
                {c.content}
              </p>
            </article>
          ))}
        </div>

        {user ? (
          <form onSubmit={handleComment} aria-label="Ajouter un commentaire">
            <label htmlFor="comment-input" className="sr-only">
              Votre commentaire
            </label>
            <textarea
              id="comment-input"
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Laissez un commentaire sur ce projet..."
              rows={3}
              maxLength={2048}
              className="w-full px-4 py-3 text-sm mb-3 resize-y"
              style={{
                background: 'var(--input-background)',
                border: '1px solid var(--border)',
                color: 'var(--foreground)',
              }}
            />
            <button
              type="submit"
              disabled={!comment.trim() || isPending}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold disabled:opacity-40"
              style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              <Send size={14} aria-hidden="true" />
              Commenter
            </button>
          </form>
        ) : (
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            <a href="/auth/login" style={{ color: 'var(--primary)' }}>
              Connectez-vous
            </a>{' '}
            pour laisser un commentaire.
          </p>
        )}
      </section>
    </>
  )
}
