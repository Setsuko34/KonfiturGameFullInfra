import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/appwrite/server', () => ({
  serverDatabases: {
    listDocuments: vi.fn(),
  },
}))

import { fetchAllDocs, fetchAllByField } from '@/lib/appwrite/fetch-all'
import { serverDatabases } from '@/lib/appwrite/server'
import { COLLECTIONS } from '@/lib/appwrite/config'

const mockList = vi.mocked(serverDatabases.listDocuments)

// Crée n documents minimaux, chacun avec un unique $id
function docs(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    $id: `doc-${i}`,
    $collectionId: 'test',
    $databaseId: 'test',
    $createdAt: new Date().toISOString(),
    $updatedAt: new Date().toISOString(),
    $permissions: [],
  }))
}

// Crée n IDs uniques
function ids(n: number) {
  return Array.from({ length: n }, (_, i) => `id-${i}`)
}

beforeEach(() => { vi.clearAllMocks() })

describe('fetchAllDocs', () => {
  it('une seule requête quand la première page est incomplète', async () => {
    mockList.mockResolvedValue({ total: 6, documents: docs(6) } as never)
    await fetchAllDocs(COLLECTIONS.GAME_JAMS)
    expect(mockList).toHaveBeenCalledTimes(1)
  })

  it('enchaîne les pages au curseur puis concatène', async () => {
    mockList
      .mockResolvedValueOnce({ total: 1200, documents: docs(500) } as never)
      .mockResolvedValueOnce({ total: 1200, documents: docs(500) } as never)
      .mockResolvedValueOnce({ total: 1200, documents: docs(200) } as never)
    const all = await fetchAllDocs(COLLECTIONS.GAME_JAMS)
    expect(all).toHaveLength(1200)
    expect(mockList).toHaveBeenCalledTimes(3)
  })

  it('lève au lieu de tronquer si le garde-fou est atteint', async () => {
    mockList.mockResolvedValue({ total: 99_999, documents: docs(500) } as never)
    await expect(fetchAllDocs(COLLECTIONS.GAME_JAMS)).rejects.toThrow(/SAFETY_CAP|dépasse/)
  })
})

describe('fetchAllByField', () => {
  it('découpe un filtre de plus de 100 valeurs en lots', async () => {
    mockList.mockResolvedValue({ total: 0, documents: [] } as never)
    await fetchAllByField(COLLECTIONS.TEAMS, '$id', ids(250))
    expect(mockList).toHaveBeenCalledTimes(3)   // 100 + 100 + 50
  })
})
