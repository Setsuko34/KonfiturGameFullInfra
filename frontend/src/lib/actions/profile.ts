'use server'

import { Models, Query } from 'node-appwrite'
import { createSessionClient } from '@/lib/appwrite/session'
import { serverUsers } from '@/lib/appwrite/server'
import { fetchAllDocs, fetchAllByField } from '@/lib/appwrite/fetch-all'
import { COLLECTIONS } from '@/lib/appwrite/config'
import { mapDocToProject, type AppwriteDoc } from '@/lib/appwrite/types'
import type { Project } from '@/types'

// ── Lecture ────────────────────────────────────────────────────────────────
export async function getProfile(): Promise<Models.User<Models.Preferences> | null> {
  try {
    const { account } = await createSessionClient()
    return await account.get()
  } catch {
    return null
  }
}

// ── Profil public ────────────────────────────────────────────────────────

/**
 * Projets postés par un participant, pour son profil public : team_members(user_id) →
 * team_id → projects(team_id). C'est le cas fetchAllByField du chantier 1 (teamIds peut
 * dépasser 100, un Query.equal brut serait rejeté) — ne pas réinventer une requête plafonnée.
 */
export async function getPublicProfileProjects(userId: string): Promise<Project[]> {
  const memberships = await fetchAllDocs<AppwriteDoc>(COLLECTIONS.TEAM_MEMBERS, [Query.equal('user_id', userId)])
  const teamIds = memberships.map(m => m.team_id as string)
  const projectDocs = await fetchAllByField<AppwriteDoc>(COLLECTIONS.PROJECTS, 'team_id', teamIds, [Query.orderDesc('$createdAt')])
  return projectDocs.map(mapDocToProject).filter(p => p.submitted)
}

export async function deleteAccount(): Promise<{ success: boolean; error?: string }> {
  try {
    const { account } = await createSessionClient()
    const user = await account.get()
    await serverUsers.delete(user.$id)
    try { await account.deleteSessions() } catch { /* user déjà supprimé */ }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Erreur inconnue' }
  }
}
