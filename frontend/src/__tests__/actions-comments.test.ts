import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/appwrite/server', () => ({
  serverDatabases: {
    createDocument: vi.fn(),
    listDocuments: vi.fn(),
  },
}))

const mockAccountGet = vi.fn()
vi.mock('@/lib/appwrite/session', () => ({
  createSessionClient: vi.fn(async () => ({ account: { get: mockAccountGet } })),
}))

import { getCommentsByProject, addComment } from '@/lib/actions/comments'
import { serverDatabases } from '@/lib/appwrite/server'

const mockList = vi.mocked(serverDatabases.listDocuments)
const mockCreate = vi.mocked(serverDatabases.createDocument)

const commentDoc = {
  $id: 'com-1',
  project_id: 'proj-1',
  author_id: 'user-1',
  author_name: 'Alice',
  content: 'Super projet',
  $createdAt: '2026-07-16T10:00:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAccountGet.mockResolvedValue({ $id: 'user-1', name: 'Alice' })
})

describe('getCommentsByProject', () => {
  it('retourne les commentaires mappés', async () => {
    mockList.mockResolvedValue({ total: 1, documents: [commentDoc] } as never)
    const comments = await getCommentsByProject('proj-1')
    expect(comments).toHaveLength(1)
    expect(comments[0].authorName).toBe('Alice')
  })

  it('retourne [] si Appwrite échoue', async () => {
    mockList.mockRejectedValue(new Error('down'))
    expect(await getCommentsByProject('proj-1')).toEqual([])
  })
})

describe('addComment', () => {
  it('refuse un commentaire vide (espaces uniquement) sans écrire', async () => {
    const res = await addComment({ projectId: 'proj-1', content: '   ' })
    expect(res.success).toBe(false)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('échappe < et > (anti-XSS) avant écriture', async () => {
    mockCreate.mockResolvedValue({ ...commentDoc, content: '&lt;script&gt;' } as never)
    await addComment({ projectId: 'proj-1', content: '<script>' })
    const payload = mockCreate.mock.calls[0][3] as { content: string }
    expect(payload.content).toBe('&lt;script&gt;')
  })

  it('tronque le contenu à 2048 caractères', async () => {
    mockCreate.mockResolvedValue(commentDoc as never)
    await addComment({ projectId: 'proj-1', content: 'a'.repeat(3000) })
    const payload = mockCreate.mock.calls[0][3] as { content: string }
    expect(payload.content).toHaveLength(2048)
  })

  it("retourne success + commentaire mappé, signé de l'utilisateur en session", async () => {
    mockCreate.mockResolvedValue(commentDoc as never)
    const res = await addComment({ projectId: 'proj-1', content: 'Super projet' })
    expect(res.success).toBe(true)
    expect(res.comment?.id).toBe('com-1')
    const payload = mockCreate.mock.calls[0][3] as { author_id: string }
    expect(payload.author_id).toBe('user-1')
  })

  it('retourne success: false sans session', async () => {
    mockAccountGet.mockRejectedValue(new Error('no session'))
    const res = await addComment({ projectId: 'proj-1', content: 'test' })
    expect(res.success).toBe(false)
  })
})
