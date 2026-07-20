# Dashboard User — Redesign (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactorer `/dashboard` en un vrai dashboard utilisateur avec sidebar PARTICIPANT/ORGANISATEUR, data réelle depuis Appwrite, et routes dédiées par section.

**Architecture:** Le dashboard SPA mono-fichier actuel est remplacé par un layout Next.js App Router avec une sidebar déplacée dans `layout.tsx` et des pages individuelles par section. Toutes les données passent par des Server Actions session-scoped dans `lib/actions/dashboard.ts` qui utilisent le cookie Appwrite pour identifier l'utilisateur côté serveur.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Tailwind CSS v4, node-appwrite (Server Actions), pnpm

> **Pas de framework de test installé.** Chaque "test" = `cd frontend && pnpm type-check` (doit retourner 0 erreur). Vérification visuelle dans le navigateur sur http://localhost:3000 après `docker compose up`.

---

## Carte des fichiers

| Fichier | Action | Responsabilité |
|---------|--------|----------------|
| `frontend/src/lib/appwrite/session.ts` | **Créer** | Client Appwrite scopé à la session user (cookies) |
| `frontend/src/lib/actions/dashboard.ts` | **Créer** | Server Actions : lectures/écritures dashboard |
| `frontend/src/types/index.ts` | **Modifier** | Ajouter `featured`, `reported`, `winner` aux types |
| `frontend/src/lib/appwrite/types.ts` | **Modifier** | Mettre à jour les mappeurs avec nouveaux champs |
| `frontend/src/app/dashboard/layout.tsx` | **Refactor** | Sidebar avec blocs PARTICIPANT + ORGANISATEUR |
| `frontend/src/app/dashboard/page.tsx` | **Refactor** | Vue d'ensemble : stats perso + activité récente |
| `frontend/src/app/dashboard/participations/page.tsx` | **Créer** | Liste des jams rejointes |
| `frontend/src/app/dashboard/team/page.tsx` | **Créer** | Équipe active, membres, code d'invitation |
| `frontend/src/app/dashboard/my-jams/page.tsx` | **Créer** | Liste des jams organisées |
| `frontend/src/app/dashboard/my-jams/new/page.tsx` | **Créer** | Formulaire de création de jam |
| `frontend/src/app/dashboard/my-jams/[jamId]/page.tsx` | **Créer** | Gestion d'une jam (participants, soumissions) |
| `frontend/src/middleware.ts` | **Modifier** | Ajouter les nouvelles routes au matcher |

---

## Task 1 : Schéma Appwrite — champs supplémentaires

**Prérequis :** Appwrite tourne (`docker compose up`), `APPWRITE_API_KEY` rempli dans `.env`.

Ces champs sont nécessaires pour Phase 1 (`submitted` sur `projects` est utilisé dans `getDashboardOverview`) et Phase 2. On les ajoute maintenant via l'API.

> **Note env :** Vérifier que `.env` contient bien `NEXT_PUBLIC_APPWRITE_PROJECT_ID=...` (avec le préfixe `NEXT_PUBLIC_`). Si seul `APPWRITE_PROJECT_ID` est défini, ajouter la ligne `NEXT_PUBLIC_APPWRITE_PROJECT_ID=<valeur>` dans `.env` et relancer `docker compose up` — le cookie de session utilise ce nom.

**Fichiers :** Aucun fichier source — appels API curl directs.

- [ ] **Charger les variables d'env**

```bash
export $(grep -v '^#' .env | xargs)
# Vérifier que les deux variantes sont disponibles :
echo "PROJECT_ID: $APPWRITE_PROJECT_ID"
echo "PROJECT_ID (NEXT_PUBLIC): $NEXT_PUBLIC_APPWRITE_PROJECT_ID"
# Si l'une est vide, définir l'alias manquant :
# export APPWRITE_PROJECT_ID="${APPWRITE_PROJECT_ID:-$NEXT_PUBLIC_APPWRITE_PROJECT_ID}"
```

- [ ] **Ajouter `featured` (boolean) sur `game_jams`**

```bash
curl -s -X POST "$NEXT_PUBLIC_APPWRITE_ENDPOINT/databases/konfitur-db/collections/game_jams/attributes/boolean" \
  -H "Content-Type: application/json" \
  -H "X-Appwrite-Project: $APPWRITE_PROJECT_ID" \
  -H "X-Appwrite-Key: $APPWRITE_API_KEY" \
  -d '{"key":"featured","required":false,"default":false}' | jq .
```
Attendu : `{"key":"featured","status":"processing",...}`

- [ ] **Ajouter `featured_order` (integer) sur `game_jams`**

```bash
curl -s -X POST "$NEXT_PUBLIC_APPWRITE_ENDPOINT/databases/konfitur-db/collections/game_jams/attributes/integer" \
  -H "Content-Type: application/json" \
  -H "X-Appwrite-Project: $APPWRITE_PROJECT_ID" \
  -H "X-Appwrite-Key: $APPWRITE_API_KEY" \
  -d '{"key":"featured_order","required":false}' | jq .
```

- [ ] **Ajouter `reported` (boolean) sur `chat_messages`**

```bash
curl -s -X POST "$NEXT_PUBLIC_APPWRITE_ENDPOINT/databases/konfitur-db/collections/chat_messages/attributes/boolean" \
  -H "Content-Type: application/json" \
  -H "X-Appwrite-Project: $APPWRITE_PROJECT_ID" \
  -H "X-Appwrite-Key: $APPWRITE_API_KEY" \
  -d '{"key":"reported","required":false,"default":false}' | jq .
```

- [ ] **Ajouter `submitted` (boolean) sur `projects`** *(nécessaire dès Phase 1 pour `Query.equal`)*

```bash
curl -s -X POST "$NEXT_PUBLIC_APPWRITE_ENDPOINT/databases/konfitur-db/collections/projects/attributes/boolean" \
  -H "Content-Type: application/json" \
  -H "X-Appwrite-Project: $APPWRITE_PROJECT_ID" \
  -H "X-Appwrite-Key: $APPWRITE_API_KEY" \
  -d '{"key":"submitted","required":false,"default":false}' | jq .
```

> Si le résultat est `409 Conflict`, l'attribut existe déjà — passer à la suite.

- [ ] **Ajouter `reported` (boolean) sur `projects`**

