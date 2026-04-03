import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isBot, extractIP } from '@/lib/bot-detection'

const protectedRoutes = ['/dashboard', '/admin']
const authRoutes = ['/auth/login', '/auth/register']

// Chemins exclus du logging (assets, API interne, etc.)
const SKIP_PATTERNS = [
  /\/_next\//,
  /\/favicon/,
  /\.ico$/,
  /\.png$/,
  /\.svg$/,
  /\.css$/,
  /\.js$/,
  /^\/api\//,  // exclure /api/ pour éviter récursion
]

function shouldSkip(pathname: string): boolean {
  return SKIP_PATTERNS.some(p => p.test(pathname))
}

// ── Cache module-level des IPs bannies (TTL 2 minutes) ────────────────────
// Évite un appel Appwrite à chaque requête. Ne doit pas être partagé entre
// requêtes en production Edge — c'est intentionnel, chaque worker gère son cache.
let bannedIPsCache: { ips: Set<string>; expiresAt: number } | null = null

async function getBannedIPsCached(siteUrl: string): Promise<Set<string>> {
  const now = Date.now()
  if (bannedIPsCache && bannedIPsCache.expiresAt > now) {
    return bannedIPsCache.ips
  }
  try {
    // Appel direct à notre endpoint interne (exclu du matcher → pas de récursion)
    const res = await fetch(`${siteUrl}/api/banned-ips`, {
      headers: { 'x-log-secret': process.env.LOG_INTERNAL_SECRET ?? '' },
      signal: AbortSignal.timeout(1500),
    })
    if (res.ok) {
      const { ips } = await res.json()
      const ipSet = new Set<string>(ips as string[])
      bannedIPsCache = { ips: ipSet, expiresAt: now + 2 * 60 * 1000 }
      return ipSet
    }
  } catch {
    // Cache expiré mais Appwrite indisponible → laisser passer
  }
  return bannedIPsCache?.ips ?? new Set()
}

function logAsync(request: NextRequest, siteUrl: string, type: string, message?: string) {
  const ip = extractIP(request.headers)
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID
  const sessionCookie = projectId
    ? (request.cookies.get(`a_session_${projectId}`) ?? request.cookies.get(`a_session_${projectId}_legacy`))
    : null

  // Fire-and-forget — ne jamais await
  fetch(`${siteUrl}/api/log`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-log-secret': process.env.LOG_INTERNAL_SECRET ?? '',
    },
    body: JSON.stringify({
      type,
      ip,
      userAgent: request.headers.get('user-agent') ?? '',
      path: request.nextUrl.pathname,
      userId: sessionCookie ? 'authenticated' : undefined,
      message,
    }),
  }).catch(() => {/* log optionnel */})
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID
  const sessionCookie = projectId
    ? (request.cookies.get(`a_session_${projectId}`) ?? request.cookies.get(`a_session_${projectId}_legacy`))
    : null
  const isAuthenticated = !!sessionCookie

  // ── 1. Détection de bot (avant vérif ban — rapide, aucun I/O) ─────────────
  const userAgent = request.headers.get('user-agent') ?? ''
  if (!shouldSkip(pathname) && isBot(userAgent)) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    if (siteUrl) logAsync(request, siteUrl, 'bot_blocked', `Bot UA: ${userAgent.slice(0, 100)}`)
    return new NextResponse('Accès refusé', { status: 403 })
  }

  // ── 2. Vérifier si l'IP est bannie ────────────────────────────────────────
  const ip = extractIP(request.headers)
  if (ip !== 'unknown' && !shouldSkip(pathname)) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    if (siteUrl) {
      const bannedIPs = await getBannedIPsCached(siteUrl)
      if (bannedIPs.has(ip)) {
        return new NextResponse('Accès refusé', { status: 403 })
      }
    }
  }

  // ── 3. Routes protégées ───────────────────────────────────────────────────
  if (protectedRoutes.some(r => pathname.startsWith(r))) {
    if (!isAuthenticated) {
      const loginUrl = new URL('/auth/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  if (authRoutes.includes(pathname)) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  // ── 4. Logger les connexions (async, non bloquant) ────────────────────────
  if (!shouldSkip(pathname)) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    if (siteUrl) logAsync(request, siteUrl, 'connection')
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Exclure /api/ pour éviter la récursion middleware → /api/banned-ips → middleware
    '/dashboard/:path*',
    '/admin/:path*',
    '/auth/:path*',
    // Pages publiques pour le logging + détection bot
    '/((?!_next/static|_next/image|api|favicon.ico).*)',
  ],
}
