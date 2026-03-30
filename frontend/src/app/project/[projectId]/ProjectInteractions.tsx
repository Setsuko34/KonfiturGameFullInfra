'use client'

import { useState, useTransition } from 'react'
import { ThumbsUp, Send, Flag, Download, Github, ExternalLink } from 'lucide-react'
import { useAuth } from '@/components/providers/AuthProvider'
import { voteForProject, reportProject } from '@/lib/actions/projects'
import { addComment } from '@/lib/actions/comments'
import type { Comment } from '@/types'

interface Props {
  projectId: string
  initialVotesCount: number
  downloadUrl?: string
  repoUrl?: string
  initialComments: Comment[]
  initialReported: boolean
}

export default function ProjectInteractions({
  projectId,
  initialVotesCount,
  downloadUrl,
  repoUrl,
  initialComments,
  initialReported,
}: Props) {
  const { user } = useAuth()
  const [voted, setVoted] = useState(false)
  const [votes, setVotes] = useState(initialVotesCount)
  const [comment, setComment] = useState('')
  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [isReported, setIsReported] = useState(initialReported)
  const [isPending, startTransition] = useTransition()

  const handleVote = () => {
    if (!user || voted || isPending) return
    startTransition(async () => {
      const result = await voteForProject(projectId, user.$id)
      if (result.success) {
        setVoted(true)
        setVotes(v => v + 1)
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
          onClick={handleVote}
          disabled={!user || voted || isPending}
          className="flex items-center gap-2 px-5 py-2.5 font-semibold text-sm transition-opacity disabled:opacity-50"
          style={{
            background: voted ? 'var(--success)' : 'var(--primary)',
            color: 'white',
          }}
          aria-label={voted ? `Vote enregistré — ${votes} votes` : `Voter pour ce projet — ${votes} votes actuels`}
          aria-pressed={voted}
        >
          <ThumbsUp size={15} aria-hidden="true" />
          {votes} vote{votes !== 1 ? 's' : ''}{voted ? ' ✓' : ''}
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
