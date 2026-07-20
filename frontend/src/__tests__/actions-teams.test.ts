import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Query } from 'node-appwrite'

vi.mock('@/lib/appwrite/server', () => ({
  serverDatabases: {
    createDocument: vi.fn(),
    listDocuments: vi.fn(),
    getDocument: vi.fn(),
    updateDocument: vi.fn(),
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

import {
  createTeam,
  joinTeamByCode,
  getTeamsByJam,
  getTeamById,
  updateMemberRole,
  removeMemberFromTeam,
  deleteTeam,
  renameTeam,
  registerTeamToJam,
  registerSoloToJam,
  unregisterSoloFromJam,
} from '@/lib/actions/teams'
import { serverDatabases, serverTeams } from '@/lib/appwrite/server'

const mockCreate = vi.mocked(serverDatabases.createDocument)
const mockList = vi.mocked(serverDatabases.listDocuments)
const mockUpdate = vi.mocked(serverDatabases.updateDocument)
const mockGet = vi.mocked(serverDatabases.getDocument)
const mockDelete = vi.mocked(serverDatabases.deleteDocument)
const mockMemberships = vi.mocked(serverTeams.listMemberships)

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

function makeJamDoc(fields: Record<string, unknown>) {
  return {
    $id: 'jam-1',
    $createdAt: '2026-04-01T00:00:00.000Z',
    $updatedAt: '2026-04-01T00:00:00.000Z',
    $permissions: [],
    $collectionId: 'game_jams',
    $databaseId: 'konfitur-db',
    type: 'both',
    start_date: '2999-01-01T00:00:00.000Z',
    end_date: '2999-01-03T00:00:00.000Z',
    ...fields,
  }
}

beforeEach(() => {
  // mockReset (pas clearAllMocks) : purge aussi les files mockResolvedValueOnce
  mockCreate.mockReset()
  mockList.mockReset()
  mockUpdate.mockReset()
  mockGet.mockReset()
  mockDelete.mockReset()
  mockMemberships.mockReset()
  mockAccountGet.mockReset()
})

// ── createTeam ──────────────────────────────────────────────────────────────

describe('createTeam — format du code d\'invitation', () => {
  it('génère un code au format KG-[A-Z0-9]{8}', async () => {
    let capturedCode = ''
    // Guard jam.type
    mockGet.mockResolvedValueOnce(makeJamDoc({ type: 'both' }) as never)
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
    // Guard jam.type
    mockGet.mockResolvedValueOnce(makeJamDoc({ type: 'both' }) as never)
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

describe('gardes jam.type et is_solo', () => {
  it('createTeam refuse une jam type solo', async () => {
    mockGet.mockResolvedValueOnce(makeJamDoc({ type: 'solo' }) as never)

    const res = await createTeam({ jamId: 'jam-1', name: 'Crew', leaderId: 'u-1', leaderName: 'Alice' })

    expect(res).toEqual({ success: false, error: 'Cette jam est réservée aux participants solo.' })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('registerTeamToJam refuse une jam type solo', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'leader-1' })
    mockGet
      .mockResolvedValueOnce(TEAM_DOC() as never)
      .mockResolvedValueOnce(makeJamDoc({ type: 'solo' }) as never)

    const res = await registerTeamToJam('team-1', 'jam-1')

    expect(res).toEqual({ success: false, error: 'Cette jam est réservée aux participants solo.' })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('registerTeamToJam refuse une team is_solo', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'leader-1' })
    mockGet.mockResolvedValueOnce(makeTeamDoc({
      jam_ids: ['jam-0'], name: 'Alice', invite_code: 'KG-AAAAAAAA', leader_id: 'leader-1', is_solo: true,
    }) as never)

    const res = await registerTeamToJam('team-1', 'jam-1')

    expect(res).toEqual({ success: false, error: 'Une inscription solo est liée à sa jam d\'origine.' })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('joinTeamByCode refuse une team is_solo', async () => {
    mockList.mockResolvedValueOnce({
      documents: [makeTeamDoc({ jam_ids: ['jam-1'], name: 'Alice', invite_code: 'KG-ABCD1234', leader_id: 'u-1', is_solo: true })],
      total: 1,
    } as never)

    const res = await joinTeamByCode('KG-ABCD1234', 'u-2', 'dev', 'Bob')

    expect(res).toEqual({ success: false, error: 'Ce code correspond à une inscription solo, pas à une équipe.' })
    expect(mockCreate).not.toHaveBeenCalled()
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

  it("remonte plus de 100 équipes et regroupe leurs membres en une seule requête (pas de N+1)", async () => {
    const hasPage500 = (queries: string[]) => queries.some(q => q === Query.limit(500))
    const equalValues = (queries: string[], attribute: string): string[] => {
      for (const q of queries) {
        const parsed = JSON.parse(q)
        if (parsed.method === 'equal' && parsed.attribute === attribute) return parsed.values
      }
      return []
    }
    const allTeams = Array.from({ length: 120 }, (_, i) =>
      makeTeamDoc({ $id: `t${i}`, jam_ids: ['jam-1'], name: `Crew ${i}`, invite_code: `KG-Y${i}`, leader_id: `u${i}` }))
    // 3 membres pour chacune des 120 équipes = 360 membres, dépasse l'ancien limit(20) par équipe
    const allMembers = allTeams.flatMap((t, ti) =>
      Array.from({ length: 3 }, (_, i) => makeMemberDoc({ $id: `m${ti}-${i}`, team_id: t.$id, user_id: `u${ti}-${i}` })))

    mockList.mockImplementation(async (_db: string, col: string, queries: string[] = []) => {
      const page500 = hasPage500(queries)
      if (col === 'teams') return { total: allTeams.length, documents: page500 ? allTeams : allTeams.slice(0, 25) } as never
      if (col === 'team_members') {
        const teamIdChunk = equalValues(queries, 'team_id')
        const filtered = allMembers.filter(m => teamIdChunk.includes((m as Record<string, unknown>).team_id as string))
        return { total: filtered.length, documents: filtered } as never
      }
      return { total: 0, documents: [] } as never
    })

    const teams = await getTeamsByJam('jam-1')

    expect(teams).toHaveLength(120)
    expect(teams.every(t => t.members.length === 3)).toBe(true)
    // 1 appel pour les équipes + 2 lots de membres (120 team_ids > FILTER_MAX 100) = 3 appels,
    // jamais un appel par équipe (l'ancienne boucle N+1 en aurait fait 120)
    expect(mockList).toHaveBeenCalledTimes(3)
  })
})

// ── Actions à identité session (leader OU admin) ────────────────────────────

const TEAM_DOC = () => makeTeamDoc({ jam_ids: [], name: 'Crew', invite_code: 'KG-AAAAAAAA', leader_id: 'leader-1' })

function expectAudit(userId: string) {
  expect(mockCreate).toHaveBeenCalledWith('konfitur-db', 'audit_logs', expect.any(String),
    expect.objectContaining({ type: 'admin_action', user_id: userId }))
}

describe('updateMemberRole — session + double garde', () => {
  it('leader : succès sans check admin', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'leader-1' })
    mockGet
      .mockResolvedValueOnce(TEAM_DOC() as never)
      .mockResolvedValueOnce(makeMemberDoc({ user_id: 'u-2', is_leader: false }) as never)
    mockUpdate.mockResolvedValue({} as never)

    const res = await updateMemberRole('member-1', 'team-1', 'artist')

    expect(res.success).toBe(true)
    expect(mockMemberships).not.toHaveBeenCalled()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('admin non-leader : succès + audit', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'admin-1' })
    mockMemberships.mockResolvedValue({ total: 1, memberships: [] } as never)
    mockGet
      .mockResolvedValueOnce(TEAM_DOC() as never)
      .mockResolvedValueOnce(makeMemberDoc({ user_id: 'u-2', is_leader: false }) as never)
    mockUpdate.mockResolvedValue({} as never)
    mockCreate.mockResolvedValue({} as never)

    const res = await updateMemberRole('member-1', 'team-1', 'artist')

    expect(res.success).toBe(true)
    expectAudit('admin-1')
  })

  it('tiers : refus message exact, aucune écriture', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'tiers' })
    mockMemberships.mockResolvedValue({ total: 0, memberships: [] } as never)
    mockGet.mockResolvedValueOnce(TEAM_DOC() as never)

    const res = await updateMemberRole('member-1', 'team-1', 'artist')

    expect(res).toEqual({ success: false, error: 'Seul le leader peut modifier les rôles.' })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('sans session : refus, aucun appel DB', async () => {
    mockAccountGet.mockRejectedValue(new Error('no session'))

    const res = await updateMemberRole('member-1', 'team-1', 'artist')

    expect(res.success).toBe(false)
    expect(mockGet).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})

describe('removeMemberFromTeam — session + double garde', () => {
  it('self-leave : un membre non-leader se retire lui-même (ni leader ni admin)', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'u-2' })
    mockGet
      .mockResolvedValueOnce(TEAM_DOC() as never)
      .mockResolvedValueOnce(makeMemberDoc({ user_id: 'u-2', is_leader: false }) as never)
    mockDelete.mockResolvedValue({} as never)

    const res = await removeMemberFromTeam('member-1', 'team-1')

    expect(res.success).toBe(true)
    expect(mockMemberships).not.toHaveBeenCalled()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('leader : retire un membre, succès sans audit', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'leader-1' })
    mockGet
      .mockResolvedValueOnce(TEAM_DOC() as never)
      .mockResolvedValueOnce(makeMemberDoc({ user_id: 'u-2', is_leader: false }) as never)
    mockDelete.mockResolvedValue({} as never)

    const res = await removeMemberFromTeam('member-1', 'team-1')

    expect(res.success).toBe(true)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('admin : retire un membre non-leader + audit', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'admin-1' })
    mockMemberships.mockResolvedValue({ total: 1, memberships: [] } as never)
    mockGet
      .mockResolvedValueOnce(TEAM_DOC() as never)
      .mockResolvedValueOnce(makeMemberDoc({ user_id: 'u-2', name: 'Bob', is_leader: false }) as never)
    mockDelete.mockResolvedValue({} as never)
    mockCreate.mockResolvedValue({} as never)

    const res = await removeMemberFromTeam('member-1', 'team-1')

    expect(res.success).toBe(true)
    expectAudit('admin-1')
  })

  it('admin ne peut pas retirer le leader : message exact', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'admin-1' })
    mockMemberships.mockResolvedValue({ total: 1, memberships: [] } as never)
    mockGet
      .mockResolvedValueOnce(TEAM_DOC() as never)
      .mockResolvedValueOnce(makeMemberDoc({ user_id: 'leader-1', is_leader: true }) as never)

    const res = await removeMemberFromTeam('member-1', 'team-1')

    expect(res).toEqual({ success: false, error: 'Le leader ne peut pas quitter son équipe (supprimez-la à la place).' })
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('tiers : refus message exact, aucune suppression', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'tiers' })
    mockMemberships.mockResolvedValue({ total: 0, memberships: [] } as never)
    mockGet
      .mockResolvedValueOnce(TEAM_DOC() as never)
      .mockResolvedValueOnce(makeMemberDoc({ user_id: 'u-2', is_leader: false }) as never)

    const res = await removeMemberFromTeam('member-1', 'team-1')

    expect(res).toEqual({ success: false, error: 'Action non autorisée.' })
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('sans session : refus, aucun appel DB', async () => {
    mockAccountGet.mockRejectedValue(new Error('no session'))

    const res = await removeMemberFromTeam('member-1', 'team-1')

    expect(res.success).toBe(false)
    expect(mockGet).not.toHaveBeenCalled()
    expect(mockDelete).not.toHaveBeenCalled()
  })
})

