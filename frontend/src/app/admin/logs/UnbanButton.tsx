'use client'

import { useTransition } from 'react'
import { Trash2, Loader2 } from 'lucide-react'
import { unbanIP } from '@/lib/actions/logs'

export default function UnbanButton({ bannedIPId, ip }: { bannedIPId: string; ip: string }) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      onClick={() => startTransition(() => unbanIP(bannedIPId))}
      disabled={isPending}
      className="p-1 transition-opacity hover:opacity-70"
      style={{ color: 'var(--muted-foreground)' }}
      aria-label={`Débannir ${ip}`}
      aria-busy={isPending}
    >
      {isPending
        ? <Loader2 size={11} className="animate-spin" aria-hidden="true" />
        : <Trash2 size={11} aria-hidden="true" />
      }
    </button>
  )
}
