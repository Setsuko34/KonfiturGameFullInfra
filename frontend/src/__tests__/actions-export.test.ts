import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Query } from 'node-appwrite'

vi.mock('@/lib/appwrite/server', () => ({
  serverDatabases: { listDocuments: vi.fn() },
}))

const mockAccountGet = vi.fn()
vi.mock('@/lib/appwrite/session', () => ({
  createSessionClient: vi.fn(async () => ({ account: { get: mockAccountGet } })),
}))

import { exportUserData } from '@/lib/actions/export'
import { serverDatabases } from '@/lib/appwrite/server'

const mockList = vi.mocked(serverDatabases.listDocuments)

beforeEach(() => { vi.clearAllMocks() })

const USER = {
  $id: 'user-1', name: 'Alice', email: 'alice@test.local',
  $createdAt: '2026-01-01T00:00:00.000+00:00', prefs: { bio: 'Ma bio' },
}

describe('exportUserData', () => {
  it('rejette sans session (fail-closed)', async () => {
    mockAccountGet.mockRejectedValue(new Error('missing session'))
    await expect(exportUserData()).rejects.toThrow()
    expect(mockList).not.toHaveBeenCalled()
  })

  it("agrège profil, memberships, messages, commentaires, likes et projets de l'utilisateur", async () => {
    mockAccountGet.mockResolvedValue(USER)
    // Toutes les collections vides sauf team_members (1 doc) — les projets sont
    // ensuite cherchés par team_id
    mockList.mockImplementation(async (_db, collection) => {
      if (collection === 'team_members') {
        return { total: 1, documents: [{ $id: 'm1', team_id: 't1', user_id: 'user-1' }] } as never
      }
      if (collection === 'projects') {
        return { total: 1, documents: [{ $id: 'p1', team_id: 't1', title: 'Mon jeu' }] } as never
      }
      if (collection === 'audit_logs') {
        return { total: 1, documents: [{ $id: 'l1', user_id: 'user-1', type: 'auth' }] } as never
      }
      return { total: 0, documents: [] } as never
    })

    const data = await exportUserData()

    expect(data.profile).toEqual({
      id: 'user-1', name: 'Alice', email: 'alice@test.local',
      bio: 'Ma bio', createdAt: '2026-01-01T00:00:00.000+00:00',
    })
    expect(data.teamMemberships).toHaveLength(1)
    expect(data.projects.map(p => p.title)).toEqual(['Mon jeu'])
    // Droit d'accès (art. 15) : logs de sécurité de l'utilisateur, filtrés par identité
    expect(data.auditLogs).toHaveLength(1)
    expect(mockList).toHaveBeenCalledWith('konfitur-db', 'audit_logs',
      expect.arrayContaining([Query.equal('user_id', 'user-1')]))
    // Les projets sont retrouvés par les team_id des memberships
    expect(mockList).toHaveBeenCalledWith('konfitur-db', 'projects',
      expect.arrayContaining([Query.equal('team_id', ['t1'])]))
    // Filtres par identité : user_id ou author_id de l'utilisateur, jamais un scan complet
    expect(mockList).toHaveBeenCalledWith('konfitur-db', 'chat_messages',
      expect.arrayContaining([Query.equal('author_id', 'user-1')]))
    expect(mockList).toHaveBeenCalledWith('konfitur-db', 'likes',
      expect.arrayContaining([Query.equal('user_id', 'user-1')]))
  })

  it('pagine au-delà de 100 documents (pas de troncature silencieuse)', async () => {
    mockAccountGet.mockResolvedValue(USER)
    const page1 = Array.from({ length: 100 }, (_, i) => ({ $id: `msg-${i}`, author_id: 'user-1' }))
    const page2 = [{ $id: 'msg-100', author_id: 'user-1' }]
    mockList.mockImplementation(async (_db, collection, queries?: string[]) => {
      if (collection !== 'chat_messages') return { total: 0, documents: [] } as never
      const offset = queries?.some(q => q.includes('"offset"') && q.includes('100'))
      return (offset
        ? { total: 101, documents: page2 }
        : { total: 101, documents: page1 }) as never
    })

    const data = await exportUserData()
    expect(data.chatMessages).toHaveLength(101)
  })

  it('renvoie des plain objects sérialisables RSC (docs Appwrite à prototype null)', async () => {
    mockAccountGet.mockResolvedValue(USER)
    mockList.mockImplementation(async (_db, collection) => {
      if (collection !== 'chat_messages') return { total: 0, documents: [] } as never
      // Reproduit un document Appwrite : objet à prototype null, refusé à la frontière RSC
      const doc = Object.assign(Object.create(null), { $id: 'msg-1', author_id: 'user-1' })
      return { total: 1, documents: [doc] } as never
    })

    const data = await exportUserData()
    expect(Object.getPrototypeOf(data.chatMessages[0])).toBe(Object.prototype)
  })
})
