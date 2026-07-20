'use server'

import { Query, Permission, Role } from 'node-appwrite'
import { serverDatabases } from '@/lib/appwrite/server'
import { createSessionClient } from '@/lib/appwrite/session'
import { DATABASE_ID, COLLECTIONS } from '@/lib/appwrite/config'
import { mapDocToTeamChatMessage } from '@/lib/appwrite/types'
import { fetchAllDocs } from '@/lib/appwrite/fetch-all'
import { CHAT_BATCH_SIZE, sanitizeChatContent } from '@/lib/chat-utils'
import type { TeamChatMessage } from '@/types'
import type { AppwriteDoc } from '@/lib/appwrite/types'

// La table team_chat_messages n'a AUCUNE permission de niveau table (rowSecurity) :
// chaque message porte read(user:X) pour les membres au moment de l'envoi. Toute
// action ici revérifie l'appartenance côté serveur — le masquage UI n'est pas une garde.
async function requireMembership(teamId: string) {
  const { account, databases } = await createSessionClient()
  const user = await account.get()
  const members = await fetchAllDocs<AppwriteDoc>(
    COLLECTIONS.TEAM_MEMBERS,
    [Query.equal('team_id', teamId)]
  )
  const memberIds = members.map(m => m.user_id as string)
  if (!memberIds.includes(user.$id)) return null
  // databases = client de session : les lectures faites avec lui respectent la row security
  return { user: { $id: user.$id, name: user.name }, memberIds, databases }
}

export async function sendTeamChatMessage(
  teamId: string,
  content: string
): Promise<{ success: boolean; message?: TeamChatMessage; error?: string }> {
  const sanitized = sanitizeChatContent(content)
  if (!sanitized.ok) return { success: false, error: sanitized.error }

  try {
    const ctx = await requireMembership(teamId)
    if (!ctx) return { success: false, error: 'Réservé aux membres de l\'équipe.' }

    const doc = await serverDatabases.createDocument(
      DATABASE_ID, COLLECTIONS.TEAM_CHAT_MESSAGES, 'unique()',
      {
        team_id: teamId,
        author_id: ctx.user.$id,
        author_name: ctx.user.name,
        content: sanitized.content,
        pinned: false,
      },
      // Membres courants uniquement : un arrivant ne lit pas l'historique antérieur,
      // un partant garde les messages de sa période (choix de design assumé)
      ctx.memberIds.map(id => Permission.read(Role.user(id)))
    )
    return { success: true, message: mapDocToTeamChatMessage(doc) }
  } catch {
    return { success: false, error: 'Une erreur est survenue. Réessayez.' }
  }
}

export async function getOlderTeamChatMessages(
  teamId: string,
  cursor: string
): Promise<{ messages: TeamChatMessage[]; nextCursor: string | null }> {
  try {
    const ctx = await requireMembership(teamId)
    if (!ctx) return { messages: [], nextCursor: null }

    const res = await ctx.databases.listDocuments(
      DATABASE_ID, COLLECTIONS.TEAM_CHAT_MESSAGES,
      [
        Query.equal('team_id', teamId),
        Query.orderDesc('$createdAt'),
        Query.limit(CHAT_BATCH_SIZE),
        Query.cursorAfter(cursor),
      ]
    )
    const nextCursor = res.documents.length < CHAT_BATCH_SIZE
      ? null
      : res.documents[res.documents.length - 1].$id

    return { messages: res.documents.map(mapDocToTeamChatMessage).reverse(), nextCursor }
  } catch {
    return { messages: [], nextCursor: null }
  }
}

export async function reportTeamMessage(
  messageId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const msgDoc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.TEAM_CHAT_MESSAGES, messageId)
    const ctx = await requireMembership(msgDoc.team_id as string)
    if (!ctx) return { success: false, error: 'Réservé aux membres de l\'équipe.' }

    await serverDatabases.updateDocument(DATABASE_ID, COLLECTIONS.TEAM_CHAT_MESSAGES, messageId, { reported: true })
    return { success: true }
  } catch {
    return { success: false, error: 'Une erreur est survenue. Réessayez.' }
  }
}

export async function setTeamMessagePinned(
  messageId: string,
  pinned: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const msgDoc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.TEAM_CHAT_MESSAGES, messageId)
    const ctx = await requireMembership(msgDoc.team_id as string)
    if (!ctx) return { success: false, error: 'Réservé aux membres de l\'équipe.' }

    await serverDatabases.updateDocument(DATABASE_ID, COLLECTIONS.TEAM_CHAT_MESSAGES, messageId, { pinned })
    return { success: true }
  } catch {
    return { success: false, error: 'Une erreur est survenue. Réessayez.' }
  }
}
