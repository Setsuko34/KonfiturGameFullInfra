import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/appwrite/server', () => ({
  serverDatabases: {
    listDocuments: vi.fn(),
  },
}))

import { getParticipantCountsByJam } from '@/lib/appwrite/participant-counts'
import { serverDatabases } from '@/lib/appwrite/server'

const mockList = vi.mocked(serverDatabases.listDocuments)

function doc(id: string, fields: Record<string, unknown>) {
  return {
    $id: id,
    $createdAt: '2026-01-01T00:00:00.000Z',
    $updatedAt: '2026-01-01T00:00:00.000Z',
    $permissions: [],
    $collectionId: 'x',
    $databaseId: 'konfitur-db',
    ...fields,
  }
}

beforeEach(() => {
  mockList.mockReset()
})

describe('getParticipantCountsByJam', () => {
  it('liste vide : objet vide, aucun appel DB', async () => {
    const counts = await getParticipantCountsByJam([])
    expect(counts).toEqual({})
    expect(mockList).not.toHaveBeenCalled()
  })

  it('somme les membres par jam, team multi-jams comptée dans chaque jam, jam sans team à 0', async () => {
    // team-a (2 membres) inscrite à jam-1 ; team-b (3 membres) inscrite à jam-1 ET jam-2 ; jam-3 vide
    mockList.mockImplementation(async (_db: string, col: string) => {
      if (col === 'teams') {
        return {
          total: 2,
          documents: [
            doc('team-a', { jam_ids: ['jam-1'] }),
            doc('team-b', { jam_ids: ['jam-1', 'jam-2'] }),
          ],
        } as never
      }
      return {
        total: 5,
        documents: [
          doc('m1', { team_id: 'team-a' }),
          doc('m2', { team_id: 'team-a' }),
          doc('m3', { team_id: 'team-b' }),
          doc('m4', { team_id: 'team-b' }),
          doc('m5', { team_id: 'team-b' }),
        ],
      } as never
    })

    const counts = await getParticipantCountsByJam(['jam-1', 'jam-2', 'jam-3'])
    expect(counts).toEqual({ 'jam-1': 5, 'jam-2': 3, 'jam-3': 0 })
  })

  it('erreur Appwrite : compteurs à 0, pas de throw', async () => {
    mockList.mockRejectedValue(new Error('down'))
    const counts = await getParticipantCountsByJam(['jam-1'])
    expect(counts).toEqual({ 'jam-1': 0 })
  })
})
