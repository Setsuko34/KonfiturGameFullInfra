'use client'

import { useState, useEffect } from 'react'
import { client, databases } from '@/lib/appwrite/client'
import { DATABASE_ID, COLLECTIONS } from '@/lib/appwrite/config'
import { Query } from 'appwrite'
import { mapDocToChatMessage, type AppwriteDoc } from '@/lib/appwrite/types'
import type { ChatMessage, ChatChannel } from '@/types'

export function useRealtimeChat(jamId: string, channel: ChatChannel) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)

  // Chargement initial + reset sur changement de canal
  useEffect(() => {
    let cancelled = false

    databases.listDocuments(DATABASE_ID, COLLECTIONS.CHAT_MESSAGES, [
      Query.equal('jam_id', jamId),
      Query.equal('channel', channel),
      Query.orderAsc('$createdAt'),
      Query.limit(100),
    ]).then(res => {
      if (!cancelled) {
        setMessages(res.documents.map(mapDocToChatMessage))
        setLoading(false)
      }
    }).catch(err => {
      console.error('Erreur chargement messages', err)
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
      setMessages([])
      setLoading(true)
    }
  }, [jamId, channel])

  // Souscription Realtime
  useEffect(() => {
    const unsubscribe = client.subscribe(
      `databases.${DATABASE_ID}.collections.${COLLECTIONS.CHAT_MESSAGES}.documents`,
      (response) => {
        const events = response.events as string[]
        const doc = response.payload as AppwriteDoc

        if (events.some(e => e.includes('.create'))) {
          if (doc.jam_id === jamId && doc.channel === channel) {
            const msg = mapDocToChatMessage(doc)
            setMessages(prev => {
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

    const timer = setTimeout(() => setConnected(true), 0)

    return () => {
      clearTimeout(timer)
      unsubscribe()
      setConnected(false)
    }
  }, [jamId, channel])

  return { messages, connected, loading }
}
