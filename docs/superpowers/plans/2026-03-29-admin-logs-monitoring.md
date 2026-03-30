# Admin Logs & Monitoring — Plan d'Implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fournir à l'admin une visibilité sur les erreurs/crashes, les connexions utilisateur avec statistiques géographiques (par pays), et un mécanisme de détection + bannissement automatique des bots qui scannent l'app.

**Architecture:** Deux collections Appwrite nouvelles — `audit_logs` (events connexion/erreur) et `banned_ips` (IPs bloquées). Une API route Next.js `/api/log` reçoit les events asynchronement depuis le middleware et les Server Actions. La détection de bot opère sur les User-Agents connus et le taux de requêtes par IP. Le middleware vérifie les IPs bannies via une liste mise en cache (TTL 2 minutes) côté Next.js.

**Tech Stack:** Next.js 14 App Router, node-appwrite 13, `ip-api.com` (gratuit, sans clé, géolocalisation IP), Tailwind CSS v4.

---

## Cartographie des fichiers

| Fichier | Action | Responsabilité |
|---------|--------|----------------|
| `frontend/src/lib/appwrite/config.ts` | Modifier | Ajouter `AUDIT_LOGS` et `BANNED_IPS` aux collections |
| `frontend/src/lib/bot-detection.ts` | Créer | Détection bot via User-Agent (pur, testable) |
| `frontend/src/app/api/log/route.ts` | Créer | API route POST — reçoit et stocke les events de log |
| `frontend/src/app/api/banned-ips/route.ts` | Créer | API route GET — retourne la liste des IPs bannies (mise en cache ISR) |
| `frontend/src/middleware.ts` | Modifier | Vérifier IP bannie + déclencher logging async |
| `frontend/src/lib/actions/logs.ts` | Créer | Server Actions admin : lire logs, lire IPs bannies, ajouter/supprimer ban |
| `frontend/src/app/admin/logs/page.tsx` | Créer | Page admin — tableau logs + stats pays + gestion IPs bannies |
| `frontend/src/app/admin/AdminSidebar.tsx` | Modifier | Ajouter lien "Logs" |
| `frontend/src/__tests__/bot-detection.test.ts` | Créer | Tests unitaires détection bot |
| `scripts/create-log-collections.sh` | Créer | Script bash pour créer les collections Appwrite via REST |

> **Prérequis :** Si le Plan A a déjà configuré vitest, cette étape est déjà faite.

---

### Task 1 : Setup collections Appwrite

**Files:**
- Modify: `frontend/src/lib/appwrite/config.ts`
- Create: `scripts/create-log-collections.sh`

- [ ] **Step 1 : Ajouter les IDs des nouvelles collections dans `config.ts`**

```typescript
export const COLLECTIONS = {
  GAME_JAMS: 'game_jams',
  TEAMS: 'teams',
  TEAM_MEMBERS: 'team_members',
  PROJECTS: 'projects',
  CHAT_MESSAGES: 'chat_messages',
  ANNOUNCEMENTS: 'announcements',
  COMMENTS: 'comments',
  VOTES: 'votes',
  AUDIT_LOGS: 'audit_logs',
  BANNED_IPS: 'banned_ips',
} as const
```

- [ ] **Step 2 : Créer `scripts/create-log-collections.sh`**

