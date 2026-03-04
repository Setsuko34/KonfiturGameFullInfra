import type { Models } from 'appwrite'
import type { GameJam, Team, TeamMember, Project, ChatMessage, Announcement, Comment } from '@/types'

// Mappeurs Appwrite Document → Types applicatifs

export function mapDocToGameJam(doc: Models.Document): GameJam {
  return {
    id: doc.$id,
    title: doc.title,
    slug: doc.slug,
    theme: doc.theme,
    description: doc.description,
    status: doc.status,
    type: doc.type,
    startDate: new Date(doc.start_date),
    endDate: new Date(doc.end_date),
    duration: doc.duration,
    participants: doc.participants ?? 0,
    maxParticipants: doc.max_participants,
    rules: doc.rules ?? [],
    prizes: doc.prizes ?? [],
    tags: doc.tags ?? [],
    organizer: doc.organizer ?? '',
    organizerId: doc.organizer_id,
    coverImage: doc.cover_image_id,
  }
}

export function mapDocToTeam(doc: Models.Document): Team {
  return {
    id: doc.$id,
    jamId: doc.jam_id,
    name: doc.name,
    inviteCode: doc.invite_code,
    leaderId: doc.leader_id,
    members: [],
    projectId: doc.project_id,
  }
}

export function mapDocToTeamMember(doc: Models.Document): TeamMember {
  return {
    id: doc.$id,
    userId: doc.user_id,
    name: doc.name ?? '',
    role: doc.role,
    isLeader: doc.is_leader,
    avatarUrl: doc.avatar_url,
  }
}

export function mapDocToProject(doc: Models.Document): Project {
  return {
    id: doc.$id,
    jamId: doc.jam_id,
    teamId: doc.team_id,
    title: doc.title,
    description: doc.description,
    technologies: doc.technologies ?? [],
    downloadUrl: doc.download_url,
    repoUrl: doc.repo_url,
    submitted: doc.submitted ?? false,
    submissionDate: doc.submission_date ? new Date(doc.submission_date) : undefined,
    votesCount: doc.votes_count ?? 0,
    coverImage: doc.cover_image_id,
    screenshotIds: doc.screenshot_ids ?? [],
  }
}

export function mapDocToChatMessage(doc: Models.Document): ChatMessage {
  return {
    id: doc.$id,
    jamId: doc.jam_id,
    channel: doc.channel,
    authorId: doc.author_id,
    authorName: doc.author_name,
    content: doc.content,
    role: doc.role,
    pinned: doc.pinned ?? false,
    createdAt: new Date(doc.$createdAt),
  }
}

export function mapDocToAnnouncement(doc: Models.Document): Announcement {
  return {
    id: doc.$id,
    jamId: doc.jam_id,
    title: doc.title,
    content: doc.content,
    important: doc.important ?? false,
    authorId: doc.author_id,
    createdAt: new Date(doc.$createdAt),
  }
}

export function mapDocToComment(doc: Models.Document): Comment {
  return {
    id: doc.$id,
    projectId: doc.project_id,
    authorId: doc.author_id,
    authorName: doc.author_name,
    content: doc.content,
    createdAt: new Date(doc.$createdAt),
  }
}
