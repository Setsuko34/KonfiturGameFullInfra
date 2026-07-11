import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/appwrite/server', () => ({
  serverDatabases: {
    getDocument: vi.fn(),
    updateDocument: vi.fn(),
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

import { setProjectPlacement } from '@/lib/actions/admin'
import { serverDatabases, serverTeams } from '@/lib/appwrite/server'

const mockGetDocument = vi.mocked(serverDatabases.getDocument)
const mockUpdateDocument = vi.mocked(serverDatabases.updateDocument)
const mockListMemberships = vi.mocked(serverTeams.listMemberships)

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
})
