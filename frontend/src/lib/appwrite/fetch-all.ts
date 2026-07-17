import { Query, type Models } from 'node-appwrite'
import { serverDatabases } from '@/lib/appwrite/server'
import { DATABASE_ID } from '@/lib/appwrite/config'

const PAGE = 500          // réglage de performance, pas un plafond de correction.
                          // Mesuré sur 502 docs : page 500 = +10% vs une requête unique,
                          // page 100 = +120%. Ne pas copier le 100 de sitemap.ts.
const FILTER_MAX = 100    // mesuré : Appwrite refuse un filtre de plus de 100 valeurs
const SAFETY_CAP = 10_000 // garde-fou anti-explosion mémoire : lève, ne tronque pas

/** Récupère TOUS les documents correspondants, en paginant au curseur. */
export async function fetchAllDocs(
  collection: string,
  queries: string[] = [],
): Promise<Models.Document[]> {
  const all: Models.Document[] = []
  let cursor: string | null = null

  for (;;) {
    const q = [...queries, Query.limit(PAGE)]
    if (cursor) q.push(Query.cursorAfter(cursor))

    const { documents } = await serverDatabases.listDocuments(DATABASE_ID, collection, q)
    all.push(...documents)

    if (documents.length < PAGE) return all
    if (all.length >= SAFETY_CAP) {
      throw new Error(`fetchAllDocs: ${collection} dépasse SAFETY_CAP (${SAFETY_CAP}), résultat refusé plutôt que tronqué`)
    }
    cursor = documents[documents.length - 1].$id
  }
}

/** Idem, filtré sur une liste de valeurs, découpée en lots que le filtre accepte. */
export async function fetchAllByField(
  collection: string,
  field: string,
  values: string[],
  queries: string[] = [],
): Promise<Models.Document[]> {
  if (values.length === 0) return []   // Query.limit(0) est refusé, et une requête vide est inutile
  const out: Models.Document[] = []
  for (let i = 0; i < values.length; i += FILTER_MAX) {
    const chunk = values.slice(i, i + FILTER_MAX)
    out.push(...await fetchAllDocs(collection, [...queries, Query.equal(field, chunk)]))
  }
  return out
}
