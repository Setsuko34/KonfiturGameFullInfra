'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Heart, Send, Flag, Download, Github, ExternalLink } from 'lucide-react'
import { useAuth } from '@/components/providers/AuthProvider'
import { toggleLike, reportProject } from '@/lib/actions/projects'
import { addComment, getCommentsByProject } from '@/lib/actions/comments'
import { storageFileUrl } from '@/lib/appwrite/file-url'
import { BUCKETS } from '@/lib/appwrite/config'
import type { Comment } from '@/types'

interface Props {
  projectId: string
  initialLikesCount: number
  initialLiked: boolean
  downloadUrl?: string
  buildFileId?: string
  repoUrl?: string
  initialComments: Comment[]
  initialCommentsCursor: string | null
  initialReported: boolean
}

export default function ProjectInteractions({
  projectId,
  initialLikesCount,
  initialLiked,
  downloadUrl,
  buildFileId,
  repoUrl,
  initialComments,
  initialCommentsCursor,
  initialReported,
}: Props) {
  const { user } = useAuth()
  const [liked, setLiked] = useState(initialLiked)
  const [likes, setLikes] = useState(initialLikesCount)
  const [comment, setComment] = useState('')
  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [commentsCursor, setCommentsCursor] = useState(initialCommentsCursor)
  const [commentsError, setCommentsError] = useState<string | null>(null)
  const [isReported, setIsReported] = useState(initialReported)
  const [isPending, startTransition] = useTransition()
  const [isLoadingMoreComments, startCommentsTransition] = useTransition()

  // « Voir plus » : les commentaires sont triés du plus ancien au plus récent (Query.orderAsc),
  // donc le lot suivant s'accumule en fin de liste (contrairement à JamChat qui charge vers le
  // haut). ProjectInteractions gère déjà son propre état de commentaires (ajout optimiste via
  // handleComment) : brancher LoadMoreList remplacerait cet état par le sien, cassant l'ajout
  // immédiat d'un nouveau commentaire. Un bouton inline, comme le « charger plus anciens » de
  // JamChat, est le plus petit changement qui respecte le contrat sans ce conflit d'état.
  const handleLoadMoreComments = () => {
    if (!commentsCursor || isLoadingMoreComments) return
    setCommentsError(null)
    startCommentsTransition(async () => {
      try {
        const res = await getCommentsByProject(projectId, commentsCursor)
        // Un commentaire posté pendant qu'un curseur non-null était déjà chargé peut réapparaître
        // dans le lot suivant (orderAsc : il prend la place la plus récente) : dédoublonner par id,
        // même garde que JamChat (Task 4) pour les messages plus anciens.
        setComments(prev => [...prev, ...res.comments.filter(c => !prev.some(p => p.id === c.id))])
        setCommentsCursor(res.nextCursor)
      } catch {
        setCommentsError('Impossible de charger la suite. Réessayez.')
      }
    })
  }

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
          aria-label={liked ? `Retirer le like (${likes} likes)` : `Aimer ce projet (${likes} likes actuels)`}
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

        {buildFileId && (
          <a
            href={storageFileUrl(BUCKETS.PROJECT_BUILDS, buildFileId, 'download')}
            className="flex items-center gap-2 px-5 py-2.5 font-semibold text-sm border"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            aria-label="Télécharger le build du jeu (.zip)"
          >
            <Download size={15} aria-hidden="true" />
            Télécharger le build (.zip)
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

      {buildFileId && (
        <p className="text-xs mb-8" style={{ color: 'var(--muted-foreground)' }}>
          Archive fournie par l&apos;équipe : analyse antivirus partielle, prudence.
        </p>
      )}

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
                <Link
                  href={`/profile/${c.authorId}`}
                  className="inline-flex items-center gap-2 min-h-11"
                >
                  <div
                    className="w-7 h-7 flex items-center justify-center text-xs font-bold"
                    style={{ background: 'var(--surface-elevated)' }}
                    aria-hidden="true"
                  >
                    {c.authorName.charAt(0)}
                  </div>
                  <span className="font-semibold text-sm">{c.authorName}</span>
                </Link>
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

        {commentsCursor && (
          <div className="flex flex-col items-center gap-2 mb-6">
            <button
              type="button"
              onClick={handleLoadMoreComments}
              disabled={isLoadingMoreComments}
              aria-busy={isLoadingMoreComments}
              className="min-h-11 px-6 text-sm font-semibold border transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)', background: 'var(--card)' }}
            >
              {isLoadingMoreComments ? 'Chargement…' : 'Voir plus'}
            </button>
            {commentsError && (
              <p role="alert" className="text-xs" style={{ color: 'var(--secondary)' }}>
                {commentsError}
              </p>
            )}
          </div>
        )}

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
