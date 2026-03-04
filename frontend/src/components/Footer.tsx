import Link from 'next/link'
import { Gamepad2, CheckCircle } from 'lucide-react'

const footerLinks = {
  Plateforme: [
    { label: 'Explorer les jams', href: '/explore' },
    { label: 'Créer une jam', href: '/dashboard' },
    { label: 'Classements', href: '/explore?tab=rankings' },
  ],
  Communauté: [
    { label: 'Discord', href: '#' },
    { label: 'Twitter / X', href: '#' },
    { label: 'GitHub', href: '#' },
  ],
  Légal: [
    { label: 'Conditions d\'utilisation', href: '/legal/terms' },
    { label: 'Politique de confidentialité', href: '/legal/privacy' },
    { label: 'Contact', href: 'mailto:contact@konfiturgame.fr' },
  ],
}

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer
      role="contentinfo"
      className="border-t mt-auto"
      style={{
        background: 'var(--card)',
        borderColor: 'var(--border)',
      }}
    >
      {/* CTA Footer */}
      <div
        className="border-b py-16 px-4 text-center"
        style={{ borderColor: 'var(--border)' }}
      >
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

      {/* Liens */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Logo + description */}
          <div className="col-span-2 md:col-span-1">
            <Link
              href="/"
              className="flex items-center gap-2 font-bold text-lg mb-3"
              style={{ color: 'var(--foreground)' }}
              aria-label="KonfiturGame — Accueil"
            >
              <Gamepad2 size={20} style={{ color: 'var(--primary)' }} aria-hidden="true" />
              <span>Konfitur<span style={{ color: 'var(--primary)' }}>Game</span></span>
            </Link>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              La plateforme française<br />de game jams.
            </p>

            {/* Statut opérationnel */}
            <div className="flex items-center gap-2 mt-4">
              <CheckCircle size={14} style={{ color: 'var(--success)' }} aria-hidden="true" />
              <span className="label-tech" style={{ color: 'var(--success)' }}>
                TOUS LES SYSTÈMES OPÉRATIONNELS
              </span>
            </div>
          </div>

          {/* Liens par catégorie */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <nav key={category} aria-label={`Navigation ${category}`}>
              <h3
                className="label-tech mb-4"
                style={{ color: 'var(--muted-foreground)' }}
              >
                {category.toUpperCase()}
              </h3>
              <ul className="space-y-2">
                {links.map(link => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm transition-colors hover:underline"
                      style={{ color: 'var(--foreground)' }}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Copyright */}
        <div
          className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <p className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }}>
            © {currentYear} KonfiturGame. Tous droits réservés.
          </p>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }}>
            Made in France 🇫🇷 with ♥ and lots of coffee
          </p>
        </div>
      </div>
    </footer>
  )
}
