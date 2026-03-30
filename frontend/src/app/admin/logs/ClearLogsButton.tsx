'use client'

import { useTransition } from 'react'
import { Trash2, Loader2 } from 'lucide-react'
import { clearOldLogs } from '@/lib/actions/logs'

export default function ClearLogsButton() {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      onClick={() => {
        if (!confirm('Supprimer les logs de plus de 30 jours ?')) return
        startTransition(async () => { await clearOldLogs(30) })
      }}
      disabled={isPending}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-70"
      style={{ color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}
      aria-busy={isPending}
    >
      {isPending ? <Loader2 size={11} className="animate-spin" aria-hidden="true" /> : <Trash2 size={11} aria-hidden="true" />}
      Nettoyer logs &gt;30j
    </button>
  )
}
