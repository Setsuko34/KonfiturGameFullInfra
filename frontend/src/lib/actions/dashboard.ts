'use server'

import { revalidatePath } from 'next/cache'
import { ID, Query } from 'node-appwrite'
import { createSessionClient } from '@/lib/appwrite/session'
import { serverDatabases } from '@/lib/appwrite/server'
import { DATABASE_ID, COLLECTIONS, BUCKETS } from '@/lib/appwrite/config'
import { mapDocToGameJam, mapDocToTeam, mapDocToTeamMember, mapDocToProject, type AppwriteDoc } from '@/lib/appwrite/types'
import type { GameJam, Team, TeamMember, Project } from '@/types'
import { validateUpdateJamData, type UpdateJamData } from '@/lib/validators'
import { computeJamStatus } from '@/lib/jam-status'
import { canActOnJam, logAdminAction } from '@/lib/appwrite/guards'
import { mergeFeed, type FeedItem } from '@/lib/dashboard-utils'
import { fetchAllDocs, fetchAllByField, FILTER_MAX } from '@/lib/appwrite/fetch-all'

// ── Lecture session utilisateur ────────────────────────────────────────────

export async function getCurrentUser() {
  const { account } = await createSessionClient()
  return account.get()
}

// ── Toutes les teams de l'utilisateur ─────────────────────────────────────

export async function getUserTeams(): Promise<
  { team: Team; members: TeamMember[]; isLeader: boolean }[]
> {
  const user = await getCurrentUser()

  const memberships = await fetchAllDocs<AppwriteDoc>(COLLECTIONS.TEAM_MEMBERS, [Query.equal('user_id', user.$id)])
  if (memberships.length === 0) return []

  const teamIds = memberships.map(m => m.team_id as string)
  const teamDocs = await fetchAllByField<AppwriteDoc>(COLLECTIONS.TEAMS, '$id', teamIds)

  return Promise.all(
    teamDocs.map(async doc => {
      const team = mapDocToTeam(doc)
      const membersRes = await serverDatabases.listDocuments(
        DATABASE_ID, COLLECTIONS.TEAM_MEMBERS,
        [Query.equal('team_id', team.id), Query.limit(20)]
      )
      team.members = membersRes.documents.map(mapDocToTeamMember)
      return {
        team,
        members: team.members,
        isLeader: doc.leader_id === user.$id,
      }
    })
  )
}

// ── Participations ─────────────────────────────────────────────────────────

export async function getUserParticipations(): Promise<{
  jams: GameJam[]
  teamsByJam: Record<string, Team>
}> {
  const user = await getCurrentUser()

  const memberships = await fetchAllDocs<AppwriteDoc>(COLLECTIONS.TEAM_MEMBERS, [Query.equal('user_id', user.$id)])
  if (memberships.length === 0) return { jams: [], teamsByJam: {} }

  const teamIds = memberships.map(m => m.team_id as string)
  const teamDocs = await fetchAllByField(COLLECTIONS.TEAMS, '$id', teamIds)
  const teams = teamDocs.map(mapDocToTeam)

  // Dédupliquer les jam IDs depuis tous les tableaux jam_ids
  const allJamIds = [...new Set(teams.flatMap(t => t.jamIds))]
  if (allJamIds.length === 0) return { jams: [], teamsByJam: {} }

  const jamDocs = await fetchAllByField(COLLECTIONS.GAME_JAMS, '$id', allJamIds)
  const jams = jamDocs.map(mapDocToGameJam)

  const teamsByJam: Record<string, Team> = {}
  for (const team of teams) {
    for (const jamId of team.jamIds) {
      teamsByJam[jamId] = team
    }
  }

  return { jams, teamsByJam }
}

// ── Jams organisées ────────────────────────────────────────────────────────

/**
 * Retourne les jams créées par l'utilisateur connecté.
 */
