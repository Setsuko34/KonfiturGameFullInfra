import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/appwrite/server', () => ({
  serverDatabases: {
    getDocument: vi.fn(),
    createDocument: vi.fn(),
    deleteDocument: vi.fn(),
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

import { createOrganizerAnnouncement, deleteOrganizerAnnouncement } from '@/lib/actions/announcements'
import { serverDatabases, serverTeams } from '@/lib/appwrite/server'

const mockGet = vi.mocked(serverDatabases.getDocument)
const mockCreate = vi.mocked(serverDatabases.createDocument)
const mockDelete = vi.mocked(serverDatabases.deleteDocument)
const mockMemberships = vi.mocked(serverTeams.listMemberships)

const VALID_DATA = { title: 'Annonce test', content: 'Contenu de test suffisant', important: false }

const isAuditWrite = (args: unknown[]) => args[1] === 'audit_logs'

beforeEach(() => { vi.clearAllMocks() })

describe('createOrganizerAnnouncement — double garde', () => {
  it("organisateur : succès, aucune entrée d'audit ni check admin", async () => {
    mockAccountGet.mockResolvedValue({ $id: 'orga-1' })
    mockGet.mockResolvedValue({ $id: 'jam-1', organizer_id: 'orga-1', title: 'X' } as never)
    mockCreate.mockResolvedValue({} as never)

    const res = await createOrganizerAnnouncement('jam-1', VALID_DATA)

    expect(res.success).toBe(true)
    expect(mockMemberships).not.toHaveBeenCalled()
    expect(mockCreate.mock.calls.filter(isAuditWrite)).toHaveLength(0)
  })

  it('admin non-organisateur : succès + audit admin_action', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'admin-1' })
    mockGet.mockResolvedValue({ $id: 'jam-1', organizer_id: 'orga-1', title: 'X' } as never)
    mockMemberships.mockResolvedValue({ total: 1, memberships: [] } as never)
    mockCreate.mockResolvedValue({} as never)

    const res = await createOrganizerAnnouncement('jam-1', VALID_DATA)

    expect(res.success).toBe(true)
    expect(mockCreate).toHaveBeenCalledWith('konfitur-db', 'audit_logs', expect.any(String),
      expect.objectContaining({ type: 'admin_action', user_id: 'admin-1' }))
  })

  it('tiers : refus message exact, aucune écriture', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'tiers' })
    mockGet.mockResolvedValue({ $id: 'jam-1', organizer_id: 'orga-1' } as never)
    mockMemberships.mockResolvedValue({ total: 0, memberships: [] } as never)

    const res = await createOrganizerAnnouncement('jam-1', VALID_DATA)

    expect(res).toEqual({ success: false, error: 'Seul l\'organisateur peut publier des annonces' })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('sans session : refus, aucun appel DB', async () => {
    mockAccountGet.mockRejectedValue(new Error('no session'))

    const res = await createOrganizerAnnouncement('jam-1', VALID_DATA)

    expect(res.success).toBe(false)
    expect(mockGet).not.toHaveBeenCalled()
    expect(mockCreate).not.toHaveBeenCalled()
  })
})

describe('deleteOrganizerAnnouncement — double garde', () => {
  it("organisateur : succès, aucune entrée d'audit ni check admin", async () => {
    mockAccountGet.mockResolvedValue({ $id: 'orga-1' })
    mockGet
      .mockResolvedValueOnce({ $id: 'jam-1', organizer_id: 'orga-1', title: 'X' } as never)
      .mockResolvedValueOnce({ $id: 'ann-1', jam_id: 'jam-1' } as never)
    mockDelete.mockResolvedValue({} as never)

    const res = await deleteOrganizerAnnouncement('jam-1', 'ann-1')

    expect(res.success).toBe(true)
    expect(mockMemberships).not.toHaveBeenCalled()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('admin non-organisateur : succès + audit admin_action', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'admin-1' })
    mockGet
      .mockResolvedValueOnce({ $id: 'jam-1', organizer_id: 'orga-1', title: 'X' } as never)
      .mockResolvedValueOnce({ $id: 'ann-1', jam_id: 'jam-1' } as never)
    mockMemberships.mockResolvedValue({ total: 1, memberships: [] } as never)
    mockDelete.mockResolvedValue({} as never)
    mockCreate.mockResolvedValue({} as never)

    const res = await deleteOrganizerAnnouncement('jam-1', 'ann-1')

    expect(res.success).toBe(true)
    expect(mockCreate).toHaveBeenCalledWith('konfitur-db', 'audit_logs', expect.any(String),
      expect.objectContaining({ type: 'admin_action', user_id: 'admin-1' }))
  })

  it('tiers : refus message exact, aucune suppression', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'tiers' })
    mockGet.mockResolvedValue({ $id: 'jam-1', organizer_id: 'orga-1' } as never)
    mockMemberships.mockResolvedValue({ total: 0, memberships: [] } as never)

    const res = await deleteOrganizerAnnouncement('jam-1', 'ann-1')

    expect(res).toEqual({ success: false, error: 'Accès non autorisé' })
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it("annonce d'une autre jam : refus exact même pour un admin, aucune suppression", async () => {
    mockAccountGet.mockResolvedValue({ $id: 'admin-1' })
    mockGet
      .mockResolvedValueOnce({ $id: 'jam-1', organizer_id: 'orga-1', title: 'X' } as never)
      .mockResolvedValueOnce({ $id: 'ann-1', jam_id: 'jam-AUTRE' } as never)
    mockMemberships.mockResolvedValue({ total: 1, memberships: [] } as never)

    const res = await deleteOrganizerAnnouncement('jam-1', 'ann-1')

    expect(res).toEqual({ success: false, error: 'Annonce introuvable pour cette jam' })
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('sans session : refus, aucun appel DB', async () => {
    mockAccountGet.mockRejectedValue(new Error('no session'))

    const res = await deleteOrganizerAnnouncement('jam-1', 'ann-1')

    expect(res.success).toBe(false)
    expect(mockGet).not.toHaveBeenCalled()
    expect(mockDelete).not.toHaveBeenCalled()
  })
})
