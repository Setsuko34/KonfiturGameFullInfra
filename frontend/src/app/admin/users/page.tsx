import type { Metadata } from 'next'
import { Shield, ShieldOff, Search } from 'lucide-react'
import { listUsers, blockUser, unblockUser } from '@/lib/actions/admin'

export const metadata: Metadata = { title: 'Utilisateurs' }

type Props = { searchParams: { [key: string]: string | string[] | undefined } }

export default async function AdminUsersPage({ searchParams }: Props) {
  const page = Math.max(0, parseInt(String(Array.isArray(searchParams.page) ? searchParams.page[0] : (searchParams.page ?? '0')), 10) || 0)
  const search = (Array.isArray(searchParams.q) ? searchParams.q[0] : searchParams.q) ?? ''
  const result = await listUsers(page, search)

  return (
    <div>
      <a href="#main-content" className="sr-only focus:not-sr-only">Aller au contenu principal</a>

      <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'var(--font-mono)' }}>
        Utilisateurs
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
        {result.total} utilisateurs inscrits
      </p>

      {/* Recherche */}
      <form method="GET" className="flex gap-2 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true"
            style={{ color: 'var(--muted-foreground)' }} />
          <label htmlFor="search-users" className="sr-only">Rechercher un utilisateur</label>
          <input
            id="search-users"
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Rechercher par nom..."
            className="w-full pl-9 pr-4 py-2 text-sm border bg-transparent outline-none focus-visible:ring-2"
            style={{
              borderColor: 'var(--border)',
              color: 'var(--foreground)',
            }}
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
          style={{ background: 'var(--primary)', color: '#fff' }}
        >
          Rechercher
        </button>
      </form>

      {/* Tableau */}
      <div className="border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--muted-foreground)' }}>Nom</th>
              <th className="text-left px-4 py-3 font-medium hidden md:table-cell" style={{ color: 'var(--muted-foreground)' }}>Email</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--muted-foreground)' }}>Statut</th>
              <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--muted-foreground)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {result.users.map(u => (
              <tr key={u.$id} className="border-b" style={{ borderColor: 'var(--border)' }}>
                <td className="px-4 py-3 font-medium">{u.name || '—'}</td>
                <td className="px-4 py-3 hidden md:table-cell" style={{ color: 'var(--muted-foreground)' }}>
                  {u.email}
                </td>
                <td className="px-4 py-3">
                  <span
                    className="text-xs px-2 py-0.5 uppercase tracking-widest"
                    style={{
                      background: u.status ? 'rgba(79, 106, 255, 0.15)' : 'rgba(239, 35, 60, 0.15)',
                      color: u.status ? 'var(--primary)' : 'var(--secondary)',
                    }}
                  >
                    {u.status ? 'Actif' : 'Bloqué'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <form action={u.status ? blockUser.bind(null, u.$id) : unblockUser.bind(null, u.$id)}>
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border ml-auto transition-opacity hover:opacity-80"
                      style={{
                        borderColor: u.status ? 'var(--secondary)' : 'var(--border)',
                        color: u.status ? 'var(--secondary)' : 'var(--muted-foreground)',
                      }}
                    >
                      {u.status
                        ? <><ShieldOff size={12} aria-hidden="true" /> Bloquer</>
                        : <><Shield size={12} aria-hidden="true" /> Débloquer</>
                      }
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {result.total > 25 && (
        <div className="flex gap-2 mt-4 justify-end">
          {page > 0 && (
            <a
              href={`/admin/users?page=${page - 1}${search ? `&q=${encodeURIComponent(search)}` : ''}`}
              className="px-3 py-1.5 text-sm border transition-opacity hover:opacity-80"
              style={{ borderColor: 'var(--border)' }}
            >
              Précédent
            </a>
          )}
          {(page + 1) * 25 < result.total && (
            <a
              href={`/admin/users?page=${page + 1}${search ? `&q=${encodeURIComponent(search)}` : ''}`}
              className="px-3 py-1.5 text-sm border transition-opacity hover:opacity-80"
              style={{ borderColor: 'var(--border)' }}
            >
              Suivant
            </a>
          )}
        </div>
      )}
    </div>
  )
}
