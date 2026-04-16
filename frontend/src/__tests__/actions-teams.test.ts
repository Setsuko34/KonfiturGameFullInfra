import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/appwrite/server', () => ({
  serverDatabases: {
    createDocument: vi.fn(),
    listDocuments: vi.fn(),
    getDocument: vi.fn(),
    updateDocument: vi.fn(),
    deleteDocument: vi.fn(),
  },
}))

vi.mock('@/lib/appwrite/session', () => ({
  createSessionClient: vi.fn(),
}))

import { createTeam, joinTeamByCode, getTeamsByJam } from '@/lib/actions/teams'
import { serverDatabases } from '@/lib/appwrite/server'

const mockCreate = vi.mocked(serverDatabases.createDocument)
const mockList = vi.mocked(serverDatabases.listDocuments)
const mockUpdate = vi.mocked(serverDatabases.updateDocument)

function makeTeamDoc(fields: Record<string, unknown>) {
  return {
    $id: 'team-1',
    $createdAt: '2026-04-01T00:00:00.000Z',
    $updatedAt: '2026-04-01T00:00:00.000Z',
    $permissions: [],
    $collectionId: 'teams',
    $databaseId: 'konfitur-db',
    ...fields,
  }
}

function makeMemberDoc(fields: Record<string, unknown>) {
  return {
    $id: 'member-1',
    $createdAt: '2026-04-01T00:00:00.000Z',
    $updatedAt: '2026-04-01T00:00:00.000Z',
    $permissions: [],
    $collectionId: 'team_members',
    $databaseId: 'konfitur-db',
    ...fields,
  }
}

beforeEach(() => {
  mockCreate.mockReset()
  mockList.mockReset()
  mockUpdate.mockReset()
})

// ── createTeam ──────────────────────────────────────────────────────────────

describe('createTeam — format du code d\'invitation', () => {
  it('génère un code au format KG-[A-Z0-9]{8}', async () => {
    let capturedCode = ''
    // Premier appel : vérif user déjà dans jam (aucun membre)
    mockList.mockResolvedValueOnce({ documents: [], total: 0 } as never)
    // Création team
    mockCreate.mockImplementation(async (_db, col, _id, data) => {
      if (col === 'teams') {
        capturedCode = (data as Record<string, unknown>).invite_code as string
        return makeTeamDoc({ jam_ids: ['jam-1'], name: 'Test', invite_code: capturedCode, leader_id: 'u-1' }) as never
      }
      return makeMemberDoc({ team_id: 'team-1', user_id: 'u-1', name: 'Test', role: 'dev', is_leader: true }) as never
    })

    await createTeam({ jamId: 'jam-1', name: 'Test', leaderId: 'u-1', leaderName: 'Alice' })
    expect(capturedCode).toMatch(/^KG-[A-Z0-9]{8}$/)
  })

  it('retourne success:false si Appwrite échoue', async () => {
    mockList.mockResolvedValueOnce({ documents: [], total: 0 } as never)
    mockCreate.mockRejectedValueOnce(new Error('Quota dépassé'))
    const result = await createTeam({ name: 'Team', leaderId: 'u-1', leaderName: 'Alice' })
    expect(result.success).toBe(false)
    expect(result.error).toBe('Quota dépassé')
  })

  it('bloque si le leader est déjà dans une team pour cette jam', async () => {
    // 1. memberships de l'user
    mockList.mockResolvedValueOnce({
      documents: [makeMemberDoc({ team_id: 'team-existing', user_id: 'u-1' })],
      total: 1,
    } as never)
    // 2. teams de l'user qui contiennent ce jamId
    mockList.mockResolvedValueOnce({
      documents: [makeTeamDoc({ jam_ids: ['jam-1'], name: 'Autre', invite_code: 'KG-XXXXXXXX', leader_id: 'u-2' })],
      total: 1,
    } as never)

    const result = await createTeam({ jamId: 'jam-1', name: 'Nouvelle', leaderId: 'u-1', leaderName: 'Alice' })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/déjà/i)
  })
})

// ── joinTeamByCode ──────────────────────────────────────────────────────────

describe('joinTeamByCode', () => {
  it('retourne une erreur si le code est inconnu', async () => {
    mockList.mockResolvedValueOnce({ documents: [], total: 0 } as never)
    const result = await joinTeamByCode('KG-INVALID1', 'u-2', 'dev', 'Bob')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/invalide/i)
  })

  it('retourne une erreur si déjà membre de cette team', async () => {
    mockList
      .mockResolvedValueOnce({ documents: [makeTeamDoc({ jam_ids: [], name: 'T', invite_code: 'KG-ABCD1234', leader_id: 'u-1' })], total: 1 } as never)
      .mockResolvedValueOnce({ documents: [makeMemberDoc({ team_id: 'team-1', user_id: 'u-2' })], total: 1 } as never)

    const result = await joinTeamByCode('KG-ABCD1234', 'u-2', 'dev', 'Bob')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/déjà membre/i)
  })

  it("bloque si l'user est dans une autre team pour une jam de cette team", async () => {
    // team trouvée via code, avec une jam
    mockList
      .mockResolvedValueOnce({ documents: [makeTeamDoc({ jam_ids: ['jam-1'], name: 'T', invite_code: 'KG-ABCD1234', leader_id: 'u-1' })], total: 1 } as never)
      // déjà membre ? non
      .mockResolvedValueOnce({ documents: [], total: 0 } as never)
      // memberships de u-2
      .mockResolvedValueOnce({ documents: [makeMemberDoc({ team_id: 'team-other', user_id: 'u-2' })], total: 1 } as never)
      // teams de u-2 avec jam-1
      .mockResolvedValueOnce({ documents: [makeTeamDoc({ jam_ids: ['jam-1'], name: 'Autre', invite_code: 'KG-YYYYYYYY', leader_id: 'u-3' })], total: 1 } as never)

    const result = await joinTeamByCode('KG-ABCD1234', 'u-2', 'dev', 'Bob')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/déjà inscrit/i)
  })
})

// ── getTeamsByJam ───────────────────────────────────────────────────────────

describe('getTeamsByJam', () => {
  it('retourne la liste des teams inscrites à cette jam', async () => {
    const teamDoc = makeTeamDoc({ jam_ids: ['jam-1', 'jam-2'], name: 'Crew', invite_code: 'KG-AAAAAAAA', leader_id: 'u-1' })
    mockList
      .mockResolvedValueOnce({ documents: [teamDoc], total: 1 } as never)
      .mockResolvedValueOnce({ documents: [], total: 0 } as never) // membres

    const teams = await getTeamsByJam('jam-1')
    expect(teams).toHaveLength(1)
    expect(teams[0].jamIds).toContain('jam-1')
  })
})
