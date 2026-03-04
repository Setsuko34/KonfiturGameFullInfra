'use server'

import { Query } from 'node-appwrite'
import { serverDatabases } from '@/lib/appwrite/server'
import { DATABASE_ID, COLLECTIONS } from '@/lib/appwrite/config'
import { mapDocToChatMessage } from '@/lib/appwrite/types'
import type { ChatMessage, ChatChannel } from '@/types'

export async function getChatMessages(
  jamId: string,
  channel: ChatChannel,
  limit = 50
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

export async function sendChatMessage(data: {
  jamId: string
  channel: ChatChannel
  authorId: string
  authorName: string
  content: string
  role?: string
}): Promise<{ success: boolean; message?: ChatMessage; error?: string }> {
  // Sanitisation basique — pas de HTML
  const sanitized = data.content
    .trim()
    .slice(0, 2048)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  if (!sanitized) {
    return { success: false, error: 'Le message ne peut pas être vide.' }
  }

  try {
    const doc = await serverDatabases.createDocument(
      DATABASE_ID,
      COLLECTIONS.CHAT_MESSAGES,
      'unique()',
      {
        jam_id: data.jamId,
        channel: data.channel,
        author_id: data.authorId,
        author_name: data.authorName,
        content: sanitized,
        role: data.role ?? 'user',
        pinned: false,
      }
    )
    return { success: true, message: mapDocToChatMessage(doc) }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { success: false, error: msg }
  }
}

export async function pinMessage(
  messageId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await serverDatabases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.CHAT_MESSAGES,
      messageId,
      { pinned: true }
    )
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { success: false, error: msg }
  }
}
