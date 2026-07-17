import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/appwrite/server', () => ({
  serverDatabases: { listDocuments: vi.fn() },
}))
vi.mock('@/lib/actions/projects', () => ({
  getPopularProjects: vi.fn().mockResolvedValue([]),
}))

import { getHomePageData } from '@/lib/actions/home'
import { serverDatabases } from '@/lib/appwrite/server'

const mockList = vi.mocked(serverDatabases.listDocuments)

function doc(fields: Record<string, unknown>) {
  return {
    $id: fields.$id ?? 'x', $createdAt: '2026-01-01T00:00:00.000Z',
    $updatedAt: '2026-01-01T00:00:00.000Z', $permissions: [],
    $collectionId: 'c', $databaseId: 'konfitur-db', ...fields,
  }
}

// Extrait les valeurs d'un Query.equal(attribute, ...) au sein du tableau de requêtes sérialisées.
function equalValues(queries: string[], attribute: string): string[] {
  for (const q of queries) {
    const parsed = JSON.parse(q)
    if (parsed.method === 'equal' && parsed.attribute === attribute) return parsed.values
  }
  return []
}

function hasMethod(queries: string[], method: string): boolean {
  return queries.some(q => JSON.parse(q).method === method)
}

/**
 * Route les appels listDocuments par collection ET par forme de requête, plutôt que par
 * position d'appel : le flux étant désormais jams → projets → équipes (inversion Hall of Fame),
 * un chaînage positionnel casserait au moindre réordonnancement interne.
 */
function mockRouted(opts: {
  featured?: unknown[]
  ongoing?: unknown[]
  upcoming?: unknown[]
  jamsCount?: number
  participantsCount?: number
  projectsCount?: number
  endedJams?: unknown[]
  placedProjects?: unknown[]
  teams?: unknown[]
}) {
  mockList.mockImplementation(async (_db: string, col: string, queries: string[] = []) => {
    if (col === 'game_jams') {
      if (hasMethod(queries, 'lessThan')) return { documents: opts.endedJams ?? [] } as never
      if (equalValues(queries, 'featured').length > 0 || queries.some(q => JSON.parse(q).attribute === 'featured'))
        return { documents: opts.featured ?? [], total: 0 } as never
      if (equalValues(queries, 'status').includes('ongoing')) return { documents: opts.ongoing ?? [], total: 0 } as never
      if (equalValues(queries, 'status').includes('upcoming')) return { documents: opts.upcoming ?? [], total: 0 } as never
      return { total: opts.jamsCount ?? 0, documents: [] } as never // jamsCount (limit(1) seul)
    }
    if (col === 'team_members') {
      return { total: opts.participantsCount ?? 0, documents: [] } as never
    }
    if (col === 'projects') {
      if (hasMethod(queries, 'greaterThan')) {
        const ids = equalValues(queries, 'jam_id')
        const all = opts.placedProjects ?? []
        return { documents: all.filter((p) => ids.includes((p as Record<string, unknown>).jam_id as string)) } as never
      }
      return { total: opts.projectsCount ?? 0, documents: [] } as never // projectsCount (submitted=true, limit(1))
    }
    if (col === 'teams') {
      const ids = equalValues(queries, '$id')
      const all = opts.teams ?? []
      return { documents: all.filter((t) => ids.includes((t as Record<string, unknown>).$id as string)) } as never
    }
    return { total: 0, documents: [] } as never
  })
}

beforeEach(() => vi.clearAllMocks())

