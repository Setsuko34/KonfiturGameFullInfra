import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Query } from 'node-appwrite'

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

import { updateJam, getOrganizedJamDetails, getUserDashboard, getUserTeams, getUserParticipations } from '@/lib/actions/dashboard'
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

// Extrait les valeurs d'un Query.equal(attribute, ...) au sein du tableau de requêtes sérialisées.
function equalValues(queries: string[], attribute: string): string[] {
  for (const q of queries) {
    const parsed = JSON.parse(q)
    if (parsed.method === 'equal' && parsed.attribute === attribute) return parsed.values
  }
  return []
}

const hasPage500 = (queries: string[]) => queries.some(q => q === Query.limit(500))

describe('getUserTeams — pas de plafond', () => {
  it('remonte plus de 25 équipes (fetchAllByField contourne la page par défaut Appwrite)', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'user-1' })
    const memberships = Array.from({ length: 30 }, (_, i) => ({ $id: `m${i}`, team_id: `t${i}`, user_id: 'user-1' }))
    const allTeams = Array.from({ length: 30 }, (_, i) =>
      ({ $id: `t${i}`, name: `T${i}`, jam_ids: [], invite_code: `KG-X${i}`, leader_id: 'user-1' }))

    mockList.mockImplementation(async (_db: string, col: string, queries: string[] = []) => {
      if (col === 'team_members' && equalValues(queries, 'user_id').length > 0) {
        return { total: memberships.length, documents: memberships } as never
      }
      if (col === 'team_members') return { total: 0, documents: [] } as never // sous-appel membres par équipe
      if (col === 'teams') {
        return { total: allTeams.length, documents: hasPage500(queries) ? allTeams : allTeams.slice(0, 25) } as never
      }
      return { total: 0, documents: [] } as never
    })

    const result = await getUserTeams()
    expect(result).toHaveLength(30)
  })

  it("remonte plus de 50 adhésions (fetchAllDocs contourne l'ancien Query.limit(50) figé)", async () => {
    mockAccountGet.mockResolvedValue({ $id: 'user-1' })
    const memberships = Array.from({ length: 60 }, (_, i) => ({ $id: `m${i}`, team_id: `t${i}`, user_id: 'user-1' }))
    const allTeams = Array.from({ length: 60 }, (_, i) =>
      ({ $id: `t${i}`, name: `T${i}`, jam_ids: [], invite_code: `KG-Z${i}`, leader_id: 'user-1' }))

    mockList.mockImplementation(async (_db: string, col: string, queries: string[] = []) => {
      const page500 = hasPage500(queries)
      if (col === 'team_members' && equalValues(queries, 'user_id').length > 0) {
        // Simule l'ancien comportement Appwrite : sans le marqueur de page de fetchAllDocs
        // (Query.limit(500)), le Query.limit(50) figé de l'ancien code plafonnait ici.
        return { total: memberships.length, documents: page500 ? memberships : memberships.slice(0, 50) } as never
      }
      if (col === 'team_members') return { total: 0, documents: [] } as never
      if (col === 'teams') {
        return { total: allTeams.length, documents: page500 ? allTeams : allTeams.slice(0, 25) } as never
      }
      return { total: 0, documents: [] } as never
    })

    const result = await getUserTeams()
    expect(result).toHaveLength(60)
  })
})

