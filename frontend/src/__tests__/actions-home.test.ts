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

beforeEach(() => vi.clearAllMocks())

describe('getHomePageData', () => {
  it('utilise le placement stocké du projet, pas l\'index du tableau', async () => {
    // Ordre d'appels dans getHomePageData : featured, ongoing, upcoming, winners, jamsCount, membersCount, projectsCount, puis jams+teams des gagnants
    mockList
      .mockResolvedValueOnce({ documents: [], total: 0 } as never) // featured
      .mockResolvedValueOnce({ documents: [], total: 0 } as never) // ongoing
      .mockResolvedValueOnce({ documents: [], total: 0 } as never) // upcoming
      .mockResolvedValueOnce({ documents: [                        // winners
        doc({ $id: 'p1', jam_id: 'j1', team_id: 't1', title: 'Alpha', placement: 3, submitted: true }),
      ], total: 1 } as never)
      .mockResolvedValueOnce({ total: 0, documents: [] } as never)  // jamsCount
      .mockResolvedValueOnce({ total: 0, documents: [] } as never)  // membersCount
      .mockResolvedValueOnce({ total: 0, documents: [] } as never)  // projectsCount
      .mockResolvedValueOnce({ documents: [                         // jams des gagnants
        doc({ $id: 'j1', title: 'Jam 1', start_date: '2026-01-01', end_date: '2026-02-01', status: 'ended' }),
      ] } as never)
      .mockResolvedValueOnce({ documents: [                         // teams des gagnants
        doc({ $id: 't1', name: 'Team 1' }),
      ] } as never)

    const data = await getHomePageData()
    expect(data.winners).toHaveLength(1)
    expect(data.winners[0].placement).toBe(3) // et surtout PAS 1 (i%3+1 aurait donné 1)
  })

  it('trie les gagnants par jam la plus récemment terminée, puis par rang 1er→3e', async () => {
    mockList
      .mockResolvedValueOnce({ documents: [], total: 0 } as never) // featured
      .mockResolvedValueOnce({ documents: [], total: 0 } as never) // ongoing
      .mockResolvedValueOnce({ documents: [], total: 0 } as never) // upcoming
      .mockResolvedValueOnce({ documents: [                        // winners (ordre volontairement mélangé)
        doc({ $id: 'p-old-1', jam_id: 'j-old', team_id: 't1', title: 'Vieux 1er', placement: 1, submitted: true }),
        doc({ $id: 'p-new-2', jam_id: 'j-new', team_id: 't2', title: 'Récent 2e', placement: 2, submitted: true }),
        doc({ $id: 'p-new-1', jam_id: 'j-new', team_id: 't3', title: 'Récent 1er', placement: 1, submitted: true }),
      ], total: 3 } as never)
      .mockResolvedValueOnce({ total: 0, documents: [] } as never)  // jamsCount
      .mockResolvedValueOnce({ total: 0, documents: [] } as never)  // membersCount
      .mockResolvedValueOnce({ total: 0, documents: [] } as never)  // projectsCount
      .mockResolvedValueOnce({ documents: [                         // jams des gagnants
        doc({ $id: 'j-old', title: 'Jam Ancienne', start_date: '2025-01-01', end_date: '2025-02-01', status: 'ended' }),
        doc({ $id: 'j-new', title: 'Jam Récente', start_date: '2026-05-01', end_date: '2026-06-01', status: 'ended' }),
      ] } as never)
      .mockResolvedValueOnce({ documents: [
        doc({ $id: 't1', name: 'T1' }), doc({ $id: 't2', name: 'T2' }), doc({ $id: 't3', name: 'T3' }),
      ] } as never)

    const data = await getHomePageData()
    expect(data.winners.map(w => w.projectTitle)).toEqual(['Récent 1er', 'Récent 2e', 'Vieux 1er'])
  })

  it('limite le Hall of Fame aux 5 dernières jams terminées', async () => {
    // 6 jams terminées avec un gagnant chacune — la plus ancienne doit disparaître
    const winnerDocs = Array.from({ length: 6 }, (_, i) =>
      doc({ $id: `p${i}`, jam_id: `j${i}`, team_id: `t${i}`, title: `Projet ${i}`, placement: 1, submitted: true }))
    const jamDocs = Array.from({ length: 6 }, (_, i) =>
      doc({ $id: `j${i}`, title: `Jam ${i}`, start_date: `2026-0${i + 1}-01`, end_date: `2026-0${i + 1}-15`, status: 'ended' }))
    const teamDocs = Array.from({ length: 6 }, (_, i) => doc({ $id: `t${i}`, name: `T${i}` }))

    mockList
      .mockResolvedValueOnce({ documents: [], total: 0 } as never) // featured
      .mockResolvedValueOnce({ documents: [], total: 0 } as never) // ongoing
      .mockResolvedValueOnce({ documents: [], total: 0 } as never) // upcoming
      .mockResolvedValueOnce({ documents: winnerDocs, total: 6 } as never) // winners
      .mockResolvedValueOnce({ total: 0, documents: [] } as never)
      .mockResolvedValueOnce({ total: 0, documents: [] } as never)
      .mockResolvedValueOnce({ total: 0, documents: [] } as never)
      .mockResolvedValueOnce({ documents: jamDocs } as never)
      .mockResolvedValueOnce({ documents: teamDocs } as never)

    const data = await getHomePageData()
    expect(data.winners).toHaveLength(5)
    // j0 (terminée le 15/01, la plus ancienne) est exclue ; la plus récente (j5) est première
    expect(data.winners.map(w => w.jamId)).toEqual(['j5', 'j4', 'j3', 'j2', 'j1'])
  })
})
