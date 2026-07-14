import { chromium } from '@playwright/test'
import { Client, Users, Databases, Teams, ID, Query } from 'node-appwrite'
import fs from 'fs'
import path from 'path'

const envPath = path.resolve(process.cwd(), '../.env')
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf-8')
    .split('\n')
    .forEach(line => {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    })
}

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? 'http://localhost:8080/v1'
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!
const API_KEY = process.env.APPWRITE_API_KEY!
const ADMIN_TEAM_ID = '69bc67f1003d025c931a'
const DB = 'konfitur-db'

const TEST_USERS = {
  user1: { id: 'e2e-user1', email: 'e2e-user1@test.local', password: 'E2eTest1234!', name: 'E2E Joueur1' },
  user2: { id: 'e2e-user2', email: 'e2e-user2@test.local', password: 'E2eTest1234!', name: 'E2E Joueur2' },
  admin: { id: 'e2e-admin', email: 'e2e-admin@test.local', password: 'E2eTest1234!', name: 'E2E Admin' },
}

const AUTH_DIR = path.resolve(process.cwd(), 'e2e/.auth')
const IDS_FILE = path.resolve(process.cwd(), 'e2e/.test-ids.json')
const STATE_FILE = path.resolve(process.cwd(), 'e2e/.test-state.json')

function days(offset: number): string {
  return new Date(Date.now() + offset * 24 * 3600 * 1000).toISOString()
}

async function loginAndSave(email: string, password: string, storePath: string) {
  const browser = await chromium.launch()
  const ctx = await browser.newContext()
  const page = await ctx.newPage()

  await page.goto('http://localhost:3000/auth/login')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.locator('button[type="submit"]').click()
  // Attend d'être redirigé hors de /auth/login
  await page.waitForURL(url => !url.pathname.startsWith('/auth'), { timeout: 15_000 })

  await ctx.storageState({ path: storePath })
  await browser.close()
}

export default async function globalSetup() {
  if (!PROJECT_ID || !API_KEY) {
    throw new Error('NEXT_PUBLIC_APPWRITE_PROJECT_ID et APPWRITE_API_KEY sont requis pour les tests E2E.')
  }

  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY)
  const users = new Users(client)
  const databases = new Databases(client)
  const teams = new Teams(client)

  fs.mkdirSync(AUTH_DIR, { recursive: true })

  // Nettoyage des résidus d'un run précédent.
  // Les users fixes (user1/2/admin) ont des IDs déterministes → delete par ID.
  // Le user d'inscription est créé par le flow UI avec un ID ALÉATOIRE (ID.unique())
  // → on le supprime par email, sinon il survit entre deux runs et « email déjà utilisé ».
  await Promise.all(Object.values(TEST_USERS).map(u => users.delete(u.id).catch(() => {})))
  const leftovers = await users
    .list([Query.equal('email', 'e2e-reg-test@test.local')])
    .catch(() => null)
  if (leftovers) {
    await Promise.all(leftovers.users.map(u => users.delete(u.$id).catch(() => {})))
  }

  // Création des utilisateurs de test
  await Promise.all(
    Object.values(TEST_USERS).map(u =>
      users.create({ userId: u.id, email: u.email, password: u.password, name: u.name })
    )
  )

  // Ajout du compte admin à la team admin
  await teams.createMembership({
    teamId: ADMIN_TEAM_ID,
    roles: ['owner'],
    userId: TEST_USERS.admin.id,
    url: 'http://localhost:3000',
  }).catch((err: Error) => {
    console.warn(`⚠ createMembership admin: ${err.message} (team ${ADMIN_TEAM_ID} existe-t-elle dans Appwrite ?)`)
  })

  // Création des 4 jams de référence
  const ts = Date.now()
  const [jamOngoing, jamUpcoming, jamEnded, jamUser1] = await Promise.all([
    databases.createDocument(DB, 'game_jams', ID.unique(), {
      title: '[E2E] Jam En Cours',
      slug: `e2e-ongoing-${ts}`,
      theme: 'Temps limité',
      description: 'Jam de test E2E en cours.',
      type: 'both',
      start_date: days(-5),
      end_date: days(5),
      duration: '10 jours',
      organizer_id: TEST_USERS.admin.id,
      status: 'ongoing',
      featured: true,
      featured_order: 0,
    }),
    databases.createDocument(DB, 'game_jams', ID.unique(), {
      title: '[E2E] Jam À Venir',
      slug: `e2e-upcoming-${ts}`,
      theme: 'Pixel Art',
      description: 'Jam de test E2E à venir.',
      type: 'team',
      start_date: days(10),
      end_date: days(17),
      duration: '7 jours',
      organizer_id: TEST_USERS.admin.id,
      status: 'upcoming',
    }),
    databases.createDocument(DB, 'game_jams', ID.unique(), {
      title: '[E2E] Jam Terminée',
      slug: `e2e-ended-${ts}`,
      theme: 'Rétro',
      description: 'Jam de test E2E terminée.',
      type: 'solo',
      start_date: days(-14),
      end_date: days(-7),
      duration: '7 jours',
      organizer_id: TEST_USERS.admin.id,
      status: 'ended',
    }),
    // Jam organisée par user1 — l'admin e2e n'en est PAS l'organisateur
    // (nécessaire pour tester le chemin admin non-propriétaire + audit)
    databases.createDocument(DB, 'game_jams', ID.unique(), {
      title: '[E2E] Jam User1',
      slug: `e2e-user1-${ts}`,
      theme: 'Modération',
      description: 'Jam de test E2E organisée par user1.',
      type: 'both',
      start_date: days(-2),
      end_date: days(8),
      duration: '10 jours',
      organizer_id: TEST_USERS.user1.id,
      status: 'ongoing',
    }),
  ])

  // Sauvegarde des IDs
  fs.writeFileSync(IDS_FILE, JSON.stringify({
    jamOngoingId: jamOngoing.$id,
    jamUpcomingId: jamUpcoming.$id,
    jamEndedId: jamEnded.$id,
    jamUser1Id: jamUser1.$id,
  }, null, 2))

  // Réinitialisation de l'état partagé entre tests
  fs.writeFileSync(STATE_FILE, JSON.stringify({}))

  // Sauvegarde des sessions Playwright (séquentiel pour éviter les conflits de browser)
  await loginAndSave(TEST_USERS.user1.email, TEST_USERS.user1.password, path.join(AUTH_DIR, 'user1.json'))
  await loginAndSave(TEST_USERS.user2.email, TEST_USERS.user2.password, path.join(AUTH_DIR, 'user2.json'))
  await loginAndSave(TEST_USERS.admin.email, TEST_USERS.admin.password, path.join(AUTH_DIR, 'admin.json'))

  console.log('✔ Setup E2E terminé — jams:', jamOngoing.$id, jamUpcoming.$id, jamEnded.$id)
}
