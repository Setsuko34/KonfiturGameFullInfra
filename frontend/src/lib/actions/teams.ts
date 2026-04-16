'use server'

import { Query } from 'node-appwrite'
import { serverDatabases } from '@/lib/appwrite/server'
import { DATABASE_ID, COLLECTIONS } from '@/lib/appwrite/config'
import { mapDocToTeam, mapDocToTeamMember } from '@/lib/appwrite/types'
import type { Team, TeamMember } from '@/types'

// ── Génération du code d'invitation ──────────────────────────────────────────

function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return `KG-${code}`
}

// ── Helper : vérifier si un user est déjà dans une team pour une jam ─────────

async function isUserInTeamForJam(
  userId: string,
  jamId: string,
  excludeTeamId?: string
): Promise<boolean> {
  const memberships = await serverDatabases.listDocuments(
    DATABASE_ID, COLLECTIONS.TEAM_MEMBERS,
    [Query.equal('user_id', userId), Query.limit(50)]
  )
  if (memberships.total === 0) return false

  const teamIds = memberships.documents
    .map(m => m.team_id as string)
    .filter(id => id !== excludeTeamId)
  if (teamIds.length === 0) return false

  const teamsRes = await serverDatabases.listDocuments(
    DATABASE_ID, COLLECTIONS.TEAMS,
    [Query.equal('$id', teamIds), Query.contains('jam_ids', jamId), Query.limit(1)]
  )
  return teamsRes.total > 0
}

// ── createTeam ────────────────────────────────────────────────────────────────

export async function createTeam(data: {
  jamId?: string
  name: string
  leaderId: string
  leaderName: string
}): Promise<{ success: boolean; team?: Team; error?: string }> {
  try {
    if (data.jamId) {
      const conflict = await isUserInTeamForJam(data.leaderId, data.jamId)
      if (conflict) {
        return { success: false, error: 'Tu es déjà dans une équipe pour cette jam.' }
      }
    }

    const inviteCode = generateInviteCode()
    const teamDoc = await serverDatabases.createDocument(
      DATABASE_ID, COLLECTIONS.TEAMS, 'unique()',
      {
        jam_ids: data.jamId ? [data.jamId] : [],
        name: data.name,
        invite_code: inviteCode,
        leader_id: data.leaderId,
      }
    )

    // Ajouter le leader comme team_member
    await serverDatabases.createDocument(
      DATABASE_ID, COLLECTIONS.TEAM_MEMBERS, 'unique()',
      {
        team_id: teamDoc.$id,
        user_id: data.leaderId,
        name: data.leaderName,
        role: 'dev',
        is_leader: true,
      }
    )

    return { success: true, team: mapDocToTeam(teamDoc) }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { success: false, error: msg }
  }
}

// ── joinTeamByCode ────────────────────────────────────────────────────────────

export async function joinTeamByCode(
  inviteCode: string,
  userId: string,
  role: string,
  userName: string
): Promise<{ success: boolean; teamId?: string; error?: string }> {
  try {
    const res = await serverDatabases.listDocuments(
      DATABASE_ID, COLLECTIONS.TEAMS,
      [Query.equal('invite_code', inviteCode), Query.limit(1)]
    )
    if (res.documents.length === 0) {
      return { success: false, error: "Code d'invitation invalide." }
    }
    const teamDoc = res.documents[0]

    // Déjà membre de cette team ?
    const existing = await serverDatabases.listDocuments(
      DATABASE_ID, COLLECTIONS.TEAM_MEMBERS,
      [Query.equal('team_id', teamDoc.$id), Query.equal('user_id', userId), Query.limit(1)]
    )
    if (existing.documents.length > 0) {
      return { success: false, error: 'Tu es déjà membre de cette équipe.' }
    }

    // Vérifier 1 user par jam : pour chaque jam de cette team
    const jamIds: string[] = teamDoc.jam_ids ?? []
    for (const jamId of jamIds) {
      const conflict = await isUserInTeamForJam(userId, jamId)
      if (conflict) {
        return { success: false, error: 'Tu es déjà inscrit à cette jam avec une autre équipe.' }
      }
    }

    await serverDatabases.createDocument(
      DATABASE_ID, COLLECTIONS.TEAM_MEMBERS, 'unique()',
      {
        team_id: teamDoc.$id,
        user_id: userId,
        name: userName,
        role,
        is_leader: false,
      }
    )
    return { success: true, teamId: teamDoc.$id }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { success: false, error: msg }
  }
}

// ── getTeamsByJam ─────────────────────────────────────────────────────────────

