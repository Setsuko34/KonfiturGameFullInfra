// ═══════════════════════════════════════════════════════════
// Types TypeScript — KonfiturGame
// ═══════════════════════════════════════════════════════════

export interface GameJam {
  id: string
  title: string
  slug: string
  theme: string
  startDate: Date
  endDate: Date
  participants: number
  maxParticipants?: number
  status: 'upcoming' | 'ongoing' | 'ended'
  type: 'solo' | 'team' | 'both'
  duration: string
  description: string
  rules: string[]
  prizes?: string[]
  organizer: string
  organizerId: string
  coverImage?: string
  tags?: string[]
}

export interface TeamMember {
  id: string
  userId: string
  name: string
  role: 'dev' | 'artist' | 'sound' | 'designer' | 'writer'
  isLeader: boolean
  avatarUrl?: string
}

export interface Team {
  id: string
  jamId: string
  name: string
  inviteCode: string
  leaderId: string
  members: TeamMember[]
  projectId?: string
}

export interface Project {
  id: string
  jamId: string
  teamId: string
  title: string
  description: string
  technologies: string[]
  downloadUrl?: string
  repoUrl?: string
  submitted: boolean
  submissionDate?: Date
  votesCount: number
  coverImage?: string
  screenshotIds?: string[]
}

export interface Comment {
  id: string
  projectId: string
  authorId: string
  authorName: string
  content: string
  createdAt: Date
}

export interface Announcement {
  id: string
  jamId: string
  title: string
  content: string
  important: boolean
  authorId: string
  createdAt: Date
}

export type ChatChannel = 'general' | 'team-search' | 'help'
export type UserRole = 'user' | 'organizer' | 'moderator'

export interface ChatMessage {
  id: string
  jamId: string
  channel: ChatChannel
  authorId: string
  authorName: string
  content: string
  role: UserRole
  pinned: boolean
  createdAt: Date
}

export interface PastWinner {
  id: string
  jamId: string
  jamTitle: string
  jamYear: number
  placement: 1 | 2 | 3
  projectTitle: string
  teamName: string
  coverImage?: string
}

export interface SiteStats {
  jamsOrganized: number
  participants: number
  projectsSubmitted: number
  countriesRepresented: number
}
