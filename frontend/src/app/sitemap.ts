import type { MetadataRoute } from 'next'
import { COLLECTIONS } from '@/lib/appwrite/config'
import { Query } from 'node-appwrite'
import { fetchAllDocs } from '@/lib/appwrite/fetch-all'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://konfiturgame.fr'

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

  let jamRoutes: MetadataRoute.Sitemap = []
  try {
    const jams = await fetchAllDocs(COLLECTIONS.GAME_JAMS, [
      Query.orderDesc('$updatedAt'),
    ])
    jamRoutes = jams.map(doc => {
      const d = doc as unknown as Record<string, string>
      return {
        url: `${siteUrl}/jam/${doc.$id}`,
        lastModified: new Date(doc.$updatedAt),
        changeFrequency: d.status === 'ongoing' ? 'hourly' : 'weekly' as 'hourly' | 'weekly',
        priority: d.status === 'ongoing' ? 0.9 : d.status === 'upcoming' ? 0.8 : 0.5,
      }
    })
  } catch {
    // sitemap partiel si Appwrite indisponible
  }

  let projectRoutes: MetadataRoute.Sitemap = []
  try {
    const projects = await fetchAllDocs(COLLECTIONS.PROJECTS, [
      Query.equal('submitted', true),
      Query.orderDesc('$updatedAt'),
    ])
    projectRoutes = projects.map(doc => {
      const d = doc as unknown as Record<string, unknown>
      return {
        url: `${siteUrl}/project/${doc.$id}`,
        lastModified: new Date(doc.$updatedAt),
        changeFrequency: 'weekly' as const,
        priority: ((d.placement as number) ?? 0) > 0 ? 0.7 : 0.5,
      }
    })
  } catch {
    // sitemap partiel
  }

  return [...staticRoutes, ...jamRoutes, ...projectRoutes]
}