export async function getTeamsByJam(jamId: string): Promise<Team[]> {
  try {
    const res = await serverDatabases.listDocuments(
      DATABASE_ID, COLLECTIONS.TEAMS,
      [Query.contains('jam_ids', jamId), Query.limit(100)]
    )
    const teams = res.documents.map(mapDocToTeam)

    for (const team of teams) {
      const membersRes = await serverDatabases.listDocuments(
        DATABASE_ID, COLLECTIONS.TEAM_MEMBERS,
        [Query.equal('team_id', team.id), Query.limit(20)]
      )
      team.members = membersRes.documents.map(mapDocToTeamMember)
    }

    return teams
  } catch {
    return []
  }
}

// ── registerTeamToJam ─────────────────────────────────────────────────────────

export async function registerTeamToJam(
  teamId: string,
  jamId: string,
  currentUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const teamDoc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.TEAMS, teamId)

    if (teamDoc.leader_id !== currentUserId) {
      return { success: false, error: 'Seul le leader peut inscrire une équipe.' }
    }

    const jamIds: string[] = teamDoc.jam_ids ?? []
    if (jamIds.includes(jamId)) {
      return { success: false, error: 'Cette équipe est déjà inscrite à cette jam.' }
    }

    // Vérifier que la jam existe et est upcoming/ongoing
    const jamDoc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.GAME_JAMS, jamId)
    if (!['upcoming', 'ongoing'].includes(jamDoc.status)) {
      return { success: false, error: 'Impossible de rejoindre une jam terminée.' }
    }

    // Vérifier qu'aucun membre de la team n'est déjà dans cette jam
    const membersRes = await serverDatabases.listDocuments(
      DATABASE_ID, COLLECTIONS.TEAM_MEMBERS,
      [Query.equal('team_id', teamId), Query.limit(50)]
    )
    for (const member of membersRes.documents) {
      const conflict = await isUserInTeamForJam(member.user_id as string, jamId, teamId)
      if (conflict) {
        return {
          success: false,
          error: `Le membre ${member.name} est déjà inscrit à cette jam avec une autre équipe.`,
        }
      }
    }

    await serverDatabases.updateDocument(DATABASE_ID, COLLECTIONS.TEAMS, teamId, {
      jam_ids: [...jamIds, jamId],
    })

    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { success: false, error: msg }
  }
}

// ── updateMemberRole ──────────────────────────────────────────────────────────

export async function updateMemberRole(
  teamMemberId: string,
  teamId: string,
  role: 'dev' | 'artist' | 'sound' | 'designer' | 'writer',
  currentUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const teamDoc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.TEAMS, teamId)
    if (teamDoc.leader_id !== currentUserId) {
      return { success: false, error: 'Seul le leader peut modifier les rôles.' }
    }

    const memberDoc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.TEAM_MEMBERS, teamMemberId)
    if (memberDoc.is_leader) {
      return { success: false, error: 'Impossible de modifier le rôle du leader.' }
    }

    await serverDatabases.updateDocument(DATABASE_ID, COLLECTIONS.TEAM_MEMBERS, teamMemberId, { role })
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { success: false, error: msg }
  }
}

// ── removeMemberFromTeam ──────────────────────────────────────────────────────

export async function removeMemberFromTeam(
  teamMemberId: string,
  teamId: string,
  currentUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const teamDoc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.TEAMS, teamId)
    const memberDoc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.TEAM_MEMBERS, teamMemberId)

    const isSelf = memberDoc.user_id === currentUserId
    const isLeader = teamDoc.leader_id === currentUserId

    if (!isSelf && !isLeader) {
      return { success: false, error: 'Action non autorisée.' }
    }
    if (memberDoc.is_leader) {
      return { success: false, error: 'Le leader ne peut pas quitter son équipe (supprimez-la à la place).' }
    }

    await serverDatabases.deleteDocument(DATABASE_ID, COLLECTIONS.TEAM_MEMBERS, teamMemberId)
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { success: false, error: msg }
  }
}

// ── deleteTeam ────────────────────────────────────────────────────────────────

export async function deleteTeam(
  teamId: string,
  currentUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const teamDoc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.TEAMS, teamId)
    if (teamDoc.leader_id !== currentUserId) {
      return { success: false, error: 'Seul le leader peut supprimer une équipe.' }
    }

    // Supprimer tous les membres
    const membersRes = await serverDatabases.listDocuments(
      DATABASE_ID, COLLECTIONS.TEAM_MEMBERS,
      [Query.equal('team_id', teamId), Query.limit(100)]
    )
    await Promise.all(
      membersRes.documents.map(m =>
        serverDatabases.deleteDocument(DATABASE_ID, COLLECTIONS.TEAM_MEMBERS, m.$id)
      )
    )

    await serverDatabases.deleteDocument(DATABASE_ID, COLLECTIONS.TEAMS, teamId)
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { success: false, error: msg }
  }
}
