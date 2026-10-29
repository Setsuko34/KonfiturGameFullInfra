'use client'

import Link from 'next/link'
import { Plus, Zap } from 'lucide-react'
import { useAuth } from '@/components/providers/AuthProvider'
import { getHomeCtaVariant } from '@/lib/home-cta'

// Textes, lien et icône propres à chaque variante — la structure reste commune
const CONTENT = {
  guest: {
    label: 'PRÊT ?',
    title: (
      <>
        Ta prochaine création<br />commence ici.
      </>
    ),
    text: 'Inscris-toi gratuitement et rejoins la prochaine game jam. Aucune expérience préalable requise.',
    href: '/auth/register',
    action: 'Créer mon compte',
    Icon: Zap,
  },
  member: {
    label: 'UNE IDÉE EN TÊTE ?',
    title: 'Lance ta propre jam.',
    text: 'Choisis un thème, fixe les dates et rassemble la communauté autour de ton projet.',
    href: '/dashboard/my-jams/new',
    action: 'Créer une jam',
    Icon: Plus,
  },
} as const

export default function HomeCTA() {
  const { user, loading } = useAuth()
  const variant = getHomeCtaVariant({ loading, user })

  // Pendant le chargement de la session, on n'affiche aucun des deux blocs
  if (variant === 'loading') {
    return null
  }

  const { label, title, text, href, action, Icon } = CONTENT[variant]

  return (
    <section
      className="px-4 sm:px-6 lg:px-8 py-24 text-center"
      aria-labelledby="cta-heading"
    >
      <div className="max-w-2xl mx-auto">
        <p className="label-tech mb-4" style={{ color: 'var(--primary)' }}>
          {label}
        </p>
        <h2
          id="cta-heading"
          className="text-4xl sm:text-5xl font-bold mb-6"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          {title}
        </h2>
        <p className="text-lg mb-10" style={{ color: 'var(--muted-foreground)' }}>
          {text}
        </p>
        <Link
          href={href}
          className="inline-flex items-center gap-2 px-10 py-5 font-bold text-lg transition-opacity hover:opacity-90"
          style={{
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
          }}
        >
          <Icon size={20} aria-hidden="true" />
          {action}
        </Link>
      </div>
    </section>
  )
}
