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
    const now = new Date()

    const [featuredRes, ongoingStatusRes, upcomingStatusRes, winnerProjectsRes, jamsCountRes, participantsCountRes, projectsCountRes] =
      await Promise.all([
        // Jams mises en avant par l'admin
        serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.GAME_JAMS, [
          Query.equal('featured', true),
          Query.orderAsc('featured_order'),
          Query.limit(6),
        ]),
        // Jams marquées ongoing en DB (peuvent être en retard)
        serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.GAME_JAMS, [
          Query.equal('status', 'ongoing'),
          Query.limit(5),
        ]),
        // Jams marquées upcoming en DB
        serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.GAME_JAMS, [
          Query.equal('status', 'upcoming'),
          Query.orderAsc('start_date'),
          Query.limit(10),
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

    const featuredJams = featuredRes.documents.map(mapDocToGameJam)
    const statusOngoingJams = ongoingStatusRes.documents.map(mapDocToGameJam)
    const statusUpcomingJams = upcomingStatusRes.documents.map(mapDocToGameJam)

    const isOngoing = (j: GameJam) => now >= j.startDate && now < j.endDate
    const isUpcoming = (j: GameJam) => now < j.startDate

    // Priorité : featured ongoing → n'importe quelle ongoing (date-réelle)
    const ongoingJam =
      featuredJams.find(j => isOngoing(j))
      ?? statusOngoingJams.find(j => isOngoing(j))
      ?? null

    // Upcoming : featured en premier, puis les autres, dédupliqués et triés par date
    const featuredIds = new Set(featuredJams.map(j => j.id))
    const allUpcoming = [
      ...featuredJams.filter(j => isUpcoming(j)),
      ...statusUpcomingJams.filter(j => isUpcoming(j) && !featuredIds.has(j.id)),
    ]
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
      .slice(0, 6)

    const upcomingJams = allUpcoming
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
