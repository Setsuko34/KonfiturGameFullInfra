import type { Metadata } from 'next'
import Link from 'next/link'
import { Star, Trophy } from 'lucide-react'
import {
  listJamsForCuration,
  listProjectsForJam,
  toggleJamFeatured,
} from '@/lib/actions/admin'
import PlacementButtons from '@/components/PlacementButtons'

export const metadata: Metadata = { title: 'Mise en avant' }

type Props = { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }

export default async function AdminFeaturedPage({ searchParams }: Props) {
  const sp = await searchParams
  const selectedJamId = Array.isArray(sp.jam) ? sp.jam[0] : sp.jam
  const jams = await listJamsForCuration()
  const selectedJam = selectedJamId ? jams.find(j => j.id === selectedJamId) : null
  const projects = selectedJamId ? await listProjectsForJam(selectedJamId) : []
  const jamEnded = selectedJam ? selectedJam.endDate < new Date() : false

  return (
    <div>
      <a href="#main-content" className="sr-only focus:not-sr-only">Aller au contenu principal</a>

      <h1 className="text-2xl font-bold mb-8" style={{ fontFamily: 'var(--font-mono)' }}>
        Mise en avant
      </h1>

      {/* Section : Featured jams */}
      <section className="mb-10">
        <h2 className="text-base font-semibold mb-4 pb-2 border-b" style={{ borderColor: 'var(--border)' }}>
          Jams mises en avant
        </h2>
        <div className="space-y-2">
          {jams.map(jam => (
            <div
              key={jam.id}
              className="flex items-center justify-between p-3 border"
              style={{
                background: 'var(--card)',
                borderColor: jam.featured ? 'var(--primary)' : 'var(--border)',
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Star
                  size={14}
                  style={{ color: jam.featured ? 'var(--primary)' : 'var(--muted-foreground)', flexShrink: 0 }}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{jam.title}</p>
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    {jam.status} · {jam.endDate.toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Voir gagnants de cette jam */}
                <Link
                  href={`/admin/featured?jam=${jam.id}`}
                  className="px-2 py-1 text-xs border transition-opacity hover:opacity-80"
                  style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                >
                  Gagnants
                </Link>
                {/* Featured toggle */}
                <form action={async () => {
                  'use server'
                  await toggleJamFeatured(jam.id, !jam.featured, jam.featuredOrder)
                }}>
                  <button
                    type="submit"
                    className="px-2 py-1 text-xs border font-medium transition-opacity hover:opacity-80"
                    style={{
                      background: jam.featured ? 'var(--primary)' : 'transparent',
                      borderColor: jam.featured ? 'var(--primary)' : 'var(--border)',
                      color: jam.featured ? '#fff' : 'var(--muted-foreground)',
                    }}
                  >
                    {jam.featured ? 'Retirer' : 'Mettre en avant'}
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section : Gagnants de la jam sélectionnée */}
      {selectedJam && (
        <section>
          <h2 className="text-base font-semibold mb-1 pb-2 border-b" style={{ borderColor: 'var(--border)' }}>
            Gagnants ({selectedJam.title})
          </h2>
          <p className="text-xs mb-4" style={{ color: 'var(--muted-foreground)' }}>
            {projects.length} projet(s) soumis
          </p>
          {projects.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Aucun projet soumis pour cette jam.</p>
          ) : (
            <div className="space-y-2">
              {projects.map(project => (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-3 border"
                  style={{
                    background: 'var(--card)',
                    borderColor: project.placement ? 'var(--primary)' : 'var(--border)',
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Trophy
                      size={14}
                      style={{ color: project.placement ? 'var(--primary)' : 'var(--muted-foreground)', flexShrink: 0 }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{project.title}</p>
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        {project.technologies.slice(0, 3).join(', ')}
                      </p>
                    </div>
                  </div>
                  {jamEnded ? (
                    <PlacementButtons projectId={project.id} placement={project.placement ?? 0} />
                  ) : (
                    <span className="text-xs flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
                      Podium ouvrable après la fin de la jam
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
