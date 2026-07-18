'use client'

import { useState, useTransition } from 'react'
import { Plus, LogIn, UserPlus, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { registerTeamToJam } from '@/lib/actions/teams'
import { useRouter } from 'next/navigation'
import type { Team } from '@/types'
import CreateTeamModal from '../../dashboard/team/CreateTeamModal'
import JoinTeamModal from '../../dashboard/team/JoinTeamModal'

interface Jam {
  id: string
  title: string
  status: 'upcoming' | 'ongoing' | 'ended'
}

interface Props {
  jamId: string
  jamTitle: string
  jamStatus: 'upcoming' | 'ongoing' | 'ended'
  startDate: Date
  teams: Team[]
  currentUser: { id: string; name: string } | null
  userTeamInThisJam: Team | null
  leaderTeamsNotInJam: { id: string; name: string }[]
}

export default function JamTeamsSection({
  jamId,
  jamTitle,
  jamStatus,
  startDate,
  teams,
  currentUser,
  userTeamInThisJam,
  leaderTeamsNotInJam,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [registerTeamId, setRegisterTeamId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleRegister = () => {
    if (!registerTeamId || !currentUser) return
    startTransition(async () => {
      const res = await registerTeamToJam(registerTeamId, jamId)
      if (!res.success) setError(res.error ?? 'Erreur')
      else { setRegisterTeamId(''); router.refresh() }
    })
  }

  const [now] = useState(() => Date.now())
  const canAct = currentUser && !userTeamInThisJam && now < startDate.getTime()

  return (
    <section id="teams" aria-labelledby="teams-heading">
      <details open>
        <summary className="flex items-center justify-between gap-2 mb-4 min-h-11 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <h2 id="teams-heading" className="text-xl font-bold">
            Équipes ({teams.length})
          </h2>
          <ChevronDown
            size={20}
            className="chevron transition-transform duration-200 flex-shrink-0"
            style={{ color: 'var(--muted-foreground)' }}
            aria-hidden="true"
          />
        </summary>

        {/* Actions pour l'user connecté sans team dans cette jam */}
        {canAct && (
          <div
            className="p-4 border mb-5 space-y-3"
            style={{ background: 'var(--card)', borderColor: 'var(--primary)', borderLeft: '3px solid var(--primary)' }}
          >
            <p className="text-sm font-semibold">Participe à cette jam !</p>

            {error && (
              <p className="text-sm px-3 py-2" style={{ background: 'rgba(239,35,60,.1)', color: 'var(--secondary)' }} role="alert">
                {error}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold"
                style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                <Plus size={13} aria-hidden="true" />
                Créer une équipe
              </button>
              <button
                onClick={() => setShowJoin(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold"
                style={{ background: 'var(--muted)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}
              >
                <LogIn size={13} aria-hidden="true" />
                Rejoindre via code
              </button>
            </div>

            {leaderTeamsNotInJam.length > 0 && (
              <div className="flex gap-2">
                <select
                  value={registerTeamId}
                  onChange={e => setRegisterTeamId(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm"
                  style={{ background: 'var(--input-background)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                  aria-label="Inscrire une de mes équipes"
                >
                  <option value="">Inscrire une de mes équipes...</option>
                  {leaderTeamsNotInJam.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <button
                  onClick={handleRegister}
                  disabled={isPending || !registerTeamId}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold disabled:opacity-40"
                  style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                >
                  <UserPlus size={13} aria-hidden="true" />
                  Inscrire
                </button>
              </div>
            )}
          </div>
        )}

        {/* Team de l'user dans cette jam */}
        {userTeamInThisJam && (
          <div
            className="p-4 border mb-5"
            style={{ background: 'var(--card)', borderColor: 'var(--primary)', borderLeft: '3px solid var(--primary)' }}
          >
            <p className="label-tech mb-1" style={{ color: 'var(--primary)' }}>TON ÉQUIPE</p>
            <p className="font-bold">{userTeamInThisJam.name}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {userTeamInThisJam.members.length} membre{userTeamInThisJam.members.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}

        {/* Liste de toutes les équipes */}
        {teams.length > 0 ? (
          <div className="space-y-3">
            {teams.map(team => (
              <div
                key={team.id}
                className="p-4 border flex items-center justify-between"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <div>
                  <p className="font-semibold">{team.name}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                    {team.members.length} membre{team.members.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <Link
                  href={`/team/${team.id}`}
                  className="text-xs font-semibold px-3 py-1.5"
                  style={{ background: 'var(--muted)', color: 'var(--primary)', border: '1px solid var(--border)' }}
                >
                  Voir
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Aucune équipe inscrite pour l&apos;instant.
          </p>
        )}
      </details>

      {showCreate && currentUser && (
        <CreateTeamModal
          leaderId={currentUser.id}
          leaderName={currentUser.name}
          availableJams={[{ id: jamId, title: jamTitle, status: jamStatus }]}
          onClose={() => setShowCreate(false)}
        />
      )}
      {showJoin && currentUser && (
        <JoinTeamModal
          userId={currentUser.id}
          userName={currentUser.name}
          onClose={() => setShowJoin(false)}
        />
      )}
    </section>
  )
}
