import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  href: string
  urgent?: boolean
}

export default function StatCard({ label, value, icon: Icon, href, urgent = false }: StatCardProps) {
  return (
    <Link
      href={href}
      className="p-5 border flex flex-col gap-3 transition-opacity hover:opacity-80"
      style={{
        background: 'var(--card)',
        borderColor: urgent ? 'var(--secondary)' : 'var(--border)',
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>
          {label}
        </span>
        <Icon
          size={14}
          aria-hidden="true"
          style={{ color: urgent ? 'var(--secondary)' : 'var(--muted-foreground)' }}
        />
      </div>
      <span
        className="text-3xl font-bold"
        style={{
          fontFamily: 'var(--font-mono)',
          color: urgent ? 'var(--secondary)' : 'var(--foreground)',
        }}
      >
        {value}
      </span>
    </Link>
  )
}