```bash
#!/bin/bash
# ═══════════════════════════════════════════════════════════
# Crée les collections audit_logs et banned_ips dans Appwrite
# Usage : bash scripts/create-log-collections.sh
# Prérequis : Appwrite running, APPWRITE_API_KEY dans .env
# ═══════════════════════════════════════════════════════════

set -euo pipefail
if [ -f .env ]; then export $(grep -v '^#' .env | xargs); fi

ENDPOINT="${APPWRITE_INTERNAL_ENDPOINT:-http://localhost:8080/v1}"
PROJECT="${NEXT_PUBLIC_APPWRITE_PROJECT_ID}"
KEY="${APPWRITE_API_KEY}"
DB="konfitur-db"

call() {
  curl -sf -X "$1" "${ENDPOINT}$2" \
    -H "Content-Type: application/json" \
    -H "X-Appwrite-Project: ${PROJECT}" \
    -H "X-Appwrite-Key: ${KEY}" \
    -d "$3" | jq -r '.name // .message // .'
}

echo "→ Création collection audit_logs"
call POST "/databases/${DB}/collections" '{
  "collectionId": "audit_logs",
  "name": "Audit Logs",
  "documentSecurity": false,
  "permissions": ["read(\"team:'"${ADMIN_TEAM_ID:-admin}"'\")"]
}'

echo "→ Attributs audit_logs"
for attr in \
  '{"key":"type","type":"string","size":32,"required":true}' \
  '{"key":"ip","type":"string","size":45,"required":false}' \
  '{"key":"country_code","type":"string","size":2,"required":false}' \
  '{"key":"user_agent","type":"string","size":512,"required":false}' \
  '{"key":"path","type":"string","size":512,"required":false}' \
  '{"key":"user_id","type":"string","size":64,"required":false}' \
  '{"key":"message","type":"string","size":2048,"required":false}'
do
  call POST "/databases/${DB}/collections/audit_logs/attributes/string" "$attr" || true
  sleep 0.3
done

echo "→ Index audit_logs sur type + $createdAt"
call POST "/databases/${DB}/collections/audit_logs/indexes" '{
  "key": "type_created",
  "type": "key",
  "attributes": ["type"]
}' || true

echo "→ Création collection banned_ips"
call POST "/databases/${DB}/collections" '{
  "collectionId": "banned_ips",
  "name": "Banned IPs",
  "documentSecurity": false,
  "permissions": ["read(\"team:'"${ADMIN_TEAM_ID:-admin}"'\")"]
}'

echo "→ Attributs banned_ips"
for attr in \
  '{"key":"ip","type":"string","size":45,"required":true}' \
  '{"key":"reason","type":"string","size":256,"required":false}' \
  '{"key":"auto","type":"boolean","required":false,"default":false}'
do
  call POST "/databases/${DB}/collections/banned_ips/attributes/string" "$attr" 2>/dev/null || \
  call POST "/databases/${DB}/collections/banned_ips/attributes/boolean" "$attr" || true
  sleep 0.3
done

echo "→ Index banned_ips sur ip"
call POST "/databases/${DB}/collections/banned_ips/indexes" '{
  "key": "ip_unique",
  "type": "unique",
  "attributes": ["ip"]
}' || true

echo "✅ Collections audit_logs et banned_ips créées."
```

- [ ] **Step 3 : Rendre le script exécutable et le lancer**

```bash
chmod +x scripts/create-log-collections.sh
bash scripts/create-log-collections.sh
```

Attendu : chaque appel retourne le nom de la collection ou un message d'erreur si elle existe déjà (idempotent).

- [ ] **Step 4 : Vérifier dans la console Appwrite**

Naviguer vers `http://localhost:8080/console` → Databases → konfitur-db → vérifier que `audit_logs` et `banned_ips` existent avec leurs attributs.

- [ ] **Step 5 : Type-check**

```bash
cd frontend && pnpm type-check
```

Attendu : aucune erreur

- [ ] **Step 6 : Commit**

```bash
git add frontend/src/lib/appwrite/config.ts scripts/create-log-collections.sh
git commit -m "feat: collections audit_logs et banned_ips dans Appwrite"
```

---

### Task 2 : Module de détection de bot

**Files:**
- Create: `frontend/src/lib/bot-detection.ts`
- Create: `frontend/src/__tests__/bot-detection.test.ts`

- [ ] **Step 1 : Écrire les tests**

Créer `frontend/src/__tests__/bot-detection.test.ts` :

