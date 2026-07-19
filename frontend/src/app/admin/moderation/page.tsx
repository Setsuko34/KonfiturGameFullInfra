import type { Metadata } from 'next'
import { listReportedMessages, listReportedProjects, listReportedTeamMessages } from '@/lib/actions/admin'
import ReportedMessagesList from './ReportedMessagesList'
import ReportedProjectsList from './ReportedProjectsList'
import ReportedTeamMessagesList from './ReportedTeamMessagesList'
import LoadMoreList from '@/components/LoadMoreList'
import type { ChatMessage, Project, TeamChatMessage } from '@/types'

export const metadata: Metadata = { title: 'Modération' }

export default async function AdminModerationPage() {
  const [
    { messages, nextCursor: messagesCursor },
    { projects, nextCursor: projectsCursor },
    { messages: teamMessages, nextCursor: teamMessagesCursor },
  ] = await Promise.all([
    listReportedMessages(),
    listReportedProjects(),
    listReportedTeamMessages(),
  ])

  async function loadMoreMessages(cursor: string): Promise<{ items: ChatMessage[]; nextCursor: string | null }> {
    'use server'
    const res = await listReportedMessages(cursor)
    return { items: res.messages, nextCursor: res.nextCursor }
  }

  async function loadMoreProjects(cursor: string): Promise<{ items: Project[]; nextCursor: string | null }> {
    'use server'
    const res = await listReportedProjects(cursor)
    return { items: res.projects, nextCursor: res.nextCursor }
  }

  async function loadMoreTeamMessages(cursor: string): Promise<{ items: TeamChatMessage[]; nextCursor: string | null }> {
    'use server'
    const res = await listReportedTeamMessages(cursor)
    return { items: res.messages, nextCursor: res.nextCursor }
  }

  return (
    <div>
      <a href="#main-content" className="sr-only focus:not-sr-only">Aller au contenu principal</a>

      <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'var(--font-mono)' }}>
        Modération
      </h1>
      <p className="text-sm mb-8" style={{ color: 'var(--muted-foreground)' }}>
        {messages.length + projects.length + teamMessages.length} signalement(s) en attente
      </p>

      {/* Messages signalés */}
      <section className="mb-10">
        <h2 className="text-base font-semibold mb-4 pb-2 border-b" style={{ borderColor: 'var(--border)' }}>
          Messages signalés ({messages.length})
        </h2>
        <LoadMoreList
          initialItems={messages}
          initialCursor={messagesCursor}
          loadMore={loadMoreMessages}
          List={ReportedMessagesList}
        />
      </section>

      {/* Messages de team signalés */}
      <section className="mb-10">
        <h2 className="text-base font-semibold mb-4 pb-2 border-b" style={{ borderColor: 'var(--border)' }}>
          Messages de team signalés ({teamMessages.length})
        </h2>
        <LoadMoreList
          initialItems={teamMessages}
          initialCursor={teamMessagesCursor}
          loadMore={loadMoreTeamMessages}
          List={ReportedTeamMessagesList}
        />
      </section>

      {/* Projets signalés */}
      <section>
        <h2 className="text-base font-semibold mb-4 pb-2 border-b" style={{ borderColor: 'var(--border)' }}>
          Projets signalés ({projects.length})
        </h2>
        <LoadMoreList
          initialItems={projects}
          initialCursor={projectsCursor}
          loadMore={loadMoreProjects}
          List={ReportedProjectsList}
        />
      </section>
    </div>
  )
}
