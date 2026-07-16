import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export interface RecentListItem {
  primary: string
  secondary?: string
  meta?: string
}

interface RecentListProps {
  title: string
  items: RecentListItem[]
  href?: string
  emptyLabel: string
}

export default function RecentList({ title, items, href, emptyLabel }: RecentListProps) {
  return (
    <section className="p-5 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>
          {title}
        </h3>
        {href && (
          <Link
            href={href}
            className="flex items-center gap-1 text-xs min-h-11 transition-opacity hover:opacity-80"
            style={{ color: 'var(--primary)' }}
          >
            Tout voir <ArrowRight size={12} aria-hidden="true" />
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{emptyLabel}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item, i) => (
            <li key={i} className="flex items-baseline justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="truncate">{item.primary}</p>
                {item.secondary && (
                  <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
                    {item.secondary}
                  </p>
                )}
              </div>
              {item.meta && (
                <span
                  className="shrink-0 text-xs"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted-foreground)' }}
                >
                  {item.meta}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
