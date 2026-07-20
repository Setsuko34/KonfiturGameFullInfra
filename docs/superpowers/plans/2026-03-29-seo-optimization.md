# SEO Optimization — Plan d'Implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Améliorer le référencement de toute l'app KonfiturGame via un sitemap dynamique, robots.txt, des images OG générées dynamiquement, du JSON-LD structuré pour les jams et projets, et des métadonnées complètes sur toutes les pages publiques.

**Architecture:** Toutes les améliorations SEO s'appuient sur les APIs Next.js 14 natives — `generateMetadata`, `sitemap.ts`, `robots.ts`, et `next/og` pour les images. Les données JSON-LD sont générées par des fonctions pures testables dans `lib/seo.ts`. Aucune dépendance externe ajoutée.

**Tech Stack:** Next.js 14 App Router (Metadata API, OpenGraph image generation via `@vercel/og` inclus dans Next.js), TypeScript strict.

---

## Cartographie des fichiers

| Fichier | Action | Responsabilité |
|---------|--------|----------------|
| `frontend/src/lib/seo.ts` | Créer | Fonctions pures de génération JSON-LD (testables) |
| `frontend/src/__tests__/seo.test.ts` | Créer | Tests unitaires JSON-LD generators |
| `frontend/src/app/robots.ts` | Créer | Génère /robots.txt dynamiquement |
| `frontend/src/app/sitemap.ts` | Créer | Génère /sitemap.xml avec toutes les URLs publiques |
| `frontend/src/app/og/route.tsx` | Créer | Génère les images OG dynamiques pour jams et projets |
| `frontend/src/app/layout.tsx` | Modifier | Améliorer metadata de base (canonical, viewport, icons) |
| `frontend/src/app/page.tsx` | Modifier | Metadata complète page d'accueil |
| `frontend/src/app/explore/page.tsx` | Modifier | Ajouter generateMetadata |
| `frontend/src/app/jam/[jamId]/page.tsx` | Modifier | Améliorer metadata + ajouter JSON-LD Event |
| `frontend/src/app/project/[projectId]/page.tsx` | Modifier | Améliorer metadata + ajouter JSON-LD SoftwareApplication |
| `frontend/src/app/team/[teamId]/page.tsx` | Modifier | Ajouter generateMetadata |
| `frontend/src/app/auth/login/page.tsx` | Modifier | Ajouter noIndex |
| `frontend/src/app/auth/register/page.tsx` | Modifier | Ajouter noIndex |

> **Prérequis :** Si le Plan A a déjà configuré vitest, cette étape est déjà faite.

---

### Task 1 : Fonctions JSON-LD et tests

**Files:**
- Create: `frontend/src/lib/seo.ts`
- Create: `frontend/src/__tests__/seo.test.ts`

- [ ] **Step 1 : Écrire les tests JSON-LD**

Créer `frontend/src/__tests__/seo.test.ts` :

```typescript
import { describe, it, expect } from 'vitest'
import { generateJamJsonLd, generateProjectJsonLd, generateOrganizationJsonLd } from '@/lib/seo'
import type { GameJam, Project } from '@/types'

const mockJam: GameJam = {
  id: 'jam-1',
  title: 'Spring Jam 2026',
  slug: 'spring-jam-2026',
  theme: 'Printemps',
  description: 'Une jam printanière',
  status: 'upcoming',
  type: 'team',
  startDate: new Date('2026-04-01'),
  endDate: new Date('2026-04-07'),
  duration: '7 jours',
  participants: 42,
  rules: ['Règle 1'],
  organizer: 'KonfiturTeam',
  organizerId: 'org-1',
}

const mockProject: Project = {
  id: 'proj-1',
  jamId: 'jam-1',
  teamId: 'team-1',
  title: 'Pixel Garden',
  description: 'Un jeu de jardinage pixelisé',
  technologies: ['Unity', 'C#'],
  submitted: true,
  votesCount: 15,
}

describe('generateJamJsonLd', () => {
  it('retourne un objet avec @type Event', () => {
    const ld = generateJamJsonLd(mockJam, 'https://konfiturgame.fr')
    expect(ld['@type']).toBe('Event')
  })

  it('inclut le nom et la description', () => {
    const ld = generateJamJsonLd(mockJam, 'https://konfiturgame.fr')
    expect(ld.name).toBe(mockJam.title)
    expect(ld.description).toBe(mockJam.description)
  })

  it('inclut les dates ISO', () => {
    const ld = generateJamJsonLd(mockJam, 'https://konfiturgame.fr')
    expect(ld.startDate).toBe('2026-04-01T00:00:00.000Z')
    expect(ld.endDate).toBe('2026-04-07T00:00:00.000Z')
  })

  it('inclut l\'URL canonique', () => {
    const ld = generateJamJsonLd(mockJam, 'https://konfiturgame.fr')
    expect(ld.url).toBe(`https://konfiturgame.fr/jam/${mockJam.id}`)
  })

  it('indique eventStatus online pour une jam à venir', () => {
    const ld = generateJamJsonLd(mockJam, 'https://konfiturgame.fr')
    expect(ld.eventStatus).toContain('EventScheduled')
  })
})

