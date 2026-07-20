// frontend/src/__tests__/actions-chat.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Query } from 'node-appwrite'

vi.mock('@/lib/appwrite/server', () => ({
  serverDatabases: {
    createDocument: vi.fn(),
    listDocuments: vi.fn(),
    getDocument: vi.fn(),
    updateDocument: vi.fn(),
  },
  serverTeams: {
    listMemberships: vi.fn(),
  },
}))

const mockAccountGet = vi.fn()
vi.mock('@/lib/appwrite/session', () => ({
  createSessionClient: vi.fn(async () => ({ account: { get: mockAccountGet } })),
}))

import { sendChatMessage, getOlderChatMessages, reportMessage, setJamMessagePinned } from '@/lib/actions/chat'
import { serverDatabases, serverTeams } from '@/lib/appwrite/server'

const mockCreate = vi.mocked(serverDatabases.createDocument)
const mockList = vi.mocked(serverDatabases.listDocuments)
const mockGet = vi.mocked(serverDatabases.getDocument)
const mockUpdate = vi.mocked(serverDatabases.updateDocument)
const mockMemberships = vi.mocked(serverTeams.listMemberships)

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

beforeEach(() => {
  mockCreate.mockReset()
  mockList.mockReset()
  mockGet.mockReset()
  mockUpdate.mockReset()
  mockMemberships.mockReset()
  mockAccountGet.mockReset()
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

describe('sendChatMessage', () => {
  it('utilisateur connecté : crée le message avec l\'identité de la session, role user, contenu échappé', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'user-1', name: 'Alice' })

    const res = await sendChatMessage('jam-1', 'general', '<b>Salut</b>')

    expect(res.success).toBe(true)
    expect(mockCreate).toHaveBeenCalledWith(
      'konfitur-db', 'chat_messages', 'unique()',
      expect.objectContaining({
        jam_id: 'jam-1',
        channel: 'general',
        author_id: 'user-1',
        author_name: 'Alice',
        content: '&lt;b&gt;Salut&lt;/b&gt;',
        role: 'user',
        pinned: false,
      })
    )
  })

  it('refuse un message vide après trim, sans écriture', async () => {
    const res = await sendChatMessage('jam-1', 'general', '   ')
    expect(res).toEqual({ success: false, error: 'Le message ne peut pas être vide.' })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('refuse un message dont la longueur échappée dépasse 2048, sans écriture', async () => {
    const content = '<'.repeat(10) + 'a'.repeat(2030)
    const res = await sendChatMessage('jam-1', 'general', content)
    expect(res).toEqual({ success: false, error: 'Le message est trop long.' })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('sans session : refus avec message générique français, aucune écriture', async () => {
    mockAccountGet.mockRejectedValue(new Error('no session'))
    const res = await sendChatMessage('jam-1', 'general', 'coucou')
    expect(res).toEqual({ success: false, error: 'Une erreur est survenue. Réessayez.' })
    expect(mockCreate).not.toHaveBeenCalled()
  })
})

describe('reportMessage', () => {
  it('utilisateur connecté : pose reported', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'user-2', name: 'Bob' })
    mockUpdate.mockResolvedValueOnce({} as never)

    const res = await reportMessage('msg-1')

    expect(res.success).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith('konfitur-db', 'chat_messages', 'msg-1', { reported: true })
  })

  it('sans session : refus, aucune écriture', async () => {
    mockAccountGet.mockRejectedValue(new Error('no session'))
    const res = await reportMessage('msg-1')
    expect(res.success).toBe(false)
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})

describe('setJamMessagePinned', () => {
  const msgDoc = { $id: 'msg-1', jam_id: 'jam-1', channel: 'general', content: 'x' }
  const jamDoc = { $id: 'jam-1', organizer_id: 'orga-1' }

  it('organisateur de la jam : épingle, sans audit admin', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'orga-1', name: 'Orga' })
    mockGet
      .mockResolvedValueOnce(msgDoc as never)   // le message
      .mockResolvedValueOnce(jamDoc as never)   // sa jam
    mockUpdate.mockResolvedValueOnce({} as never)

    const res = await setJamMessagePinned('msg-1', true)

    expect(res.success).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith('konfitur-db', 'chat_messages', 'msg-1', { pinned: true })
    expect(mockMemberships).not.toHaveBeenCalled() // court-circuit propriétaire
  })

  it('admin non-organisateur : désépingle + audit admin_action', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'admin-1', name: 'Admin' })
    mockGet
      .mockResolvedValueOnce(msgDoc as never)
      .mockResolvedValueOnce(jamDoc as never)
    mockMemberships.mockResolvedValueOnce({ total: 1, memberships: [] } as never)
    mockUpdate.mockResolvedValueOnce({} as never)
    mockCreate.mockResolvedValueOnce({} as never) // logAdminAction écrit dans audit_logs

    const res = await setJamMessagePinned('msg-1', false)

    expect(res.success).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith('konfitur-db', 'chat_messages', 'msg-1', { pinned: false })
    expect(mockCreate).toHaveBeenCalledWith(
      'konfitur-db', 'audit_logs', 'unique()',
      expect.objectContaining({ type: 'admin_action', user_id: 'admin-1' })
    )
  })

  it('simple participant : refus, aucune écriture', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'quidam', name: 'Quidam' })
    mockGet
      .mockResolvedValueOnce(msgDoc as never)
      .mockResolvedValueOnce(jamDoc as never)
    mockMemberships.mockResolvedValueOnce({ total: 0, memberships: [] } as never)

    const res = await setJamMessagePinned('msg-1', true)

    expect(res).toEqual({ success: false, error: 'Réservé à l\'organisateur de la jam.' })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('sans session : refus, aucune écriture', async () => {
    mockAccountGet.mockRejectedValue(new Error('no session'))
    const res = await setJamMessagePinned('msg-1', true)
    expect(res.success).toBe(false)
    expect(mockUpdate).not.toHaveBeenCalled()
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
