'use server'

import { ID, Query } from 'node-appwrite'
import { createSessionClient } from '@/lib/appwrite/session'
import { serverDatabases } from '@/lib/appwrite/server'
import { DATABASE_ID, COLLECTIONS, BUCKETS } from '@/lib/appwrite/config'
import { mapDocToGameJam, mapDocToTeam, mapDocToTeamMember, mapDocToProject } from '@/lib/appwrite/types'
import type { GameJam, Team, TeamMember, Project } from '@/types'

// ── Lecture session utilisateur ────────────────────────────────────────────

export async function getCurrentUser() {
  const { account } = createSessionClient()
  return account.get()
}

// ── Participations ─────────────────────────────────────────────────────────

/**
 * Retourne les jams auxquelles l'utilisateur participe (via team_members).
 */
export async function getUserParticipations(): Promise<{ jams: GameJam[]; teamsByJam: Record<string, Team> }> {
  const user = await getCurrentUser()

  // Toutes les lectures utilisent serverDatabases (clé API admin) car les Server Actions
  // sont déjà protégées par le middleware session. Le scope utilisateur est appliqué
  // via Query.equal('user_id', user.$id) — pas besoin du client session ici.

  // 1. Trouver les équipes dont l'user est membre
  const memberships = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.TEAM_MEMBERS, [
    Query.equal('user_id', user.$id),
    Query.limit(50),
  ])

  if (memberships.total === 0) return { jams: [], teamsByJam: {} }

  const teamIds = memberships.documents.map(m => m.team_id)

  // 2. Récupérer les équipes
  const teamsRes = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.TEAMS, [
    Query.equal('$id', teamIds),
  ])
  const teams = teamsRes.documents.map(mapDocToTeam)

  // 3. Récupérer les jams correspondantes
  const jamIds = [...new Set(teams.map(t => t.jamId))]
  const jamsRes = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.GAME_JAMS, [
    Query.equal('$id', jamIds),
  ])
  const jams = jamsRes.documents.map(mapDocToGameJam)

  const teamsByJam: Record<string, Team> = {}
  teams.forEach(team => { teamsByJam[team.jamId] = team })

  return { jams, teamsByJam }
}

// ── Équipe active ──────────────────────────────────────────────────────────

/**
 * Retourne l'équipe active de l'utilisateur (dans une jam en cours).
 */
export async function getUserActiveTeam(): Promise<{ team: Team | null; members: TeamMember[] }> {
  const user = await getCurrentUser()

  const memberships = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.TEAM_MEMBERS, [
    Query.equal('user_id', user.$id),
    Query.limit(10),
  ])

  if (memberships.total === 0) return { team: null, members: [] }

  // Prendre le team_id le plus récent
  const latestMembership = memberships.documents[0]
  const teamDoc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.TEAMS, latestMembership.team_id)
  const team = mapDocToTeam(teamDoc)

  const membersRes = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.TEAM_MEMBERS, [
    Query.equal('team_id', team.id),
  ])
  const members = membersRes.documents.map(mapDocToTeamMember)

  return { team, members }
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

  // Vérifier que l'utilisateur est bien l'organisateur
  if (jamDoc.organizer_id !== user.$id) {
    throw new Error('Accès non autorisé')
  }

  const jam = mapDocToGameJam(jamDoc)

  const [teamsRes, projectsRes] = await Promise.all([
    serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.TEAMS, [
      Query.equal('jam_id', jamId),
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
  // coverFile intentionnellement absent : File n'est pas sérialisable
  // à travers la boundary Server Action. L'upload de cover est une
  // feature distincte (Phase 1.5) via FormData.
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
      // cover_image_id : upload déféré Phase 1.5 (File non sérialisable via Server Action)
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

  const [memberships, organizedJams, submissions, ongoingJams] = await Promise.all([
    serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.TEAM_MEMBERS, [
      Query.equal('user_id', user.$id),
      Query.limit(1),
    ]),
    serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.GAME_JAMS, [
      Query.equal('organizer_id', user.$id),
      Query.limit(1),
    ]),
    // Projets soumis de l'utilisateur : résoudre via ses team_members
    // Pour simplifier Phase 1, on compte les équipes dont l'user est leader
    // avec un project_id non-null (proxy rapide — stat exacte en Phase 1.5)
    serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.TEAMS, [
      Query.equal('leader_id', user.$id),
      Query.isNotNull('project_id'),
      Query.limit(100),
    ]),
    serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.GAME_JAMS, [
      Query.equal('status', 'ongoing'),
      Query.limit(1),
    ]),
  ])

  return {
    participationsCount: memberships.total,
    organizedJamsCount: organizedJams.total,
    submittedProjectsCount: submissions.total,  // proxy : équipes où l'user est leader avec projet
    ongoingJam: ongoingJams.total > 0 ? mapDocToGameJam(ongoingJams.documents[0]) : null,
  }
}