```typescript
import { describe, it, expect } from 'vitest'
import { isBot, extractIP } from '@/lib/bot-detection'

describe('isBot — bots malveillants bloqués', () => {
  it('détecte scrapy', () => {
    expect(isBot('Scrapy/2.11.0 (+https://scrapy.org)')).toBe(true)
  })
  it('détecte python-requests', () => {
    expect(isBot('python-requests/2.31.0')).toBe(true)
  })
  it('détecte curl', () => {
    expect(isBot('curl/7.68.0')).toBe(true)
  })
  it('détecte un UA vide', () => {
    expect(isBot('')).toBe(true)
  })
  it('détecte semrushbot', () => {
    expect(isBot('SemrushBot-SA/0.97')).toBe(true)
  })
  it('détecte nikto (scanner vulnérabilités)', () => {
    expect(isBot('Nikto/2.1.6')).toBe(true)
  })
})

describe('isBot — crawlers légitimes autorisés', () => {
  it('autorise Googlebot', () => {
    expect(isBot('Googlebot/2.1 (+http://www.google.com/bot.html)')).toBe(false)
  })
  it('autorise Twitterbot (previews OG)', () => {
    expect(isBot('Twitterbot/1.0')).toBe(false)
  })
  it('autorise facebookexternalhit (previews OG)', () => {
    expect(isBot('facebookexternalhit/1.1')).toBe(false)
  })
  it('autorise LinkedInBot', () => {
    expect(isBot('LinkedInBot/1.0 (+http://www.linkedin.com)')).toBe(false)
  })
  it('accepte un navigateur desktop normal', () => {
    expect(isBot('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')).toBe(false)
  })
  it('accepte un useragent mobile normal', () => {
    expect(isBot('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(false)
  })
})

describe('extractIP', () => {
  it('extrait depuis X-Forwarded-For', () => {
    const headers = new Headers({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' })
    expect(extractIP(headers)).toBe('1.2.3.4')
  })
  it('extrait depuis x-real-ip si pas de forwarded', () => {
    const headers = new Headers({ 'x-real-ip': '5.6.7.8' })
    expect(extractIP(headers)).toBe('5.6.7.8')
  })
  it('retourne unknown si aucun header IP', () => {
    expect(extractIP(new Headers())).toBe('unknown')
  })
})
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

```bash
cd frontend && pnpm test
```

Attendu : FAIL — `Cannot find module '@/lib/bot-detection'`

- [ ] **Step 3 : Créer `frontend/src/lib/bot-detection.ts`**

> **Note architecture :** Les crawlers de preview sociale (Twitterbot, facebookexternalhit, LinkedInBot, Slackbot, WhatsApp) sont volontairement **exclus** de la détection — les bloquer détruirait les previews Open Graph des jams/projets. Seuls les scrapers abusifs et outils d'automatisation nuisibles sont ciblés.

```typescript
// ═══════════════════════════════════════════════════════════
// Détection de bots nuisibles — fonctions pures, Edge-compatible
//
// IMPORTANT : les crawlers de preview sociale légitimes sont
// en liste blanche. Les bloquer casserait les previews OG.
// ═══════════════════════════════════════════════════════════

// Crawlers légitimes à NE PAS bloquer (partage social, SEO benign)
const LEGITIMATE_CRAWLERS = [
  /twitterbot/i,
  /facebookexternalhit/i,
  /linkedinbot/i,
  /slackbot/i,
  /whatsapp/i,
  /telegrambot/i,
  /discordbot/i,
  /googlebot/i,
  /bingbot/i,
  /yandexbot/i,
  /applebot/i,
]

// Scrapers / outils d'automatisation abusifs à bloquer
const MALICIOUS_BOT_PATTERNS = [
  /scrapy/i,
  /python-requests/i,
  /python-urllib/i,
  /node-fetch/i,
  /go-http-client/i,
  /java\/\d/i,
  /curl\//i,
  /wget\//i,
  /libwww/i,
  /semrushbot/i,
  /ahrefsbot/i,
  /majesticbot/i,
  /mj12bot/i,
  /dotbot/i,
  /petalbot/i,
  /serpstatbot/i,
  /postman/i,
  /insomnia/i,
  /zgrab/i,
  /masscan/i,
  /nikto/i,
  /sqlmap/i,
]

export function isBot(userAgent: string): boolean {
  if (!userAgent || userAgent.trim().length === 0) return true
  // Laisser passer les crawlers légitimes en priorité
  if (LEGITIMATE_CRAWLERS.some(p => p.test(userAgent))) return false
  return MALICIOUS_BOT_PATTERNS.some(pattern => pattern.test(userAgent))
}

export function extractIP(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    // X-Forwarded-For peut contenir plusieurs IPs : "client, proxy1, proxy2"
    return forwarded.split(',')[0].trim()
  }
  return headers.get('x-real-ip') ?? 'unknown'
}
```

- [ ] **Step 4 : Lancer les tests**

```bash
cd frontend && pnpm test
```

Attendu : ✅ tous les tests bot-detection passent

- [ ] **Step 5 : Commit**

```bash
git add frontend/src/lib/bot-detection.ts frontend/src/__tests__/bot-detection.test.ts
git commit -m "feat: module de détection de bot (User-Agent patterns)"
```

---

### Task 3 : API route `/api/log`

**Files:**
- Create: `frontend/src/app/api/log/route.ts`

- [ ] **Step 1 : Créer `frontend/src/app/api/log/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { ID, Query } from 'node-appwrite'
import { serverDatabases } from '@/lib/appwrite/server'
import { DATABASE_ID, COLLECTIONS } from '@/lib/appwrite/config'

// Clé secrète partagée entre le middleware et cette route
// pour éviter l'appel depuis l'extérieur.
const LOG_SECRET = process.env.LOG_INTERNAL_SECRET

interface LogPayload {
  type: 'connection' | 'error' | 'auth' | 'bot_blocked' | 'ban_applied'
  ip?: string
  userAgent?: string
  path?: string
  userId?: string
  message?: string
}

