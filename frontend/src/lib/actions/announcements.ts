'use server'

import { ID } from 'node-appwrite'
import { revalidatePath } from 'next/cache'
import { createSessionClient } from '@/lib/appwrite/session'
import { serverDatabases } from '@/lib/appwrite/server'
import { DATABASE_ID, COLLECTIONS } from '@/lib/appwrite/config'
import { validateAnnouncementData } from '@/lib/validators'

// ── Créer une annonce (organisateur uniquement) ───────────────────────────

export async function createOrganizerAnnouncement(
  jamId: string,
  data: { title: string; content: string; important: boolean }
): Promise<{ success: boolean; error?: string }> {
  const validation = validateAnnouncementData(data)
  if (!validation.valid) return { success: false, error: validation.error }

  try {
    const { account } = createSessionClient()
    const user = await account.get()

    // Vérifier que l'utilisateur est bien l'organisateur
    const jamDoc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.GAME_JAMS, jamId)
    if (jamDoc.organizer_id !== user.$id) {
      return { success: false, error: 'Seul l\'organisateur peut publier des annonces' }
    }

    await serverDatabases.createDocument(
      DATABASE_ID,
      COLLECTIONS.ANNOUNCEMENTS,
      ID.unique(),
      {
        title: data.title.trim(),
        content: data.content.trim(),
        jam_id: jamId,
        important: data.important,
        author_id: user.$id,
        author_name: user.name || user.email,
      }
    )

    revalidatePath(`/dashboard/my-jams/${jamId}`)
    revalidatePath(`/jam/${jamId}`)
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { success: false, error: msg }
  }
}

// ── Supprimer une annonce (organisateur uniquement) ───────────────────────

export async function deleteOrganizerAnnouncement(
  jamId: string,
  announcementId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { account } = createSessionClient()
    const user = await account.get()

    // Vérifier propriété via la jam
    const jamDoc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.GAME_JAMS, jamId)
    if (jamDoc.organizer_id !== user.$id) {
      return { success: false, error: 'Accès non autorisé' }
    }

    // Vérifier que l'annonce appartient bien à cette jam
    const announcementDoc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.ANNOUNCEMENTS, announcementId)
    if (announcementDoc.jam_id !== jamId) {
      return { success: false, error: 'Annonce introuvable pour cette jam' }
    }

    await serverDatabases.deleteDocument(DATABASE_ID, COLLECTIONS.ANNOUNCEMENTS, announcementId)

    revalidatePath(`/dashboard/my-jams/${jamId}`)
    revalidatePath(`/jam/${jamId}`)
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { success: false, error: msg }
  }
}