export async function getUserOrganizedJams(): Promise<GameJam[]> {
  const user = await getCurrentUser()

  const res = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.GAME_JAMS, [
    Query.equal('organizer_id', user.$id),
    Query.orderDesc('$createdAt'),
    Query.limit(50),
  ])

  return res.documents.map(mapDocToGameJam)
}

/**
 * Retourne une jam organisée par l'utilisateur avec ses participants et soumissions.
 */
export async function getOrganizedJamDetails(jamId: string): Promise<{
  jam: GameJam
  teams: Team[]
  projects: Project[]
}> {
  const user = await getCurrentUser()

  const jamDoc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.GAME_JAMS, jamId)

  // Organisateur OU admin (page /admin/jams/[jamId]) — lecture, pas d'audit
  if (!(await canActOnJam(user.$id, jamDoc))) {
    throw new Error('Accès non autorisé')
  }

  const jam = mapDocToGameJam(jamDoc)

  const [teamDocs, projectDocs] = await Promise.all([
    fetchAllDocs(COLLECTIONS.TEAMS, [
      Query.contains('jam_ids', jamId),
    ]),
    fetchAllDocs(COLLECTIONS.PROJECTS, [
      Query.equal('jam_id', jamId),
    ]),
  ])

  return {
    jam,
    teams: teamDocs.map(mapDocToTeam),
    projects: projectDocs.map(mapDocToProject),
  }
}

// ── Création de jam ────────────────────────────────────────────────────────

export interface CreateJamData {
  title: string
  slug: string
  theme: string
  description: string
  type: 'solo' | 'team' | 'both'
  startDate: string   // ISO string
  endDate: string     // ISO string
  duration: string
  rules: string[]
  prizes: string[]
  tags: string[]
  coverImageId?: string
}

export async function createJam(data: CreateJamData): Promise<GameJam> {
  const user = await getCurrentUser()

  const doc = await serverDatabases.createDocument(
    DATABASE_ID,
    COLLECTIONS.GAME_JAMS,
    ID.unique(),
    {
      title: data.title,
      slug: data.slug,
      theme: data.theme,
      description: data.description,
      type: data.type,
      status: 'upcoming',
      start_date: data.startDate,
      end_date: data.endDate,
      duration: data.duration,
      rules: data.rules,
      prizes: data.prizes,
      tags: data.tags,
      organizer_id: user.$id,
      ...(data.coverImageId ? { cover_image_id: data.coverImageId } : {}),
    },
    [`read("any")`, `update("user:${user.$id}")`, `delete("user:${user.$id}")`],
  )

  return mapDocToGameJam(doc)
}

// ── Dashboard utilisateur enrichi ───────────────────────────────────────────

type Doc = { $id: string; $createdAt: string; [key: string]: unknown }

/**
 * Comme fetchAllByField mais borné aux N documents les plus récents : le fil d'activité
 * n'affiche jamais que les derniers éléments. Découpe en lots de FILTER_MAX valeurs (même
 * contrainte Appwrite que fetchAllByField), interroge chaque lot avec Query.limit(n), fusionne
 * puis retrie/replafonne (l'ordre entre lots n'est pas garanti globalement par Appwrite).
 */
async function latestByField(
  collection: string,
  field: string,
  values: string[],
  queries: string[],
  n: number,
): Promise<Doc[]> {
  if (values.length === 0) return []

  const chunks = await Promise.all(
    Array.from({ length: Math.ceil(values.length / FILTER_MAX) }, (_, i) => {
      const chunk = values.slice(i * FILTER_MAX, (i + 1) * FILTER_MAX)
      return serverDatabases
        .listDocuments(DATABASE_ID, collection, [...queries, Query.equal(field, chunk), Query.limit(n)])
        .then(r => r.documents as unknown as Doc[])
        .catch(() => [] as Doc[])
    })
  )

  return chunks
    .flat()
    .sort((a, b) => new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime())
    .slice(0, n)
}