```bash
curl -s -X POST "$NEXT_PUBLIC_APPWRITE_ENDPOINT/databases/konfitur-db/collections/projects/attributes/boolean" \
  -H "Content-Type: application/json" \
  -H "X-Appwrite-Project: $APPWRITE_PROJECT_ID" \
  -H "X-Appwrite-Key: $APPWRITE_API_KEY" \
  -d '{"key":"reported","required":false,"default":false}' | jq .
```

- [ ] **Ajouter `winner` (boolean) sur `projects`**

```bash
curl -s -X POST "$NEXT_PUBLIC_APPWRITE_ENDPOINT/databases/konfitur-db/collections/projects/attributes/boolean" \
  -H "Content-Type: application/json" \
  -H "X-Appwrite-Project: $APPWRITE_PROJECT_ID" \
  -H "X-Appwrite-Key: $APPWRITE_API_KEY" \
  -d '{"key":"winner","required":false,"default":false}' | jq .
```

- [ ] **Attendre que tous les attributs passent à `available` (≈30s)**

```bash
sleep 30 && curl -s "$NEXT_PUBLIC_APPWRITE_ENDPOINT/databases/konfitur-db/collections/game_jams/attributes?limit=50" \
  -H "X-Appwrite-Project: $APPWRITE_PROJECT_ID" \
  -H "X-Appwrite-Key: $APPWRITE_API_KEY" | jq '[.attributes[] | {key:.key, status:.status}]'
```
Attendu : `featured` et `featured_order` avec `"status":"available"`.

---

## Task 2 : Types TypeScript — mise à jour

**Fichiers :**
- Modifier : `frontend/src/types/index.ts`
- Modifier : `frontend/src/lib/appwrite/types.ts`

- [ ] **Ajouter les nouveaux champs dans `types/index.ts`**

Dans `interface GameJam`, ajouter après `tags?`:
```ts
featured?: boolean
featuredOrder?: number
```

Dans `interface Project`, ajouter après `screenshotIds?`:
```ts
reported?: boolean
winner?: boolean
```

Dans `interface ChatMessage`, ajouter après `pinned`:
```ts
reported?: boolean
```

- [ ] **Mettre à jour les mappeurs dans `lib/appwrite/types.ts`**

Dans `mapDocToGameJam`, ajouter après `coverImage`:
```ts
featured: doc.featured ?? false,
featuredOrder: doc.featured_order,
```

Dans `mapDocToProject`, ajouter après `screenshotIds`:
```ts
reported: doc.reported ?? false,
winner: doc.winner ?? false,
```

Dans `mapDocToChatMessage`, ajouter après `pinned`:
```ts
reported: doc.reported ?? false,
```

- [ ] **Vérifier**

```bash
cd frontend && pnpm type-check
```
Attendu : 0 erreur.

- [ ] **Commit**

```bash
git add frontend/src/types/index.ts frontend/src/lib/appwrite/types.ts
git commit -m "FEAT Add featured/reported/winner fields to types and mappers"
```

---

## Task 3 : Client Appwrite session-scoped

**Fichiers :**
- Créer : `frontend/src/lib/appwrite/session.ts`

Ce fichier permet aux Server Actions de lire les données **en tant que l'utilisateur connecté** via son cookie de session, sans passer l'userId depuis le client.

- [ ] **Créer `frontend/src/lib/appwrite/session.ts`**

```ts
import { cookies } from 'next/headers'
import { Client, Account, Databases, Storage } from 'node-appwrite'

/**
 * Crée un client Appwrite scopé à la session de l'utilisateur connecté.
 * À utiliser UNIQUEMENT dans les Server Actions et Server Components.
 * Lit le cookie de session Appwrite depuis les headers Next.js.
 */
export function createSessionClient() {
  const cookieStore = cookies()
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!
  const sessionCookie = cookieStore.get(`a_session_${projectId}`)

  const client = new Client()
    .setEndpoint(
      process.env.APPWRITE_INTERNAL_ENDPOINT ??
      process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!
    )
    .setProject(projectId)

  if (sessionCookie?.value) {
    client.setSession(sessionCookie.value)
  }

  return {
    account: new Account(client),
    databases: new Databases(client),
    storage: new Storage(client),
  }
}
```

- [ ] **Vérifier**

```bash
cd frontend && pnpm type-check
```
Attendu : 0 erreur.

- [ ] **Commit**

```bash
git add frontend/src/lib/appwrite/session.ts
git commit -m "FEAT Add session-scoped Appwrite client for Server Actions"
```

---

## Task 4 : Server Actions — `lib/actions/dashboard.ts`

**Fichiers :**
- Créer : `frontend/src/lib/actions/dashboard.ts`

- [ ] **Créer `frontend/src/lib/actions/dashboard.ts`**

