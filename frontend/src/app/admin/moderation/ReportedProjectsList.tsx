'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { CheckCircle, ExternalLink } from 'lucide-react'
import { resolveProjectReport } from '@/lib/actions/admin'
import AdminProjectActions from '@/app/admin/jams/[jamId]/AdminProjectActions'
import type { Project } from '@/types'

// Composant List de LoadMoreList : les projets résolus sont masqués localement
// (LoadMoreList ne réinitialise pas son état accumulé depuis les props après revalidatePath).
export default function ReportedProjectsList({ items }: { items: Project[] }) {
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set())
  const visible = items.filter(p => !removedIds.has(p.id))

  if (visible.length === 0) {
    return <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Aucun projet signalé.</p>
  }

  return (
    <div className="space-y-3">
      {visible.map(project => (
        <ProjectRow key={project.id} project={project} onRemoved={() => setRemovedIds(prev => new Set(prev).add(project.id))} />
      ))}
    </div>
  )
}

function ProjectRow({ project, onRemoved }: { project: Project; onRemoved: () => void }) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="p-4 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <Link
            href={`/project/${project.id}`}
            className="font-semibold text-sm mb-1 underline transition-opacity hover:opacity-80"
            style={{ color: 'var(--primary)' }}
          >
            {project.title}
          </Link>
          <p className="text-sm break-words" style={{ color: 'var(--muted-foreground)' }}>
            {project.description}
          </p>
          <Link
            href={`/admin/jams/${project.jamId}`}
            className="inline-flex items-center gap-1 text-xs mt-2 underline"
            style={{ color: 'var(--primary)' }}
          >
            <ExternalLink size={11} aria-hidden="true" /> Gérer la jam
          </Link>
        </div>
        <div className="flex items-start gap-2 flex-shrink-0">
          <AdminProjectActions projectId={project.id} projectTitle={project.title} />
          <button
            type="button"
            title="Marquer comme résolu"
            aria-label="Marquer comme résolu"
            disabled={isPending}
            onClick={() => startTransition(async () => { await resolveProjectReport(project.id); onRemoved() })}
            className="p-1.5 min-h-11 min-w-11 border transition-opacity hover:opacity-80 flex-shrink-0 disabled:opacity-50"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
          >
            <CheckCircle size={13} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}
