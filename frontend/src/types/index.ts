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
  featured?: boolean
  featuredOrder?: number
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
  jamIds: string[]       // tableau — [] = guilde pure
  name: string
  inviteCode: string
  leaderId: string
  isSolo: boolean        // inscription solo = team technique de 1
  members: TeamMember[]
  // projectId supprimé — requête projects par team_id + jam_id
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
  likesCount: number
  coverImage?: string
  screenshotIds?: string[]
  buildFileId?: string
  reported?: boolean
  placement?: number
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
  reported?: boolean
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

export interface UpdateJamData {
  description?: string
  rules?: string[]
  prizes?: string[]
  maxParticipants?: number
  tags?: string[]
}
