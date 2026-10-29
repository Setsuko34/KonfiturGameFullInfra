import Image from 'next/image'
import { ExternalLink } from 'lucide-react'
import { FRVTUBERS_URL, KOKORI_SRC, mascotAvailable } from '@/lib/frvtubers'

export default function FrvtubersBanner() {
  const hasMascot = mascotAvailable()

  return (
    <section
      className="px-4 sm:px-6 lg:px-8 py-16 border-b"
      style={{ borderColor: 'var(--border)' }}
      aria-labelledby="frvtubers-heading"
    >
      <div className="max-w-7xl mx-auto">
        <div
          className="flex flex-col sm:flex-row sm:items-center gap-6 p-5 sm:pr-8 border"
          style={{
            background: 'var(--card)',
            borderColor: 'var(--border)',
            borderLeft: '4px solid var(--secondary)',
          }}
        >
          {/* Mascotte — déborde verticalement à partir de sm */}
          <div className="shrink-0 w-[110px] h-[130px] sm:-my-8">
            {hasMascot ? (
              <Image
                src={KOKORI_SRC}
                alt="Kokori, la mascotte de FRVtubers"
                width={220}
                height={260}
                className="w-full h-full object-contain"
              />
            ) : (
              <div
                className="w-full h-full border-2 border-dashed"
                style={{ borderColor: 'var(--border)' }}
                aria-hidden="true"
              />
            )}
          </div>

          {/* Texte */}
          <div className="flex-1">
            <p className="label-tech mb-2" style={{ color: 'var(--secondary)' }}>
              PARTENAIRE
            </p>
            <h2 id="frvtubers-heading" className="text-2xl font-bold mb-2">
              Né d&#39;une idée de FRVtubers
            </h2>
            <p style={{ color: 'var(--muted-foreground)' }}>
              KonfiturGame est imaginée aux côté de la communauté des VTubers francophones.
            </p>
          </div>

          {/* Lien */}
          <a
            href={FRVTUBERS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-5 font-bold border transition-opacity hover:opacity-80 self-start sm:self-center"
            style={{
              minHeight: '44px',
              borderColor: 'var(--primary)',
              color: 'var(--primary)',
            }}
          >
            frvtubers.com
            <ExternalLink size={16} aria-hidden="true" />
            <span className="sr-only">(ouvre un nouvel onglet)</span>
          </a>
        </div>
      </div>
    </section>
  )
}
