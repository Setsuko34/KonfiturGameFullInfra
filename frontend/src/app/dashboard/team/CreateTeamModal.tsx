'use client'

import { useState, useTransition } from 'react'
import { X, Plus } from 'lucide-react'
import { createTeam } from '@/lib/actions/teams'
import { useRouter } from 'next/navigation'

interface Jam {
  id: string
  title: string
  status: 'upcoming' | 'ongoing' | 'ended'
}

interface Props {
  leaderId: string
  leaderName: string
  availableJams: Jam[]
  onClose: () => void
}

export default function CreateTeamModal({ leaderId, leaderName, availableJams, onClose }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [jamId, setJamId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim().length < 3) {
      setError('Le nom doit faire au moins 3 caractères.')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await createTeam({
        name: name.trim(),
        leaderId,
        leaderName,
        jamId: jamId || undefined,
      })
      if (result.success) {
        router.refresh()
        onClose()
      } else {
        setError(result.error ?? 'Une erreur est survenue.')
      }
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-team-title"
    >
      <div
        className="w-full max-w-md p-6 border"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 id="create-team-title" className="text-lg font-bold">Créer une équipe</h2>
          <button onClick={onClose} aria-label="Fermer">
            <X size={18} style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>

        {error && (
          <p
            className="text-sm mb-4 px-3 py-2"
            style={{ background: 'rgba(239,35,60,.1)', color: 'var(--secondary)' }}
            role="alert"
          >
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="team-name" className="label-tech block mb-1" style={{ color: 'var(--muted-foreground)' }}>
              NOM DE L&apos;ÉQUIPE *
            </label>
            <input
              id="team-name"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              minLength={3}
              maxLength={64}
              className="w-full px-3 py-2 text-sm"
              style={{ background: 'var(--input-background)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
              placeholder="Pixel Crew..."
            />
          </div>

          <div>
            <label htmlFor="team-jam" className="label-tech block mb-1" style={{ color: 'var(--muted-foreground)' }}>
              JAM (optionnel, laisser vide pour créer une guilde)
            </label>
            <select
              id="team-jam"
              value={jamId}
              onChange={e => setJamId(e.target.value)}
              className="w-full px-3 py-2 text-sm"
              style={{ background: 'var(--input-background)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
            >
              <option value="">Guilde (sans jam)</option>
              {availableJams.map(jam => (
                <option key={jam.id} value={jam.id}>
                  {jam.title} ({jam.status === 'ongoing' ? 'En cours' : 'À venir'})
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isPending || name.trim().length < 3}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold disabled:opacity-40"
              style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              <Plus size={14} aria-hidden="true" />
              {isPending ? 'Création...' : 'Créer'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold"
              style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
