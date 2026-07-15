'use client'

import { useState } from 'react'
import Link from 'next/link'
import { KeyRound, ArrowLeft } from 'lucide-react'
import { account } from '@/lib/appwrite/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await account.createRecovery(email, `${window.location.origin}/auth/reset-password`)
    } catch {
      // Anti-énumération : ne jamais révéler si l'email existe (même message que le succès)
    }
    setSent(true)
    setLoading(false)
  }

  return (
    <main id="main-content" className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md p-8 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3 mb-2" style={{ color: 'var(--primary)' }}>
          <KeyRound size={22} aria-hidden="true" />
          <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)', fontFamily: 'var(--font-mono)' }}>
            Mot de passe oublié
          </h1>
        </div>
        <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
          Entrez votre adresse e-mail, nous vous enverrons un lien de réinitialisation.
        </p>

        {sent ? (
          <p role="status" aria-live="polite" className="p-3 text-sm border"
            style={{ borderColor: 'var(--success)', color: 'var(--success)' }}>
            Si un compte existe pour cette adresse, un e-mail de réinitialisation vient d&apos;être envoyé.
            Pensez à vérifier vos indésirables.
          </p>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-6">
              <label htmlFor="email" className="block text-sm font-medium mb-2">Adresse e-mail</label>
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
            <button
              type="submit"
              disabled={loading || !email}
              className="w-full py-3 min-h-11 font-bold text-sm transition-opacity disabled:opacity-50"
              style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              {loading ? 'Envoi…' : 'Envoyer le lien de réinitialisation'}
            </button>
          </form>
        )}

        <Link href="/auth/login" className="inline-flex items-center gap-1 mt-6 text-xs underline"
          style={{ color: 'var(--muted-foreground)' }}>
          <ArrowLeft size={12} aria-hidden="true" /> Retour à la connexion
        </Link>
      </div>
    </main>
  )
}
