import type { LucideIcon } from 'lucide-react'

interface StatBlockProps {
  icon: LucideIcon
  value: string | number
  label: string
  trend?: string
  accentColor?: string
}

export default function StatBlock({
  icon: Icon,
  value,
  label,
  trend,
  accentColor = 'var(--primary)',
}: StatBlockProps) {
  return (
    <div
      className="p-5 border"
      style={{
        background: 'var(--card)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="p-2"
          style={{ background: 'var(--surface-elevated)' }}
        >
          <Icon size={18} style={{ color: accentColor }} aria-hidden="true" />
        </div>
        {trend && (
          <span
            className="label-tech"
            style={{ color: 'var(--success)' }}
            aria-label={`Tendance : ${trend}`}
          >
            {trend}
          </span>
        )}
      </div>
      <p
        className="text-3xl font-bold mb-1 timer-font"
        style={{ color: 'var(--foreground)' }}
        aria-label={`${value} ${label}`}
      >
        {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
      </p>
      <p className="label-tech" style={{ color: 'var(--muted-foreground)' }}>
        {label}
      </p>
    </div>
  )
}
