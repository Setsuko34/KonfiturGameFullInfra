import type { Metadata } from 'next'
import { Search } from 'lucide-react'
import { listAllTeams } from '@/lib/actions/admin'
import AdminTeamActions from '@/app/admin/jams/[jamId]/AdminTeamActions'

export const metadata: Metadata = { title: 'Équipes' }

type Props = { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }

export default async function AdminTeamsPage({ searchParams }: Props) {
  const sp = await searchParams
  const page = Math.max(0, parseInt(String(Array.isArray(sp.page) ? sp.page[0] : (sp.page ?? '0')), 10) || 0)
  const search = (Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? ''
  const teams = await listAllTeams(search, page)

  return (
    <div>
      <a href="#main-content" className="sr-only focus:not-sr-only">Aller au contenu principal</a>

      <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'var(--font-mono)' }}>
        Équipes
      </h1>
      <p className="text-sm mb-8" style={{ color: 'var(--muted-foreground)' }}>
        Gestion des équipes et guildes — renommer, retirer un membre, dissoudre. Actions journalisées.
      </p>

      {/* Recherche */}
      <form method="GET" className="flex gap-2 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true"
            style={{ color: 'var(--muted-foreground)' }} />
          <label htmlFor="search-teams" className="sr-only">Rechercher une équipe</label>
          <input
            id="search-teams"
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Rechercher par nom..."
            className="w-full pl-9 pr-4 py-2 text-sm border bg-transparent outline-none focus-visible:ring-2"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80 min-h-11"
          style={{ background: 'var(--primary)', color: '#fff' }}
        >
          Rechercher
        </button>
      </form>

      {/* Liste */}
      {teams.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          {search ? `Aucune équipe trouvée pour « ${search} ».` : 'Aucune équipe.'}
        </p>
      ) : (
        <ul className="space-y-3" role="list">
          {teams.map(team => (
            <li key={team.id}
              className="p-4 border"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{team.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                    {team.members.length} membre{team.members.length !== 1 ? 's' : ''}
                    {' · '}{team.jamIds.length === 0 ? 'Guilde (aucune jam)' : `${team.jamIds.length} jam(s)`}
                    {' · '}Code : {team.inviteCode}
                  </p>
                </div>
              </div>
              <AdminTeamActions team={team} />
            </li>
          ))}
        </ul>
      )}

      {/* Pagination */}
      <div className="flex gap-2 mt-6">
        {page > 0 && (
          <a href={`/admin/teams?page=${page - 1}${search ? `&q=${encodeURIComponent(search)}` : ''}`}
            className="px-3 py-1.5 text-xs border min-h-11 inline-flex items-center" style={{ borderColor: 'var(--border)' }}>
            ← Précédent
          </a>
        )}
        {teams.length === 25 && (
          <a href={`/admin/teams?page=${page + 1}${search ? `&q=${encodeURIComponent(search)}` : ''}`}
            className="px-3 py-1.5 text-xs border min-h-11 inline-flex items-center" style={{ borderColor: 'var(--border)' }}>
            Suivant →
          </a>
        )}
      </div>
    </div>
  )
}
