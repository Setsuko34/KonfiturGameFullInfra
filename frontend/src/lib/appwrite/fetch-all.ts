import { Query, type Models } from 'node-appwrite'
import { serverDatabases } from '@/lib/appwrite/server'
import { DATABASE_ID } from '@/lib/appwrite/config'

const PAGE = 500          // réglage de performance, pas un plafond de correction.
                          // Mesuré sur 502 docs : page 500 = +10% vs une requête unique,
                          // page 100 = +120%. Ne pas copier le 100 de sitemap.ts.
export const FILTER_MAX = 100    // mesuré : Appwrite refuse un filtre de plus de 100 valeurs
const SAFETY_CAP = 10_000 // garde-fou anti-explosion mémoire : lève, ne tronque pas

/**
 * Récupère TOUS les documents correspondants, en paginant au curseur.
 * T par défaut = Models.DefaultDocument (indexable) : suffit à la plupart des appels sans
 * cast local. Passer un T plus précis (ex. AppwriteDoc) si un typage plus strict est utile.
 */
export async function fetchAllDocs<T extends Models.Document = Models.DefaultDocument>(
  collection: string,
  queries: string[] = [],
): Promise<T[]> {
  const all: T[] = []
  let cursor: string | null = null

  for (;;) {
    const q = [...queries, Query.limit(PAGE)]
    if (cursor) q.push(Query.cursorAfter(cursor))

    const { documents } = await serverDatabases.listDocuments<T>(DATABASE_ID, collection, q)
    all.push(...documents)

    if (documents.length < PAGE) return all
    if (all.length >= SAFETY_CAP) {
      throw new Error(`fetchAllDocs: ${collection} dépasse SAFETY_CAP (${SAFETY_CAP}), résultat refusé plutôt que tronqué`)
    }
    cursor = documents[documents.length - 1].$id
  }
}

/** Idem, filtré sur une liste de valeurs, découpée en lots que le filtre accepte. */
export async function fetchAllByField<T extends Models.Document = Models.DefaultDocument>(
  collection: string,
  field: string,
  values: string[],
  queries: string[] = [],
): Promise<T[]> {
  if (values.length === 0) return []   // Query.limit(0) est refusé, et une requête vide est inutile
  const out: T[] = []
  for (let i = 0; i < values.length; i += FILTER_MAX) {
    const chunk = values.slice(i, i + FILTER_MAX)
    out.push(...await fetchAllDocs<T>(collection, [...queries, Query.equal(field, chunk)]))
  }
  return out
}