describe('generateProjectJsonLd', () => {
  it('retourne un objet avec @type SoftwareApplication', () => {
    const ld = generateProjectJsonLd(mockProject, 'https://konfiturgame.fr')
    expect(ld['@type']).toBe('SoftwareApplication')
  })

  it('inclut le nom et la description', () => {
    const ld = generateProjectJsonLd(mockProject, 'https://konfiturgame.fr')
    expect(ld.name).toBe(mockProject.title)
    expect(ld.description).toBe(mockProject.description)
  })
})

describe('generateOrganizationJsonLd', () => {
  it('retourne un objet Organization', () => {
    const ld = generateOrganizationJsonLd('https://konfiturgame.fr')
    expect(ld['@type']).toBe('Organization')
    expect(ld.name).toBe('KonfiturGame')
    expect(ld.url).toBe('https://konfiturgame.fr')
  })
})
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

```bash
cd frontend && pnpm test
```

Attendu : FAIL — `Cannot find module '@/lib/seo'`

- [ ] **Step 3 : Créer `frontend/src/lib/seo.ts`**

```typescript
// ═══════════════════════════════════════════════════════════
// Générateurs JSON-LD pour le SEO structuré
// Fonctions pures — aucun I/O, aucune dépendance externe
// ═══════════════════════════════════════════════════════════

import type { GameJam, Project } from '@/types'

type JsonLdObject = Record<string, unknown>

export function generateOrganizationJsonLd(siteUrl: string): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'KonfiturGame',
    url: siteUrl,
    description: 'La plateforme française de game jams. Crée, jam, ship.',
    sameAs: [],
  }
}

export function generateJamJsonLd(jam: GameJam, siteUrl: string): JsonLdObject {
  const eventStatusMap = {
    upcoming: 'https://schema.org/EventScheduled',
    ongoing: 'https://schema.org/EventScheduled',
    ended: 'https://schema.org/EventCompleted',
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: jam.title,
    description: jam.description,
    startDate: jam.startDate.toISOString(),
    endDate: jam.endDate.toISOString(),
    url: `${siteUrl}/jam/${jam.id}`,
    eventStatus: eventStatusMap[jam.status],
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    location: {
      '@type': 'VirtualLocation',
      url: `${siteUrl}/jam/${jam.id}`,
    },
    organizer: {
      '@type': 'Person',
      name: jam.organizer,
    },
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'EUR',
      availability: jam.status === 'ended'
        ? 'https://schema.org/Discontinued'
        : 'https://schema.org/InStock',
    },
    ...(jam.tags && jam.tags.length > 0 ? { keywords: jam.tags.join(', ') } : {}),
  }
}

export function generateProjectJsonLd(project: Project, siteUrl: string): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: project.title,
    description: project.description,
    url: `${siteUrl}/project/${project.id}`,
    applicationCategory: 'GameApplication',
    ...(project.technologies && project.technologies.length > 0
      ? { programmingLanguage: project.technologies }
      : {}),
    ...(project.repoUrl ? { codeRepository: project.repoUrl } : {}),
    ...(project.downloadUrl ? { downloadUrl: project.downloadUrl } : {}),
    aggregateRating: project.votesCount > 0
      ? {
          '@type': 'AggregateRating',
          ratingCount: project.votesCount,
          ratingValue: project.winner ? 5 : 4,
          bestRating: 5,
        }
      : undefined,
  }
}

// ── Helpers OpenGraph ──────────────────────────────────────────────────────

export function truncateDescription(text: string, maxLength = 160): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + '...'
}
```

- [ ] **Step 4 : Lancer les tests**

