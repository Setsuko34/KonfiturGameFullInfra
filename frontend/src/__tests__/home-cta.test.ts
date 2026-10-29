import { describe, it, expect } from 'vitest'
import { getHomeCtaVariant } from '@/lib/home-cta'

describe('getHomeCtaVariant', () => {
  it('renvoie "loading" tant que la session charge, même si un user est déjà connu', () => {
    expect(getHomeCtaVariant({ loading: true, user: null })).toBe('loading')
    expect(getHomeCtaVariant({ loading: true, user: { $id: 'u1' } })).toBe('loading')
  })
  it('renvoie "guest" quand le chargement est fini sans utilisateur', () => {
    expect(getHomeCtaVariant({ loading: false, user: null })).toBe('guest')
  })
  it('renvoie "member" quand un utilisateur est connecté', () => {
    expect(getHomeCtaVariant({ loading: false, user: { $id: 'u1' } })).toBe('member')
  })
})