describe('getUserParticipations — pas de plafond', () => {
  it('remonte plus de 25 équipes ET plus de 25 jams (fetchAllByField contourne la page par défaut Appwrite)', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'user-1' })
    const memberships = Array.from({ length: 30 }, (_, i) => ({ $id: `m${i}`, team_id: `t${i}`, user_id: 'user-1' }))
    const allTeams = Array.from({ length: 30 }, (_, i) =>
      ({ $id: `t${i}`, name: `T${i}`, jam_ids: [`j${i}`], invite_code: `KG-X${i}`, leader_id: 'user-1' }))
    const allJams = Array.from({ length: 30 }, (_, i) =>
      ({ $id: `j${i}`, title: `Jam ${i}`, slug: `jam-${i}`, theme: 'T', description: 'd', type: 'online',
        start_date: '2026-01-01T00:00:00.000Z', end_date: '2026-01-03T00:00:00.000Z', duration: '48h', organizer_id: 'u9' }))

    mockList.mockImplementation(async (_db: string, col: string, queries: string[] = []) => {
      const page500 = hasPage500(queries)
      if (col === 'team_members') return { total: memberships.length, documents: memberships } as never
      if (col === 'teams') return { total: allTeams.length, documents: page500 ? allTeams : allTeams.slice(0, 25) } as never
      if (col === 'game_jams') return { total: allJams.length, documents: page500 ? allJams : allJams.slice(0, 25) } as never
      return { total: 0, documents: [] } as never
    })

    const { jams, teamsByJam } = await getUserParticipations()
    expect(jams).toHaveLength(30)
    expect(Object.keys(teamsByJam)).toHaveLength(30)
  })

  it("remonte plus de 50 adhésions (fetchAllDocs contourne l'ancien Query.limit(50) figé)", async () => {
    mockAccountGet.mockResolvedValue({ $id: 'user-1' })
    const memberships = Array.from({ length: 60 }, (_, i) => ({ $id: `m${i}`, team_id: `t${i}`, user_id: 'user-1' }))
    const allTeams = Array.from({ length: 60 }, (_, i) =>
      ({ $id: `t${i}`, name: `T${i}`, jam_ids: [`j${i}`], invite_code: `KG-Z${i}`, leader_id: 'user-1' }))
    const allJams = Array.from({ length: 60 }, (_, i) =>
      ({ $id: `j${i}`, title: `Jam ${i}`, slug: `jam-${i}`, theme: 'T', description: 'd', type: 'online',
        start_date: '2026-01-01T00:00:00.000Z', end_date: '2026-01-03T00:00:00.000Z', duration: '48h', organizer_id: 'u9' }))

    mockList.mockImplementation(async (_db: string, col: string, queries: string[] = []) => {
      const page500 = hasPage500(queries)
      if (col === 'team_members' && equalValues(queries, 'user_id').length > 0) {
        return { total: memberships.length, documents: page500 ? memberships : memberships.slice(0, 50) } as never
      }
      if (col === 'teams') return { total: allTeams.length, documents: page500 ? allTeams : allTeams.slice(0, 25) } as never
      if (col === 'game_jams') return { total: allJams.length, documents: page500 ? allJams : allJams.slice(0, 25) } as never
      return { total: 0, documents: [] } as never
    })

    const { jams } = await getUserParticipations()
    expect(jams).toHaveLength(60)
  })
})

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

  it('remonte plus de 25 équipes ET plus de 25 projets (fetchAllDocs contourne la page par défaut Appwrite)', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'orga-1' })
    mockGet.mockResolvedValue({ $id: 'jam-1', organizer_id: 'orga-1', ...ONGOING_DATES } as never)

    const allTeams = Array.from({ length: 30 }, (_, i) => ({ $id: `t${i}`, jam_ids: ['jam-1'], name: `T${i}` }))
    const allProjects = Array.from({ length: 30 }, (_, i) => ({ $id: `p${i}`, jam_id: 'jam-1', title: `P${i}` }))
    mockList.mockImplementation(async (_db: string, col: string, queries: string[] = []) => {
      // Simule le comportement réel d'Appwrite : sans Query.limit(500) explicite (donc sans fetchAllDocs),
      // seule une page par défaut de 25 documents revient.
      const hasPage500 = queries.some(q => q === Query.limit(500))
      if (col === 'teams') return { total: allTeams.length, documents: hasPage500 ? allTeams : allTeams.slice(0, 25) } as never
      if (col === 'projects') return { total: allProjects.length, documents: hasPage500 ? allProjects : allProjects.slice(0, 25) } as never
      return { total: 0, documents: [] } as never
    })

    const res = await getOrganizedJamDetails('jam-1')

    expect(res.teams).toHaveLength(30)
    expect(res.projects).toHaveLength(30)
  })
})

