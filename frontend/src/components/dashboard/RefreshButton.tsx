'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

// Re-exécute les server components de la route (donc getAdminDashboard)
// sans reload complet du navigateur.
export default function RefreshButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={isPending}
      aria-label="Rafraîchir les données"
      className="flex items-center gap-2 px-4 min-h-11 text-sm font-medium border transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ borderColor: 'var(--border)', color: 'var(--foreground)', background: 'var(--card)' }}
    >
      <RefreshCw size={14} aria-hidden="true" className={isPending ? 'animate-spin' : undefined} />
      Rafraîchir
    </button>
  )
}
