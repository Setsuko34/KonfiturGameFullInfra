import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle, Trash2, ExternalLink } from 'lucide-react'
import {
  listReportedMessages,
  listReportedProjects,
  deleteMessage,
  resolveMessageReport,
  resolveProjectReport,
} from '@/lib/actions/admin'
import AdminProjectActions from '@/app/admin/jams/[jamId]/AdminProjectActions'

export const metadata: Metadata = { title: 'Modération' }

export default async function AdminModerationPage() {
  const [messages, projects] = await Promise.all([
    listReportedMessages(),
    listReportedProjects(),
  ])

  return (
    <div>
      <a href="#main-content" className="sr-only focus:not-sr-only">Aller au contenu principal</a>

      <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'var(--font-mono)' }}>
        Modération
      </h1>
      <p className="text-sm mb-8" style={{ color: 'var(--muted-foreground)' }}>
        {messages.length + projects.length} signalement(s) en attente
      </p>

      {/* Messages signalés */}
      <section className="mb-10">
        <h2 className="text-base font-semibold mb-4 pb-2 border-b" style={{ borderColor: 'var(--border)' }}>
          Messages signalés ({messages.length})
        </h2>
        {messages.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Aucun message signalé.</p>
        ) : (
          <div className="space-y-3">
            {messages.map(msg => (
              <div
                key={msg.id}
                className="p-4 border"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold">{msg.authorName}</span>
                      <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        {msg.createdAt.toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    <p className="text-sm break-words" style={{ color: 'var(--muted-foreground)' }}>
                      {msg.content}
                    </p>
                    <Link
                      href={`/jam/${msg.jamId}`}
                      className="inline-flex items-center gap-1 text-xs mt-2 underline"
                      style={{ color: 'var(--primary)' }}
                    >
                      <ExternalLink size={11} aria-hidden="true" /> Voir la jam (contexte du chat)
                    </Link>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <form action={async () => {
                      'use server'
                      await resolveMessageReport(msg.id)
                    }}>
                      <button
                        type="submit"
                        title="Marquer comme résolu"
                        aria-label="Marquer comme résolu"
                        className="p-1.5 border transition-opacity hover:opacity-80"
                        style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                      >
                        <CheckCircle size={13} aria-hidden="true" />
                      </button>
                    </form>
                    <form action={async () => {
                      'use server'
                      await deleteMessage(msg.id)
                    }}>
                      <button
                        type="submit"
                        title="Supprimer le message"
                        aria-label="Supprimer le message"
                        className="p-1.5 border transition-opacity hover:opacity-80"
                        style={{ borderColor: 'var(--secondary)', color: 'var(--secondary)' }}
                      >
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Projets signalés */}
      <section>
        <h2 className="text-base font-semibold mb-4 pb-2 border-b" style={{ borderColor: 'var(--border)' }}>
          Projets signalés ({projects.length})
        </h2>
        {projects.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Aucun projet signalé.</p>
        ) : (
          <div className="space-y-3">
            {projects.map(project => (
              <div
                key={project.id}
                className="p-4 border"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/project/${project.id}`}
                      className="font-semibold text-sm mb-1 underline transition-opacity hover:opacity-80"
                      style={{ color: 'var(--primary)' }}
                    >
                      {project.title}
                    </Link>
                    <p className="text-sm break-words" style={{ color: 'var(--muted-foreground)' }}>
                      {project.description}
                    </p>
                    <Link
                      href={`/admin/jams/${project.jamId}`}
                      className="inline-flex items-center gap-1 text-xs mt-2 underline"
                      style={{ color: 'var(--primary)' }}
                    >
                      <ExternalLink size={11} aria-hidden="true" /> Gérer la jam
                    </Link>
                  </div>
                  <div className="flex items-start gap-2 flex-shrink-0">
                    <AdminProjectActions projectId={project.id} projectTitle={project.title} />
                    <form action={async () => {
                      'use server'
                      await resolveProjectReport(project.id)
                    }}>
                      <button
                        type="submit"
                        title="Marquer comme résolu"
                        aria-label="Marquer comme résolu"
                        className="p-1.5 border transition-opacity hover:opacity-80 flex-shrink-0"
                        style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                      >
                        <CheckCircle size={13} aria-hidden="true" />
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
