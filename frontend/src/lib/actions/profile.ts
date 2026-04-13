'use server'

import { Models } from 'node-appwrite'
import { createSessionClient } from '@/lib/appwrite/session'
import { serverUsers } from '@/lib/appwrite/server'

// ── Lecture ────────────────────────────────────────────────────────────────
export async function getProfile(): Promise<Models.User<Models.Preferences> | null> {
  try {
    const { account } = await createSessionClient()
    return await account.get()
  } catch {
    return null
  }
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
