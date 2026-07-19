import type { Models } from 'appwrite'
import type { GameJam, Team, TeamMember, Project, ChatMessage, Announcement, Comment } from '@/types'
import { computeJamStatus } from '@/lib/jam-status'

// Mappeurs Appwrite Document → Types applicatifs

// Depuis appwrite 23 / node-appwrite 22, Models.Document est strict (champs $
// uniquement) ; les attributs de collection passent par la signature d'index.
export type AppwriteDoc = Models.Document & Record<string, any>

export function mapDocToGameJam(doc: AppwriteDoc): GameJam {
  const startDate = new Date(doc.start_date)
  const endDate = new Date(doc.end_date)
  return {
    id: doc.$id,
    title: doc.title,
    slug: doc.slug,
    theme: doc.theme,
    description: doc.description,
    status: computeJamStatus(startDate, endDate),
    type: doc.type,
    startDate,
    endDate,
    duration: doc.duration,
    participants: doc.participants ?? 0,
    maxParticipants: doc.max_participants,
    rules: doc.rules ?? [],
    prizes: doc.prizes ?? [],
    tags: doc.tags ?? [],
    organizer: doc.organizer ?? '',
    organizerId: doc.organizer_id,
    coverImage: doc.cover_image_id ?? undefined,
    featured: doc.featured ?? false,
    featuredOrder: doc.featured_order,
  }
}

export function mapDocToTeam(doc: AppwriteDoc): Team {
  return {
    id: doc.$id,
    jamIds: doc.jam_ids ?? [],
    name: doc.name,
    inviteCode: doc.invite_code,
    leaderId: doc.leader_id,
    isSolo: doc.is_solo ?? false,
    members: [],
  }
}

export function mapDocToTeamMember(doc: AppwriteDoc): TeamMember {
  return {
    id: doc.$id,
    userId: doc.user_id,
    name: doc.name ?? '',
    role: doc.role,
    isLeader: doc.is_leader,
    avatarUrl: doc.avatar_url,
  }
}

export function mapDocToProject(doc: AppwriteDoc): Project {
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
    likesCount: doc.likes_count ?? 0,
    coverImage: doc.cover_image_id ?? undefined,
    screenshotIds: doc.screenshot_ids ?? [],
    buildFileId: doc.build_file_id ?? undefined,
    reported: doc.reported ?? false,
    placement: doc.placement ?? 0,
  }
}

export function mapDocToChatMessage(doc: AppwriteDoc): ChatMessage {
  return {
    id: doc.$id,
    jamId: doc.jam_id,
    channel: doc.channel,
    authorId: doc.author_id,
    authorName: doc.author_name,
    content: doc.content,
    role: doc.role,
    pinned: doc.pinned ?? false,
    reported: doc.reported ?? false,
    createdAt: new Date(doc.$createdAt),
  }
}

export function mapDocToAnnouncement(doc: AppwriteDoc): Announcement {
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

export function mapDocToComment(doc: AppwriteDoc): Comment {
  return {
    id: doc.$id,
    projectId: doc.project_id,
    authorId: doc.author_id,
    authorName: doc.author_name,
    content: doc.content,
    createdAt: new Date(doc.$createdAt),
  }
}
