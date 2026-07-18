// frontend/src/__tests__/actions-chat.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Query } from 'node-appwrite'

vi.mock('@/lib/appwrite/server', () => ({
  serverDatabases: {
    createDocument: vi.fn(),
    listDocuments: vi.fn(),
    updateDocument: vi.fn(),
  },
}))

import { sendChatMessage, getOlderChatMessages } from '@/lib/actions/chat'
import { serverDatabases } from '@/lib/appwrite/server'

const mockCreate = vi.mocked(serverDatabases.createDocument)
const mockList = vi.mocked(serverDatabases.listDocuments)

// n messages minimaux valides pour mapDocToChatMessage, $id uniques, pour tester
// la pagination au curseur vers le haut (messages plus anciens)
function chatDocs(n: number, offset = 0) {
  return Array.from({ length: n }, (_, i) => ({
    $id: `msg-${offset + i}`,
    $createdAt: `2026-04-01T00:${String(offset + i).padStart(2, '0')}:00.000Z`,
    jam_id: 'jam-1',
    channel: 'general',
    author_id: 'user-1',
    author_name: 'Alice',
    content: `message ${offset + i}`,
    role: 'user',
    pinned: false,
  }))
}

const baseData = {
  jamId: 'jam-1',
  channel: 'general' as const,
  authorId: 'user-1',
  authorName: 'Alice',
}

beforeEach(() => {
  mockCreate.mockReset()
  mockList.mockReset()
  // Par défaut : succès Appwrite avec un document minimal
  mockCreate.mockResolvedValue({
    $id: 'msg-1',
    $createdAt: '2026-04-01T00:00:00.000Z',
    $updatedAt: '2026-04-01T00:00:00.000Z',
    $permissions: [],
    $collectionId: 'chat_messages',
    $databaseId: 'konfitur-db',
    jam_id: 'jam-1',
    channel: 'general',
    author_id: 'user-1',
    author_name: 'Alice',
    content: 'ok',
    role: 'user',
    pinned: false,
  } as never)
})

describe('sendChatMessage — validation du contenu', () => {
  it('refuse un message vide', async () => {
    const result = await sendChatMessage({ ...baseData, content: '' })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/vide/)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('refuse un message composé uniquement d\'espaces', async () => {
    const result = await sendChatMessage({ ...baseData, content: '   ' })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/vide/)
    expect(mockCreate).not.toHaveBeenCalled()
  })
})

describe('sendChatMessage — sanitisation HTML', () => {
  it('échappe les chevrons ouvrants < en &lt;', async () => {
    await sendChatMessage({ ...baseData, content: '<script>alert(1)</script>' })
    const savedContent: string = (mockCreate.mock.calls[0][3] as Record<string, unknown>).content as string
    expect(savedContent).toContain('&lt;script&gt;')
    expect(savedContent).not.toContain('<script>')
  })

  it('échappe uniquement < et >, pas les autres caractères spéciaux', async () => {
    await sendChatMessage({ ...baseData, content: 'test & "quotes" <tag>' })
    const savedContent: string = (mockCreate.mock.calls[0][3] as Record<string, unknown>).content as string
    expect(savedContent).toBe('test & "quotes" &lt;tag&gt;')
  })
})

describe('sendChatMessage — troncature à 2048 caractères', () => {
  it('tronque les messages de plus de 2048 caractères', async () => {
    await sendChatMessage({ ...baseData, content: 'a'.repeat(3000) })
    const savedContent: string = (mockCreate.mock.calls[0][3] as Record<string, unknown>).content as string
    expect(savedContent.length).toBe(2048)
  })

  it('tronque un message de 2049 caractères à 2048', async () => {
    await sendChatMessage({ ...baseData, content: 'a'.repeat(2049) })
    const savedContent: string = (mockCreate.mock.calls[0][3] as Record<string, unknown>).content as string
    expect(savedContent.length).toBe(2048)
  })

  it('ne tronque pas les messages de 2048 caractères exactement', async () => {
    await sendChatMessage({ ...baseData, content: 'a'.repeat(2048) })
    const savedContent: string = (mockCreate.mock.calls[0][3] as Record<string, unknown>).content as string
    expect(savedContent.length).toBe(2048)
  })
})

describe('sendChatMessage — gestion erreur Appwrite', () => {
  it('retourne success:false et le message d\'erreur si Appwrite échoue', async () => {
    mockCreate.mockRejectedValue(new Error('Permission refusée'))
    const result = await sendChatMessage({ ...baseData, content: 'Bonjour' })
    expect(result.success).toBe(false)
    expect(result.error).toBe('Permission refusée')
  })
})

describe('getOlderChatMessages', () => {
  it('retourne les messages en ordre chronologique croissant (plus ancien en premier)', async () => {
    // Appwrite renvoie en ordre décroissant (msg-2 le plus récent du lot, msg-0 le plus ancien)
    mockList.mockResolvedValue({ total: 3, documents: chatDocs(3, 0).reverse() } as never)
    const { messages } = await getOlderChatMessages('jam-1', 'general', 'msg-anchor')
    expect(messages.map(m => m.id)).toEqual(['msg-0', 'msg-1', 'msg-2'])
  })

  it('ne contient pas le message ancré (le curseur) ni aucun doublon avec le lot courant', async () => {
    mockList.mockResolvedValue({ total: 2, documents: chatDocs(2, 0).reverse() } as never)
    const { messages } = await getOlderChatMessages('jam-1', 'general', 'msg-anchor')
    expect(messages.some(m => m.id === 'msg-anchor')).toBe(false)
  })

  it('transmet le curseur via Query.cursorAfter à Appwrite, ancré sur le plus ancien message affiché', async () => {
    mockList.mockResolvedValue({ total: 0, documents: [] } as never)
    await getOlderChatMessages('jam-1', 'general', 'msg-anchor')
    const queries = mockList.mock.calls[0][2] as string[]
    expect(queries).toContain(Query.cursorAfter('msg-anchor'))
  })

  it('nextCursor est null quand le lot revient incomplet (moins de 50)', async () => {
    mockList.mockResolvedValue({ total: 6, documents: chatDocs(6, 0).reverse() } as never)
    const { nextCursor } = await getOlderChatMessages('jam-1', 'general', 'msg-anchor')
    expect(nextCursor).toBeNull()
  })

  it('nextCursor pointe vers le message le plus ancien du lot quand celui-ci est plein (50)', async () => {
    mockList.mockResolvedValue({ total: 200, documents: chatDocs(50, 0).reverse() } as never)
    const { nextCursor } = await getOlderChatMessages('jam-1', 'general', 'msg-anchor')
    expect(nextCursor).toBe('msg-0')
  })

  it('retourne { messages: [], nextCursor: null } si Appwrite échoue', async () => {
    mockList.mockRejectedValue(new Error('down'))
    expect(await getOlderChatMessages('jam-1', 'general', 'msg-anchor')).toEqual({ messages: [], nextCursor: null })
  })
})
