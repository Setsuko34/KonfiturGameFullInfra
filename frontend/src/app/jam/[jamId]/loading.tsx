export default function JamLoading() {
  return (
    <div
      className="min-h-screen"
      style={{ background: 'var(--background)' }}
      aria-label="Chargement de la jam..."
      aria-busy="true"
    >
      {/* Skeleton hero */}
      <div
        className="border-b px-4 py-10"
        style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
      >
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="h-4 w-32 animate-pulse" style={{ background: 'var(--surface-elevated)' }} />
          <div className="h-10 w-2/3 animate-pulse" style={{ background: 'var(--surface-elevated)' }} />
          <div className="h-6 w-1/3 animate-pulse" style={{ background: 'var(--surface-elevated)' }} />
          <div className="h-16 w-full max-w-lg animate-pulse" style={{ background: 'var(--surface-elevated)' }} />
        </div>
      </div>
      {/* Skeleton onglets */}
      <div className="border-b px-4 flex gap-6" style={{ borderColor: 'var(--border)' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div
            key={i}
            className="h-12 w-24 my-2 animate-pulse"
            style={{ background: 'var(--surface-elevated)' }}
          />
        ))}
      </div>
    </div>
  )
}
