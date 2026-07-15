'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { KeyRound } from 'lucide-react'
import { account } from '@/lib/appwrite/client'

const INPUT_STYLE = {
  background: 'var(--input-background)',
  border: '1px solid var(--border)',
  color: 'var(--foreground)',
} as const

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const userId = searchParams.get('userId')
  const secret = searchParams.get('secret')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!userId || !secret) {
    return (
      <p role="alert" className="p-3 text-sm border" style={{ borderColor: 'var(--secondary)', color: 'var(--error)' }}>
        Lien invalide ou expiré. Refaites une demande depuis{' '}
        <Link href="/auth/forgot-password" className="underline">la page mot de passe oublié</Link>.
      </p>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    setLoading(true)
    try {
      await account.updateRecovery(userId, secret, password)
      router.replace('/auth/login?reset=success')
    } catch {
      setError('Lien invalide ou expiré. Refaites une demande de réinitialisation.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && (
        <div role="alert" aria-live="assertive" className="p-3 mb-4 text-sm"
          style={{ background: 'rgba(239, 35, 60, 0.1)', border: '1px solid var(--secondary)', color: 'var(--error)' }}>
          {error}
        </div>
      )}
      <div className="mb-4">
        <label htmlFor="new-password" className="block text-sm font-medium mb-2">Nouveau mot de passe</label>
        <input id="new-password" type="password" value={password} onChange={e => setPassword(e.target.value)}
          required minLength={8} autoComplete="new-password"
          className="w-full px-3 py-2.5 text-sm" style={INPUT_STYLE} aria-required="true" />
      </div>
      <div className="mb-6">
        <label htmlFor="confirm-password" className="block text-sm font-medium mb-2">Confirmer le mot de passe</label>
        <input id="confirm-password" type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
          required minLength={8} autoComplete="new-password"
          className="w-full px-3 py-2.5 text-sm" style={INPUT_STYLE} aria-required="true" />
      </div>
      <button type="submit" disabled={loading || !password || !confirm}
        className="w-full py-3 min-h-11 font-bold text-sm transition-opacity disabled:opacity-50"
        style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}>
        {loading ? 'Réinitialisation…' : 'Réinitialiser le mot de passe'}
      </button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <main id="main-content" className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md p-8 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3 mb-6" style={{ color: 'var(--primary)' }}>
          <KeyRound size={22} aria-hidden="true" />
          <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)', fontFamily: 'var(--font-mono)' }}>
            Nouveau mot de passe
          </h1>
        </div>
        <Suspense>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  )
}
