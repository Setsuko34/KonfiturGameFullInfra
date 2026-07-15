'use server'

import { Query } from 'node-appwrite'
import { createSessionClient } from '@/lib/appwrite/session'
import { serverDatabases } from '@/lib/appwrite/server'
import { DATABASE_ID, COLLECTIONS } from '@/lib/appwrite/config'

export interface UserDataExport {
  exportedAt: string
  profile: { id: string; name: string; email: string; bio: string; createdAt: string }
  teamMemberships: Record<string, unknown>[]
  chatMessages: Record<string, unknown>[]
  comments: Record<string, unknown>[]
  likes: Record<string, unknown>[]
  projects: Record<string, unknown>[]
  auditLogs: Record<string, unknown>[] // droit d'accès (RGPD art. 15) : logs de sécurité (IP, connexions)
}

const PAGE_SIZE = 100

// Les documents Appwrite ne sont pas des « plain objects » : les passer tels quels
// à un Client Component fait échouer la sérialisation RSC. On les aplatit en JSON pur.
function toPlain(doc: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(doc))
}

// Récupère TOUS les documents d'une collection pour un champ identité donné
// (pagination — un export RGPD ne doit jamais tronquer silencieusement)
async function listAllByField(collection: string, field: string, value: string) {
  const docs: Record<string, unknown>[] = []
  let offset = 0
  for (;;) {
    const res = await serverDatabases.listDocuments(DATABASE_ID, collection, [
      Query.equal(field, value),
      Query.limit(PAGE_SIZE),
      Query.offset(offset),
    ])
    docs.push(...res.documents.map(toPlain))
    if (res.documents.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return docs
}

export async function exportUserData(): Promise<UserDataExport> {
  // Fail-closed : sans session valide, createSessionClient/account.get rejette
  const { account } = await createSessionClient()
  const user = await account.get()

  const [teamMemberships, chatMessages, comments, likes, auditLogs] = await Promise.all([
    listAllByField(COLLECTIONS.TEAM_MEMBERS, 'user_id', user.$id),
    listAllByField(COLLECTIONS.CHAT_MESSAGES, 'author_id', user.$id),
    listAllByField(COLLECTIONS.COMMENTS, 'author_id', user.$id),
    listAllByField(COLLECTIONS.LIKES, 'user_id', user.$id),
    listAllByField(COLLECTIONS.AUDIT_LOGS, 'user_id', user.$id),
  ])

  const teamIds = [...new Set(teamMemberships.map(m => m.team_id as string))]
  const projects: Record<string, unknown>[] = []
  if (teamIds.length > 0) {
    const res = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.PROJECTS, [
      Query.equal('team_id', teamIds),
      Query.limit(500), // ponytail: une même personne membre de +500 projets n'existe pas encore
    ])
    projects.push(...res.documents.map(toPlain))
  }

  return {
    exportedAt: new Date().toISOString(),
    profile: {
      id: user.$id,
      name: user.name,
      email: user.email,
      bio: ((user.prefs as { bio?: string })?.bio) ?? '',
      createdAt: user.$createdAt,
    },
    teamMemberships,
    chatMessages,
    comments,
    likes,
    projects,
    auditLogs,
  }
}
