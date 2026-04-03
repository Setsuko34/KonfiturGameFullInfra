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
  // Fail-secure : si le secret n'est pas configuré, l'endpoint est inutilisable
  if (!LOG_SECRET) {
    return NextResponse.json({ error: 'Log endpoint misconfigured' }, { status: 500 })
  }
  const auth = request.headers.get('x-log-secret')
  if (auth !== LOG_SECRET) {
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
  const isPrivateIP = (ip: string) =>
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('127.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    ip === '::1' ||
    ip.startsWith('fc00:') ||
    ip.startsWith('fe80:')

  // ip-api.com : HTTP uniquement sur le tier gratuit (45 req/min)
  if (payload.ip && payload.ip !== 'unknown' && !isPrivateIP(payload.ip)) {
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
      const recentBotLogs = await serverDatabases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.AUDIT_LOGS,
        [
          Query.equal('ip', payload.ip),
          Query.equal('type', 'bot_blocked'),
          Query.greaterThan('$createdAt', fiveMinAgo),
          Query.limit(100),
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
