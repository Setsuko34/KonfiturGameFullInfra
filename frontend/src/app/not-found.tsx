import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Page introuvable',
}

export default function NotFound() {
  return (
    <main id="main-content" className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <p className="label-tech mb-4" style={{ color: 'var(--muted-foreground)' }}>ERREUR 404</p>
      <h1 className="text-5xl font-bold mb-4" style={{ fontFamily: 'var(--font-sans)' }}>
        Page introuvable
      </h1>
      <p className="text-lg mb-8" style={{ color: 'var(--muted-foreground)' }}>
        Cette page n&apos;existe pas ou a été déplacée.
      </p>
      <Link
        href="/"
        className="px-6 py-3 font-semibold transition-colors"
        style={{
          background: 'var(--primary)',
          color: 'var(--primary-foreground)',
          fontFamily: 'var(--font-sans)',
        }}
      >
        Retour à l&apos;accueil
      </Link>
    </main>
  )
}
