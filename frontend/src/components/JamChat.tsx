'use client'

import { useState, useEffect, useLayoutEffect, useRef, useTransition } from 'react'
import { Wifi, WifiOff, ChevronUp } from 'lucide-react'
import { databases } from '@/lib/appwrite/client'
import { DATABASE_ID, COLLECTIONS } from '@/lib/appwrite/config'
import { Query } from 'appwrite'
import { mapDocToChatMessage } from '@/lib/appwrite/types'
import { useAuth } from '@/components/providers/AuthProvider'
import { reportMessage, getOlderChatMessages } from '@/lib/actions/chat'
import type { ChatMessage, ChatChannel } from '@/types'
import ChatMessageGroups, { PinnedBanner } from '@/components/chat/ChatMessageGroups'
import ChatComposer from '@/components/chat/ChatComposer'
import { useRealtimeChat } from '@/hooks/useRealtimeChat'

interface JamChatProps {
  jamId: string
  initialMessages?: ChatMessage[]
}

const CHAT_INITIAL_BATCH = 50 // taille de lot délibérée, cohérente avec « charger plus anciens »

const channels: { id: ChatChannel; label: string }[] = [
  { id: 'general', label: 'Général' },
  { id: 'team-search', label: 'Cherche équipe' },
  { id: 'help', label: 'Aide' },
]

const roleConfig = {
  organizer: { label: 'ORGA', color: 'var(--secondary)' },
  moderator: { label: 'MOD', color: 'var(--primary)' },
  user: null,
}

