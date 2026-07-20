import { getOrganizedJamDetails } from '@/lib/actions/dashboard'
import { getAnnouncementsByJam } from '@/lib/actions/jams'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Users, Send } from 'lucide-react'
import type { Metadata } from 'next'
import EditJamForm from './EditJamForm'
import AnnouncementForm from './AnnouncementForm'
import PlacementButtons from '@/components/PlacementButtons'

interface Props { params: Promise<{ jamId: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `Gestion jam` }
}

export default async function ManageJamPage({ params }: Props) {
  const { jamId } = await params
  let data: Awaited<ReturnType<typeof getOrganizedJamDetails>>
  let announcementsRes: Awaited<ReturnType<typeof getAnnouncementsByJam>>
  try {
    ;[data, announcementsRes] = await Promise.all([
      getOrganizedJamDetails(jamId),
      getAnnouncementsByJam(jamId),
    ])
  } catch {
    notFound()
  }
  const { jam, teams, projects } = data!
  const announcements = announcementsRes!.announcements
  const jamEnded = jam.endDate < new Date()

  return (
    <section aria-labelledby="manage-jam-heading">
      <Link
        href="/dashboard/my-jams"
        className="inline-flex items-center gap-2 text-sm mb-6"
        style={{ color: 'var(--muted-foreground)' }}
      >
        <ArrowLeft size={14} aria-hidden="true" /> Retour à mes jams
      </Link>

      <h1 id="manage-jam-heading" className="text-2xl font-bold mb-1">{jam.title}</h1>
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
            <p className="text-2xl font-bold">{projects.filter(p => p.submitted).length}</p>
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
                className="px-4 py-3 border flex items-center justify-between"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <span className="font-semibold text-sm">{team.name}</span>
                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  Code : {team.inviteCode}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Projets soumis */}
      <div>
        <h2 className="text-base font-bold mb-1">
          Projets soumis ({projects.filter(p => p.submitted).length})
          {!jamEnded && (
            <span className="ml-2 text-xs font-normal" style={{ color: 'var(--muted-foreground)' }}>
              (Podium ouvrable après la fin de la jam)
            </span>
          )}
        </h2>
        {jamEnded && (
          <p className="text-xs mb-3" style={{ color: 'var(--muted-foreground)' }}>
            Désigne le top 3 (reclique un rang pour le retirer)
          </p>
        )}
        {projects.filter(p => p.submitted).length === 0 ? (
          <p className="text-sm mt-3" style={{ color: 'var(--muted-foreground)' }}>Aucun projet soumis.</p>
        ) : (
          <ul className="space-y-2 mt-3" role="list">
            {projects.filter(p => p.submitted).map(project => (
              <li key={project.id}
                className="px-4 py-3 border flex items-center justify-between"
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
                {jamEnded && (
                  <PlacementButtons projectId={project.id} placement={project.placement ?? 0} />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

