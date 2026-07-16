'use server'

import { ID, Query } from 'node-appwrite'
import { revalidatePath } from 'next/cache'
import { serverDatabases, serverUsers, serverTeams } from '@/lib/appwrite/server'
import { createSessionClient } from '@/lib/appwrite/session'
import { DATABASE_ID, COLLECTIONS, ADMIN_TEAM_ID } from '@/lib/appwrite/config'
import {
  mapDocToGameJam,
  mapDocToProject,
  mapDocToChatMessage,
  mapDocToAnnouncement,
  mapDocToTeam,
  mapDocToTeamMember,
} from '@/lib/appwrite/types'
import type { GameJam, Project, ChatMessage, Announcement, Team, TeamMember } from '@/types'
import { isAdminUser, logAdminAction } from '@/lib/appwrite/guards'
import { aggregateByDay, type DayCount } from '@/lib/dashboard-utils'

// Toute action de ce fichier est un endpoint public : la garde du layout ne suffit pas.
// Dérive l'identité de la session et exige l'appartenance admin — fail-closed.
async function requireAdmin(): Promise<{ userId: string } | null> {
  try {
    const { account } = await createSessionClient()
    const user = await account.get()
    return (await isAdminUser(user.$id)) ? { userId: user.$id } : null
  } catch {
    return null
  }
}

// Variante pour les lectures (retournent des données, pas de { success }) — throw fail-closed
async function requireAdminOrThrow(): Promise<{ userId: string }> {
  const admin = await requireAdmin()
  if (!admin) throw new Error('Accès réservé aux administrateurs.')
  return admin
}

const REFUS_ADMIN = { success: false as const, error: 'Accès réservé aux administrateurs.' }

export interface AdminDashboardData {
  totalUsers: number
  totalJams: number
  activeJams: number
  totalTeams: number
  totalProjects: number
  pendingReports: number
  botsBlocked24h: number
  errors24h: number
  bannedIPs: number
  registrationsByDay: DayCount[]
  loginsByDay: DayCount[]
  recentRegistrations: { name: string; country?: string; date: Date }[]
  recentJams: { id: string; title: string; status: string }[]
  recentErrors: { message: string; path?: string; date: Date }[]
  topCountries: { country: string; count: number }[]
}

const DASHBOARD_DAYS = 14

export async function getAdminDashboard(): Promise<AdminDashboardData> {
  await requireAdminOrThrow()
  const now = new Date()
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const periodStart = new Date(now.getTime() - DASHBOARD_DAYS * 24 * 60 * 60 * 1000).toISOString()

  // Compteur pas cher : limit(1) + .total, fallback 0 par source
  const count = (collection: string, queries: string[] = []): Promise<number> =>
    serverDatabases
      .listDocuments(DATABASE_ID, collection, [...queries, Query.limit(1)])
      .then(r => r.total)
      .catch(() => 0)

  type Doc = { $id: string; $createdAt: string; [key: string]: unknown }
  const list = (collection: string, queries: string[]): Promise<Doc[]> =>
    serverDatabases
      .listDocuments(DATABASE_ID, collection, queries)
      .then(r => r.documents as unknown as Doc[])
      .catch(() => [])

  const [
    totalUsers, totalJams, activeJams, totalTeams, totalProjects,
    reportedMessages, reportedProjects, botsBlocked24h, errors24h, bannedIPs,
    authLogs, registerDocs, recentJamDocs, errorDocs,
  ] = await Promise.all([
    serverUsers.list([Query.limit(1)]).then(r => r.total).catch(() => 0),
    count(COLLECTIONS.GAME_JAMS),
    count(COLLECTIONS.GAME_JAMS, [Query.equal('status', 'ongoing')]),
    count(COLLECTIONS.TEAMS),
    count(COLLECTIONS.PROJECTS),
    count(COLLECTIONS.CHAT_MESSAGES, [Query.equal('reported', true)]),
    count(COLLECTIONS.PROJECTS, [Query.equal('reported', true)]),
    count(COLLECTIONS.AUDIT_LOGS, [Query.equal('type', 'bot_blocked'), Query.greaterThan('$createdAt', dayAgo)]),
    count(COLLECTIONS.AUDIT_LOGS, [Query.equal('type', 'error'), Query.greaterThan('$createdAt', dayAgo)]),
    count(COLLECTIONS.BANNED_IPS),
    list(COLLECTIONS.AUDIT_LOGS, [
      Query.equal('type', 'auth'),
      Query.greaterThan('$createdAt', periodStart),
      Query.orderDesc('$createdAt'),
      Query.limit(1000),
    ]),
    list(COLLECTIONS.AUDIT_LOGS, [
      Query.equal('type', 'auth'),
      Query.equal('message', 'register'),
      Query.orderDesc('$createdAt'),
      Query.limit(5),
    ]),
    list(COLLECTIONS.GAME_JAMS, [Query.orderDesc('$createdAt'), Query.limit(5)]),
    list(COLLECTIONS.AUDIT_LOGS, [Query.equal('type', 'error'), Query.orderDesc('$createdAt'), Query.limit(5)]),
  ])

  // Noms des derniers inscrits (user supprimé → libellé de repli)
  const recentRegistrations = await Promise.all(
    registerDocs.map(async doc => ({
      name: doc.user_id
        ? await serverUsers.get(doc.user_id as string).then(u => u.name).catch(() => 'Utilisateur supprimé')
        : 'Inconnu',
      country: (doc.country_code as string) || undefined,
      date: new Date(doc.$createdAt),
    }))
  )

  // Top pays sur la même fenêtre 14 j que les graphes
  const countryCounts: Record<string, number> = {}
  for (const doc of authLogs) {
    const cc = (doc.country_code as string) || 'XX'
    countryCounts[cc] = (countryCounts[cc] ?? 0) + 1
  }
  const topCountries = Object.entries(countryCounts)
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)

  return {
    totalUsers,
    totalJams,
    activeJams,
    totalTeams,
    totalProjects,
    pendingReports: reportedMessages + reportedProjects,
    botsBlocked24h,
    errors24h,
    bannedIPs,
    registrationsByDay: aggregateByDay(
      authLogs.filter(d => d.message === 'register').map(d => d.$createdAt), DASHBOARD_DAYS, now),
    loginsByDay: aggregateByDay(
      authLogs.filter(d => d.message === 'login').map(d => d.$createdAt), DASHBOARD_DAYS, now),
    recentRegistrations,
    recentJams: recentJamDocs.map(doc => {
      const jam = mapDocToGameJam(doc as never)
      return { id: jam.id, title: jam.title, status: jam.status }
    }),
    recentErrors: errorDocs.map(doc => ({
      message: (doc.message as string) ?? '',
      path: (doc.path as string) || undefined,
      date: new Date(doc.$createdAt),
    })),
    topCountries,
  }
}

