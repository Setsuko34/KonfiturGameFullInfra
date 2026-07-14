'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, UserMinus, Check, X } from 'lucide-react'
import { renameTeam, removeMemberFromTeam, deleteTeam } from '@/lib/actions/teams'
import type { Team } from '@/types'

export default function AdminTeamActions({ team }: { team: Team }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(team.name)

  const run = (fn: () => Promise<{ success: boolean; error?: string }>) => {
    setError(null)
    startTransition(async () => {
      const res = await fn()
      if (!res.success) {
        setError(res.error ?? 'Une erreur est survenue.')
      } else {
        setRenaming(false)
        router.refresh()
      }
    })
  }

  return (
    <div className="mt-2 space-y-2">
      {error && (
        <p className="text-xs px-3 py-2" style={{ background: 'rgba(239,35,60,.1)', color: 'var(--secondary)' }} role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {renaming ? (
          <>
            <label htmlFor={`rename-${team.id}`} className="sr-only">Nouveau nom de l&apos;équipe</label>
            <input
              id={`rename-${team.id}`}
              value={name}
              onChange={e => setName(e.target.value)}
              className="px-3 min-h-11 text-sm border"
              style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
              disabled={isPending}
            />
            <button
              type="button"
              onClick={() => run(() => renameTeam(team.id, name))}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-3 min-h-11 text-xs font-medium border transition-opacity hover:opacity-80"
              style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
            >
              <Check size={13} aria-hidden="true" /> Valider
            </button>
            <button
              type="button"
              onClick={() => { setRenaming(false); setName(team.name); setError(null) }}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-3 min-h-11 text-xs font-medium border transition-opacity hover:opacity-80"
              style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
            >
              <X size={13} aria-hidden="true" /> Annuler
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setRenaming(true)}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-3 min-h-11 text-xs font-medium border transition-opacity hover:opacity-80"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            <Pencil size={13} aria-hidden="true" /> Renommer
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (confirm(`Dissoudre l'équipe "${team.name}" ? Tous ses membres seront retirés. Cette action est irréversible.`)) {
              run(() => deleteTeam(team.id))
            }
          }}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 px-3 min-h-11 text-xs font-medium border transition-opacity hover:opacity-80"
          style={{ borderColor: 'var(--secondary)', color: 'var(--secondary)' }}
        >
          <Trash2 size={13} aria-hidden="true" /> Dissoudre
        </button>
      </div>

      {team.members.length > 0 && (
        <ul className="space-y-1" role="list">
          {team.members.map(member => (
            <li key={member.id} className="flex items-center justify-between text-xs px-3 py-1.5 border"
              style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
              <span>
                {member.name}
                {member.isLeader && <span className="ml-2 font-semibold" style={{ color: 'var(--primary)' }}>LEADER</span>}
              </span>
              {!member.isLeader && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Retirer ${member.name} de l'équipe "${team.name}" ?`)) {
                      run(() => removeMemberFromTeam(member.id, team.id))
                    }
                  }}
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 px-3 min-h-11 font-medium transition-opacity hover:opacity-80"
                  style={{ color: 'var(--secondary)' }}
                >
                  <UserMinus size={13} aria-hidden="true" /> Retirer
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
