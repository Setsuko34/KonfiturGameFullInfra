import type { Metadata } from 'next'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import LoadMoreList from '@/components/LoadMoreList'
import ExploreGrid from './ExploreGrid'
import { getJams } from '@/lib/actions/jams'
import type { GameJam } from '@/types'

export const metadata: Metadata = {
  title: 'Explorer les jams',
  description: 'Découvre toutes les game jams disponibles sur KonfiturGame : en cours, à venir, terminées.',
  openGraph: {
    title: 'Explorer les jams | KonfiturGame',
    description: 'Toutes les game jams sur la plateforme française.',
    images: [{ url: '/og?title=Explorer+les+jams', width: 1200, height: 630 }],
  },
  alternates: { canonical: '/explore' },
}

export default async function ExplorePage() {
  const { jams, nextCursor } = await getJams()

  async function loadMoreJams(cursor: string): Promise<{ items: GameJam[]; nextCursor: string | null }> {
    'use server'
    const res = await getJams(cursor)
    return { items: res.jams, nextCursor: res.nextCursor }
  }

  return (
    <>
      <Header />
      <main id="main-content">
        <div
          className="border-b px-4 sm:px-6 lg:px-8 py-8"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="max-w-7xl mx-auto">
            <p className="label-tech mb-2" style={{ color: 'var(--muted-foreground)' }}>
              EXPLORER
            </p>
            <h1 className="text-3xl font-bold mb-4">Toutes les game jams</h1>
          </div>
        </div>
        <LoadMoreList initialItems={jams} initialCursor={nextCursor} loadMore={loadMoreJams} List={ExploreGrid} />
      </main>
      <Footer />
    </>
  )
}
