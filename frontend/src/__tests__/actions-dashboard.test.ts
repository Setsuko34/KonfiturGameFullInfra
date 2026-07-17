import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/appwrite/server', () => ({
  serverDatabases: {
    getDocument: vi.fn(),
    updateDocument: vi.fn(),
    createDocument: vi.fn(),
    listDocuments: vi.fn(),
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

import { updateJam, getOrganizedJamDetails, getUserDashboard } from '@/lib/actions/dashboard'
import { serverDatabases, serverTeams } from '@/lib/appwrite/server'

const mockGet = vi.mocked(serverDatabases.getDocument)
const mockUpdate = vi.mocked(serverDatabases.updateDocument)
const mockCreateDoc = vi.mocked(serverDatabases.createDocument)
const mockList = vi.mocked(serverDatabases.listDocuments)
const mockMemberships = vi.mocked(serverTeams.listMemberships)

// jam en cours : commencée hier, finit demain
const ONGOING_DATES = {
  start_date: new Date(Date.now() - 86_400_000).toISOString(),
  end_date: new Date(Date.now() + 86_400_000).toISOString(),
}

beforeEach(() => { vi.clearAllMocks() })

describe('updateJam — double garde', () => {
  it("organisateur : succès, AUCUNE entrée d'audit ni check admin", async () => {
    mockAccountGet.mockResolvedValue({ $id: 'orga-1' })
    mockGet.mockResolvedValue({ $id: 'jam-1', organizer_id: 'orga-1', title: 'X', ...ONGOING_DATES } as never)
    mockUpdate.mockResolvedValue({} as never)

    const res = await updateJam('jam-1', { description: 'd' })

    expect(res.success).toBe(true)
    expect(mockCreateDoc).not.toHaveBeenCalled() // pas d'audit pour le propriétaire
    expect(mockMemberships).not.toHaveBeenCalled() // owner court-circuite le check admin
  })

  it('admin non-organisateur : succès + audit admin_action', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'admin-1' })
    mockGet.mockResolvedValue({ $id: 'jam-1', organizer_id: 'orga-1', title: 'X', ...ONGOING_DATES } as never)
    mockMemberships.mockResolvedValue({ total: 1, memberships: [] } as never)
    mockUpdate.mockResolvedValue({} as never)
    mockCreateDoc.mockResolvedValue({} as never)

    const res = await updateJam('jam-1', { description: 'd' })

    expect(res.success).toBe(true)
    expect(mockCreateDoc).toHaveBeenCalledWith('konfitur-db', 'audit_logs', expect.any(String),
      expect.objectContaining({ type: 'admin_action', user_id: 'admin-1' }))
  })

  it('tiers : refus message exact, aucune écriture', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'tiers' })
    mockGet.mockResolvedValue({ $id: 'jam-1', organizer_id: 'orga-1', ...ONGOING_DATES } as never)
    mockMemberships.mockResolvedValue({ total: 0, memberships: [] } as never)

    const res = await updateJam('jam-1', { description: 'd' })

    expect(res).toEqual({ success: false, error: 'Seul l\'organisateur peut modifier cette jam' })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('jam terminée : refus message exact même pour un admin', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'admin-1' })
    mockGet.mockResolvedValue({
      $id: 'jam-1',
      organizer_id: 'orga-1',
      start_date: '2020-01-01T00:00:00.000Z',
      end_date: '2020-01-02T00:00:00.000Z',
    } as never)
    mockMemberships.mockResolvedValue({ total: 1, memberships: [] } as never)

    const res = await updateJam('jam-1', { description: 'd' })

    expect(res).toEqual({ success: false, error: 'Impossible de modifier une jam terminée' })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('sans session : refus, aucun appel DB', async () => {
    mockAccountGet.mockRejectedValue(new Error('no session'))

    const res = await updateJam('jam-1', { description: 'd' })

    expect(res.success).toBe(false)
    expect(mockGet).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})

describe('getOrganizedJamDetails — double garde', () => {
  it("admin non-organisateur : accès autorisé, pas d'audit (lecture)", async () => {
    mockAccountGet.mockResolvedValue({ $id: 'admin-1' })
    mockGet.mockResolvedValue({ $id: 'jam-1', organizer_id: 'orga-1', ...ONGOING_DATES } as never)
    mockMemberships.mockResolvedValue({ total: 1, memberships: [] } as never)
    mockList.mockResolvedValue({ total: 0, documents: [] } as never)

    const res = await getOrganizedJamDetails('jam-1')

    expect(res.jam.id).toBe('jam-1')
    expect(mockCreateDoc).not.toHaveBeenCalled()
  })

  it('tiers : throw message exact', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'tiers' })
    mockGet.mockResolvedValue({ $id: 'jam-1', organizer_id: 'orga-1', ...ONGOING_DATES } as never)
    mockMemberships.mockResolvedValue({ total: 0, memberships: [] } as never)

    await expect(getOrganizedJamDetails('jam-1')).rejects.toThrow('Accès non autorisé')
    expect(mockList).not.toHaveBeenCalled()
  })
})

