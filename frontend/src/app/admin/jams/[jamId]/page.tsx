import { getOrganizedJamDetails } from '@/lib/actions/dashboard'
import { getAnnouncementsByJam } from '@/lib/actions/jams'
import { getTeamsByJam } from '@/lib/actions/teams'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Users, Send } from 'lucide-react'
import type { Metadata } from 'next'
import EditJamForm from '@/app/dashboard/my-jams/[jamId]/EditJamForm'
import AnnouncementForm from '@/app/dashboard/my-jams/[jamId]/AnnouncementForm'
import PlacementButtons from '@/components/PlacementButtons'
import AdminTeamActions from './AdminTeamActions'
import AdminProjectActions from './AdminProjectActions'

interface Props { params: Promise<{ jamId: string }> }

export const metadata: Metadata = { title: 'Gérer la jam' }

export default async function AdminManageJamPage({ params }: Props) {
  const { jamId } = await params
  let data: Awaited<ReturnType<typeof getOrganizedJamDetails>>
  let announcements: Awaited<ReturnType<typeof getAnnouncementsByJam>>
  try {
    ;[data, announcements] = await Promise.all([
      getOrganizedJamDetails(jamId), // double garde : organisateur OU admin
      getAnnouncementsByJam(jamId),
    ])
  } catch {
    notFound()
  }
  const { jam, projects } = data!
  const teams = await getTeamsByJam(jamId) // avec membres (pour « Retirer »)
  const jamEnded = jam.endDate < new Date()
  const submitted = projects.filter(p => p.submitted)

  return (
    <section aria-labelledby="admin-manage-jam-heading">
      <Link
        href="/admin/jams"
        className="inline-flex items-center gap-2 text-sm mb-6"
        style={{ color: 'var(--muted-foreground)' }}
      >
        <ArrowLeft size={14} aria-hidden="true" /> Retour aux jams
      </Link>

      <p className="px-4 py-2 border text-sm mb-6" style={{ borderColor: 'var(--secondary)', color: 'var(--secondary)' }}>
        Mode administrateur — vos actions sur cette jam sont journalisées
      </p>

      <h1 id="admin-manage-jam-heading" className="text-2xl font-bold mb-1">{jam.title}</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--primary)' }}>Thème : {jam.theme}</p>

      {/* Stats rapides */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="p-5 border flex items-center gap-4"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <Users size={24} style={{ color: 'var(--primary)' }} aria-hidden="true" />
          <div>
            <p className="text-2xl font-bold">{teams.length}</p>
            <p className="text-[9px] tracking-widest uppercase" style={{ color: 'var(--muted-foreground)' }}>Équipes</p>
          </div>
        </div>
        <div className="p-5 border flex items-center gap-4"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <Send size={24} style={{ color: 'var(--success)' }} aria-hidden="true" />
          <div>
            <p className="text-2xl font-bold">{submitted.length}</p>
            <p className="text-[9px] tracking-widest uppercase" style={{ color: 'var(--muted-foreground)' }}>Soumissions</p>
          </div>
        </div>
      </div>

      {jam.status !== 'ended' && <EditJamForm jam={jam} />}
      <AnnouncementForm jamId={jam.id} announcements={announcements!} />

      {/* Équipes */}
      <div className="mb-8">
        <h2 className="text-base font-bold mb-3">Équipes ({teams.length})</h2>
        {teams.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Aucune équipe inscrite.</p>
        ) : (
          <ul className="space-y-2" role="list">
            {teams.map(team => (
              <li key={team.id}
                className="px-4 py-3 border"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">{team.name}</span>
                  <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    Code : {team.inviteCode}
                  </span>
                </div>
                <AdminTeamActions team={team} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Projets soumis */}
      <div>
        <h2 className="text-base font-bold mb-3">Projets soumis ({submitted.length})</h2>
        {submitted.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Aucun projet soumis.</p>
        ) : (
          <ul className="space-y-2" role="list">
            {submitted.map(project => (
              <li key={project.id}
                className="px-4 py-3 border flex items-center justify-between gap-4"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <div>
                  <Link
                    href={`/project/${project.id}`}
                    className="font-semibold text-sm transition-opacity hover:opacity-80"
                    style={{ color: 'var(--primary)' }}
                  >
                    {project.title}
                  </Link>
                  <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                    {project.likesCount} like{project.likesCount !== 1 ? 's' : ''}
                    {project.submissionDate && ` · Soumis le ${project.submissionDate.toLocaleDateString('fr-FR')}`}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {jamEnded && (
                    <PlacementButtons projectId={project.id} placement={project.placement ?? 0} />
                  )}
                  <AdminProjectActions projectId={project.id} projectTitle={project.title} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
