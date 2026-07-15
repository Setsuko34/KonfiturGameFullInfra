import type { Metadata } from 'next'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import ExploreGrid from './ExploreGrid'
import { getJams } from '@/lib/actions/jams'

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
  const jams = await getJams()

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
        <ExploreGrid jams={jams} />
      </main>
      <Footer />
    </>
  )
}
