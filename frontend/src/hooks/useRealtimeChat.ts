'use client'

import { useState, useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import { client } from '@/lib/appwrite/client'
import { DATABASE_ID } from '@/lib/appwrite/config'
import { playPing } from '@/components/chat/ping'

type RealtimeDoc = Record<string, unknown>

/**
 * Souscription realtime commune aux chats (JamChat, TeamChat) : create avec
 * dédoublonnage par id + ping si le message vient d'un autre auteur, update
 * remplacé par id (épinglage/signalement propagés), delete retiré par id.
 * `accept` filtre les documents du chat courant (jam+canal, team...) ; les
 * callbacks sont lus via une ref, la souscription ne dépend que de la table.
 */
export function useRealtimeChat<T extends { id: string }>({
  collectionId,
  setMessages,
  map,
  accept,
  isOwn,
}: {
  collectionId: string
  setMessages: Dispatch<SetStateAction<T[]>>
  map: (doc: RealtimeDoc) => T
  accept: (doc: RealtimeDoc) => boolean
  isOwn: (doc: RealtimeDoc) => boolean
}): { connected: boolean } {
  const [connected, setConnected] = useState(false)
  const handlers = useRef({ setMessages, map, accept, isOwn })
  useEffect(() => {
    // Ref « dernière version » : la souscription lit toujours les callbacks à jour
    // sans se réabonner à chaque rendu (interdit en rendu par react-hooks/refs)
    handlers.current = { setMessages, map, accept, isOwn }
  })

  useEffect(() => {
    const unsubscribe = client.subscribe(
      `databases.${DATABASE_ID}.collections.${collectionId}.documents`,
      (response) => {
        const { setMessages, map, accept, isOwn } = handlers.current
        const events = response.events as string[]
        const doc = response.payload as RealtimeDoc
        if (!accept(doc)) return

        if (events.some(e => e.includes('.create'))) {
          const msg = map(doc)
          setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]))
          if (!isOwn(doc)) playPing()
        }
        if (events.some(e => e.includes('.update'))) {
          const msg = map(doc)
          setMessages(prev => prev.map(m => (m.id === msg.id ? msg : m)))
        }
        if (events.some(e => e.includes('.delete'))) {
          setMessages(prev => prev.filter(m => m.id !== (doc.$id as string)))
        }
      }
    )
    const timer = setTimeout(() => setConnected(true), 0)
    return () => {
      clearTimeout(timer)
      unsubscribe()
      setConnected(false)
    }
  }, [collectionId])

  return { connected }
}
