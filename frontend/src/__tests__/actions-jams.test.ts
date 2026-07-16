import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/appwrite/server', () => ({
  serverDatabases: {
    createDocument: vi.fn(),
    listDocuments: vi.fn(),
    getDocument: vi.fn(),
  },
}))

import { getJams, getJamById, getJamBySlug, getAnnouncementsByJam, createJam } from '@/lib/actions/jams'
import { serverDatabases } from '@/lib/appwrite/server'

const mockList = vi.mocked(serverDatabases.listDocuments)
const mockGet = vi.mocked(serverDatabases.getDocument)
const mockCreate = vi.mocked(serverDatabases.createDocument)

// Doc minimal valide pour mapDocToGameJam (mapping testé dans appwrite-mappers.test.ts)
const jamDoc = {
  $id: 'jam-1',
  title: 'Jam Test',
  slug: 'jam-test',
  theme: 'Espace',
  description: 'desc',
  type: 'online',
  start_date: '2026-08-01T00:00:00.000Z',
  end_date: '2026-08-03T00:00:00.000Z',
  duration: '48h',
  organizer_id: 'user-1',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getJams', () => {
  it('retourne les jams mappées', async () => {
    mockList.mockResolvedValue({ total: 1, documents: [jamDoc] } as never)
    const jams = await getJams()
    expect(jams).toHaveLength(1)
    expect(jams[0].id).toBe('jam-1')
    expect(jams[0].title).toBe('Jam Test')
  })

  it('retourne [] si Appwrite échoue', async () => {
    mockList.mockRejectedValue(new Error('down'))
    expect(await getJams()).toEqual([])
  })
})

describe('getJamById', () => {
  it('retourne null si le document est introuvable', async () => {
    mockGet.mockRejectedValue(new Error('not found'))
    expect(await getJamById('nope')).toBeNull()
  })
})

describe('getJamBySlug', () => {
  it('retourne la jam correspondant au slug', async () => {
    mockList.mockResolvedValue({ total: 1, documents: [jamDoc] } as never)
    const jam = await getJamBySlug('jam-test')
    expect(jam?.slug).toBe('jam-test')
  })

  it('retourne null si aucun document ne correspond', async () => {
    mockList.mockResolvedValue({ total: 0, documents: [] } as never)
    expect(await getJamBySlug('inconnu')).toBeNull()
  })
})

describe('getAnnouncementsByJam', () => {
  it('retourne [] si Appwrite échoue', async () => {
    mockList.mockRejectedValue(new Error('down'))
    expect(await getAnnouncementsByJam('jam-1')).toEqual([])
  })
})

describe('createJam', () => {
  const jamData = {
    title: 'Nouvelle Jam', slug: 'nouvelle-jam', theme: 'Océan',
    description: 'desc', status: 'upcoming', type: 'online',
    startDate: '2026-09-01', endDate: '2026-09-03', duration: '48h',
    rules: ['règle 1'], organizerId: 'user-1',
  }

  it("retourne success + id à la création", async () => {
    mockCreate.mockResolvedValue({ $id: 'new-jam' } as never)
    expect(await createJam(jamData)).toEqual({ success: true, id: 'new-jam' })
  })

  it("retourne success: false et le message d'erreur en cas d'échec", async () => {
    mockCreate.mockRejectedValue(new Error('quota dépassé'))
    expect(await createJam(jamData)).toEqual({ success: false, error: 'quota dépassé' })
  })
})
