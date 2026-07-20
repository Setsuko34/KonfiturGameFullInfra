'use server'

import { ID } from 'node-appwrite'
import { revalidatePath } from 'next/cache'
import { createSessionClient } from '@/lib/appwrite/session'
import { serverDatabases } from '@/lib/appwrite/server'
import { DATABASE_ID, COLLECTIONS } from '@/lib/appwrite/config'
import { validateAnnouncementData } from '@/lib/validators'
import { canActOnJam, logAdminAction } from '@/lib/appwrite/guards'

// ── Créer une annonce (organisateur uniquement) ───────────────────────────

export async function createOrganizerAnnouncement(
  jamId: string,
  data: { title: string; content: string; important: boolean }
): Promise<{ success: boolean; error?: string }> {
  const validation = validateAnnouncementData(data)
  if (!validation.valid) return { success: false, error: validation.error }

  try {
    const { account } = await createSessionClient()
    const user = await account.get()

    // Organisateur OU admin
    const jamDoc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.GAME_JAMS, jamId)
    const role = await canActOnJam(user.$id, jamDoc)
    if (!role) {
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
        author_id: user.$id}
    )

    if (role === 'admin') {
      await logAdminAction(user.$id, `Publication d'une annonce sur la jam « ${jamDoc.title} » (${jamId})`, `/jam/${jamId}`)
    }

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
    const { account } = await createSessionClient()
    const user = await account.get()

    // Propriété via la jam — organisateur OU admin
    const jamDoc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.GAME_JAMS, jamId)
    const role = await canActOnJam(user.$id, jamDoc)
    if (!role) {
      return { success: false, error: 'Accès non autorisé' }
    }

    // Vérifier que l'annonce appartient bien à cette jam
    const announcementDoc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.ANNOUNCEMENTS, announcementId)
    if (announcementDoc.jam_id !== jamId) {
      return { success: false, error: 'Annonce introuvable pour cette jam' }
    }

    await serverDatabases.deleteDocument(DATABASE_ID, COLLECTIONS.ANNOUNCEMENTS, announcementId)

    if (role === 'admin') {
      await logAdminAction(user.$id, `Suppression d'une annonce de la jam « ${jamDoc.title} » (${jamId})`, `/jam/${jamId}`)
    }

    revalidatePath(`/dashboard/my-jams/${jamId}`)
    revalidatePath(`/jam/${jamId}`)
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { success: false, error: msg }
  }
}
