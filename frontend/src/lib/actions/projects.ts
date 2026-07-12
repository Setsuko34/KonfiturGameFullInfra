'use server'

import { Query, Permission, Role } from 'node-appwrite'
import { serverDatabases, serverStorage } from '@/lib/appwrite/server'
import { createSessionClient } from '@/lib/appwrite/session'
import { DATABASE_ID, COLLECTIONS, BUCKETS } from '@/lib/appwrite/config'
import { mapDocToProject } from '@/lib/appwrite/types'
import { computeJamStatus } from '@/lib/jam-status'
import { isAdminUser, logAdminAction } from '@/lib/appwrite/guards'
import type { Project } from '@/types'

export async function getProjectsByJam(jamId: string): Promise<Project[]> {
  try {
    const res = await serverDatabases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.PROJECTS,
      [
        Query.equal('jam_id', jamId),
        Query.equal('submitted', true),
        Query.orderDesc('likes_count'),
        Query.limit(100),
      ]
    )
    return res.documents.map(mapDocToProject)
  } catch {
    return []
  }
}

export async function submitProject(data: {
  jamId: string
  teamId: string
  title: string
  description: string
  technologies: string[]
  downloadUrl?: string
  repoUrl?: string
  coverFileId?: string
  screenshotIds?: string[]
  buildFileId?: string
}): Promise<{ success: boolean; projectId?: string; error?: string }> {
  try {
    // Identité serveur — jamais de userId client
    const { account } = await createSessionClient()
    const user = await account.get()

    // La jam doit être en cours — statut calculé depuis les dates, comme l'UI
    // (le champ `status` stocké n'est jamais mis à jour au démarrage de la jam)
    const jam = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.GAME_JAMS, data.jamId)
    if (computeJamStatus(new Date(jam.start_date), new Date(jam.end_date)) !== 'ongoing') {
      return { success: false, error: 'La jam n\'est pas en cours — le projet est figé.' }
    }

    // Appartenance à l'équipe
    const membership = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.TEAM_MEMBERS, [
      Query.equal('team_id', data.teamId),
      Query.equal('user_id', user.$id),
      Query.limit(1),
    ])
    if (membership.documents.length === 0) {
      return { success: false, error: 'Tu ne fais pas partie de cette équipe.' }
    }

    // L'équipe doit être inscrite à la jam ciblée — sinon n'importe quelle équipe
    // pourrait créer un projet dans une jam concurrente et polluer son classement
    const team = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.TEAMS, data.teamId)
    if (!((team.jam_ids as string[] | undefined) ?? []).includes(data.jamId)) {
      return { success: false, error: 'Cette équipe n\'est pas inscrite à cette jam.' }
    }

    // Projet existant ? (un par couple team+jam) — AVANT le check fichiers, pour connaître les fichiers déjà liés
    const existing = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.PROJECTS, [
      Query.equal('team_id', data.teamId),
      Query.equal('jam_id', data.jamId),
      Query.limit(1),
    ])
    const prev = existing.documents.length > 0 ? existing.documents[0] : null

    // Fichiers déjà liés au projet (par champ correspondant — jamais cross-slot) :
    // propriété vérifiée à la liaison initiale, exemptés du re-check et du re-grant
    type Slot = 'build' | 'cover' | 'screenshot'
    const isLinked = (id: string, slot: Slot): boolean => {
      if (!prev) return false
      if (slot === 'build') return prev.build_file_id === id
      if (slot === 'cover') return prev.cover_image_id === id
      return ((prev.screenshot_ids as string[] | undefined) ?? []).includes(id)
    }

    // Vérifier la propriété de chaque fichier transmis (uploadé par cet utilisateur, bon bucket)
    const screenshots = (data.screenshotIds ?? []).slice(0, 3)
    const fileChecks: Array<{ id: string; bucket: string; slot: Slot }> = [
      ...(data.buildFileId ? [{ id: data.buildFileId, bucket: BUCKETS.PROJECT_BUILDS, slot: 'build' as const }] : []),
      ...(data.coverFileId ? [{ id: data.coverFileId, bucket: BUCKETS.PROJECT_ASSETS, slot: 'cover' as const }] : []),
      ...screenshots.map(id => ({ id, bucket: BUCKETS.PROJECT_ASSETS, slot: 'screenshot' as const })),
    ]
    const newFiles = fileChecks.filter(({ id, slot }) => !isLinked(id, slot))
    for (const { id, bucket } of newFiles) {
      const file = await serverStorage.getFile(bucket, id)
      const ownerRoles = ['read', 'update', 'delete'].map(a => `${a}("user:${user.$id}")`)
      const owned = file.$permissions.some(p => ownerRoles.includes(p))
      if (!owned) {
        return { success: false, error: 'Fichier invalide ou non autorisé.' }
      }
    }

    const fields = {
      title: data.title,
      description: data.description,
      technologies: data.technologies,
      download_url: data.downloadUrl,
      repo_url: data.repoUrl,
      cover_image_id: data.coverFileId ?? null,
      screenshot_ids: screenshots,
      build_file_id: data.buildFileId ?? null,
      submitted: true,
      submission_date: new Date().toISOString(),
    }

    let projectId: string
    if (prev) {
      // Supprimer les anciens fichiers remplacés OU retirés (jamais d'orphelin côté liés)
      const oldNew: Array<{ old?: string; next?: string; bucket: string }> = [
        { old: prev.build_file_id as string | undefined, next: data.buildFileId, bucket: BUCKETS.PROJECT_BUILDS },
        { old: prev.cover_image_id as string | undefined, next: data.coverFileId, bucket: BUCKETS.PROJECT_ASSETS },
        ...((prev.screenshot_ids as string[] | undefined) ?? []).map(old => ({
          old,
          next: screenshots.includes(old) ? old : undefined,
          bucket: BUCKETS.PROJECT_ASSETS,
        })),
      ]
      for (const { old, next, bucket } of oldNew) {
        if (old && old !== next) {
          await serverStorage.deleteFile(bucket, old).catch(() => {}) // fichier déjà absent = OK
        }
      }
      const doc = await serverDatabases.updateDocument(DATABASE_ID, COLLECTIONS.PROJECTS, prev.$id, fields)
      projectId = doc.$id
    } else {
      const doc = await serverDatabases.createDocument(DATABASE_ID, COLLECTIONS.PROJECTS, 'unique()', {
        jam_id: data.jamId,
        team_id: data.teamId,
        ...fields,
        likes_count: 0,
      })
      projectId = doc.$id
    }

    // Ouvrir la lecture publique des fichiers NOUVELLEMENT liés (les fichiers déjà liés sont déjà
    // publics ; re-granter transférerait update/delete au resoumetteur)
    for (const { id, bucket } of newFiles) {
      await serverStorage.updateFile(bucket, id, undefined, [
        Permission.read(Role.any()),
        Permission.update(Role.user(user.$id)),
        Permission.delete(Role.user(user.$id)),
      ])
    }

    return { success: true, projectId }
  } catch {
    return { success: false, error: 'Une erreur est survenue lors de la soumission.' }
  }
}

