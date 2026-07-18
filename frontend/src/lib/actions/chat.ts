'use server'

import { Query } from 'node-appwrite'
import { serverDatabases } from '@/lib/appwrite/server'
import { DATABASE_ID, COLLECTIONS } from '@/lib/appwrite/config'
import { mapDocToChatMessage } from '@/lib/appwrite/types'
import type { ChatMessage, ChatChannel } from '@/types'

const CHAT_BATCH_SIZE = 50 // taille de lot délibérée (historique initial et « charger plus anciens »)

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

export async function reportMessage(
  messageId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await serverDatabases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.CHAT_MESSAGES,
      messageId,
      { reported: true }
    )
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { success: false, error: msg }
  }
}
