'use client'

import { useState, useTransition } from 'react'
import { X, LogIn } from 'lucide-react'
import { joinTeamByCode } from '@/lib/actions/teams'
import { useRouter } from 'next/navigation'

interface Props {
  userId: string
  userName: string
  onClose: () => void
}

const ROLES = [
  { value: 'dev', label: 'Développeur' },
  { value: 'artist', label: 'Artiste' },
  { value: 'sound', label: 'Sound designer' },
  { value: 'designer', label: 'Designer' },
  { value: 'writer', label: 'Scénariste' },
]

export default function JoinTeamModal({ userId, userName, onClose }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [code, setCode] = useState('')
  const [role, setRole] = useState('dev')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await joinTeamByCode(code.trim().toUpperCase(), userId, role, userName)
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
      aria-labelledby="join-team-title"
    >
      <div
        className="w-full max-w-md p-6 border"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 id="join-team-title" className="text-lg font-bold">Rejoindre via code</h2>
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
            <label htmlFor="invite-code" className="label-tech block mb-1" style={{ color: 'var(--muted-foreground)' }}>
              CODE D&apos;INVITATION *
            </label>
            <input
              id="invite-code"
              required
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="KG-XXXXXXXX"
              className="w-full px-3 py-2 text-sm font-mono"
              style={{ background: 'var(--input-background)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
            />
          </div>

          <div>
            <label htmlFor="join-role" className="label-tech block mb-1" style={{ color: 'var(--muted-foreground)' }}>
              TON RÔLE
            </label>
            <select
              id="join-role"
              value={role}
              onChange={e => setRole(e.target.value)}
              className="w-full px-3 py-2 text-sm"
              style={{ background: 'var(--input-background)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
            >
              {ROLES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isPending || !code.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold disabled:opacity-40"
              style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              <LogIn size={14} aria-hidden="true" />
              {isPending ? 'Connexion...' : 'Rejoindre'}
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
