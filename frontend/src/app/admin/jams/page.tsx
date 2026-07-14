import type { Metadata } from 'next'
import Link from 'next/link'
import { Star } from 'lucide-react'
import { listAllJams, toggleJamFeatured } from '@/lib/actions/admin'
import { DeleteJamButton } from './DeleteJamButton'

export const metadata: Metadata = { title: 'Jams' }

type Props = { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }

const STATUS_LABELS: Record<string, string> = {
  upcoming: 'À venir',
  ongoing: 'En cours',
  ended: 'Terminée',
}

export default async function AdminJamsPage({ searchParams }: Props) {
  const sp = await searchParams
  const status = Array.isArray(sp.status) ? sp.status[0] : sp.status
  const pageParam = Array.isArray(sp.page) ? sp.page[0] : sp.page
  const page = Math.max(0, parseInt(pageParam ?? '0', 10) || 0)
  const jams = await listAllJams(status, page)

  const filters = [
    { label: 'Toutes', value: undefined },
    { label: 'À venir', value: 'upcoming' },
    { label: 'En cours', value: 'ongoing' },
    { label: 'Terminées', value: 'ended' },
  ]

  return (
    <div>
      <a href="#main-content" className="sr-only focus:not-sr-only">Aller au contenu principal</a>

      <h1 className="text-2xl font-bold mb-6" style={{ fontFamily: 'var(--font-mono)' }}>
        Jams
      </h1>

      {/* Filtres */}
      <div className="flex gap-2 mb-6">
        {filters.map(f => {
          const href = f.value ? `/admin/jams?status=${f.value}` : '/admin/jams'
          const active = status === f.value || (!status && !f.value)
          return (
            <Link
              key={f.label}
              href={href}
              className="px-3 py-1.5 text-xs font-medium border transition-opacity hover:opacity-80"
              style={{
                background: active ? 'var(--primary)' : 'transparent',
                borderColor: active ? 'var(--primary)' : 'var(--border)',
                color: active ? '#fff' : 'var(--muted-foreground)',
              }}
            >
              {f.label}
            </Link>
          )
        })}
      </div>

      {jams.length === 0 ? (
        <p style={{ color: 'var(--muted-foreground)' }}>Aucune jam trouvée.</p>
      ) : (
        <div className="border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--muted-foreground)' }}>Titre</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell" style={{ color: 'var(--muted-foreground)' }}>Statut</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell" style={{ color: 'var(--muted-foreground)' }}>Fin</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--muted-foreground)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jams.map(jam => (
                <tr key={jam.id} className="border-b" style={{ borderColor: 'var(--border)' }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {jam.featured && (
                        <Star size={12} style={{ color: 'var(--primary)' }} aria-label="Mise en avant" />
                      )}
                      <Link
                        href={`/jam/${jam.id}`}
                        className="font-medium hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {jam.title}
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span
                      className="text-xs px-2 py-0.5 uppercase tracking-widest"
                      style={{
                        background: jam.status === 'ongoing' ? 'rgba(79, 106, 255, 0.15)'
                          : jam.status === 'ended' ? 'rgba(255,255,255,0.05)'
                          : 'rgba(255, 200, 0, 0.1)',
                        color: jam.status === 'ongoing' ? 'var(--primary)'
                          : jam.status === 'ended' ? 'var(--muted-foreground)'
                          : '#ffc800',
                      }}
                    >
                      {STATUS_LABELS[jam.status] ?? jam.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell" style={{ color: 'var(--muted-foreground)' }}>
                    {jam.endDate.toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <Link
                        href={`/admin/jams/${jam.id}`}
                        className="text-sm underline"
                        style={{ color: 'var(--primary)' }}
                      >
                        Gérer
                      </Link>
                      {/* Featured toggle */}
                      <form action={async () => {
                        'use server'
                        await toggleJamFeatured(jam.id, !jam.featured, jam.featuredOrder)
                      }}>
                        <button
                          type="submit"
                          title={jam.featured ? 'Retirer de la mise en avant' : 'Mettre en avant'}
                          className="p-1.5 border transition-opacity hover:opacity-80"
                          style={{
                            borderColor: jam.featured ? 'var(--primary)' : 'var(--border)',
                            color: jam.featured ? 'var(--primary)' : 'var(--muted-foreground)',
                          }}
                        >
                          <Star size={13} aria-hidden="true" />
                        </button>
                      </form>
                      {/* Suppression avec confirmation (composant client) */}
                      <DeleteJamButton jamId={jam.id} jamTitle={jam.title} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