describe('deleteTeam — session + double garde', () => {
  it('leader : dissout son équipe sans audit', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'leader-1' })
    mockGet.mockResolvedValueOnce(TEAM_DOC() as never)
    mockList.mockResolvedValue({ documents: [], total: 0 } as never)
    mockDelete.mockResolvedValue({} as never)

    const res = await deleteTeam('team-1')

    expect(res.success).toBe(true)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('admin : dissolution + audit', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'admin-1' })
    mockMemberships.mockResolvedValue({ total: 1, memberships: [] } as never)
    mockGet.mockResolvedValueOnce(TEAM_DOC() as never)
    mockList.mockResolvedValue({ documents: [], total: 0 } as never)
    mockDelete.mockResolvedValue({} as never)
    mockCreate.mockResolvedValue({} as never)

    const res = await deleteTeam('team-1')

    expect(res.success).toBe(true)
    expectAudit('admin-1')
  })

  it('tiers : refus message exact, aucune suppression', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'tiers' })
    mockMemberships.mockResolvedValue({ total: 0, memberships: [] } as never)
    mockGet.mockResolvedValueOnce(TEAM_DOC() as never)

    const res = await deleteTeam('team-1')

    expect(res).toEqual({ success: false, error: 'Seul le leader peut supprimer une équipe.' })
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('sans session : refus, aucun appel DB', async () => {
    mockAccountGet.mockRejectedValue(new Error('no session'))

    const res = await deleteTeam('team-1')

    expect(res.success).toBe(false)
    expect(mockGet).not.toHaveBeenCalled()
    expect(mockDelete).not.toHaveBeenCalled()
  })
})

