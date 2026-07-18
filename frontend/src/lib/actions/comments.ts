'use server'

import { Query } from 'node-appwrite'
import { serverDatabases } from '@/lib/appwrite/server'
import { createSessionClient } from '@/lib/appwrite/session'
import { DATABASE_ID, COLLECTIONS } from '@/lib/appwrite/config'
import { mapDocToComment } from '@/lib/appwrite/types'
import type { Comment } from '@/types'

const COMMENTS_BATCH_SIZE = 100 // taille de lot délibérée pour « Voir plus » (ex-plafond)

/**
 * Récupère un lot de commentaires d'un projet, le plus ancien d'abord. `cursor` (dernier $id du
 * lot précédent) permet d'enchaîner via « Voir plus ». `nextCursor` vaut null dès que le lot
 * revient incomplet : c'est le seul signal honnête qu'il n'y a plus rien à charger.
 */
export async function getCommentsByProject(
  projectId: string,
  cursor?: string,
): Promise<{ comments: Comment[]; nextCursor: string | null }> {
  try {
    const queries = [
      Query.equal('project_id', projectId),
      Query.orderAsc('$createdAt'),
      Query.limit(COMMENTS_BATCH_SIZE),
    ]
    if (cursor) queries.push(Query.cursorAfter(cursor))

    const res = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.COMMENTS, queries)
    const comments = res.documents.map(mapDocToComment)
    const nextCursor = res.documents.length < COMMENTS_BATCH_SIZE
      ? null
      : res.documents[res.documents.length - 1].$id

    return { comments, nextCursor }
  } catch {
    return { comments: [], nextCursor: null }
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