export async function POST(request: NextRequest) {
  // Vérification clé interne
  const auth = request.headers.get('x-log-secret')
  if (LOG_SECRET && auth !== LOG_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: LogPayload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Géolocalisation IP → country_code (ip-api.com, gratuit, 45 req/min)
  let countryCode: string | undefined
  if (payload.ip && payload.ip !== 'unknown' && !payload.ip.startsWith('192.168') && !payload.ip.startsWith('10.')) {
    try {
      const geoRes = await fetch(
        `http://ip-api.com/json/${payload.ip}?fields=countryCode`,
        { signal: AbortSignal.timeout(2000) }
      )
      if (geoRes.ok) {
        const geo = await geoRes.json()
        countryCode = geo.countryCode
      }
    } catch {
      // IP géolocalisation optionnelle — pas de bloc si timeout
    }
  }

  // Stocker le log
  try {
    await serverDatabases.createDocument(
      DATABASE_ID,
      COLLECTIONS.AUDIT_LOGS,
      ID.unique(),
      {
        type: payload.type,
        ip: payload.ip?.slice(0, 45),
        country_code: countryCode,
        user_agent: payload.userAgent?.slice(0, 512),
        path: payload.path?.slice(0, 512),
        user_id: payload.userId,
        message: payload.message?.slice(0, 2048),
      }
    )
  } catch {
    // Ne pas bloquer si le log échoue
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  // Auto-ban : si le type est 'bot_blocked' → compter les occurrences récentes de cet IP
  if (payload.type === 'bot_blocked' && payload.ip && payload.ip !== 'unknown') {
    try {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      // Query sans limit pour avoir le .total exact
      const recentBotLogs = await serverDatabases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.AUDIT_LOGS,
        [
          Query.equal('ip', payload.ip),
          Query.equal('type', 'bot_blocked'),
          Query.greaterThan('$createdAt', fiveMinAgo),
          Query.limit(100), // plafond raisonnable pour la fenêtre 5 min
        ]
      )

      // Si > 10 tentatives bot en 5 min → bannir automatiquement
      if (recentBotLogs.total >= 10) {
        const existing = await serverDatabases.listDocuments(
          DATABASE_ID,
          COLLECTIONS.BANNED_IPS,
          [Query.equal('ip', payload.ip), Query.limit(1)]
        )
        if (existing.total === 0) {
          await serverDatabases.createDocument(
            DATABASE_ID,
            COLLECTIONS.BANNED_IPS,
            ID.unique(),
            {
              ip: payload.ip,
              reason: 'Auto-ban : comportement bot répété',
              auto: true,
            }
          )
        }
      }
    } catch {
      // Auto-ban optionnel
    }
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2 : Ajouter `LOG_INTERNAL_SECRET` dans `.env.example`**

```bash
# Logging interne — clé partagée middleware ↔ /api/log
LOG_INTERNAL_SECRET=changeme_in_production
```

- [ ] **Step 3 : Vérifier le type-check**

```bash
cd frontend && pnpm type-check
```

Attendu : aucune erreur

- [ ] **Step 4 : Commit**

```bash
git add frontend/src/app/api/log/route.ts .env.example
git commit -m "feat: API route /api/log avec géolocalisation et auto-ban bot"
```

---

### Task 4 : API route `/api/banned-ips`

**Files:**
- Create: `frontend/src/app/api/banned-ips/route.ts`

- [ ] **Step 1 : Créer `frontend/src/app/api/banned-ips/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { Query } from 'node-appwrite'
import { serverDatabases } from '@/lib/appwrite/server'
import { DATABASE_ID, COLLECTIONS } from '@/lib/appwrite/config'

// Cache Next.js : revalidation toutes les 2 minutes
export const revalidate = 120

export async function GET() {
  try {
    const res = await serverDatabases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.BANNED_IPS,
      [Query.limit(500)]
    )
    const ips = res.documents.map(doc => doc.ip as string)
    return NextResponse.json({ ips }, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=30' },
    })
  } catch {
    return NextResponse.json({ ips: [] })
  }
}
```

- [ ] **Step 2 : Vérifier le type-check**

```bash
cd frontend && pnpm type-check
```

- [ ] **Step 3 : Commit**

```bash
git add frontend/src/app/api/banned-ips/route.ts
git commit -m "feat: API route /api/banned-ips (liste des IPs bannies, cache 2min)"
```

---

### Task 5 : Middleware — ban check + logging async

**Files:**
- Modify: `frontend/src/middleware.ts`

- [ ] **Step 1 : Mettre à jour `frontend/src/middleware.ts`**

> **Note architecture :**
> - L'API `/api/` est **exclue du matcher** pour éviter la boucle infinie (middleware → `/api/banned-ips` → middleware → ...).
> - Le cache de la liste des IPs bannies est géré par un `Map` module-level avec TTL manuel. En production Edge (Vercel), ce cache n'est pas partagé entre workers — c'est acceptable : le pire cas est une requête Appwrite supplémentaire par worker toutes les 2 minutes.
> - Le logging est fire-and-forget via `fetch` sans `await` — une erreur de log ne bloque jamais la réponse.

```typescript
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
// requêtes en production Edge — c'est intentionnel, cada worker gère son cache.
let bannedIPsCache: { ips: Set<string>; expiresAt: number } | null = null

async function getBannedIPsCached(siteUrl: string): Promise<Set<string>> {
  const now = Date.now()
  if (bannedIPsCache && bannedIPsCache.expiresAt > now) {
    return bannedIPsCache.ips
  }
  try {
    // Appel direct à notre endpoint interne (exclu du matcher → pas de récursion)
    const res = await fetch(`${siteUrl}/api/banned-ips`, {
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
```

- [ ] **Step 2 : Vérifier le type-check**

```bash
cd frontend && pnpm type-check
```

Attendu : aucune erreur

- [ ] **Step 3 : Commit**

```bash
git add frontend/src/middleware.ts
git commit -m "feat: middleware — détection bot, vérif IP bannie, logging async"
```

---

### Task 6 : Server Actions admin — logs

**Files:**
- Create: `frontend/src/lib/actions/logs.ts`

- [ ] **Step 1 : Créer `frontend/src/lib/actions/logs.ts`**

```typescript
'use server'

import { ID, Query } from 'node-appwrite'
import { revalidatePath } from 'next/cache'
import { createSessionClient } from '@/lib/appwrite/session'
import { serverDatabases, serverTeams } from '@/lib/appwrite/server'
import { DATABASE_ID, COLLECTIONS, ADMIN_TEAM_ID } from '@/lib/appwrite/config'

export interface AuditLog {
  id: string
  type: string
  ip?: string
  countryCode?: string
  userAgent?: string
  path?: string
  userId?: string
  message?: string
  createdAt: Date
}

export interface BannedIP {
  id: string
  ip: string
  reason?: string
  auto: boolean
  createdAt: Date
}

function mapDocToLog(doc: { $id: string; type: string; ip?: string; country_code?: string; user_agent?: string; path?: string; user_id?: string; message?: string; $createdAt: string }): AuditLog {
  return {
    id: doc.$id,
    type: doc.type,
    ip: doc.ip,
    countryCode: doc.country_code,
    userAgent: doc.user_agent,
    path: doc.path,
    userId: doc.user_id,
    message: doc.message,
    createdAt: new Date(doc.$createdAt),
  }
}

function mapDocToBannedIP(doc: { $id: string; ip: string; reason?: string; auto?: boolean; $createdAt: string }): BannedIP {
  return {
    id: doc.$id,
    ip: doc.ip,
    reason: doc.reason,
    auto: doc.auto ?? false,
    createdAt: new Date(doc.$createdAt),
  }
}

// ── Lecture des logs ───────────────────────────────────────────────────────

export async function getRecentLogs(type?: string, page = 0): Promise<AuditLog[]> {
  const queries: string[] = [
    Query.orderDesc('$createdAt'),
    Query.limit(50),
    Query.offset(page * 50),
  ]
  if (type) queries.push(Query.equal('type', type))

  const res = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.AUDIT_LOGS, queries)
  return res.documents.map(doc => mapDocToLog(doc as Parameters<typeof mapDocToLog>[0]))
}

// ── Stats par pays ─────────────────────────────────────────────────────────

export async function getCountryStats(): Promise<{ country: string; count: number }[]> {
  // Récupère les 1000 derniers logs de type 'connection' pour les stats pays
  const res = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.AUDIT_LOGS, [
    Query.equal('type', 'connection'),
    Query.orderDesc('$createdAt'),
    Query.limit(1000),
  ])

  const counts: Record<string, number> = {}
  for (const doc of res.documents) {
    const cc = (doc.country_code as string) || 'XX'
    counts[cc] = (counts[cc] ?? 0) + 1
  }

  return Object.entries(counts)
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)
}

// ── Gestion IPs bannies ────────────────────────────────────────────────────

export async function getBannedIPs(): Promise<BannedIP[]> {
  const res = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.BANNED_IPS, [
    Query.orderDesc('$createdAt'),
    Query.limit(200),
  ])
  return res.documents.map(doc => mapDocToBannedIP(doc as Parameters<typeof mapDocToBannedIP>[0]))
}

export async function banIP(ip: string, reason: string): Promise<{ success: boolean; error?: string }> {
  const cleaned = ip.trim()
  if (!cleaned) return { success: false, error: 'IP invalide' }
  // Validation basique IPv4/IPv6
  if (!/^[\d.:a-fA-F]+$/.test(cleaned)) return { success: false, error: 'Format IP invalide' }

  try {
    const existing = await serverDatabases.listDocuments(
      DATABASE_ID, COLLECTIONS.BANNED_IPS, [Query.equal('ip', cleaned), Query.limit(1)]
    )
    if (existing.total > 0) return { success: false, error: 'IP déjà bannie' }

    await serverDatabases.createDocument(DATABASE_ID, COLLECTIONS.BANNED_IPS, ID.unique(), {
      ip: cleaned,
      reason: reason.trim() || 'Ban manuel',
      auto: false,
    })
    revalidatePath('/admin/logs')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Erreur inconnue' }
  }
}

export async function unbanIP(bannedIPId: string): Promise<void> {
  await serverDatabases.deleteDocument(DATABASE_ID, COLLECTIONS.BANNED_IPS, bannedIPId)
  revalidatePath('/admin/logs')
}

export async function clearOldLogs(olderThanDays = 30): Promise<{ deleted: number }> {
  // Vérification admin — seuls les membres de l'équipe admin peuvent purger les logs
  const { account } = createSessionClient()
  const user = await account.get()
  const memberships = await serverTeams.listMemberships(ADMIN_TEAM_ID)
  const isAdmin = memberships.memberships.some(m => m.userId === user.$id)
  if (!isAdmin) throw new Error('Accès réservé aux administrateurs')

  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString()
  const res = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.AUDIT_LOGS, [
    Query.lessThan('$createdAt', cutoff),
    Query.limit(500),
  ])
  let deleted = 0
  for (const doc of res.documents) {
    await serverDatabases.deleteDocument(DATABASE_ID, COLLECTIONS.AUDIT_LOGS, doc.$id)
    deleted++
  }
  revalidatePath('/admin/logs')
  return { deleted }
}
```

- [ ] **Step 2 : Vérifier le type-check**

```bash
cd frontend && pnpm type-check
```

Attendu : aucune erreur

- [ ] **Step 3 : Commit**

```bash
git add frontend/src/lib/actions/logs.ts
git commit -m "feat: Server Actions admin logs (lecture, stats pays, gestion IPs bannies)"
```

---

### Task 7 : Page admin `/admin/logs`

**Files:**
- Create: `frontend/src/app/admin/logs/page.tsx`
- Modify: `frontend/src/app/admin/AdminSidebar.tsx`

- [ ] **Step 1 : Créer `frontend/src/app/admin/logs/page.tsx`**

```tsx
import type { Metadata } from 'next'
import { getRecentLogs, getCountryStats, getBannedIPs } from '@/lib/actions/logs'
import BanIPForm from './BanIPForm'
import UnbanButton from './UnbanButton'
import ClearLogsButton from './ClearLogsButton'
import { Shield, Globe, AlertTriangle, Activity } from 'lucide-react'

export const metadata: Metadata = { title: 'Logs & Monitoring' }

// Emoji drapeaux depuis un code pays ISO 3166-1 alpha-2
function countryFlag(code: string): string {
  if (!code || code === 'XX') return '🌐'
  const codePoints = [...code.toUpperCase()].map(c => 0x1F1E6 - 65 + c.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}

const typeColor: Record<string, string> = {
  connection: 'var(--muted-foreground)',
  auth: 'var(--primary)',
  error: 'var(--secondary)',
  bot_blocked: 'var(--secondary)',
  ban_applied: 'var(--success)',
}

export default async function AdminLogsPage() {
  const [logs, countryStats, bannedIPs] = await Promise.all([
    getRecentLogs(undefined, 0),
    getCountryStats(),
    getBannedIPs(),
  ])

  const totalConnections = countryStats.reduce((a, b) => a + b.count, 0)

  return (
    <section aria-labelledby="logs-heading">
      <div className="mb-8">
        <p className="label-tech mb-1" style={{ color: 'var(--muted-foreground)' }}>ADMIN</p>
        <h1 id="logs-heading" className="text-2xl font-bold">Logs & Monitoring</h1>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Colonne principale — logs récents */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats rapides */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Connexions', value: totalConnections, icon: Activity, color: 'var(--primary)' },
              { label: 'Bots bloqués', value: logs.filter(l => l.type === 'bot_blocked').length, icon: Shield, color: 'var(--secondary)' },
              { label: 'IPs bannies', value: bannedIPs.length, icon: AlertTriangle, color: 'var(--secondary)' },
            ].map(stat => (
              <div key={stat.label} className="p-4 border flex items-center gap-3"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <stat.icon size={18} style={{ color: stat.color }} aria-hidden="true" />
                <div>
                  <p className="text-xl font-bold">{stat.value}</p>
                  <p className="text-[9px] tracking-widest uppercase" style={{ color: 'var(--muted-foreground)' }}>
                    {stat.label}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Tableau des logs */}
          <div>
            <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
              <Activity size={13} aria-hidden="true" />
              Logs récents (50 derniers)
            </h2>
            <div className="border overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
              <table className="w-full text-xs" role="grid">
                <thead>
                  <tr style={{ background: 'var(--surface-elevated)' }}>
                    {['Type', 'IP', 'Pays', 'Chemin', 'Date'].map(h => (
                      <th key={h} scope="col"
                        className="text-left px-3 py-2 font-semibold tracking-wider"
                        style={{ color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="px-3 py-2 font-mono font-semibold" style={{ color: typeColor[log.type] ?? 'var(--foreground)' }}>
                        {log.type}
                      </td>
                      <td className="px-3 py-2 font-mono" style={{ color: 'var(--muted-foreground)' }}>
                        {log.ip ?? '—'}
                      </td>
                      <td className="px-3 py-2" title={log.countryCode}>
                        {log.countryCode ? countryFlag(log.countryCode) : '—'}
                      </td>
                      <td className="px-3 py-2 max-w-[200px] truncate" style={{ color: 'var(--muted-foreground)' }}>
                        {log.path ?? '—'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--muted-foreground)' }}>
                        {log.createdAt.toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center" style={{ color: 'var(--muted-foreground)' }}>
                        Aucun log disponible
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-2 flex justify-end">
              <ClearLogsButton />
            </div>
          </div>
        </div>

        {/* Sidebar droite — pays + ban */}
        <div className="space-y-6">
          {/* Stats par pays */}
          <div>
            <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
              <Globe size={13} aria-hidden="true" />
              Connexions par pays
            </h2>
            <div className="border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
              {countryStats.length === 0 && (
                <p className="p-4 text-xs" style={{ color: 'var(--muted-foreground)' }}>Pas encore de données</p>
              )}
              {countryStats.map(({ country, count }) => (
                <div key={country}
                  className="flex items-center justify-between px-4 py-2 border-b"
                  style={{ borderColor: 'var(--border)' }}>
                  <span className="text-sm">
                    {countryFlag(country)} <span className="font-mono ml-1">{country}</span>
                  </span>
                  <span className="font-mono text-xs font-semibold" style={{ color: 'var(--primary)' }}>
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Gestion IPs bannies */}
          <div>
            <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
              <Shield size={13} aria-hidden="true" />
              IPs bannies ({bannedIPs.length})
            </h2>
            <BanIPForm />
            {bannedIPs.length > 0 && (
              <ul className="mt-3 space-y-1" role="list">
                {bannedIPs.map(entry => (
                  <li key={entry.id}
                    className="flex items-center justify-between px-3 py-2 border text-xs"
                    style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                    <div>
                      <p className="font-mono font-semibold">{entry.ip}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                        {entry.auto ? '🤖 Auto' : '👤 Manuel'}{entry.reason ? ` · ${entry.reason}` : ''}
                      </p>
                    </div>
                    <UnbanButton bannedIPId={entry.id} ip={entry.ip} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2 : Créer `frontend/src/app/admin/logs/BanIPForm.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { Shield, Loader2 } from 'lucide-react'
import { banIP } from '@/lib/actions/logs'

export default function BanIPForm() {
  const [ip, setIp] = useState('')
  const [reason, setReason] = useState('')
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleBan = () => {
    startTransition(async () => {
      setMsg(null)
      const result = await banIP(ip, reason)
      if (result.success) {
        setIp('')
        setReason('')
        setMsg({ type: 'success', text: 'IP bannie' })
      } else {
        setMsg({ type: 'error', text: result.error ?? 'Erreur' })
      }
    })
  }

  const fieldStyle = {
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border)',
    color: 'var(--foreground)',
  }

  return (
    <div className="p-3 border space-y-2" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
      <input
        type="text"
        value={ip}
        onChange={e => setIp(e.target.value)}
        placeholder="IP (ex: 1.2.3.4)"
        className="w-full px-2 py-1.5 text-xs font-mono"
        style={fieldStyle}
        aria-label="Adresse IP à bannir"
      />
      <input
        type="text"
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="Raison (optionnel)"
        className="w-full px-2 py-1.5 text-xs"
        style={fieldStyle}
        aria-label="Raison du ban"
      />
      {msg && (
        <p className="text-xs" style={{ color: msg.type === 'success' ? 'var(--success)' : 'var(--secondary)' }}>
          {msg.text}
        </p>
      )}
      <button
        onClick={handleBan}
        disabled={isPending || !ip.trim()}
        className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
        style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}
        aria-busy={isPending}
      >
        {isPending ? <Loader2 size={10} className="animate-spin" aria-hidden="true" /> : <Shield size={10} aria-hidden="true" />}
        Bannir
      </button>
    </div>
  )
}
```

- [ ] **Step 3 : Créer `frontend/src/app/admin/logs/UnbanButton.tsx`**

```tsx
'use client'

import { useTransition } from 'react'
import { Trash2, Loader2 } from 'lucide-react'
import { unbanIP } from '@/lib/actions/logs'

export default function UnbanButton({ bannedIPId, ip }: { bannedIPId: string; ip: string }) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      onClick={() => startTransition(() => unbanIP(bannedIPId))}
      disabled={isPending}
      className="p-1 transition-opacity hover:opacity-70"
      style={{ color: 'var(--muted-foreground)' }}
      aria-label={`Débannir ${ip}`}
      aria-busy={isPending}
    >
      {isPending
        ? <Loader2 size={11} className="animate-spin" aria-hidden="true" />
        : <Trash2 size={11} aria-hidden="true" />
      }
    </button>
  )
}
```

- [ ] **Step 4 : Créer `frontend/src/app/admin/logs/ClearLogsButton.tsx`**

```tsx
'use client'

