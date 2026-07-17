import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/appwrite/server', () => ({
  serverDatabases: {
    listDocuments: vi.fn(),
  },
}))

const SECRET = 'test-log-secret'

function makeRequest(secret?: string): NextRequest {
  const headers: Record<string, string> = {}
  if (secret !== undefined) headers['x-log-secret'] = secret
  return new NextRequest('http://localhost:3000/api/banned-ips', { headers })
}

// LOG_SECRET est lu au chargement du module → recharger route ET son mock après avoir
// stubé l'env (cf proxy.test.ts). vi.resetModules() ré-exécute aussi la factory vi.mock,
// donc le mock de serverDatabases doit être ré-importé pour rester le même objet.
async function loadRoute() {
  vi.resetModules()
  const { serverDatabases } = await import('@/lib/appwrite/server')
  const { GET } = await import('@/app/api/banned-ips/route')
  return { GET, mockList: vi.mocked(serverDatabases.listDocuments) }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('LOG_INTERNAL_SECRET', SECRET)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('GET /api/banned-ips', () => {
  it('refuse sans secret ou avec un secret invalide (401)', async () => {
    const { GET, mockList } = await loadRoute()
    const res = await GET(makeRequest('wrong'))
    expect(res.status).toBe(401)
    expect(mockList).not.toHaveBeenCalled()
  })

  it('retourne la liste complète des IPs bannies, sans plafond', async () => {
    const { GET, mockList } = await loadRoute()
    // 700 IPs, réparties sur 2 pages de curseur (fetchAllDocs page = 500)
    const allIps = Array.from({ length: 700 }, (_, i) => ({ $id: `ip${i}`, ip: `10.0.0.${i}` }))
    mockList.mockImplementation(async (_db: string, _col: string, queries: string[] = []) => {
      const hasCursor = queries.some(q => JSON.parse(q).method === 'cursorAfter')
      const documents = hasCursor ? allIps.slice(500) : allIps.slice(0, 500)
      return { total: allIps.length, documents } as never
    })

    const res = await GET(makeRequest(SECRET))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ips).toHaveLength(700)
  })

  it("renvoie 500 (échec bruyant) plutôt qu'une liste incomplète quand fetchAllDocs lève", async () => {
    const { GET, mockList } = await loadRoute()
    mockList.mockRejectedValue(new Error('Appwrite down'))

    const res = await GET(makeRequest(SECRET))

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })
})
