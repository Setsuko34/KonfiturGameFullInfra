'use server'

import { Query } from 'node-appwrite'
import { serverDatabases } from '@/lib/appwrite/server'
import { DATABASE_ID, COLLECTIONS } from '@/lib/appwrite/config'
import { mapDocToGameJam } from '@/lib/appwrite/types'
import type { GameJam } from '@/types'

export async function getJams(): Promise<GameJam[]> {
  try {
    const res = await serverDatabases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.GAME_JAMS,
      [Query.orderDesc('$createdAt'), Query.limit(50)]
    )
    return res.documents.map(mapDocToGameJam)
  } catch {
    return []
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
