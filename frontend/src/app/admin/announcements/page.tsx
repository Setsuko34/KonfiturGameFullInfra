import type { Metadata } from 'next'
import { Trash2 } from 'lucide-react'
import { createAnnouncement, listAnnouncements, deleteAnnouncement } from '@/lib/actions/admin'
import { getCurrentUser } from '@/lib/actions/dashboard'

export const metadata: Metadata = { title: 'Annonces' }

export default async function AdminAnnouncementsPage() {
  const [user, announcements] = await Promise.all([
    getCurrentUser(),
    listAnnouncements(),
  ])

  return (
    <div>
      <a href="#main-content" className="sr-only focus:not-sr-only">Aller au contenu principal</a>

      <h1 className="text-2xl font-bold mb-8" style={{ fontFamily: 'var(--font-mono)' }}>
        Annonces
      </h1>

      {/* Formulaire création */}
      <section
        className="p-5 border mb-10"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <h2 className="text-base font-semibold mb-4">Nouvelle annonce</h2>
        <form
          action={async (formData: FormData) => {
            'use server'
            const title = formData.get('title') as string
            const content = formData.get('content') as string
            const jamId = (formData.get('jamId') as string) || 'all'
            const important = formData.get('important') === 'on'
            await createAnnouncement({
              title,
              content,
              jamId,
              important,
              authorId: user.$id,
              authorName: user.name || user.email,
            })
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="title" className="block text-xs uppercase tracking-widest mb-1.5"
              style={{ color: 'var(--muted-foreground)' }}>
              Titre
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              className="w-full px-3 py-2 text-sm border bg-transparent outline-none"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>
          <div>
            <label htmlFor="content" className="block text-xs uppercase tracking-widest mb-1.5"
              style={{ color: 'var(--muted-foreground)' }}>
              Contenu
            </label>
            <textarea
              id="content"
              name="content"
              required
              rows={4}
              className="w-full px-3 py-2 text-sm border bg-transparent outline-none resize-none"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>
          <div>
            <label htmlFor="jamId" className="block text-xs uppercase tracking-widest mb-1.5"
              style={{ color: 'var(--muted-foreground)' }}>
              Ciblage (laisser vide = toute la plateforme)
            </label>
            <input
              id="jamId"
              name="jamId"
              type="text"
              placeholder="ID de la jam (optionnel)"
              className="w-full px-3 py-2 text-sm border bg-transparent outline-none"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="important" name="important" className="w-4 h-4" />
            <label htmlFor="important" className="text-sm" style={{ color: 'var(--foreground)' }}>
              Annonce importante
            </label>
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ background: 'var(--primary)', color: '#fff' }}
          >
            Publier l&apos;annonce
          </button>
        </form>
      </section>

      {/* Liste des annonces */}
      <section>
        <h2 className="text-base font-semibold mb-4 pb-2 border-b" style={{ borderColor: 'var(--border)' }}>
          Annonces publiées ({announcements.length})
        </h2>
        {announcements.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Aucune annonce.</p>
        ) : (
          <div className="space-y-3">
            {announcements.map(ann => (
              <div
                key={ann.id}
                className="p-4 border"
                style={{
                  background: 'var(--card)',
                  borderColor: ann.important ? 'var(--secondary)' : 'var(--border)',
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">{ann.title}</span>
                      {ann.important && (
                        <span
                          className="text-[9px] uppercase tracking-widest px-1.5 py-0.5"
                          style={{ background: 'rgba(239,35,60,0.15)', color: 'var(--secondary)' }}
                        >
                          Important
                        </span>
                      )}
                      {ann.jamId !== 'all' && (
                        <span
                          className="text-[9px] uppercase tracking-widest px-1.5 py-0.5"
                          style={{ background: 'rgba(79,106,255,0.15)', color: 'var(--primary)' }}
                        >
                          Jam ciblée
                        </span>
                      )}
                    </div>
                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{ann.content}</p>
                    <p className="text-xs mt-1.5" style={{ color: 'var(--muted-foreground)' }}>
                      {ann.createdAt.toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <form action={async () => {
                    'use server'
                    await deleteAnnouncement(ann.id)
                  }}>
                    <button
                      type="submit"
                      title="Supprimer l'annonce"
                      className="p-1.5 border flex-shrink-0 transition-opacity hover:opacity-80"
                      style={{ borderColor: 'var(--secondary)', color: 'var(--secondary)' }}
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
