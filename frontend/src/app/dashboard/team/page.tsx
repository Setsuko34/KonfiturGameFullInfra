import { getUserActiveTeam } from '@/lib/actions/dashboard'
import { getProjectById } from '@/lib/actions/projects'
import { Users } from 'lucide-react'
import type { Metadata } from 'next'
import SubmitProjectForm from './SubmitProjectForm'

export const metadata: Metadata = { title: 'Mon équipe' }

const ROLE_LABELS: Record<string, string> = {
  dev: 'Développeur',
  artist: 'Artiste',
  sound: 'Sound designer',
  designer: 'Designer',
  writer: 'Scénariste',
}

export default async function TeamPage() {
  const { team, members } = await getUserActiveTeam()
  const existingProject = team?.projectId
    ? await getProjectById(team.projectId)
    : null

  return (
    <section aria-labelledby="team-heading">
      <p className="text-[9px] tracking-widest uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
        Participant
      </p>
      <h1 id="team-heading" className="text-2xl font-bold mb-6">Mon équipe</h1>

      {!team ? (
        <div
          className="p-8 border text-center"
          style={{ background: 'var(--card)', borderColor: 'var(--border)', borderStyle: 'dashed' }}
        >
          <Users size={32} className="mx-auto mb-3" style={{ color: 'var(--muted-foreground)' }} aria-hidden="true" />
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Tu n&apos;appartiens à aucune équipe pour le moment.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Infos équipe */}
          <div className="p-6 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <h2 className="text-xl font-bold mb-1">{team.name}</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--muted-foreground)' }}>
              {members.length} membre{members.length > 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-3">
              <span className="text-[9px] tracking-widest uppercase" style={{ color: 'var(--muted-foreground)' }}>
                Code d&apos;invitation
              </span>
              <code
                className="px-3 py-1.5 font-mono text-sm font-bold"
                style={{ background: 'var(--muted)', color: 'var(--foreground)' }}
              >
                {team.inviteCode}
              </code>
            </div>
          </div>

          {/* Membres */}
          <div>
            <h2 className="text-base font-bold mb-3">Membres</h2>
            <ul className="space-y-2" role="list">
              {members.map(member => (
                <li
                  key={member.id}
                  className="flex items-center justify-between px-4 py-3 border"
                  style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 flex items-center justify-center font-bold text-sm"
                      style={{ background: 'var(--muted)', color: 'var(--foreground)' }}
                      aria-hidden="true"
                    >
                      {member.name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{member.name}</p>
                      {member.isLeader && (
                        <p className="text-[9px] tracking-widest uppercase" style={{ color: 'var(--primary)' }}>
                          Chef d&apos;équipe
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    {ROLE_LABELS[member.role] ?? member.role}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Soumission de projet */}
          <SubmitProjectForm
            jamId={team.jamId}
            teamId={team.id}
            existingProject={existingProject}
          />
        </div>
      )}
    </section>
  )
}