describe('getUserDashboard', () => {
  const NOW_ISO = new Date().toISOString()

  function fullDispatch() {
    // user-1 membre de team-1 ; team-1 sur jam-1 ; projet proj-1 avec 7 likes
    mockList.mockImplementation(async (_db: string, col: string, queries: string[] = []) => {
      const q = queries.join('|')
      if (col === 'team_members' && q.includes('user-1')) {
        // 2 adhésions réelles : participationsCount vient désormais de fetchAllDocs(...).length,
        // plus de la métadonnée .total d'un appel Query.limit(50) unique.
        return { total: 2, documents: [
          { $id: 'm1', team_id: 'team-1', user_id: 'user-1' },
          { $id: 'm1b', team_id: 'team-1', user_id: 'user-1' },
        ] } as never
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
      if (col === 'projects') {
        // submitted: true directement sur le document — submittedProjectsCount se calcule
        // désormais localement sur le lot complet de projets, plus de countOf('submitted') séparé.
        return { total: 1, documents: [{ $id: 'proj-1', jam_id: 'jam-1', team_id: 'team-1', title: 'Mon Jeu', description: 'd', likes_count: 7, submitted: true }] } as never
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

  it('mes >25 équipes et >25 jams remontent toutes (fetchAllByField contourne la page par défaut Appwrite)', async () => {
    const memberships = Array.from({ length: 30 }, (_, i) => ({ $id: `m${i}`, team_id: `t${i}`, user_id: 'user-1' }))
    const allTeams = Array.from({ length: 30 }, (_, i) =>
      ({ $id: `t${i}`, name: `T${i}`, jam_ids: [`j${i}`], invite_code: `KG-X${i}`, leader_id: 'user-1' }))
    const jam29Announcement = { $id: 'an-29', jam_id: 'j29', title: 'Annonce tardive', content: 'c', author_id: 'u9', $createdAt: NOW_ISO }

    mockList.mockImplementation(async (_db: string, col: string, queries: string[] = []) => {
      const page500 = hasPage500(queries)
      const idFilter = equalValues(queries, '$id')
      if (col === 'team_members' && equalValues(queries, 'user_id').length > 0) {
        return { total: memberships.length, documents: memberships } as never
      }
      if (col === 'team_members') return { total: 0, documents: [] } as never // sous-appel comptage membres
      if (col === 'teams') return { total: allTeams.length, documents: page500 ? allTeams : allTeams.slice(0, 25) } as never
      if (col === 'game_jams' && idFilter.length > 0) {
        const built = idFilter.map(id => ({ $id: id, title: `Jam ${id}` }))
        return { total: built.length, documents: page500 ? built : built.slice(0, 25) } as never
      }
      if (col === 'game_jams') return { total: 0, documents: [] } as never // organizer_id / ongoing / upcoming
      if (col === 'announcements') {
        const ids = equalValues(queries, 'jam_id')
        return ids.includes('j29') ? { total: 1, documents: [jam29Announcement] } as never : { total: 0, documents: [] } as never
      }
      return { total: 0, documents: [] } as never
    })

    const data = await getUserDashboard()
    const entry = data.feed.find(f => f.label.includes('Annonce tardive'))
    expect(entry).toBeDefined()
    expect(entry?.sublabel).toBe('Jam j29')
  })

  it("participationsCount dépasse 50 (fetchAllDocs contourne l'ancien Query.limit(50) figé)", async () => {
    const memberships = Array.from({ length: 55 }, (_, i) => ({ $id: `m${i}`, team_id: `t${i}`, user_id: 'user-1' }))
    mockList.mockImplementation(async (_db: string, col: string, queries: string[] = []) => {
      const page500 = hasPage500(queries)
      if (col === 'team_members' && queries.join('|').includes('user-1')) {
        return { total: memberships.length, documents: page500 ? memberships : memberships.slice(0, 50) } as never
      }
      return { total: 0, documents: [] } as never
    })
    const data = await getUserDashboard()
    expect(data.participationsCount).toBe(55)
  })

  it('sources secondaires en panne : les compteurs restent, les listes tombent à vide sans throw', async () => {
    mockList.mockImplementation(async (_db: string, col: string) => {
      if (col === 'team_members') return { total: 2, documents: [{ $id: 'm1', team_id: 'team-1' }, { $id: 'm2', team_id: 'team-1' }] } as never
      throw new Error('down')
    })
    const data = await getUserDashboard()
    expect(data.participationsCount).toBe(2)
    expect(data.upcomingJams).toEqual([])
    expect(data.feed).toEqual([])
    expect(data.ongoingJam).toBeNull()
  })

  it("mes >150 teamIds (donc >100) : likesReceived et submittedProjectsCount comptent TOUS les projets (fetchAllByField remplace le list(limit 25) + countOf('submitted') qui se faisaient rejeter/tronquer)", async () => {
    const memberships = Array.from({ length: 150 }, (_, i) => ({ $id: `m${i}`, team_id: `t${i}`, user_id: 'user-1' }))
    const allTeams = Array.from({ length: 150 }, (_, i) =>
      ({ $id: `t${i}`, name: `T${i}`, jam_ids: [], invite_code: `KG-Y${i}`, leader_id: 'user-1' }))
    // Un projet par équipe, une valeur de likes constante, la moitié soumise.
    const allProjects = Array.from({ length: 150 }, (_, i) =>
      ({ $id: `p${i}`, team_id: `t${i}`, jam_id: 'jam-x', title: `P${i}`, likes_count: 1, submitted: i % 2 === 0 }))

    mockList.mockImplementation(async (_db: string, col: string, queries: string[] = []) => {
      const page500 = hasPage500(queries)
      if (col === 'team_members' && equalValues(queries, 'user_id').length > 0) {
        return { total: memberships.length, documents: memberships } as never
      }
      if (col === 'team_members') return { total: 0, documents: [] } as never // comptage membres par équipe
      if (col === 'teams') {
        const idFilter = equalValues(queries, '$id')
        return { total: allTeams.length, documents: page500 ? allTeams.filter(t => idFilter.includes(t.$id)) : allTeams.slice(0, 25) } as never
      }
      if (col === 'projects') {
        // Simule le vrai comportement Appwrite : un filtre Query.equal de plus de 100 valeurs
        // est REJETÉ (exception), pas tronqué — l'ancien code (list+countOf sans chunking)
        // passait teamIds entier (150) d'un coup et se faisait rejeter.
        const teamIdFilter = equalValues(queries, 'team_id')
        if (teamIdFilter.length > 100) throw new Error('Appwrite: >100 values in equal filter')
        return { total: allProjects.length, documents: allProjects.filter(p => teamIdFilter.includes(p.team_id)) } as never
      }
      return { total: 0, documents: [] } as never
    })

    const data = await getUserDashboard()
    expect(data.likesReceived).toBe(150) // pas 25 (ex-list plafonné) ni 0 (ex-countOf rejeté)
    expect(data.submittedProjectsCount).toBe(75) // moitié des 150, pas 0
  })

  it('mes >100 projectIds : le fil garde le top 10 (découpe par lots de 100 puis fusion/replafonnage, pas de rejet Appwrite)', async () => {
    const NOW = Date.now()
    // 1 seule équipe pour isoler le test du chunking sur teamIds — 150 projets dessous.
    const allProjects = Array.from({ length: 150 }, (_, i) =>
      ({ $id: `p${i}`, team_id: 'team-1', jam_id: 'jam-x', title: `Projet ${i}`, likes_count: 0, submitted: false }))
    // 15 commentaires, répartis entre le 1er lot (p0..p7, indices <100) et le 2e lot (p107..p113,
    // indices >=100) — i=0 est le plus récent, i=14 le plus ancien. Le top 10 attendu = i=0..9,
    // qui couvre bien les deux lots (preuve que la fusion inter-lots fonctionne).
    const feedComments = Array.from({ length: 15 }, (_, i) => ({
      $id: `c${i}`,
      project_id: i < 8 ? `p${i}` : `p${100 + i}`,
      author_id: 'someone-else',
      author_name: `Author${i}`,
      content: 'x',
      $createdAt: new Date(NOW - i * 60_000).toISOString(),
    }))

    let commentsCalls = 0
    mockList.mockImplementation(async (_db: string, col: string, queries: string[] = []) => {
      const page500 = hasPage500(queries)
      if (col === 'team_members' && equalValues(queries, 'user_id').length > 0) {
        return { total: 1, documents: [{ $id: 'm1', team_id: 'team-1', user_id: 'user-1' }] } as never
      }
      if (col === 'team_members') return { total: 0, documents: [] } as never
      if (col === 'teams') {
        return { total: 1, documents: [{ $id: 'team-1', name: 'T', jam_ids: [], invite_code: 'KG-Z', leader_id: 'user-1' }] } as never
      }
      if (col === 'projects') {
        return { total: allProjects.length, documents: page500 ? allProjects : allProjects.slice(0, 25) } as never
      }
      if (col === 'comments') {
        const ids = equalValues(queries, 'project_id')
        // Ne compter que les appels du fil (marqueur Query.limit(10)) — projectCommentCounts
        // interroge aussi 'comments' mais par projet unique avec Query.limit(1) (countOf).
        if (queries.some(q => q === Query.limit(10))) commentsCalls++
        if (ids.length > 100) throw new Error('Appwrite: >100 values in equal filter')
        return { total: 0, documents: feedComments.filter(c => ids.includes(c.project_id)) } as never
      }
      return { total: 0, documents: [] } as never
    })

    const data = await getUserDashboard()

    // 150 projectIds / 100 = 2 lots (100 + 50) → 2 appels chunkés sur 'comments' (fil d'activité).
    expect(commentsCalls).toBe(2)

    const commentLabels = data.feed.filter(f => f.label.includes('a commenté')).map(f => f.label)
    expect(commentLabels).toHaveLength(10)
    for (let i = 0; i < 10; i++) expect(commentLabels.some(l => l.includes(`Author${i}`))).toBe(true)
    for (let i = 10; i < 15; i++) expect(commentLabels.some(l => l.includes(`Author${i}`))).toBe(false)
  })
})
