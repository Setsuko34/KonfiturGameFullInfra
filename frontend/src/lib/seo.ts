// ═══════════════════════════════════════════════════════════
// Générateurs JSON-LD pour le SEO structuré
// Fonctions pures — aucun I/O, aucune dépendance externe
// ═══════════════════════════════════════════════════════════

import type { GameJam, Project } from '@/types'

type JsonLdObject = Record<string, unknown>

// Sérialise un objet JSON-LD pour injection dans un <script>.
// Échappe `<` en `<` : sans cela, un titre de jam/projet contenant
// `</script>` casserait le tag et permettrait une injection XSS.
export function serializeJsonLd(jsonLd: JsonLdObject): string {
  return JSON.stringify(jsonLd).replace(/</g, '\\u003c')
}

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
    aggregateRating: project.likesCount > 0
      ? {
          '@type': 'AggregateRating',
          ratingCount: project.likesCount,
          ratingValue: (project.placement ?? 0) > 0 ? 5 : 4,
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
