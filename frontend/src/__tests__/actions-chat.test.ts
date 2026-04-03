// frontend/src/__tests__/actions-chat.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/appwrite/server', () => ({
  serverDatabases: {
    createDocument: vi.fn(),
    listDocuments: vi.fn(),
    updateDocument: vi.fn(),
  },
}))

import { sendChatMessage } from '@/lib/actions/chat'
import { serverDatabases } from '@/lib/appwrite/server'

const mockCreate = vi.mocked(serverDatabases.createDocument)

const baseData = {
  jamId: 'jam-1',
  channel: 'general' as const,
  authorId: 'user-1',
  authorName: 'Alice',
}

beforeEach(() => {
  mockCreate.mockReset()
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
    const savedContent: string = mockCreate.mock.calls[0][3].content as string
    expect(savedContent).toContain('&lt;script&gt;')
    expect(savedContent).not.toContain('<script>')
  })

  it('échappe uniquement < et >, pas les autres caractères spéciaux', async () => {
    await sendChatMessage({ ...baseData, content: 'test & "quotes" <tag>' })
    const savedContent: string = mockCreate.mock.calls[0][3].content as string
    expect(savedContent).toBe('test & "quotes" &lt;tag&gt;')
  })
})

describe('sendChatMessage — troncature à 2048 caractères', () => {
  it('tronque les messages de plus de 2048 caractères', async () => {
    await sendChatMessage({ ...baseData, content: 'a'.repeat(3000) })
    const savedContent: string = mockCreate.mock.calls[0][3].content as string
    expect(savedContent.length).toBe(2048)
  })

  it('tronque un message de 2049 caractères à 2048', async () => {
    await sendChatMessage({ ...baseData, content: 'a'.repeat(2049) })
    const savedContent: string = mockCreate.mock.calls[0][3].content as string
    expect(savedContent.length).toBe(2048)
  })

  it('ne tronque pas les messages de 2048 caractères exactement', async () => {
    await sendChatMessage({ ...baseData, content: 'a'.repeat(2048) })
    const savedContent: string = mockCreate.mock.calls[0][3].content as string
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
