'use server'

import { Query } from 'node-appwrite'
import { serverDatabases } from '@/lib/appwrite/server'
import { DATABASE_ID, COLLECTIONS, MAX_FEATURED_JAMS } from '@/lib/appwrite/config'
import { mapDocToGameJam, mapDocToProject, type AppwriteDoc } from '@/lib/appwrite/types'
import { getPopularProjects } from '@/lib/actions/projects'
import { fetchAllByField } from '@/lib/appwrite/fetch-all'
import type { GameJam, PastWinner, SiteStats, Project } from '@/types'

export async function getHomePageData(): Promise<{
  ongoingJam: GameJam | null
  upcomingJams: GameJam[]
  winners: PastWinner[]
  popularProjects: Project[]
  stats: SiteStats
}> {
  try {
    const now = new Date()

    const [featuredRes, ongoingStatusRes, upcomingStatusRes, jamsCountRes, participantsCountRes, projectsCountRes, popularProjects] =
      await Promise.all([
        // Jams mises en avant par l'admin
        serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.GAME_JAMS, [
          Query.equal('featured', true),
          Query.orderAsc('featured_order'),
          Query.limit(MAX_FEATURED_JAMS),
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
        serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.GAME_JAMS, [Query.limit(1)]),
        serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.TEAM_MEMBERS, [Query.limit(1)]),
        serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.PROJECTS, [
          Query.equal('submitted', true),
          Query.limit(1),
        ]),
        getPopularProjects(6),
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

    // Hall of Fame : les 5 dernières jams terminées.
    // limit(5) DÉLIBÉRÉ = le nombre de jams affichées (cas 4 de la règle, pas un plafond accidentel).
    // Filtre sur end_date et non sur status : le status stocké peut être en retard, ce que le reste
    // de ce fichier compense déjà (voir isOngoing). Le chemin des gagnants était le seul à ne pas le faire.
    const endedJamsRes = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.GAME_JAMS, [
      Query.lessThan('end_date', now.toISOString()),
      Query.orderDesc('end_date'),
      Query.limit(5),
    ])
    const endedJams = endedJamsRes.documents.map(mapDocToGameJam)
    const jamsMap = new Map(endedJams.map(j => [j.id, j]))

    // Leurs projets placés : TOUS. Un podium tronqué est un podium faux.
    const placed = endedJams.length > 0
      ? (await fetchAllByField<AppwriteDoc>(COLLECTIONS.PROJECTS, 'jam_id', endedJams.map(j => j.id),
          [Query.greaterThan('placement', 0)])).map(mapDocToProject)
      : []

    // Les équipes de ces projets : TOUTES.
    const teamDocs = placed.length > 0
      ? await fetchAllByField<AppwriteDoc>(COLLECTIONS.TEAMS, '$id', [...new Set(placed.map(p => p.teamId))])
      : []
    const teamsMap = new Map(teamDocs.map(d => [d.$id, d.name as string]))

    const winners: PastWinner[] = placed.map(p => {
      const jam = jamsMap.get(p.jamId)!
      return {
        id: p.id,
        jamId: p.jamId,
        jamTitle: jam.title,
        jamYear: jam.endDate.getFullYear(),
        placement: (p.placement ?? 1) as 1 | 2 | 3,
        projectTitle: p.title,
        teamName: teamsMap.get(p.teamId) ?? 'Équipe inconnue',
        coverImage: p.coverImage,
      }
    })

    // Jams les plus récemment terminées d'abord, rang 1er→3e dans chaque jam
    winners.sort((a, b) => jamsMap.get(b.jamId)!.endDate.getTime() - jamsMap.get(a.jamId)!.endDate.getTime() || a.placement - b.placement)

    const stats: SiteStats = {
      jamsOrganized: jamsCountRes.total,
      participants: participantsCountRes.total,
      projectsSubmitted: projectsCountRes.total,
      countriesRepresented: 47, // pas de champ pays dans le schéma Appwrite
    }

    return { ongoingJam, upcomingJams, winners, popularProjects, stats }
  } catch {
    // Fallback si Appwrite inaccessible — retourne des données vides
    return {
      ongoingJam: null,
      upcomingJams: [],
      winners: [],
      popularProjects: [],
      stats: { jamsOrganized: 0, participants: 0, projectsSubmitted: 0, countriesRepresented: 0 },
    }
  }
}
