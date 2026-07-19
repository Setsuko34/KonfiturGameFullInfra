import type { Metadata } from 'next'
import { Query } from 'node-appwrite'
import { getUserTeams, getCurrentUser } from '@/lib/actions/dashboard'
import { serverDatabases } from '@/lib/appwrite/server'
import { DATABASE_ID, COLLECTIONS } from '@/lib/appwrite/config'
import { mapDocToGameJam } from '@/lib/appwrite/types'
import TeamsListClient from './TeamsListClient'

export const metadata: Metadata = { title: 'Mes équipes' }

export default async function TeamsPage() {
  const [user, teamsData] = await Promise.all([getCurrentUser(), getUserTeams()])

  // Jams ouvertes pour la modal de création (les jams solo n'acceptent pas d'équipe)
  const availableJamsRes = await serverDatabases.listDocuments(
    DATABASE_ID, COLLECTIONS.GAME_JAMS,
    [Query.notEqual('status', 'ended'), Query.limit(50)]
  )
  const availableJams = availableJamsRes.documents.map(mapDocToGameJam)
    .filter(j => j.type !== 'solo')
    .map(j => ({ id: j.id, title: j.title, status: j.status }))

  const teams = teamsData.map(({ team, members, isLeader }) => ({
    id: team.id,
    name: team.name,
    isSolo: team.isSolo,
    membersCount: members.length,
    activeJams: team.jamIds.length,
    isLeader,
  }))

  return (
    <TeamsListClient
      user={{ id: user.$id, name: user.name }}
      teams={teams}
      availableJams={availableJams}
    />
  )
}
