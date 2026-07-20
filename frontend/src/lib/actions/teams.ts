'use server'

import { Query } from 'node-appwrite'
import { serverDatabases } from '@/lib/appwrite/server'
import { createSessionClient } from '@/lib/appwrite/session'
import { DATABASE_ID, COLLECTIONS } from '@/lib/appwrite/config'
import { mapDocToTeam, mapDocToTeamMember, mapDocToGameJam, mapDocToProject, type AppwriteDoc } from '@/lib/appwrite/types'
import type { Team, TeamMember, GameJam, Project } from '@/types'
import { computeJamStatus } from '@/lib/jam-status'
import { canActOnTeam, logAdminAction } from '@/lib/appwrite/guards'
import { fetchAllDocs, fetchAllByField } from '@/lib/appwrite/fetch-all'

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
      const jamDoc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.GAME_JAMS, data.jamId)
      if (jamDoc.type === 'solo') {
        return { success: false, error: 'Cette jam est réservée aux participants solo.' }
      }
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

    if (teamDoc.is_solo) {
      return { success: false, error: 'Ce code correspond à une inscription solo, pas à une équipe.' }
    }

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
    const teamDocs = await fetchAllDocs(COLLECTIONS.TEAMS, [Query.contains('jam_ids', jamId)])
    const teams = teamDocs.map(mapDocToTeam)

    if (teams.length > 0) {
      const memberDocs = await fetchAllByField<AppwriteDoc>(COLLECTIONS.TEAM_MEMBERS, 'team_id', teams.map(t => t.id))
      const byTeam = new Map<string, TeamMember[]>()
      for (const doc of memberDocs) {
        const teamId = doc.team_id as string
        const list = byTeam.get(teamId) ?? []
        list.push(mapDocToTeamMember(doc))
        byTeam.set(teamId, list)
      }
      for (const team of teams) team.members = byTeam.get(team.id) ?? []
    }

    return teams
  } catch {
    return []
  }
}

// ── registerTeamToJam ─────────────────────────────────────────────────────────

export async function registerTeamToJam(
  teamId: string,
  jamId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { account } = await createSessionClient()
    const user = await account.get()
    const teamDoc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.TEAMS, teamId)

    if (teamDoc.leader_id !== user.$id) {
      return { success: false, error: 'Seul le leader peut inscrire une équipe.' }
    }

    if (teamDoc.is_solo) {
      return { success: false, error: 'Une inscription solo est liée à sa jam d\'origine.' }
    }

    const jamIds: string[] = teamDoc.jam_ids ?? []
    if (jamIds.includes(jamId)) {
      return { success: false, error: 'Cette équipe est déjà inscrite à cette jam.' }
    }

    // Vérifier que la jam existe et est upcoming/ongoing — statut calculé depuis
    // les dates (le champ `status` stocké n'est pas mis à jour automatiquement)
    const jamDoc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.GAME_JAMS, jamId)
    if (computeJamStatus(new Date(jamDoc.start_date), new Date(jamDoc.end_date)) === 'ended') {
      return { success: false, error: 'Impossible de rejoindre une jam terminée.' }
    }

    if (jamDoc.type === 'solo') {
      return { success: false, error: 'Cette jam est réservée aux participants solo.' }
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
  role: 'dev' | 'artist' | 'sound' | 'designer' | 'writer'
): Promise<{ success: boolean; error?: string }> {
  try {
    const { account } = await createSessionClient()
    const user = await account.get()

    const teamDoc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.TEAMS, teamId)
    const actorRole = await canActOnTeam(user.$id, teamDoc)
    if (!actorRole) {
      return { success: false, error: 'Seul le leader peut modifier les rôles.' }
    }

    const memberDoc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.TEAM_MEMBERS, teamMemberId)
    if (memberDoc.is_leader) {
      return { success: false, error: 'Impossible de modifier le rôle du leader.' }
    }

    await serverDatabases.updateDocument(DATABASE_ID, COLLECTIONS.TEAM_MEMBERS, teamMemberId, { role })

    if (actorRole === 'admin') {
      await logAdminAction(user.$id, `Changement du rôle de ${memberDoc.name} → ${role} dans l'équipe « ${teamDoc.name} » (${teamId})`, `/team/${teamId}`)
    }

    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { success: false, error: msg }
  }
}

