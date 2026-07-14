import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/appwrite/server', () => ({
  serverDatabases: { createDocument: vi.fn() },
  serverTeams: { listMemberships: vi.fn() },
}))

import { isAdminUser, canActOnJam, canActOnTeam, logAdminAction } from '@/lib/appwrite/guards'
import { serverDatabases, serverTeams } from '@/lib/appwrite/server'

const mockMemberships = vi.mocked(serverTeams.listMemberships)
const mockCreate = vi.mocked(serverDatabases.createDocument)

beforeEach(() => { vi.clearAllMocks() })

describe('isAdminUser', () => {
  it('true si membre de la team admin', async () => {
    mockMemberships.mockResolvedValue({ total: 1, memberships: [] } as never)
    expect(await isAdminUser('u1')).toBe(true)
  })
  it('false sinon, et false (fail-closed) si la requête échoue', async () => {
    mockMemberships.mockResolvedValue({ total: 0, memberships: [] } as never)
    expect(await isAdminUser('u1')).toBe(false)
    mockMemberships.mockRejectedValue(new Error('down'))
    expect(await isAdminUser('u1')).toBe(false)
  })
})

describe('canActOnJam / canActOnTeam', () => {
  it("owner sans requête admin quand l'id correspond", async () => {
    expect(await canActOnJam('u1', { organizer_id: 'u1' })).toBe('owner')
    expect(await canActOnTeam('u1', { leader_id: 'u1' })).toBe('owner')
    expect(mockMemberships).not.toHaveBeenCalled()
  })
  it('admin quand non-propriétaire mais membre admin', async () => {
    mockMemberships.mockResolvedValue({ total: 1, memberships: [] } as never)
    expect(await canActOnJam('u2', { organizer_id: 'u1' })).toBe('admin')
  })
  it('null quand ni propriétaire ni admin', async () => {
    mockMemberships.mockResolvedValue({ total: 0, memberships: [] } as never)
    expect(await canActOnJam('u2', { organizer_id: 'u1' })).toBeNull()
    expect(await canActOnTeam('u2', { leader_id: 'u1' })).toBeNull()
  })
})

describe('logAdminAction', () => {
  it("écrit une entrée admin_action complète", async () => {
    mockCreate.mockResolvedValue({} as never)
    await logAdminAction('admin-1', 'Édition de la jam « X » (jam-1)', '/jam/jam-1')
    expect(mockCreate).toHaveBeenCalledWith('konfitur-db', 'audit_logs', expect.any(String), {
      type: 'admin_action',
      user_id: 'admin-1',
      message: 'Édition de la jam « X » (jam-1)',
      path: '/jam/jam-1',
    })
  })
  it("ne lève jamais même si l'écriture échoue", async () => {
    mockCreate.mockRejectedValue(new Error('down'))
    await expect(logAdminAction('a', 'm', '/p')).resolves.toBeUndefined()
  })
})
