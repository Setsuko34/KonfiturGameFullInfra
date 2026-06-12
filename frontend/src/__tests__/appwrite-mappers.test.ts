import { describe, it, expect } from 'vitest'
import {
  mapDocToGameJam,
  mapDocToTeam,
  mapDocToTeamMember,
  mapDocToProject,
  mapDocToChatMessage,
  mapDocToAnnouncement,
  mapDocToComment,
} from '@/lib/appwrite/types'
import type { AppwriteDoc } from '@/lib/appwrite/types'

// Document Appwrite minimal avec les champs système requis
function makeDoc(fields: Record<string, unknown>): AppwriteDoc {
  return {
    $id: 'doc-1',
    $sequence: 1,
    $createdAt: '2026-01-15T10:00:00.000Z',
    $updatedAt: '2026-01-15T10:00:00.000Z',
    $permissions: [],
    $collectionId: 'col-1',
    $databaseId: 'db-1',
    ...fields,
  }
}

// ────────────────────────────────────────
// mapDocToGameJam
// ────────────────────────────────────────
describe('mapDocToGameJam', () => {
  const baseJam = {
    title: 'Spring Jam 2026',
    slug: 'spring-jam-2026',
    theme: 'Printemps',
    description: 'Une jam printanière',
    status: 'upcoming',
    type: 'team',
    start_date: '2026-04-01T00:00:00.000Z',
    end_date: '2026-04-07T00:00:00.000Z',
    duration: '7 jours',
    organizer_id: 'org-1',
  }

  it('mappe les champs requis', () => {
    const jam = mapDocToGameJam(makeDoc(baseJam))
    expect(jam.id).toBe('doc-1')
    expect(jam.title).toBe('Spring Jam 2026')
    expect(jam.slug).toBe('spring-jam-2026')
    expect(jam.theme).toBe('Printemps')
    expect(jam.organizerId).toBe('org-1')
  })

  it('convertit start_date et end_date en objets Date', () => {
    const jam = mapDocToGameJam(makeDoc(baseJam))
    expect(jam.startDate).toBeInstanceOf(Date)
    expect(jam.endDate).toBeInstanceOf(Date)
    expect(jam.startDate.toISOString()).toBe('2026-04-01T00:00:00.000Z')
    expect(jam.endDate.toISOString()).toBe('2026-04-07T00:00:00.000Z')
  })

  it('applique les valeurs par défaut sur les champs optionnels', () => {
    const jam = mapDocToGameJam(makeDoc(baseJam))
    expect(jam.participants).toBe(0)
    expect(jam.rules).toEqual([])
    expect(jam.prizes).toEqual([])
    expect(jam.tags).toEqual([])
    expect(jam.organizer).toBe('')
    expect(jam.featured).toBe(false)
    expect(jam.coverImage).toBeUndefined()
  })

  it('mappe les champs optionnels quand présents', () => {
    const jam = mapDocToGameJam(makeDoc({
      ...baseJam,
      participants: 42,
      max_participants: 100,
      rules: ['Règle 1', 'Règle 2'],
      prizes: ['1er prix'],
      tags: ['retro'],
      organizer: 'KonfiturTeam',
      cover_image_id: 'img-abc',
      featured: true,
      featured_order: 1,
    }))
    expect(jam.participants).toBe(42)
    expect(jam.maxParticipants).toBe(100)
    expect(jam.rules).toEqual(['Règle 1', 'Règle 2'])
    expect(jam.prizes).toEqual(['1er prix'])
    expect(jam.tags).toEqual(['retro'])
    expect(jam.organizer).toBe('KonfiturTeam')
    expect(jam.coverImage).toBe('img-abc')
    expect(jam.featured).toBe(true)
    expect(jam.featuredOrder).toBe(1)
  })
})

// ────────────────────────────────────────
// mapDocToTeam
// ────────────────────────────────────────
describe('mapDocToTeam', () => {
  it('mappe jam_ids comme tableau', () => {
    const team = mapDocToTeam(makeDoc({
      jam_ids: ['jam-1', 'jam-2'],
      name: 'Pixel Crew',
      invite_code: 'KG-ABCD1234',
      leader_id: 'user-1',
    }))
    expect(team.jamIds).toEqual(['jam-1', 'jam-2'])
    expect(team.name).toBe('Pixel Crew')
    expect(team.inviteCode).toBe('KG-ABCD1234')
    expect(team.leaderId).toBe('user-1')
  })

  it('retourne un tableau vide pour une guilde sans jam', () => {
    const team = mapDocToTeam(makeDoc({
      jam_ids: [],
      name: 'Guilde Solo',
      invite_code: 'KG-ZZZZZZZZ',
      leader_id: 'user-2',
    }))
    expect(team.jamIds).toEqual([])
  })

  it("n'a pas de propriété projectId", () => {
    const team = mapDocToTeam(makeDoc({
      jam_ids: ['jam-1'],
      name: 'Team',
      invite_code: 'KG-AAAAAAAA',
      leader_id: 'user-1',
    }))
    expect('projectId' in team).toBe(false)
  })
})

