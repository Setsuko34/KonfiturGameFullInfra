import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/appwrite/server', () => ({
  serverDatabases: {
    createDocument: vi.fn(),
    listDocuments: vi.fn(),
    getDocument: vi.fn(),
    updateDocument: vi.fn(),
    deleteDocument: vi.fn(),
  },
  serverStorage: {
    getFile: vi.fn(),
    updateFile: vi.fn(),
    deleteFile: vi.fn(),
  },
}))

const mockAccountGet = vi.fn()
vi.mock('@/lib/appwrite/session', () => ({
  createSessionClient: vi.fn(async () => ({ account: { get: mockAccountGet } })),
}))

import { toggleLike, submitProject } from '@/lib/actions/projects'
import { serverDatabases, serverStorage } from '@/lib/appwrite/server'

const mockCreate = vi.mocked(serverDatabases.createDocument)
const mockList = vi.mocked(serverDatabases.listDocuments)
const mockUpdate = vi.mocked(serverDatabases.updateDocument)
const mockDelete = vi.mocked(serverDatabases.deleteDocument)
const mockGetFile = vi.mocked(serverStorage.getFile)
const mockUpdateFile = vi.mocked(serverStorage.updateFile)
const mockDeleteFile = vi.mocked(serverStorage.deleteFile)

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

describe('submitProject — verrou fichiers', () => {
  const membership = { documents: [{ $id: 'm1' }], total: 1 }
  const noProject = { documents: [], total: 0 }

  it("refuse si l'utilisateur n'est pas membre de l'équipe", async () => {
    mockAccountGet.mockResolvedValue({ $id: 'user-1' } as never)
    mockList.mockResolvedValueOnce({ documents: [], total: 0 } as never) // team_members
    const res = await submitProject({ jamId: 'j1', teamId: 't1', title: 'X', description: 'D', technologies: [] })
    expect(res.success).toBe(false)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('refuse un fichier appartenant à un autre utilisateur', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'user-1' } as never)
    mockList.mockResolvedValueOnce(membership as never) // team_members — le check fichier échoue avant la requête "projet existant"
    mockGetFile.mockResolvedValue({ $id: 'f1', bucketId: 'project-builds', $permissions: ['read("user:AUTRE")'] } as never)
    const res = await submitProject({ jamId: 'j1', teamId: 't1', title: 'X', description: 'D', technologies: [], buildFileId: 'f1' })
    expect(res.success).toBe(false)
    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockUpdateFile).not.toHaveBeenCalled()
  })

  it('lie les fichiers, ouvre la lecture publique et enregistre les IDs', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'user-1' } as never)
    mockList
      .mockResolvedValueOnce(membership as never) // team_members
      .mockResolvedValueOnce(noProject as never) // projet existant
    mockGetFile.mockResolvedValue({ $id: 'f1', bucketId: 'project-builds', $permissions: ['read("user:user-1")'] } as never)
    mockCreate.mockResolvedValue({ $id: 'p1' } as never)
    mockUpdateFile.mockResolvedValue({} as never)
    const res = await submitProject({ jamId: 'j1', teamId: 't1', title: 'X', description: 'D', technologies: [], buildFileId: 'f1' })
    expect(res).toEqual({ success: true, projectId: 'p1' })
    expect(mockUpdateFile).toHaveBeenCalledOnce() // lecture publique du build
    expect(mockUpdateFile).toHaveBeenCalledWith('project-builds', 'f1', undefined, [
      'read("any")',
      'update("user:user-1")',
      'delete("user:user-1")',
    ])
    expect(mockCreate.mock.calls[0][3]).toMatchObject({ build_file_id: 'f1' })
  })

  it("supprime l'ancien build lors d'un remplacement", async () => {
    mockAccountGet.mockResolvedValue({ $id: 'user-1' } as never)
    mockList
      .mockResolvedValueOnce(membership as never) // team_members
      .mockResolvedValueOnce({ documents: [{ $id: 'p1', build_file_id: 'OLD' }], total: 1 } as never) // projet existant
    mockGetFile.mockResolvedValue({ $id: 'NEW', bucketId: 'project-builds', $permissions: ['read("user:user-1")'] } as never)
    mockUpdate.mockResolvedValue({ $id: 'p1' } as never)
    mockUpdateFile.mockResolvedValue({} as never)
    mockDeleteFile.mockResolvedValue({} as never)
    const res = await submitProject({ jamId: 'j1', teamId: 't1', title: 'X', description: 'D', technologies: [], buildFileId: 'NEW' })
    expect(res.success).toBe(true)
    expect(mockDeleteFile).toHaveBeenCalledWith('project-builds', 'OLD')
  })

  it('délie le build en base quand il est retiré (aucun buildFileId transmis)', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'user-1' } as never)
    mockList
      .mockResolvedValueOnce(membership as never) // team_members
      .mockResolvedValueOnce({ documents: [{ $id: 'p1', build_file_id: 'OLD' }], total: 1 } as never) // projet existant
    mockUpdate.mockResolvedValue({ $id: 'p1' } as never)
    const res = await submitProject({ jamId: 'j1', teamId: 't1', title: 'X', description: 'D', technologies: [] })
    expect(res.success).toBe(true)
    // Aucun fichier transmis → pas de vérification de propriété ni suppression de l'ancien
    // (la suppression du fichier réel est gérée côté client par FileUploadField.handleRemove)
    expect(mockGetFile).not.toHaveBeenCalled()
    expect(mockDeleteFile).not.toHaveBeenCalled()
    expect(mockUpdate).toHaveBeenCalledWith('konfitur-db', 'projects', 'p1', expect.objectContaining({
      build_file_id: null,
    }))
  })
})
