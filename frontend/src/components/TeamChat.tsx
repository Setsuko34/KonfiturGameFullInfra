'use client'

import { useState, useEffect, useLayoutEffect, useRef, useTransition } from 'react'
import { Wifi, WifiOff, ChevronUp } from 'lucide-react'
import { databases } from '@/lib/appwrite/client'
import { DATABASE_ID, COLLECTIONS } from '@/lib/appwrite/config'
import { Query } from 'appwrite'
import { mapDocToTeamChatMessage } from '@/lib/appwrite/types'
import { sendTeamChatMessage, getOlderTeamChatMessages, reportTeamMessage, setTeamMessagePinned } from '@/lib/actions/team-chat'
import ChatMessageGroups, { PinnedBanner } from '@/components/chat/ChatMessageGroups'
import ChatComposer from '@/components/chat/ChatComposer'
import { useRealtimeChat } from '@/hooks/useRealtimeChat'
import type { TeamChatMessage } from '@/types'

const CHAT_INITIAL_BATCH = 50 // cohérent avec « charger plus anciens »

export default function TeamChat({ teamId, currentUserId }: { teamId: string; currentUserId: string }) {
  const [messages, setMessages] = useState<TeamChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [olderCursor, setOlderCursor] = useState<string | null>(null)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const initialScrollDone = useRef(false)
  const pendingScrollAdjust = useRef<{ scrollHeight: number; scrollTop: number } | null>(null)

  // Chargement initial — SDK client : la row security filtre naturellement,
  // un non-membre recevrait une liste vide
  useEffect(() => {
    initialScrollDone.current = false
    databases.listDocuments(DATABASE_ID, COLLECTIONS.TEAM_CHAT_MESSAGES, [
      Query.equal('team_id', teamId),
      Query.orderDesc('$createdAt'),
      Query.limit(CHAT_INITIAL_BATCH),
    ]).then(res => {
      // reset dans le callback async, jamais en synchrone dans l'effet (react-hooks/set-state-in-effect)
      setError(null)
      const docs = res.documents
      setMessages(docs.map(mapDocToTeamChatMessage).reverse())
      setOlderCursor(docs.length === CHAT_INITIAL_BATCH ? docs[docs.length - 1].$id : null)
    }).catch(() => setError('Impossible de charger les messages.'))
  }, [teamId])

  const handleLoadOlder = async () => {
    if (!olderCursor || loadingOlder) return
    setLoadingOlder(true)
    const container = messagesContainerRef.current
    try {
      const { messages: older, nextCursor } = await getOlderTeamChatMessages(teamId, olderCursor)
      if (container) {
        pendingScrollAdjust.current = { scrollHeight: container.scrollHeight, scrollTop: container.scrollTop }
      }
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id))
        const deduped = older.filter(m => !existingIds.has(m.id))
        return [...deduped, ...prev]
      })
      setOlderCursor(nextCursor)
    } catch (err) {
      console.error('Erreur chargement messages plus anciens', err)
    } finally {
      setLoadingOlder(false)
    }
  }

  // Même logique de scroll que JamChat : restaure la position après insertion en haut,
  // scrolle en bas au premier rendu
  useLayoutEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return

    if (pendingScrollAdjust.current) {
      const { scrollHeight: oldHeight, scrollTop: oldTop } = pendingScrollAdjust.current
      pendingScrollAdjust.current = null
      container.scrollTop = oldTop + (container.scrollHeight - oldHeight)
      return
    }

    if (!initialScrollDone.current && messages.length > 0) {
      container.scrollTop = container.scrollHeight
      initialScrollDone.current = true
    }
  }, [messages])

  // Realtime — Appwrite ne pousse que les documents lisibles par la session
  const { connected } = useRealtimeChat<TeamChatMessage>({
    collectionId: COLLECTIONS.TEAM_CHAT_MESSAGES,
    setMessages,
    map: doc => mapDocToTeamChatMessage(doc as Parameters<typeof mapDocToTeamChatMessage>[0]),
    accept: doc => doc.team_id === teamId,
    isOwn: doc => doc.author_id === currentUserId,
  })

  const sendMessage = async () => {
    if (!input.trim() || sending) return
    setSending(true)
    setError(null)
    try {
      const res = await sendTeamChatMessage(teamId, input)
      if (!res.success) setError(res.error ?? 'Erreur')
      else setInput('')
      // Pas d'ajout optimiste : le message revient par le realtime (dédupliqué par id)
    } catch {
      // Réseau coupé : la server action rejette avant de retourner un résultat
      setError('Une erreur est survenue. Réessayez.')
    } finally {
      setSending(false)
    }
  }

  const [, startMsgActionTransition] = useTransition()
  const handleReport = (messageId: string) => {
    startMsgActionTransition(async () => {
      try {
        const res = await reportTeamMessage(messageId)
        if (!res.success) return setError(res.error ?? 'Erreur')
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reported: true } : m))
      } catch {
        setError('Une erreur est survenue. Réessayez.')
      }
    })
  }

  const handleTogglePin = (messageId: string, pinned: boolean) => {
    startMsgActionTransition(async () => {
      try {
        const res = await setTeamMessagePinned(messageId, pinned)
        if (!res.success) return setError(res.error ?? 'Erreur')
        // Le realtime .update propage aussi ; mise à jour locale pour la réactivité
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, pinned } : m))
      } catch {
        setError('Une erreur est survenue. Réessayez.')
      }
    })
  }

  return (
    <section
      className="flex flex-col border"
      style={{ background: 'var(--card)', borderColor: 'var(--border)', height: '600px' }}
      aria-label="Tchat de l'équipe"
    >
      {/* En-tête : indicateur connexion */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--border)', flexShrink: 0 }}
      >
        <span className="text-sm font-semibold">#équipe</span>
        <div
          className="flex items-center gap-1.5"
          aria-label={connected ? 'Connecté au tchat en temps réel' : 'Déconnecté'}
        >
          {connected
            ? <Wifi size={13} style={{ color: 'var(--success)' }} aria-hidden="true" />
            : <WifiOff size={13} style={{ color: 'var(--muted-foreground)' }} aria-hidden="true" />
          }
          <span className="label-tech" style={{ color: connected ? 'var(--success)' : 'var(--muted-foreground)' }}>
            {connected ? 'LIVE' : 'HORS LIGNE'}
          </span>
        </div>
      </div>

      <PinnedBanner messages={messages} onUnpin={id => handleTogglePin(id, false)} />

      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
        role="log"
        aria-live="polite"
        aria-label="Messages du tchat d'équipe"
        aria-relevant="additions"
      >
        {olderCursor && (
          <div className="flex justify-center pb-2">
            <button
              type="button"
              onClick={handleLoadOlder}
              disabled={loadingOlder}
              aria-busy={loadingOlder}
              className="min-h-11 flex items-center gap-2 px-4 text-xs font-semibold border transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)', background: 'var(--card)' }}
            >
              <ChevronUp size={13} aria-hidden="true" />
              {loadingOlder ? 'Chargement…' : 'Charger les messages plus anciens'}
            </button>
          </div>
        )}

        <ChatMessageGroups messages={messages} canReport onReport={handleReport} onPin={id => handleTogglePin(id, true)} />

        {messages.length === 0 && (
          <p className="text-center py-8 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Aucun message. Lancez la conversation !
          </p>
        )}
      </div>

      <div className="p-3 border-t" style={{ borderColor: 'var(--border)', flexShrink: 0 }}>
        {error && (
          <p className="text-sm px-3 py-2 mb-2" style={{ background: 'rgba(239,35,60,.1)', color: 'var(--secondary)' }} role="alert">
            {error}
          </p>
        )}
        <ChatComposer
          value={input}
          onChange={setInput}
          onSend={sendMessage}
          disabled={sending}
          placeholder="Message à l'équipe..."
          inputId="team-chat-input"
          srLabel="Message à l'équipe"
        />
      </div>
    </section>
  )
}
