'use server'

import { Query } from 'node-appwrite'
import { serverDatabases } from '@/lib/appwrite/server'
import { createSessionClient } from '@/lib/appwrite/session'
import { DATABASE_ID, COLLECTIONS } from '@/lib/appwrite/config'
import { mapDocToComment } from '@/lib/appwrite/types'
import type { Comment } from '@/types'

export async function getCommentsByProject(projectId: string): Promise<Comment[]> {
  try {
    const res = await serverDatabases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.COMMENTS,
      [
        Query.equal('project_id', projectId),
        Query.orderAsc('$createdAt'),
        Query.limit(100),
      ]
    )
    return res.documents.map(mapDocToComment)
  } catch {
    return []
  }
}

export async function addComment(data: {
  projectId: string
  content: string
}): Promise<{ success: boolean; comment?: Comment; error?: string }> {
  const sanitized = data.content
    .trim()
    .slice(0, 2048)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  if (!sanitized) {
    return { success: false, error: 'Le commentaire ne peut pas être vide.' }
  }

  try {
    const { account } = await createSessionClient()
    const user = await account.get()

    const doc = await serverDatabases.createDocument(
      DATABASE_ID,
      COLLECTIONS.COMMENTS,
      'unique()',
      {
        project_id: data.projectId,
        author_id: user.$id,
        author_name: user.name,
        content: sanitized,
      }
    )
    return { success: true, comment: mapDocToComment(doc) }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { success: false, error: msg }
  }
}
