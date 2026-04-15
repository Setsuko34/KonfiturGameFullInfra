'use server'

import { ID, Query } from 'node-appwrite'
import { revalidatePath } from 'next/cache'
import { createSessionClient } from '@/lib/appwrite/session'
import { serverDatabases, serverTeams } from '@/lib/appwrite/server'
import { DATABASE_ID, COLLECTIONS, ADMIN_TEAM_ID } from '@/lib/appwrite/config'

export interface AuditLog {
  id: string
  type: string
  ip?: string
  countryCode?: string
  userAgent?: string
  path?: string
  userId?: string
  message?: string
  createdAt: Date
}

export interface BannedIP {
  id: string
  ip: string
  reason?: string
  auto: boolean
  createdAt: Date
}

function mapDocToLog(doc: {
  $id: string
  type: string
  ip?: string
  country_code?: string
  user_agent?: string
  path?: string
  user_id?: string
  message?: string
  $createdAt: string
}): AuditLog {
  return {
    id: doc.$id,
    type: doc.type,
    ip: doc.ip,
    countryCode: doc.country_code,
    userAgent: doc.user_agent,
    path: doc.path,
    userId: doc.user_id,
    message: doc.message,
    createdAt: new Date(doc.$createdAt),
  }
}

function mapDocToBannedIP(doc: {
  $id: string
  ip: string
  reason?: string
  auto?: boolean
  $createdAt: string
}): BannedIP {
  return {
    id: doc.$id,
    ip: doc.ip,
    reason: doc.reason,
    auto: doc.auto ?? false,
    createdAt: new Date(doc.$createdAt),
  }
}

// ── Lecture des logs ───────────────────────────────────────────────────────

export async function getRecentLogs(type?: string, page = 0): Promise<AuditLog[]> {
  const queries: string[] = [
    Query.orderDesc('$createdAt'),
    Query.limit(50),
    Query.offset(page * 50),
  ]
  if (type) queries.push(Query.equal('type', type))

  const res = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.AUDIT_LOGS, queries)
  return res.documents.map(doc => mapDocToLog(doc as unknown as Parameters<typeof mapDocToLog>[0]))
}

// ── Stats par pays ─────────────────────────────────────────────────────────

export async function getCountryStats(): Promise<{ country: string; count: number }[]> {
  const res = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.AUDIT_LOGS, [
    Query.equal('type', 'connection'),
    Query.orderDesc('$createdAt'),
    Query.limit(1000),
  ])

  const counts: Record<string, number> = {}
  for (const doc of res.documents) {
    const cc = (doc.country_code as string) || 'XX'
    counts[cc] = (counts[cc] ?? 0) + 1
  }

  return Object.entries(counts)
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)
}

// ── Gestion IPs bannies ────────────────────────────────────────────────────

export async function getBannedIPs(): Promise<BannedIP[]> {
  const res = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.BANNED_IPS, [
    Query.orderDesc('$createdAt'),
    Query.limit(200),
  ])
  return res.documents.map(doc => mapDocToBannedIP(doc as unknown as Parameters<typeof mapDocToBannedIP>[0]))
}

export async function banIP(ip: string, reason: string): Promise<{ success: boolean; error?: string }> {
  const cleaned = ip.trim()
  if (!cleaned) return { success: false, error: 'IP invalide' }
  // Validation basique IPv4/IPv6
  if (!/^[\d.:a-fA-F]+$/.test(cleaned)) return { success: false, error: 'Format IP invalide' }

  try {
    const existing = await serverDatabases.listDocuments(
      DATABASE_ID, COLLECTIONS.BANNED_IPS, [Query.equal('ip', cleaned), Query.limit(1)]
    )
    if (existing.total > 0) return { success: false, error: 'IP déjà bannie' }

    await serverDatabases.createDocument(DATABASE_ID, COLLECTIONS.BANNED_IPS, ID.unique(), {
      ip: cleaned,
      reason: reason.trim() || 'Ban manuel',
      auto: false,
    })
    revalidatePath('/admin/logs')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Erreur inconnue' }
  }
}

export async function unbanIP(bannedIPId: string): Promise<void> {
  await serverDatabases.deleteDocument(DATABASE_ID, COLLECTIONS.BANNED_IPS, bannedIPId)
  revalidatePath('/admin/logs')
}

export async function clearOldLogs(olderThanDays = 30): Promise<{ deleted: number }> {
  // Vérification admin — seuls les membres de l'équipe admin peuvent purger les logs
  const { account } = await createSessionClient()
  const user = await account.get()
  const memberships = await serverTeams.listMemberships(ADMIN_TEAM_ID)
  const isAdmin = memberships.memberships.some(m => m.userId === user.$id)
  if (!isAdmin) throw new Error('Accès réservé aux administrateurs')

  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString()
  const res = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.AUDIT_LOGS, [
    Query.lessThan('$createdAt', cutoff),
    Query.limit(500),
  ])
  let deleted = 0
  for (const doc of res.documents) {
    await serverDatabases.deleteDocument(DATABASE_ID, COLLECTIONS.AUDIT_LOGS, doc.$id)
    deleted++
  }
  revalidatePath('/admin/logs')
  return { deleted }
}
