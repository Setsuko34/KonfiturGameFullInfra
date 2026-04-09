import { NextRequest, NextResponse } from 'next/server'
import { Query } from 'node-appwrite'
import { serverDatabases } from '@/lib/appwrite/server'
import { DATABASE_ID, COLLECTIONS } from '@/lib/appwrite/config'

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
    const res = await serverDatabases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.BANNED_IPS,
      [Query.limit(500)]
    )
    const ips = res.documents.map(doc => doc.ip as string)
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
