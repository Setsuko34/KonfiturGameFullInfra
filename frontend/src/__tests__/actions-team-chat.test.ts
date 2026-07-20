import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Query, Permission, Role } from 'node-appwrite'

vi.mock('@/lib/appwrite/server', () => ({
  serverDatabases: {
    createDocument: vi.fn(),
    listDocuments: vi.fn(),
    getDocument: vi.fn(),
    updateDocument: vi.fn(),
  },
}))

const mockAccountGet = vi.fn()
const mockSessionList = vi.fn()
vi.mock('@/lib/appwrite/session', () => ({
  createSessionClient: vi.fn(async () => ({
    account: { get: mockAccountGet },
    databases: { listDocuments: mockSessionList },
  })),
}))

// Note: fetchAllDocs is not mocked; it calls the mocked serverDatabases.listDocuments internally

import { sendTeamChatMessage, getOlderTeamChatMessages, reportTeamMessage, setTeamMessagePinned } from '@/lib/actions/team-chat'
import { serverDatabases } from '@/lib/appwrite/server'

const mockCreate = vi.mocked(serverDatabases.createDocument)
const mockList = vi.mocked(serverDatabases.listDocuments)
const mockGet = vi.mocked(serverDatabases.getDocument)
const mockUpdate = vi.mocked(serverDatabases.updateDocument)

function makeMsgDoc(fields: Record<string, unknown>) {
  return {
    $id: 'msg-1', $createdAt: '2026-07-18T10:00:00.000Z', $updatedAt: '2026-07-18T10:00:00.000Z',
    $permissions: [], $collectionId: 'team_chat_messages', $databaseId: 'konfitur-db',
    team_id: 'team-1', author_id: 'u-1', author_name: 'Alice', content: 'Salut',
    ...fields,
  }
}

function makeMemberDoc(userId: string) {
  return {
    $id: `member-${userId}`, $createdAt: '2026-01-01T00:00:00.000Z', $updatedAt: '2026-01-01T00:00:00.000Z',
    $permissions: [], $collectionId: 'team_members', $databaseId: 'konfitur-db',
    team_id: 'team-1', user_id: userId, name: userId, role: 'dev', is_leader: false,
  }
}

const membersList = (ids: string[]) =>
  ({ documents: ids.map(makeMemberDoc), total: ids.length }) as never

beforeEach(() => {
  mockCreate.mockReset()
  mockList.mockReset()
  mockGet.mockReset()
  mockUpdate.mockReset()
  mockAccountGet.mockReset()
  mockSessionList.mockReset()
})

describe('sendTeamChatMessage', () => {
  it('refuse un non-membre, aucune écriture', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'intrus', name: 'Intrus' })
    mockList.mockResolvedValueOnce(membersList(['u-1', 'u-2']))

    const res = await sendTeamChatMessage('team-1', 'coucou')

    expect(res).toEqual({ success: false, error: 'Réservé aux membres de l\'équipe.' })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('refuse un message vide après trim', async () => {
    const res = await sendTeamChatMessage('team-1', '   ')
    expect(res).toEqual({ success: false, error: 'Le message ne peut pas être vide.' })
    expect(mockList).not.toHaveBeenCalled()
  })

  it('refuse un message dont la longueur échappée dépasse 2048, sans écriture', async () => {
    // 2040 caractères, sous la limite avant échappement, mais les < → &lt; le font dépasser
    const content = '<'.repeat(10) + 'a'.repeat(2030)
    const res = await sendTeamChatMessage('team-1', content)
    expect(res).toEqual({ success: false, error: 'Le message est trop long.' })
    expect(mockList).not.toHaveBeenCalled()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('membre : crée le message avec une permission read par membre courant', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'u-1', name: 'Alice' })
    mockList.mockResolvedValueOnce(membersList(['u-1', 'u-2', 'u-3']))
    mockCreate.mockResolvedValueOnce(makeMsgDoc({}) as never)

    const res = await sendTeamChatMessage('team-1', '<b>Salut</b>')

    expect(res.success).toBe(true)
    expect(mockCreate).toHaveBeenCalledWith(
      'konfitur-db', 'team_chat_messages', 'unique()',
      expect.objectContaining({
        team_id: 'team-1',
        author_id: 'u-1',
        author_name: 'Alice',
        content: '&lt;b&gt;Salut&lt;/b&gt;', // sanitisation < >
        pinned: false,
      }),
      [
        Permission.read(Role.user('u-1')),
        Permission.read(Role.user('u-2')),
        Permission.read(Role.user('u-3')),
      ],
    )
  })

  it('sans session : refus, aucune écriture', async () => {
    mockAccountGet.mockRejectedValue(new Error('no session'))
    const res = await sendTeamChatMessage('team-1', 'coucou')
    expect(res).toEqual({ success: false, error: 'Une erreur est survenue. Réessayez.' })
    expect(mockCreate).not.toHaveBeenCalled()
  })
})

