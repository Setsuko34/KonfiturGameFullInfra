'use client'

import { useEffect } from 'react'
import { logClientError } from '@/lib/actions/logs'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
    // Fire-and-forget : le crash est journalisé dans /admin/logs (type 'error')
    logClientError(error.message, error.digest, window.location.pathname).catch(() => {})
  }, [error])

  return (
    <main id="main-content" className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <p className="label-tech mb-4" style={{ color: 'var(--secondary)' }}>ERREUR</p>
      <h1 className="text-4xl font-bold mb-4">Une erreur est survenue</h1>
      <p className="text-lg mb-8" style={{ color: 'var(--muted-foreground)' }}>
        Quelque chose s&apos;est mal passé. Essayez de recharger la page.
      </p>
      <button
        onClick={reset}
        className="px-6 py-3 font-semibold transition-colors"
        style={{
          background: 'var(--primary)',
          color: 'var(--primary-foreground)',
          fontFamily: 'var(--font-sans)',
        }}
      >
        Réessayer
      </button>
    </main>
  )
}
