import type { Metadata } from 'next'
import { createAnnouncement, listAnnouncements } from '@/lib/actions/admin'
import { getCurrentUser } from '@/lib/actions/dashboard'
import AnnouncementsList from './AnnouncementsList'
import LoadMoreList from '@/components/LoadMoreList'
import type { Announcement } from '@/types'

export const metadata: Metadata = { title: 'Annonces' }

export default async function AdminAnnouncementsPage() {
  const [user, { announcements, nextCursor }] = await Promise.all([
    getCurrentUser(),
    listAnnouncements(),
  ])

  async function loadMoreAnnouncements(cursor: string): Promise<{ items: Announcement[]; nextCursor: string | null }> {
    'use server'
    const res = await listAnnouncements(cursor)
    return { items: res.announcements, nextCursor: res.nextCursor }
  }

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
        {/* key = tête de liste : une création change announcements[0] et force le remontage de
            LoadMoreList/AnnouncementsList (qui accumulent en useState et ne revoient jamais les
            nouvelles props après revalidatePath) pour repartir du lot frais. Les suppressions
            restent gérées localement par removedIds dans AnnouncementsList. */}
        <LoadMoreList
          key={announcements[0]?.id ?? 'empty'}
          initialItems={announcements}
          initialCursor={nextCursor}
          loadMore={loadMoreAnnouncements}
          List={AnnouncementsList}
        />
      </section>
    </div>
  )
}
