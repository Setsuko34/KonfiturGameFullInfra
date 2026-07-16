import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Query } from 'node-appwrite'

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
    get: vi.fn(),
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
  listAllTeams,
  getAdminDashboard,
} from '@/lib/actions/admin'
import { serverDatabases, serverTeams, serverUsers } from '@/lib/appwrite/server'

const mockGetDocument = vi.mocked(serverDatabases.getDocument)
const mockUpdateDocument = vi.mocked(serverDatabases.updateDocument)
const mockDeleteDocument = vi.mocked(serverDatabases.deleteDocument)
const mockCreateDocument = vi.mocked(serverDatabases.createDocument)
const mockListDocuments = vi.mocked(serverDatabases.listDocuments)
const mockListMemberships = vi.mocked(serverTeams.listMemberships)
const mockCreateMembership = vi.mocked(serverTeams.createMembership)
const mockUpdateStatus = vi.mocked(serverUsers.updateStatus)
const mockUsersGet = vi.mocked(serverUsers.get)
const mockUsersList = vi.mocked(serverUsers.list)

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

describe('listAllTeams', () => {
  it('refuse un non-admin (throw message exact)', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'user-lambda' })
    mockListMemberships.mockResolvedValue({ total: 0, memberships: [] } as never)
    await expect(listAllTeams()).rejects.toThrow('Accès réservé aux administrateurs.')
  })

  it('retourne les équipes avec leurs membres groupés en une requête', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'admin-1' })
    mockListMemberships.mockResolvedValue({ total: 1, memberships: [] } as never)
    mockListDocuments
      .mockResolvedValueOnce({ total: 2, documents: [
        { $id: 't1', jam_ids: [], name: 'Alpha', invite_code: 'KG-AAAAAAAA', leader_id: 'u1' },
        { $id: 't2', jam_ids: [], name: 'Beta', invite_code: 'KG-BBBBBBBB', leader_id: 'u2' },
      ] } as never)
      .mockResolvedValueOnce({ total: 3, documents: [
        { $id: 'm1', team_id: 't1', user_id: 'u1', name: 'Alice', role: 'dev', is_leader: true },
        { $id: 'm2', team_id: 't1', user_id: 'u3', name: 'Carol', role: 'artist', is_leader: false },
        { $id: 'm3', team_id: 't2', user_id: 'u2', name: 'Bob', role: 'dev', is_leader: true },
      ] } as never)

    const teams = await listAllTeams()

    expect(teams).toHaveLength(2)
    expect(teams[0].members).toHaveLength(2)
    expect(teams[1].members.map(m => m.name)).toEqual(['Bob'])
    expect(mockListDocuments).toHaveBeenCalledTimes(2) // pas de N+1
  })

  it('filtre par nom avec Query.contains quand search est fourni', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'admin-1' })
    mockListMemberships.mockResolvedValue({ total: 1, memberships: [] } as never)
    mockListDocuments.mockResolvedValue({ total: 0, documents: [] } as never)

    await listAllTeams('alpha')

    expect(mockListDocuments).toHaveBeenCalledWith('konfitur-db', 'teams',
      expect.arrayContaining([Query.contains('name', 'alpha')]))
  })
})