import { useTransition } from 'react'
import { Trash2, Loader2 } from 'lucide-react'
import { clearOldLogs } from '@/lib/actions/logs'

export default function ClearLogsButton() {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      onClick={() => {
        if (!confirm('Supprimer les logs de plus de 30 jours ?')) return
        startTransition(() => clearOldLogs(30))
      }}
      disabled={isPending}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-70"
      style={{ color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}
      aria-busy={isPending}
    >
      {isPending ? <Loader2 size={11} className="animate-spin" aria-hidden="true" /> : <Trash2 size={11} aria-hidden="true" />}
      Nettoyer logs &gt;30j
    </button>
  )
}
```

- [ ] **Step 5 : Ajouter le lien "Logs" dans `AdminSidebar.tsx`**

Lire `frontend/src/app/admin/AdminSidebar.tsx` et ajouter :
- Import `Activity` depuis lucide-react
- `<NavLink href="/admin/logs" icon={Activity} label="Logs & Monitoring" />`

- [ ] **Step 6 : Vérifier le type-check**

```bash
cd frontend && pnpm type-check
```

Attendu : aucune erreur

- [ ] **Step 7 : Test manuel**

Naviguer vers `http://localhost:3000/admin/logs` (en étant admin). Vérifier l'affichage du tableau + stats pays.

