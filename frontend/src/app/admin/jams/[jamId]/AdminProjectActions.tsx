'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Undo2 } from 'lucide-react'
import { unsubmitProject } from '@/lib/actions/projects'

export default function AdminProjectActions({ projectId, projectTitle }: { projectId: string; projectTitle: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleUnsubmit = () => {
    if (!confirm(`Retirer la soumission "${projectTitle}" ? Le projet ne sera plus visible publiquement.`)) return
    setError(null)
    startTransition(async () => {
      const res = await unsubmitProject(projectId)
      if (!res.success) setError(res.error ?? 'Une erreur est survenue.')
      else router.refresh()
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleUnsubmit}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 px-3 min-h-11 text-xs font-medium border transition-opacity hover:opacity-80"
        style={{ borderColor: 'var(--secondary)', color: 'var(--secondary)' }}
      >
        <Undo2 size={13} aria-hidden="true" /> Retirer la soumission
      </button>
      {error && (
        <p className="text-xs" style={{ color: 'var(--secondary)' }} role="alert">{error}</p>
      )}
    </div>
  )
}