// ────────────────────────────────────────
// mapDocToTeamMember
// ────────────────────────────────────────
describe('mapDocToTeamMember', () => {
  it('mappe les champs requis', () => {
    const member = mapDocToTeamMember(makeDoc({
      user_id: 'user-2',
      name: 'Alice',
      role: 'dev',
      is_leader: true,
      avatar_url: 'https://example.com/avatar.png',
    }))
    expect(member.id).toBe('doc-1')
    expect(member.userId).toBe('user-2')
    expect(member.name).toBe('Alice')
    expect(member.role).toBe('dev')
    expect(member.isLeader).toBe(true)
    expect(member.avatarUrl).toBe('https://example.com/avatar.png')
  })

  it("utilise '' comme valeur par défaut pour name si absent", () => {
    const member = mapDocToTeamMember(makeDoc({
      user_id: 'user-3',
      role: 'artist',
      is_leader: false,
    }))
    expect(member.name).toBe('')
  })
})

// ────────────────────────────────────────
// mapDocToProject
// ────────────────────────────────────────
describe('mapDocToProject', () => {
  const baseProject = {
    jam_id: 'jam-1',
    team_id: 'team-1',
    title: 'Pixel Garden',
    description: 'Un jeu de jardinage',
  }

  it('mappe les champs requis avec les valeurs par défaut', () => {
    const project = mapDocToProject(makeDoc(baseProject))
    expect(project.id).toBe('doc-1')
    expect(project.jamId).toBe('jam-1')
    expect(project.teamId).toBe('team-1')
    expect(project.title).toBe('Pixel Garden')
    expect(project.technologies).toEqual([])
    expect(project.submitted).toBe(false)
    expect(project.votesCount).toBe(0)
    expect(project.screenshotIds).toEqual([])
    expect(project.reported).toBe(false)
    expect(project.winner).toBe(false)
  })

  it('convertit submission_date en Date si présente', () => {
    const project = mapDocToProject(makeDoc({
      ...baseProject,
      submission_date: '2026-04-07T12:00:00.000Z',
      submitted: true,
    }))
    expect(project.submissionDate).toBeInstanceOf(Date)
    expect(project.submissionDate?.toISOString()).toBe('2026-04-07T12:00:00.000Z')
  })

  it("ne set pas submissionDate si submission_date est absent", () => {
    const project = mapDocToProject(makeDoc(baseProject))
    expect(project.submissionDate).toBeUndefined()
  })
})

// ────────────────────────────────────────
// mapDocToChatMessage
// ────────────────────────────────────────
describe('mapDocToChatMessage', () => {
  it('mappe les champs requis et convertit $createdAt en Date', () => {
    const msg = mapDocToChatMessage(makeDoc({
      jam_id: 'jam-1',
      channel: 'general',
      author_id: 'user-1',
      author_name: 'Bob',
      content: 'Bonjour !',
      role: 'user',
    }))
    expect(msg.id).toBe('doc-1')
    expect(msg.jamId).toBe('jam-1')
    expect(msg.channel).toBe('general')
    expect(msg.authorId).toBe('user-1')
    expect(msg.authorName).toBe('Bob')
    expect(msg.content).toBe('Bonjour !')
    expect(msg.role).toBe('user')
    expect(msg.pinned).toBe(false)
    expect(msg.reported).toBe(false)
    expect(msg.createdAt).toBeInstanceOf(Date)
    expect(msg.createdAt.toISOString()).toBe('2026-01-15T10:00:00.000Z')
  })
})

// ────────────────────────────────────────
// mapDocToAnnouncement
// ────────────────────────────────────────
describe('mapDocToAnnouncement', () => {
  it('mappe les champs requis et convertit $createdAt en Date', () => {
    const ann = mapDocToAnnouncement(makeDoc({
      jam_id: 'jam-1',
      title: 'Thème révélé',
      content: 'Le thème est : Printemps',
      important: true,
      author_id: 'user-1',
    }))
    expect(ann.id).toBe('doc-1')
    expect(ann.jamId).toBe('jam-1')
    expect(ann.title).toBe('Thème révélé')
    expect(ann.content).toBe('Le thème est : Printemps')
    expect(ann.important).toBe(true)
    expect(ann.authorId).toBe('user-1')
    expect(ann.createdAt).toBeInstanceOf(Date)
  })

  it("utilise false comme valeur par défaut pour important", () => {
    const ann = mapDocToAnnouncement(makeDoc({
      jam_id: 'jam-1',
      title: 'T',
      content: 'C',
      author_id: 'user-1',
    }))
    expect(ann.important).toBe(false)
  })
})

// ────────────────────────────────────────
// mapDocToComment
// ────────────────────────────────────────
describe('mapDocToComment', () => {
  it('mappe les champs requis et convertit $createdAt en Date', () => {
    const comment = mapDocToComment(makeDoc({
      project_id: 'proj-1',
      author_id: 'user-1',
      author_name: 'Alice',
      content: 'Super jeu !',
    }))
    expect(comment.id).toBe('doc-1')
    expect(comment.projectId).toBe('proj-1')
    expect(comment.authorId).toBe('user-1')
    expect(comment.authorName).toBe('Alice')
    expect(comment.content).toBe('Super jeu !')
    expect(comment.createdAt).toBeInstanceOf(Date)
  })
})
