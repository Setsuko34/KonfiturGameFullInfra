import { Query } from 'node-appwrite'
import { COLLECTIONS } from './config'
import { fetchAllDocs, fetchAllByField, FILTER_MAX } from './fetch-all'
import type { AppwriteDoc } from './types'

/**
 * Nombre d'inscrits réels par jam : somme des membres des équipes inscrites,
 * participations solo comprises (une inscription solo est une équipe de 1).
 * Le champ stocké game_jams.participants n'est jamais mis à jour par les
 * inscriptions : toute surface qui affiche un compteur doit passer par ici.
 */
export async function getParticipantCountsByJam(
  jamIds: string[],
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}
  for (const id of jamIds) counts[id] = 0
  if (jamIds.length === 0) return counts

  try {
    // contains multi-valeurs = OR, plafonné à FILTER_MAX valeurs par requête (même
    // contrainte Appwrite que fetchAllByField) ; dédup par $id car une équipe
    // multi-jams peut matcher plusieurs lots
    const teamsById = new Map<string, AppwriteDoc>()
    for (let i = 0; i < jamIds.length; i += FILTER_MAX) {
      const chunk = jamIds.slice(i, i + FILTER_MAX)
      const docs = await fetchAllDocs<AppwriteDoc>(COLLECTIONS.TEAMS, [Query.contains('jam_ids', chunk)])
      for (const d of docs) teamsById.set(d.$id, d)
    }
    if (teamsById.size === 0) return counts

    const memberDocs = await fetchAllByField<AppwriteDoc>(
      COLLECTIONS.TEAM_MEMBERS, 'team_id', [...teamsById.keys()]
    )
    const sizeByTeam = new Map<string, number>()
    for (const m of memberDocs) {
      const teamId = m.team_id as string
      sizeByTeam.set(teamId, (sizeByTeam.get(teamId) ?? 0) + 1)
    }

    for (const team of teamsById.values()) {
      const size = sizeByTeam.get(team.$id) ?? 0
      for (const jamId of (team.jam_ids as string[] | undefined) ?? []) {
        if (jamId in counts) counts[jamId] += size
      }
    }
  } catch {
    // en cas d'erreur Appwrite, compteurs à 0 plutôt que page cassée
  }

  return counts
}
