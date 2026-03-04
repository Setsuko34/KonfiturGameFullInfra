import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  subtitle?: string
  action?: React.ReactNode
}

export default function EmptyState({ icon: Icon, title, subtitle, action }: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center py-20 px-4 text-center border"
      style={{
        background: 'var(--card)',
        borderColor: 'var(--border)',
        borderStyle: 'dashed',
      }}
    >
      {Icon && (
        <div
          className="w-14 h-14 flex items-center justify-center mb-4"
          style={{ background: 'var(--surface-elevated)' }}
        >
          <Icon size={24} style={{ color: 'var(--muted-foreground)' }} aria-hidden="true" />
        </div>
      )}
      <h3 className="font-semibold text-lg mb-2" style={{ fontFamily: 'var(--font-sans)' }}>
        {title}
      </h3>
      {subtitle && (
        <p className="text-sm max-w-xs" style={{ color: 'var(--muted-foreground)' }}>
          {subtitle}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
