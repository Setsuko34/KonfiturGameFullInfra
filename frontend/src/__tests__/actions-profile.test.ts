// frontend/src/__tests__/actions-profile.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock du SDK browser — déclaré avant l'import des actions
const mockUpdateName = vi.fn()
const mockGetPrefs = vi.fn()
const mockUpdatePrefs = vi.fn()
const mockUpdatePassword = vi.fn()

vi.mock('@/lib/appwrite/client', () => ({
  account: {
    updateName: (...args: unknown[]) => mockUpdateName(...args),
    getPrefs: (...args: unknown[]) => mockGetPrefs(...args),
    updatePrefs: (...args: unknown[]) => mockUpdatePrefs(...args),
    updatePassword: (...args: unknown[]) => mockUpdatePassword(...args),
  },
}))

import { updateProfileClient, updatePasswordClient } from '@/lib/actions/profile.client'

// État courant du profil — les actions ne poussent que les champs modifiés
const current = { name: 'Ancien Nom', bio: 'Ancienne bio' }

beforeEach(() => {
  vi.clearAllMocks()
  mockUpdateName.mockResolvedValue({})
  mockGetPrefs.mockResolvedValue({})
  mockUpdatePrefs.mockResolvedValue({})
  mockUpdatePassword.mockResolvedValue({})
})

// ────────────────────────────────────────
// updateProfileClient — validation du nom
// ────────────────────────────────────────
describe('updateProfileClient — validation du nom', () => {
  it('refuse un nom vide', async () => {
    const result = await updateProfileClient('', '', current)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/vide/)
  })

  it("refuse un nom composé uniquement d'espaces", async () => {
    const result = await updateProfileClient('   ', '', current)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/vide/)
  })

  it('refuse un nom de 129 caractères', async () => {
    const result = await updateProfileClient('a'.repeat(129), '', current)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/128/)
  })

  it('accepte un nom de 128 caractères exactement', async () => {
    // Le guard passe, l'appel Appwrite est mocké → succès
    const result = await updateProfileClient('a'.repeat(128), '', current)
    expect(result.success).toBe(true)
    expect(mockUpdateName).toHaveBeenCalledWith('a'.repeat(128))
  })

  it("n'appelle pas updateName si le nom est inchangé", async () => {
    const result = await updateProfileClient(current.name, current.bio, current)
    expect(result.success).toBe(true)
    expect(mockUpdateName).not.toHaveBeenCalled()
  })
})

// ────────────────────────────────────────
// updateProfileClient — validation de la bio
// ────────────────────────────────────────
describe('updateProfileClient — validation de la bio', () => {
  it('refuse une bio de 301 caractères', async () => {
    const result = await updateProfileClient('Nom', 'x'.repeat(301), current)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/300/)
  })

  it('accepte une bio de 300 caractères exactement', async () => {
    const result = await updateProfileClient('Nom', 'x'.repeat(300), current)
    expect(result.success).toBe(true)
  })

  it('accepte une bio vide (suppression)', async () => {
    const result = await updateProfileClient('Nom', '', current)
    expect(result.success).toBe(true)
  })

  it('refuse une bio de 301 espaces (la validation précède le trim)', async () => {
    const result = await updateProfileClient('Nom', ' '.repeat(301), current)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/300/)
  })

  it('préserve les prefs existantes lors de la mise à jour de la bio', async () => {
    mockGetPrefs.mockResolvedValue({ theme: 'dark', bio: current.bio })
    const result = await updateProfileClient(current.name, 'Nouvelle bio', current)
    expect(result.success).toBe(true)
    expect(mockUpdatePrefs).toHaveBeenCalledWith({ theme: 'dark', bio: 'Nouvelle bio' })
  })
})

// ────────────────────────────────────────
// updatePasswordClient — validation
// ────────────────────────────────────────
describe('updatePasswordClient — validation', () => {
  it('refuse un nouveau mot de passe de moins de 8 caractères', async () => {
    const result = await updatePasswordClient('ancien123', 'court')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/8/)
  })

  it('accepte un mot de passe de 8 caractères exactement', async () => {
    const result = await updatePasswordClient('ancien123', '12345678')
    expect(result.success).toBe(true)
    expect(mockUpdatePassword).toHaveBeenCalledWith('12345678', 'ancien123')
  })

  it("renvoie l'erreur Appwrite en cas d'échec", async () => {
    mockUpdatePassword.mockRejectedValue(new Error('Mot de passe actuel invalide'))
    const result = await updatePasswordClient('mauvais', '12345678')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/invalide/)
  })
})
