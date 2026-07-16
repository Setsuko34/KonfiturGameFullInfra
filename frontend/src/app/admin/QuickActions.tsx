import Link from 'next/link'
import { AlertTriangle, Megaphone } from 'lucide-react'

export default function QuickActions({ pendingReports }: { pendingReports: number }) {
  return (
    <div>
      <h2 className="text-sm uppercase tracking-widest mb-4" style={{ color: 'var(--muted-foreground)' }}>
        Actions rapides
      </h2>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/admin/moderation"
          className="flex items-center gap-2 px-4 py-2.5 min-h-11 text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ background: 'var(--secondary)', color: '#fff' }}
        >
          <AlertTriangle size={14} aria-hidden="true" />
          Voir les signalements ({pendingReports})
        </Link>
        <Link
          href="/admin/announcements"
          className="flex items-center gap-2 px-4 py-2.5 min-h-11 text-sm font-medium border transition-opacity hover:opacity-80"
          style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
        >
          <Megaphone size={14} aria-hidden="true" />
          Nouvelle annonce
        </Link>
      </div>
    </div>
  )
}