describe('renameTeam — session + double garde + validation', () => {
  it('leader : renomme, nom trimé, sans audit', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'leader-1' })
    mockGet.mockResolvedValueOnce(TEAM_DOC() as never)
    mockUpdate.mockResolvedValue({} as never)

    const res = await renameTeam('team-1', '  Nouveau nom  ')

    expect(res.success).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith('konfitur-db', 'teams', 'team-1', { name: 'Nouveau nom' })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('nom trop court/long : refus message exact, aucune écriture', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'leader-1' })

    for (const bad of ['ab', 'x'.repeat(51)]) {
      const res = await renameTeam('team-1', bad)
      expect(res).toEqual({ success: false, error: 'Le nom doit faire entre 3 et 50 caractères.' })
    }
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('admin : renomme + audit', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'admin-1' })
    mockMemberships.mockResolvedValue({ total: 1, memberships: [] } as never)
    mockGet.mockResolvedValueOnce(TEAM_DOC() as never)
    mockUpdate.mockResolvedValue({} as never)
    mockCreate.mockResolvedValue({} as never)

    const res = await renameTeam('team-1', 'Renommée par admin')

    expect(res.success).toBe(true)
    expectAudit('admin-1')
  })

  it('tiers : refus message exact', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'tiers' })
    mockMemberships.mockResolvedValue({ total: 0, memberships: [] } as never)
    mockGet.mockResolvedValueOnce(TEAM_DOC() as never)

    const res = await renameTeam('team-1', 'Nom valide')

    expect(res).toEqual({ success: false, error: 'Seul le leader peut renommer l\'équipe.' })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('team is_solo : refus message exact, aucune écriture', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'leader-1' })
    mockGet.mockResolvedValueOnce(makeTeamDoc({
      jam_ids: ['jam-1'], name: 'Alice', invite_code: 'KG-AAAAAAAA', leader_id: 'leader-1', is_solo: true,
    }) as never)

    const res = await renameTeam('team-1', 'Nom valide')

    expect(res).toEqual({ success: false, error: 'Une inscription solo ne peut pas être renommée.' })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('sans session : refus, aucun appel DB', async () => {
    mockAccountGet.mockRejectedValue(new Error('no session'))

    const res = await renameTeam('team-1', 'Nom valide')

    expect(res.success).toBe(false)
    expect(mockGet).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})