```bash
cd frontend && pnpm test
```

Attendu : ✅ tous les tests SEO passent

- [ ] **Step 5 : Commit**

```bash
git add frontend/src/lib/seo.ts frontend/src/__tests__/seo.test.ts
git commit -m "feat: fonctions JSON-LD SEO (Event, SoftwareApplication, Organization)"
```

---

### Task 2 : robots.ts et sitemap.ts

**Files:**
- Create: `frontend/src/app/robots.ts`
- Create: `frontend/src/app/sitemap.ts`

- [ ] **Step 1 : Créer `frontend/src/app/robots.ts`**

```typescript
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://konfiturgame.fr'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard/',
          '/admin/',
          '/api/',
          '/auth/',
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  }
}
```

- [ ] **Step 2 : Créer `frontend/src/app/sitemap.ts`**

```typescript
import type { MetadataRoute } from 'next'
import { serverDatabases } from '@/lib/appwrite/server'
import { DATABASE_ID, COLLECTIONS } from '@/lib/appwrite/config'
import { Query } from 'node-appwrite'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://konfiturgame.fr'

  // Pages statiques
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${siteUrl}/explore`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.9,
    },
  ]

  // Jams publiques
  // Note: Appwrite limite à 100 documents par requête. Avec un faible volume de jams,
  // Query.limit(100) est suffisant. Si > 100 jams, implémenter la pagination.
  let jamRoutes: MetadataRoute.Sitemap = []
  try {
    const jams = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.GAME_JAMS, [
      Query.orderDesc('$updatedAt'),
      Query.limit(100),
    ])
    jamRoutes = jams.documents.map(doc => ({
      url: `${siteUrl}/jam/${doc.$id}`,
      lastModified: new Date(doc.$updatedAt),
      changeFrequency: doc.status === 'ongoing' ? 'hourly' : 'weekly' as 'hourly' | 'weekly',
      priority: doc.status === 'ongoing' ? 0.9 : doc.status === 'upcoming' ? 0.8 : 0.5,
    }))
  } catch {
    // sitemap partiel si Appwrite indisponible
  }

  // Projets soumis
  // Note: Query.limit(100) — si > 100 projets, implémenter la pagination avec Query.offset.
  let projectRoutes: MetadataRoute.Sitemap = []
  try {
    const projects = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.PROJECTS, [
      Query.equal('submitted', true),
      Query.orderDesc('$updatedAt'),
      Query.limit(100),
    ])
    projectRoutes = projects.documents.map(doc => ({
      url: `${siteUrl}/project/${doc.$id}`,
      lastModified: new Date(doc.$updatedAt),
      changeFrequency: 'weekly' as const,
      priority: doc.winner ? 0.7 : 0.5,
    }))
  } catch {
    // sitemap partiel
  }

  return [...staticRoutes, ...jamRoutes, ...projectRoutes]
}
```

- [ ] **Step 3 : Vérifier le type-check**

```bash
cd frontend && pnpm type-check
```

Attendu : aucune erreur

- [ ] **Step 4 : Vérifier robots.txt en dev**

```bash
# Avec l'app démarrée (docker compose up)
curl http://localhost:3000/robots.txt
```

Attendu : fichier robots.txt avec les disallow

- [ ] **Step 5 : Commit**

```bash
git add frontend/src/app/robots.ts frontend/src/app/sitemap.ts
git commit -m "feat: robots.txt et sitemap.xml dynamiques"
```

---

### Task 3 : Route Open Graph image

**Files:**
- Create: `frontend/src/app/og/route.tsx`

- [ ] **Step 1 : Créer `frontend/src/app/og/route.tsx`**

Cette route génère des images OG 1200×630 pour les jams et projets.
URL : `/og?type=jam&title=Titre&theme=Thème&status=ongoing`
URL : `/og?type=project&title=Titre&jam=Nom+de+la+jam`

```tsx
import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') ?? 'default'
  const title = searchParams.get('title') ?? 'KonfiturGame'
  const subtitle = searchParams.get('theme') ?? searchParams.get('jam') ?? ''
  const status = searchParams.get('status') ?? ''

  const statusLabel: Record<string, string> = {
    ongoing: 'EN COURS',
    upcoming: 'À VENIR',
    ended: 'TERMINÉ',
  }

  const accentColor = status === 'ongoing' ? '#EF233C' : '#4F6AFF'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#0C1018',
          padding: '48px',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Bordure accent top */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: accentColor,
        }} />

        {/* Brand */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: 'auto',
        }}>
          <span style={{ fontSize: '14px', color: '#4F6AFF', fontWeight: '700', letterSpacing: '4px' }}>
            KONFITURGAME
          </span>
          {status && (
            <span style={{
              fontSize: '11px',
              color: accentColor,
              fontWeight: '700',
              letterSpacing: '3px',
              marginLeft: '16px',
            }}>
              {statusLabel[status]}
            </span>
          )}
        </div>

        {/* Titre principal */}
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto' }}>
          {subtitle && (
            <span style={{
              fontSize: '22px',
              color: '#4F6AFF',
              fontWeight: '600',
              marginBottom: '12px',
              letterSpacing: '1px',
            }}>
              {type === 'jam' ? `Thème : ${subtitle}` : subtitle}
            </span>
          )}
          <span style={{
            fontSize: title.length > 40 ? '48px' : '64px',
            fontWeight: '700',
            color: '#FFFFFF',
            lineHeight: '1.1',
            letterSpacing: '-1px',
          }}>
            {title}
          </span>
          <span style={{
            fontSize: '16px',
            color: '#6B7280',
            marginTop: '16px',
            letterSpacing: '2px',
          }}>
            La plateforme française de game jams
          </span>
        </div>

        {/* Grid decoration */}
        <div style={{
          position: 'absolute',
          right: '48px',
          top: '48px',
          bottom: '48px',
          width: '200px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          opacity: 0.08,
        }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{
              height: '1px',
              background: '#FFFFFF',
              width: i % 2 === 0 ? '100%' : '60%',
            }} />
          ))}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
