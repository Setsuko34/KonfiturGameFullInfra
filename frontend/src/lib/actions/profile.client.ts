import { account } from '@/lib/appwrite/client'

export async function updateProfileClient(
  name: string,
  bio: string,
  current: { name: string; bio: string }
): Promise<{ success: boolean; error?: string }> {
  const trimmedName = name.trim()
  if (!trimmedName) return { success: false, error: 'Le nom ne peut pas être vide' }
  if (trimmedName.length > 128) return { success: false, error: 'Le nom dépasse 128 caractères' }
  if (bio.length > 300) return { success: false, error: 'La bio dépasse 300 caractères' }

  try {
    if (trimmedName !== current.name) {
      await account.updateName(trimmedName)
    }
    if (bio !== current.bio) {
      const prefs = await account.getPrefs()
      await account.updatePrefs({ ...prefs, bio })
    }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Erreur inconnue' }
  }
}

export async function updatePasswordClient(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (newPassword.length < 8) {
    return { success: false, error: 'Le mot de passe doit faire au moins 8 caractères' }
  }
  try {
    await account.updatePassword(newPassword, currentPassword)
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Erreur inconnue' }
  }
}