export async function toggleLike(
  projectId: string
): Promise<{ success: boolean; liked: boolean; likesCount: number; error?: string }> {
  try {
    const { account } = await createSessionClient()
    const user = await account.get()

    // Vérifier si l'utilisateur a déjà liké ce projet
    const existing = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.LIKES, [
      Query.equal('project_id', projectId),
      Query.equal('user_id', user.$id),
      Query.limit(1),
    ])
    const wasLiked = existing.documents.length > 0

    if (wasLiked) {
      // Unlike
      await serverDatabases.deleteDocument(DATABASE_ID, COLLECTIONS.LIKES, existing.documents[0].$id)
    } else {
      // Like
      await serverDatabases.createDocument(DATABASE_ID, COLLECTIONS.LIKES, 'unique()', {
        project_id: projectId,
        user_id: user.$id,
      })
    }

    // Recompter depuis la collection pour éviter toute race condition sur le compteur
    const countRes = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.LIKES, [
      Query.equal('project_id', projectId),
      Query.limit(1),
    ])
    await serverDatabases.updateDocument(DATABASE_ID, COLLECTIONS.PROJECTS, projectId, {
      likes_count: countRes.total,
    })

    return { success: true, liked: !wasLiked, likesCount: countRes.total }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { success: false, liked: false, likesCount: 0, error: msg }
  }
}

