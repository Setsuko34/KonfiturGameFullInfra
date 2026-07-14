import fs from 'fs'
import path from 'path'

export const BASE_URL = 'http://localhost:3000'

export const TEST_USERS = {
  user1: { id: 'e2e-user1', email: 'e2e-user1@test.local', password: 'E2eTest1234!', name: 'E2E Joueur1' },
  user2: { id: 'e2e-user2', email: 'e2e-user2@test.local', password: 'E2eTest1234!', name: 'E2E Joueur2' },
  admin: { id: 'e2e-admin', email: 'e2e-admin@test.local', password: 'E2eTest1234!', name: 'E2E Admin' },
  regTest: { id: 'e2e-reg-test', email: 'e2e-reg-test@test.local', password: 'E2eTest1234!', name: 'E2E RegTest' },
}

export const STORAGE_STATE = {
  user1: path.resolve(process.cwd(), 'e2e/.auth/user1.json'),
  user2: path.resolve(process.cwd(), 'e2e/.auth/user2.json'),
  admin: path.resolve(process.cwd(), 'e2e/.auth/admin.json'),
}

export type TestIds = {
  jamOngoingId: string
  jamUpcomingId: string
  jamEndedId: string
  jamUser1Id: string
}

export function loadTestIds(): TestIds {
  const idsFile = path.resolve(process.cwd(), 'e2e/.test-ids.json')
  return JSON.parse(fs.readFileSync(idsFile, 'utf-8'))
}

export type E2EState = {
  guildeInviteCode?: string
  guildeId?: string
  guildeRegisteredJamId?: string
  projectId?: string
  announcementPublished?: boolean
}

const STATE_FILE = path.resolve(process.cwd(), 'e2e/.test-state.json')

export function saveState(data: Partial<E2EState>): void {
  const existing = loadState()
  fs.writeFileSync(STATE_FILE, JSON.stringify({ ...existing, ...data }, null, 2))
}

export function loadState(): E2EState {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'))
  } catch {
    return {}
  }
}