describe('getHomePageData', () => {
  it('utilise le placement stocké du projet, pas l\'index du tableau', async () => {
    mockRouted({
      endedJams: [doc({ $id: 'j1', title: 'Jam 1', start_date: '2026-01-01', end_date: '2026-02-01', status: 'ended' })],
      placedProjects: [doc({ $id: 'p1', jam_id: 'j1', team_id: 't1', title: 'Alpha', placement: 3, submitted: true })],
      teams: [doc({ $id: 't1', name: 'Team 1' })],
    })

    const data = await getHomePageData()
    expect(data.winners).toHaveLength(1)
    expect(data.winners[0].placement).toBe(3) // et surtout PAS 1 (i%3+1 aurait donné 1)
  })

  it('trie les gagnants par jam la plus récemment terminée, puis par rang 1er→3e', async () => {
    mockRouted({
      endedJams: [
        // orderDesc(end_date) : la plus récente en premier, comme le ferait Appwrite
        doc({ $id: 'j-new', title: 'Jam Récente', start_date: '2026-05-01', end_date: '2026-06-01', status: 'ended' }),
        doc({ $id: 'j-old', title: 'Jam Ancienne', start_date: '2025-01-01', end_date: '2025-02-01', status: 'ended' }),
      ],
      placedProjects: [
        // ordre volontairement mélangé : le tri doit être fait par le code, pas hérité de l'ordre DB
        doc({ $id: 'p-old-1', jam_id: 'j-old', team_id: 't1', title: 'Vieux 1er', placement: 1, submitted: true }),
        doc({ $id: 'p-new-2', jam_id: 'j-new', team_id: 't2', title: 'Récent 2e', placement: 2, submitted: true }),
        doc({ $id: 'p-new-1', jam_id: 'j-new', team_id: 't3', title: 'Récent 1er', placement: 1, submitted: true }),
      ],
      teams: [doc({ $id: 't1', name: 'T1' }), doc({ $id: 't2', name: 'T2' }), doc({ $id: 't3', name: 'T3' })],
    })

    const data = await getHomePageData()
    expect(data.winners.map(w => w.projectTitle)).toEqual(['Récent 1er', 'Récent 2e', 'Vieux 1er'])
  })

  it('limite le Hall of Fame aux 5 dernières jams terminées', async () => {
    // 6 jams terminées possibles ; la requête (orderDesc + limit(5)) n'en retourne que 5,
    // la plus ancienne (j0) n'est donc jamais demandée pour ses projets.
    const jamDocs5MostRecent = Array.from({ length: 5 }, (_, k) => {
      const i = 5 - k // j5, j4, j3, j2, j1
      return doc({ $id: `j${i}`, title: `Jam ${i}`, start_date: `2026-0${i}-01`, end_date: `2026-0${i}-15`, status: 'ended' })
    })
    const placedProjects = Array.from({ length: 6 }, (_, i) =>
      doc({ $id: `p${i}`, jam_id: `j${i}`, team_id: `t${i}`, title: `Projet ${i}`, placement: 1, submitted: true }))
    const teams = Array.from({ length: 6 }, (_, i) => doc({ $id: `t${i}`, name: `T${i}` }))

    mockRouted({ endedJams: jamDocs5MostRecent, placedProjects, teams })

    const data = await getHomePageData()
    expect(data.winners).toHaveLength(5)
    // j0 (la plus ancienne des 6) est exclue ; la plus récente (j5) est première
    expect(data.winners.map(w => w.jamId)).toEqual(['j5', 'j4', 'j3', 'j2', 'j1'])
  })

  it('une jam terminée dont les projets sont anciens (créés il y a des mois) apparaît quand même (bug latent corrigé)', async () => {
    // Avant l'inversion : le pool de 50 était trié par $createdAt des projets, pas par end_date
    // de la jam. Une jam qui vient de se terminer mais dont les projets datent de mois pouvait
    // être éjectée du pool par des projets plus récents d'une jam plus courte. L'inversion part
    // des jams (par end_date) donc ce cas ne peut plus se produire.
    mockRouted({
      endedJams: [doc({ $id: 'j-recent-end', title: 'Jam qui vient de finir', start_date: '2026-01-01', end_date: '2026-07-15', status: 'ended' })],
      placedProjects: [
        doc({ $id: 'p-old', jam_id: 'j-recent-end', team_id: 't1', title: 'Projet ancien', placement: 1, submitted: true, $createdAt: '2025-01-01T00:00:00.000Z' }),
      ],
      teams: [doc({ $id: 't1', name: 'Équipe Ancienne' })],
    })

    const data = await getHomePageData()
    expect(data.winners.map(w => w.jamId)).toContain('j-recent-end')
    expect(data.winners[0].projectTitle).toBe('Projet ancien')
  })

  it("30 équipes distinctes sur les podiums ne produisent aucune 'Équipe inconnue'", async () => {
    const endedJams = Array.from({ length: 5 }, (_, i) =>
      doc({ $id: `j${i}`, title: `Jam ${i}`, start_date: `2026-0${i + 1}-01`, end_date: `2026-0${i + 1}-15`, status: 'ended' }))
    // 6 équipes gagnantes par jam (2 podiums de 3) × 5 jams = 30 équipes distinctes
    const placedProjects = Array.from({ length: 30 }, (_, i) =>
      doc({ $id: `p${i}`, jam_id: `j${i % 5}`, team_id: `t${i}`, title: `Projet ${i}`, placement: (i % 3) + 1, submitted: true }))
    const teams = Array.from({ length: 30 }, (_, i) => doc({ $id: `t${i}`, name: `Équipe ${i}` }))

    mockRouted({ endedJams, placedProjects, teams })

    const data = await getHomePageData()
    expect(data.winners).toHaveLength(30)
    expect(data.winners.every(w => w.teamName !== 'Équipe inconnue')).toBe(true)
  })
})
