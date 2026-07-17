import Link from 'next/link'
import { ArrowRight, UsersRound } from 'lucide-react'

export interface TeamsWidgetTeam {
  id: string
  name: string
  membersCount: number
  activeJams: number
  inviteCode: string
}

export default function TeamsWidget({ teams }: { teams: TeamsWidgetTeam[] }) {
  return (
    <section className="p-5 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>
          Mes équipes
        </h2>
        <Link
          href="/dashboard/team"
          className="flex items-center gap-1 text-xs min-h-11 transition-opacity hover:opacity-80"
          style={{ color: 'var(--primary)' }}
        >
          Gérer <ArrowRight size={12} aria-hidden="true" />
        </Link>
      </div>

      {teams.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Vous n&apos;avez pas encore d&apos;équipe.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {teams.map(team => (
            <li key={team.id} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <UsersRound size={14} aria-hidden="true" style={{ color: 'var(--primary)' }} />
                <span className="text-sm font-semibold truncate">{team.name}</span>
              </div>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {team.membersCount} membre{team.membersCount > 1 ? 's' : ''} · {team.activeJams} jam{team.activeJams > 1 ? 's' : ''} active{team.activeJams > 1 ? 's' : ''}
              </p>
              <p className="text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted-foreground)' }}>
                Code : {team.inviteCode}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
