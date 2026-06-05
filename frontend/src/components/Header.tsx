'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Menu, X, LogIn, LayoutDashboard, LogOut } from 'lucide-react'
import { useAuth } from '@/components/providers/AuthProvider'

const navLinks = [
  { href: '/', label: 'Accueil' },
  { href: '/explore', label: 'Explorer' },
]

export default function Header() {
  const pathname = usePathname()
  const { user, logout, loading } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    setMenuOpen(false)
  }

  return (
    <header
      role="banner"
      className="sticky top-0 z-50 border-b"
      style={{
        background: 'rgba(12, 16, 24, 0.95)',
        borderColor: 'var(--border)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-lg"
            style={{ color: 'var(--foreground)', fontFamily: 'var(--font-sans)' }}
            aria-label="KonfiturGame — Accueil"
          >
            <img
              src="/hautequalite.svg"
              alt=""
              width={32}
              height={32}
              aria-hidden="true"
            />
            <span>
              Konfitur<span style={{ color: 'var(--primary)' }}>Game</span>
            </span>
          </Link>

          {/* Navigation desktop */}
          <nav aria-label="Navigation principale" className="hidden md:flex items-center gap-1">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={pathname === link.href ? 'page' : undefined}
                className="px-4 py-2 text-sm font-medium transition-colors"
                style={{
                  color: pathname === link.href ? 'var(--primary)' : 'var(--muted-foreground)',
                  background: pathname === link.href ? 'var(--primary-muted)' : 'transparent',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* CTA desktop */}
          <div className="hidden md:flex items-center gap-3">
            {!loading && (
              user ? (
                <>
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors"
                    style={{
                      color: 'var(--foreground)',
                      border: '1px solid var(--border)',
                      background: 'var(--card)',
                    }}
                  >
                    <LayoutDashboard size={15} aria-hidden="true" />
                    Dashboard
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors"
                    style={{
                      color: 'var(--muted-foreground)',
                      border: '1px solid var(--border)',
                    }}
                    aria-label="Se déconnecter"
                  >
                    <LogOut size={15} aria-hidden="true" />
                    Déconnexion
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/auth/login"
                    className="px-4 py-2 text-sm font-semibold transition-colors"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    Se connecter
                  </Link>
                  <Link
                    href="/auth/register"
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors"
                    style={{
                      background: 'var(--primary)',
                      color: 'var(--primary-foreground)',
                    }}
                  >
                    <LogIn size={15} aria-hidden="true" />
                    Participer
                  </Link>
                </>
              )
            )}
          </div>

          {/* Burger mobile */}
          <button
            className="md:hidden flex items-center justify-center w-10 h-10"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            style={{ color: 'var(--foreground)' }}
          >
            {menuOpen
              ? <X size={22} aria-hidden="true" />
              : <Menu size={22} aria-hidden="true" />
            }
          </button>
        </div>
      </div>

      {/* Menu mobile overlay */}
      {menuOpen && (
        <div
          id="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Menu de navigation"
          className="md:hidden border-t"
          style={{
            background: 'var(--card)',
            borderColor: 'var(--border)',
          }}
        >
          <nav aria-label="Navigation mobile" className="flex flex-col p-4 gap-1">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                aria-current={pathname === link.href ? 'page' : undefined}
                className="px-4 py-3 text-sm font-medium transition-colors"
                style={{
                  color: pathname === link.href ? 'var(--primary)' : 'var(--foreground)',
                  background: pathname === link.href ? 'var(--primary-muted)' : 'transparent',
                }}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-4 pt-4 flex flex-col gap-2" style={{ borderTop: '1px solid var(--border)' }}>
              {!loading && (
                user ? (
                  <>
                    <Link
                      href="/dashboard"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-3 text-sm font-semibold"
                      style={{
                        background: 'var(--surface-elevated)',
                        color: 'var(--foreground)',
                      }}
                    >
                      <LayoutDashboard size={15} aria-hidden="true" />
                      Dashboard
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-left"
                      style={{ color: 'var(--muted-foreground)' }}
                    >
                      <LogOut size={15} aria-hidden="true" />
                      Déconnexion
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/auth/login"
                      onClick={() => setMenuOpen(false)}
                      className="px-4 py-3 text-sm font-semibold text-center"
                      style={{
                        border: '1px solid var(--border)',
                        color: 'var(--foreground)',
                      }}
                    >
                      Se connecter
                    </Link>
                    <Link
                      href="/auth/register"
                      onClick={() => setMenuOpen(false)}
                      className="px-4 py-3 text-sm font-semibold text-center"
                      style={{
                        background: 'var(--primary)',
                        color: 'var(--primary-foreground)',
                      }}
                    >
                      Participer gratuitement
                    </Link>
                  </>
                )
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