```ts
'use server'

import { ID, Query } from 'node-appwrite'
import { createSessionClient } from '@/lib/appwrite/session'
import { serverDatabases } from '@/lib/appwrite/server'
import { DATABASE_ID, COLLECTIONS, BUCKETS } from '@/lib/appwrite/config'
import { mapDocToGameJam, mapDocToTeam, mapDocToTeamMember, mapDocToProject } from '@/lib/appwrite/types'
import type { GameJam, Team, TeamMember, Project } from '@/types'

// ── Lecture session utilisateur ────────────────────────────────────────────

export async function getCurrentUser() {
  const { account } = createSessionClient()
  return account.get()
}

// ── Participations ─────────────────────────────────────────────────────────

/**
 * Retourne les jams auxquelles l'utilisateur participe (via team_members).
 */
export async function getUserParticipations(): Promise<{ jams: GameJam[]; teamsByJam: Record<string, Team> }> {
  const user = await getCurrentUser()

  // Toutes les lectures utilisent serverDatabases (clé API admin) car les Server Actions
  // sont déjà protégées par le middleware session. Le scope utilisateur est appliqué
  // via Query.equal('user_id', user.$id) — pas besoin du client session ici.

  // 1. Trouver les équipes dont l'user est membre
  const memberships = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.TEAM_MEMBERS, [
    Query.equal('user_id', user.$id),
    Query.limit(50),
  ])

  if (memberships.total === 0) return { jams: [], teamsByJam: {} }

  const teamIds = memberships.documents.map(m => m.team_id)

  // 2. Récupérer les équipes
  const teamsRes = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.TEAMS, [
    Query.equal('$id', teamIds),
  ])
  const teams = teamsRes.documents.map(mapDocToTeam)

  // 3. Récupérer les jams correspondantes
  const jamIds = [...new Set(teams.map(t => t.jamId))]
  const jamsRes = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.GAME_JAMS, [
    Query.equal('$id', jamIds),
  ])
  const jams = jamsRes.documents.map(mapDocToGameJam)

  const teamsByJam: Record<string, Team> = {}
  teams.forEach(team => { teamsByJam[team.jamId] = team })

  return { jams, teamsByJam }
}

// ── Équipe active ──────────────────────────────────────────────────────────

/**
 * Retourne l'équipe active de l'utilisateur (dans une jam en cours).
 */
export async function getUserActiveTeam(): Promise<{ team: Team | null; members: TeamMember[] }> {
  const user = await getCurrentUser()

  const memberships = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.TEAM_MEMBERS, [
    Query.equal('user_id', user.$id),
    Query.limit(10),
  ])

  if (memberships.total === 0) return { team: null, members: [] }

  // Prendre le team_id le plus récent
  const latestMembership = memberships.documents[0]
  const teamDoc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.TEAMS, latestMembership.team_id)
  const team = mapDocToTeam(teamDoc)

  const membersRes = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.TEAM_MEMBERS, [
    Query.equal('team_id', team.id),
  ])
  const members = membersRes.documents.map(mapDocToTeamMember)

  return { team, members }
}

// ── Jams organisées ────────────────────────────────────────────────────────

/**
 * Retourne les jams créées par l'utilisateur connecté.
 */
export async function getUserOrganizedJams(): Promise<GameJam[]> {
  const user = await getCurrentUser()

  const res = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.GAME_JAMS, [
    Query.equal('organizer_id', user.$id),
    Query.orderDesc('$createdAt'),
    Query.limit(50),
  ])

  return res.documents.map(mapDocToGameJam)
}

/**
 * Retourne une jam organisée par l'utilisateur avec ses participants et soumissions.
 */
export async function getOrganizedJamDetails(jamId: string): Promise<{
  jam: GameJam
  teams: Team[]
  projects: Project[]
}> {
  const user = await getCurrentUser()

  const jamDoc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.GAME_JAMS, jamId)

  // Vérifier que l'utilisateur est bien l'organisateur
  if (jamDoc.organizer_id !== user.$id) {
    throw new Error('Accès non autorisé')
  }

  const jam = mapDocToGameJam(jamDoc)

  const [teamsRes, projectsRes] = await Promise.all([
    serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.TEAMS, [
      Query.equal('jam_id', jamId),
    ]),
    serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.PROJECTS, [
      Query.equal('jam_id', jamId),
    ]),
  ])

  return {
    jam,
    teams: teamsRes.documents.map(mapDocToTeam),
    projects: projectsRes.documents.map(mapDocToProject),
  }
}

// ── Création de jam ────────────────────────────────────────────────────────

export interface CreateJamData {
  title: string
  slug: string
  theme: string
  description: string
  type: 'solo' | 'team' | 'both'
  startDate: string   // ISO string
  endDate: string     // ISO string
  duration: string
  rules: string[]
  prizes: string[]
  tags: string[]
  // coverFile intentionnellement absent : File n'est pas sérialisable
  // à travers la boundary Server Action. L'upload de cover est une
  // feature distincte (Phase 1.5) via FormData.
}

export async function createJam(data: CreateJamData): Promise<GameJam> {
  const user = await getCurrentUser()

  const doc = await serverDatabases.createDocument(
    DATABASE_ID,
    COLLECTIONS.GAME_JAMS,
    ID.unique(),
    {
      title: data.title,
      slug: data.slug,
      theme: data.theme,
      description: data.description,
      type: data.type,
      status: 'upcoming',
      start_date: data.startDate,
      end_date: data.endDate,
      duration: data.duration,
      rules: data.rules,
      prizes: data.prizes,
      tags: data.tags,
      organizer_id: user.$id,
      // cover_image_id : upload déféré Phase 1.5 (File non sérialisable via Server Action)
    },
    [`read("any")`, `update("user:${user.$id}")`, `delete("user:${user.$id}")`],
  )

  return mapDocToGameJam(doc)
}

// ── Vue d'ensemble ─────────────────────────────────────────────────────────

export async function getDashboardOverview(): Promise<{
  participationsCount: number
  organizedJamsCount: number
  submittedProjectsCount: number
  ongoingJam: GameJam | null
}> {
  const user = await getCurrentUser()

  const [memberships, organizedJams, submissions, ongoingJams] = await Promise.all([
    serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.TEAM_MEMBERS, [
      Query.equal('user_id', user.$id),
      Query.limit(1),
    ]),
    serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.GAME_JAMS, [
      Query.equal('organizer_id', user.$id),
      Query.limit(1),
    ]),
    // Projets soumis de l'utilisateur : résoudre via ses team_members
    // Pour simplifier Phase 1, on compte les équipes dont l'user est leader
    // avec un project_id non-null (proxy rapide — stat exacte en Phase 1.5)
    serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.TEAMS, [
      Query.equal('leader_id', user.$id),
      Query.isNotNull('project_id'),
      Query.limit(100),
    ]),
    serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.GAME_JAMS, [
      Query.equal('status', 'ongoing'),
      Query.limit(1),
    ]),
  ])

  return {
    participationsCount: memberships.total,
    organizedJamsCount: organizedJams.total,
    submittedProjectsCount: submissions.total,  // proxy : équipes où l'user est leader avec projet
    ongoingJam: ongoingJams.total > 0 ? mapDocToGameJam(ongoingJams.documents[0]) : null,
  }
}
```

- [ ] **Vérifier**

```bash
cd frontend && pnpm type-check
```
Attendu : 0 erreur.

- [ ] **Commit**

```bash
git add frontend/src/lib/actions/dashboard.ts frontend/src/lib/appwrite/session.ts
git commit -m "FEAT Add dashboard Server Actions with session-scoped Appwrite client"
```

---

## Task 5 : Refactor `dashboard/layout.tsx` — nouvelle sidebar

**Fichiers :**
- Refactor : `frontend/src/app/dashboard/layout.tsx`

La sidebar devient le vrai layout du dashboard — elle remplace l'ancienne sidebar qui était dans `page.tsx`. `page.tsx` sera simplifié à la section "vue d'ensemble" uniquement.

