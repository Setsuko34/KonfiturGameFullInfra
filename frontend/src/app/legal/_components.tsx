// Composants de présentation partagés par les pages légales.
// Préfixe `_` → exclu du routing Next.js App Router.
import Link from 'next/link'
import type { ReactNode } from 'react'

export function LegalTitle({ children, updated }: { children: ReactNode; updated: string }) {
  return (
    <header className="mb-10">
      <p className="label-tech mb-3" style={{ color: 'var(--primary)' }}>
        INFORMATIONS LÉGALES
      </p>
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">{children}</h1>
      <p className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }}>
        Dernière mise à jour : {updated}
      </p>
    </header>
  )
}

export function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section className="mb-10" aria-labelledby={id}>
      <h2 id={id} className="text-xl font-bold mb-4 pb-2 border-b" style={{ borderColor: 'var(--border)' }}>
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>
        {children}
      </div>
    </section>
  )
}

export function P({ children }: { children: ReactNode }) {
  return <p style={{ color: 'var(--muted-foreground)' }}>{children}</p>
}

export function List({ children }: { children: ReactNode }) {
  return (
    <ul className="space-y-2 pl-5 list-disc" style={{ color: 'var(--muted-foreground)' }}>
      {children}
    </ul>
  )
}

export function A({ href, children }: { href: string; children: ReactNode }) {
  const external = href.startsWith('http') || href.startsWith('mailto:')
  if (external) {
    return (
      <a
        href={href}
        target={href.startsWith('mailto:') ? undefined : '_blank'}
        rel={href.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
        className="underline"
        style={{ color: 'var(--primary)' }}
      >
        {children}
      </a>
    )
  }
  return (
    <Link href={href} className="underline" style={{ color: 'var(--primary)' }}>
      {children}
    </Link>
  )
}

// Encadré « à compléter » pour les informations que l'éditeur doit renseigner.
export function Todo({ children }: { children: ReactNode }) {
  return (
    <span
      className="px-1.5 py-0.5 text-xs font-mono"
      style={{ background: 'rgba(239, 35, 60, 0.12)', color: 'var(--secondary)' }}
    >
      [À COMPLÉTER : {children}]
    </span>
  )
}
