'use server'

import { Query } from 'node-appwrite'
import { serverDatabases } from '@/lib/appwrite/server'
import { DATABASE_ID, COLLECTIONS } from '@/lib/appwrite/config'
import { mapDocToTeam, mapDocToTeamMember } from '@/lib/appwrite/types'
import type { Team } from '@/types'

function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return `KG-${code}`
}

export async function createTeam(data: {
  jamId: string
  name: string
  leaderId: string
}): Promise<{ success: boolean; team?: Team; error?: string }> {
  try {
    const inviteCode = generateInviteCode()
    const teamDoc = await serverDatabases.createDocument(
      DATABASE_ID,
      COLLECTIONS.TEAMS,
      'unique()',
      {
        jam_id: data.jamId,
        name: data.name,
        invite_code: inviteCode,
        leader_id: data.leaderId,
      }
    )
    const team = mapDocToTeam(teamDoc)
    return { success: true, team }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { success: false, error: msg }
  }
}

export async function joinTeamByCode(
  inviteCode: string,
  userId: string,
  role: string,
  userName: string
): Promise<{ success: boolean; teamId?: string; error?: string }> {
  try {
    const res = await serverDatabases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.TEAMS,
      [Query.equal('invite_code', inviteCode), Query.limit(1)]
    )
    if (res.documents.length === 0) {
      return { success: false, error: 'Code d\'invitation invalide.' }
    }
    const team = res.documents[0]

    // Vérifier que l'utilisateur n'est pas déjà membre
    const existing = await serverDatabases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.TEAM_MEMBERS,
      [
        Query.equal('team_id', team.$id),
        Query.equal('user_id', userId),
        Query.limit(1),
      ]
    )
    if (existing.documents.length > 0) {
      return { success: false, error: 'Vous êtes déjà membre de cette équipe.' }
    }

    await serverDatabases.createDocument(
      DATABASE_ID,
      COLLECTIONS.TEAM_MEMBERS,
      'unique()',
      {
        team_id: team.$id,
        user_id: userId,
        name: userName,
        role,
        is_leader: false,
      }
    )
    return { success: true, teamId: team.$id }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { success: false, error: msg }
  }
}

export async function getTeamsByJam(jamId: string): Promise<Team[]> {
  try {
    const res = await serverDatabases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.TEAMS,
      [Query.equal('jam_id', jamId), Query.limit(100)]
    )
    const teams = res.documents.map(mapDocToTeam)

    // Charger les membres pour chaque équipe
    for (const team of teams) {
      const membersRes = await serverDatabases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.TEAM_MEMBERS,
        [Query.equal('team_id', team.id), Query.limit(20)]
      )
      team.members = membersRes.documents.map(mapDocToTeamMember)
    }

    return teams
  } catch {
    return []
  }
}
