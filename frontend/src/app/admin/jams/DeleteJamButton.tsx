'use client'

import { Trash2 } from 'lucide-react'
import { deleteJam } from '@/lib/actions/admin'

export function DeleteJamButton({ jamId, jamTitle }: { jamId: string; jamTitle: string }) {
  return (
    <form action={deleteJam.bind(null, jamId)}>
      <button
        type="submit"
        title="Supprimer la jam"
        className="p-1.5 border transition-opacity hover:opacity-80"
        style={{ borderColor: 'var(--secondary)', color: 'var(--secondary)' }}
        onClick={e => {
          if (!confirm(`Supprimer "${jamTitle}" ? Cette action est irréversible.`)) {
            e.preventDefault()
          }
        }}
      >
        <Trash2 size={13} aria-hidden="true" />
      </button>
    </form>
  )
}
