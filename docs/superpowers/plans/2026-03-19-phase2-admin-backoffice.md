# Backoffice Admin — Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créer le backoffice admin complet sur `/admin/*` avec authentification par membership Appwrite team `admins`, sidebar distincte rouge, et 6 sections de gestion.

**Architecture:** Le middleware vérifie uniquement la présence du cookie session pour `/admin` (redirection login si absent). La vérification du rôle admin se fait dans le **Server Component `layout.tsx`** via `account.listMemberships()` + `notFound()` si non-membre de la team `admins`. Les Server Actions admin utilisent `node-appwrite` avec la clé API admin (jamais côté client). La sidebar admin est un composant client séparé, miroir de `DashboardSidebar.tsx` avec accent rouge.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Tailwind CSS v4, node-appwrite (Server Actions), pnpm

> **Pas de framework de test installé.** Chaque "test" = `cd frontend && pnpm type-check` (doit retourner 0 erreur). Vérification visuelle dans le navigateur sur http://localhost:3000 après `docker compose up`.

---

## Carte des fichiers

| Fichier | Action | Responsabilité |
|---------|--------|----------------|
| `frontend/src/lib/appwrite/config.ts` | **Modifier** | Ajouter `ADMIN_TEAM_ID = 'admins'` |
| `frontend/src/lib/appwrite/server.ts` | **Modifier** | Ajouter export `serverTeams` (Teams SDK) |
| `frontend/src/lib/actions/admin.ts` | **Créer** | Server Actions : stats, users, jams, modération, annonces, featured |
| `frontend/src/middleware.ts` | **Modifier** | Ajouter `/admin/:path*` au matcher + protection session |
| `frontend/src/app/admin/AdminSidebar.tsx` | **Créer** | Sidebar admin (client component) : rouge, badge SUPER ADMIN, 6 sections |
| `frontend/src/app/admin/layout.tsx` | **Créer** | Layout admin : vérification team admins → notFound() si non-membre |
| `frontend/src/app/admin/page.tsx` | **Créer** | Stats globales plateforme + actions rapides |
| `frontend/src/app/admin/users/page.tsx` | **Créer** | Liste paginée utilisateurs, blocage, rôle admin |
| `frontend/src/app/admin/jams/DeleteJamButton.tsx` | **Créer** | Client component : bouton suppression avec `window.confirm()` |
| `frontend/src/app/admin/jams/page.tsx` | **Créer** | Toutes les jams avec filtres et featured toggle |
| `frontend/src/app/admin/moderation/page.tsx` | **Créer** | File de signalements (messages + projets) |
| `frontend/src/app/admin/announcements/page.tsx` | **Créer** | Créer/lister/supprimer annonces globales ou ciblées |
| `frontend/src/app/admin/featured/page.tsx` | **Créer** | Curation featured : toggle jams + sélection gagnants |

---

## Task 1 : Foundation — config.ts + server.ts

**Fichiers :**
- Modifier : `frontend/src/lib/appwrite/config.ts`
- Modifier : `frontend/src/lib/appwrite/server.ts`

- [ ] **Ajouter `ADMIN_TEAM_ID` dans config.ts**

Ouvrir `frontend/src/lib/appwrite/config.ts` et ajouter à la fin :

```ts
export const ADMIN_TEAM_ID = 'admins'
```

- [ ] **Ajouter `serverTeams` dans server.ts**

Modifier `frontend/src/lib/appwrite/server.ts` :

```ts
import { Client, Databases, Users, Storage, Teams } from 'node-appwrite'

const client = new Client()
  .setEndpoint(process.env.APPWRITE_INTERNAL_ENDPOINT ?? process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!)

export const serverDatabases = new Databases(client)
export const serverUsers = new Users(client)
export const serverStorage = new Storage(client)
export const serverTeams = new Teams(client)
export { client as serverClient }
```

- [ ] **Vérifier le type-check**

```bash
cd /mnt/d/dev/KonfiturGameFullInfra/frontend && pnpm type-check
```

Attendu : 0 erreur.

- [ ] **Commit**

```bash
git add frontend/src/lib/appwrite/config.ts frontend/src/lib/appwrite/server.ts
git commit -m "feat: add ADMIN_TEAM_ID constant and serverTeams client"
```

---

## Task 2 : Middleware — Protection /admin

**Fichiers :**
- Modifier : `frontend/src/middleware.ts`

Le middleware vérifie uniquement la présence du cookie de session pour `/admin` (la vérification du membership team se fait dans le layout, côté Server Component, car le middleware Edge ne peut pas appeler node-appwrite).

- [ ] **Mettre à jour middleware.ts**

```ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const protectedRoutes = ['/dashboard', '/admin']
const authRoutes = ['/auth/login', '/auth/register']

export function middleware(request: NextRequest) {
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID
  const sessionCookie = projectId
    ? (request.cookies.get(`a_session_${projectId}`) ?? request.cookies.get(`a_session_${projectId}_legacy`))
    : null
  const isAuthenticated = !!sessionCookie

  if (protectedRoutes.some(r => request.nextUrl.pathname.startsWith(r))) {
    if (!isAuthenticated) {
      const loginUrl = new URL('/auth/login', request.url)
      loginUrl.searchParams.set('redirect', request.nextUrl.pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  if (authRoutes.includes(request.nextUrl.pathname)) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/auth/:path*'],
}
```

- [ ] **Vérifier le type-check**

```bash
cd /mnt/d/dev/KonfiturGameFullInfra/frontend && pnpm type-check
```

Attendu : 0 erreur.

- [ ] **Commit**

```bash
git add frontend/src/middleware.ts
git commit -m "feat: protect /admin routes via middleware session check"
```

---

## Task 3 : Server Actions admin — lib/actions/admin.ts

**Fichiers :**
- Créer : `frontend/src/lib/actions/admin.ts`

Ce fichier contient toutes les Server Actions du backoffice. Il utilise exclusivement `node-appwrite` avec la clé API admin (`serverDatabases`, `serverUsers`, `serverTeams`). Jamais de `createSessionClient()` ici — les actions admin n'ont pas besoin d'être scopées à un utilisateur.

- [ ] **Créer `frontend/src/lib/actions/admin.ts`**

