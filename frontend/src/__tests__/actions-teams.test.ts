// frontend/src/__tests__/actions-teams.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/appwrite/server', () => ({
  serverDatabases: {
    createDocument: vi.fn(),
    listDocuments: vi.fn(),
  },
}))

import { createTeam, joinTeamByCode } from '@/lib/actions/teams'
import { serverDatabases } from '@/lib/appwrite/server'

const mockCreate = vi.mocked(serverDatabases.createDocument)
const mockList = vi.mocked(serverDatabases.listDocuments)

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

beforeEach(() => {
  mockCreate.mockReset()
  mockList.mockReset()
})

// ────────────────────────────────────────
// generateInviteCode (via createTeam)
// ────────────────────────────────────────
describe('createTeam — format du code d\'invitation', () => {
  it("génère un code au format KG-[A-Z0-9]{8}", async () => {
    let capturedInviteCode = ''

    mockCreate.mockImplementation(async (_dbId, _colId, _docId, data) => {
      capturedInviteCode = (data as Record<string, unknown>).invite_code as string
      return makeTeamDoc({
        jam_id: 'jam-1',
        name: 'Test Team',
        invite_code: capturedInviteCode,
        leader_id: 'user-1',
      }) as never
    })

    await createTeam({ jamId: 'jam-1', name: 'Test Team', leaderId: 'user-1' })

    expect(capturedInviteCode).toMatch(/^KG-[A-Z0-9]{8}$/)
  })

  it('génère des codes différents à chaque appel', async () => {
    const codes: string[] = []

    mockCreate.mockImplementation(async (_dbId, _colId, _docId, data) => {
      const code = (data as Record<string, unknown>).invite_code as string
      codes.push(code)
      return makeTeamDoc({
        jam_id: 'jam-1',
        name: 'Team',
        invite_code: code,
        leader_id: 'user-1',
      }) as never
    })

    await createTeam({ jamId: 'jam-1', name: 'Team A', leaderId: 'user-1' })
    await createTeam({ jamId: 'jam-1', name: 'Team B', leaderId: 'user-1' })

    // Probabilité de collision : (36^8)^-1 ≈ 0 → les codes doivent être différents
    expect(codes[0]).not.toBe(codes[1])
  })

  it('retourne success:false si Appwrite échoue', async () => {
    mockCreate.mockRejectedValue(new Error('Quota dépassé'))
    const result = await createTeam({ jamId: 'jam-1', name: 'Team', leaderId: 'user-1' })
    expect(result.success).toBe(false)
    expect(result.error).toBe('Quota dépassé')
  })
})

// ────────────────────────────────────────
// joinTeamByCode — guards
// ────────────────────────────────────────
describe('joinTeamByCode — code invalide', () => {
  it("retourne une erreur si le code n'existe pas", async () => {
    // Appwrite retourne 0 documents → code inconnu
    mockList.mockResolvedValue({ documents: [], total: 0 } as never)

    const result = await joinTeamByCode('KG-INVALID1', 'user-2', 'dev', 'Bob')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/invalide/i)
  })

  it('retourne success:false si Appwrite échoue (erreur réseau)', async () => {
    mockList.mockRejectedValue(new Error('Network error'))
    const result = await joinTeamByCode('KG-ABCD1234', 'user-2', 'dev', 'Bob')
    expect(result.success).toBe(false)
    expect(result.error).toBe('Network error')
  })
})

describe('joinTeamByCode — déjà membre', () => {
  it("retourne une erreur si l'utilisateur est déjà dans l'équipe", async () => {
    const teamDoc = makeTeamDoc({
      jam_id: 'jam-1',
      name: 'Pixel Makers',
      invite_code: 'KG-ABCD1234',
      leader_id: 'user-1',
    })

    // Premier appel : le code existe
    mockList.mockResolvedValueOnce({ documents: [teamDoc], total: 1 } as never)
    // Deuxième appel : l'utilisateur est déjà membre
    mockList.mockResolvedValueOnce({
      documents: [{ $id: 'member-1' }],
      total: 1,
    } as never)

    const result = await joinTeamByCode('KG-ABCD1234', 'user-2', 'dev', 'Bob')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/déjà membre/i)

    // Vérifier que les deux appels listDocuments ciblent les bonnes collections
    expect(mockList.mock.calls[0][1]).toBe('teams')
    expect(mockList.mock.calls[1][1]).toBe('team_members')
  })
})
