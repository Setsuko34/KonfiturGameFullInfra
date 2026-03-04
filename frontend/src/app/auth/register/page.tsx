'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Gamepad2, Eye, EyeOff, Check } from 'lucide-react'
import { useAuth } from '@/components/providers/AuthProvider'

const passwordRequirements = [
  { test: (p: string) => p.length >= 8, label: 'Au moins 8 caractères' },
  { test: (p: string) => /[A-Z]/.test(p), label: 'Une majuscule' },
  { test: (p: string) => /[0-9]/.test(p), label: 'Un chiffre' },
]

export default function RegisterPage() {
  const { register, user } = useAuth()
  const router = useRouter()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user) router.push('/dashboard')
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
      router.push('/dashboard')
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
              {password && (
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
