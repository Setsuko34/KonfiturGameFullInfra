'use server'

import { Query, Permission, Role } from 'node-appwrite'
import { serverDatabases, serverStorage } from '@/lib/appwrite/server'
import { createSessionClient } from '@/lib/appwrite/session'
import { DATABASE_ID, COLLECTIONS, BUCKETS } from '@/lib/appwrite/config'
import { mapDocToProject } from '@/lib/appwrite/types'
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

    // Appartenance à l'équipe
    const membership = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.TEAM_MEMBERS, [
      Query.equal('team_id', data.teamId),
      Query.equal('user_id', user.$id),
      Query.limit(1),
    ])
    if (membership.documents.length === 0) {
      return { success: false, error: 'Tu ne fais pas partie de cette équipe.' }
    }

    // Vérifier la propriété de chaque fichier transmis (uploadé par cet utilisateur, bon bucket)
    const screenshots = (data.screenshotIds ?? []).slice(0, 3)
    const fileChecks: Array<{ id: string; bucket: string }> = [
      ...(data.buildFileId ? [{ id: data.buildFileId, bucket: BUCKETS.PROJECT_BUILDS }] : []),
      ...(data.coverFileId ? [{ id: data.coverFileId, bucket: BUCKETS.PROJECT_ASSETS }] : []),
      ...screenshots.map(id => ({ id, bucket: BUCKETS.PROJECT_ASSETS })),
    ]
    for (const { id, bucket } of fileChecks) {
      const file = await serverStorage.getFile(bucket, id)
      const ownerRoles = ['read', 'update', 'delete'].map(a => `${a}("user:${user.$id}")`)
      const owned = file.$permissions.some(p => ownerRoles.includes(p))
      if (!owned) {
        return { success: false, error: 'Fichier invalide ou non autorisé.' }
      }
    }

    // Projet existant ? (un par couple team+jam)
    const existing = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.PROJECTS, [
      Query.equal('team_id', data.teamId),
      Query.equal('jam_id', data.jamId),
      Query.limit(1),
    ])

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
    if (existing.documents.length > 0) {
      const prev = existing.documents[0]
      // Supprimer les anciens fichiers remplacés (jamais d'orphelin côté remplacement)
      const oldNew: Array<{ old?: string; next?: string; bucket: string }> = [
        { old: prev.build_file_id as string | undefined, next: data.buildFileId, bucket: BUCKETS.PROJECT_BUILDS },
        { old: prev.cover_image_id as string | undefined, next: data.coverFileId, bucket: BUCKETS.PROJECT_ASSETS },
      ]
      for (const { old, next, bucket } of oldNew) {
        if (old && next && old !== next) {
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

    // Ouvrir la lecture publique des fichiers liés (l'uploader garde update/delete)
    for (const { id, bucket } of fileChecks) {
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
    await serverDatabases.updateDocument(DATABASE_ID, COLLECTIONS.PROJECTS, projectId, {
      reported: true,
    })
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { success: false, error: msg }
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
