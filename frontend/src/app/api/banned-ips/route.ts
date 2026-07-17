import { NextRequest, NextResponse } from 'next/server'
import { fetchAllDocs } from '@/lib/appwrite/fetch-all'
import { COLLECTIONS } from '@/lib/appwrite/config'

// Endpoint interne consommé uniquement par le middleware Next.js
const LOG_SECRET = process.env.LOG_INTERNAL_SECRET

// Force dynamic: réponse variant par header auth → jamais mise en cache
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!LOG_SECRET) {
    return NextResponse.json({ error: 'Endpoint misconfigured' }, { status: 500 })
  }
  if (request.headers.get('x-log-secret') !== LOG_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // fetchAllDocs lève plutôt que de tronquer au-delà de SAFETY_CAP : sur une
    // liste d'IP bannies, mieux vaut échouer bruyamment (catch ci-dessous, 500)
    // que de servir une liste incomplète en silence.
    const docs = await fetchAllDocs(COLLECTIONS.BANNED_IPS)
    const ips = docs.map(doc => (doc as Record<string, unknown>).ip as string)
    return NextResponse.json({ ips }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch banned IPs' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
