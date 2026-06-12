'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { client, databases } from '@/lib/appwrite/client'
import { DATABASE_ID, COLLECTIONS } from '@/lib/appwrite/config'
import { Query } from 'appwrite'
import { mapDocToChatMessage, type AppwriteDoc } from '@/lib/appwrite/types'
import type { ChatMessage, ChatChannel } from '@/types'

export function useRealtimeChat(jamId: string, channel: ChatChannel) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  // Charger les messages initiaux
  const loadMessages = useCallback(async () => {
    setLoading(true)
    try {
      const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.CHAT_MESSAGES, [
        Query.equal('jam_id', jamId),
        Query.equal('channel', channel),
        Query.orderAsc('$createdAt'),
        Query.limit(100),
      ])
      setMessages(res.documents.map(mapDocToChatMessage))
    } catch (err) {
      console.error('Erreur chargement messages', err)
    } finally {
      setLoading(false)
    }
  }, [jamId, channel])

  // Souscription Realtime
  useEffect(() => {
    loadMessages()

    const unsubscribe = client.subscribe(
      `databases.${DATABASE_ID}.collections.${COLLECTIONS.CHAT_MESSAGES}.documents`,
      (response) => {
        const events = response.events as string[]
        const doc = response.payload as AppwriteDoc

        if (events.some(e => e.includes('.create'))) {
          if (doc.jam_id === jamId && doc.channel === channel) {
            const msg = mapDocToChatMessage(doc)
            setMessages(prev => {
              // Éviter les doublons
              if (prev.some(m => m.id === msg.id)) return prev
              return [...prev, msg]
            })
          }
        }

        if (events.some(e => e.includes('.delete'))) {
          setMessages(prev => prev.filter(m => m.id !== doc.$id))
        }
      }
    )

    unsubscribeRef.current = unsubscribe
    setConnected(true)

    return () => {
      unsubscribe()
      unsubscribeRef.current = null
      setConnected(false)
    }
  }, [jamId, channel, loadMessages])

  return { messages, connected, loading }
}