// ── Gestion utilisateurs ───────────────────────────────────────────────────

export async function listUsers(page = 0, search = '') {
  await requireAdminOrThrow()
  const queries: string[] = [Query.limit(25), Query.offset(page * 25)]
  if (search) queries.push(Query.search('name', search))
  return serverUsers.list(queries)
}

export async function blockUser(userId: string): Promise<{ success: boolean; error?: string }> {
  const admin = await requireAdmin()
  if (!admin) return REFUS_ADMIN
  await serverUsers.updateStatus(userId, false)
  await logAdminAction(admin.userId, `Blocage de l'utilisateur (${userId})`, '/admin/users')
  revalidatePath('/admin/users')
  return { success: true }
}

export async function unblockUser(userId: string): Promise<{ success: boolean; error?: string }> {
  const admin = await requireAdmin()
  if (!admin) return REFUS_ADMIN
  await serverUsers.updateStatus(userId, true)
  await logAdminAction(admin.userId, `Déblocage de l'utilisateur (${userId})`, '/admin/users')
  revalidatePath('/admin/users')
  return { success: true }
}

export async function grantAdminRole(userId: string, email: string): Promise<{ success: boolean; error?: string }> {
  const admin = await requireAdmin()
  if (!admin) return REFUS_ADMIN
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  // node-appwrite Teams.createMembership : 6 paramètres (teamId, roles, email, userId, name, redirectUrl)
  await serverTeams.createMembership(
    ADMIN_TEAM_ID,
    [],
    email,
    userId,
    '',
    `${siteUrl}/admin`,
  )
  await logAdminAction(admin.userId, `Promotion admin de ${email} (${userId})`, '/admin/users')
  revalidatePath('/admin/users')
  return { success: true }
}

export async function revokeAdminRole(membershipId: string): Promise<{ success: boolean; error?: string }> {
  const admin = await requireAdmin()
  if (!admin) return REFUS_ADMIN
  await serverTeams.deleteMembership(ADMIN_TEAM_ID, membershipId)
  await logAdminAction(admin.userId, `Révocation du rôle admin (${membershipId})`, '/admin/users')
  revalidatePath('/admin/users')
  return { success: true }
}

// ── Gestion des jams ───────────────────────────────────────────────────────

export async function listAllJams(status?: string, page = 0): Promise<GameJam[]> {
  await requireAdminOrThrow()
  const queries: string[] = [
    Query.orderDesc('$createdAt'),
    Query.limit(25),
    Query.offset(page * 25),
  ]
  if (status) queries.push(Query.equal('status', status))
  const res = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.GAME_JAMS, queries)
  return res.documents.map(mapDocToGameJam)
}

