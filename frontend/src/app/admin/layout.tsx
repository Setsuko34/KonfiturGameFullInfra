import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { Query } from 'node-appwrite'
import { createSessionClient } from '@/lib/appwrite/session'
import { serverTeams } from '@/lib/appwrite/server'
import { ADMIN_TEAM_ID } from '@/lib/appwrite/config'
import AdminSidebar from './AdminSidebar'

export const metadata: Metadata = {
  title: { default: 'Backoffice', template: '%s | Admin KonfiturGame' },
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { account } = createSessionClient()

  // Vérification du membership team admins
  // 1. Récupérer l'utilisateur courant via sa session
  // 2. Vérifier via le client admin si cet userId est dans la team admins
  // Si non-admin → 404 (pas 403, pour ne pas révéler l'existence de la route)
  try {
    const user = await account.get()
    const memberships = await serverTeams.listMemberships(ADMIN_TEAM_ID, [
      Query.equal('userId', user.$id),
      Query.limit(1),
    ])
    if (memberships.total === 0) notFound()
  } catch {
    // Session invalide, expirée, ou team introuvable → notFound par sécurité
    notFound()
  }

  return (
    <div
      className="min-h-screen flex"
      style={{ background: 'var(--background)', color: 'var(--foreground)' }}
    >
      <AdminSidebar />
      <main id="main-content" className="flex-1 overflow-auto p-6 md:ml-60">
        {children}
      </main>
    </div>
  )
}