describe('registerTeamToJam — identité session (leader only, pas de pouvoir admin)', () => {
  it('non-leader : refus message exact, aucune écriture', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'u-2' })
    mockGet.mockResolvedValueOnce(TEAM_DOC() as never)

    const res = await registerTeamToJam('team-1', 'jam-1')

    expect(res).toEqual({ success: false, error: 'Seul le leader peut inscrire une équipe.' })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('sans session : refus, aucun appel DB', async () => {
    mockAccountGet.mockRejectedValue(new Error('no session'))

    const res = await registerTeamToJam('team-1', 'jam-1')

    expect(res.success).toBe(false)
    expect(mockGet).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})

// ── registerSoloToJam ───────────────────────────────────────────────────────

describe('registerSoloToJam', () => {
  it('refuse une jam réservée aux équipes', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'u-1', name: 'Alice' })
    mockGet.mockResolvedValueOnce(makeJamDoc({ type: 'team' }) as never)

    const res = await registerSoloToJam('jam-1')

    expect(res).toEqual({ success: false, error: 'Cette jam est réservée aux équipes.' })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('refuse une jam terminée', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'u-1', name: 'Alice' })
    mockGet.mockResolvedValueOnce(makeJamDoc({
      start_date: '2020-01-01T00:00:00.000Z',
      end_date: '2020-01-03T00:00:00.000Z',
    }) as never)

    const res = await registerSoloToJam('jam-1')

    expect(res).toEqual({ success: false, error: 'Impossible de rejoindre une jam terminée.' })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('refuse si déjà inscrit à cette jam (team ou solo)', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'u-1', name: 'Alice' })
    mockGet.mockResolvedValueOnce(makeJamDoc({}) as never)
    // isUserInTeamForJam : memberships puis teams contenant jam-1
    mockList
      .mockResolvedValueOnce({ documents: [makeMemberDoc({ team_id: 'team-x', user_id: 'u-1' })], total: 1 } as never)
      .mockResolvedValueOnce({ documents: [makeTeamDoc({ jam_ids: ['jam-1'], name: 'X', invite_code: 'KG-XXXXXXXX', leader_id: 'u-9' })], total: 1 } as never)

    const res = await registerSoloToJam('jam-1')

    expect(res.success).toBe(false)
    expect(res.error).toMatch(/déjà inscrit/i)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('succès : aucune team solo existante -> crée une team is_solo de 1 avec son membre leader', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'u-1', name: 'Alice' })
    mockGet.mockResolvedValueOnce(makeJamDoc({}) as never)
    mockList
      .mockResolvedValueOnce({ documents: [], total: 0 } as never) // aucun membership
      .mockResolvedValueOnce({ documents: [], total: 0 } as never) // aucune team solo existante
    mockCreate.mockImplementation(async (_db, col) =>
      col === 'teams'
        ? makeTeamDoc({ jam_ids: ['jam-1'], name: 'Alice', invite_code: 'KG-AAAAAAAA', leader_id: 'u-1', is_solo: true }) as never
        : makeMemberDoc({ team_id: 'team-1', user_id: 'u-1', name: 'Alice', role: 'dev', is_leader: true }) as never
    )

    const res = await registerSoloToJam('jam-1')

    expect(res.success).toBe(true)
    expect(mockCreate).toHaveBeenCalledWith('konfitur-db', 'teams', 'unique()',
      expect.objectContaining({ is_solo: true, jam_ids: ['jam-1'], name: 'Alice', leader_id: 'u-1' }))
    expect(mockCreate).toHaveBeenCalledWith('konfitur-db', 'team_members', 'unique()',
      expect.objectContaining({ user_id: 'u-1', is_leader: true }))
  })

  it('succès : team solo existante -> jam ajoutée par update, aucune création', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'u-1', name: 'Alice' })
    mockGet.mockResolvedValueOnce(makeJamDoc({ $id: 'jam-2' }) as never)
    mockList
      .mockResolvedValueOnce({ documents: [], total: 0 } as never) // aucun membership
      .mockResolvedValueOnce({
        documents: [makeTeamDoc({ jam_ids: ['jam-1'], name: 'Alice', invite_code: 'KG-AAAAAAAA', leader_id: 'u-1', is_solo: true })],
        total: 1,
      } as never) // team solo existante
    mockUpdate.mockResolvedValue({} as never)

    const res = await registerSoloToJam('jam-2')

    expect(res.success).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith('konfitur-db', 'teams', 'team-1', { jam_ids: ['jam-1', 'jam-2'] })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('sans session : refus, aucun appel DB', async () => {
    mockAccountGet.mockRejectedValue(new Error('no session'))

    const res = await registerSoloToJam('jam-1')

    expect(res.success).toBe(false)
    expect(mockGet).not.toHaveBeenCalled()
    expect(mockCreate).not.toHaveBeenCalled()
  })
})

