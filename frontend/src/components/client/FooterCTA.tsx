'use client'

import Link from 'next/link'
import { useAuth } from "@/components/providers/AuthProvider"

export default function FooterCTA() {
  const { user, loading } = useAuth()

  // Si on charge ou que l'utilisateur est connecté, on n'affiche rien
  if (loading || user) {
    return null
  }

  return (
    <div className="border-b py-16 px-4 text-center" style={{ borderColor: 'var(--border)' }}>
      <p className="label-tech mb-4" style={{ color: 'var(--primary)' }}>
        REJOINS LA COMMUNAUTÉ
      </p>
      <h2 className="text-3xl md:text-4xl font-bold mb-4">
        Prêt à créer quelque chose d&apos;incroyable ?
      </h2>
      <p className="mb-8 text-lg max-w-xl mx-auto" style={{ color: 'var(--muted-foreground)' }}>
        Des centaines de développeurs et créatifs t&apos;attendent.
        Inscris-toi gratuitement et rejoins la prochaine jam.
      </p>
      <Link
        href="/auth/register"
        className="inline-block px-8 py-4 font-bold text-lg transition-opacity hover:opacity-90"
        style={{
          background: 'var(--primary)',
          color: 'var(--primary-foreground)',
        }}
      >
        S&apos;inscrire gratuitement
      </Link>
    </div>
  )
}