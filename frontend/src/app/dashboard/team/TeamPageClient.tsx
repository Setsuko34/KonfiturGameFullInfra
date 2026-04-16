'use client'

import { useState } from 'react'
import { Plus, LogIn, Users } from 'lucide-react'
import TeamCard from './TeamCard'
import CreateTeamModal from './CreateTeamModal'
import JoinTeamModal from './JoinTeamModal'
import type { Team, TeamMember, Project } from '@/types'

interface Jam {
  id: string
  title: string
  status: 'upcoming' | 'ongoing' | 'ended'
}

interface TeamContext {
  team: Team
  members: TeamMember[]
  isLeader: boolean
  jams: Jam[]
  projectsByJam: Record<string, Project | null>
}

interface Props {
  user: { id: string; name: string }
  teamsWithContext: TeamContext[]
  availableJams: Jam[]
}

export default function TeamPageClient({ user, teamsWithContext, availableJams }: Props) {
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
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold"
            style={{ background: 'var(--muted)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}
          >
            <LogIn size={14} aria-hidden="true" />
            Rejoindre
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            <Plus size={14} aria-hidden="true" />
            Créer une équipe
          </button>
        </div>
      </div>

      {teamsWithContext.length === 0 ? (
        <div
          className="p-10 border text-center"
          style={{ background: 'var(--card)', borderColor: 'var(--border)', borderStyle: 'dashed' }}
        >
          <Users size={36} className="mx-auto mb-3" style={{ color: 'var(--muted-foreground)' }} aria-hidden="true" />
          <p className="text-sm mb-5" style={{ color: 'var(--muted-foreground)' }}>
            Tu n&apos;appartiens à aucune équipe pour le moment.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold"
              style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              <Plus size={14} aria-hidden="true" />
              Créer une équipe
            </button>
            <button
              onClick={() => setShowJoin(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold"
              style={{ background: 'var(--muted)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}
            >
              <LogIn size={14} aria-hidden="true" />
              Rejoindre via code
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {teamsWithContext.map(({ team, members, isLeader, jams, projectsByJam }) => {
            const teamJamIds = new Set(team.jamIds)
            const availableJamsToRegister = availableJams.filter(j => !teamJamIds.has(j.id))

            return (
              <TeamCard
                key={team.id}
                team={team}
                members={members}
                isLeader={isLeader}
                currentUserId={user.id}
                jams={jams}
                projectsByJam={projectsByJam}
                availableJamsToRegister={availableJamsToRegister}
              />
            )
          })}
        </div>
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
