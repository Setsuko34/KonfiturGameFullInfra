import { describe, it, expect } from 'vitest'
import { generateJamJsonLd, generateProjectJsonLd, generateOrganizationJsonLd, serializeJsonLd } from '@/lib/seo'
import type { GameJam, Project } from '@/types'

const mockJam: GameJam = {
  id: 'jam-1',
  title: 'Spring Jam 2026',
  slug: 'spring-jam-2026',
  theme: 'Printemps',
  description: 'Une jam printanière',
  status: 'upcoming',
  type: 'team',
  startDate: new Date('2026-04-01'),
  endDate: new Date('2026-04-07'),
  duration: '7 jours',
  participants: 42,
  rules: ['Règle 1'],
  organizer: 'KonfiturTeam',
  organizerId: 'org-1',
}

const mockProject: Project = {
  id: 'proj-1',
  jamId: 'jam-1',
  teamId: 'team-1',
  title: 'Pixel Garden',
  description: 'Un jeu de jardinage pixelisé',
  technologies: ['Unity', 'C#'],
  submitted: true,
  likesCount: 15,
}

describe('generateJamJsonLd', () => {
  it('retourne un objet avec @type Event', () => {
    const ld = generateJamJsonLd(mockJam, 'https://konfiturgame.fr')
    expect(ld['@type']).toBe('Event')
  })

  it('inclut le nom et la description', () => {
    const ld = generateJamJsonLd(mockJam, 'https://konfiturgame.fr')
    expect(ld.name).toBe(mockJam.title)
    expect(ld.description).toBe(mockJam.description)
  })

  it('inclut les dates ISO', () => {
    const ld = generateJamJsonLd(mockJam, 'https://konfiturgame.fr')
    expect(ld.startDate).toBe('2026-04-01T00:00:00.000Z')
    expect(ld.endDate).toBe('2026-04-07T00:00:00.000Z')
  })

  it("inclut l'URL canonique", () => {
    const ld = generateJamJsonLd(mockJam, 'https://konfiturgame.fr')
    expect(ld.url).toBe(`https://konfiturgame.fr/jam/${mockJam.id}`)
  })

  it('indique eventStatus online pour une jam à venir', () => {
    const ld = generateJamJsonLd(mockJam, 'https://konfiturgame.fr')
    expect(ld.eventStatus).toContain('EventScheduled')
  })
})

describe('generateProjectJsonLd', () => {
  it('retourne un objet avec @type SoftwareApplication', () => {
    const ld = generateProjectJsonLd(mockProject, 'https://konfiturgame.fr')
    expect(ld['@type']).toBe('SoftwareApplication')
  })

  it('inclut le nom et la description', () => {
    const ld = generateProjectJsonLd(mockProject, 'https://konfiturgame.fr')
    expect(ld.name).toBe(mockProject.title)
    expect(ld.description).toBe(mockProject.description)
  })

  it('inclut aggregateRating basé sur likesCount quand likesCount > 0, ratingValue 4 sans placement', () => {
    const ld = generateProjectJsonLd(mockProject, 'https://konfiturgame.fr')
    expect(ld.aggregateRating).toEqual({
      '@type': 'AggregateRating',
      ratingCount: mockProject.likesCount,
      ratingValue: 4,
      bestRating: 5,
    })
  })

  it('ratingValue vaut 5 quand le projet a un placement (podium)', () => {
    const ld = generateProjectJsonLd({ ...mockProject, placement: 1 }, 'https://konfiturgame.fr')
    expect(ld.aggregateRating).toEqual({
      '@type': 'AggregateRating',
      ratingCount: mockProject.likesCount,
      ratingValue: 5,
      bestRating: 5,
    })
  })

  it('omet aggregateRating quand likesCount vaut 0', () => {
    const ld = generateProjectJsonLd({ ...mockProject, likesCount: 0 }, 'https://konfiturgame.fr')
    expect(ld.aggregateRating).toBeUndefined()
  })
})

describe('serializeJsonLd', () => {
  it('sérialise un objet JSON-LD valide', () => {
    const json = serializeJsonLd({ '@type': 'Event', name: 'Spring Jam' })
    expect(JSON.parse(json)).toEqual({ '@type': 'Event', name: 'Spring Jam' })
  })

  it("échappe < pour empêcher l'injection </script> via un contenu utilisateur", () => {
    const json = serializeJsonLd({ name: '</script><script>alert(1)</script>' })
    expect(json).not.toContain('<')
    expect(json).toContain('\\u003c')
    // Le contenu reste intact après parsing
    expect(JSON.parse(json).name).toBe('</script><script>alert(1)</script>')
  })
})

describe('generateOrganizationJsonLd', () => {
  it('retourne un objet Organization', () => {
    const ld = generateOrganizationJsonLd('https://konfiturgame.fr')
    expect(ld['@type']).toBe('Organization')
    expect(ld.name).toBe('KonfiturGame')
    expect(ld.url).toBe('https://konfiturgame.fr')
  })
})
