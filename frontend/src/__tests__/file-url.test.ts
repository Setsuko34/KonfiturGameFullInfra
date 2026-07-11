import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('storageFileUrl', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_APPWRITE_ENDPOINT', 'http://localhost/v1')
    vi.stubEnv('NEXT_PUBLIC_APPWRITE_PROJECT_ID', 'proj-test')
  })

  it('construit une URL de view par défaut', async () => {
    const { storageFileUrl } = await import('@/lib/appwrite/file-url')
    expect(storageFileUrl('project-assets', 'file-1')).toBe(
      'http://localhost/v1/storage/buckets/project-assets/files/file-1/view?project=proj-test'
    )
  })

  it('construit une URL de download', async () => {
    const { storageFileUrl } = await import('@/lib/appwrite/file-url')
    expect(storageFileUrl('project-builds', 'file-2', 'download')).toBe(
      'http://localhost/v1/storage/buckets/project-builds/files/file-2/download?project=proj-test'
    )
  })
})
