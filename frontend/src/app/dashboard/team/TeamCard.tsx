'use client'

import { useState, useTransition } from 'react'
import { Copy, Trash2, LogOut, UserPlus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { updateMemberRole, removeMemberFromTeam, deleteTeam, registerTeamToJam } from '@/lib/actions/teams'
import SubmitProjectForm from './SubmitProjectForm'
import type { Team, TeamMember, Project } from '@/types'

interface Jam {
  id: string
  title: string
  status: 'upcoming' | 'ongoing' | 'ended'
}

interface Props {
  team: Team
  members: TeamMember[]
  isLeader: boolean
  currentUserId: string
  jams: Jam[]
  projectsByJam: Record<string, Project | null>
  availableJamsToRegister: Jam[]
}

const ROLE_LABELS: Record<string, string> = {
  dev: 'Développeur',
  artist: 'Artiste',
  sound: 'Sound designer',
  designer: 'Designer',
  writer: 'Scénariste',
}

const ROLES = ['dev', 'artist', 'sound', 'designer', 'writer'] as const

export default function TeamCard({
  team,
  members,
  isLeader,
  currentUserId,
  jams,
  projectsByJam,
  availableJamsToRegister,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [registerJamId, setRegisterJamId] = useState('')

  const copyInviteCode = async () => {
    await navigator.clipboard.writeText(team.inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRoleChange = (memberId: string, role: string) => {
    startTransition(async () => {
      const res = await updateMemberRole(memberId, team.id, role as never, currentUserId)
      if (!res.success) setError(res.error ?? 'Erreur')
      else router.refresh()
    })
  }

  const handleRemoveMember = (memberId: string) => {
    startTransition(async () => {
      const res = await removeMemberFromTeam(memberId, team.id, currentUserId)
      if (!res.success) setError(res.error ?? 'Erreur')
      else router.refresh()
    })
  }

  const handleDeleteTeam = () => {
    startTransition(async () => {
      const res = await deleteTeam(team.id, currentUserId)
      if (!res.success) setError(res.error ?? 'Erreur')
      else router.refresh()
    })
  }

  const handleRegisterToJam = () => {
    if (!registerJamId) return
    startTransition(async () => {
      const res = await registerTeamToJam(team.id, registerJamId, currentUserId)
      if (!res.success) setError(res.error ?? 'Erreur')
      else { setRegisterJamId(''); router.refresh() }
    })
  }

  return (
    <div className="p-5 border space-y-5" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
      {/* En-tête */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold">{team.name}</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            {members.length} membre{members.length !== 1 ? 's' : ''}
          </p>
        </div>
        {isLeader && (
          <span className="label-tech px-2 py-1" style={{ background: 'var(--muted)', color: 'var(--primary)' }}>
            LEADER
          </span>
        )}
      </div>

      {error && (
        <p className="text-sm px-3 py-2" style={{ background: 'rgba(239,35,60,.1)', color: 'var(--secondary)' }} role="alert">
          {error}
        </p>
      )}

      {/* Code d'invitation (leader seulement) */}
      {isLeader && (
        <div className="flex items-center gap-3">
          <span className="label-tech" style={{ color: 'var(--muted-foreground)' }}>CODE</span>
          <code className="px-3 py-1.5 font-mono text-sm font-bold" style={{ background: 'var(--muted)', color: 'var(--foreground)' }}>
            {team.inviteCode}
          </code>
          <button
            onClick={copyInviteCode}
            className="flex items-center gap-1.5 px-2 py-1 text-xs"
            style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
            aria-label="Copier le code"
          >
            <Copy size={12} aria-hidden="true" />
            {copied ? 'Copié !' : 'Copier'}
          </button>
        </div>
      )}

      {/* Membres */}
      <div>
        <h3 className="label-tech mb-2" style={{ color: 'var(--muted-foreground)' }}>MEMBRES</h3>
        <ul className="space-y-2" role="list">
          {members.map(member => (
            <li
              key={member.id}
              className="flex items-center justify-between px-3 py-2 border"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 flex items-center justify-center text-xs font-bold"
                  style={{ background: 'var(--muted)', color: 'var(--foreground)' }}
                  aria-hidden="true"
                >
                  {member.name[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium">{member.name}</p>
                  {member.isLeader && (
                    <p className="text-[9px] tracking-widest uppercase" style={{ color: 'var(--primary)' }}>Chef</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isLeader && !member.isLeader ? (
                  <select
                    value={member.role}
                    onChange={e => handleRoleChange(member.id, e.target.value)}
                    disabled={isPending}
                    className="text-xs px-2 py-1"
                    style={{ background: 'var(--muted)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                    aria-label={`Rôle de ${member.name}`}
                  >
                    {ROLES.map(r => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    {ROLE_LABELS[member.role] ?? member.role}
                  </span>
                )}
                {!member.isLeader && (isLeader || member.userId === currentUserId) && (
                  <button
                    onClick={() => handleRemoveMember(member.id)}
                    disabled={isPending}
                    className="p-1 disabled:opacity-40"
                    style={{ color: 'var(--muted-foreground)' }}
                    aria-label={member.userId === currentUserId ? "Quitter l'équipe" : `Retirer ${member.name}`}
                  >
                    <LogOut size={13} aria-hidden="true" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Historique des jams */}
      {jams.length > 0 && (
        <div>
          <h3 className="label-tech mb-2" style={{ color: 'var(--muted-foreground)' }}>JAMS</h3>
          <ul className="space-y-1">
            {jams.map(jam => (
              <li key={jam.id} className="flex items-center justify-between text-sm">
                <span>{jam.title}</span>
                <span
                  className="label-tech"
                  style={{
                    color: jam.status === 'ongoing' ? 'var(--secondary)' : jam.status === 'upcoming' ? 'var(--primary)' : 'var(--muted-foreground)',
                  }}
                >
                  {jam.status === 'ongoing' ? 'EN COURS' : jam.status === 'upcoming' ? 'À VENIR' : 'TERMINÉE'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Soumission de projet pour les jams en cours */}
      {jams
        .filter(j => j.status === 'ongoing')
        .map(jam => (
          <SubmitProjectForm
            key={jam.id}
            jamId={jam.id}
            jamTitle={jam.title}
            teamId={team.id}
            existingProject={projectsByJam[jam.id] ?? null}
          />
        ))}

      {/* Inscrire à une jam */}
      {isLeader && availableJamsToRegister.length > 0 && (
        <div>
          <h3 className="label-tech mb-2" style={{ color: 'var(--muted-foreground)' }}>INSCRIRE À UNE JAM</h3>
          <div className="flex gap-2">
            <select
              value={registerJamId}
              onChange={e => setRegisterJamId(e.target.value)}
              className="flex-1 px-3 py-2 text-sm"
              style={{ background: 'var(--input-background)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
              aria-label="Choisir une jam"
            >
              <option value="">Choisir une jam...</option>
              {availableJamsToRegister.map(jam => (
                <option key={jam.id} value={jam.id}>
                  {jam.title}
                </option>
              ))}
            </select>
            <button
              onClick={handleRegisterToJam}
              disabled={isPending || !registerJamId}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold disabled:opacity-40"
              style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              <UserPlus size={13} aria-hidden="true" />
              Inscrire
            </button>
          </div>
        </div>
      )}

      {/* Supprimer l'équipe */}
      {isLeader && (
        <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
          {confirmDelete ? (
            <div className="flex items-center gap-3">
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Confirmer la suppression ?</p>
              <button
                onClick={handleDeleteTeam}
                disabled={isPending}
                className="px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                style={{ background: 'var(--secondary)', color: 'var(--primary-foreground)' }}
              >
                Supprimer
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-1.5 text-xs"
                style={{ color: 'var(--muted-foreground)' }}
              >
                Annuler
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 text-xs"
              style={{ color: 'var(--muted-foreground)' }}
            >
              <Trash2 size={12} aria-hidden="true" />
              Supprimer cette équipe
            </button>
          )}
        </div>
      )}
    </div>
  )
}