```ts
'use server'

import { ID, Query } from 'node-appwrite'
import { revalidatePath } from 'next/cache'
import { serverDatabases, serverUsers, serverTeams } from '@/lib/appwrite/server'
import { DATABASE_ID, COLLECTIONS, ADMIN_TEAM_ID } from '@/lib/appwrite/config'
import {
  mapDocToGameJam,
  mapDocToProject,
  mapDocToChatMessage,
  mapDocToAnnouncement,
} from '@/lib/appwrite/types'
import type { GameJam, Project, ChatMessage, Announcement } from '@/types'

// ── Stats globales ─────────────────────────────────────────────────────────

export async function getAdminStats(): Promise<{
  totalUsers: number
  totalJams: number
  activeJams: number
  pendingReports: number
}> {
  const [usersRes, allJamsRes, activeJamsRes, reportedMessagesRes, reportedProjectsRes] = await Promise.all([
    serverUsers.list([Query.limit(1)]),
    serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.GAME_JAMS, [Query.limit(1)]),
    serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.GAME_JAMS, [
      Query.equal('status', 'ongoing'),
      Query.limit(1),
    ]),
    serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.CHAT_MESSAGES, [
      Query.equal('reported', true),
      Query.limit(1),
    ]),
    serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.PROJECTS, [
      Query.equal('reported', true),
      Query.limit(1),
    ]),
  ])

  return {
    totalUsers: usersRes.total,
    totalJams: allJamsRes.total,
    activeJams: activeJamsRes.total,
    pendingReports: reportedMessagesRes.total + reportedProjectsRes.total,
  }
}

// ── Gestion utilisateurs ───────────────────────────────────────────────────

export async function listUsers(page = 0, search = '') {
  const queries: string[] = [Query.limit(25), Query.offset(page * 25)]
  if (search) queries.push(Query.search('name', search))
  return serverUsers.list(queries)
}

export async function blockUser(userId: string) {
  await serverUsers.updateStatus(userId, false)
  revalidatePath('/admin/users')
}

export async function unblockUser(userId: string) {
  await serverUsers.updateStatus(userId, true)
  revalidatePath('/admin/users')
}

export async function grantAdminRole(userId: string, email: string) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  // node-appwrite Teams.createMembership : 6 paramètres (teamId, roles, email, userId, name, redirectUrl)
  const result = await serverTeams.createMembership(
    ADMIN_TEAM_ID,
    [],
    email,
    userId,
    '',
    `${siteUrl}/admin`,
  )
  revalidatePath('/admin/users')
  return result
}

export async function revokeAdminRole(membershipId: string) {
  await serverTeams.deleteMembership(ADMIN_TEAM_ID, membershipId)
  revalidatePath('/admin/users')
}

// ── Gestion des jams ───────────────────────────────────────────────────────

export async function listAllJams(status?: string, page = 0): Promise<GameJam[]> {
  const queries: string[] = [
    Query.orderDesc('$createdAt'),
    Query.limit(25),
    Query.offset(page * 25),
  ]
  if (status) queries.push(Query.equal('status', status))
  const res = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.GAME_JAMS, queries)
  return res.documents.map(mapDocToGameJam)
}

export async function deleteJam(jamId: string) {
  await serverDatabases.deleteDocument(DATABASE_ID, COLLECTIONS.GAME_JAMS, jamId)
  revalidatePath('/admin/jams')
  revalidatePath('/admin')
}

export async function toggleJamFeatured(jamId: string, featured: boolean, featuredOrder?: number) {
  await serverDatabases.updateDocument(DATABASE_ID, COLLECTIONS.GAME_JAMS, jamId, {
    featured,
    ...(featuredOrder !== undefined ? { featured_order: featuredOrder } : {}),
  })
  revalidatePath('/admin/jams')
  revalidatePath('/admin/featured')
}

// ── Modération ─────────────────────────────────────────────────────────────

export async function listReportedMessages(page = 0): Promise<ChatMessage[]> {
  const res = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.CHAT_MESSAGES, [
    Query.equal('reported', true),
    Query.orderDesc('$createdAt'),
    Query.limit(20),
    Query.offset(page * 20),
  ])
  return res.documents.map(mapDocToChatMessage)
}

export async function listReportedProjects(page = 0): Promise<Project[]> {
  const res = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.PROJECTS, [
    Query.equal('reported', true),
    Query.orderDesc('$createdAt'),
    Query.limit(20),
    Query.offset(page * 20),
  ])
  return res.documents.map(mapDocToProject)
}

export async function deleteMessage(messageId: string) {
  await serverDatabases.deleteDocument(DATABASE_ID, COLLECTIONS.CHAT_MESSAGES, messageId)
  revalidatePath('/admin/moderation')
  revalidatePath('/admin')
}

export async function resolveMessageReport(messageId: string) {
  await serverDatabases.updateDocument(DATABASE_ID, COLLECTIONS.CHAT_MESSAGES, messageId, {
    reported: false,
  })
  revalidatePath('/admin/moderation')
  revalidatePath('/admin')
}

export async function resolveProjectReport(projectId: string) {
  await serverDatabases.updateDocument(DATABASE_ID, COLLECTIONS.PROJECTS, projectId, {
    reported: false,
  })
  revalidatePath('/admin/moderation')
  revalidatePath('/admin')
}

// ── Annonces ───────────────────────────────────────────────────────────────

// jam_id = 'all' → annonce globale plateforme
// jam_id = <jamId> → annonce ciblée sur une jam

export interface CreateAnnouncementData {
  title: string
  content: string
  jamId: string   // 'all' pour global
  important: boolean
  authorId: string
  authorName: string
}

export async function createAnnouncement(data: CreateAnnouncementData): Promise<Announcement> {
  const doc = await serverDatabases.createDocument(
    DATABASE_ID,
    COLLECTIONS.ANNOUNCEMENTS,
    ID.unique(),
    {
      title: data.title,
      content: data.content,
      jam_id: data.jamId,
      important: data.important,
      author_id: data.authorId,
      author_name: data.authorName,
    },
  )
  revalidatePath('/admin/announcements')
  return mapDocToAnnouncement(doc)
}

export async function listAnnouncements(page = 0): Promise<Announcement[]> {
  const res = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.ANNOUNCEMENTS, [
    Query.orderDesc('$createdAt'),
    Query.limit(20),
    Query.offset(page * 20),
  ])
  return res.documents.map(mapDocToAnnouncement)
}

export async function deleteAnnouncement(announcementId: string) {
  await serverDatabases.deleteDocument(DATABASE_ID, COLLECTIONS.ANNOUNCEMENTS, announcementId)
  revalidatePath('/admin/announcements')
}

// ── Featured / Gagnants ────────────────────────────────────────────────────

export async function listJamsForCuration(): Promise<GameJam[]> {
  const res = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.GAME_JAMS, [
    Query.orderDesc('$createdAt'),
    Query.limit(50),
  ])
  return res.documents.map(mapDocToGameJam)
}

export async function listProjectsForJam(jamId: string): Promise<Project[]> {
  const res = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.PROJECTS, [
    Query.equal('jam_id', jamId),
    Query.equal('submitted', true),
  ])
  return res.documents.map(mapDocToProject)
}

export async function setProjectWinner(projectId: string, winner: boolean) {
  await serverDatabases.updateDocument(DATABASE_ID, COLLECTIONS.PROJECTS, projectId, { winner })
  revalidatePath('/admin/featured')
}
```

