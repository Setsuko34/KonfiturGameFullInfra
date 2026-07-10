// ═══════════════════════════════════════════════════════════
// Appwrite — IDs des collections, base de données et buckets
// ═══════════════════════════════════════════════════════════

export const DATABASE_ID = 'konfitur-db'

export const COLLECTIONS = {
  GAME_JAMS: 'game_jams',
  TEAMS: 'teams',
  TEAM_MEMBERS: 'team_members',
  PROJECTS: 'projects',
  CHAT_MESSAGES: 'chat_messages',
  ANNOUNCEMENTS: 'announcements',
  COMMENTS: 'comments',
  LIKES: 'likes',
  AUDIT_LOGS: 'audit_logs',
  BANNED_IPS: 'banned_ips',
} as const

export const BUCKETS = {
  JAM_COVERS: 'jam-covers',
  PROJECT_ASSETS: 'project-assets',
  AVATARS: 'avatars',
} as const

export type CollectionId = typeof COLLECTIONS[keyof typeof COLLECTIONS]
export type BucketId = typeof BUCKETS[keyof typeof BUCKETS]

export const ADMIN_TEAM_ID = '69bc67f1003d025c931a'