// ── removeMemberFromTeam ──────────────────────────────────────────────────────

export async function removeMemberFromTeam(
  teamMemberId: string,
  teamId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { account } = await createSessionClient()
    const user = await account.get()

    const teamDoc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.TEAMS, teamId)
    const memberDoc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.TEAM_MEMBERS, teamMemberId)

    // Autorisé : le membre lui-même (self-leave), le leader, ou un admin
    const isSelf = memberDoc.user_id === user.$id
    const actorRole = isSelf ? null : await canActOnTeam(user.$id, teamDoc)

    if (!isSelf && !actorRole) {
      return { success: false, error: 'Action non autorisée.' }
    }
    if (memberDoc.is_leader) {
      return { success: false, error: 'Le leader ne peut pas quitter son équipe (supprimez-la à la place).' }
    }

    await serverDatabases.deleteDocument(DATABASE_ID, COLLECTIONS.TEAM_MEMBERS, teamMemberId)

    if (actorRole === 'admin') {
      await logAdminAction(user.$id, `Retrait de ${memberDoc.name} de l'équipe « ${teamDoc.name} » (${teamId})`, `/team/${teamId}`)
    }

    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { success: false, error: msg }
  }
}

// ── deleteTeam ────────────────────────────────────────────────────────────────

export async function deleteTeam(
  teamId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { account } = await createSessionClient()
    const user = await account.get()

    const teamDoc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.TEAMS, teamId)
    const actorRole = await canActOnTeam(user.$id, teamDoc)
    if (!actorRole) {
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

    if (actorRole === 'admin') {
      await logAdminAction(user.$id, `Dissolution de l'équipe « ${teamDoc.name} » (${teamId})`, `/team/${teamId}`)
    }

    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { success: false, error: msg }
  }
}

// ── renameTeam ────────────────────────────────────────────────────────────────

export async function renameTeam(
  teamId: string,
  name: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { account } = await createSessionClient()
    const user = await account.get()

    const trimmed = name.trim()
    if (trimmed.length < 3 || trimmed.length > 50) {
      return { success: false, error: 'Le nom doit faire entre 3 et 50 caractères.' }
    }

    const teamDoc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.TEAMS, teamId)
    const actorRole = await canActOnTeam(user.$id, teamDoc)
    if (!actorRole) {
      return { success: false, error: 'Seul le leader peut renommer l\'équipe.' }
    }
    if (teamDoc.is_solo) {
      return { success: false, error: 'Une inscription solo ne peut pas être renommée.' }
    }

    await serverDatabases.updateDocument(DATABASE_ID, COLLECTIONS.TEAMS, teamId, { name: trimmed })

    if (actorRole === 'admin') {
      await logAdminAction(user.$id, `Renommage de l'équipe « ${teamDoc.name} » → « ${trimmed} » (${teamId})`, `/team/${teamId}`)
    }

    return { success: true }
  } catch {
    return { success: false, error: 'Une erreur est survenue.' }
  }
}

// ── registerSoloToJam ─────────────────────────────────────────────────────────

export async function registerSoloToJam(
  jamId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { account } = await createSessionClient()
    const user = await account.get()

    const jamDoc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.GAME_JAMS, jamId)
    if (jamDoc.type === 'team') {
      return { success: false, error: 'Cette jam est réservée aux équipes.' }
    }
    if (computeJamStatus(new Date(jamDoc.start_date), new Date(jamDoc.end_date)) === 'ended') {
      return { success: false, error: 'Impossible de rejoindre une jam terminée.' }
    }
    if (await isUserInTeamForJam(user.$id, jamId)) {
      return { success: false, error: 'Tu es déjà inscrit à cette jam.' }
    }

    // Une seule team solo par user : réutilisée d'une jam à l'autre plutôt que
    // d'en recréer une (le membre existe déjà, jam_ids s'étend simplement)
    const existingSolo = await serverDatabases.listDocuments(
      DATABASE_ID, COLLECTIONS.TEAMS,
      [Query.equal('leader_id', user.$id), Query.equal('is_solo', true), Query.limit(1)]
    )
    if (existingSolo.documents.length > 0) {
      const soloTeamDoc = existingSolo.documents[0]
      const jamIds: string[] = soloTeamDoc.jam_ids ?? []
      await serverDatabases.updateDocument(DATABASE_ID, COLLECTIONS.TEAMS, soloTeamDoc.$id, {
        jam_ids: [...jamIds, jamId],
      })
      return { success: true }
    }

    // Team technique de 1 : tout le circuit (projets, compteurs, unicité) reste inchangé
    const teamDoc = await serverDatabases.createDocument(
      DATABASE_ID, COLLECTIONS.TEAMS, 'unique()',
      {
        jam_ids: [jamId],
        name: user.name,
        invite_code: generateInviteCode(),
        leader_id: user.$id,
        is_solo: true,
      }
    )
    await serverDatabases.createDocument(
      DATABASE_ID, COLLECTIONS.TEAM_MEMBERS, 'unique()',
      { team_id: teamDoc.$id, user_id: user.$id, name: user.name, role: 'dev', is_leader: true }
    )

    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { success: false, error: msg }
  }
}

