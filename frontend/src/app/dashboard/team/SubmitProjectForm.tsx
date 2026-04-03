'use client'

import { useState, useTransition } from 'react'
import { Send, Package, CheckCircle } from 'lucide-react'
import { submitProject } from '@/lib/actions/projects'
import type { Project } from '@/types'

interface Props {
  jamId: string
  teamId: string
  existingProject: Project | null
}

export default function SubmitProjectForm({ jamId, teamId, existingProject }: Props) {
  const [isPending, startTransition] = useTransition()
  const [submitted, setSubmitted] = useState(!!existingProject?.submitted)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState(existingProject?.title ?? '')
  const [description, setDescription] = useState(existingProject?.description ?? '')
  const [technologiesRaw, setTechnologiesRaw] = useState(
    existingProject?.technologies.join(', ') ?? ''
  )
  const [repoUrl, setRepoUrl] = useState(existingProject?.repoUrl ?? '')
  const [downloadUrl, setDownloadUrl] = useState(existingProject?.downloadUrl ?? '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const technologies = technologiesRaw
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)

    startTransition(async () => {
      const result = await submitProject({
        jamId,
        teamId,
        title,
        description,
        technologies,
        repoUrl: repoUrl.trim() || undefined,
        downloadUrl: downloadUrl.trim() || undefined,
      })
      if (result.success) {
        setSubmitted(true)
      } else {
        setError(result.error ?? 'Une erreur est survenue.')
      }
    })
  }

  if (submitted) {
    return (
      <div
        className="p-5 border"
        style={{
          background: 'var(--card)',
          borderColor: 'var(--success)',
          borderLeft: '3px solid var(--success)',
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle size={16} style={{ color: 'var(--success)' }} aria-hidden="true" />
          <p className="label-tech" style={{ color: 'var(--success)' }}>PROJET SOUMIS</p>
        </div>
        <p className="font-bold text-base">{title || existingProject?.title}</p>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          {description || existingProject?.description}
        </p>
      </div>
    )
  }

  return (
    <div className="p-5 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
      <h2 className="text-base font-bold mb-4 flex items-center gap-2">
        <Package size={16} aria-hidden="true" />
        Soumettre mon projet
      </h2>

      {error && (
        <p
          className="text-sm mb-4 px-3 py-2"
          style={{ background: 'rgba(239,35,60,.1)', color: 'var(--secondary)' }}
          role="alert"
        >
          {error}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-4"
        aria-label="Formulaire de soumission de projet"
      >
        <div>
          <label
            htmlFor="proj-title"
            className="label-tech block mb-1"
            style={{ color: 'var(--muted-foreground)' }}
          >
            TITRE DU JEU *
          </label>
          <input
            id="proj-title"
            required
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={120}
            className="w-full px-3 py-2 text-sm"
            style={{
              background: 'var(--input-background)',
              border: '1px solid var(--border)',
              color: 'var(--foreground)',
            }}
          />
        </div>

        <div>
          <label
            htmlFor="proj-desc"
            className="label-tech block mb-1"
            style={{ color: 'var(--muted-foreground)' }}
          >
            DESCRIPTION *
          </label>
          <textarea
            id="proj-desc"
            required
            rows={3}
            value={description}
            onChange={e => setDescription(e.target.value)}
            maxLength={2048}
            className="w-full px-3 py-2 text-sm resize-y"
            style={{
              background: 'var(--input-background)',
              border: '1px solid var(--border)',
              color: 'var(--foreground)',
            }}
          />
        </div>

        <div>
          <label
            htmlFor="proj-tech"
            className="label-tech block mb-1"
            style={{ color: 'var(--muted-foreground)' }}
          >
            TECHNOLOGIES (séparées par des virgules)
          </label>
          <input
            id="proj-tech"
            value={technologiesRaw}
            onChange={e => setTechnologiesRaw(e.target.value)}
            placeholder="Godot 4, GDScript, Aseprite..."
            className="w-full px-3 py-2 text-sm"
            style={{
              background: 'var(--input-background)',
              border: '1px solid var(--border)',
              color: 'var(--foreground)',
            }}
          />
        </div>

        <div>
          <label
            htmlFor="proj-repo"
            className="label-tech block mb-1"
            style={{ color: 'var(--muted-foreground)' }}
          >
            URL DU DÉPÔT (optionnel)
          </label>
          <input
            id="proj-repo"
            type="url"
            value={repoUrl}
            onChange={e => setRepoUrl(e.target.value)}
            placeholder="https://github.com/..."
            className="w-full px-3 py-2 text-sm"
            style={{
              background: 'var(--input-background)',
              border: '1px solid var(--border)',
              color: 'var(--foreground)',
            }}
          />
        </div>

        <div>
          <label
            htmlFor="proj-dl"
            className="label-tech block mb-1"
            style={{ color: 'var(--muted-foreground)' }}
          >
            URL DE TÉLÉCHARGEMENT (optionnel)
          </label>
          <input
            id="proj-dl"
            type="url"
            value={downloadUrl}
            onChange={e => setDownloadUrl(e.target.value)}
            placeholder="https://itch.io/..."
            className="w-full px-3 py-2 text-sm"
            style={{
              background: 'var(--input-background)',
              border: '1px solid var(--border)',
              color: 'var(--foreground)',
            }}
          />
        </div>

        <button
          type="submit"
          disabled={isPending || !title.trim() || !description.trim()}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold disabled:opacity-40"
          style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
        >
          <Send size={14} aria-hidden="true" />
          {isPending ? 'Envoi en cours...' : 'Soumettre le projet'}
        </button>
      </form>
    </div>
  )
}
