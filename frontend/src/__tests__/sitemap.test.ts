import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/appwrite/server', () => ({
  serverDatabases: {
    listDocuments: vi.fn(),
  },
}))

import sitemap from '@/app/sitemap'
import { serverDatabases } from '@/lib/appwrite/server'

const mockList = vi.mocked(serverDatabases.listDocuments)

beforeEach(() => { vi.clearAllMocks() })

describe('sitemap — pas de plafond silencieux', () => {
  it('inclut plus de 500 jams via la pagination curseur de fetchAllDocs (page 500, pas 100)', async () => {
    const jams = Array.from({ length: 700 }, (_, i) =>
      ({ $id: `jam-${i}`, $updatedAt: '2026-01-01T00:00:00.000Z', status: 'ended' }))

    mockList.mockImplementation(async (_db: string, col: string, queries: string[] = []) => {
      if (col !== 'game_jams') return { total: 0, documents: [] } as never
      const cursorQuery = queries.find(q => JSON.parse(q).method === 'cursorAfter')
      const startIndex = cursorQuery ? jams.findIndex(j => j.$id === JSON.parse(cursorQuery).values[0]) + 1 : 0
      return { total: jams.length, documents: jams.slice(startIndex, startIndex + 500) } as never
    })

    const result = await sitemap()
    const jamUrls = result.filter(r => r.url.includes('/jam/'))
    expect(jamUrls).toHaveLength(700)
  })

  it('au-delà du garde-fou (10 000), échoue bruyamment (section vide, catch) au lieu de tronquer silencieusement à 10 000', async () => {
    // Avant : la boucle locale `while (all.length < SAFETY_CAP)` s'arrêtait à 10 000 pile,
    // sans erreur, en servant un sitemap silencieusement incomplet. fetchAllDocs lève à la place.
    const jams = Array.from({ length: 10_050 }, (_, i) =>
      ({ $id: `jam-${i}`, $updatedAt: '2026-01-01T00:00:00.000Z', status: 'ended' }))

    mockList.mockImplementation(async (_db: string, col: string, queries: string[] = []) => {
      if (col !== 'game_jams') return { total: 0, documents: [] } as never
      const cursorQuery = queries.find(q => JSON.parse(q).method === 'cursorAfter')
      const startIndex = cursorQuery ? jams.findIndex(j => j.$id === JSON.parse(cursorQuery).values[0]) + 1 : 0
      return { total: jams.length, documents: jams.slice(startIndex, startIndex + 500) } as never
    })

    const result = await sitemap()
    const jamUrls = result.filter(r => r.url.includes('/jam/'))
    expect(jamUrls).toHaveLength(0)
  })

  it('sitemap partiel (jams vides) si Appwrite échoue, sans lever', async () => {
    mockList.mockRejectedValue(new Error('Appwrite down'))

    const result = await sitemap()
    const jamUrls = result.filter(r => r.url.includes('/jam/'))
    const projectUrls = result.filter(r => r.url.includes('/project/'))

    expect(jamUrls).toHaveLength(0)
    expect(projectUrls).toHaveLength(0)
    // routes statiques toujours présentes
    expect(result.some(r => r.url.endsWith('/explore'))).toBe(true)
  })
})