export async function deleteJam(jamId: string): Promise<{ success: boolean; error?: string }> {
  const admin = await requireAdmin()
  if (!admin) return REFUS_ADMIN
  const jamDoc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.GAME_JAMS, jamId)
  await serverDatabases.deleteDocument(DATABASE_ID, COLLECTIONS.GAME_JAMS, jamId)
  await logAdminAction(admin.userId, `Suppression de la jam « ${jamDoc.title} » (${jamId})`, `/jam/${jamId}`)
  revalidatePath('/admin/jams')
  revalidatePath('/admin')
  return { success: true }
}

export async function toggleJamFeatured(jamId: string, featured: boolean, featuredOrder?: number): Promise<{ success: boolean; error?: string }> {
  const admin = await requireAdmin()
  if (!admin) return REFUS_ADMIN
  await serverDatabases.updateDocument(DATABASE_ID, COLLECTIONS.GAME_JAMS, jamId, {
    featured,
    ...(featuredOrder !== undefined ? { featured_order: featuredOrder } : {}),
  })
  await logAdminAction(admin.userId, `Mise en avant ${featured ? 'activée' : 'retirée'} sur la jam (${jamId})`, `/jam/${jamId}`)
  revalidatePath('/admin/jams')
  revalidatePath('/admin/featured')
  return { success: true }
}

// ── Gestion des équipes ────────────────────────────────────────────────────

export async function listAllTeams(search = '', page = 0): Promise<Team[]> {
  await requireAdminOrThrow()
  const queries: string[] = [
    Query.orderDesc('$createdAt'),
    Query.limit(25),
    Query.offset(page * 25),
  ]
  if (search) queries.push(Query.contains('name', search))
  const res = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.TEAMS, queries)
  const teams = res.documents.map(mapDocToTeam)

  if (teams.length > 0) {
    // Membres de tout le lot en UNE requête (25 équipes × ~20 membres max < limite 500)
    const membersRes = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.TEAM_MEMBERS, [
      Query.equal('team_id', teams.map(t => t.id)),
      Query.limit(500),
    ])
    const byTeam = new Map<string, TeamMember[]>()
    for (const doc of membersRes.documents) {
      const list = byTeam.get(doc.team_id as string) ?? []
      list.push(mapDocToTeamMember(doc))
      byTeam.set(doc.team_id as string, list)
    }
    for (const team of teams) team.members = byTeam.get(team.id) ?? []
  }
  return teams
}

// ── Modération ─────────────────────────────────────────────────────────────

export async function listReportedMessages(page = 0): Promise<ChatMessage[]> {
  await requireAdminOrThrow()
  const res = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.CHAT_MESSAGES, [
    Query.equal('reported', true),
    Query.orderDesc('$createdAt'),
    Query.limit(20),
    Query.offset(page * 20),
  ])
  return res.documents.map(mapDocToChatMessage)
}

export async function listReportedProjects(page = 0): Promise<Project[]> {
  await requireAdminOrThrow()
  const res = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.PROJECTS, [
    Query.equal('reported', true),
    Query.orderDesc('$createdAt'),
    Query.limit(20),
    Query.offset(page * 20),
  ])
  return res.documents.map(mapDocToProject)
}

export async function deleteMessage(messageId: string): Promise<{ success: boolean; error?: string }> {
  const admin = await requireAdmin()
  if (!admin) return REFUS_ADMIN
  await serverDatabases.deleteDocument(DATABASE_ID, COLLECTIONS.CHAT_MESSAGES, messageId)
  await logAdminAction(admin.userId, `Suppression du message (${messageId})`, '/admin/moderation')
  revalidatePath('/admin/moderation')
  revalidatePath('/admin')
  return { success: true }
}

export async function resolveMessageReport(messageId: string): Promise<{ success: boolean; error?: string }> {
  const admin = await requireAdmin()
  if (!admin) return REFUS_ADMIN
  await serverDatabases.updateDocument(DATABASE_ID, COLLECTIONS.CHAT_MESSAGES, messageId, {
    reported: false,
  })
  await logAdminAction(admin.userId, `Résolution du signalement de message (${messageId})`, '/admin/moderation')
  revalidatePath('/admin/moderation')
  revalidatePath('/admin')
  return { success: true }
}

export async function resolveProjectReport(projectId: string): Promise<{ success: boolean; error?: string }> {
  const admin = await requireAdmin()
  if (!admin) return REFUS_ADMIN
  await serverDatabases.updateDocument(DATABASE_ID, COLLECTIONS.PROJECTS, projectId, {
    reported: false,
  })
  await logAdminAction(admin.userId, `Résolution du signalement de projet (${projectId})`, '/admin/moderation')
  revalidatePath('/admin/moderation')
  revalidatePath('/admin')
  return { success: true }
}