export interface UserDashboardData {
  participationsCount: number
  organizedJamsCount: number
  submittedProjectsCount: number
  likesReceived: number
  ongoingJam: GameJam | null
  upcomingJams: { id: string; title: string; startDate: Date }[]
  feed: FeedItem[]
  teams: { id: string; name: string; membersCount: number; activeJams: number; inviteCode: string }[]
  myProjects: { id: string; title: string; likes: number; comments: number }[]
}

export async function getUserDashboard(): Promise<UserDashboardData> {
  const user = await getCurrentUser()

  const list = (collection: string, queries: string[]): Promise<Doc[]> =>
    serverDatabases
      .listDocuments(DATABASE_ID, collection, queries)
      .then(r => r.documents as unknown as Doc[])
      .catch(() => [])
  const countOf = (collection: string, queries: string[]): Promise<number> =>
    serverDatabases
      .listDocuments(DATABASE_ID, collection, [...queries, Query.limit(1)])
      .then(r => r.total)
      .catch(() => 0)

  // ── Chaîne de base : mes équipes, mes jams, mes projets ──────────────────
  const membershipsRes = await fetchAllDocs<AppwriteDoc>(COLLECTIONS.TEAM_MEMBERS, [Query.equal('user_id', user.$id)])
    .catch(() => [])
  const teamIds = membershipsRes.map(m => m.team_id as string)

  const teamDocs = await fetchAllByField<AppwriteDoc>(COLLECTIONS.TEAMS, '$id', teamIds)
    .catch(() => [])
  const teams = teamDocs.map(mapDocToTeam)
  const myJamIds = [...new Set(teams.flatMap(t => t.jamIds))]

  // Ex-list() plafonné à 25 + ex-countOf('submitted') : teamIds est désormais illimité (peut
  // dépasser 100), un Query.equal dessus rejetterait la requête — fetchAllByField découpe en
  // lots de 100. Le total de projets sert à la fois à likesReceived et submittedProjectsCount
  // ci-dessous : un seul aller-retour complet plutôt que deux vues partielles/en désaccord.
  const projectDocs = await fetchAllByField<AppwriteDoc>(COLLECTIONS.PROJECTS, 'team_id', teamIds, [Query.orderDesc('$createdAt')])
    .catch(() => [])
  const projects = projectDocs.map(mapDocToProject)
  const projectIds = projects.map(p => p.id)
  const titleByProject = new Map(projects.map(p => [p.id, p.title]))
  const submittedProjectsCount = projects.filter(p => p.submitted).length

  // ── Sources parallèles ─────────────────────────────────────────────────────
  const [
    organizedJamsCount, ongoingJams, upcomingJamDocs,
    myJamDocs, commentDocs, likeDocs, announcementDocs,
    teamMemberCounts, projectCommentCounts,
  ] = await Promise.all([
    countOf(COLLECTIONS.GAME_JAMS, [Query.equal('organizer_id', user.$id)]),
    list(COLLECTIONS.GAME_JAMS, [Query.equal('status', 'ongoing'), Query.limit(1)]),
    list(COLLECTIONS.GAME_JAMS, [Query.equal('status', 'upcoming'), Query.orderAsc('start_date'), Query.limit(3)]),
    fetchAllByField<AppwriteDoc>(COLLECTIONS.GAME_JAMS, '$id', myJamIds)
      .catch(() => []),
    // Le fil d'activité ne montre que les 10 derniers (cap volontaire) mais projectIds/myJamIds
    // sont désormais illimités : latestByField découpe en lots de 100 pour ne pas se faire
    // rejeter, fusionne et replafonne à 10 côté serveur Next.
    latestByField(COLLECTIONS.COMMENTS, 'project_id', projectIds, [Query.orderDesc('$createdAt')], 10),
    latestByField(COLLECTIONS.LIKES, 'project_id', projectIds, [Query.orderDesc('$createdAt')], 10),
    latestByField(COLLECTIONS.ANNOUNCEMENTS, 'jam_id', myJamIds, [Query.orderDesc('$createdAt')], 10),
    Promise.all(teams.slice(0, 5).map(t => countOf(COLLECTIONS.TEAM_MEMBERS, [Query.equal('team_id', t.id)]))),
    Promise.all(projects.slice(0, 5).map(p => countOf(COLLECTIONS.COMMENTS, [Query.equal('project_id', p.id)]))),
  ])

  const jamTitleById = new Map(myJamDocs.map(d => [d.$id, d.title as string]))

  // ── Feed : actions des autres uniquement ──────────────────────────────────
  const commentFeed: FeedItem[] = commentDocs
    .filter(d => d.author_id !== user.$id)
    .map(d => ({
      label: `${d.author_name as string} a commenté ${titleByProject.get(d.project_id as string) ?? 'votre projet'}`,
      date: new Date(d.$createdAt),
    }))
  const likeFeed: FeedItem[] = likeDocs
    .filter(d => d.user_id !== user.$id)
    .map(d => ({
      label: `${titleByProject.get(d.project_id as string) ?? 'Votre projet'} a reçu un like`,
      date: new Date(d.$createdAt),
    }))
  const announcementFeed: FeedItem[] = announcementDocs.map(d => ({
    label: `Annonce : ${d.title as string}`,
    sublabel: jamTitleById.get(d.jam_id as string),
    date: new Date(d.$createdAt),
  }))

  return {
    participationsCount: membershipsRes.length,
    organizedJamsCount,
    submittedProjectsCount,
    likesReceived: projects.reduce((s, p) => s + p.likesCount, 0),
    ongoingJam: ongoingJams.length > 0 ? mapDocToGameJam(ongoingJams[0] as never) : null,
    upcomingJams: upcomingJamDocs.map(d => ({
      id: d.$id,
      title: d.title as string,
      startDate: new Date(d.start_date as string),
    })),
    feed: mergeFeed([commentFeed, likeFeed, announcementFeed]),
    teams: teams.slice(0, 5).map((t, i) => ({ // cap volontaire d'affichage, pas un plafond Appwrite
      id: t.id,
      name: t.name,
      membersCount: teamMemberCounts[i],
      activeJams: t.jamIds.length,
      inviteCode: t.inviteCode,
    })),
    myProjects: projects.slice(0, 5).map((p, i) => ({ // cap volontaire d'affichage, pas un plafond Appwrite
      id: p.id,
      title: p.title,
      likes: p.likesCount,
      comments: projectCommentCounts[i],
    })),
  }
}

