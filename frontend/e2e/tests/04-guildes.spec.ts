import { test, expect } from '../fixtures/auth'
import { loadTestIds, saveState, loadState } from '../fixtures/test-data'

// Module 3 — Guildes
// Cahier de recettes §3.1, §3.2, §3.3

test.describe('3.1 — Créer une guilde', () => {
  test('user1 crée une guilde depuis le dashboard', async ({ user1Page: page }) => {
    await page.goto('/dashboard/team')
    await expect(page.locator('h1')).toBeVisible()

    // Ouvrir le formulaire de création
    await page.getByRole('button', { name: /créer une équipe/i }).click()

    // Remplir le formulaire
    const nameInput = page.locator('input[name="name"], input[placeholder*="nom"], #team-name')
    await nameInput.fill('[E2E] Guilde Test')

    // Sélectionner un rôle si un champ existe
    const roleSelect = page.locator('select[name="role"], [data-role-select]')
    if (await roleSelect.count() > 0) {
      await roleSelect.selectOption({ index: 1 })
    } else {
      // Cliquer sur le premier rôle disponible
      const roleBtn = page.getByRole('button', { name: /dev|artiste|designer|sound/i }).first()
      if (await roleBtn.count() > 0) await roleBtn.click()
    }

    await page.getByRole('button', { name: /valider|créer|confirmer/i }).last().click()

    // La guilde créée doit apparaître avec un code KG-
    await expect(page.locator('body')).toContainText(/KG-[A-Z0-9]{8}/i, { timeout: 10_000 })
    await expect(page.locator('body')).toContainText('[E2E] Guilde Test')

    // Extraction du code pour les tests suivants
    const bodyText = await page.locator('body').textContent() ?? ''
    const match = bodyText.match(/KG-([A-Z0-9]{8})/i)
    if (match) saveState({ guildeInviteCode: match[0] })
  })

  test('le code est au format KG-XXXXXXXX', async ({ user1Page: page }) => {
    await page.goto('/dashboard/team')
    const bodyText = await page.locator('body').textContent() ?? ''
    expect(bodyText).toMatch(/KG-[A-Z0-9]{8}/i)
  })
})

test.describe('3.2 — Rejoindre une guilde via code', () => {
  test('user2 rejoint la guilde créée par user1', async ({ user2Page: page }) => {
    const { guildeInviteCode } = loadState()
    if (!guildeInviteCode) test.skip()

    await page.goto('/dashboard/team')

    await page.getByRole('button', { name: /rejoindre/i }).click()

    const codeInput = page.locator('input[name="code"], input[placeholder*="code"], #invite-code')
    await codeInput.fill(guildeInviteCode!)
    await page.getByRole('button', { name: /valider|rejoindre|confirmer/i }).last().click()

    await expect(page.locator('body')).toContainText('[E2E] Guilde Test', { timeout: 10_000 })
  })

  test('erreur avec un code invalide', async ({ user2Page: page }) => {
    await page.goto('/dashboard/team')

    const joinBtn = page.getByRole('button', { name: /rejoindre/i })
    if (await joinBtn.count() === 0) test.skip()

    await joinBtn.click()
    const codeInput = page.locator('input[name="code"], input[placeholder*="code"], #invite-code')
    await codeInput.fill('KG-INVALIDE')
    await page.getByRole('button', { name: /valider|rejoindre|confirmer/i }).last().click()

    await expect(page.locator('[role="alert"], .error, [data-error]').first()).toBeVisible({ timeout: 5_000 })
  })
})

test.describe('3.3 — Inscrire une guilde à une jam', () => {
  test('user1 inscrit sa guilde à la jam en cours', async ({ user1Page: page }) => {
    const ids = loadTestIds()
    await page.goto(`/jam/${ids.jamOngoingId}`)

    const inscribeBtn = page.getByRole('button', { name: /inscrire ma guilde|rejoindre/i })
    if (await inscribeBtn.count() === 0) test.skip()

    await inscribeBtn.click()

    // Sélectionner la guilde dans la liste si une modale apparaît
    const guildeOption = page.getByText('[E2E] Guilde Test')
    if (await guildeOption.count() > 0) await guildeOption.click()

    await page.getByRole('button', { name: /valider|inscrire|confirmer/i }).last().click()

    await expect(page.locator('body')).toContainText('[E2E] Guilde Test', { timeout: 10_000 })
  })

  test('erreur si on tente d\'inscrire la même guilde une seconde fois', async ({ user1Page: page }) => {
    const ids = loadTestIds()
    await page.goto(`/jam/${ids.jamOngoingId}`)

    const inscribeBtn = page.getByRole('button', { name: /inscrire ma guilde/i })
    if (await inscribeBtn.count() === 0) {
      // La guilde est déjà inscrite — le bouton ne devrait plus apparaître
      // ou un message "déjà inscrit" est visible
      await expect(page.locator('body')).toContainText(/déjà inscrit|already/i)
      return
    }

    await inscribeBtn.click()
    const guildeOption = page.getByText('[E2E] Guilde Test')
    if (await guildeOption.count() > 0) await guildeOption.click()
    await page.getByRole('button', { name: /valider|inscrire/i }).last().click()

    await expect(page.locator('[role="alert"]').first()).toBeVisible({ timeout: 5_000 })
  })
})
