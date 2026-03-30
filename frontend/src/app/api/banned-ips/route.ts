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