// ── unregisterSoloFromJam ─────────────────────────────────────────────────────

export async function unregisterSoloFromJam(
  jamId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { account } = await createSessionClient()
    const user = await account.get()

    // La team solo est partagée entre jams : on ne la supprime jamais ici, on
    // retire seulement la jam de jam_ids (réutilisée à la prochaine inscription solo)
    const soloRes = await serverDatabases.listDocuments(
      DATABASE_ID, COLLECTIONS.TEAMS,
      [Query.equal('leader_id', user.$id), Query.equal('is_solo', true), Query.limit(1)]
    )
    if (soloRes.documents.length === 0) {
      return { success: false, error: 'Aucune inscription solo trouvée.' }
    }
    const teamDoc = soloRes.documents[0]
    const jamIds: string[] = teamDoc.jam_ids ?? []
    if (!jamIds.includes(jamId)) {
      return { success: false, error: 'Tu n\'es pas inscrit à cette jam en solo.' }
    }

    // Désinscription possible uniquement avant le début de la jam, comme pour les équipes
    const jamDoc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.GAME_JAMS, jamId)
    if (computeJamStatus(new Date(jamDoc.start_date), new Date(jamDoc.end_date)) !== 'upcoming') {
      return { success: false, error: 'Impossible de se désinscrire, la jam a déjà commencé.' }
    }

    await serverDatabases.updateDocument(DATABASE_ID, COLLECTIONS.TEAMS, teamDoc.$id, {
      jam_ids: jamIds.filter(id => id !== jamId),
    })

    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { success: false, error: msg }
  }
}

// ── getTeamById (page publique équipe) ────────────────────────────────────────

export async function getTeamById(teamId: string): Promise<{
  team: Team
  members: TeamMember[]
  jams: GameJam[]
  projects: Project[]
  viewerRole: 'visitor' | 'member' | 'leader'
  viewerId: string | null
} | null> {
  try {
    const teamDoc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.TEAMS, teamId)
    const team = mapDocToTeam(teamDoc)

    const [membersDocs, projectsDocs] = await Promise.all([
      fetchAllDocs<AppwriteDoc>(COLLECTIONS.TEAM_MEMBERS, [Query.equal('team_id', teamId)]),
      fetchAllDocs<AppwriteDoc>(COLLECTIONS.PROJECTS, [
        Query.equal('team_id', teamId),
        Query.equal('submitted', true),
      ]),
    ])

    const members = membersDocs.map(mapDocToTeamMember)
    const projects = projectsDocs.map(mapDocToProject)

    // Rôle du viewer — session facultative (page publique)
    let viewerRole: 'visitor' | 'member' | 'leader' = 'visitor'
    let viewerId: string | null = null
    try {
      const { account } = await createSessionClient()
      const user = await account.get()
      viewerId = user.$id
      if (team.leaderId === user.$id) viewerRole = 'leader'
      else if (members.some(m => m.userId === user.$id)) viewerRole = 'member'
    } catch {
      // non connecté — visitor
    }

    // Le code d'invitation ne quitte jamais le serveur pour un visiteur
    if (viewerRole === 'visitor') team.inviteCode = ''

    const jamDocs = await fetchAllByField<AppwriteDoc>(COLLECTIONS.GAME_JAMS, '$id', team.jamIds)
    const jams: GameJam[] = jamDocs.map(mapDocToGameJam)

    return { team, members, jams, projects, viewerRole, viewerId }
  } catch {
    return null
  }
}
