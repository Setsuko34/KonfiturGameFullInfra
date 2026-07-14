'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Gamepad2, Eye, EyeOff, Check } from 'lucide-react'
import { OAuthProvider } from 'appwrite'
import { useAuth } from '@/components/providers/AuthProvider'
import { logAuthEvent } from '@/lib/actions/logs'

const passwordRequirements = [
  { test: (p: string) => p.length >= 8, label: 'Au moins 8 caractères' },
  { test: (p: string) => /[A-Z]/.test(p), label: 'Une majuscule' },
  { test: (p: string) => /[0-9]/.test(p), label: 'Un chiffre' },
]

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="#5865F2" aria-hidden="true">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.01.088.054.176.118.233a19.975 19.975 0 0 0 5.993 3.029.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.029.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  )
}

export default function RegisterPage() {
  const { register, loginWithOAuth, user } = useAuth()
  const router = useRouter()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Redirige vers l'accueil si déjà connecté
  useEffect(() => {
    if (user) router.replace('/')
  }, [user, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (passwordRequirements.some(r => !r.test(password))) {
      setError('Le mot de passe ne satisfait pas tous les critères.')
      return
    }
    setLoading(true)
    try {
      await register(email, password, name)
      void logAuthEvent('register') // best effort — ne bloque jamais la suite
      // La mise à jour de `user` déclenche le useEffect ci-dessus
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('already exists') || msg.includes('unique')) {
        setError('Un compte avec cet email existe déjà.')
      } else {
        setError('Une erreur est survenue. Veuillez réessayer.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: 'var(--background)' }}
    >
      <main id="main-content" className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 font-bold text-xl">
            <Gamepad2 size={24} style={{ color: 'var(--primary)' }} aria-hidden="true" />
            Konfitur<span style={{ color: 'var(--primary)' }}>Game</span>
          </Link>
        </div>

        <div
          className="p-8 border"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <h1 className="text-2xl font-bold mb-2">Créer un compte</h1>
          <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
            Déjà un compte ?{' '}
            <Link href="/auth/login" style={{ color: 'var(--primary)' }}>
              Se connecter
            </Link>
          </p>

          {/* Boutons OAuth */}
          <div className="flex flex-col gap-3 mb-6">
            <button
              type="button"
              onClick={() => loginWithOAuth(OAuthProvider.Google)}
              className="w-full py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-opacity hover:opacity-80"
              style={{
                background: 'var(--input-background)',
                border: '1px solid var(--border)',
                color: 'var(--foreground)',
              }}
            >
              <GoogleIcon />
              Continuer avec Google
            </button>
            <button
              type="button"
              onClick={() => loginWithOAuth(OAuthProvider.Discord)}
              className="w-full py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-opacity hover:opacity-80"
              style={{
                background: 'var(--input-background)',
                border: '1px solid var(--border)',
                color: 'var(--foreground)',
              }}
            >
              <DiscordIcon />
              Continuer avec Discord
            </button>
          </div>

          {/* Séparateur */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>ou</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </div>

          {error && (
            <div
              className="p-3 mb-4 text-sm"
              role="alert"
              aria-live="assertive"
              style={{
                background: 'rgba(239, 35, 60, 0.1)',
                border: '1px solid var(--secondary)',
                color: 'var(--secondary)',
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* Pseudo */}
            <div className="mb-4">
              <label htmlFor="name" className="block text-sm font-medium mb-2">
                Pseudo
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoComplete="username"
                minLength={2}
                maxLength={128}
                className="w-full px-3 py-2.5 text-sm"
                style={{
                  background: 'var(--input-background)',
                  border: '1px solid var(--border)',
                  color: 'var(--foreground)',
                }}
                aria-required="true"
              />
            </div>

            {/* Email */}
            <div className="mb-4">
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Adresse e-mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-3 py-2.5 text-sm"
                style={{
                  background: 'var(--input-background)',
                  border: '1px solid var(--border)',
                  color: 'var(--foreground)',
                }}
                aria-required="true"
              />
            </div>

            {/* Mot de passe */}
            <div className="mb-4">
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setPasswordTouched(true)}
                  required
                  autoComplete="new-password"
                  className="w-full px-3 py-2.5 pr-10 text-sm"
                  style={{
                    background: 'var(--input-background)',
                    border: '1px solid var(--border)',
                    color: 'var(--foreground)',
                  }}
                  aria-required="true"
                  aria-describedby="password-requirements"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--muted-foreground)' }}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword
                    ? <EyeOff size={16} aria-hidden="true" />
                    : <Eye size={16} aria-hidden="true" />
                  }
                </button>
              </div>

              {/* Indicateurs de force */}
              {(password || passwordTouched) && (
                <ul
                  id="password-requirements"
                  className="mt-2 space-y-1"
                  aria-label="Exigences du mot de passe"
                >
                  {passwordRequirements.map(req => {
                    const ok = req.test(password)
                    return (
                      <li
                        key={req.label}
                        className="flex items-center gap-2 text-xs"
                        style={{ color: ok ? 'var(--success)' : 'var(--muted-foreground)' }}
                        aria-label={`${req.label} : ${ok ? 'satisfait' : 'non satisfait'}`}
                      >
                        <Check size={11} aria-hidden="true" />
                        {req.label}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !name || !email || !password}
              className="w-full py-3 font-bold text-sm mt-2 transition-opacity disabled:opacity-50"
              style={{
                background: 'var(--primary)',
                color: 'var(--primary-foreground)',
              }}
            >
              {loading ? 'Création en cours...' : 'Créer mon compte'}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-xs" style={{ color: 'var(--muted-foreground)' }}>
          En créant un compte, vous acceptez nos{' '}
          <Link href="/legal/terms" style={{ color: 'var(--muted-foreground)', textDecoration: 'underline' }}>
            conditions d&apos;utilisation
          </Link>
          .
        </p>
      </main>
    </div>
  )
}