describe('getOlderTeamChatMessages', () => {
  it('non-membre : liste vide, cursor null, aucune lecture de messages', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'intrus', name: 'Intrus' })
    mockList.mockResolvedValueOnce(membersList(['u-1']))

    const res = await getOlderTeamChatMessages('team-1', 'msg-42')

    expect(res).toEqual({ messages: [], nextCursor: null })
    expect(mockList).toHaveBeenCalledTimes(1) // seulement la vérif d'appartenance
    expect(mockSessionList).not.toHaveBeenCalled() // pas de lecture messages hors appartenance
  })

  it('membre : lot incomplet → nextCursor null, messages remis en ordre chronologique', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'u-1', name: 'Alice' })
    mockList.mockResolvedValueOnce(membersList(['u-1']))
    mockSessionList.mockResolvedValueOnce({
      documents: [makeMsgDoc({ $id: 'm-2' }), makeMsgDoc({ $id: 'm-1' })],
      total: 2,
    } as never)

    const res = await getOlderTeamChatMessages('team-1', 'm-3')

    expect(res.nextCursor).toBeNull()
    expect(res.messages.map(m => m.id)).toEqual(['m-1', 'm-2'])
    // La requête porte bien le curseur et le batch de 50, sur le client session (row security)
    const queries = mockSessionList.mock.calls[0][2] as string[]
    expect(queries).toContain(Query.cursorAfter('m-3'))
    expect(queries).toContain(Query.limit(50))
  })
})

describe('reportTeamMessage', () => {
  it('membre de l\'équipe du message : pose reported', async () => {
    mockGet.mockResolvedValueOnce(makeMsgDoc({}) as never)
    mockAccountGet.mockResolvedValue({ $id: 'u-2', name: 'Bob' })
    mockList.mockResolvedValueOnce(membersList(['u-1', 'u-2']))
    mockUpdate.mockResolvedValueOnce({} as never)

    const res = await reportTeamMessage('msg-1')

    expect(res.success).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith('konfitur-db', 'team_chat_messages', 'msg-1', { reported: true })
  })

  it('non-membre : refus, aucune écriture', async () => {
    mockGet.mockResolvedValueOnce(makeMsgDoc({}) as never)
    mockAccountGet.mockResolvedValue({ $id: 'intrus', name: 'Intrus' })
    mockList.mockResolvedValueOnce(membersList(['u-1', 'u-2']))

    const res = await reportTeamMessage('msg-1')

    expect(res).toEqual({ success: false, error: 'Réservé aux membres de l\'équipe.' })
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})

describe('setTeamMessagePinned', () => {
  it('membre de l\'équipe du message : épingle', async () => {
    mockGet.mockResolvedValueOnce(makeMsgDoc({}) as never)
    mockAccountGet.mockResolvedValue({ $id: 'u-2', name: 'Bob' })
    mockList.mockResolvedValueOnce(membersList(['u-1', 'u-2']))
    mockUpdate.mockResolvedValueOnce({} as never)

    const res = await setTeamMessagePinned('msg-1', true)

    expect(res.success).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith('konfitur-db', 'team_chat_messages', 'msg-1', { pinned: true })
  })

  it('membre : désépingle', async () => {
    mockGet.mockResolvedValueOnce(makeMsgDoc({ pinned: true }) as never)
    mockAccountGet.mockResolvedValue({ $id: 'u-1', name: 'Alice' })
    mockList.mockResolvedValueOnce(membersList(['u-1']))
    mockUpdate.mockResolvedValueOnce({} as never)

    const res = await setTeamMessagePinned('msg-1', false)

    expect(res.success).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith('konfitur-db', 'team_chat_messages', 'msg-1', { pinned: false })
  })

  it('non-membre : refus, aucune écriture', async () => {
    mockGet.mockResolvedValueOnce(makeMsgDoc({}) as never)
    mockAccountGet.mockResolvedValue({ $id: 'intrus', name: 'Intrus' })
    mockList.mockResolvedValueOnce(membersList(['u-1', 'u-2']))

    const res = await setTeamMessagePinned('msg-1', true)

    expect(res).toEqual({ success: false, error: 'Réservé aux membres de l\'équipe.' })
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