- [ ] **Remplacer `frontend/src/app/dashboard/layout.tsx` en entier**

```tsx
import type { Metadata } from 'next'
import DashboardSidebar from './DashboardSidebar'

export const metadata: Metadata = {
  title: { default: 'Dashboard', template: '%s | KonfiturGame' },
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <DashboardSidebar />
      <main id="main-content" className="flex-1 overflow-auto p-6 pb-24 md:pb-6 md:ml-60">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Créer `frontend/src/app/dashboard/DashboardSidebar.tsx`**

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Gamepad2, LayoutDashboard, Trophy, Users, Send,
  List, Plus, LogOut, Menu, X, Home,
} from 'lucide-react'
import { useAuth } from '@/components/providers/AuthProvider'

export default function DashboardSidebar() {
  const { user, logout } = useAuth()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href)

  const NavLink = ({ href, icon: Icon, label }: { href: string; icon: typeof Home; label: string }) => (
    <Link
      href={href}
      onClick={() => setOpen(false)}
      aria-current={isActive(href) ? 'page' : undefined}
      className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors"
      style={{
        background: isActive(href) ? 'var(--sidebar-accent)' : 'transparent',
        color: isActive(href) ? 'var(--sidebar-primary)' : 'var(--sidebar-foreground)',
      }}
    >
      <Icon size={15} aria-hidden="true" />
      {label}
    </Link>
  )

  const sidebar = (
    <nav
      className="flex flex-col h-full"
      style={{ background: 'var(--sidebar)', borderColor: 'var(--sidebar-border)' }}
      aria-label="Navigation du dashboard"
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: 'var(--sidebar-border)' }}>
        <Gamepad2 size={18} style={{ color: 'var(--primary)' }} aria-hidden="true" />
        <Link href="/" className="font-bold text-sm" style={{ color: 'var(--sidebar-foreground)' }}>
          Konfitur<span style={{ color: 'var(--primary)' }}>Game</span>
        </Link>
      </div>

      {/* Utilisateur */}
      {user && (
        <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--sidebar-border)' }}>
          <p className="text-[9px] tracking-widest mb-1 uppercase" style={{ color: 'var(--muted-foreground)' }}>
            Connecté
          </p>
          <p className="font-semibold text-sm truncate">{user.name || user.email}</p>
        </div>
      )}

      <div className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {/* Vue d'ensemble */}
        <NavLink href="/dashboard" icon={LayoutDashboard} label="Vue d'ensemble" />

        {/* Bloc PARTICIPANT */}
        <p className="px-3 pt-4 pb-1 text-[9px] tracking-widest uppercase" style={{ color: 'var(--muted-foreground)' }}>
          Participant
        </p>
        <NavLink href="/dashboard/participations" icon={Trophy} label="Mes participations" />
        <NavLink href="/dashboard/team" icon={Users} label="Mon équipe" />
        {/* "Mes soumissions" est une sous-section de participations — déférée Phase 1.5.
            Pour l'instant, les soumissions sont visibles dans /dashboard/participations. */}

        {/* Bloc ORGANISATEUR */}
        <p
          className="px-3 pt-4 pb-1 text-[9px] tracking-widest uppercase border-t mt-3"
          style={{ color: 'var(--muted-foreground)', borderColor: 'var(--sidebar-border)' }}
        >
          Organisateur
        </p>
        <NavLink href="/dashboard/my-jams" icon={List} label="Mes jams" />
        <Link
          href="/dashboard/my-jams/new"
          onClick={() => setOpen(false)}
          className="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold transition-opacity hover:opacity-80 mt-1"
          style={{
            border: '1px solid var(--primary)',
            color: 'var(--primary)',
          }}
        >
          <Plus size={15} aria-hidden="true" />
          Créer une jam
        </Link>
      </div>

      {/* Bas de sidebar */}
      <div className="p-3 border-t space-y-0.5" style={{ borderColor: 'var(--sidebar-border)' }}>
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
  )

  return (
    <>
      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 w-60 border-r z-30"
        style={{ borderColor: 'var(--sidebar-border)' }}>
        {sidebar}
      </aside>

      {/* Header mobile */}
      <header
        className="md:hidden fixed top-0 left-0 right-0 flex items-center justify-between px-4 py-3 border-b z-40"
        style={{ background: 'var(--sidebar)', borderColor: 'var(--sidebar-border)' }}
      >
        <div className="flex items-center gap-2 font-bold text-sm">
          <Gamepad2 size={16} style={{ color: 'var(--primary)' }} aria-hidden="true" />
          Dashboard
        </div>
        <button
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
          className="p-2"
        >
          {open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
        </button>
      </header>

      {/* Drawer mobile */}
      {open && (
        <>
          <div
            className="md:hidden fixed inset-0 z-30 bg-black/50"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <aside className="md:hidden fixed inset-y-0 left-0 w-64 z-40 flex flex-col border-r"
            style={{ borderColor: 'var(--sidebar-border)' }}>
            {sidebar}
          </aside>
        </>
      )}

      {/* Spacer mobile pour le header fixe */}
      <div className="md:hidden h-14 flex-shrink-0" />
    </>
  )
}
```

- [ ] **Vérifier**

```bash
cd frontend && pnpm type-check
```
Attendu : 0 erreur.

- [ ] **Test visuel** — ouvrir http://localhost:3000/dashboard, vérifier sidebar desktop + menu mobile.

- [ ] **Commit**

```bash
git add frontend/src/app/dashboard/layout.tsx frontend/src/app/dashboard/DashboardSidebar.tsx
git commit -m "FEAT Refactor dashboard layout with role-grouped sidebar (PARTICIPANT/ORGANISATEUR)"
```

---

## Task 6 : Refactor `dashboard/page.tsx` — Vue d'ensemble

**Fichiers :**
- Refactor : `frontend/src/app/dashboard/page.tsx`

Remplace l'ancienne SPA mono-fichier par une vraie page "vue d'ensemble" avec stats personnelles et jam en cours, data depuis `getDashboardOverview()`.

- [ ] **Remplacer `frontend/src/app/dashboard/page.tsx` en entier**

