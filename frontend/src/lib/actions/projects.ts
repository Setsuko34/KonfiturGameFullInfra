'use server'

import { Query } from 'node-appwrite'
import { serverDatabases } from '@/lib/appwrite/server'
import { createSessionClient } from '@/lib/appwrite/session'
import { DATABASE_ID, COLLECTIONS } from '@/lib/appwrite/config'
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
}): Promise<{ success: boolean; projectId?: string; error?: string }> {
  try {
    // Vérifier si un projet existe déjà pour cette équipe dans cette jam
    const existing = await serverDatabases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.PROJECTS,
      [
        Query.equal('team_id', data.teamId),
        Query.equal('jam_id', data.jamId),
        Query.limit(1),
      ]
    )

    if (existing.documents.length > 0) {
      // Mettre à jour le projet existant
      const doc = await serverDatabases.updateDocument(
        DATABASE_ID,
        COLLECTIONS.PROJECTS,
        existing.documents[0].$id,
        {
          title: data.title,
          description: data.description,
          technologies: data.technologies,
          download_url: data.downloadUrl,
          repo_url: data.repoUrl,
          submitted: true,
          submission_date: new Date().toISOString(),
        }
      )
      return { success: true, projectId: doc.$id }
    }

    // Créer un nouveau projet
    const doc = await serverDatabases.createDocument(
      DATABASE_ID,
      COLLECTIONS.PROJECTS,
      'unique()',
      {
        jam_id: data.jamId,
        team_id: data.teamId,
        title: data.title,
        description: data.description,
        technologies: data.technologies,
        download_url: data.downloadUrl,
        repo_url: data.repoUrl,
        submitted: true,
        submission_date: new Date().toISOString(),
        likes_count: 0,
      }
    )
    return { success: true, projectId: doc.$id }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { success: false, error: msg }
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
