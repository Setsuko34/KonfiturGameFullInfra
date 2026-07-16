import { describe, it, expect } from 'vitest'
import { aggregateByDay } from '@/lib/dashboard-utils'

// now fixe pour des tests déterministes (un mercredi à midi, heure locale)
const NOW = new Date(2026, 6, 15, 12, 0, 0) // 15 juillet 2026

function iso(y: number, m: number, d: number, h = 10): string {
  return new Date(y, m - 1, d, h).toISOString()
}

describe('aggregateByDay', () => {
  it('retourne exactement N jours chronologiques finissant aujourd hui, vides à 0', () => {
    const res = aggregateByDay([], 14, NOW)
    expect(res).toHaveLength(14)
    expect(res[13].date).toBe('2026-07-15')
    expect(res[0].date).toBe('2026-07-02')
    expect(res.every(d => d.count === 0)).toBe(true)
  })

  it('compte les dates dans le bon jour', () => {
    const res = aggregateByDay([iso(2026, 7, 15), iso(2026, 7, 15), iso(2026, 7, 3)], 14, NOW)
    expect(res[13]).toEqual({ date: '2026-07-15', count: 2 })
    expect(res[1]).toEqual({ date: '2026-07-03', count: 1 })
  })

  it('ignore les dates hors période (trop vieilles ou futures)', () => {
    const res = aggregateByDay([iso(2026, 6, 1), iso(2026, 8, 1)], 14, NOW)
    expect(res.reduce((s, d) => s + d.count, 0)).toBe(0)
  })

  it('gère une période de 1 jour', () => {
    const res = aggregateByDay([iso(2026, 7, 15)], 1, NOW)
    expect(res).toEqual([{ date: '2026-07-15', count: 1 }])
  })
})
