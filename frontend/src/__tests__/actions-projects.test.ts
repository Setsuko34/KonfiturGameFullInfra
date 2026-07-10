import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/appwrite/server', () => ({
  serverDatabases: {
    createDocument: vi.fn(),
    listDocuments: vi.fn(),
    getDocument: vi.fn(),
    updateDocument: vi.fn(),
    deleteDocument: vi.fn(),
  },
}))

const mockAccountGet = vi.fn()
vi.mock('@/lib/appwrite/session', () => ({
  createSessionClient: vi.fn(async () => ({ account: { get: mockAccountGet } })),
}))

import { toggleLike } from '@/lib/actions/projects'
import { serverDatabases } from '@/lib/appwrite/server'

const mockCreate = vi.mocked(serverDatabases.createDocument)
const mockList = vi.mocked(serverDatabases.listDocuments)
const mockUpdate = vi.mocked(serverDatabases.updateDocument)
const mockDelete = vi.mocked(serverDatabases.deleteDocument)

beforeEach(() => {
  vi.clearAllMocks()
  mockAccountGet.mockResolvedValue({ $id: 'user-1' })
})

describe('toggleLike', () => {
  it("ajoute un like quand aucun n'existe (recomptage)", async () => {
    mockList
      .mockResolvedValueOnce({ documents: [], total: 0 } as never) // existence
      .mockResolvedValueOnce({ documents: [], total: 3 } as never) // recomptage
    mockCreate.mockResolvedValue({ $id: 'like-1' } as never)
    mockUpdate.mockResolvedValue({} as never)

    const res = await toggleLike('proj-1')

    expect(res).toEqual({ success: true, liked: true, likesCount: 3 })
    expect(mockCreate).toHaveBeenCalledOnce()
    expect(mockDelete).not.toHaveBeenCalled()
    expect(mockUpdate).toHaveBeenCalledWith('konfitur-db', 'projects', 'proj-1', {
      likes_count: 3,
    })
  })

  it('retire le like existant (recomptage)', async () => {
    mockList
      .mockResolvedValueOnce({ documents: [{ $id: 'like-1' }], total: 1 } as never) // existence
      .mockResolvedValueOnce({ documents: [], total: 0 } as never) // recomptage
    mockDelete.mockResolvedValue({} as never)
    mockUpdate.mockResolvedValue({} as never)

    const res = await toggleLike('proj-1')

    expect(res).toEqual({ success: true, liked: false, likesCount: 0 })
    expect(mockDelete).toHaveBeenCalledWith('konfitur-db', 'likes', 'like-1')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('échoue proprement sans session', async () => {
    mockAccountGet.mockRejectedValue(new Error('missing scope (account)'))

    const res = await toggleLike('proj-1')

    expect(res).toEqual({
      success: false,
      liked: false,
      likesCount: 0,
      error: 'missing scope (account)',
    })
    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockDelete).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
