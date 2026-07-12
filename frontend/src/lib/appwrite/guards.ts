import { Query } from 'node-appwrite'
import { serverDatabases, serverTeams } from '@/lib/appwrite/server'
import { DATABASE_ID, COLLECTIONS, ADMIN_TEAM_ID } from '@/lib/appwrite/config'

// Vérifie l'appartenance à la team admin — fail-closed sur toute erreur
export async function isAdminUser(userId: string): Promise<boolean> {
  try {
    const memberships = await serverTeams.listMemberships(ADMIN_TEAM_ID, [
      Query.equal('userId', userId),
      Query.limit(1),
    ])
    return memberships.total > 0
  } catch {
    return false // team absente ou API down = pas admin
  }
}

// Double garde : propriétaire d'abord (aucune requête), sinon admin, sinon null
export async function canActOnJam(
  userId: string,
  jamDoc: Record<string, unknown>
): Promise<'owner' | 'admin' | null> {
  if (jamDoc.organizer_id === userId) return 'owner'
  return (await isAdminUser(userId)) ? 'admin' : null
}

export async function canActOnTeam(
  userId: string,
  teamDoc: Record<string, unknown>
): Promise<'owner' | 'admin' | null> {
  if (teamDoc.leader_id === userId) return 'owner'
  return (await isAdminUser(userId)) ? 'admin' : null
}

// Audit des actions admin non-propriétaire — fire-and-forget, ne bloque jamais l'action métier
export async function logAdminAction(userId: string, message: string, path: string): Promise<void> {
  try {
    await serverDatabases.createDocument(DATABASE_ID, COLLECTIONS.AUDIT_LOGS, 'unique()', {
      type: 'admin_action',
      user_id: userId,
      message,
      path,
    })
  } catch {
    // l'échec du log ne doit pas faire échouer l'action métier (décision spec)
  }
}
