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
  // Note: Query.limit(100) suffit pour le volume actuel.
  // Si > 100 jams, implémenter la pagination avec Query.offset.
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
