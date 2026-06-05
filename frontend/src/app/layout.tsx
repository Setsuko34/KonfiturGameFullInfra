import { Space_Grotesk, JetBrains_Mono } from 'next/font/google'
import type { Metadata } from 'next'
import { AuthProvider } from '@/components/providers/AuthProvider'
import './globals.css'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: {
    default: 'KonfiturGame — Plateforme Game Jam',
    template: '%s | KonfiturGame',
  },
  description: 'La plateforme française de game jams. Crée, jam, ship.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  keywords: ['game jam', 'jeu vidéo', 'développement jeu', 'indie game', 'france', 'création jeux'],
  authors: [{ name: 'KonfiturGame' }],
  creator: 'KonfiturGame',
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    siteName: 'KonfiturGame',
    images: [{ url: '/og', width: 1200, height: 630, alt: 'KonfiturGame' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@KonfiturGame',
    images: ['/og'],
  },
  icons: {
    icon: [{ url: '/hautequalite.svg', type: 'image/svg+xml' }],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  alternates: {
    canonical: '/',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body className="grid-overlay noise">
        <a href="#main-content" className="skip-link">
          Aller au contenu principal
        </a>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
