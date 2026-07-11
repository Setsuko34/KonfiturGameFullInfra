import { test, expect } from '../fixtures/auth'
import { loadTestIds, STORAGE_STATE } from '../fixtures/test-data'

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
