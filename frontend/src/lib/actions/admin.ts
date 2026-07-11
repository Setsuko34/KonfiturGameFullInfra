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
} from '@/lib/appwrite/types'
import type { GameJam, Project, ChatMessage, Announcement } from '@/types'

// ── Stats globales ─────────────────────────────────────────────────────────

export async function getAdminStats(): Promise<{
  totalUsers: number
  totalJams: number
  activeJams: number
  pendingReports: number
}> {
  const [usersRes, allJamsRes, activeJamsRes, reportedMessagesRes, reportedProjectsRes] = await Promise.all([
    serverUsers.list([Query.limit(1)]),
    serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.GAME_JAMS, [Query.limit(1)]),
    serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.GAME_JAMS, [
      Query.equal('status', 'ongoing'),
      Query.limit(1),
    ]),
    serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.CHAT_MESSAGES, [
      Query.equal('reported', true),
      Query.limit(1),
    ]),
    serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.PROJECTS, [
      Query.equal('reported', true),
      Query.limit(1),
    ]),
  ])

  return {
    totalUsers: usersRes.total,
    totalJams: allJamsRes.total,
    activeJams: activeJamsRes.total,
    pendingReports: reportedMessagesRes.total + reportedProjectsRes.total,
  }
}

// ── Gestion utilisateurs ───────────────────────────────────────────────────

export async function listUsers(page = 0, search = '') {
  const queries: string[] = [Query.limit(25), Query.offset(page * 25)]
  if (search) queries.push(Query.search('name', search))
  return serverUsers.list(queries)
}

export async function blockUser(userId: string) {
  await serverUsers.updateStatus(userId, false)
  revalidatePath('/admin/users')
}

export async function unblockUser(userId: string) {
  await serverUsers.updateStatus(userId, true)
  revalidatePath('/admin/users')
}

export async function grantAdminRole(userId: string, email: string) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  // node-appwrite Teams.createMembership : 6 paramètres (teamId, roles, email, userId, name, redirectUrl)
  const result = await serverTeams.createMembership(
    ADMIN_TEAM_ID,
    [],
    email,
    userId,
    '',
    `${siteUrl}/admin`,
  )
  revalidatePath('/admin/users')
  return result
}

export async function revokeAdminRole(membershipId: string) {
  await serverTeams.deleteMembership(ADMIN_TEAM_ID, membershipId)
  revalidatePath('/admin/users')
}

// ── Gestion des jams ───────────────────────────────────────────────────────

export async function listAllJams(status?: string, page = 0): Promise<GameJam[]> {
  const queries: string[] = [
    Query.orderDesc('$createdAt'),
    Query.limit(25),
    Query.offset(page * 25),
  ]
  if (status) queries.push(Query.equal('status', status))
  const res = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.GAME_JAMS, queries)
  return res.documents.map(mapDocToGameJam)
}

export async function deleteJam(jamId: string) {
  await serverDatabases.deleteDocument(DATABASE_ID, COLLECTIONS.GAME_JAMS, jamId)
  revalidatePath('/admin/jams')
  revalidatePath('/admin')
}

export async function toggleJamFeatured(jamId: string, featured: boolean, featuredOrder?: number) {
  await serverDatabases.updateDocument(DATABASE_ID, COLLECTIONS.GAME_JAMS, jamId, {
    featured,
    ...(featuredOrder !== undefined ? { featured_order: featuredOrder } : {}),
  })
  revalidatePath('/admin/jams')
  revalidatePath('/admin/featured')
}

// ── Modération ─────────────────────────────────────────────────────────────

export async function listReportedMessages(page = 0): Promise<ChatMessage[]> {
  const res = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.CHAT_MESSAGES, [
    Query.equal('reported', true),
    Query.orderDesc('$createdAt'),
    Query.limit(20),
    Query.offset(page * 20),
  ])
  return res.documents.map(mapDocToChatMessage)
}

export async function listReportedProjects(page = 0): Promise<Project[]> {
  const res = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.PROJECTS, [
    Query.equal('reported', true),
    Query.orderDesc('$createdAt'),
    Query.limit(20),
    Query.offset(page * 20),
  ])
  return res.documents.map(mapDocToProject)
}

export async function deleteMessage(messageId: string) {
  await serverDatabases.deleteDocument(DATABASE_ID, COLLECTIONS.CHAT_MESSAGES, messageId)
  revalidatePath('/admin/moderation')
  revalidatePath('/admin')
}

export async function resolveMessageReport(messageId: string) {
  await serverDatabases.updateDocument(DATABASE_ID, COLLECTIONS.CHAT_MESSAGES, messageId, {
    reported: false,
  })
  revalidatePath('/admin/moderation')
  revalidatePath('/admin')
}

export async function resolveProjectReport(projectId: string) {
  await serverDatabases.updateDocument(DATABASE_ID, COLLECTIONS.PROJECTS, projectId, {
    reported: false,
  })
  revalidatePath('/admin/moderation')
  revalidatePath('/admin')
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

export async function createAnnouncement(data: CreateAnnouncementData): Promise<Announcement> {
  const doc = await serverDatabases.createDocument(
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
  revalidatePath('/admin/announcements')
  return mapDocToAnnouncement(doc)
}

export async function listAnnouncements(page = 0): Promise<Announcement[]> {
  const res = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.ANNOUNCEMENTS, [
    Query.orderDesc('$createdAt'),
    Query.limit(20),
    Query.offset(page * 20),
  ])
  return res.documents.map(mapDocToAnnouncement)
}

export async function deleteAnnouncement(announcementId: string) {
  await serverDatabases.deleteDocument(DATABASE_ID, COLLECTIONS.ANNOUNCEMENTS, announcementId)
  revalidatePath('/admin/announcements')
}

// ── Featured / Gagnants ────────────────────────────────────────────────────

export async function listJamsForCuration(): Promise<GameJam[]> {
  const res = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.GAME_JAMS, [
    Query.orderDesc('$createdAt'),
    Query.limit(50),
  ])
  return res.documents.map(mapDocToGameJam)
}

export async function listProjectsForJam(jamId: string): Promise<Project[]> {
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

    revalidatePath('/admin/featured')
    revalidatePath(`/dashboard/my-jams/${jamId}`)

    return { success: true }
  } catch {
    return { success: false, error: 'Une erreur est survenue lors de la mise à jour du classement.' }
  }
}