- [ ] **Vérifier le type-check**

```bash
cd /mnt/d/dev/KonfiturGameFullInfra/frontend && pnpm type-check
```

Attendu : 0 erreur.

- [ ] **Commit**

```bash
git add frontend/src/lib/actions/admin.ts
git commit -m "feat: add admin Server Actions (stats, users, jams, moderation, announcements, featured)"
```

---

## Task 4 : AdminSidebar — Composant sidebar admin

**Fichiers :**
- Créer : `frontend/src/app/admin/AdminSidebar.tsx`

Miroir de `DashboardSidebar.tsx` avec :
- Fond plus sombre (`#0A0E16`)
- Accent rouge (`var(--secondary)` = `#EF233C`)
- Badge "SUPER ADMIN" sous le logo
- Desktop uniquement (pas de drawer mobile — backoffice desktop-first)

- [ ] **Créer `frontend/src/app/admin/AdminSidebar.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Gamepad2, LayoutDashboard, Users, List,
  AlertTriangle, Megaphone, Star, LogOut, Home,
} from 'lucide-react'
import { useAuth } from '@/components/providers/AuthProvider'

const ADMIN_BG = '#0A0E16'
const ADMIN_BORDER = 'rgba(239, 35, 60, 0.15)'

export default function AdminSidebar() {
  const { user, logout } = useAuth()
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === '/admin' ? pathname === href : pathname.startsWith(href)

  const NavLink = ({
    href,
    icon: Icon,
    label,
  }: {
    href: string
    icon: typeof Home
    label: string
  }) => (
    <Link
      href={href}
      aria-current={isActive(href) ? 'page' : undefined}
      className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors"
      style={{
        background: isActive(href) ? 'rgba(239, 35, 60, 0.12)' : 'transparent',
        color: isActive(href) ? 'var(--secondary)' : 'var(--sidebar-foreground)',
      }}
    >
      <Icon size={15} aria-hidden="true" />
      {label}
    </Link>
  )

  return (
    <aside
      className="hidden md:flex flex-col fixed inset-y-0 left-0 w-60 border-r z-30"
      style={{ background: ADMIN_BG, borderColor: ADMIN_BORDER }}
    >
      <nav className="flex flex-col h-full" aria-label="Navigation du backoffice">
        {/* Logo + badge */}
        <div
          className="flex flex-col px-5 py-4 border-b"
          style={{ borderColor: ADMIN_BORDER }}
        >
          <div className="flex items-center gap-2">
            <Gamepad2 size={18} style={{ color: 'var(--secondary)' }} aria-hidden="true" />
            <Link href="/" className="font-bold text-sm" style={{ color: 'var(--sidebar-foreground)' }}>
              Konfitur<span style={{ color: 'var(--secondary)' }}>Game</span>
            </Link>
          </div>
          <span
            className="mt-1.5 text-[9px] tracking-widest uppercase font-bold px-1 py-0.5 w-fit"
            style={{
              background: 'rgba(239, 35, 60, 0.15)',
              color: 'var(--secondary)',
              border: '1px solid rgba(239, 35, 60, 0.3)',
            }}
          >
            Super Admin
          </span>
        </div>

        {/* Utilisateur */}
        {user && (
          <div className="px-5 py-3 border-b" style={{ borderColor: ADMIN_BORDER }}>
            <p className="text-[9px] tracking-widest mb-1 uppercase" style={{ color: 'var(--muted-foreground)' }}>
              Connecté
            </p>
            <p className="font-semibold text-sm truncate">{user.name || user.email}</p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          <NavLink href="/admin" icon={LayoutDashboard} label="Vue d'ensemble" />

          <p
            className="px-3 pt-4 pb-1 text-[9px] tracking-widest uppercase"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Gestion
          </p>
          <NavLink href="/admin/users" icon={Users} label="Utilisateurs" />
          <NavLink href="/admin/jams" icon={List} label="Jams" />

          <p
            className="px-3 pt-4 pb-1 text-[9px] tracking-widest uppercase border-t mt-3"
            style={{ color: 'var(--muted-foreground)', borderColor: ADMIN_BORDER }}
          >
            Contenu
          </p>
          <NavLink href="/admin/moderation" icon={AlertTriangle} label="Modération" />
          <NavLink href="/admin/announcements" icon={Megaphone} label="Annonces" />
          <NavLink href="/admin/featured" icon={Star} label="Mise en avant" />
        </div>

        {/* Bas de sidebar */}
        <div className="p-3 border-t space-y-0.5" style={{ borderColor: ADMIN_BORDER }}>
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <Home size={15} aria-hidden="true" />
            Retour au site
          </Link>
          <button
            onClick={() => logout()}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <LogOut size={15} aria-hidden="true" />
            Déconnexion
          </button>
        </div>
      </nav>
    </aside>
  )
}
```

- [ ] **Vérifier le type-check**

```bash
cd /mnt/d/dev/KonfiturGameFullInfra/frontend && pnpm type-check
```

Attendu : 0 erreur.

- [ ] **Commit**