describe('getUserDashboard', () => {
  const NOW_ISO = new Date().toISOString()

  function fullDispatch() {
    // user-1 membre de team-1 ; team-1 sur jam-1 ; projet proj-1 avec 7 likes
    mockList.mockImplementation(async (_db: string, col: string, queries: string[] = []) => {
      const q = queries.join('|')
      if (col === 'team_members' && q.includes('user-1')) {
        return { total: 2, documents: [{ $id: 'm1', team_id: 'team-1', user_id: 'user-1' }] } as never
      }
      if (col === 'team_members') return { total: 3, documents: [] } as never // membres par équipe
      if (col === 'teams') {
        return { total: 1, documents: [{ $id: 'team-1', name: 'Les Confituriers', jam_ids: ['jam-1'], invite_code: 'KG-ABCD1234', leader_id: 'user-1' }] } as never
      }
      if (col === 'game_jams' && q.includes('organizer_id')) return { total: 1, documents: [] } as never
      if (col === 'game_jams' && q.includes('upcoming')) {
        return { total: 1, documents: [{ $id: 'jam-9', title: 'Jam Future', slug: 'jf', theme: 'T', description: 'd', type: 'online', start_date: '2999-01-01T00:00:00.000Z', end_date: '2999-01-03T00:00:00.000Z', duration: '48h', organizer_id: 'u9' }] } as never
      }
      if (col === 'game_jams' && q.includes('ongoing')) return { total: 0, documents: [] } as never
      if (col === 'game_jams') {
        // jams de mes équipes (titres pour les annonces)
        return { total: 1, documents: [{ $id: 'jam-1', title: 'Ma Jam', slug: 'mj', theme: 'T', description: 'd', type: 'online', start_date: '2020-01-01T00:00:00.000Z', end_date: '2020-01-03T00:00:00.000Z', duration: '48h', organizer_id: 'u9' }] } as never
      }
      if (col === 'projects' && q.includes('submitted')) return { total: 1, documents: [] } as never
      if (col === 'projects') {
        return { total: 1, documents: [{ $id: 'proj-1', jam_id: 'jam-1', team_id: 'team-1', title: 'Mon Jeu', description: 'd', likes_count: 7 }] } as never
      }
      if (col === 'comments') {
        return { total: 1, documents: [
          { $id: 'c1', project_id: 'proj-1', author_id: 'user-2', author_name: 'Alice', content: 'GG', $createdAt: NOW_ISO },
          { $id: 'c2', project_id: 'proj-1', author_id: 'user-1', author_name: 'Moi', content: 'merci', $createdAt: NOW_ISO },
        ] } as never
      }
      if (col === 'likes') {
        return { total: 1, documents: [{ $id: 'k1', project_id: 'proj-1', user_id: 'user-3', $createdAt: NOW_ISO }] } as never
      }
      if (col === 'announcements') {
        return { total: 1, documents: [{ $id: 'an1', jam_id: 'jam-1', title: 'Thème dévoilé', content: 'c', author_id: 'u9', $createdAt: NOW_ISO }] } as never
      }
      return { total: 0, documents: [] } as never
    })
  }

  beforeEach(() => {
    mockAccountGet.mockResolvedValue({ $id: 'user-1' })
  })

  it('agrège compteurs, feed filtré et projets avec engagement', async () => {
    fullDispatch()
    const data = await getUserDashboard()

    expect(data.participationsCount).toBe(2)
    expect(data.organizedJamsCount).toBe(1)
    expect(data.submittedProjectsCount).toBe(1)
    expect(data.likesReceived).toBe(7) // somme des likes_count
    expect(data.upcomingJams[0]).toMatchObject({ id: 'jam-9', title: 'Jam Future' })
    expect(data.teams[0]).toMatchObject({ name: 'Les Confituriers', membersCount: 3, activeJams: 1, inviteCode: 'KG-ABCD1234' })
    expect(data.myProjects[0]).toMatchObject({ id: 'proj-1', title: 'Mon Jeu', likes: 7, comments: 1 })

    // Feed : le commentaire d'Alice et le like de user-3, PAS mon propre commentaire (c2 filtré)
    const labels = data.feed.map(f => f.label)
    expect(labels.some(l => l.includes('Alice'))).toBe(true)
    expect(labels.some(l => l.includes('Moi'))).toBe(false)
    expect(labels.some(l => l.includes('like'))).toBe(true)
    expect(labels.some(l => l.includes('Thème dévoilé'))).toBe(true)
  })

  it('utilisateur sans équipe : compteurs à 0, feed réduit aux annonces (aucune), pas de throw', async () => {
    mockList.mockImplementation(async (_db: string, col: string) => {
      if (col === 'team_members') return { total: 0, documents: [] } as never
      return { total: 0, documents: [] } as never
    })
    const data = await getUserDashboard()
    expect(data.participationsCount).toBe(0)
    expect(data.likesReceived).toBe(0)
    expect(data.feed).toEqual([])
    expect(data.myProjects).toEqual([])
    expect(data.teams).toEqual([])
  })

  it('sources secondaires en panne : les compteurs restent, les listes tombent à vide sans throw', async () => {
    mockList.mockImplementation(async (_db: string, col: string) => {
      if (col === 'team_members') return { total: 2, documents: [{ $id: 'm1', team_id: 'team-1' }] } as never
      throw new Error('down')
    })
    const data = await getUserDashboard()
    expect(data.participationsCount).toBe(2)
    expect(data.upcomingJams).toEqual([])
    expect(data.feed).toEqual([])
    expect(data.ongoingJam).toBeNull()
  })
})