// ── Édition jam (corrections mineures, owner only) ─────────────────────────

export async function updateJam(
  jamId: string,
  data: UpdateJamData
): Promise<{ success: boolean; error?: string }> {
  const validation = validateUpdateJamData(data)
  if (!validation.valid) return { success: false, error: validation.error }

  try {
    const user = await getCurrentUser()
    const jamDoc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.GAME_JAMS, jamId)

    const role = await canActOnJam(user.$id, jamDoc)
    if (!role) {
      return { success: false, error: 'Seul l\'organisateur peut modifier cette jam' }
    }
    if (computeJamStatus(new Date(jamDoc.start_date), new Date(jamDoc.end_date)) === 'ended') {
      return { success: false, error: 'Impossible de modifier une jam terminée' }
    }

    const patch: Record<string, unknown> = {}
    if (data.description !== undefined) patch.description = data.description.trim()
    if (data.rules !== undefined) patch.rules = data.rules
    if (data.prizes !== undefined) patch.prizes = data.prizes
    if (data.maxParticipants !== undefined) patch.max_participants = data.maxParticipants
    if (data.tags !== undefined) patch.tags = data.tags

    await serverDatabases.updateDocument(DATABASE_ID, COLLECTIONS.GAME_JAMS, jamId, patch)

    if (role === 'admin') {
      await logAdminAction(user.$id, `Édition de la jam « ${jamDoc.title} » (${jamId})`, `/jam/${jamId}`)
    }

    revalidatePath(`/dashboard/my-jams/${jamId}`)
    revalidatePath(`/jam/${jamId}`)
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { success: false, error: msg }
  }
}