```bash
git add frontend/src/app/admin/AdminSidebar.tsx
git commit -m "feat: add AdminSidebar component with red accent and SUPER ADMIN badge"
```

---

## Task 5 : Layout admin — Vérification membership + structure

**Fichiers :**
- Créer : `frontend/src/app/admin/layout.tsx`

Ce layout est un **Server Component async**. Il :
1. Lit le cookie de session via `createSessionClient()`
2. Appelle `account.listMemberships()` pour vérifier l'appartenance à la team `admins`
3. Appelle `notFound()` si l'utilisateur n'est pas admin (→ page 404, pas 403)

- [ ] **Créer `frontend/src/app/admin/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createSessionClient } from '@/lib/appwrite/session'
import { ADMIN_TEAM_ID } from '@/lib/appwrite/config'
import AdminSidebar from './AdminSidebar'

export const metadata: Metadata = {
  title: { default: 'Backoffice', template: '%s | Admin KonfiturGame' },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { account } = createSessionClient()

  // Vérification du membership team admins
  // Si l'utilisateur n'est pas admin → 404 (pas 403, pour ne pas révéler l'existence de la route)
  try {
    const memberships = await account.listMemberships()
    const isAdmin = memberships.memberships.some(m => m.teamId === ADMIN_TEAM_ID)
    if (!isAdmin) notFound()
  } catch {
    // Session invalide ou expirée → le middleware aurait dû rediriger, mais par sécurité
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
```

- [ ] **Vérifier le type-check**

```bash
cd /mnt/d/dev/KonfiturGameFullInfra/frontend && pnpm type-check
```

Attendu : 0 erreur.

- [ ] **Commit**

```bash
git add frontend/src/app/admin/layout.tsx
git commit -m "feat: add admin layout with team membership guard (notFound if not admin)"
```

---

## Task 6 : /admin — Vue d'ensemble stats globales

**Fichiers :**
- Créer : `frontend/src/app/admin/page.tsx`

- [ ] **Créer `frontend/src/app/admin/page.tsx`**

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { Users, List, AlertTriangle, Megaphone } from 'lucide-react'
import { getAdminStats } from '@/lib/actions/admin'

export const metadata: Metadata = { title: 'Vue d\'ensemble' }

export default async function AdminPage() {
  const stats = await getAdminStats()

  const statCards = [
    { label: 'Utilisateurs', value: stats.totalUsers, icon: Users, href: '/admin/users' },
    { label: 'Jams totales', value: stats.totalJams, icon: List, href: '/admin/jams' },
    { label: 'Jams actives', value: stats.activeJams, icon: List, href: '/admin/jams?status=ongoing' },
    { label: 'Signalements', value: stats.pendingReports, icon: AlertTriangle, href: '/admin/moderation', urgent: stats.pendingReports > 0 },
  ]

  return (
    <div>
      <a href="#main-content" className="sr-only focus:not-sr-only">Aller au contenu principal</a>

      <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'var(--font-mono)' }}>
        Vue d'ensemble
      </h1>
      <p className="text-sm mb-8" style={{ color: 'var(--muted-foreground)' }}>
        Statistiques globales de la plateforme
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {statCards.map(({ label, value, icon: Icon, href, urgent }) => (
          <Link
            key={label}
            href={href}
            className="p-5 border flex flex-col gap-3 transition-opacity hover:opacity-80"
            style={{
              background: 'var(--card)',
              borderColor: urgent ? 'var(--secondary)' : 'var(--border)',
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>
                {label}
              </span>
              <Icon
                size={14}
                aria-hidden="true"
                style={{ color: urgent ? 'var(--secondary)' : 'var(--muted-foreground)' }}
              />
            </div>
            <span
              className="text-3xl font-bold"
              style={{
                fontFamily: 'var(--font-mono)',
                color: urgent ? 'var(--secondary)' : 'var(--foreground)',
              }}
            >
              {value}
            </span>
          </Link>
        ))}
      </div>

      {/* Actions rapides */}
      <h2 className="text-sm uppercase tracking-widest mb-4" style={{ color: 'var(--muted-foreground)' }}>
        Actions rapides
      </h2>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/admin/moderation"
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ background: 'var(--secondary)', color: '#fff' }}
        >
          <AlertTriangle size={14} aria-hidden="true" />
          Voir les signalements ({stats.pendingReports})
        </Link>
        <Link
          href="/admin/announcements"
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border transition-opacity hover:opacity-80"
          style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
        >
          <Megaphone size={14} aria-hidden="true" />
          Nouvelle annonce
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Vérifier le type-check**

```bash
cd /mnt/d/dev/KonfiturGameFullInfra/frontend && pnpm type-check
```

- [ ] **Commit**

```bash
git add frontend/src/app/admin/page.tsx
git commit -m "feat: add admin overview page with global platform stats"
```

---

## Task 7 : /admin/users — Gestion utilisateurs

**Fichiers :**
- Créer : `frontend/src/app/admin/users/page.tsx`

Page Server Component avec la liste des utilisateurs. Les actions (bloquer, débloquer) sont des formulaires avec Server Actions. Pas de recherche côté client — la recherche recharge la page via `<form>` GET.

- [ ] **Créer `frontend/src/app/admin/users/page.tsx`**

