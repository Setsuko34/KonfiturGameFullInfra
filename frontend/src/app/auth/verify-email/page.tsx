'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { MailCheck } from 'lucide-react'
import { account } from '@/lib/appwrite/client'
import { useAuth } from '@/components/providers/AuthProvider'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const userId = searchParams.get('userId')
  const secret = searchParams.get('secret')
  const [status, setStatus] = useState<'pending' | 'success' | 'error'>(
    !userId || !secret ? 'error' : 'pending'
  )
  const [resend, setResend] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')

  useEffect(() => {
    if (!userId || !secret) return
    account
      .updateVerification(userId, secret)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'))
  }, [userId, secret])

  const handleResend = async () => {
    setResend('sending')
    try {
      await account.createVerification(`${window.location.origin}/auth/verify-email`)
      setResend('sent')
    } catch {
      setResend('failed')
    }
  }

  if (status === 'pending') {
    return (
      <p role="status" aria-live="polite" className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
        Vérification de votre adresse en cours…
      </p>
    )
  }

  if (status === 'success') {
    return (
      <div>
        <p role="status" aria-live="polite" className="p-3 mb-6 text-sm border"
          style={{ borderColor: 'var(--success)', color: 'var(--success)' }}>
          Votre adresse e-mail est vérifiée. Merci !
        </p>
        <Link href="/" className="inline-flex items-center justify-center w-full py-3 min-h-11 font-bold text-sm"
          style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}>
          Retour à l&apos;accueil
        </Link>
      </div>
    )
  }

  return (
    <div>
      <p role="alert" className="p-3 mb-6 text-sm border"
        style={{ borderColor: 'var(--secondary)', color: 'var(--error)' }}>
        Lien invalide ou expiré.
      </p>
      {resend === 'sent' ? (
        <p role="status" aria-live="polite" className="p-3 text-sm border"
          style={{ borderColor: 'var(--success)', color: 'var(--success)' }}>
          Un nouvel email de vérification vient d&apos;être envoyé. Pensez à vérifier vos indésirables.
        </p>
      ) : user ? (
        <div>
          {resend === 'failed' && (
            <p role="alert" className="mb-3 text-sm" style={{ color: 'var(--error)' }}>
              L&apos;envoi a échoué. Réessayez dans quelques minutes.
            </p>
          )}
          <button
            type="button"
            onClick={handleResend}
            disabled={resend === 'sending'}
            className="w-full py-3 min-h-11 font-bold text-sm transition-opacity disabled:opacity-50"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            {resend === 'sending' ? 'Envoi…' : 'Renvoyer l\'email de vérification'}
          </button>
        </div>
      ) : (
        <Link href="/auth/login?redirect=/auth/verify-email"
          className="inline-flex items-center justify-center w-full py-3 min-h-11 font-bold text-sm"
          style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}>
          Se connecter pour renvoyer un lien
        </Link>
      )}
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <main id="main-content" className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md p-8 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3 mb-6" style={{ color: 'var(--primary)' }}>
          <MailCheck size={22} aria-hidden="true" />
          <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)', fontFamily: 'var(--font-mono)' }}>
            Vérification de l&apos;e-mail
          </h1>
        </div>
        <Suspense>
          <VerifyEmailContent />
        </Suspense>
      </div>
    </main>
  )
}