// ── unregisterSoloFromJam ───────────────────────────────────────────────────

describe('unregisterSoloFromJam', () => {
  it('nominal : retire la jam de jam_ids, la team reste vivante', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'u-1' })
    mockList.mockResolvedValueOnce({
      documents: [makeTeamDoc({ jam_ids: ['jam-1', 'jam-2'], name: 'Alice', invite_code: 'KG-AAAAAAAA', leader_id: 'u-1', is_solo: true })],
      total: 1,
    } as never)
    mockGet.mockResolvedValueOnce(makeJamDoc({}) as never) // jam upcoming par défaut
    mockUpdate.mockResolvedValue({} as never)

    const res = await unregisterSoloFromJam('jam-1')

    expect(res.success).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith('konfitur-db', 'teams', 'team-1', { jam_ids: ['jam-2'] })
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('aucune team solo : refus message exact', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'u-1' })
    mockList.mockResolvedValueOnce({ documents: [], total: 0 } as never)

    const res = await unregisterSoloFromJam('jam-1')

    expect(res.success).toBe(false)
    expect(res.error).toBeTruthy()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("jam absente de jam_ids : refus, aucun appel jam/update", async () => {
    mockAccountGet.mockResolvedValue({ $id: 'u-1' })
    mockList.mockResolvedValueOnce({
      documents: [makeTeamDoc({ jam_ids: ['jam-2'], name: 'Alice', invite_code: 'KG-AAAAAAAA', leader_id: 'u-1', is_solo: true })],
      total: 1,
    } as never)

    const res = await unregisterSoloFromJam('jam-1')

    expect(res.success).toBe(false)
    expect(mockGet).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('jam déjà commencée : refus, aucun update', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'u-1' })
    mockList.mockResolvedValueOnce({
      documents: [makeTeamDoc({ jam_ids: ['jam-1'], name: 'Alice', invite_code: 'KG-AAAAAAAA', leader_id: 'u-1', is_solo: true })],
      total: 1,
    } as never)
    mockGet.mockResolvedValueOnce(makeJamDoc({
      start_date: '2020-01-01T00:00:00.000Z',
      end_date: '2999-01-03T00:00:00.000Z',
    }) as never) // ongoing : déjà commencée

    const res = await unregisterSoloFromJam('jam-1')

    expect(res.success).toBe(false)
    expect(res.error).toMatch(/commencé/i)
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})

