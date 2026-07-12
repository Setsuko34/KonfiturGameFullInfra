import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/appwrite/server', () => ({
  serverDatabases: {
    getDocument: vi.fn(),
    updateDocument: vi.fn(),
    deleteDocument: vi.fn(),
    createDocument: vi.fn(),
    listDocuments: vi.fn(),
  },
  serverTeams: {
    listMemberships: vi.fn(),
    createMembership: vi.fn(),
    deleteMembership: vi.fn(),
  },
  serverUsers: {
    list: vi.fn(),
    updateStatus: vi.fn(),
  },
}))

const mockAccountGet = vi.fn()
vi.mock('@/lib/appwrite/session', () => ({
  createSessionClient: vi.fn(async () => ({ account: { get: mockAccountGet } })),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import {
  setProjectPlacement,
  blockUser,
  grantAdminRole,
  deleteJam,
  deleteMessage,
  listAllJams,
} from '@/lib/actions/admin'
import { serverDatabases, serverTeams, serverUsers } from '@/lib/appwrite/server'

const mockGetDocument = vi.mocked(serverDatabases.getDocument)
const mockUpdateDocument = vi.mocked(serverDatabases.updateDocument)
const mockDeleteDocument = vi.mocked(serverDatabases.deleteDocument)
const mockCreateDocument = vi.mocked(serverDatabases.createDocument)
const mockListMemberships = vi.mocked(serverTeams.listMemberships)
const mockCreateMembership = vi.mocked(serverTeams.createMembership)
const mockUpdateStatus = vi.mocked(serverUsers.updateStatus)

const PAST_END_DATE = '2020-01-01T00:00:00.000Z'
const FUTURE_END_DATE = '2999-01-01T00:00:00.000Z'

function mockProjectAndJam(jamDoc: Record<string, unknown>) {
  mockGetDocument
    .mockResolvedValueOnce({ $id: 'proj-1', jam_id: 'jam-1' } as never) // project
    .mockResolvedValueOnce({ $id: 'jam-1', ...jamDoc } as never) // jam
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUpdateDocument.mockResolvedValue({} as never)
  mockListMemberships.mockResolvedValue({ total: 0, memberships: [] } as never)
})

describe('setProjectPlacement', () => {
  it("l'organisateur de la jam peut poser un placement (jam terminée)", async () => {
    mockAccountGet.mockResolvedValue({ $id: 'organizer-1' })
    mockProjectAndJam({ organizer_id: 'organizer-1', end_date: PAST_END_DATE })

    const res = await setProjectPlacement('proj-1', 1)

    expect(res).toEqual({ success: true })
    expect(mockUpdateDocument).toHaveBeenCalledWith('konfitur-db', 'projects', 'proj-1', {
      placement: 1,
    })
  })

  it("un membre ADMIN_TEAM_ID non-organisateur peut aussi poser un placement", async () => {
    mockAccountGet.mockResolvedValue({ $id: 'admin-1' })
    mockProjectAndJam({ organizer_id: 'organizer-1', end_date: PAST_END_DATE })
    mockListMemberships.mockResolvedValue({ total: 1, memberships: [{ userId: 'admin-1' }] } as never)

    const res = await setProjectPlacement('proj-1', 2)

    expect(res).toEqual({ success: true })
    expect(mockUpdateDocument).toHaveBeenCalledWith('konfitur-db', 'projects', 'proj-1', {
      placement: 2,
    })
  })

  it('un utilisateur ni organisateur ni admin est refusé', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'random-1' })
    mockProjectAndJam({ organizer_id: 'organizer-1', end_date: PAST_END_DATE })
    mockListMemberships.mockResolvedValue({ total: 0, memberships: [] } as never)

    const res = await setProjectPlacement('proj-1', 1)

    expect(res.success).toBe(false)
    expect(res.error).toBeTruthy()
    expect(mockUpdateDocument).not.toHaveBeenCalled()
  })

  it("refuse même l'organisateur si la jam n'est pas terminée", async () => {
    mockAccountGet.mockResolvedValue({ $id: 'organizer-1' })
    mockProjectAndJam({ organizer_id: 'organizer-1', end_date: FUTURE_END_DATE })

    const res = await setProjectPlacement('proj-1', 1)

    expect(res.success).toBe(false)
    expect(res.error).toBeTruthy()
    expect(mockUpdateDocument).not.toHaveBeenCalled()
  })

  it('clampe un placement hors bornes supérieures (7 -> 3)', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'organizer-1' })
    mockProjectAndJam({ organizer_id: 'organizer-1', end_date: PAST_END_DATE })

    await setProjectPlacement('proj-1', 7)

    expect(mockUpdateDocument).toHaveBeenCalledWith('konfitur-db', 'projects', 'proj-1', {
      placement: 3,
    })
  })

  it('clampe un placement hors bornes inférieures (-2 -> 0)', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'organizer-1' })
    mockProjectAndJam({ organizer_id: 'organizer-1', end_date: PAST_END_DATE })

    await setProjectPlacement('proj-1', -2)

    expect(mockUpdateDocument).toHaveBeenCalledWith('konfitur-db', 'projects', 'proj-1', {
      placement: 0,
    })
  })

  it('sans session, refuse et ne fait aucun appel DB', async () => {
    mockAccountGet.mockRejectedValue(new Error('missing scope (account)'))

    const res = await setProjectPlacement('proj-1', 1)

    expect(res.success).toBe(false)
    expect(mockGetDocument).not.toHaveBeenCalled()
    expect(mockUpdateDocument).not.toHaveBeenCalled()
  })

  it('placement non fini (NaN) échoue sans updateDocument', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'organizer-1' })
    mockProjectAndJam({ organizer_id: 'organizer-1', end_date: PAST_END_DATE })

    const res = await setProjectPlacement('proj-1', NaN as unknown as number)

    expect(res.success).toBe(false)
    expect(res.error).toBeTruthy()
    expect(mockUpdateDocument).not.toHaveBeenCalled()
  })

  it('end_date invalide échoue sans updateDocument, même pour organisateur', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'organizer-1' })
    mockProjectAndJam({ organizer_id: 'organizer-1', end_date: 'invalid' })

    const res = await setProjectPlacement('proj-1', 1)

    expect(res.success).toBe(false)
    expect(res.error).toBeTruthy()
    expect(mockUpdateDocument).not.toHaveBeenCalled()
  })

  it("admin non-organisateur : le placement est journalisé en admin_action", async () => {
    mockAccountGet.mockResolvedValue({ $id: 'admin-1' })
    mockProjectAndJam({ organizer_id: 'organizer-1', end_date: PAST_END_DATE })
    mockListMemberships.mockResolvedValue({ total: 1, memberships: [] } as never)
    mockCreateDocument.mockResolvedValue({} as never)

    await setProjectPlacement('proj-1', 2)

    expect(mockCreateDocument).toHaveBeenCalledWith('konfitur-db', 'audit_logs', expect.any(String),
      expect.objectContaining({ type: 'admin_action', user_id: 'admin-1' }))
  })

  it("organisateur : aucune entrée d'audit", async () => {
    mockAccountGet.mockResolvedValue({ $id: 'organizer-1' })
    mockProjectAndJam({ organizer_id: 'organizer-1', end_date: PAST_END_DATE })

    await setProjectPlacement('proj-1', 1)

    expect(mockCreateDocument).not.toHaveBeenCalled()
  })
})

