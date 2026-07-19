'use server'

import { Query } from 'node-appwrite'
import { serverDatabases } from '@/lib/appwrite/server'
import { DATABASE_ID, COLLECTIONS } from '@/lib/appwrite/config'
import { mapDocToGameJam, mapDocToAnnouncement } from '@/lib/appwrite/types'
import { getParticipantCountsByJam } from '@/lib/appwrite/participant-counts'
import type { GameJam, Announcement } from '@/types'

const JAMS_BATCH_SIZE = 50   // taille de lot délibérée pour « Voir plus » (pas un plafond accidentel)

/**
 * Récupère un lot de jams, le plus récent d'abord. `cursor` (dernier $id du lot précédent)
 * permet d'enchaîner via LoadMoreList. `nextCursor` vaut null dès que le lot revient
 * incomplet : c'est le seul signal honnête qu'il n'y a plus rien à charger.
 */
export async function getJams(
  cursor?: string,
): Promise<{ jams: GameJam[]; nextCursor: string | null }> {
  try {
    const queries = [Query.orderDesc('$createdAt'), Query.limit(JAMS_BATCH_SIZE)]
    if (cursor) queries.push(Query.cursorAfter(cursor))

    const res = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.GAME_JAMS, queries)
    const jams = res.documents.map(mapDocToGameJam)
    const nextCursor = res.documents.length < JAMS_BATCH_SIZE
      ? null
      : res.documents[res.documents.length - 1].$id

    // Compteurs dérivés des inscrits réels (le champ stocké n'est jamais mis à jour)
    const participantCounts = await getParticipantCountsByJam(jams.map(j => j.id))
    for (const jam of jams) jam.participants = participantCounts[jam.id] ?? 0

    return { jams, nextCursor }
  } catch {
    return { jams: [], nextCursor: null }
  }
}

export async function getJamById(id: string): Promise<GameJam | null> {
  try {
    const doc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.GAME_JAMS, id)
    return mapDocToGameJam(doc)
  } catch {
    return null
  }
}

export async function getJamBySlug(slug: string): Promise<GameJam | null> {
  try {
    const res = await serverDatabases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.GAME_JAMS,
      [Query.equal('slug', slug), Query.limit(1)]
    )
    if (res.documents.length === 0) return null
    return mapDocToGameJam(res.documents[0])
  } catch {
    return null
  }
}

const ANNOUNCEMENTS_BATCH_SIZE = 50 // taille de lot délibérée pour « Voir plus » (ex-plafond)

/**
 * Récupère un lot d'annonces d'une jam, la plus récente d'abord. `cursor` (dernier $id du lot
 * précédent) permet d'enchaîner via LoadMoreList. `nextCursor` vaut null dès que le lot revient
 * incomplet : c'est le seul signal honnête qu'il n'y a plus rien à charger.
 */
export async function getAnnouncementsByJam(
  jamId: string,
  cursor?: string,
): Promise<{ announcements: Announcement[]; nextCursor: string | null }> {
  try {
    const queries = [
      Query.equal('jam_id', jamId),
      Query.orderDesc('$createdAt'),
      Query.limit(ANNOUNCEMENTS_BATCH_SIZE),
    ]
    if (cursor) queries.push(Query.cursorAfter(cursor))

    const res = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.ANNOUNCEMENTS, queries)
    const announcements = res.documents.map(mapDocToAnnouncement)
    const nextCursor = res.documents.length < ANNOUNCEMENTS_BATCH_SIZE
      ? null
      : res.documents[res.documents.length - 1].$id

    return { announcements, nextCursor }
  } catch {
    return { announcements: [], nextCursor: null }
  }
}

export async function createJam(data: {
  title: string
  slug: string
  theme: string
  description: string
  status: string
  type: string
  startDate: string
  endDate: string
  duration: string
  rules: string[]
  organizerId: string
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const doc = await serverDatabases.createDocument(
      DATABASE_ID,
      COLLECTIONS.GAME_JAMS,
      'unique()',
      data
    )
    return { success: true, id: doc.$id }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { success: false, error: msg }
  }
}
