import { Client, Databases, ID, Query } from 'node-appwrite'
import fs from 'fs'
import path from 'path'
import { test, expect } from '../fixtures/auth'
import { loadTestIds, STORAGE_STATE, TEST_USERS } from '../fixtures/test-data'

// Même idiome de chargement de .env que global-setup.ts / playwright.config.ts
// (dupliqué à dessein : ce fichier doit pouvoir tourner seul, sans dépendre de
// l'ordre d'exécution des autres modules de config).
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
const DB = 'konfitur-db'

// Module 5 — Chat en direct
// Cahier de recettes §5.1

test.describe('5.1 — Envoi de messages', () => {
  test('user1 envoie un message dans le canal Général', async ({ user1Page: page }) => {
    const ids = loadTestIds()
    await page.goto(`/jam/${ids.jamOngoingId}`)

    // Vérifier que le chat est visible
    const chatSection = page.locator('[data-chat], #chat, [aria-label*="chat" i]')
    if (await chatSection.count() === 0) test.skip()

    // Le composant n'affiche les nouveaux messages que via l'écho realtime :
    // attendre que la souscription WebSocket soit établie avant d'envoyer
    await page.waitForTimeout(1_000)

    // Canal Général par défaut
    const msgInput = page.locator(
      'input[name="message"], textarea[name="message"], [data-chat-input], #chat-input'
    )
    await msgInput.fill('[E2E] Message test canal général')
    await page.keyboard.press('Enter')
    // ou bouton envoyer
    const sendBtn = page.getByRole('button', { name: /envoyer|send/i })
    if (await sendBtn.count() > 0 && !(await sendBtn.isDisabled())) {
      await sendBtn.click()
    }

    await expect(page.locator('body')).toContainText('[E2E] Message test canal général', { timeout: 10_000 })
  })

  test('changement de canal affiche les bons messages', async ({ user1Page: page }) => {
    const ids = loadTestIds()
    await page.goto(`/jam/${ids.jamOngoingId}`)

    // Chercher le canal "Aide" ou "help"
    const aidBtn = page.getByRole('button', { name: /aide|help/i })
      .or(page.getByText(/aide|help/i).first())

    if (await aidBtn.count() === 0) test.skip()

    // Retry : le clic peut partir avant l'hydratation React (event perdu) —
    // on reclique tant que le canal actif (placeholder de l'input) n'a pas basculé
    await expect(async () => {
      await aidBtn.first().click()
      await expect(page.locator('#chat-input')).toHaveAttribute('placeholder', /#Aide/i, { timeout: 1_000 })
    }).toPass({ timeout: 10_000 })

    // Le message du canal général ne doit pas apparaître dans ce canal
    await expect(page.locator('body')).not.toContainText('[E2E] Message test canal général')
  })

  test('réception en temps réel — user2 voit le message de user1 sans rechargement', async ({ browser }) => {
    const ids = loadTestIds()

    // Deux contextes indépendants — c'est le test central du realtime
    const ctx1 = await browser.newContext({ storageState: STORAGE_STATE.user1 })
    const ctx2 = await browser.newContext({ storageState: STORAGE_STATE.user2 })

    const page1 = await ctx1.newPage()
    const page2 = await ctx2.newPage()

    try {
      // Les deux utilisateurs ouvrent la page du chat
      await Promise.all([
        page1.goto(`/jam/${ids.jamOngoingId}`),
        page2.goto(`/jam/${ids.jamOngoingId}`),
      ])

      // Attendre que le chat soit chargé
      await page1.waitForTimeout(1_000)
      await page2.waitForTimeout(1_000)

      const timestamp = Date.now()
      const msg = `[E2E] Realtime ${timestamp}`

      // user1 envoie un message
      const msgInput = page1.locator(
        'input[name="message"], textarea[name="message"], [data-chat-input], #chat-input'
      )
      if (await msgInput.count() === 0) return // skip si pas de chat visible

      await msgInput.fill(msg)
      await page1.keyboard.press('Enter')

      // user2 doit recevoir le message sans rechargement (WebSocket)
      await expect(page2.locator('body')).toContainText(msg, { timeout: 10_000 })
    } finally {
      await ctx1.close()
      await ctx2.close()
    }
  })
})

// Chargement des messages plus anciens (Task 4 — le chat charge vers le haut)
// Les fixtures e2e ne seedent pas plus de 50 messages par canal : couvrir ici le cas
// pratique (bouton absent sous le seuil du lot) plutôt qu'un scénario de pagination
// complet qui exigerait de seeder >50 messages.
test.describe('5.2 — Chargement des messages plus anciens', () => {
  test('le bouton "Charger les messages plus anciens" est absent avec moins de 50 messages', async ({ user1Page: page }) => {
    const ids = loadTestIds()
    await page.goto(`/jam/${ids.jamOngoingId}`)

    const chatSection = page.locator('[data-chat], #chat, [aria-label*="chat" i]')
    if (await chatSection.count() === 0) test.skip()

    await expect(page.getByRole('button', { name: /charger les messages plus anciens/i })).toHaveCount(0)
  })

  test('la liste des messages est scrollée en bas au chargement de la page', async ({ user1Page: page }) => {
    const ids = loadTestIds()
    await page.goto(`/jam/${ids.jamOngoingId}`)

    const log = page.getByRole('log', { name: /messages du chat/i })
    if (await log.count() === 0) test.skip()

    await page.waitForTimeout(500)
    const { scrollTop, scrollHeight, clientHeight } = await log.evaluate(el => ({
      scrollTop: el.scrollTop,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }))
    // Tolérance d'un pixel d'arrondi
    expect(scrollTop + clientHeight).toBeGreaterThanOrEqual(scrollHeight - 1)
  })
})

// 5.3 — Flux réel de pagination montante : seed 51 messages sur un canal dédié
// ('team-search', inutilisé par les autres tests de ce fichier pour ne pas se percuter),
// directement via node-appwrite (pas de global-setup.ts, partagé par toute la suite e2e).
// Nettoyé en afterAll pour ne pas accumuler d'un run à l'autre.
test.describe('5.3 — Pagination montante réelle', () => {
  const CHANNEL = 'team-search'
  const HISTORY_COUNT = 51
  const createdIds: string[] = []
  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY)
  const databases = new Databases(client)

  test.beforeAll(async () => {
    const ids = loadTestIds()
    // Création séquentielle : garantit un $createdAt strictement croissant
    // (histoire 001 = la plus ancienne, histoire 051 = la plus récente).
    for (let i = 1; i <= HISTORY_COUNT; i++) {
      const doc = await databases.createDocument(DB, 'chat_messages', ID.unique(), {
        jam_id: ids.jamOngoingId,
        channel: CHANNEL,
        author_id: TEST_USERS.user1.id,
        author_name: TEST_USERS.user1.name,
        content: `[E2E] histoire ${String(i).padStart(3, '0')}`,
        role: 'user',
        pinned: false,
      })
      createdIds.push(doc.$id)
    }
  })

  test.afterAll(async () => {
    await Promise.all(createdIds.map(id => databases.deleteDocument(DB, 'chat_messages', id).catch(() => {})))

    const ids = loadTestIds()
    const residue = await databases.listDocuments(DB, 'chat_messages', [
      Query.equal('jam_id', ids.jamOngoingId),
      Query.equal('channel', CHANNEL),
    ])
    expect(residue.total, 'résidu de messages [E2E] histoire non nettoyé').toBe(0)
  })

  test('cliquer sur "Charger les messages plus anciens" charge le lot précédent sans doublon et préserve la position de scroll', async ({ user1Page: page }) => {
    const ids = loadTestIds()
    await page.goto(`/jam/${ids.jamOngoingId}`)

    // Basculer sur le canal Cherche équipe (retry : le clic peut partir avant l'hydratation)
    await expect(async () => {
      await page.getByRole('tab', { name: /cherche équipe/i }).click()
      await expect(page.locator('#chat-input')).toHaveAttribute('placeholder', /#Cherche équipe/i, { timeout: 1_000 })
    }).toPass({ timeout: 10_000 })

    const log = page.getByRole('log', { name: /messages du chat/i })
    await expect(page.getByText('[E2E] histoire 051', { exact: true })).toBeVisible({ timeout: 10_000 })

    // Le conteneur déborde réellement (51 messages dans un cadre de 600px) et est scrollé en
    // bas au premier rendu : preuve que le layout effect de scroll-to-bottom a bien joué.
    const initialScrollTop = await log.evaluate(el => el.scrollTop)
    expect(initialScrollTop).toBeGreaterThan(0)

    // Lot initial = les 50 plus récents (histoire 002..051) : le plus ancien (histoire 001)
    // n'est pas encore chargé, le bouton est visible.
    await expect(page.getByText('[E2E] histoire 001', { exact: true })).toHaveCount(0)
    const loadOlderBtn = page.getByRole('button', { name: /charger les messages plus anciens/i })
    await expect(loadOlderBtn).toBeVisible()

    // Le bouton est en haut de la liste, donc hors du viewport tant que le lecteur reste en
    // bas (comportement voulu au premier rendu). On simule le geste réel : remonter en haut
    // du conteneur pour lire l'historique et atteindre le bouton, comme documenté dans le
    // brief ("on remonte pour lire l'historique et charger plus"). Sans ce scroll manuel,
    // le `.click()` de Playwright ferait défiler le conteneur lui-même pour amener le bouton
    // en vue, ce qui fausserait la mesure de position ci-dessous.
    await log.evaluate(el => { el.scrollTop = 0 })

    // Ancre : le message actuellement le plus ancien affiché (histoire 002). Sa position
    // verticale à l'écran doit être préservée après l'insertion des messages plus anciens.
    const anchor = page.getByText('[E2E] histoire 002', { exact: true })
    await expect(anchor).toBeVisible()
    const anchorYBefore = (await anchor.boundingBox())!.y

    await loadOlderBtn.click()

    // Le message le plus ancien (jamais affiché avant ce clic) apparaît désormais.
    await expect(page.getByText('[E2E] histoire 001', { exact: true })).toBeVisible({ timeout: 10_000 })
    // Aucun doublon introduit par le lot inséré.
    await expect(page.getByText('[E2E] histoire 002', { exact: true })).toHaveCount(1)
    // Un seul message restait avant l'ancre (histoire 001) : le lot suivant revient incomplet
    // (1 < 50), nextCursor est null, le bouton disparaît.
    await expect(loadOlderBtn).toHaveCount(0)

    // Position de scroll préservée : l'ancre reste à peu près à la même position visuelle
    // (tolérance pour l'arrondi sub-pixel du navigateur).
    const anchorYAfter = (await anchor.boundingBox())!.y
    expect(Math.abs(anchorYAfter - anchorYBefore)).toBeLessThan(5)
  })
})
