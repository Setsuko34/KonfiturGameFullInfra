import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const PROJECT_ID = 'test-project'
const SITE_URL = 'http://localhost:3000'
const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36'

const mockFetch = vi.fn()

function makeRequest(
  path: string,
  opts: { userAgent?: string; ip?: string; cookie?: 'standard' | 'legacy' } = {}
): NextRequest {
  const headers: Record<string, string> = { 'user-agent': opts.userAgent ?? CHROME_UA }
  if (opts.ip) headers['x-forwarded-for'] = opts.ip
  if (opts.cookie === 'standard') headers['cookie'] = `a_session_${PROJECT_ID}=abc123`
  if (opts.cookie === 'legacy') headers['cookie'] = `a_session_${PROJECT_ID}_legacy=abc123`
  return new NextRequest(`${SITE_URL}${path}`, { headers })
}

// Le cache des IPs bannies est module-level → module rechargé à chaque test
async function loadProxy() {
  vi.resetModules()
  const mod = await import('@/proxy')
  return mod.proxy
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_APPWRITE_PROJECT_ID', PROJECT_ID)
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', SITE_URL)
  vi.stubEnv('LOG_INTERNAL_SECRET', 'test-secret')
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
  // Par défaut : aucune IP bannie, log fire-and-forget OK
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ips: [] }) })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('proxy — détection de bots', () => {
  it('bloque un bot malveillant avec 403 et journalise bot_blocked', async () => {
    const proxy = await loadProxy()
    const res = await proxy(makeRequest('/', { userAgent: 'sqlmap/1.7' }))
    expect(res.status).toBe(403)
    // logAsync fire-and-forget vers /api/log
    const logCall = mockFetch.mock.calls.find(([url]) => String(url).includes('/api/log'))
    expect(logCall).toBeDefined()
    expect(JSON.parse(logCall![1].body as string).type).toBe('bot_blocked')
  })

  it('ne bloque pas un bot sur un chemin skippé (favicon)', async () => {
    const proxy = await loadProxy()
    const res = await proxy(makeRequest('/favicon.ico', { userAgent: 'curl/8.0' }))
    expect(res.status).toBe(200)
  })
})

describe('proxy — IPs bannies', () => {
  it("refuse une IP bannie avec 403", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ips: ['1.2.3.4'] }) })
    const proxy = await loadProxy()
    const res = await proxy(makeRequest('/', { ip: '1.2.3.4' }))
    expect(res.status).toBe(403)
  })

  it("laisse passer une IP non bannie", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ips: ['1.2.3.4'] }) })
    const proxy = await loadProxy()
    const res = await proxy(makeRequest('/', { ip: '5.6.7.8' }))
    expect(res.status).toBe(200)
  })

  it("laisse passer si l'endpoint banned-ips est indisponible (dégradation gracieuse)", async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'))
    const proxy = await loadProxy()
    const res = await proxy(makeRequest('/', { ip: '1.2.3.4' }))
    expect(res.status).toBe(200)
  })
})

describe('proxy — routes protégées', () => {
  it('/dashboard sans session → redirige vers /auth/login avec le param redirect', async () => {
    const proxy = await loadProxy()
    const res = await proxy(makeRequest('/dashboard'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(`${SITE_URL}/auth/login?redirect=%2Fdashboard`)
  })

  it('/admin sans session → redirige vers /auth/login', async () => {
    const proxy = await loadProxy()
    const res = await proxy(makeRequest('/admin'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/auth/login')
  })

  it('/dashboard avec cookie de session → passe', async () => {
    const proxy = await loadProxy()
    const res = await proxy(makeRequest('/dashboard', { cookie: 'standard' }))
    expect(res.status).toBe(200)
  })

  it('/dashboard avec cookie legacy → passe', async () => {
    const proxy = await loadProxy()
    const res = await proxy(makeRequest('/dashboard', { cookie: 'legacy' }))
    expect(res.status).toBe(200)
  })
})

describe('proxy — redirection des connectés depuis /auth/*', () => {
  it('/auth/login connecté → redirige vers /', async () => {
    const proxy = await loadProxy()
    const res = await proxy(makeRequest('/auth/login', { cookie: 'standard' }))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(`${SITE_URL}/`)
  })

  it('/auth/register connecté → redirige vers /', async () => {
    const proxy = await loadProxy()
    const res = await proxy(makeRequest('/auth/register', { cookie: 'standard' }))
    expect(res.status).toBe(307)
  })

  it('/auth/login non connecté → passe', async () => {
    const proxy = await loadProxy()
    const res = await proxy(makeRequest('/auth/login'))
    expect(res.status).toBe(200)
  })
})
