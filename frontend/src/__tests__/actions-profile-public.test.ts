// frontend/src/__tests__/actions-profile-public.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Query } from 'node-appwrite'

vi.mock('@/lib/appwrite/server', () => ({
  serverDatabases: {
    listDocuments: vi.fn(),
  },
}))

import { getPublicProfileProjects } from '@/lib/actions/profile'
import { serverDatabases } from '@/lib/appwrite/server'

const mockList = vi.mocked(serverDatabases.listDocuments)

beforeEach(() => {
  vi.resetAllMocks()
})

// Extrait les valeurs d'un Query.equal(attribute, ...) au sein du tableau de requêtes sérialisées.
function equalValues(queries: string[], attribute: string): string[] {
  for (const q of queries) {
    const parsed = JSON.parse(q)
    if (parsed.method === 'equal' && parsed.attribute === attribute) return parsed.values
  }
  return []
}

describe('getPublicProfileProjects', () => {
  it("retourne [] sans appeler projects si l'utilisateur n'a aucune équipe", async () => {
    mockList.mockResolvedValueOnce({ total: 0, documents: [] } as never) // team_members

    const projects = await getPublicProfileProjects('user-sans-equipe')

    expect(projects).toEqual([])
    expect(mockList).toHaveBeenCalledTimes(1) // pas d'appel projects : fetchAllByField court-circuite sur []
  })

  it('remonte les projets soumis des équipes du joueur (team_members → team_id → projects)', async () => {
    mockList.mockImplementation(async (_db: string, col: string, queries: string[] = []) => {
      if (col === 'team_members') {
        return { total: 1, documents: [{ $id: 'm1', team_id: 'team-1', user_id: 'user-1' }] } as never
      }
      if (col === 'projects') {
        expect(equalValues(queries, 'team_id')).toEqual(['team-1'])
        return {
          total: 1,
          documents: [{
            $id: 'proj-1', jam_id: 'jam-1', team_id: 'team-1',
            title: 'Projet Soumis', description: 'desc', submitted: true, likes_count: 3,
          }],
        } as never
      }
      return { total: 0, documents: [] } as never
    })

    const projects = await getPublicProfileProjects('user-1')

    expect(projects).toHaveLength(1)
    expect(projects[0].title).toBe('Projet Soumis')
  })

  it('exclut les projets non soumis (brouillons)', async () => {
    mockList.mockImplementation(async (_db: string, col: string) => {
      if (col === 'team_members') {
        return { total: 1, documents: [{ $id: 'm1', team_id: 'team-1', user_id: 'user-1' }] } as never
      }
      if (col === 'projects') {
        return {
          total: 1,
          documents: [{
            $id: 'proj-draft', jam_id: 'jam-1', team_id: 'team-1',
            title: 'Brouillon', description: 'desc', submitted: false, likes_count: 0,
          }],
        } as never
      }
      return { total: 0, documents: [] } as never
    })

    const projects = await getPublicProfileProjects('user-1')

    expect(projects).toEqual([])
  })

  it('découpe les team_id en lots de 100 (plafond de filtre Appwrite)', async () => {
    const memberships = Array.from({ length: 150 }, (_, i) => ({ $id: `m${i}`, team_id: `team-${i}`, user_id: 'user-1' }))
    const projectQueries: string[][] = []

    mockList.mockImplementation(async (_db: string, col: string, queries: string[] = []) => {
      if (col === 'team_members') return { total: 150, documents: memberships } as never
      if (col === 'projects') {
        projectQueries.push(queries)
        return { total: 0, documents: [] } as never
      }
      return { total: 0, documents: [] } as never
    })

    await getPublicProfileProjects('user-1')

    expect(projectQueries).toHaveLength(2) // 150 team_id → 2 lots de 100 max
    expect(equalValues(projectQueries[0], 'team_id')).toHaveLength(100)
    expect(equalValues(projectQueries[1], 'team_id')).toHaveLength(50)
  })

  it('trie par date de création décroissante', async () => {
    mockList.mockImplementation(async (_db: string, col: string, queries: string[] = []) => {
      if (col === 'team_members') return { total: 1, documents: [{ $id: 'm1', team_id: 'team-1', user_id: 'user-1' }] } as never
      if (col === 'projects') {
        expect(queries).toContain(Query.orderDesc('$createdAt'))
        return { total: 0, documents: [] } as never
      }
      return { total: 0, documents: [] } as never
    })

    await getPublicProfileProjects('user-1')
  })
})
