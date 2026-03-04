'use client'

import { useState } from 'react'
import { notFound } from 'next/navigation'
import { ExternalLink, Github, Download, ThumbsUp, Send } from 'lucide-react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { useAuth } from '@/components/providers/AuthProvider'

const mockProject = {
  id: 'project-001',
  jamId: 'jam-001',
  teamId: 'team-001',
  title: 'Cozy Hearth',
  description: 'Un jeu de puzzle-platformer sur une plante qui renaît après chaque mort. La mort n\'est pas une fin — c\'est un mécanisme de progression. Chaque cycle apporte de nouvelles capacités et révèle de nouveaux passages.',
  technologies: ['Godot 4', 'GDScript', 'Aseprite', 'FMOD'],
  downloadUrl: '#',
  repoUrl: '#',
  submitted: true,
  submissionDate: new Date(Date.now() - 12 * 60 * 60 * 1000),
  votesCount: 42,
  coverImage: undefined as string | undefined,
  screenshotIds: [] as string[],
}

const mockComments = [
  {
    id: 'c1',
    authorName: 'GameDev42',
    content: 'Super concept ! La mécanique de renaissance est vraiment bien implémentée.',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: 'c2',
    authorName: 'IndiePlayer',
    content: 'Très bon jeu pour une jam de 72h. Les sprites sont magnifiques !',
    createdAt: new Date(Date.now() - 60 * 60 * 1000),
  },
]

interface Props {
  params: { projectId: string }
}

export default function ProjectPage({ params }: Props) {
  const project = params.projectId === mockProject.id ? mockProject : null
  const { user } = useAuth()
  const [voted, setVoted] = useState(false)
  const [votes, setVotes] = useState(mockProject.votesCount)
  const [comment, setComment] = useState('')
  const [comments, setComments] = useState(mockComments)

  if (!project) notFound()

  const handleVote = () => {
    if (!user || voted) return
    setVoted(true)
    setVotes(v => v + 1)
  }

  const handleComment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!comment.trim() || !user) return
    setComments(prev => [...prev, {
      id: `c${Date.now()}`,
      authorName: user.name,
      content: comment.trim(),
      createdAt: new Date(),
    }])
    setComment('')
  }

  return (
    <>
      <Header />
      <main id="main-content">
        {/* Hero projet */}
        <div
          className="border-b px-4 sm:px-6 lg:px-8 py-10"
          style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
        >
          <div className="max-w-5xl mx-auto">
            <p className="label-tech mb-2" style={{ color: 'var(--primary)' }}>
              PROJET
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold mb-3">{project.title}</h1>
            <p className="text-base mb-6" style={{ color: 'var(--muted-foreground)' }}>
              {project.description}
            </p>

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleVote}
                disabled={!user || voted}
                className="flex items-center gap-2 px-5 py-2.5 font-semibold text-sm transition-opacity disabled:opacity-50"
                style={{
                  background: voted ? 'var(--success)' : 'var(--primary)',
                  color: 'white',
                }}
                aria-label={voted ? `Vote enregistré — ${votes} votes` : `Voter pour ce projet — ${votes} votes actuels`}
                aria-pressed={voted}
              >
                <ThumbsUp size={15} aria-hidden="true" />
                {votes} vote{votes !== 1 ? 's' : ''}
                {voted && ' ✓'}
              </button>

              {project.downloadUrl && (
                <a
                  href={project.downloadUrl}
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

              {project.repoUrl && (
                <a
                  href={project.repoUrl}
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
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              {/* Screenshots */}
              {project.screenshotIds.length > 0 && (
                <section aria-labelledby="screenshots-heading">
                  <h2 id="screenshots-heading" className="text-xl font-bold mb-4">Screenshots</h2>
                  <div className="grid grid-cols-2 gap-3">
                    {project.screenshotIds.map((id, i) => (
                      <div
                        key={id}
                        className="aspect-video"
                        style={{ background: 'var(--surface-elevated)' }}
                        role="img"
                        aria-label={`Screenshot ${i + 1}`}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Commentaires */}
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

                {/* Formulaire commentaire */}
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
                      disabled={!comment.trim()}
                      className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold disabled:opacity-40"
                      style={{
                        background: 'var(--primary)',
                        color: 'var(--primary-foreground)',
                      }}
                    >
                      <Send size={14} aria-hidden="true" />
                      Commenter
                    </button>
                  </form>
                ) : (
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    <a href="/auth/login" style={{ color: 'var(--primary)' }}>Connectez-vous</a> pour laisser un commentaire.
                  </p>
                )}
              </section>
            </div>

            {/* Sidebar */}
            <aside aria-label="Informations du projet">
              <div
                className="p-5 border"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <h3 className="label-tech mb-4" style={{ color: 'var(--muted-foreground)' }}>
                  TECHNOLOGIES
                </h3>
                <div className="flex flex-wrap gap-2 mb-6">
                  {project.technologies.map(tech => (
                    <span
                      key={tech}
                      className="label-tech px-2 py-1"
                      style={{
                        background: 'var(--surface-elevated)',
                        border: '1px solid var(--border)',
                        color: 'var(--muted-foreground)',
                      }}
                    >
                      {tech}
                    </span>
                  ))}
                </div>

                {project.submitted && (
                  <div>
                    <h3 className="label-tech mb-2" style={{ color: 'var(--muted-foreground)' }}>
                      SOUMISSION
                    </h3>
                    <p className="label-tech" style={{ color: 'var(--success)' }}>
                      ✓ SOUMIS
                    </p>
                    {project.submissionDate && (
                      <time
                        className="text-xs mt-1 block"
                        style={{ color: 'var(--muted-foreground)' }}
                        dateTime={project.submissionDate.toISOString()}
                      >
                        {project.submissionDate.toLocaleDateString('fr-FR', {
                          day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
                        })}
                      </time>
                    )}
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
