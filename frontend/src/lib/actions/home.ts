'use server'

import { Query } from 'node-appwrite'
import { serverDatabases } from '@/lib/appwrite/server'
import { DATABASE_ID, COLLECTIONS } from '@/lib/appwrite/config'
import { mapDocToGameJam, mapDocToProject } from '@/lib/appwrite/types'
import type { GameJam, PastWinner, SiteStats } from '@/types'

export async function getHomePageData(): Promise<{
  ongoingJam: GameJam | null
  upcomingJams: GameJam[]
  winners: PastWinner[]
  stats: SiteStats
}> {
  try {
    const [ongoingRes, upcomingRes, winnerProjectsRes, jamsCountRes, participantsCountRes, projectsCountRes] =
      await Promise.all([
        serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.GAME_JAMS, [
          Query.equal('status', 'ongoing'),
          Query.limit(1),
        ]),
        serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.GAME_JAMS, [
          Query.equal('status', 'upcoming'),
          Query.orderAsc('start_date'),
          Query.limit(6),
        ]),
        serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.PROJECTS, [
          Query.equal('winner', true),
          Query.orderDesc('$createdAt'),
          Query.limit(9),
        ]),
        serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.GAME_JAMS, [Query.limit(1)]),
        serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.TEAM_MEMBERS, [Query.limit(1)]),
        serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.PROJECTS, [
          Query.equal('submitted', true),
          Query.limit(1),
        ]),
      ])

    const ongoingJam = ongoingRes.total > 0 ? mapDocToGameJam(ongoingRes.documents[0]) : null
    const upcomingJams = upcomingRes.documents.map(mapDocToGameJam)
    const winnerProjects = winnerProjectsRes.documents.map(mapDocToProject)

    // Jointure manuelle : jams et équipes des projets gagnants
    const jamIds = [...new Set(winnerProjects.map(p => p.jamId))]
    const teamIds = [...new Set(winnerProjects.map(p => p.teamId))]

    const [jamsRes, teamsRes] = jamIds.length > 0
      ? await Promise.all([
          serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.GAME_JAMS, [Query.equal('$id', jamIds)]),
          serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.TEAMS, [Query.equal('$id', teamIds)]),
        ])
      : [{ documents: [] }, { documents: [] }]

    const jamsMap = Object.fromEntries(jamsRes.documents.map(d => [d.$id, mapDocToGameJam(d)]))
    const teamsMap = Object.fromEntries(teamsRes.documents.map(d => [d.$id, d.name as string]))

    const winnersRaw: (PastWinner | null)[] = winnerProjects.map((p, i) => {
      const jam = jamsMap[p.jamId]
      if (!jam) return null
      const winner: PastWinner = {
        id: p.id,
        jamId: p.jamId,
        jamTitle: jam.title,
        jamYear: jam.endDate.getFullYear(),
        placement: ((i % 3) + 1) as 1 | 2 | 3,
        projectTitle: p.title,
        teamName: teamsMap[p.teamId] ?? 'Équipe inconnue',
        coverImage: p.coverImage,
      }
      return winner
    })
    const winners: PastWinner[] = winnersRaw.filter((w): w is PastWinner => w !== null)

    const stats: SiteStats = {
      jamsOrganized: jamsCountRes.total,
      participants: participantsCountRes.total,
      projectsSubmitted: projectsCountRes.total,
      countriesRepresented: 47, // pas de champ pays dans le schéma Appwrite
    }

    return { ongoingJam, upcomingJams, winners, stats }
  } catch {
    // Fallback si Appwrite inaccessible — retourne des données vides
    return {
      ongoingJam: null,
      upcomingJams: [],
      winners: [],
      stats: { jamsOrganized: 0, participants: 0, projectsSubmitted: 0, countriesRepresented: 0 },
    }
  }
}
