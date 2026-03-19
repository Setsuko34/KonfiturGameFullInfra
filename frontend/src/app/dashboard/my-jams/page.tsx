import { getUserOrganizedJams } from '@/lib/actions/dashboard'
import Link from 'next/link'
import { Plus, ArrowRight, Gamepad2 } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Mes jams' }

const STATUS_LABEL: Record<string, string> = {
  upcoming: 'À venir',
  ongoing: 'En cours',
  ended: 'Terminée',
}

export default async function MyJamsPage() {
  const jams = await getUserOrganizedJams()

  return (
    <section aria-labelledby="my-jams-heading">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[9px] tracking-widest uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
            Organisateur
          </p>
          <h1 id="my-jams-heading" className="text-2xl font-bold">Mes jams</h1>
        </div>
        <Link
          href="/dashboard/my-jams/new"
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold"
          style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
        >
          <Plus size={15} aria-hidden="true" />
          Créer une jam
        </Link>
      </div>

      {jams.length === 0 ? (
        <div
          className="p-8 border text-center"
          style={{ background: 'var(--card)', borderColor: 'var(--border)', borderStyle: 'dashed' }}
        >
          <Gamepad2 size={32} className="mx-auto mb-3" style={{ color: 'var(--muted-foreground)' }} aria-hidden="true" />
          <p className="text-sm mb-4" style={{ color: 'var(--muted-foreground)' }}>
            Tu n&apos;as pas encore créé de jam.
          </p>
          <Link
            href="/dashboard/my-jams/new"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            <Plus size={14} aria-hidden="true" /> Créer ma première jam
          </Link>
        </div>
      ) : (
        <div className="border" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full text-sm" role="table">
            <thead>
              <tr style={{ background: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
                <th className="px-4 py-3 text-left text-[9px] tracking-widest uppercase font-semibold" style={{ color: 'var(--muted-foreground)' }}>Jam</th>
                <th className="px-4 py-3 text-left text-[9px] tracking-widest uppercase font-semibold" style={{ color: 'var(--muted-foreground)' }}>Statut</th>
                <th className="px-4 py-3 text-left text-[9px] tracking-widest uppercase font-semibold hidden md:table-cell" style={{ color: 'var(--muted-foreground)' }}>Fin</th>
                <th className="px-4 py-3 text-right text-[9px] tracking-widest uppercase font-semibold" style={{ color: 'var(--muted-foreground)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jams.map((jam, i) => (
                <tr
                  key={jam.id}
                  style={{
                    background: i % 2 === 0 ? 'var(--card)' : 'var(--background)',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold">{jam.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--primary)' }}>Thème : {jam.theme}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-[9px] tracking-widest uppercase px-2 py-1"
                      style={{
                        background: jam.status === 'ongoing' ? 'rgba(239,35,60,.1)' : 'var(--muted)',
                        color: jam.status === 'ongoing' ? 'var(--secondary)' : 'var(--muted-foreground)',
                      }}
                    >
                      {STATUS_LABEL[jam.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell" style={{ color: 'var(--muted-foreground)' }}>
                    {jam.endDate.toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/dashboard/my-jams/${jam.id}`}
                      className="inline-flex items-center gap-1 text-sm font-semibold"
                      style={{ color: 'var(--primary)' }}
                    >
                      Gérer <ArrowRight size={13} aria-hidden="true" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

