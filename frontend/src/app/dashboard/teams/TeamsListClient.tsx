'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, LogIn, Users, ChevronRight } from 'lucide-react'
import CreateTeamModal from './CreateTeamModal'
import JoinTeamModal from './JoinTeamModal'

interface Jam {
  id: string
  title: string
  status: 'upcoming' | 'ongoing' | 'ended'
}

interface TeamSummary {
  id: string
  name: string
  isSolo: boolean
  membersCount: number
  activeJams: number
  isLeader: boolean
}

interface Props {
  user: { id: string; name: string }
  teams: TeamSummary[]
  availableJams: Jam[]
}

export default function TeamsListClient({ user, teams, availableJams }: Props) {
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)

  return (
    <section aria-labelledby="teams-heading">
      <p className="text-[9px] tracking-widest uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
        Participant
      </p>
      <div className="flex items-center justify-between mb-6">
        <h1 id="teams-heading" className="text-2xl font-bold">Mes équipes</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowJoin(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold min-h-11"
            style={{ background: 'var(--muted)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}
          >
            <LogIn size={14} aria-hidden="true" />
            Rejoindre
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold min-h-11"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            <Plus size={14} aria-hidden="true" />
            Créer une équipe
          </button>
        </div>
      </div>

      {teams.length === 0 ? (
        <div
          className="p-10 border text-center"
          style={{ background: 'var(--card)', borderColor: 'var(--border)', borderStyle: 'dashed' }}
        >
          <Users size={36} className="mx-auto mb-3" style={{ color: 'var(--muted-foreground)' }} aria-hidden="true" />
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Tu n&apos;appartiens à aucune équipe pour le moment.
          </p>
        </div>
      ) : (
        <ul className="space-y-3" role="list">
          {teams.map(team => (
            <li key={team.id}>
              <Link
                href={`/team/${team.id}`}
                className="flex items-center gap-4 p-4 border transition-opacity hover:opacity-80"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <div
                  className="w-10 h-10 flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ background: 'var(--surface-elevated)', color: 'var(--foreground)' }}
                  aria-hidden="true"
                >
                  {team.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold truncate">{team.name}</p>
                    {team.isSolo && (
                      <span className="label-tech px-1.5 py-0.5" style={{ background: 'var(--muted)', color: 'var(--secondary)' }}>
                        SOLO
                      </span>
                    )}
                    {team.isLeader && !team.isSolo && (
                      <span className="label-tech px-1.5 py-0.5" style={{ background: 'var(--muted)', color: 'var(--primary)' }}>
                        LEADER
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                    {team.membersCount} membre{team.membersCount !== 1 ? 's' : ''}
                    {' · '}
                    {team.activeJams} jam{team.activeJams !== 1 ? 's' : ''}
                  </p>
                </div>
                <ChevronRight size={16} style={{ color: 'var(--muted-foreground)' }} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {showCreate && (
        <CreateTeamModal
          leaderId={user.id}
          leaderName={user.name}
          availableJams={availableJams}
          onClose={() => setShowCreate(false)}
        />
      )}
      {showJoin && (
        <JoinTeamModal
          userId={user.id}
          userName={user.name}
          onClose={() => setShowJoin(false)}
        />
      )}
    </section>
  )
}