```tsx
import type { Metadata } from 'next'
import { Shield, ShieldOff, Search } from 'lucide-react'
import { listUsers, blockUser, unblockUser } from '@/lib/actions/admin'

export const metadata: Metadata = { title: 'Utilisateurs' }

type Props = { searchParams: { [key: string]: string | string[] | undefined } }

export default async function AdminUsersPage({ searchParams }: Props) {
  const page = Number(Array.isArray(searchParams.page) ? searchParams.page[0] : (searchParams.page ?? 0))
  const search = (Array.isArray(searchParams.q) ? searchParams.q[0] : searchParams.q) ?? ''
  const result = await listUsers(page, search)

  return (
    <div>
      <a href="#main-content" className="sr-only focus:not-sr-only">Aller au contenu principal</a>

      <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'var(--font-mono)' }}>
        Utilisateurs
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
        {result.total} utilisateurs inscrits
      </p>

      {/* Recherche */}
      <form method="GET" className="flex gap-2 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true"
            style={{ color: 'var(--muted-foreground)' }} />
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Rechercher par nom..."
            className="w-full pl-9 pr-4 py-2 text-sm border bg-transparent outline-none focus-visible:ring-2"
            style={{
              borderColor: 'var(--border)',
              color: 'var(--foreground)',
              '--tw-ring-color': 'var(--primary)',
            } as React.CSSProperties}
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
          style={{ background: 'var(--primary)', color: '#fff' }}
        >
          Rechercher
        </button>
      </form>

      {/* Tableau */}
      <div className="border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--muted-foreground)' }}>Nom</th>
              <th className="text-left px-4 py-3 font-medium hidden md:table-cell" style={{ color: 'var(--muted-foreground)' }}>Email</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--muted-foreground)' }}>Statut</th>
              <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--muted-foreground)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {result.users.map(u => (
              <tr key={u.$id} className="border-b" style={{ borderColor: 'var(--border)' }}>
                <td className="px-4 py-3 font-medium">{u.name || '—'}</td>
                <td className="px-4 py-3 hidden md:table-cell" style={{ color: 'var(--muted-foreground)' }}>
                  {u.email}
                </td>
                <td className="px-4 py-3">
                  <span
                    className="text-xs px-2 py-0.5 uppercase tracking-widest"
                    style={{
                      background: u.status ? 'rgba(79, 106, 255, 0.15)' : 'rgba(239, 35, 60, 0.15)',
                      color: u.status ? 'var(--primary)' : 'var(--secondary)',
                    }}
                  >
                    {u.status ? 'Actif' : 'Bloqué'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <form action={u.status ? blockUser.bind(null, u.$id) : unblockUser.bind(null, u.$id)}>
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border ml-auto transition-opacity hover:opacity-80"
                      style={{
                        borderColor: u.status ? 'var(--secondary)' : 'var(--border)',
                        color: u.status ? 'var(--secondary)' : 'var(--muted-foreground)',
                      }}
                    >
                      {u.status
                        ? <><ShieldOff size={12} aria-hidden="true" /> Bloquer</>
                        : <><Shield size={12} aria-hidden="true" /> Débloquer</>
                      }
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {result.total > 25 && (
        <div className="flex gap-2 mt-4 justify-end">
          {page > 0 && (
            <a
              href={`/admin/users?page=${page - 1}${search ? `&q=${search}` : ''}`}
              className="px-3 py-1.5 text-sm border transition-opacity hover:opacity-80"
              style={{ borderColor: 'var(--border)' }}
            >
              Précédent
            </a>
          )}
          {(page + 1) * 25 < result.total && (
            <a
              href={`/admin/users?page=${page + 1}${search ? `&q=${search}` : ''}`}
              className="px-3 py-1.5 text-sm border transition-opacity hover:opacity-80"
              style={{ borderColor: 'var(--border)' }}
            >
              Suivant
            </a>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Vérifier le type-check**

```bash
cd /mnt/d/dev/KonfiturGameFullInfra/frontend && pnpm type-check
```

Attendu : 0 erreur.

- [ ] **Commit**

```bash
git add frontend/src/app/admin/users/page.tsx
git commit -m "feat: add admin users page with search, status display and block/unblock actions"
```

---

## Task 8 : /admin/jams — Gestion de toutes les jams

**Fichiers :**
- Créer : `frontend/src/app/admin/jams/DeleteJamButton.tsx` (client component)
- Créer : `frontend/src/app/admin/jams/page.tsx` (server component)

La suppression avec confirmation nécessite `window.confirm()` → composant client séparé.
`metadata` est incompatible avec `'use client'` → les deux doivent être dans des fichiers distincts.

- [ ] **Créer `frontend/src/app/admin/jams/DeleteJamButton.tsx`**

```tsx
'use client'

import { Trash2 } from 'lucide-react'
import { deleteJam } from '@/lib/actions/admin'

