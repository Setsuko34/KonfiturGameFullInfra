'use client'

import { useState, useMemo } from 'react'
import { SlidersHorizontal, Search, X } from 'lucide-react'
import JamCard from '@/components/JamCard'
import EmptyState from '@/components/EmptyState'
import type { GameJam } from '@/types'

type StatusFilter = 'all' | 'ongoing' | 'upcoming' | 'ended'
type TypeFilter = 'all' | 'solo' | 'team' | 'both'

const statusLabels: Record<StatusFilter, string> = {
  all: 'Tous les statuts',
  ongoing: 'En cours',
  upcoming: 'À venir',
  ended: 'Terminés',
}

const typeLabels: Record<TypeFilter, string> = {
  all: 'Tous les types',
  solo: 'Solo',
  team: 'Équipe',
  both: 'Solo & Équipe',
}

interface Props {
  jams: GameJam[]
}

export default function ExploreGrid({ jams }: Props) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [filtersOpen, setFiltersOpen] = useState(false)

  const filteredJams = useMemo<GameJam[]>(() => {
    return jams.filter(jam => {
      const matchSearch = !search ||
        jam.title.toLowerCase().includes(search.toLowerCase()) ||
        jam.theme.toLowerCase().includes(search.toLowerCase()) ||
        jam.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()))
      const matchStatus = statusFilter === 'all' || jam.status === statusFilter
      const matchType = typeFilter === 'all' || jam.type === typeFilter
      return matchSearch && matchStatus && matchType
    })
  }, [jams, search, statusFilter, typeFilter])

  const hasActiveFilters = statusFilter !== 'all' || typeFilter !== 'all' || search !== ''

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setTypeFilter('all')
  }

  return (
    <>
      {/* Barre de recherche */}
      <div
        className="border-b px-4 sm:px-6 lg:px-8 py-4"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="max-w-7xl mx-auto flex gap-3">
          <div className="relative flex-1 max-w-lg">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--muted-foreground)' }}
              aria-hidden="true"
            />
            <label htmlFor="search-jams" className="sr-only">
              Rechercher une jam
            </label>
            <input
              id="search-jams"
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par titre, thème, tag..."
              className="w-full pl-10 pr-4 py-2.5 text-sm"
              style={{
                background: 'var(--input-background)',
                border: '1px solid var(--border)',
                color: 'var(--foreground)',
              }}
              aria-label="Rechercher une jam"
            />
          </div>

          {/* Toggle filtres mobile */}
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="md:hidden flex items-center gap-2 px-4 py-2.5 text-sm font-semibold"
            style={{
              border: '1px solid var(--border)',
              background: filtersOpen ? 'var(--surface-elevated)' : 'var(--card)',
              color: 'var(--foreground)',
            }}
            aria-expanded={filtersOpen}
            aria-controls="filters-panel"
          >
            <SlidersHorizontal size={15} aria-hidden="true" />
            Filtres
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar filtres */}
          <aside
            id="filters-panel"
            className={`md:w-56 flex-shrink-0 ${filtersOpen ? 'block' : 'hidden md:block'}`}
            aria-label="Filtres de recherche"
          >
            <div className="space-y-6">
              {/* Filtre statut */}
              <fieldset>
                <legend
                  className="label-tech mb-3"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  STATUT
                </legend>
                <div className="space-y-2" role="group" aria-labelledby="status-legend">
                  {(Object.keys(statusLabels) as StatusFilter[]).map(s => (
                    <label
                      key={s}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="status"
                        value={s}
                        checked={statusFilter === s}
                        onChange={() => setStatusFilter(s)}
                        className="sr-only"
                      />
                      <div
                        className="w-4 h-4 flex items-center justify-center border"
                        style={{
                          borderColor: statusFilter === s ? 'var(--primary)' : 'var(--border)',
                          background: statusFilter === s ? 'var(--primary)' : 'transparent',
                        }}
                        aria-hidden="true"
                      >
                        {statusFilter === s && (
                          <div className="w-2 h-2" style={{ background: 'white' }} />
                        )}
                      </div>
                      <span className="text-sm" style={{ color: 'var(--foreground)' }}>
                        {statusLabels[s]}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {/* Filtre type */}
              <fieldset>
                <legend
                  className="label-tech mb-3"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  TYPE
                </legend>
                <div className="space-y-2">
                  {(Object.keys(typeLabels) as TypeFilter[]).map(t => (
                    <label key={t} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="type"
                        value={t}
                        checked={typeFilter === t}
                        onChange={() => setTypeFilter(t)}
                        className="sr-only"
                      />
                      <div
                        className="w-4 h-4 flex items-center justify-center border"
                        style={{
                          borderColor: typeFilter === t ? 'var(--primary)' : 'var(--border)',
                          background: typeFilter === t ? 'var(--primary)' : 'transparent',
                        }}
                        aria-hidden="true"
                      >
                        {typeFilter === t && (
                          <div className="w-2 h-2" style={{ background: 'white' }} />
                        )}
                      </div>
                      <span className="text-sm" style={{ color: 'var(--foreground)' }}>
                        {typeLabels[t]}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {/* Réinitialiser */}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-2 text-sm font-semibold"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  <X size={13} aria-hidden="true" />
                  Réinitialiser les filtres
                </button>
              )}
            </div>
          </aside>

          {/* Grille de résultats */}
          <div className="flex-1 min-w-0">
            {/* Compteur */}
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                <span className="font-semibold" style={{ color: 'var(--foreground)' }}>
                  {filteredJams.length}
                </span>{' '}
                jam{filteredJams.length !== 1 ? 's' : ''} trouvée{filteredJams.length !== 1 ? 's' : ''}
              </p>
            </div>

            {filteredJams.length > 0 ? (
              <div
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3"
                aria-label="Liste des game jams"
              >
                {filteredJams.map(jam => (
                  <JamCard key={jam.id} jam={jam} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Search}
                title="Aucune jam trouvée"
                subtitle="Essayez de modifier vos filtres ou votre recherche."
                action={
                  <button
                    onClick={clearFilters}
                    className="px-4 py-2 text-sm font-semibold"
                    style={{
                      background: 'var(--primary)',
                      color: 'var(--primary-foreground)',
                    }}
                  >
                    Réinitialiser les filtres
                  </button>
                }
              />
            )}
          </div>
        </div>
      </div>
    </>
  )
}
