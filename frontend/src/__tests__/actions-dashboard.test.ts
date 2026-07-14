import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/appwrite/server', () => ({
  serverDatabases: {
    getDocument: vi.fn(),
    updateDocument: vi.fn(),
    createDocument: vi.fn(),
    listDocuments: vi.fn(),
  },
  serverTeams: {
    listMemberships: vi.fn(),
  },
}))

const mockAccountGet = vi.fn()
vi.mock('@/lib/appwrite/session', () => ({
  createSessionClient: vi.fn(async () => ({ account: { get: mockAccountGet } })),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { updateJam, getOrganizedJamDetails } from '@/lib/actions/dashboard'
import { serverDatabases, serverTeams } from '@/lib/appwrite/server'

const mockGet = vi.mocked(serverDatabases.getDocument)
const mockUpdate = vi.mocked(serverDatabases.updateDocument)
const mockCreateDoc = vi.mocked(serverDatabases.createDocument)
const mockList = vi.mocked(serverDatabases.listDocuments)
const mockMemberships = vi.mocked(serverTeams.listMemberships)

// jam en cours : commencée hier, finit demain
const ONGOING_DATES = {
  start_date: new Date(Date.now() - 86_400_000).toISOString(),
  end_date: new Date(Date.now() + 86_400_000).toISOString(),
}

beforeEach(() => { vi.clearAllMocks() })

describe('updateJam — double garde', () => {
  it("organisateur : succès, AUCUNE entrée d'audit ni check admin", async () => {
    mockAccountGet.mockResolvedValue({ $id: 'orga-1' })
    mockGet.mockResolvedValue({ $id: 'jam-1', organizer_id: 'orga-1', title: 'X', ...ONGOING_DATES } as never)
    mockUpdate.mockResolvedValue({} as never)

    const res = await updateJam('jam-1', { description: 'd' })

    expect(res.success).toBe(true)
    expect(mockCreateDoc).not.toHaveBeenCalled() // pas d'audit pour le propriétaire
    expect(mockMemberships).not.toHaveBeenCalled() // owner court-circuite le check admin
  })

  it('admin non-organisateur : succès + audit admin_action', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'admin-1' })
    mockGet.mockResolvedValue({ $id: 'jam-1', organizer_id: 'orga-1', title: 'X', ...ONGOING_DATES } as never)
    mockMemberships.mockResolvedValue({ total: 1, memberships: [] } as never)
    mockUpdate.mockResolvedValue({} as never)
    mockCreateDoc.mockResolvedValue({} as never)

    const res = await updateJam('jam-1', { description: 'd' })

    expect(res.success).toBe(true)
    expect(mockCreateDoc).toHaveBeenCalledWith('konfitur-db', 'audit_logs', expect.any(String),
      expect.objectContaining({ type: 'admin_action', user_id: 'admin-1' }))
  })

  it('tiers : refus message exact, aucune écriture', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'tiers' })
    mockGet.mockResolvedValue({ $id: 'jam-1', organizer_id: 'orga-1', ...ONGOING_DATES } as never)
    mockMemberships.mockResolvedValue({ total: 0, memberships: [] } as never)

    const res = await updateJam('jam-1', { description: 'd' })

    expect(res).toEqual({ success: false, error: 'Seul l\'organisateur peut modifier cette jam' })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('jam terminée : refus message exact même pour un admin', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'admin-1' })
    mockGet.mockResolvedValue({
      $id: 'jam-1',
      organizer_id: 'orga-1',
      start_date: '2020-01-01T00:00:00.000Z',
      end_date: '2020-01-02T00:00:00.000Z',
    } as never)
    mockMemberships.mockResolvedValue({ total: 1, memberships: [] } as never)

    const res = await updateJam('jam-1', { description: 'd' })

    expect(res).toEqual({ success: false, error: 'Impossible de modifier une jam terminée' })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('sans session : refus, aucun appel DB', async () => {
    mockAccountGet.mockRejectedValue(new Error('no session'))

    const res = await updateJam('jam-1', { description: 'd' })

    expect(res.success).toBe(false)
    expect(mockGet).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})

describe('getOrganizedJamDetails — double garde', () => {
  it("admin non-organisateur : accès autorisé, pas d'audit (lecture)", async () => {
    mockAccountGet.mockResolvedValue({ $id: 'admin-1' })
    mockGet.mockResolvedValue({ $id: 'jam-1', organizer_id: 'orga-1', ...ONGOING_DATES } as never)
    mockMemberships.mockResolvedValue({ total: 1, memberships: [] } as never)
    mockList.mockResolvedValue({ total: 0, documents: [] } as never)

    const res = await getOrganizedJamDetails('jam-1')

    expect(res.jam.id).toBe('jam-1')
    expect(mockCreateDoc).not.toHaveBeenCalled()
  })

  it('tiers : throw message exact', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'tiers' })
    mockGet.mockResolvedValue({ $id: 'jam-1', organizer_id: 'orga-1', ...ONGOING_DATES } as never)
    mockMemberships.mockResolvedValue({ total: 0, memberships: [] } as never)

    await expect(getOrganizedJamDetails('jam-1')).rejects.toThrow('Accès non autorisé')
    expect(mockList).not.toHaveBeenCalled()
  })
})