// ── getTeamById — viewerRole + masquage inviteCode ──────────────────────────

describe('getTeamById — viewerRole', () => {
  function mockTeamPageFetches(memberUserIds: string[], leaderId = 'leader-1') {
    mockGet.mockResolvedValueOnce(makeTeamDoc({
      jam_ids: [], name: 'Crew', invite_code: 'KG-SECRET99', leader_id: leaderId,
    }) as never)
    mockList
      .mockResolvedValueOnce({ // team_members
        documents: memberUserIds.map((uid, i) => makeMemberDoc({ $id: `m-${i}`, team_id: 'team-1', user_id: uid, is_leader: uid === leaderId })),
        total: memberUserIds.length,
      } as never)
      .mockResolvedValueOnce({ documents: [], total: 0 } as never) // projects
  }

  it('visiteur (pas de session) : viewerRole visitor et inviteCode vidé', async () => {
    mockAccountGet.mockRejectedValue(new Error('no session'))
    mockTeamPageFetches(['leader-1', 'u-2'])

    const res = await getTeamById('team-1')

    expect(res?.viewerRole).toBe('visitor')
    expect(res?.team.inviteCode).toBe('')
  })

  it('connecté non-membre : visitor, inviteCode vidé', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'etranger' })
    mockTeamPageFetches(['leader-1', 'u-2'])

    const res = await getTeamById('team-1')

    expect(res?.viewerRole).toBe('visitor')
    expect(res?.team.inviteCode).toBe('')
  })

  it('membre : viewerRole member, viewerId rempli, inviteCode présent', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'u-2' })
    mockTeamPageFetches(['leader-1', 'u-2'])

    const res = await getTeamById('team-1')

    expect(res?.viewerRole).toBe('member')
    expect(res?.viewerId).toBe('u-2')
    expect(res?.team.inviteCode).toBe('KG-SECRET99')
  })

  it('leader : viewerRole leader', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'leader-1' })
    mockTeamPageFetches(['leader-1', 'u-2'])

    const res = await getTeamById('team-1')

    expect(res?.viewerRole).toBe('leader')
  })
})
