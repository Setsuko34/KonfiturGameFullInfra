'use server'

import { revalidatePath } from 'next/cache'
import { Models } from 'node-appwrite'
import { createSessionClient } from '@/lib/appwrite/session'
import { serverUsers } from '@/lib/appwrite/server'

// ── Lecture ────────────────────────────────────────────────────────────────

export async function getProfile(): Promise<Models.User<Models.Preferences> | null> {
  try {
    const { account } = createSessionClient()
    return await account.get()
  } catch {
    return null
  }
}

// ── Mise à jour du nom ─────────────────────────────────────────────────────

export async function updateProfileName(name: string): Promise<{ success: boolean; error?: string }> {
  const trimmed = name.trim()
  if (trimmed.length === 0) return { success: false, error: 'Le nom ne peut pas être vide' }
  if (trimmed.length > 128) return { success: false, error: 'Le nom dépasse 128 caractères' }

  try {
    const { account } = createSessionClient()
    await account.updateName(trimmed)
    revalidatePath('/dashboard/profile')
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { success: false, error: msg }
  }
}

// ── Mise à jour de la bio (stockée dans Appwrite Preferences) ──────────────

export async function updateProfileBio(bio: string): Promise<{ success: boolean; error?: string }> {
  if (bio.length > 300) return { success: false, error: 'La bio dépasse 300 caractères' }

  try {
    const { account } = createSessionClient()
    const user = await account.get()
    await account.updatePrefs({ ...user.prefs, bio: bio.trim() })
    revalidatePath('/dashboard/profile')
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { success: false, error: msg }
  }
}

// ── Changement de mot de passe ─────────────────────────────────────────────
// Utilise le client session pour que Appwrite vérifie l'ancien mot de passe.

export async function updateProfilePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (newPassword.length < 8) return { success: false, error: 'Le nouveau mot de passe doit contenir au moins 8 caractères' }

  try {
    const { account } = createSessionClient()
    await account.updatePassword(newPassword, currentPassword)
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { success: false, error: msg }
  }
}

// ── Suppression du compte ──────────────────────────────────────────────────
// Supprime le compte puis les sessions. Action irréversible.
// Ordre intentionnel : si serverUsers.delete() échoue, les sessions restent actives (OK).
// L'inverse (sessions supprimées d'abord puis delete échoue) verrouillerait l'utilisateur dehors.

export async function deleteAccount(): Promise<{ success: boolean; error?: string }> {
  try {
    const { account } = createSessionClient()
    const user = await account.get()
    // Supprimer via l'API admin (serverUsers) car account.delete() est expérimental en SDK 14
    await serverUsers.delete(user.$id)
    await account.deleteSessions()
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { success: false, error: msg }
  }
}
