'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { account } from '@/lib/appwrite/client'
import { OAuthProvider } from 'appwrite'
import type { Models } from 'appwrite'

interface AuthContextValue {
  user: Models.User<Models.Preferences> | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  loginWithOAuth: (provider: OAuthProvider) => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    account.get()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    await account.createEmailPasswordSession(email, password)
    const currentUser = await account.get()
    setUser(currentUser)
  }

  const register = async (email: string, password: string, name: string) => {
    await account.create('unique()', email, password, name)
    await login(email, password)
  }

  const loginWithOAuth = (provider: OAuthProvider) => {
    const origin = window.location.origin
    account.createOAuth2Session(
      provider,
      `${origin}`,
      `${origin}/auth/login?error=oauth`,
    )
  }

  const logout = async () => {
    try {
      await account.deleteSession('current')
    } catch {
      // Session déjà expirée ou invalide côté Appwrite — on nettoie quand même
    }
    setUser(null)
    router.push('/auth/login')
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithOAuth, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider')
  return ctx
}
