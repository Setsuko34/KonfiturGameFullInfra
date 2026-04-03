'use server'

import { ID, Query } from 'node-appwrite'
import { revalidatePath } from 'next/cache'
import { serverDatabases, serverUsers, serverTeams } from '@/lib/appwrite/server'
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

export async function setProjectWinner(projectId: string, winner: boolean) {
  await serverDatabases.updateDocument(DATABASE_ID, COLLECTIONS.PROJECTS, projectId, { winner })
  revalidatePath('/admin/featured')
}
