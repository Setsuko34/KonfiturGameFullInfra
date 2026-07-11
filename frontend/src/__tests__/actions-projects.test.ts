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

import { toggleLike, submitProject, reportProject } from '@/lib/actions/projects'
import { serverDatabases, serverStorage } from '@/lib/appwrite/server'

const mockCreate = vi.mocked(serverDatabases.createDocument)
const mockList = vi.mocked(serverDatabases.listDocuments)
const mockUpdate = vi.mocked(serverDatabases.updateDocument)
const mockDelete = vi.mocked(serverDatabases.deleteDocument)
const mockGet = vi.mocked(serverDatabases.getDocument)
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

  beforeEach(() => {
    mockGet.mockImplementation((async (_db: string, col: string) =>
      col === 'game_jams'
        ? { $id: 'j1', status: 'ongoing' }
        : { $id: 't1', jam_ids: ['j1'] }
    ) as never) // jam en cours + équipe inscrite par défaut
  })

  it("refuse si l'utilisateur n'est pas membre de l'équipe", async () => {
    mockAccountGet.mockResolvedValue({ $id: 'user-1' } as never)
    mockList.mockResolvedValueOnce({ documents: [], total: 0 } as never) // team_members
    const res = await submitProject({ jamId: 'j1', teamId: 't1', title: 'X', description: 'D', technologies: [] })
    expect(res.success).toBe(false)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('refuse un fichier appartenant à un autre utilisateur', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'user-1' } as never)
    mockList
      .mockResolvedValueOnce(membership as never) // team_members
      .mockResolvedValueOnce(noProject as never) // projet existant — le check fichier passe après cette requête
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

  it('délie ET supprime le build retiré (aucun buildFileId transmis)', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'user-1' } as never)
    mockList
      .mockResolvedValueOnce(membership as never) // team_members
      .mockResolvedValueOnce({ documents: [{ $id: 'p1', build_file_id: 'OLD', cover_image_id: null, screenshot_ids: [] }], total: 1 } as never) // projet existant
    mockUpdate.mockResolvedValue({ $id: 'p1' } as never)
    mockDeleteFile.mockResolvedValue({} as never)
    const res = await submitProject({ jamId: 'j1', teamId: 't1', title: 'X', description: 'D', technologies: [] })
    expect(res.success).toBe(true)
    expect(mockGetFile).not.toHaveBeenCalled() // aucun fichier transmis → pas de check
    expect(mockDeleteFile).toHaveBeenCalledWith('project-builds', 'OLD') // retiré → supprimé côté serveur
    expect(mockUpdate).toHaveBeenCalledWith('konfitur-db', 'projects', 'p1', expect.objectContaining({
      build_file_id: null,
    }))
  })

  it('supprime les screenshots retirés ou remplacés, conserve les gardés', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'user-1' } as never)
    mockList
      .mockResolvedValueOnce(membership as never) // team_members
      .mockResolvedValueOnce({ documents: [{ $id: 'p1', build_file_id: null, cover_image_id: null, screenshot_ids: ['s1', 's2'] }], total: 1 } as never) // projet existant
    mockGetFile.mockResolvedValue({ $id: 's3', bucketId: 'project-assets', $permissions: ['read("user:user-1")'] } as never) // s3 est nouveau
    mockUpdate.mockResolvedValue({ $id: 'p1' } as never)
    mockUpdateFile.mockResolvedValue({} as never)
    mockDeleteFile.mockResolvedValue({} as never)
    const res = await submitProject({ jamId: 'j1', teamId: 't1', title: 'X', description: 'D', technologies: [], screenshotIds: ['s1', 's3'] }) // garde s1, retire s2, ajoute s3
    expect(res.success).toBe(true)
    expect(mockDeleteFile).toHaveBeenCalledTimes(1)
    expect(mockDeleteFile).toHaveBeenCalledWith('project-assets', 's2') // s2 retiré → supprimé ; s1 gardé → intact
  })

  it("accepte les fichiers déjà liés au projet, resoumis par un coéquipier", async () => {
    mockAccountGet.mockResolvedValue({ $id: 'user-2' } as never) // coéquipier ≠ uploader d'origine
    mockList
      .mockResolvedValueOnce(membership as never) // team_members
      .mockResolvedValueOnce({ documents: [{ $id: 'p1', build_file_id: 'f1', cover_image_id: 'c1', screenshot_ids: ['s1'] }], total: 1 } as never) // projet existant
    mockUpdate.mockResolvedValue({ $id: 'p1' } as never)
    const res = await submitProject({
      jamId: 'j1', teamId: 't1', title: 'X', description: 'D', technologies: [],
      buildFileId: 'f1', coverFileId: 'c1', screenshotIds: ['s1'],
    })
    expect(res).toEqual({ success: true, projectId: 'p1' })
    expect(mockGetFile).not.toHaveBeenCalled()    // exemptés du check de propriété
    expect(mockUpdateFile).not.toHaveBeenCalled() // pas de re-grant (propriété inchangée)
    expect(mockDeleteFile).not.toHaveBeenCalled() // rien remplacé
  })

  it("refuse toujours un fichier non lié appartenant à autrui, même sur un projet existant", async () => {
    mockAccountGet.mockResolvedValue({ $id: 'user-2' } as never)
    mockList
      .mockResolvedValueOnce(membership as never) // team_members
      .mockResolvedValueOnce({ documents: [{ $id: 'p1', build_file_id: 'ANCIEN', cover_image_id: null, screenshot_ids: [] }], total: 1 } as never) // projet existant
    mockGetFile.mockResolvedValue({ $id: 'VOLE', bucketId: 'project-builds', $permissions: ['read("user:AUTRE")'] } as never)
    const res = await submitProject({ jamId: 'j1', teamId: 't1', title: 'X', description: 'D', technologies: [], buildFileId: 'VOLE' })
    expect(res.success).toBe(false)
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockUpdateFile).not.toHaveBeenCalled()
  })

  it("refuse l'id de la cover passé dans le slot build (pas d'exemption cross-slot)", async () => {
    mockAccountGet.mockResolvedValue({ $id: 'user-2' } as never)
    mockList
      .mockResolvedValueOnce(membership as never) // team_members
      .mockResolvedValueOnce({ documents: [{ $id: 'p1', build_file_id: 'b1', cover_image_id: 'c1', screenshot_ids: [] }], total: 1 } as never) // projet existant
    mockGetFile.mockRejectedValue(new Error('File not found')) // c1 n'existe pas dans project-builds
    const res = await submitProject({ jamId: 'j1', teamId: 't1', title: 'X', description: 'D', technologies: [], buildFileId: 'c1' })
    expect(res.success).toBe(false)
    expect(mockGetFile).toHaveBeenCalledWith('project-builds', 'c1') // PAS exempté → vérifié dans le bon bucket
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockDeleteFile).not.toHaveBeenCalled() // le vrai build b1 n'est pas supprimé
  })

  it("refuse si l'équipe n'est pas inscrite à la jam", async () => {
    mockAccountGet.mockResolvedValue({ $id: 'user-1' } as never)
    mockGet.mockImplementation((async (_db: string, col: string) =>
      col === 'game_jams'
        ? { $id: 'j1', status: 'ongoing' }
        : { $id: 't1', jam_ids: ['AUTRE-JAM'] } // équipe inscrite ailleurs, pas à j1
    ) as never)
    mockList.mockResolvedValueOnce(membership as never) // team_members
    const res = await submitProject({ jamId: 'j1', teamId: 't1', title: 'X', description: 'D', technologies: [] })
    expect(res.success).toBe(false)
    expect(res.error).toBe('Cette équipe n\'est pas inscrite à cette jam.')
    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("refuse si l'équipe n'a aucune jam (jam_ids vide)", async () => {
    mockAccountGet.mockResolvedValue({ $id: 'user-1' } as never)
    mockGet.mockImplementation((async (_db: string, col: string) =>
      col === 'game_jams' ? { $id: 'j1', status: 'ongoing' } : { $id: 't1', jam_ids: [] }
    ) as never)
    mockList.mockResolvedValueOnce(membership as never)
    const res = await submitProject({ jamId: 'j1', teamId: 't1', title: 'X', description: 'D', technologies: [] })
    expect(res.success).toBe(false)
    expect(res.error).toBe('Cette équipe n\'est pas inscrite à cette jam.')
    expect(mockList).toHaveBeenCalledTimes(1) // s'arrête au check d'inscription, pas plus loin
    expect(mockCreate).not.toHaveBeenCalled()
  })
})

