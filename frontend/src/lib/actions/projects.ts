'use server'

import { Query } from 'node-appwrite'
import { serverDatabases } from '@/lib/appwrite/server'
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
        Query.orderDesc('votes_count'),
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
        votes_count: 0,
      }
    )
    return { success: true, projectId: doc.$id }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { success: false, error: msg }
  }
}

export async function voteForProject(
  projectId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Vérifier que l'utilisateur n'a pas déjà voté
    const existing = await serverDatabases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.VOTES,
      [
        Query.equal('project_id', projectId),
        Query.equal('user_id', userId),
        Query.limit(1),
      ]
    )
    if (existing.documents.length > 0) {
      return { success: false, error: 'Vous avez déjà voté pour ce projet.' }
    }

    // Enregistrer le vote
    await serverDatabases.createDocument(DATABASE_ID, COLLECTIONS.VOTES, 'unique()', {
      project_id: projectId,
      user_id: userId,
    })

    // Incrémenter le compteur
    const project = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.PROJECTS, projectId)
    await serverDatabases.updateDocument(DATABASE_ID, COLLECTIONS.PROJECTS, projectId, {
      votes_count: (project.votes_count ?? 0) + 1,
    })

    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { success: false, error: msg }
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
