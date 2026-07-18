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

import { getRecentLogs, getCountryStats, getBannedIPs, banIP, unbanIP, logAuthEvent, logClientError } from '@/lib/actions/logs'
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

// n logs minimaux, chacun avec un $id unique, pour tester la pagination au curseur
function logDocs(n: number, offset = 0) {
  return Array.from({ length: n }, (_, i) => ({
    $id: `log-${offset + i}`,
    type: 'auth',
    $createdAt: '2026-07-18T00:00:00.000Z',
  }))
}

describe('getRecentLogs — pagination au curseur', () => {
  it('retourne { logs, nextCursor } avec les logs mappés', async () => {
    asAdmin()
    mockList.mockResolvedValue({ total: 1, documents: logDocs(1) } as never)
    const { logs } = await getRecentLogs()
    expect(logs).toHaveLength(1)
    expect(logs[0].id).toBe('log-0')
  })

  it('nextCursor est null quand le lot revient incomplet (moins de 50)', async () => {
    asAdmin()
    mockList.mockResolvedValue({ total: 6, documents: logDocs(6) } as never)
    const { nextCursor } = await getRecentLogs()
    expect(nextCursor).toBeNull()
  })

  it('nextCursor pointe vers le dernier document quand le lot est plein (50)', async () => {
    asAdmin()
    mockList.mockResolvedValue({ total: 200, documents: logDocs(50) } as never)
    const { nextCursor } = await getRecentLogs()
    expect(nextCursor).toBe('log-49')
  })

  it('transmet le curseur reçu via Query.cursorAfter à Appwrite', async () => {
    asAdmin()
    mockList.mockResolvedValue({ total: 6, documents: logDocs(6, 50) } as never)
    await getRecentLogs(undefined, 'log-49')
    const queries = mockList.mock.calls[0][2] as string[]
    expect(queries).toContain(Query.cursorAfter('log-49'))
  })

  it('conserve le filtre par type en même temps que le curseur', async () => {
    asAdmin()
    mockList.mockResolvedValue({ total: 6, documents: logDocs(6, 50) } as never)
    await getRecentLogs('error', 'log-49')
    const queries = mockList.mock.calls[0][2] as string[]
    expect(queries).toContain(Query.equal('type', 'error'))
    expect(queries).toContain(Query.cursorAfter('log-49'))
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

describe('logClientError', () => {
  it("écrit une entrée type 'error' avec message, digest et path", async () => {
    mockAccountGet.mockResolvedValue({ $id: 'user-1' })
    await logClientError('TypeError: x is undefined', 'digest-abc', '/dashboard')
    expect(mockCreate).toHaveBeenCalledOnce()
    const payload = mockCreate.mock.calls[0][3] as Record<string, string>
    expect(payload.type).toBe('error')
    expect(payload.message).toContain('TypeError: x is undefined')
    expect(payload.message).toContain('digest-abc')
    expect(payload.path).toBe('/dashboard')
    expect(payload.user_id).toBe('user-1')
  })

  it('écrit le log même sans session (visiteur anonyme)', async () => {
    mockAccountGet.mockRejectedValue(new Error('no session'))
    await logClientError('crash anonyme')
    expect(mockCreate).toHaveBeenCalledOnce()
    const payload = mockCreate.mock.calls[0][3] as Record<string, string>
    expect(payload.user_id).toBeUndefined()
  })

  it('tronque le message à 512 caractères', async () => {
    mockAccountGet.mockRejectedValue(new Error('no session'))
    await logClientError('e'.repeat(2000))
    const payload = mockCreate.mock.calls[0][3] as Record<string, string>
    expect(payload.message.length).toBeLessThanOrEqual(512)
  })

  it("ne throw jamais si l'écriture échoue", async () => {
    mockAccountGet.mockRejectedValue(new Error('no session'))
    mockCreate.mockRejectedValue(new Error('DB down'))
    await expect(logClientError('crash')).resolves.toBeUndefined()
  })
})