export default function JamChat({ jamId, initialMessages = [] }: JamChatProps) {
  const { user } = useAuth()
  const [activeChannel, setActiveChannel] = useState<ChatChannel>('general')
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  // Chargement vers le haut (messages plus anciens)
  const [olderCursor, setOlderCursor] = useState<string | null>(null)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const initialScrollDone = useRef(false)
  // Canal auquel appartient `olderCursor` : entre un changement de canal et la résolution du
  // fetch initial ci-dessous, olderCursor pointe encore vers l'ancien canal. Comparer cette ref
  // (mise à jour uniquement dans les callbacks async, jamais en synchrone dans l'effet, pour ne
  // pas déclencher react-hooks/set-state-in-effect) empêche « charger plus anciens » de partir
  // avec un curseur périmé pendant cette fenêtre.
  const cursorChannelRef = useRef<ChatChannel | null>(null)
  const pendingScrollAdjust = useRef<{ scrollHeight: number; scrollTop: number } | null>(null)

  // Charger les messages initiaux du canal
  useEffect(() => {
    initialScrollDone.current = false
    databases.listDocuments(DATABASE_ID, COLLECTIONS.CHAT_MESSAGES, [
      Query.equal('jam_id', jamId),
      Query.equal('channel', activeChannel),
      Query.orderDesc('$createdAt'),
      Query.limit(CHAT_INITIAL_BATCH),
    ]).then(res => {
      const docs = res.documents
      setMessages(docs.map(mapDocToChatMessage).reverse())
      // Lot plein = peut-être d'autres messages plus anciens ; le plus ancien du lot sert d'ancre
      setOlderCursor(docs.length === CHAT_INITIAL_BATCH ? docs[docs.length - 1].$id : null)
      cursorChannelRef.current = activeChannel
    }).catch(console.error)
  }, [jamId, activeChannel])

  // Charge le lot de messages plus anciens que `olderCursor` et préserve la position de
  // scroll : capturer scrollHeight/scrollTop avant l'insertion, le layout effect ci-dessous
  // restaure le delta après le rendu pour que la vue ne saute pas sous les yeux du lecteur.
  const handleLoadOlder = async () => {
    // cursorChannelRef.current !== activeChannel : fenêtre entre un changement de canal et la
    // résolution du fetch initial ci-dessus, où olderCursor pointe encore vers l'ancien canal.
    if (!olderCursor || loadingOlder || cursorChannelRef.current !== activeChannel) return
    setLoadingOlder(true)
    const container = messagesContainerRef.current
    try {
      const { messages: older, nextCursor } = await getOlderChatMessages(jamId, activeChannel, olderCursor)
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

  // Ajuste le scroll après chaque mise à jour de `messages` : restaure la position lue
  // après un ajout en haut (delta de hauteur), sinon scrolle en bas au tout premier rendu
  // du canal (sans animation, sans faire défiler la page entière).
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

  // Souscription Realtime (update/delete inclus : modération admin propagée en direct)
  const { connected } = useRealtimeChat<ChatMessage>({
    collectionId: COLLECTIONS.CHAT_MESSAGES,
    setMessages,
    map: doc => mapDocToChatMessage(doc as Parameters<typeof mapDocToChatMessage>[0]),
    accept: doc => doc.jam_id === jamId && doc.channel === activeChannel,
    isOwn: doc => doc.author_id === user?.$id,
  })

  const sendMessage = async () => {
    if (!input.trim() || !user || sending) return
    setSending(true)
    try {
      await databases.createDocument(DATABASE_ID, COLLECTIONS.CHAT_MESSAGES, 'unique()', {
        jam_id: jamId,
        channel: activeChannel,
        author_id: user.$id,
        author_name: user.name,
        content: input.trim().slice(0, 2048),
        role: 'user',
        pinned: false,
      })
      setInput('')
    } catch (err) {
      console.error('Erreur envoi message', err)
    } finally {
      setSending(false)
    }
  }

  const [, startReportTransition] = useTransition()

  const handleReportMessage = (messageId: string) => {
    startReportTransition(async () => {
      await reportMessage(messageId)
      setMessages(prev =>
        prev.map(m => m.id === messageId ? { ...m, reported: true } : m)
      )
    })
  }

  const filteredMessages = messages.filter(m => m.channel === activeChannel)
  const displayMessages = filteredMessages.map(m => ({
    ...m,
    roleBadge: roleConfig[m.role],
  }))

  return (
    <section
      className="flex flex-col border"
      style={{
        background: 'var(--card)',
        borderColor: 'var(--border)',
        height: '600px',
      }}
      aria-label="Chat de la jam"
    >
      {/* En-tête canaux */}
      <div
        className="flex border-b overflow-x-auto"
        style={{ borderColor: 'var(--border)', flexShrink: 0 }}
        role="tablist"
        aria-label="Canaux de discussion"
      >
        {channels.map(ch => (
          <button
            key={ch.id}
            role="tab"
            aria-selected={activeChannel === ch.id}
            onClick={() => setActiveChannel(ch.id)}
            className="px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2"
            style={{
              color: activeChannel === ch.id ? 'var(--primary)' : 'var(--muted-foreground)',
              borderBottomColor: activeChannel === ch.id ? 'var(--primary)' : 'transparent',
              background: 'transparent',
            }}
          >
            #{ch.label}
          </button>
        ))}

        {/* Indicateur connexion */}
        <div
          className="ml-auto flex items-center gap-1.5 px-3"
          aria-label={connected ? 'Connecté au chat en temps réel' : 'Déconnecté'}
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

      {/* Messages épinglés */}
      <PinnedBanner messages={displayMessages} />

      {/* Zone de messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
        role="log"
        aria-live="polite"
        aria-label="Messages du chat"
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

        <ChatMessageGroups messages={displayMessages} canReport={!!user} onReport={handleReportMessage} />

        {filteredMessages.length === 0 && (
          <p className="text-center py-8 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Aucun message dans ce canal. Soyez le premier à écrire !
          </p>
        )}
      </div>

      {/* Zone de saisie */}
      <div
        className="p-3 border-t"
        style={{ borderColor: 'var(--border)', flexShrink: 0 }}
      >
        {user ? (
          <ChatComposer
            value={input}
            onChange={setInput}
            onSend={sendMessage}
            disabled={sending}
            placeholder={`Message #${channels.find(c => c.id === activeChannel)?.label}...`}
            inputId="chat-input"
            srLabel={`Message dans #${channels.find(c => c.id === activeChannel)?.label}`}
          />
        ) : (
          <p className="text-sm text-center py-1" style={{ color: 'var(--muted-foreground)' }}>
            <a href="/auth/login" style={{ color: 'var(--primary)' }}>Connectez-vous</a> pour participer au chat.
          </p>
        )}
      </div>
    </section>
  )
}
