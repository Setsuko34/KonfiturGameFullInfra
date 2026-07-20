import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Query } from 'node-appwrite'

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

// n commentaires minimaux, chacun avec un $id unique, pour tester la pagination au curseur
function commentDocs(n: number, offset = 0) {
  return Array.from({ length: n }, (_, i) => ({ ...commentDoc, $id: `com-${offset + i}` }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAccountGet.mockResolvedValue({ $id: 'user-1', name: 'Alice' })
})

describe('getCommentsByProject', () => {
  it('retourne les commentaires mappés', async () => {
    mockList.mockResolvedValue({ total: 1, documents: [commentDoc] } as never)
    const { comments } = await getCommentsByProject('proj-1')
    expect(comments).toHaveLength(1)
    expect(comments[0].authorName).toBe('Alice')
  })

  it('retourne { comments: [], nextCursor: null } si Appwrite échoue', async () => {
    mockList.mockRejectedValue(new Error('down'))
    expect(await getCommentsByProject('proj-1')).toEqual({ comments: [], nextCursor: null })
  })

  it('nextCursor est null quand le lot revient incomplet (moins de 100)', async () => {
    mockList.mockResolvedValue({ total: 6, documents: commentDocs(6) } as never)
    const { nextCursor } = await getCommentsByProject('proj-1')
    expect(nextCursor).toBeNull()
  })

  it('nextCursor pointe vers le dernier document quand le lot est plein (100)', async () => {
    mockList.mockResolvedValue({ total: 200, documents: commentDocs(100) } as never)
    const { nextCursor } = await getCommentsByProject('proj-1')
    expect(nextCursor).toBe('com-99')
  })

  it('transmet le curseur reçu via Query.cursorAfter à Appwrite', async () => {
    mockList.mockResolvedValue({ total: 6, documents: commentDocs(6, 100) } as never)
    await getCommentsByProject('proj-1', 'com-99')
    const queries = mockList.mock.calls[0][2] as string[]
    expect(queries).toContain(Query.cursorAfter('com-99'))
  })

  it('le second lot ne contient pas le dernier document du premier', async () => {
    mockList
      .mockResolvedValueOnce({ total: 150, documents: commentDocs(100, 0) } as never)
      .mockResolvedValueOnce({ total: 150, documents: commentDocs(50, 100) } as never)

    const first = await getCommentsByProject('proj-1')
    expect(first.nextCursor).toBe('com-99')

    const second = await getCommentsByProject('proj-1', first.nextCursor!)
    expect(second.comments.some(c => c.id === 'com-99')).toBe(false)
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