describe('requireAdmin — actions verrouillées', () => {
  it.each([
    ['blockUser', () => blockUser('u-cible')],
    ['grantAdminRole', () => grantAdminRole('u-cible', 'x@y.fr')],
    ['deleteJam', () => deleteJam('jam-1')],
    ['deleteMessage', () => deleteMessage('msg-1')],
  ])('%s refuse un non-admin sans écriture', async (_name, call) => {
    mockAccountGet.mockResolvedValue({ $id: 'user-lambda' })
    mockListMemberships.mockResolvedValue({ total: 0, memberships: [] } as never)
    const res = await call()
    expect(res).toMatchObject({ success: false, error: 'Accès réservé aux administrateurs.' })
    expect(mockUpdateStatus).not.toHaveBeenCalled()
    expect(mockDeleteDocument).not.toHaveBeenCalled()
    expect(mockCreateMembership).not.toHaveBeenCalled()
  })

  it('sans session : refuse avec le message exact, sans écriture', async () => {
    mockAccountGet.mockRejectedValue(new Error('no session'))
    const res = await blockUser('u-cible')
    expect(res).toMatchObject({ success: false, error: 'Accès réservé aux administrateurs.' })
    expect(mockUpdateStatus).not.toHaveBeenCalled()
  })

  it('blockUser passe pour un admin, avec audit', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'admin-1' })
    mockListMemberships.mockResolvedValue({ total: 1, memberships: [] } as never)
    mockUpdateStatus.mockResolvedValue({} as never)
    mockCreateDocument.mockResolvedValue({} as never)

    const res = await blockUser('u-cible')

    expect(res.success).toBe(true)
    expect(mockUpdateStatus).toHaveBeenCalledWith('u-cible', false)
    expect(mockCreateDocument).toHaveBeenCalledWith('konfitur-db', 'audit_logs', expect.any(String),
      expect.objectContaining({ type: 'admin_action', user_id: 'admin-1' }))
  })

  it('deleteJam admin : supprime et journalise avec le titre', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'admin-1' })
    mockListMemberships.mockResolvedValue({ total: 1, memberships: [] } as never)
    mockGetDocument.mockResolvedValue({ $id: 'jam-1', title: 'Ma Jam' } as never)
    mockDeleteDocument.mockResolvedValue({} as never)
    mockCreateDocument.mockResolvedValue({} as never)

    const res = await deleteJam('jam-1')

    expect(res.success).toBe(true)
    expect(mockDeleteDocument).toHaveBeenCalledWith('konfitur-db', 'game_jams', 'jam-1')
    expect(mockCreateDocument).toHaveBeenCalledWith('konfitur-db', 'audit_logs', expect.any(String),
      expect.objectContaining({
        type: 'admin_action',
        message: 'Suppression de la jam « Ma Jam » (jam-1)',
      }))
  })

  it('lecture listAllJams refuse un non-admin (throw message exact)', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'user-lambda' })
    mockListMemberships.mockResolvedValue({ total: 0, memberships: [] } as never)
    await expect(listAllJams()).rejects.toThrow('Accès réservé aux administrateurs.')
  })
})