export async function hasUserLiked(projectId: string, userId: string): Promise<boolean> {
  try {
    const res = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.LIKES, [
      Query.equal('project_id', projectId),
      Query.equal('user_id', userId),
      Query.limit(1),
    ])
    return res.documents.length > 0
  } catch {
    return false
  }
}

export async function getProjectById(projectId: string): Promise<Project | null> {
  try {
    const doc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.PROJECTS, projectId)
    return mapDocToProject(doc)
  } catch {
    return null
  }
}

export async function getProjectByTeamAndJam(
  teamId: string,
  jamId: string
): Promise<Project | null> {
  try {
    const res = await serverDatabases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.PROJECTS,
      [
        Query.equal('team_id', teamId),
        Query.equal('jam_id', jamId),
        Query.limit(1),
      ]
    )
    return res.documents.length > 0 ? mapDocToProject(res.documents[0]) : null
  } catch {
    return null
  }
}

export async function reportProject(
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Identité serveur — un signalement anonyme non authentifié n'est pas accepté
    const { account } = await createSessionClient()
    await account.get()

    await serverDatabases.updateDocument(DATABASE_ID, COLLECTIONS.PROJECTS, projectId, {
      reported: true,
    })
    return { success: true }
  } catch {
    return { success: false, error: 'Une erreur est survenue lors du signalement.' }
  }
}

// Retire la soumission (submitted: false) — membre de l'équipe pendant la jam,
// ou admin sans condition temporelle (la modération doit marcher après la jam)
export async function unsubmitProject(
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { account } = await createSessionClient()
    const user = await account.get()

    const projectDoc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.PROJECTS, projectId)
    const jamDoc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.GAME_JAMS, projectDoc.jam_id as string)

    const membership = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.TEAM_MEMBERS, [
      Query.equal('team_id', projectDoc.team_id as string),
      Query.equal('user_id', user.$id),
      Query.limit(1),
    ])
    const isMember = membership.documents.length > 0

    let isAdmin = false
    if (isMember) {
      // Membre : même verrou temporel que submitProject
      if (computeJamStatus(new Date(jamDoc.start_date), new Date(jamDoc.end_date)) !== 'ongoing') {
        return { success: false, error: 'La jam n\'est pas en cours — le projet est figé.' }
      }
    } else {
      isAdmin = await isAdminUser(user.$id)
      if (!isAdmin) {
        return { success: false, error: 'Tu ne fais pas partie de cette équipe.' }
      }
    }

    await serverDatabases.updateDocument(DATABASE_ID, COLLECTIONS.PROJECTS, projectId, {
      submitted: false,
    })

    if (isAdmin) {
      await logAdminAction(user.$id, `Retrait de la soumission « ${projectDoc.title} » (${projectId})`, `/project/${projectId}`)
    }

    return { success: true }
  } catch {
    return { success: false, error: 'Une erreur est survenue.' }
  }
}

export async function getPopularProjects(limit = 6): Promise<Project[]> {
  try {
    const res = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.PROJECTS, [
      Query.equal('submitted', true),
      Query.orderDesc('likes_count'),
      Query.limit(limit),
    ])
    return res.documents.map(mapDocToProject)
  } catch {
    return []
  }
}
