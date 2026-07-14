import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Query } from 'node-appwrite'

vi.mock('@/lib/appwrite/server', () => ({
  serverDatabases: {
    listDocuments: vi.fn(),
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

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers({ 'x-forwarded-for': '1.2.3.4' })),
}))

import { getRecentLogs, getCountryStats, getBannedIPs, banIP, unbanIP, logAuthEvent } from '@/lib/actions/logs'
import { serverDatabases, serverTeams } from '@/lib/appwrite/server'

const mockList = vi.mocked(serverDatabases.listDocuments)
const mockCreate = vi.mocked(serverDatabases.createDocument)
const mockDelete = vi.mocked(serverDatabases.deleteDocument)
const mockListMemberships = vi.mocked(serverTeams.listMemberships)

beforeEach(() => { vi.clearAllMocks() })

const asAdmin = () => {
  mockAccountGet.mockResolvedValue({ $id: 'admin-1' })
  mockListMemberships.mockResolvedValue({ total: 1, memberships: [{ userId: 'admin-1' }] } as never)
}
const asNonAdmin = () => {
  mockAccountGet.mockResolvedValue({ $id: 'user-lambda' })
  mockListMemberships.mockResolvedValue({ total: 0, memberships: [] } as never)
}

describe('garde admin sur les actions logs', () => {
  it('getRecentLogs refuse un non-admin (message exact) sans lire la DB', async () => {
    asNonAdmin()
    await expect(getRecentLogs()).rejects.toThrow('Accès réservé aux administrateurs')
    expect(mockList).not.toHaveBeenCalled()
  })

  it('getCountryStats refuse un non-admin (message exact) sans lire la DB', async () => {
    asNonAdmin()
    await expect(getCountryStats()).rejects.toThrow('Accès réservé aux administrateurs')
    expect(mockList).not.toHaveBeenCalled()
  })

  it('getBannedIPs refuse un non-admin (message exact) sans lire la DB', async () => {
    asNonAdmin()
    await expect(getBannedIPs()).rejects.toThrow('Accès réservé aux administrateurs')
    expect(mockList).not.toHaveBeenCalled()
  })

  it('banIP refuse un non-admin (message exact) sans écrire', async () => {
    asNonAdmin()
    const res = await banIP('1.2.3.4', 'test')
    expect(res).toEqual({ success: false, error: 'Accès réservé aux administrateurs' })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('unbanIP refuse un non-admin (message exact) sans supprimer', async () => {
    asNonAdmin()
    await expect(unbanIP('ban-1')).rejects.toThrow('Accès réservé aux administrateurs')
    expect(mockDelete).not.toHaveBeenCalled()
  })
})

describe('getCountryStats', () => {
  it("agrège sur les logs de type 'auth' (plus 'connection')", async () => {
    asAdmin()
    mockList.mockResolvedValue({
      total: 3,
      documents: [
        { country_code: 'FR' },
        { country_code: 'FR' },
        { country_code: 'BE' },
      ],
    } as never)

    const stats = await getCountryStats()

    expect(mockList).toHaveBeenCalledWith('konfitur-db', 'audit_logs',
      expect.arrayContaining([Query.equal('type', 'auth')]))
    expect(stats[0]).toEqual({ country: 'FR', count: 2 })
  })
})

describe('logAuthEvent', () => {
  it("écrit une entrée type 'auth' avec user_id de session et IP des en-têtes", async () => {
    mockAccountGet.mockResolvedValue({ $id: 'user-1' })
    mockCreate.mockResolvedValue({} as never)

    await logAuthEvent('login')

    expect(mockCreate).toHaveBeenCalledWith('konfitur-db', 'audit_logs', expect.any(String),
      expect.objectContaining({
        type: 'auth',
        message: 'login',
        user_id: 'user-1',
        ip: '1.2.3.4',
      }))
  })

  it("ne throw jamais si l'écriture échoue", async () => {
    mockAccountGet.mockResolvedValue({ $id: 'user-1' })
    mockCreate.mockRejectedValue(new Error('down'))

    await expect(logAuthEvent('register')).resolves.toBeUndefined()
  })

  it("sans session : ne throw pas et n'écrit rien", async () => {
    mockAccountGet.mockRejectedValue(new Error('no session'))

    await expect(logAuthEvent('login')).resolves.toBeUndefined()
    expect(mockCreate).not.toHaveBeenCalled()
  })
})