describe('submitProject — verrou temporel', () => {
  it('refuse la soumission si la jam est terminée', async () => {
    mockGet.mockResolvedValue({ $id: 'j1', status: 'ended' } as never)
    const res = await submitProject({ jamId: 'j1', teamId: 't1', title: 'X', description: 'D', technologies: [] })
    expect(res.success).toBe(false)
    expect(res.error).toBe('La jam n\'est pas en cours — le projet est figé.')
    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("refuse la soumission si la jam n'a pas commencé", async () => {
    mockGet.mockResolvedValue({ $id: 'j1', status: 'upcoming' } as never)
    const res = await submitProject({ jamId: 'j1', teamId: 't1', title: 'X', description: 'D', technologies: [] })
    expect(res.success).toBe(false)
    expect(res.error).toBe('La jam n\'est pas en cours — le projet est figé.')
    expect(mockList).not.toHaveBeenCalled() // le verrou court-circuite avant le check d'équipe
    expect(mockCreate).not.toHaveBeenCalled()
  })
})

describe('reportProject', () => {
  it('refuse sans session authentifiée', async () => {
    mockAccountGet.mockRejectedValue(new Error('missing scope (account)'))
    const res = await reportProject('proj-1')
    expect(res.success).toBe(false)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('ne fuit pas le message d\'erreur interne', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'user-1' } as never)
    mockUpdate.mockRejectedValue(new Error('Internal: connection to mariadb:3306 refused'))
    const res = await reportProject('proj-1')
    expect(res.success).toBe(false)
    expect(res.error).not.toContain('mariadb')
    expect(res.error).toBe('Une erreur est survenue lors du signalement.')
  })

  it('signale le projet avec une session valide', async () => {
    mockAccountGet.mockResolvedValue({ $id: 'user-1' } as never)
    mockUpdate.mockResolvedValue({} as never)
    const res = await reportProject('proj-1')
    expect(res).toEqual({ success: true })
    expect(mockUpdate).toHaveBeenCalledWith('konfitur-db', 'projects', 'proj-1', { reported: true })
  })
})
