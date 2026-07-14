'use server'

import { revalidatePath } from 'next/cache'
import { ID, Query } from 'node-appwrite'
import { createSessionClient } from '@/lib/appwrite/session'
import { serverDatabases } from '@/lib/appwrite/server'
import { DATABASE_ID, COLLECTIONS, BUCKETS } from '@/lib/appwrite/config'
import { mapDocToGameJam, mapDocToTeam, mapDocToTeamMember, mapDocToProject } from '@/lib/appwrite/types'
import type { GameJam, Team, TeamMember, Project } from '@/types'
import { validateUpdateJamData, type UpdateJamData } from '@/lib/validators'
import { computeJamStatus } from '@/lib/jam-status'
import { canActOnJam, logAdminAction } from '@/lib/appwrite/guards'

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

  const memberships = await serverDatabases.listDocuments(
    DATABASE_ID, COLLECTIONS.TEAM_MEMBERS,
    [Query.equal('user_id', user.$id), Query.limit(50)]
  )
  if (memberships.total === 0) return []

  const teamIds = memberships.documents.map(m => m.team_id as string)
  const teamsRes = await serverDatabases.listDocuments(
    DATABASE_ID, COLLECTIONS.TEAMS,
    [Query.equal('$id', teamIds)]
  )

  return Promise.all(
    teamsRes.documents.map(async doc => {
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

  const memberships = await serverDatabases.listDocuments(
    DATABASE_ID, COLLECTIONS.TEAM_MEMBERS,
    [Query.equal('user_id', user.$id), Query.limit(50)]
  )
  if (memberships.total === 0) return { jams: [], teamsByJam: {} }

  const teamIds = memberships.documents.map(m => m.team_id as string)
  const teamsRes = await serverDatabases.listDocuments(
    DATABASE_ID, COLLECTIONS.TEAMS,
    [Query.equal('$id', teamIds)]
  )
  const teams = teamsRes.documents.map(mapDocToTeam)

  // Dédupliquer les jam IDs depuis tous les tableaux jam_ids
  const allJamIds = [...new Set(teams.flatMap(t => t.jamIds))]
  if (allJamIds.length === 0) return { jams: [], teamsByJam: {} }

  const jamsRes = await serverDatabases.listDocuments(
    DATABASE_ID, COLLECTIONS.GAME_JAMS,
    [Query.equal('$id', allJamIds)]
  )
  const jams = jamsRes.documents.map(mapDocToGameJam)

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

  const [teamsRes, projectsRes] = await Promise.all([
    serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.TEAMS, [
      Query.contains('jam_ids', jamId),
    ]),
    serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.PROJECTS, [
      Query.equal('jam_id', jamId),
    ]),
  ])

  return {
    jam,
    teams: teamsRes.documents.map(mapDocToTeam),
    projects: projectsRes.documents.map(mapDocToProject),
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

// ── Vue d'ensemble ─────────────────────────────────────────────────────────

export async function getDashboardOverview(): Promise<{
  participationsCount: number
  organizedJamsCount: number
  submittedProjectsCount: number
  ongoingJam: GameJam | null
}> {
  const user = await getCurrentUser()

  const [memberships, organizedJams, ongoingJams] = await Promise.all([
    serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.TEAM_MEMBERS, [
      Query.equal('user_id', user.$id),
      Query.limit(50),
    ]),
    serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.GAME_JAMS, [
      Query.equal('organizer_id', user.$id),
      Query.limit(1),
    ]),
    serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.GAME_JAMS, [
      Query.equal('status', 'ongoing'),
      Query.limit(1),
    ]),
  ])

  // Projets soumis : uniquement ceux des teams de l'utilisateur
  const teamIds = memberships.documents.map(m => m.team_id as string)
  let submittedProjectsCount = 0
  if (teamIds.length > 0) {
    const submissions = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.PROJECTS, [
      Query.equal('team_id', teamIds),
      Query.equal('submitted', true),
      Query.limit(1),
    ])
    submittedProjectsCount = submissions.total
  }

  return {
    participationsCount: memberships.total,
    organizedJamsCount: organizedJams.total,
    submittedProjectsCount,
    ongoingJam: ongoingJams.total > 0 ? mapDocToGameJam(ongoingJams.documents[0]) : null,
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
