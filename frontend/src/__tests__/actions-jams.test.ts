import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Query } from 'node-appwrite'

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

// n jams minimales, chacune avec un $id unique, pour tester la pagination au curseur
function jamDocs(n: number, offset = 0) {
  return Array.from({ length: n }, (_, i) => ({ ...jamDoc, $id: `jam-${offset + i}`, slug: `jam-${offset + i}` }))
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('getJams', () => {
  it('retourne les jams mappées', async () => {
    mockList.mockResolvedValue({ total: 1, documents: [jamDoc] } as never)
    const { jams } = await getJams()
    expect(jams).toHaveLength(1)
    expect(jams[0].id).toBe('jam-1')
    expect(jams[0].title).toBe('Jam Test')
  })

  it('retourne { jams: [], nextCursor: null } si Appwrite échoue', async () => {
    mockList.mockRejectedValue(new Error('down'))
    expect(await getJams()).toEqual({ jams: [], nextCursor: null })
  })

  it('nextCursor est null quand le lot revient incomplet (moins de 50)', async () => {
    mockList.mockResolvedValue({ total: 6, documents: jamDocs(6) } as never)
    const { nextCursor } = await getJams()
    expect(nextCursor).toBeNull()
  })

  it("nextCursor pointe vers le dernier document quand le lot est plein (50)", async () => {
    mockList.mockResolvedValue({ total: 200, documents: jamDocs(50) } as never)
    const { nextCursor } = await getJams()
    expect(nextCursor).toBe('jam-49')
  })

  it('transmet le curseur reçu via Query.cursorAfter à Appwrite', async () => {
    mockList.mockResolvedValue({ total: 6, documents: jamDocs(6, 50) } as never)
    await getJams('jam-49')
    const queries = mockList.mock.calls[0][2] as string[]
    expect(queries).toContain(Query.cursorAfter('jam-49'))
  })

  it('le second lot ne contient pas le dernier document du premier', async () => {
    mockList
      .mockResolvedValueOnce({ total: 100, documents: jamDocs(50, 0) } as never)
      .mockResolvedValueOnce({ total: 100, documents: jamDocs(50, 50) } as never)

    const first = await getJams()
    expect(first.nextCursor).toBe('jam-49')

    const second = await getJams(first.nextCursor!)
    expect(second.jams.some(j => j.id === 'jam-49')).toBe(false)
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

// n annonces minimales, chacune avec un $id unique, pour tester la pagination au curseur
function announcementDocs(n: number, offset = 0) {
  return Array.from({ length: n }, (_, i) => ({
    $id: `ann-${offset + i}`,
    jam_id: 'jam-1',
    title: 'Annonce',
    content: 'contenu',
    author_id: 'user-1',
    $createdAt: '2026-07-16T10:00:00.000Z',
  }))
}

describe('getAnnouncementsByJam', () => {
  it('retourne { announcements: [], nextCursor: null } si Appwrite échoue', async () => {
    mockList.mockRejectedValue(new Error('down'))
    expect(await getAnnouncementsByJam('jam-1')).toEqual({ announcements: [], nextCursor: null })
  })

  it('nextCursor est null quand le lot revient incomplet (moins de 50)', async () => {
    mockList.mockResolvedValue({ total: 6, documents: announcementDocs(6) } as never)
    const { nextCursor } = await getAnnouncementsByJam('jam-1')
    expect(nextCursor).toBeNull()
  })

  it('nextCursor pointe vers le dernier document quand le lot est plein (50)', async () => {
    mockList.mockResolvedValue({ total: 200, documents: announcementDocs(50) } as never)
    const { nextCursor } = await getAnnouncementsByJam('jam-1')
    expect(nextCursor).toBe('ann-49')
  })

  it('transmet le curseur reçu via Query.cursorAfter à Appwrite', async () => {
    mockList.mockResolvedValue({ total: 6, documents: announcementDocs(6, 50) } as never)
    await getAnnouncementsByJam('jam-1', 'ann-49')
    const queries = mockList.mock.calls[0][2] as string[]
    expect(queries).toContain(Query.cursorAfter('ann-49'))
  })

  it('le second lot ne contient pas le dernier document du premier', async () => {
    mockList
      .mockResolvedValueOnce({ total: 100, documents: announcementDocs(50, 0) } as never)
      .mockResolvedValueOnce({ total: 100, documents: announcementDocs(50, 50) } as never)

    const first = await getAnnouncementsByJam('jam-1')
    expect(first.nextCursor).toBe('ann-49')

    const second = await getAnnouncementsByJam('jam-1', first.nextCursor!)
    expect(second.announcements.some(a => a.id === 'ann-49')).toBe(false)
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
