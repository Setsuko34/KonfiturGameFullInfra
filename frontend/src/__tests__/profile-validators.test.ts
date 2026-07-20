import { describe, it, expect } from 'vitest'
import { validateUpdateJamData, validateAnnouncementData } from '@/lib/validators'

describe('validateUpdateJamData', () => {
  it('accepte des champs valides', () => {
    const result = validateUpdateJamData({ description: 'texte', rules: ['règle 1'] })
    expect(result.valid).toBe(true)
  })

  it('refuse les champs non autorisés', () => {
    const result = validateUpdateJamData({ title: 'nouveau titre' } as never)
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/champ.*non autorisé/i)
  })

  it('refuse une description vide', () => {
    const result = validateUpdateJamData({ description: '' })
    expect(result.valid).toBe(false)
  })

  it('refuse plus de 20 règles', () => {
    const result = validateUpdateJamData({ rules: Array(21).fill('règle') })
    expect(result.valid).toBe(false)
  })
})

describe('validateAnnouncementData', () => {
  it('accepte des données valides', () => {
    const result = validateAnnouncementData({ title: 'Titre', content: 'Contenu', important: false })
    expect(result.valid).toBe(true)
  })

  it('refuse un titre vide', () => {
    const result = validateAnnouncementData({ title: '', content: 'Contenu', important: false })
    expect(result.valid).toBe(false)
  })

  it('refuse un contenu > 2000 chars', () => {
    const result = validateAnnouncementData({ title: 'T', content: 'x'.repeat(2001), important: false })
    expect(result.valid).toBe(false)
  })

  it('refuse un titre > 100 chars', () => {
    const result = validateAnnouncementData({ title: 'x'.repeat(101), content: 'contenu', important: false })
    expect(result.valid).toBe(false)
  })
})

describe('validateUpdateJamData — maxParticipants', () => {
  it('accepte une valeur limite basse (2)', () => {
    const result = validateUpdateJamData({ maxParticipants: 2 })
    expect(result.valid).toBe(true)
  })

  it('accepte une valeur limite haute (10000)', () => {
    const result = validateUpdateJamData({ maxParticipants: 10000 })
    expect(result.valid).toBe(true)
  })

  it('accepte une valeur intermédiaire (50)', () => {
    const result = validateUpdateJamData({ maxParticipants: 50 })
    expect(result.valid).toBe(true)
  })

  it('refuse maxParticipants < 2', () => {
    const result = validateUpdateJamData({ maxParticipants: 1 })
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/maxParticipants/)
  })

  it('refuse maxParticipants > 10000', () => {
    const result = validateUpdateJamData({ maxParticipants: 10001 })
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/maxParticipants/)
  })

  it('refuse maxParticipants non-numérique', () => {
    const result = validateUpdateJamData({ maxParticipants: 'beaucoup' as unknown as number })
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/maxParticipants/)
  })

  it('refuse maxParticipants NaN', () => {
    const result = validateUpdateJamData({ maxParticipants: NaN })
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/maxParticipants/)
  })
})