describe('getAdminDashboard', () => {
  beforeEach(() => {
    // mécanisme admin existant du fichier (requireAdmin -> isAdminUser -> listMemberships.total > 0)
    mockAccountGet.mockResolvedValue({ $id: 'admin-1' } as never)
    mockListMemberships.mockResolvedValue({ total: 1, memberships: [] } as never)
  })

  it('refuse un non-admin sans lire la DB', async () => {
    mockAccountGet.mockRejectedValue(new Error('no session'))
    await expect(getAdminDashboard()).rejects.toThrow('Accès réservé aux administrateurs.')
    expect(mockListDocuments).not.toHaveBeenCalled()
  })

  it('toutes les sources en panne : retourne des zéros et des listes vides, sans throw', async () => {
    mockUsersList.mockRejectedValue(new Error('down'))
    mockListDocuments.mockRejectedValue(new Error('down'))
    const data = await getAdminDashboard()
    expect(data.totalUsers).toBe(0)
    expect(data.totalJams).toBe(0)
    expect(data.bannedIPs).toBe(0)
    expect(data.recentJams).toEqual([])
    expect(data.recentErrors).toEqual([])
    expect(data.registrationsByDay).toHaveLength(14)
    expect(data.registrationsByDay.every(d => d.count === 0)).toBe(true)
  })

  it('agrège chaque source dans le bon champ et sépare register/login', async () => {
    const now = new Date()
    const today = now.toISOString()
    const jamDoc = {
      $id: 'jam-1', title: 'Jam Récente', slug: 'jam-r', theme: 'T', description: 'd',
      type: 'online', start_date: '2020-01-01T00:00:00.000Z', end_date: '2020-01-03T00:00:00.000Z',
      duration: '48h', organizer_id: 'u1',
    }
    mockUsersList.mockResolvedValue({ total: 142, users: [] } as never)
    mockUsersGet.mockResolvedValue({ name: 'Alice' } as never)
    mockListDocuments.mockImplementation(async (_db: string, col: string, queries: string[] = []) => {
      const q = queries.join('|')
      if (col === 'game_jams' && q.includes('orderDesc')) return { total: 12, documents: [jamDoc] } as never
      if (col === 'game_jams' && q.includes('ongoing')) return { total: 3, documents: [] } as never
      if (col === 'game_jams') return { total: 12, documents: [] } as never
      if (col === 'teams') return { total: 38, documents: [] } as never
      if (col === 'projects' && q.includes('reported')) return { total: 1, documents: [] } as never
      if (col === 'projects') return { total: 57, documents: [] } as never
      if (col === 'chat_messages') return { total: 2, documents: [] } as never
      if (col === 'banned_ips') return { total: 5, documents: [] } as never
      if (col === 'audit_logs' && q.includes('bot_blocked')) return { total: 4, documents: [] } as never
      if (col === 'audit_logs' && q.includes('register')) {
        return { total: 1, documents: [{ $id: 'l1', type: 'auth', message: 'register', user_id: 'u9', country_code: 'FR', $createdAt: today }] } as never
      }
      if (col === 'audit_logs' && q.includes('"error"')) {
        return { total: 2, documents: [{ $id: 'l2', type: 'error', message: 'boom', path: '/x', $createdAt: today }] } as never
      }
      if (col === 'audit_logs' && q.includes('auth')) {
        return { total: 3, documents: [
          { $id: 'a1', type: 'auth', message: 'register', country_code: 'FR', $createdAt: today },
          { $id: 'a2', type: 'auth', message: 'login', country_code: 'FR', $createdAt: today },
          { $id: 'a3', type: 'auth', message: 'login', country_code: 'BE', $createdAt: today },
        ] } as never
      }
      return { total: 0, documents: [] } as never
    })

    const data = await getAdminDashboard()
    expect(data.totalUsers).toBe(142)
    expect(data.totalJams).toBe(12)
    expect(data.activeJams).toBe(3)
    expect(data.totalTeams).toBe(38)
    expect(data.totalProjects).toBe(57)
    expect(data.pendingReports).toBe(3) // 2 messages + 1 projet
    expect(data.botsBlocked24h).toBe(4)
    expect(data.errors24h).toBe(2)
    expect(data.bannedIPs).toBe(5)
    expect(data.registrationsByDay.reduce((s, d) => s + d.count, 0)).toBe(1)
    expect(data.loginsByDay.reduce((s, d) => s + d.count, 0)).toBe(2)
    expect(data.recentRegistrations[0]).toMatchObject({ name: 'Alice', country: 'FR' })
    expect(data.recentJams[0]).toMatchObject({ id: 'jam-1', title: 'Jam Récente', status: 'ended' })
    expect(data.recentErrors[0]).toMatchObject({ message: 'boom', path: '/x' })
    expect(data.topCountries[0]).toEqual({ country: 'FR', count: 2 })
  })

  it("résout 'Utilisateur supprimé' quand le user d'une inscription n'existe plus", async () => {
    const today = new Date().toISOString()
    mockUsersList.mockResolvedValue({ total: 1, users: [] } as never)
    mockUsersGet.mockRejectedValue(new Error('not found'))
    mockListDocuments.mockImplementation(async (_db: string, col: string, queries: string[] = []) => {
      if (col === 'audit_logs' && queries.join('|').includes('register')) {
        return { total: 1, documents: [{ $id: 'l1', type: 'auth', message: 'register', user_id: 'gone', $createdAt: today }] } as never
      }
      return { total: 0, documents: [] } as never
    })
    const data = await getAdminDashboard()
    expect(data.recentRegistrations[0].name).toBe('Utilisateur supprimé')
  })
})
