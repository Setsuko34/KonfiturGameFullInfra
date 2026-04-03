// frontend/src/__tests__/actions-profile.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mocks déclarés avant l'import des actions
// (nécessaires pour que le module s'importe sans erreur dans node)
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/appwrite/server', () => ({
  serverUsers: { delete: vi.fn() },
  serverDatabases: {},
  serverStorage: {},
  serverTeams: {},
}))

const mockAccountGet = vi.fn()
const mockUpdateName = vi.fn()
const mockUpdatePrefs = vi.fn()
const mockUpdatePassword = vi.fn()
const mockDeleteSessions = vi.fn()

vi.mock('@/lib/appwrite/session', () => ({
  createSessionClient: vi.fn(() => ({
    account: {
      get: mockAccountGet,
      updateName: mockUpdateName,
      updatePrefs: mockUpdatePrefs,
      updatePassword: mockUpdatePassword,
      deleteSessions: mockDeleteSessions,
    },
  })),
}))

import {
  updateProfileName,
  updateProfileBio,
  updateProfilePassword,
} from '@/lib/actions/profile'

// ────────────────────────────────────────────────────────────────────
// Resets & setup
// ────────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks()
  // Configurer le mock par défaut pour account.get()
  mockAccountGet.mockResolvedValue({
    $id: 'test-user',
    prefs: {},
  })
  mockUpdateName.mockResolvedValue({})
  mockUpdatePrefs.mockResolvedValue({})
  mockUpdatePassword.mockResolvedValue({})
  mockDeleteSessions.mockResolvedValue({})
})

// ────────────────────────────────────────
// updateProfileName — guards de validation
// ────────────────────────────────────────
describe('updateProfileName — validation', () => {
  it('refuse un nom vide', async () => {
    const result = await updateProfileName('')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/vide/)
  })

  it('refuse un nom composé uniquement d\'espaces', async () => {
    const result = await updateProfileName('   ')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/vide/)
  })

  it('refuse un nom de 129 caractères', async () => {
    const result = await updateProfileName('a'.repeat(129))
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/128/)
  })

  it('accepte un nom de 128 caractères exactement', async () => {
    const result = await updateProfileName('a'.repeat(128))
    // Le guard passe, l'appel Appwrite est mocké → succès
    expect(result.success).toBe(true)
  })
})

// ────────────────────────────────────────
// updateProfileBio — guards de validation
// ────────────────────────────────────────
describe('updateProfileBio — validation', () => {
  it('refuse une bio de 301 caractères', async () => {
    const result = await updateProfileBio('x'.repeat(301))
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/300/)
  })

  it('accepte une bio de 300 caractères exactement', async () => {
    const result = await updateProfileBio('x'.repeat(300))
    expect(result.success).toBe(true)
  })

  it('accepte une bio vide (suppression)', async () => {
    const result = await updateProfileBio('')
    expect(result.success).toBe(true)
  })

  it('refuse une bio de 301 espaces (la validation précède le trim)', async () => {
    const result = await updateProfileBio(' '.repeat(301))
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/300/)
  })
})

// ────────────────────────────────────────
// updateProfilePassword — guards de validation
// ────────────────────────────────────────
describe('updateProfilePassword — validation', () => {
  it('refuse un nouveau mot de passe de moins de 8 caractères', async () => {
    const result = await updateProfilePassword('ancien123', 'court')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/8/)
  })

  it('accepte un mot de passe de 8 caractères exactement', async () => {
    const result = await updateProfilePassword('ancien123', '12345678')
    expect(result.success).toBe(true)
  })
})