```tsx
import { getDashboardOverview } from '@/lib/actions/dashboard'
import CountdownTimer from '@/components/CountdownTimer'
import Link from 'next/link'
import { Gamepad2, Trophy, Send, ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Vue d\'ensemble' }

export default async function DashboardPage() {
  const { participationsCount, organizedJamsCount, submittedProjectsCount, ongoingJam } =
    await getDashboardOverview()

  return (
    <section aria-labelledby="overview-heading">
      <p className="text-[9px] tracking-widest uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
        Dashboard
      </p>
      <h1 id="overview-heading" className="text-2xl font-bold mb-6">Vue d&apos;ensemble</h1>

      {/* Stats personnelles */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="p-5 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Trophy size={16} style={{ color: 'var(--primary)' }} aria-hidden="true" />
            <span className="text-[9px] tracking-widest uppercase" style={{ color: 'var(--muted-foreground)' }}>
              Participations
            </span>
          </div>
          <p className="text-3xl font-bold" style={{ color: 'var(--primary)' }}>{participationsCount}</p>
        </div>

        <div className="p-5 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Send size={16} style={{ color: 'var(--success)' }} aria-hidden="true" />
            <span className="text-[9px] tracking-widest uppercase" style={{ color: 'var(--muted-foreground)' }}>
              Projets soumis
            </span>
          </div>
          <p className="text-3xl font-bold" style={{ color: 'var(--success)' }}>{submittedProjectsCount}</p>
        </div>

        <div className="p-5 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Gamepad2 size={16} style={{ color: 'var(--secondary)' }} aria-hidden="true" />
            <span className="text-[9px] tracking-widest uppercase" style={{ color: 'var(--muted-foreground)' }}>
              Jams organisées
            </span>
          </div>
          <p className="text-3xl font-bold" style={{ color: 'var(--secondary)' }}>{organizedJamsCount}</p>
        </div>
      </div>

      {/* Feed d'activité récente — déféré Phase 1.5.
          Nécessite un champ `action_type` ou une collection dédiée non présente dans le schéma actuel.
          Phase 1 affiche uniquement les stats et la jam en cours. */}

      {/* Jam en cours */}
      {ongoingJam ? (
        <div>
          <p className="text-[9px] tracking-widest uppercase mb-3" style={{ color: 'var(--muted-foreground)' }}>
            Jam en cours
          </p>
          <div
            className="p-6 border flex items-center justify-between gap-6"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div>
              <h2 className="text-xl font-bold mb-1">{ongoingJam.title}</h2>
              <p className="text-sm mb-4" style={{ color: 'var(--primary)' }}>Thème : {ongoingJam.theme}</p>
              <Link
                href={`/jam/${ongoingJam.id}`}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
                style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                Voir la jam <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
            <div role="timer" aria-label="Temps restant">
              <CountdownTimer targetDate={ongoingJam.endDate} size="lg" label="TEMPS RESTANT" />
            </div>
          </div>
        </div>
      ) : (
        <div
          className="p-8 border text-center"
          style={{ background: 'var(--card)', borderColor: 'var(--border)', borderStyle: 'dashed' }}
        >
          <p className="text-sm mb-3" style={{ color: 'var(--muted-foreground)' }}>
            Aucune jam en cours pour le moment.
          </p>
          <Link
            href="/explore"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
            style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
          >
            Explorer les jams <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Vérifier**

```bash
cd frontend && pnpm type-check
```
Attendu : 0 erreur.

- [ ] **Commit**

```bash
git add frontend/src/app/dashboard/page.tsx
git commit -m "FEAT Dashboard overview with real user stats from Appwrite"
```

---

## Task 7 : Page `/dashboard/participations`

**Fichiers :**
- Créer : `frontend/src/app/dashboard/participations/page.tsx`

- [ ] **Créer `frontend/src/app/dashboard/participations/page.tsx`**

```tsx
import { getUserParticipations } from '@/lib/actions/dashboard'
import Link from 'next/link'
import { ArrowRight, Trophy } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Mes participations' }