- [ ] **Step 8 : Commit**

```bash
git add "frontend/src/app/admin/logs/" frontend/src/app/admin/AdminSidebar.tsx
git commit -m "feat: page admin logs avec stats pays et gestion IPs bannies"
```

---

### Task 8 : Tests unitaires + vérification finale

- [ ] **Lancer tous les tests**

```bash
cd frontend && pnpm test
```

Attendu : ✅ tous les tests passent (bot-detection + validators)

- [ ] **Type-check complet**

```bash
cd frontend && pnpm type-check
```

Attendu : 0 erreur

- [ ] **Build**

```bash
cd frontend && pnpm build
```

Attendu : build sans erreur

---

## Notes d'exploitation

- **ip-api.com** : API gratuite, limite 45 requêtes/minute. En production avec un trafic élevé, penser à passer à un plan payant ou à self-héberger une base GeoIP.
- **Cache banned-ips** : TTL de 2 minutes via Next.js ISR. Un nouveau ban prend effet dans les 2 minutes.
- **Auto-ban bot** : déclenché si > 10 requêtes `bot_blocked` du même IP en 5 minutes.
- **Nettoyage des logs** : utiliser "Nettoyer logs >30j" depuis l'interface ou planifier un cron.
- **LOG_INTERNAL_SECRET** : définir dans `.env` pour sécuriser l'API route `/api/log` contre les appels externes.
