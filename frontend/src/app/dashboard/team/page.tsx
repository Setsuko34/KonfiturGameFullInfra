import type { Metadata } from 'next'
import { Query } from 'node-appwrite'
import { getUserTeams, getCurrentUser } from '@/lib/actions/dashboard'
import { getProjectByTeamAndJam } from '@/lib/actions/projects'
import { getJamById } from '@/lib/actions/jams'
import { serverDatabases } from '@/lib/appwrite/server'
import { DATABASE_ID, COLLECTIONS } from '@/lib/appwrite/config'
import { mapDocToGameJam } from '@/lib/appwrite/types'
import TeamPageClient from './TeamPageClient'
import type { Project } from '@/types'

export const metadata: Metadata = { title: 'Mes équipes' }

export default async function TeamPage() {
  const [user, teamsData] = await Promise.all([
    getCurrentUser(),
    getUserTeams(),
  ])

  // Résoudre les jams et projets pour chaque team
  const teamsWithContext = await Promise.all(
    teamsData.map(async ({ team, members, isLeader }) => {
      const jams = (
        await Promise.all(team.jamIds.map(jamId => getJamById(jamId)))
      ).filter(Boolean) as NonNullable<Awaited<ReturnType<typeof getJamById>>>[]

      const projectsByJam: Record<string, Project | null> = {}
      await Promise.all(
        jams
          .filter(j => j.status === 'ongoing')
          .map(async j => {
            projectsByJam[j.id] = await getProjectByTeamAndJam(team.id, j.id)
          })
      )

      return {
        team,
        members,
        isLeader,
        jams: jams.map(j => ({ id: j.id, title: j.title, status: j.status })),
        projectsByJam,
      }
    })
  )

  // Jams disponibles pour créer une team (upcoming + ongoing)
  const availableJamsRes = await serverDatabases.listDocuments(
    DATABASE_ID, COLLECTIONS.GAME_JAMS,
    [Query.notEqual('status', 'ended'), Query.limit(50)]
  )
  const availableJams = availableJamsRes.documents.map(mapDocToGameJam).map(j => ({
    id: j.id,
    title: j.title,
    status: j.status,
  }))

  return (
    <TeamPageClient
      user={{ id: user.$id, name: user.name }}
      teamsWithContext={teamsWithContext}
      availableJams={availableJams}
    />
  )
}