export function DeleteJamButton({ jamId, jamTitle }: { jamId: string; jamTitle: string }) {
  return (
    <form action={deleteJam.bind(null, jamId)}>
      <button
        type="submit"
        title="Supprimer la jam"
        className="p-1.5 border transition-opacity hover:opacity-80"
        style={{ borderColor: 'var(--secondary)', color: 'var(--secondary)' }}
        onClick={e => {
          if (!confirm(`Supprimer "${jamTitle}" ? Cette action est irréversible.`)) {
            e.preventDefault()
          }
        }}
      >
        <Trash2 size={13} aria-hidden="true" />
      </button>
    </form>
  )
}
```

- [ ] **Créer `frontend/src/app/admin/jams/page.tsx`**

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { Star } from 'lucide-react'
import { listAllJams, toggleJamFeatured } from '@/lib/actions/admin'
import { DeleteJamButton } from './DeleteJamButton'

export const metadata: Metadata = { title: 'Jams' }

type Props = { searchParams: { [key: string]: string | string[] | undefined } }

const STATUS_LABELS: Record<string, string> = {
  upcoming: 'À venir',
  ongoing: 'En cours',
  ended: 'Terminée',
}

export default async function AdminJamsPage({ searchParams }: Props) {
  const status = Array.isArray(searchParams.status) ? searchParams.status[0] : searchParams.status
  const page = Number(Array.isArray(searchParams.page) ? searchParams.page[0] : (searchParams.page ?? 0))
  const jams = await listAllJams(status, page)

  const filters = [
    { label: 'Toutes', value: undefined },
    { label: 'À venir', value: 'upcoming' },
    { label: 'En cours', value: 'ongoing' },
    { label: 'Terminées', value: 'ended' },
  ]

  return (
    <div>
      <a href="#main-content" className="sr-only focus:not-sr-only">Aller au contenu principal</a>

      <h1 className="text-2xl font-bold mb-6" style={{ fontFamily: 'var(--font-mono)' }}>
        Jams
      </h1>

      {/* Filtres */}
      <div className="flex gap-2 mb-6">
        {filters.map(f => {
          const href = f.value ? `/admin/jams?status=${f.value}` : '/admin/jams'
          const active = status === f.value || (!status && !f.value)
          return (
            <Link
              key={f.label}
              href={href}
              className="px-3 py-1.5 text-xs font-medium border transition-opacity hover:opacity-80"
              style={{
                background: active ? 'var(--primary)' : 'transparent',
                borderColor: active ? 'var(--primary)' : 'var(--border)',
                color: active ? '#fff' : 'var(--muted-foreground)',
              }}
            >
              {f.label}
            </Link>
          )
        })}
      </div>

      {jams.length === 0 ? (
        <p style={{ color: 'var(--muted-foreground)' }}>Aucune jam trouvée.</p>
      ) : (
        <div className="border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--muted-foreground)' }}>Titre</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell" style={{ color: 'var(--muted-foreground)' }}>Statut</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell" style={{ color: 'var(--muted-foreground)' }}>Fin</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--muted-foreground)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jams.map(jam => (
                <tr key={jam.id} className="border-b" style={{ borderColor: 'var(--border)' }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {jam.featured && (
                        <Star size={12} style={{ color: 'var(--primary)' }} aria-label="Mise en avant" />
                      )}
                      <Link
                        href={`/jam/${jam.id}`}
                        className="font-medium hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {jam.title}
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span
                      className="text-xs px-2 py-0.5 uppercase tracking-widest"
                      style={{
                        background: jam.status === 'ongoing' ? 'rgba(79, 106, 255, 0.15)'
                          : jam.status === 'ended' ? 'rgba(255,255,255,0.05)'
                          : 'rgba(255, 200, 0, 0.1)',
                        color: jam.status === 'ongoing' ? 'var(--primary)'
                          : jam.status === 'ended' ? 'var(--muted-foreground)'
                          : '#ffc800',
                      }}
                    >
                      {STATUS_LABELS[jam.status] ?? jam.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell" style={{ color: 'var(--muted-foreground)' }}>
                    {jam.endDate.toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      {/* Featured toggle */}
                      <form action={toggleJamFeatured.bind(null, jam.id, !jam.featured, jam.featuredOrder)}>
                        <button
                          type="submit"
                          title={jam.featured ? 'Retirer de la mise en avant' : 'Mettre en avant'}
                          className="p-1.5 border transition-opacity hover:opacity-80"
                          style={{
                            borderColor: jam.featured ? 'var(--primary)' : 'var(--border)',
                            color: jam.featured ? 'var(--primary)' : 'var(--muted-foreground)',
                          }}
                        >
                          <Star size={13} aria-hidden="true" />
                        </button>
                      </form>
                      {/* Suppression avec confirmation (composant client) */}
                      <DeleteJamButton jamId={jam.id} jamTitle={jam.title} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Vérifier le type-check**

```bash
cd /mnt/d/dev/KonfiturGameFullInfra/frontend && pnpm type-check
```

- [ ] **Mettre à jour la carte des fichiers** : ajouter `frontend/src/app/admin/jams/DeleteJamButton.tsx` comme fichier créé.

- [ ] **Commit**

```bash
git add frontend/src/app/admin/jams/DeleteJamButton.tsx frontend/src/app/admin/jams/page.tsx
git commit -m "feat: add admin jams page with status filters, featured toggle and delete with confirmation"
```

---

## Task 9 : /admin/moderation — File de signalements

**Fichiers :**
- Créer : `frontend/src/app/admin/moderation/page.tsx`

Deux sections : messages signalés + projets signalés. Actions : supprimer, marquer comme résolu.

- [ ] **Créer `frontend/src/app/admin/moderation/page.tsx`**

```tsx
import type { Metadata } from 'next'
import { CheckCircle, Trash2 } from 'lucide-react'
import {
  listReportedMessages,
  listReportedProjects,
  deleteMessage,
  resolveMessageReport,
  resolveProjectReport,
} from '@/lib/actions/admin'

export const metadata: Metadata = { title: 'Modération' }