// ── Annonces ───────────────────────────────────────────────────────────────

// jam_id = 'all' → annonce globale plateforme
// jam_id = <jamId> → annonce ciblée sur une jam

export interface CreateAnnouncementData {
  title: string
  content: string
  jamId: string   // 'all' pour global
  important: boolean
  authorId: string
  authorName: string
}

export async function createAnnouncement(data: CreateAnnouncementData): Promise<{ success: boolean; error?: string }> {
  const admin = await requireAdmin()
  if (!admin) return REFUS_ADMIN
  await serverDatabases.createDocument(
    DATABASE_ID,
    COLLECTIONS.ANNOUNCEMENTS,
    ID.unique(),
    {
      title: data.title,
      content: data.content,
      jam_id: data.jamId,
      important: data.important,
      author_id: data.authorId,
      author_name: data.authorName,
    },
  )
  await logAdminAction(admin.userId, `Publication d'une annonce ${data.jamId === 'all' ? 'globale' : `sur la jam (${data.jamId})`} « ${data.title} »`, '/admin/announcements')
  revalidatePath('/admin/announcements')
  return { success: true }
}

export async function listAnnouncements(page = 0): Promise<Announcement[]> {
  await requireAdminOrThrow()
  const res = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.ANNOUNCEMENTS, [
    Query.orderDesc('$createdAt'),
    Query.limit(20),
    Query.offset(page * 20),
  ])
  return res.documents.map(mapDocToAnnouncement)
}

export async function deleteAnnouncement(announcementId: string): Promise<{ success: boolean; error?: string }> {
  const admin = await requireAdmin()
  if (!admin) return REFUS_ADMIN
  await serverDatabases.deleteDocument(DATABASE_ID, COLLECTIONS.ANNOUNCEMENTS, announcementId)
  await logAdminAction(admin.userId, `Suppression de l'annonce (${announcementId})`, '/admin/announcements')
  revalidatePath('/admin/announcements')
  return { success: true }
}

// ── Featured / Gagnants ────────────────────────────────────────────────────

export async function listJamsForCuration(): Promise<GameJam[]> {
  await requireAdminOrThrow()
  const res = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.GAME_JAMS, [
    Query.orderDesc('$createdAt'),
    Query.limit(50),
  ])
  return res.documents.map(mapDocToGameJam)
}

export async function listProjectsForJam(jamId: string): Promise<Project[]> {
  await requireAdminOrThrow()
  const res = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.PROJECTS, [
    Query.equal('jam_id', jamId),
    Query.equal('submitted', true),
  ])
  return res.documents.map(mapDocToProject)
}

export async function setProjectPlacement(
  projectId: string,
  placement: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { account } = await createSessionClient()
    const user = await account.get()

    const projectDoc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.PROJECTS, projectId)
    const jamId = projectDoc.jam_id as string
    const jamDoc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.GAME_JAMS, jamId)

    const isOrganizer = user.$id === jamDoc.organizer_id
    let isAdmin = false
    if (!isOrganizer) {
      const memberships = await serverTeams.listMemberships(ADMIN_TEAM_ID, [
        Query.equal('userId', user.$id),
        Query.limit(1),
      ])
      isAdmin = memberships.total > 0
    }

    if (!isOrganizer && !isAdmin) {
      return { success: false, error: "Vous n'êtes pas autorisé à définir le classement de ce projet." }
    }

    const endDate = new Date(jamDoc.end_date as string)
    if (Number.isNaN(endDate.getTime()) || endDate >= new Date()) {
      return { success: false, error: 'La jam doit être terminée pour définir un classement.' }
    }

    const numericPlacement = Number(placement)
    if (!Number.isFinite(numericPlacement)) {
      return { success: false, error: 'Le classement fourni est invalide.' }
    }
    const clamped = Math.min(3, Math.max(0, Math.trunc(numericPlacement)))
    await serverDatabases.updateDocument(DATABASE_ID, COLLECTIONS.PROJECTS, projectId, {
      placement: clamped,
    })

    if (!isOrganizer && isAdmin) {
      await logAdminAction(user.$id, `Classement du projet « ${projectDoc.title} » → ${clamped} (${projectId})`, `/project/${projectId}`)
    }

    revalidatePath('/admin/featured')
    revalidatePath(`/dashboard/my-jams/${jamId}`)

    return { success: true }
  } catch {
    return { success: false, error: 'Une erreur est survenue lors de la mise à jour du classement.' }
  }
}