export default async function ParticipationsPage() {
  const { jams } = await getUserParticipations()

  return (
    <section aria-labelledby="participations-heading">
      <p className="text-[9px] tracking-widest uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
        Participant
      </p>
      <h1 id="participations-heading" className="text-2xl font-bold mb-6">Mes participations</h1>

      {/* Filtre En cours / Terminées — déféré Phase 1.5 (nécessite searchParams + Server Component).
          Phase 1 affiche toutes les participations sans filtre. */}

      {jams.length === 0 ? (
        <div
          className="p-8 border text-center"
          style={{ background: 'var(--card)', borderColor: 'var(--border)', borderStyle: 'dashed' }}
        >
          <Trophy size={32} className="mx-auto mb-3" style={{ color: 'var(--muted-foreground)' }} aria-hidden="true" />
          <p className="text-sm mb-4" style={{ color: 'var(--muted-foreground)' }}>
            Tu n&apos;as pas encore rejoint de jam.
          </p>
          <Link
            href="/explore"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            Explorer les jams <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" role="list">
          {jams.map(jam => (
            <li key={jam.id}>
              <div
                className="p-5 border h-full flex flex-col justify-between"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="text-[9px] tracking-widest uppercase px-2 py-1"
                      style={{
                        background: jam.status === 'ongoing' ? 'rgba(239,35,60,.1)' : 'var(--muted)',
                        color: jam.status === 'ongoing' ? 'var(--secondary)' : 'var(--muted-foreground)',
                      }}
                    >
                      {jam.status === 'ongoing' ? 'En cours' : jam.status === 'upcoming' ? 'À venir' : 'Terminée'}
                    </span>
                  </div>
                  <h2 className="font-bold text-base mb-1">{jam.title}</h2>
                  <p className="text-sm mb-3" style={{ color: 'var(--primary)' }}>Thème : {jam.theme}</p>
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    {jam.startDate.toLocaleDateString('fr-FR')} — {jam.endDate.toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <Link
                  href={`/jam/${jam.id}`}
                  className="inline-flex items-center gap-2 mt-4 text-sm font-semibold"
                  style={{ color: 'var(--primary)' }}
                >
                  Voir la jam <ArrowRight size={13} aria-hidden="true" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
```

- [ ] **Vérifier**

```bash
cd frontend && pnpm type-check
```

- [ ] **Commit**

```bash
git add frontend/src/app/dashboard/participations/
git commit -m "FEAT Add participations page with real Appwrite data"
```

---

## Task 8 : Page `/dashboard/team`

**Fichiers :**
- Créer : `frontend/src/app/dashboard/team/page.tsx`

- [ ] **Créer `frontend/src/app/dashboard/team/page.tsx`**

```tsx
import { getUserActiveTeam } from '@/lib/actions/dashboard'
import { Users } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Mon équipe' }

const ROLE_LABELS: Record<string, string> = {
  dev: 'Développeur',
  artist: 'Artiste',
  sound: 'Sound designer',
  designer: 'Designer',
  writer: 'Scénariste',
}

export default async function TeamPage() {
  const { team, members } = await getUserActiveTeam()

  return (
    <section aria-labelledby="team-heading">
      <p className="text-[9px] tracking-widest uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
        Participant
      </p>
      <h1 id="team-heading" className="text-2xl font-bold mb-6">Mon équipe</h1>

      {!team ? (
        <div
          className="p-8 border text-center"
          style={{ background: 'var(--card)', borderColor: 'var(--border)', borderStyle: 'dashed' }}
        >
          <Users size={32} className="mx-auto mb-3" style={{ color: 'var(--muted-foreground)' }} aria-hidden="true" />
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Tu n&apos;appartiens à aucune équipe pour le moment.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Infos équipe */}
          <div className="p-6 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <h2 className="text-xl font-bold mb-1">{team.name}</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--muted-foreground)' }}>
              {members.length} membre{members.length > 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-3">
              <span className="text-[9px] tracking-widest uppercase" style={{ color: 'var(--muted-foreground)' }}>
                Code d&apos;invitation
              </span>
              <code
                className="px-3 py-1.5 font-mono text-sm font-bold"
                style={{ background: 'var(--muted)', color: 'var(--foreground)' }}
              >
                {team.inviteCode}
              </code>
            </div>
          </div>

          {/* Membres */}
          <div>
            <h2 className="text-base font-bold mb-3">Membres</h2>
            <ul className="space-y-2" role="list">
              {members.map(member => (
                <li
                  key={member.id}
                  className="flex items-center justify-between px-4 py-3 border"
                  style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 flex items-center justify-center font-bold text-sm"
                      style={{ background: 'var(--muted)', color: 'var(--foreground)' }}
                      aria-hidden="true"
                    >
                      {member.name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{member.name}</p>
                      {member.isLeader && (
                        <p className="text-[9px] tracking-widest uppercase" style={{ color: 'var(--primary)' }}>
                          Chef d&apos;équipe
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    {ROLE_LABELS[member.role] ?? member.role}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Vérifier**

```bash
cd frontend && pnpm type-check
```

- [ ] **Commit**

```bash
git add frontend/src/app/dashboard/team/
git commit -m "FEAT Add team page showing active team members and invite code"
```

---

## Task 9 : Page `/dashboard/my-jams`

**Fichiers :**
- Créer : `frontend/src/app/dashboard/my-jams/page.tsx`

- [ ] **Créer `frontend/src/app/dashboard/my-jams/page.tsx`**

```tsx
import { getUserOrganizedJams } from '@/lib/actions/dashboard'
import Link from 'next/link'
import { Plus, ArrowRight, Gamepad2 } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Mes jams' }

const STATUS_LABEL: Record<string, string> = {
  upcoming: 'À venir',
  ongoing: 'En cours',
  ended: 'Terminée',
}

export default async function MyJamsPage() {
  const jams = await getUserOrganizedJams()

  return (
    <section aria-labelledby="my-jams-heading">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[9px] tracking-widest uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
            Organisateur
          </p>
          <h1 id="my-jams-heading" className="text-2xl font-bold">Mes jams</h1>
        </div>
        <Link
          href="/dashboard/my-jams/new"
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold"
          style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
        >
          <Plus size={15} aria-hidden="true" />
          Créer une jam
        </Link>
      </div>

      {jams.length === 0 ? (
        <div
          className="p-8 border text-center"
          style={{ background: 'var(--card)', borderColor: 'var(--border)', borderStyle: 'dashed' }}
        >
          <Gamepad2 size={32} className="mx-auto mb-3" style={{ color: 'var(--muted-foreground)' }} aria-hidden="true" />
          <p className="text-sm mb-4" style={{ color: 'var(--muted-foreground)' }}>
            Tu n&apos;as pas encore créé de jam.
          </p>
          <Link
            href="/dashboard/my-jams/new"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            <Plus size={14} aria-hidden="true" /> Créer ma première jam
          </Link>
        </div>
      ) : (
        <div className="border" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full text-sm" role="table">
            <thead>
              <tr style={{ background: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
                <th className="px-4 py-3 text-left text-[9px] tracking-widest uppercase font-semibold" style={{ color: 'var(--muted-foreground)' }}>Jam</th>
                <th className="px-4 py-3 text-left text-[9px] tracking-widest uppercase font-semibold" style={{ color: 'var(--muted-foreground)' }}>Statut</th>
                <th className="px-4 py-3 text-left text-[9px] tracking-widest uppercase font-semibold hidden md:table-cell" style={{ color: 'var(--muted-foreground)' }}>Fin</th>
                <th className="px-4 py-3 text-right text-[9px] tracking-widest uppercase font-semibold" style={{ color: 'var(--muted-foreground)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jams.map((jam, i) => (
                <tr
                  key={jam.id}
                  style={{
                    background: i % 2 === 0 ? 'var(--card)' : 'var(--background)',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold">{jam.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--primary)' }}>Thème : {jam.theme}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-[9px] tracking-widest uppercase px-2 py-1"
                      style={{
                        background: jam.status === 'ongoing' ? 'rgba(239,35,60,.1)' : 'var(--muted)',
                        color: jam.status === 'ongoing' ? 'var(--secondary)' : 'var(--muted-foreground)',
                      }}
                    >
                      {STATUS_LABEL[jam.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell" style={{ color: 'var(--muted-foreground)' }}>
                    {jam.endDate.toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/dashboard/my-jams/${jam.id}`}
                      className="inline-flex items-center gap-1 text-sm font-semibold"
                      style={{ color: 'var(--primary)' }}
                    >
                      Gérer <ArrowRight size={13} aria-hidden="true" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Vérifier**

```bash
cd frontend && pnpm type-check
```

- [ ] **Commit**

```bash
git add frontend/src/app/dashboard/my-jams/page.tsx
git commit -m "FEAT Add my-jams list page with table view"
```

---

## Task 10 : Page `/dashboard/my-jams/new` — Formulaire création

**Fichiers :**
- Créer : `frontend/src/app/dashboard/my-jams/new/page.tsx`

C'est un formulaire client avec état local — la soumission appelle la Server Action `createJam`.

- [ ] **Créer `frontend/src/app/dashboard/my-jams/new/page.tsx`**

```tsx
'use client'

// Note : ce composant est 'use client' — l'export de metadata ne fonctionne pas.
// Le titre de page utilise le template défini dans dashboard/layout.tsx : "Créer une jam | KonfiturGame"
// n'est pas disponible sans un wrapper Server Component. Accepté comme limitation Phase 1.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createJam } from '@/lib/actions/dashboard'
import { Plus, Trash2 } from 'lucide-react'

export default function NewJamPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [theme, setTheme] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<'solo' | 'team' | 'both'>('both')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [rules, setRules] = useState([''])
  const [prizes, setPrizes] = useState([''])
  const [tags, setTags] = useState('')

  const autoSlug = (v: string) =>
    v.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const start = new Date(startDate)
      const end = new Date(endDate)
      const diffH = Math.round((end.getTime() - start.getTime()) / 36e5)
      const duration = diffH >= 24 ? `${Math.round(diffH / 24)}j` : `${diffH}h`

      await createJam({
        title,
        slug: slug || autoSlug(title),
        theme,
        description,
        type,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        duration,
        rules: rules.filter(Boolean),
        prizes: prizes.filter(Boolean),
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      })

      router.push('/dashboard/my-jams')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    background: 'var(--input-background)',
    border: '1px solid var(--border)',
    color: 'var(--foreground)',
  }

  return (
    <section aria-labelledby="new-jam-heading">
      <p className="text-[9px] tracking-widest uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
        Organisateur
      </p>
      <h1 id="new-jam-heading" className="text-2xl font-bold mb-8">Créer une jam</h1>

      {error && (
        <div
          className="p-3 mb-6 text-sm"
          role="alert"
          style={{ background: 'rgba(239,35,60,.1)', border: '1px solid var(--secondary)', color: 'var(--secondary)' }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl" noValidate>

        {/* Titre */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium mb-2">Titre *</label>
          <input
            id="title" type="text" required value={title}
            onChange={e => { setTitle(e.target.value); setSlug(autoSlug(e.target.value)) }}
            className="w-full px-3 py-2.5 text-sm" style={inputStyle}
          />
        </div>

        {/* Slug */}
        <div>
          <label htmlFor="slug" className="block text-sm font-medium mb-2">Slug (URL)</label>
          <input
            id="slug" type="text" value={slug}
            onChange={e => setSlug(autoSlug(e.target.value))}
            className="w-full px-3 py-2.5 text-sm font-mono" style={inputStyle}
          />
          <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
            /jam/{slug || 'mon-slug'}
          </p>
        </div>

        {/* Thème */}
        <div>
          <label htmlFor="theme" className="block text-sm font-medium mb-2">Thème *</label>
          <input
            id="theme" type="text" required value={theme}
            onChange={e => setTheme(e.target.value)}
            className="w-full px-3 py-2.5 text-sm" style={inputStyle}
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium mb-2">Description *</label>
          <textarea
            id="description" required rows={4} value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full px-3 py-2.5 text-sm resize-y" style={inputStyle}
          />
        </div>

        {/* Type */}
        <div>
          <p className="block text-sm font-medium mb-2">Type de participation</p>
          <div className="flex gap-3">
            {(['solo', 'team', 'both'] as const).map(t => (
              <label key={t} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="type" value={t} checked={type === t} onChange={() => setType(t)} />
                <span className="text-sm capitalize">{t === 'both' ? 'Solo & Équipe' : t === 'team' ? 'Équipe' : 'Solo'}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium mb-2">Date de début *</label>
            <input
              id="startDate" type="datetime-local" required value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full px-3 py-2.5 text-sm" style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium mb-2">Date de fin *</label>
            <input
              id="endDate" type="datetime-local" required value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full px-3 py-2.5 text-sm" style={inputStyle}
            />
          </div>
        </div>

        {/* Règles */}
        <div>
          <p className="block text-sm font-medium mb-2">Règles</p>
          {rules.map((rule, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input
                type="text" value={rule} placeholder={`Règle ${i + 1}`}
                onChange={e => { const r = [...rules]; r[i] = e.target.value; setRules(r) }}
                className="flex-1 px-3 py-2 text-sm" style={inputStyle}
              />
              <button
                type="button"
                onClick={() => setRules(rules.filter((_, j) => j !== i))}
                className="px-2"
                style={{ color: 'var(--muted-foreground)' }}
                aria-label="Supprimer cette règle"
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setRules([...rules, ''])}
            className="flex items-center gap-2 text-sm"
            style={{ color: 'var(--primary)' }}
          >
            <Plus size={13} aria-hidden="true" /> Ajouter une règle
          </button>
        </div>

        {/* Prix */}
        <div>
          <p className="block text-sm font-medium mb-2">Prix</p>
          {prizes.map((prize, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input
                type="text" value={prize} placeholder={`${i + 1}ᵉ prix`}
                onChange={e => { const p = [...prizes]; p[i] = e.target.value; setPrizes(p) }}
                className="flex-1 px-3 py-2 text-sm" style={inputStyle}
              />
              <button
                type="button"
                onClick={() => setPrizes(prizes.filter((_, j) => j !== i))}
                className="px-2"
                style={{ color: 'var(--muted-foreground)' }}
                aria-label="Supprimer ce prix"
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setPrizes([...prizes, ''])}
            className="flex items-center gap-2 text-sm"
            style={{ color: 'var(--primary)' }}
          >
            <Plus size={13} aria-hidden="true" /> Ajouter un prix
          </button>
        </div>

        {/* Tags */}
        <div>
          <label htmlFor="tags" className="block text-sm font-medium mb-2">Tags (séparés par des virgules)</label>
          <input
            id="tags" type="text" value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="2D, Unity, Débutants bienvenus"
            className="w-full px-3 py-2.5 text-sm" style={inputStyle}
          />
        </div>

        {/* Submit */}
        <div className="flex gap-4 pt-2">
          <button
            type="submit"
            disabled={loading || !title || !theme || !description || !startDate || !endDate}
            className="px-6 py-3 font-bold text-sm disabled:opacity-50"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            {loading ? 'Création...' : 'Créer la jam'}
          </button>
          <a
            href="/dashboard/my-jams"
            className="px-6 py-3 font-bold text-sm"
            style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
          >
            Annuler
          </a>
        </div>
      </form>
    </section>
  )
}
```

- [ ] **Vérifier**

```bash
cd frontend && pnpm type-check
```

- [ ] **Commit**

```bash
git add frontend/src/app/dashboard/my-jams/new/
git commit -m "FEAT Add jam creation form with Server Action"
```

---

## Task 11 : Page `/dashboard/my-jams/[jamId]` — Gestion jam

**Fichiers :**
- Créer : `frontend/src/app/dashboard/my-jams/[jamId]/page.tsx`

- [ ] **Créer `frontend/src/app/dashboard/my-jams/[jamId]/page.tsx`**

```tsx
import { getOrganizedJamDetails } from '@/lib/actions/dashboard'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Users, Send } from 'lucide-react'
import type { Metadata } from 'next'

interface Props { params: { jamId: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `Gestion jam` }
}

export default async function ManageJamPage({ params }: Props) {
  let data: Awaited<ReturnType<typeof getOrganizedJamDetails>>
  try {
    data = await getOrganizedJamDetails(params.jamId)
  } catch {
    notFound()
  }
  const { jam, teams, projects } = data!

  return (
    <section aria-labelledby="manage-jam-heading">
      <Link
        href="/dashboard/my-jams"
        className="inline-flex items-center gap-2 text-sm mb-6"
        style={{ color: 'var(--muted-foreground)' }}
      >
        <ArrowLeft size={14} aria-hidden="true" /> Retour à mes jams
      </Link>

      <h1 id="manage-jam-heading" className="text-2xl font-bold mb-1">{jam.title}</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--primary)' }}>Thème : {jam.theme}</p>

      {/* Stats rapides */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="p-5 border flex items-center gap-4"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <Users size={24} style={{ color: 'var(--primary)' }} aria-hidden="true" />
          <div>
            <p className="text-2xl font-bold">{teams.length}</p>
            <p className="text-[9px] tracking-widest uppercase" style={{ color: 'var(--muted-foreground)' }}>Équipes</p>
          </div>
        </div>
        <div className="p-5 border flex items-center gap-4"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <Send size={24} style={{ color: 'var(--success)' }} aria-hidden="true" />
          <div>
            <p className="text-2xl font-bold">{projects.filter(p => p.submitted).length}</p>
            <p className="text-[9px] tracking-widest uppercase" style={{ color: 'var(--muted-foreground)' }}>Soumissions</p>
          </div>
        </div>
      </div>

      {/* Équipes */}
      <div className="mb-8">
        <h2 className="text-base font-bold mb-3">Équipes ({teams.length})</h2>
        {teams.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Aucune équipe inscrite.</p>
        ) : (
          <ul className="space-y-2" role="list">
            {teams.map(team => (
              <li key={team.id}
                className="px-4 py-3 border flex items-center justify-between"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <span className="font-semibold text-sm">{team.name}</span>
                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  Code : {team.inviteCode}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Projets soumis */}
      <div>
        <h2 className="text-base font-bold mb-3">
          Projets soumis ({projects.filter(p => p.submitted).length})
        </h2>
        {projects.filter(p => p.submitted).length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Aucun projet soumis.</p>
        ) : (
          <ul className="space-y-2" role="list">
            {projects.filter(p => p.submitted).map(project => (
              <li key={project.id}
                className="px-4 py-3 border"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <p className="font-semibold text-sm">{project.title}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                  {project.votesCount} vote{project.votesCount !== 1 ? 's' : ''}
                  {project.submissionDate && ` · Soumis le ${project.submissionDate.toLocaleDateString('fr-FR')}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Vérifier**

```bash
cd frontend && pnpm type-check
```

- [ ] **Commit**

```bash
git add frontend/src/app/dashboard/my-jams/[jamId]/
git commit -m "FEAT Add jam management page with teams and submissions"
```

---

## Task 12 : Middleware — vérification du matcher

**Fichiers :**
- Vérifier (aucune modification attendue) : `frontend/src/middleware.ts`

- [ ] **Vérifier que le matcher existant couvre toutes les nouvelles routes**

Ouvrir `frontend/src/middleware.ts` et confirmer que `config.matcher` contient `/dashboard/:path*` :

```ts
// Doit déjà être présent — NE PAS remplacer si c'est le cas
export const config = {
  matcher: ['/dashboard/:path*', '/auth/:path*'],
}
```

`/dashboard/:path*` couvre automatiquement toutes les sous-routes créées en Phase 1 (`/dashboard/participations`, `/dashboard/team`, `/dashboard/my-jams/*`). **Aucune modification du fichier n'est nécessaire.**

- [ ] **Vérifier que le matcher couvre toutes les nouvelles routes**

```bash
cd frontend && pnpm type-check
```

- [ ] **Test visuel final** — Naviguer sur toutes les pages du dashboard :
  - http://localhost:3000/dashboard ✓ stats perso
  - http://localhost:3000/dashboard/participations ✓ jams rejointes
  - http://localhost:3000/dashboard/team ✓ équipe
  - http://localhost:3000/dashboard/my-jams ✓ liste jams
  - http://localhost:3000/dashboard/my-jams/new ✓ formulaire
  - http://localhost:3000/auth/login → redirige vers /dashboard si connecté ✓

- [ ] **Build de vérification finale**

```bash
cd frontend && pnpm build
```
Attendu : build réussi sans erreur.

- [ ] **Commit final Phase 1**

```bash
git add -A
git commit -m "FEAT Phase 1 complete — Dashboard user redesign with Appwrite integration"
```

---

## Résumé Phase 1

| Section | Route | Données |
|---------|-------|---------|
| Vue d'ensemble | `/dashboard` | Stats perso + jam en cours (Appwrite) |
| Participations | `/dashboard/participations` | Jams rejointes via team_members |
| Équipe | `/dashboard/team` | Équipe active + membres |
| Mes jams | `/dashboard/my-jams` | Jams organisées |
| Créer une jam | `/dashboard/my-jams/new` | Formulaire → Server Action |
| Gérer une jam | `/dashboard/my-jams/[jamId]` | Équipes + soumissions |

**Phase 2** (Backoffice admin `/admin`) à planifier séparément après livraison de Phase 1.