export default async function AdminModerationPage() {
  const [messages, projects] = await Promise.all([
    listReportedMessages(),
    listReportedProjects(),
  ])

  return (
    <div>
      <a href="#main-content" className="sr-only focus:not-sr-only">Aller au contenu principal</a>

      <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'var(--font-mono)' }}>
        Modération
      </h1>
      <p className="text-sm mb-8" style={{ color: 'var(--muted-foreground)' }}>
        {messages.length + projects.length} signalement(s) en attente
      </p>

      {/* Messages signalés */}
      <section className="mb-10">
        <h2 className="text-base font-semibold mb-4 pb-2 border-b" style={{ borderColor: 'var(--border)' }}>
          Messages signalés ({messages.length})
        </h2>
        {messages.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Aucun message signalé.</p>
        ) : (
          <div className="space-y-3">
            {messages.map(msg => (
              <div
                key={msg.id}
                className="p-4 border"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold">{msg.authorName}</span>
                      <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        {msg.createdAt.toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    <p className="text-sm break-words" style={{ color: 'var(--muted-foreground)' }}>
                      {msg.content}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <form action={resolveMessageReport.bind(null, msg.id)}>
                      <button
                        type="submit"
                        title="Marquer comme résolu"
                        className="p-1.5 border transition-opacity hover:opacity-80"
                        style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                      >
                        <CheckCircle size={13} aria-hidden="true" />
                      </button>
                    </form>
                    <form action={deleteMessage.bind(null, msg.id)}>
                      <button
                        type="submit"
                        title="Supprimer le message"
                        className="p-1.5 border transition-opacity hover:opacity-80"
                        style={{ borderColor: 'var(--secondary)', color: 'var(--secondary)' }}
                      >
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Projets signalés */}
      <section>
        <h2 className="text-base font-semibold mb-4 pb-2 border-b" style={{ borderColor: 'var(--border)' }}>
          Projets signalés ({projects.length})
        </h2>
        {projects.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Aucun projet signalé.</p>
        ) : (
          <div className="space-y-3">
            {projects.map(project => (
              <div
                key={project.id}
                className="p-4 border"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm mb-1">{project.title}</p>
                    <p className="text-sm break-words" style={{ color: 'var(--muted-foreground)' }}>
                      {project.description}
                    </p>
                  </div>
                  <form action={resolveProjectReport.bind(null, project.id)}>
                    <button
                      type="submit"
                      title="Marquer comme résolu"
                      className="p-1.5 border transition-opacity hover:opacity-80 flex-shrink-0"
                      style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                    >
                      <CheckCircle size={13} aria-hidden="true" />
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Vérifier le type-check**

```bash
cd /mnt/d/dev/KonfiturGameFullInfra/frontend && pnpm type-check
```

- [ ] **Commit**

```bash
git add frontend/src/app/admin/moderation/page.tsx
git commit -m "feat: add admin moderation page with reported messages and projects queue"
```

---

## Task 10 : /admin/announcements — Gestion des annonces

**Fichiers :**
- Créer : `frontend/src/app/admin/announcements/page.tsx`

Formulaire de création + liste des annonces existantes. `jam_id = 'all'` = annonce globale plateforme.

**Note :** La collection `announcements` dans Appwrite stocke `author_name` mais ce champ n'est pas dans le type `Announcement` actuel. On utilisera `authorId` pour afficher l'identifiant. Si `author_name` est stocké dans Appwrite, il sera accessible via `doc.author_name` dans le mappeur, mais on ne modifie pas les types existants pour ça.

- [ ] **Créer `frontend/src/app/admin/announcements/page.tsx`**

```tsx
import type { Metadata } from 'next'
import { Trash2 } from 'lucide-react'
import { createAnnouncement, listAnnouncements, deleteAnnouncement } from '@/lib/actions/admin'
import { getCurrentUser } from '@/lib/actions/dashboard'

export const metadata: Metadata = { title: 'Annonces' }

export default async function AdminAnnouncementsPage() {
  const [user, announcements] = await Promise.all([
    getCurrentUser(),
    listAnnouncements(),
  ])

  return (
    <div>
      <a href="#main-content" className="sr-only focus:not-sr-only">Aller au contenu principal</a>

      <h1 className="text-2xl font-bold mb-8" style={{ fontFamily: 'var(--font-mono)' }}>
        Annonces
      </h1>

      {/* Formulaire création */}
      <section
        className="p-5 border mb-10"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <h2 className="text-base font-semibold mb-4">Nouvelle annonce</h2>
        <form
          action={async (formData: FormData) => {
            'use server'
            const title = formData.get('title') as string
            const content = formData.get('content') as string
            const jamId = (formData.get('jamId') as string) || 'all'
            const important = formData.get('important') === 'on'
            await createAnnouncement({
              title,
              content,
              jamId,
              important,
              authorId: user.$id,
              authorName: user.name || user.email,
            })
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="title" className="block text-xs uppercase tracking-widest mb-1.5"
              style={{ color: 'var(--muted-foreground)' }}>
              Titre
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              className="w-full px-3 py-2 text-sm border bg-transparent outline-none focus-visible:ring-2"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>
          <div>
            <label htmlFor="content" className="block text-xs uppercase tracking-widest mb-1.5"
              style={{ color: 'var(--muted-foreground)' }}>
              Contenu
            </label>
            <textarea
              id="content"
              name="content"
              required
              rows={4}
              className="w-full px-3 py-2 text-sm border bg-transparent outline-none focus-visible:ring-2 resize-none"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>
          <div>
            <label htmlFor="jamId" className="block text-xs uppercase tracking-widest mb-1.5"
              style={{ color: 'var(--muted-foreground)' }}>
              Ciblage (laisser vide = toute la plateforme)
            </label>
            <input
              id="jamId"
              name="jamId"
              type="text"
              placeholder="ID de la jam (optionnel)"
              className="w-full px-3 py-2 text-sm border bg-transparent outline-none focus-visible:ring-2"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="important" name="important" className="w-4 h-4" />
            <label htmlFor="important" className="text-sm" style={{ color: 'var(--foreground)' }}>
              Annonce importante
            </label>
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ background: 'var(--primary)', color: '#fff' }}
          >
            Publier l'annonce
          </button>
        </form>
      </section>

      {/* Liste des annonces */}
      <section>
        <h2 className="text-base font-semibold mb-4 pb-2 border-b" style={{ borderColor: 'var(--border)' }}>
          Annonces publiées ({announcements.length})
        </h2>
        {announcements.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Aucune annonce.</p>
        ) : (
          <div className="space-y-3">
            {announcements.map(ann => (
              <div
                key={ann.id}
                className="p-4 border"
                style={{
                  background: 'var(--card)',
                  borderColor: ann.important ? 'var(--secondary)' : 'var(--border)',
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">{ann.title}</span>
                      {ann.important && (
                        <span
                          className="text-[9px] uppercase tracking-widest px-1.5 py-0.5"
                          style={{ background: 'rgba(239,35,60,0.15)', color: 'var(--secondary)' }}
                        >
                          Important
                        </span>
                      )}
                      {ann.jamId !== 'all' && (
                        <span
                          className="text-[9px] uppercase tracking-widest px-1.5 py-0.5"
                          style={{ background: 'rgba(79,106,255,0.15)', color: 'var(--primary)' }}
                        >
                          Jam ciblée
                        </span>
                      )}
                    </div>
                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{ann.content}</p>
                    <p className="text-xs mt-1.5" style={{ color: 'var(--muted-foreground)' }}>
                      {ann.createdAt.toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <form action={deleteAnnouncement.bind(null, ann.id)}>
                    <button
                      type="submit"
                      title="Supprimer l'annonce"
                      className="p-1.5 border flex-shrink-0 transition-opacity hover:opacity-80"
                      style={{ borderColor: 'var(--secondary)', color: 'var(--secondary)' }}
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Vérifier le type-check**

```bash
cd /mnt/d/dev/KonfiturGameFullInfra/frontend && pnpm type-check
```

- [ ] **Commit**

```bash
git add frontend/src/app/admin/announcements/page.tsx
git commit -m "feat: add admin announcements page with create form and list"
```

---

## Task 11 : /admin/featured — Curation mise en avant

**Fichiers :**
- Créer : `frontend/src/app/admin/featured/page.tsx`

Deux sections : toggle featured sur les jams + sélection gagnants par jam.

- [ ] **Créer `frontend/src/app/admin/featured/page.tsx`**

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { Star, Trophy } from 'lucide-react'
import {
  listJamsForCuration,
  listProjectsForJam,
  toggleJamFeatured,
  setProjectWinner,
} from '@/lib/actions/admin'

export const metadata: Metadata = { title: 'Mise en avant' }

type Props = { searchParams: { [key: string]: string | string[] | undefined } }

export default async function AdminFeaturedPage({ searchParams }: Props) {
  const selectedJamId = Array.isArray(searchParams.jam) ? searchParams.jam[0] : searchParams.jam
  const jams = await listJamsForCuration()
  const selectedJam = selectedJamId ? jams.find(j => j.id === selectedJamId) : null
  const projects = selectedJamId ? await listProjectsForJam(selectedJamId) : []

  return (
    <div>
      <a href="#main-content" className="sr-only focus:not-sr-only">Aller au contenu principal</a>

      <h1 className="text-2xl font-bold mb-8" style={{ fontFamily: 'var(--font-mono)' }}>
        Mise en avant
      </h1>

      {/* Section : Featured jams */}
      <section className="mb-10">
        <h2 className="text-base font-semibold mb-4 pb-2 border-b" style={{ borderColor: 'var(--border)' }}>
          Jams mises en avant
        </h2>
        <div className="space-y-2">
          {jams.map(jam => (
            <div
              key={jam.id}
              className="flex items-center justify-between p-3 border"
              style={{
                background: 'var(--card)',
                borderColor: jam.featured ? 'var(--primary)' : 'var(--border)',
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Star
                  size={14}
                  style={{ color: jam.featured ? 'var(--primary)' : 'var(--muted-foreground)', flexShrink: 0 }}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{jam.title}</p>
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    {jam.status} · {jam.endDate.toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Voir gagnants de cette jam */}
                <Link
                  href={`/admin/featured?jam=${jam.id}`}
                  className="px-2 py-1 text-xs border transition-opacity hover:opacity-80"
                  style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                >
                  Gagnants
                </Link>
                {/* Featured toggle */}
                <form action={toggleJamFeatured.bind(null, jam.id, !jam.featured, jam.featuredOrder)}>
                  <button
                    type="submit"
                    className="px-2 py-1 text-xs border font-medium transition-opacity hover:opacity-80"
                    style={{
                      background: jam.featured ? 'var(--primary)' : 'transparent',
                      borderColor: jam.featured ? 'var(--primary)' : 'var(--border)',
                      color: jam.featured ? '#fff' : 'var(--muted-foreground)',
                    }}
                  >
                    {jam.featured ? 'Retirer' : 'Mettre en avant'}
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section : Gagnants de la jam sélectionnée */}
      {selectedJam && (
        <section>
          <h2 className="text-base font-semibold mb-1 pb-2 border-b" style={{ borderColor: 'var(--border)' }}>
            Gagnants — {selectedJam.title}
          </h2>
          <p className="text-xs mb-4" style={{ color: 'var(--muted-foreground)' }}>
            {projects.length} projet(s) soumis
          </p>
          {projects.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Aucun projet soumis pour cette jam.</p>
          ) : (
            <div className="space-y-2">
              {projects.map(project => (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-3 border"
                  style={{
                    background: 'var(--card)',
                    borderColor: project.winner ? 'var(--primary)' : 'var(--border)',
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Trophy
                      size={14}
                      style={{ color: project.winner ? 'var(--primary)' : 'var(--muted-foreground)', flexShrink: 0 }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{project.title}</p>
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        {project.technologies.slice(0, 3).join(', ')}
                      </p>
                    </div>
                  </div>
                  <form action={setProjectWinner.bind(null, project.id, !project.winner)}>
                    <button
                      type="submit"
                      className="px-2 py-1 text-xs border font-medium transition-opacity hover:opacity-80 flex-shrink-0"
                      style={{
                        background: project.winner ? 'var(--primary)' : 'transparent',
                        borderColor: project.winner ? 'var(--primary)' : 'var(--border)',
                        color: project.winner ? '#fff' : 'var(--muted-foreground)',
                      }}
                    >
                      {project.winner ? 'Retirer gagnant' : 'Désigner gagnant'}
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
```

- [ ] **Vérifier le type-check**

```bash
cd /mnt/d/dev/KonfiturGameFullInfra/frontend && pnpm type-check
```

- [ ] **Commit**

```bash
git add frontend/src/app/admin/featured/page.tsx
git commit -m "feat: add admin featured page with jam curation and project winner selection"
```

---

## Task 12 : Vérification finale

- [ ] **Linting complet**

```bash
cd /mnt/d/dev/KonfiturGameFullInfra/frontend && pnpm lint
```

Corriger tout warning/erreur ESLint avant de continuer.

- [ ] **Type-check final**

```bash
cd /mnt/d/dev/KonfiturGameFullInfra/frontend && pnpm type-check
```

Attendu : 0 erreur.

- [ ] **Vérification visuelle manuelle**

1. Démarrer l'environnement : `docker compose up` (depuis `/mnt/d/dev/KonfiturGameFullInfra/`)
2. Se connecter sur http://localhost:3000/auth/login
3. Accéder à http://localhost:3000/admin → doit afficher 404 si l'utilisateur n'est pas dans la team `admins`
4. Ajouter l'utilisateur à la team `admins` dans la console Appwrite (http://localhost:8080/console)
5. Réaccéder à http://localhost:3000/admin → sidebar rouge + badge SUPER ADMIN visible
6. Vérifier les 5 sections : `/admin/users`, `/admin/jams`, `/admin/moderation`, `/admin/announcements`, `/admin/featured`

- [ ] **Commit final**

```bash
git add -A
git commit -m "feat: complete admin backoffice Phase 2 — 6 sections, auth guard, red sidebar"
```

---

## Points d'attention

| Risque | Mitigation |
|--------|-----------|
| `account.listMemberships()` peut lancer si la session est expirée | Enveloppé dans `try/catch` → `notFound()` |
| `serverUsers.list()` avec `Query.search('name', search)` : la collection `users` d'Appwrite (endpoint `/v1/users`) n'est pas une vraie collection Appwrite — la recherche peut ne pas fonctionner | Si la recherche échoue, la supprimer de `listUsers()` pour l'instant |
| La team `admins` doit exister dans Appwrite avant de tester | La créer manuellement dans la console Appwrite → Auth → Teams |
| Les champs `reported`, `winner`, `featured` sur Appwrite : ajoutés en Phase 1 | Vérifier que les attributs existent avant de lancer la Phase 2 |
| `author_name` dans la collection `announcements` : le schéma Appwrite doit avoir ce champ | Si absent, le retirer du `createAnnouncement` payload |