```

- [ ] **Step 2 : Vérifier en dev**

```bash
# Avec l'app démarrée
curl -o /tmp/og-test.png "http://localhost:3000/og?type=jam&title=Spring+Jam+2026&theme=Printemps&status=upcoming"
# Ouvrir /tmp/og-test.png pour vérifier visuellement
```

- [ ] **Step 3 : Commit**

```bash
git add frontend/src/app/og/route.tsx
git commit -m "feat: route OG image dynamique (/og)"
```

---

### Task 4 : Améliorer `layout.tsx` (metadata de base)

**Files:**
- Modify: `frontend/src/app/layout.tsx`

- [ ] **Step 1 : Enrichir la metadata dans `layout.tsx`**

Remplacer le bloc `metadata` existant par :

```typescript
export const metadata: Metadata = {
  title: {
    default: 'KonfiturGame — Plateforme Game Jam',
    template: '%s | KonfiturGame',
  },
  description: 'La plateforme française de game jams. Crée, jam, ship.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  keywords: ['game jam', 'jeu vidéo', 'développement jeu', 'indie game', 'france', 'création jeux'],
  authors: [{ name: 'KonfiturGame' }],
  creator: 'KonfiturGame',
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    siteName: 'KonfiturGame',
    images: [{ url: '/og', width: 1200, height: 630, alt: 'KonfiturGame' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@KonfiturGame',
    images: ['/og'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  alternates: {
    canonical: '/',
  },
}
```

Ajouter dans le `<html>` la balise `viewport` (si pas déjà présente via Next.js 14) — avec Next.js 14, le viewport est géré automatiquement, rien à faire manuellement.

- [ ] **Step 2 : Vérifier le type-check**

```bash
cd frontend && pnpm type-check
```

Attendu : aucune erreur

- [ ] **Step 3 : Commit**

```bash
git add frontend/src/app/layout.tsx
git commit -m "feat: enrichir metadata de base dans layout.tsx"
```

---

### Task 5 : Metadata et JSON-LD pour les pages de jams

**Files:**
- Modify: `frontend/src/app/jam/[jamId]/page.tsx`

- [ ] **Step 1 : Améliorer `generateMetadata` dans la page jam**

Remplacer la fonction `generateMetadata` existante par :

```typescript
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const jam = await getJamById(params.jamId)
  if (!jam) return { title: 'Jam introuvable', robots: { index: false } }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://konfiturgame.fr'
  const ogUrl = `/og?type=jam&title=${encodeURIComponent(jam.title)}&theme=${encodeURIComponent(jam.theme)}&status=${jam.status}`

  return {
    title: jam.title,
    description: truncateDescription(jam.description),
    keywords: jam.tags ?? [],
    openGraph: {
      title: jam.title,
      description: truncateDescription(jam.description),
      type: 'website',
      url: `${siteUrl}/jam/${jam.id}`,
      images: [{ url: ogUrl, width: 1200, height: 630, alt: jam.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: jam.title,
      description: truncateDescription(jam.description),
      images: [ogUrl],
    },
    alternates: {
      canonical: `/jam/${jam.id}`,
    },
  }
}
```

Ajouter l'import :
```typescript
import { generateJamJsonLd, truncateDescription } from '@/lib/seo'
```

- [ ] **Step 2 : Ajouter le JSON-LD dans la page jam**

Dans le `return` de `JamPage`, après `<Header />`, avant la div hero, ajouter :

```tsx
{/* JSON-LD structuré */}
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify(generateJamJsonLd(jam, process.env.NEXT_PUBLIC_SITE_URL || 'https://konfiturgame.fr')),
  }}
/>
```

- [ ] **Step 3 : Vérifier le type-check**

```bash
cd frontend && pnpm type-check
```

Attendu : aucune erreur

- [ ] **Step 4 : Commit**

```bash
git add "frontend/src/app/jam/[jamId]/page.tsx"
git commit -m "feat: metadata riche et JSON-LD Event pour les pages de jams"
```

---

### Task 6 : Metadata et JSON-LD pour les pages de projets

**Files:**
- Modify: `frontend/src/app/project/[projectId]/page.tsx`

- [ ] **Step 1 : Lire le fichier existant**

```bash
cat frontend/src/app/project/[projectId]/page.tsx | head -30
```

- [ ] **Step 2 : Améliorer/ajouter `generateMetadata`**

Si la fonction existe, l'améliorer avec le même pattern (OG image, twitter, canonical).
Ajouter l'import de `generateProjectJsonLd` et `truncateDescription` depuis `@/lib/seo`.

Structure cible :

```typescript
import { generateProjectJsonLd, truncateDescription } from '@/lib/seo'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const project = await getProjectById(params.projectId)
  if (!project) return { title: 'Projet introuvable', robots: { index: false } }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://konfiturgame.fr'
  const ogUrl = `/og?type=project&title=${encodeURIComponent(project.title)}`

  return {
    title: project.title,
    description: truncateDescription(project.description),
    keywords: project.technologies,
    openGraph: {
      title: project.title,
      description: truncateDescription(project.description),
      type: 'website',
      url: `${siteUrl}/project/${project.id}`,
      images: [{ url: ogUrl, width: 1200, height: 630, alt: project.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: project.title,
      description: truncateDescription(project.description),
      images: [ogUrl],
    },
    alternates: { canonical: `/project/${project.id}` },
  }
}
```

Ajouter dans le return le script JSON-LD :

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify(generateProjectJsonLd(project, process.env.NEXT_PUBLIC_SITE_URL || 'https://konfiturgame.fr')),
  }}
/>
```

- [ ] **Step 3 : Vérifier le type-check**

```bash
cd frontend && pnpm type-check
```

Attendu : aucune erreur

- [ ] **Step 4 : Commit**

```bash
git add "frontend/src/app/project/[projectId]/page.tsx"
git commit -m "feat: metadata riche et JSON-LD SoftwareApplication pour les projets"
```

---

### Task 7 : Metadata pour les pages restantes

**Files:**
- Modify: `frontend/src/app/explore/page.tsx`
- Modify: `frontend/src/app/team/[teamId]/page.tsx`
- Modify: `frontend/src/app/auth/login/page.tsx`
- Modify: `frontend/src/app/auth/register/page.tsx`
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1 : Explore page — ajouter/améliorer metadata**

Dans `frontend/src/app/explore/page.tsx`, ajouter ou remplacer le bloc metadata :

```typescript
export const metadata: Metadata = {
  title: 'Explorer les jams',
  description: 'Découvre toutes les game jams disponibles sur KonfiturGame — en cours, à venir, terminées.',
  openGraph: {
    title: 'Explorer les jams | KonfiturGame',
    description: 'Toutes les game jams sur la plateforme française.',
    images: [{ url: '/og?title=Explorer+les+jams', width: 1200, height: 630 }],
  },
  alternates: { canonical: '/explore' },
}
```

- [ ] **Step 2 : Team page — ajouter generateMetadata**

Dans `frontend/src/app/team/[teamId]/page.tsx`, lire le fichier puis ajouter :

```typescript
export async function generateMetadata({ params }: { params: { teamId: string } }): Promise<Metadata> {
  // Récupère le nom de l'équipe si possible
  try {
    const doc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.TEAMS, params.teamId)
    return { title: `Équipe ${doc.name}`, alternates: { canonical: `/team/${params.teamId}` } }
  } catch {
    return { title: 'Équipe', robots: { index: false } }
  }
}
```

- [ ] **Step 3 : Auth pages — ajouter noIndex**

Dans `frontend/src/app/auth/login/page.tsx`, ajouter ou remplacer la metadata :

```typescript
export const metadata: Metadata = {
  title: 'Connexion',
  robots: { index: false, follow: false },
}
```

Dans `frontend/src/app/auth/register/page.tsx` :

```typescript
export const metadata: Metadata = {
  title: 'Inscription',
  robots: { index: false, follow: false },
}
```

- [ ] **Step 4 : Page d'accueil — enrichir l'OG image**

Dans `frontend/src/app/page.tsx`, remplacer la metadata existante :

```typescript
export const metadata: Metadata = {
  title: 'KonfiturGame — Plateforme Game Jam',
  description: 'La plateforme française de game jams. Crée, jam, ship.',
  openGraph: {
    title: 'KonfiturGame — Plateforme Game Jam',
    description: 'La plateforme française de game jams. Crée, jam, ship.',
    images: [{ url: '/og?title=CRÉE.+JAM.+SHIP_', width: 1200, height: 630, alt: 'KonfiturGame' }],
  },
  alternates: { canonical: '/' },
}
```

- [ ] **Step 5 : Vérifier le type-check**

```bash
cd frontend && pnpm type-check
```

Attendu : aucune erreur

- [ ] **Step 6 : Commit**

```bash
git add frontend/src/app/explore/page.tsx \
        "frontend/src/app/team/[teamId]/page.tsx" \
        frontend/src/app/auth/login/page.tsx \
        frontend/src/app/auth/register/page.tsx \
        frontend/src/app/page.tsx
git commit -m "feat: metadata SEO complète sur toutes les pages publiques"
```

---

### Task 8 : JSON-LD Organization sur la page d'accueil

**Files:**
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1 : Ajouter le JSON-LD Organization dans `page.tsx`**

Importer `generateOrganizationJsonLd` depuis `@/lib/seo` et ajouter dans le return de `HomePage`, juste après `<Header />` :

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify(generateOrganizationJsonLd(
      process.env.NEXT_PUBLIC_SITE_URL || 'https://konfiturgame.fr'
    )),
  }}
/>
```

- [ ] **Step 2 : Vérifier le type-check**

```bash
cd frontend && pnpm type-check
```

- [ ] **Step 3 : Commit**

```bash
git add frontend/src/app/page.tsx
git commit -m "feat: JSON-LD Organization sur la page d'accueil"
```

---

### Task 9 : Vérification finale SEO

- [ ] **Lancer tous les tests**

```bash
cd frontend && pnpm test
```

Attendu : ✅ tous les tests passent

- [ ] **Type-check complet**

```bash
cd frontend && pnpm type-check
```

Attendu : 0 erreur

- [ ] **Build production**

```bash
cd frontend && pnpm build
```

Attendu : build sans erreur

- [ ] **Vérifier les URLs SEO**

```bash
# Avec l'app démarrée
curl -s http://localhost:3000/robots.txt
curl -s http://localhost:3000/sitemap.xml | head -30
curl -o /tmp/og.png "http://localhost:3000/og?type=jam&title=Test+Jam&theme=Pixel&status=ongoing"
```

- [ ] **Valider avec Google Rich Results Test**

Naviguer vers une page jam publique, copier l'HTML et tester sur https://search.google.com/test/rich-results (nécessite l'accès externe ou ngrok).

---

## Priorisation des gains SEO

| Amélioration | Impact estimé | Complexité |
|--------------|---------------|------------|
| `sitemap.xml` dynamique | Très élevé | Faible |
| `robots.txt` | Élevé | Très faible |
| `generateMetadata` complet | Élevé | Faible |
| OG images dynamiques | Moyen (réseaux sociaux) | Faible |
| JSON-LD Event (jams) | Élevé (résultats enrichis Google) | Faible |
| JSON-LD SoftwareApplication | Moyen | Faible |
| noIndex auth pages | Faible (hygiène) | Très faible |
