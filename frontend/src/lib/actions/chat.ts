'use server'

import { Query } from 'node-appwrite'
import { serverDatabases } from '@/lib/appwrite/server'
import { createSessionClient } from '@/lib/appwrite/session'
import { DATABASE_ID, COLLECTIONS } from '@/lib/appwrite/config'
import { mapDocToChatMessage } from '@/lib/appwrite/types'
import { CHAT_BATCH_SIZE, sanitizeChatContent } from '@/lib/chat-utils'
import { canActOnJam, logAdminAction } from '@/lib/appwrite/guards'
import type { ChatMessage, ChatChannel } from '@/types'

export async function getChatMessages(
  jamId: string,
  channel: ChatChannel,
  limit = CHAT_BATCH_SIZE
): Promise<ChatMessage[]> {
  try {
    const res = await serverDatabases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.CHAT_MESSAGES,
      [
        Query.equal('jam_id', jamId),
        Query.equal('channel', channel),
        Query.orderDesc('$createdAt'),
        Query.limit(limit),
      ]
    )
    return res.documents.map(mapDocToChatMessage).reverse()
  } catch {
    return []
  }
}

/**
 * Lot de messages plus anciens que `cursor` (le $id du plus ancien message actuellement
 * affiché), pour le chargement vers le haut du chat. Même contrat que le reste du chantier
 * mais ancré à l'autre bout : `nextCursor = null` dès que le lot revient incomplet.
 */
export async function getOlderChatMessages(
  jamId: string,
  channel: ChatChannel,
  cursor: string
): Promise<{ messages: ChatMessage[]; nextCursor: string | null }> {
  try {
    const res = await serverDatabases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.CHAT_MESSAGES,
      [
        Query.equal('jam_id', jamId),
        Query.equal('channel', channel),
        Query.orderDesc('$createdAt'),
        Query.limit(CHAT_BATCH_SIZE),
        Query.cursorAfter(cursor),
      ]
    )
    const nextCursor = res.documents.length < CHAT_BATCH_SIZE
      ? null
      : res.documents[res.documents.length - 1].$id

    return { messages: res.documents.map(mapDocToChatMessage).reverse(), nextCursor }
  } catch {
    return { messages: [], nextCursor: null }
  }
}

export async function sendChatMessage(
  jamId: string,
  channel: ChatChannel,
  content: string
): Promise<{ success: boolean; message?: ChatMessage; error?: string }> {
  const sanitized = sanitizeChatContent(content)
  if (!sanitized.ok) return { success: false, error: sanitized.error }

  try {
    // Identité dérivée de la session serveur — jamais fournie par le client
    const { account } = await createSessionClient()
    const user = await account.get()

    const doc = await serverDatabases.createDocument(
      DATABASE_ID,
      COLLECTIONS.CHAT_MESSAGES,
      'unique()',
      {
        jam_id: jamId,
        channel,
        author_id: user.$id,
        author_name: user.name,
        content: sanitized.content,
        role: 'user',
        pinned: false,
      }
    )
    return { success: true, message: mapDocToChatMessage(doc) }
  } catch {
    return { success: false, error: 'Une erreur est survenue. Réessayez.' }
  }
}

export async function reportMessage(
  messageId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Signalement réservé aux utilisateurs connectés (parité avec le masquage UI)
    const { account } = await createSessionClient()
    await account.get()

    await serverDatabases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.CHAT_MESSAGES,
      messageId,
      { reported: true }
    )
    return { success: true }
  } catch {
    return { success: false, error: 'Une erreur est survenue. Réessayez.' }
  }
}

export async function setJamMessagePinned(
  messageId: string,
  pinned: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const { account } = await createSessionClient()
    const user = await account.get()

    const msgDoc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.CHAT_MESSAGES, messageId)
    const jamDoc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.GAME_JAMS, msgDoc.jam_id as string)

    // Organisateur de la jam, sinon admin — fail-closed (guards.ts)
    const grant = await canActOnJam(user.$id, jamDoc)
    if (!grant) return { success: false, error: 'Réservé à l\'organisateur de la jam.' }

    await serverDatabases.updateDocument(DATABASE_ID, COLLECTIONS.CHAT_MESSAGES, messageId, { pinned })

    if (grant === 'admin') {
      await logAdminAction(
        user.$id,
        `${pinned ? 'Épinglage' : 'Désépinglage'} d'un message de jam (${messageId})`,
        `/jam/${msgDoc.jam_id}`
      )
    }
    return { success: true }
  } catch {
    return { success: false, error: 'Une erreur est survenue. Réessayez.' }
  }
}
