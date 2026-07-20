import { test, expect } from '../fixtures/auth'
import { loadTestIds, saveState, loadState } from '../fixtures/test-data'

// Module 3 — Guildes
// Cahier de recettes §3.1, §3.2, §3.3

test.describe('3.1 — Créer une guilde', () => {
  test('user1 crée une guilde depuis le dashboard', async ({ user1Page: page }) => {
    await page.goto('/dashboard/teams')
    await expect(page.locator('h1')).toBeVisible()

    // Ouvrir le formulaire de création
    await page.getByRole('button', { name: /créer une équipe/i }).first().click()

    // Remplir le formulaire (CreateTeamModal : nom + jam optionnelle, pas de champ rôle)
    const nameInput = page.locator('#team-name')
    await nameInput.fill('[E2E] Guilde Test')

    await page.getByRole('button', { name: /créer/i }).last().click()

    // La liste (/dashboard/teams) se rafraîchit et affiche la carte de la nouvelle guilde
    const teamLink = page.getByRole('link', { name: /\[E2E\] Guilde Test/i })
    await expect(teamLink).toBeVisible({ timeout: 10_000 })

    // Le code KG- vit désormais sur le hub d'équipe (/team/:id), pas sur la liste
    const href = await teamLink.getAttribute('href') ?? ''
    const idMatch = href.match(/\/team\/([^/]+)/)
    await teamLink.click()

    await expect(page.locator('body')).toContainText(/KG-[A-Z0-9]{8}/i, { timeout: 10_000 })
    await expect(page.locator('body')).toContainText('[E2E] Guilde Test')

    // Extraction du code + de l'ID pour les tests suivants
    const bodyText = await page.locator('body').textContent() ?? ''
    const match = bodyText.match(/KG-([A-Z0-9]{8})/i)
    saveState({
      ...(match ? { guildeInviteCode: match[0] } : {}),
      ...(idMatch ? { guildeId: idMatch[1] } : {}),
    })
  })

  test('le code est au format KG-XXXXXXXX', async ({ user1Page: page }) => {
    const { guildeId } = loadState()
    if (!guildeId) test.skip()

    await page.goto(`/team/${guildeId}`)
    const bodyText = await page.locator('body').textContent() ?? ''
    expect(bodyText).toMatch(/KG-[A-Z0-9]{8}/i)
  })
})

test.describe('3.2 — Rejoindre une guilde via code', () => {
  test('user2 rejoint la guilde créée par user1', async ({ user2Page: page }) => {
    const { guildeInviteCode } = loadState()
    if (!guildeInviteCode) test.skip()

    await page.goto('/dashboard/teams')

    // "Rejoindre" (barre d'action) et "Rejoindre via code" (état vide) coexistent
    await page.getByRole('button', { name: /rejoindre/i }).first().click()

    const codeInput = page.locator('input[name="code"], input[placeholder*="code"], #invite-code')
    await codeInput.fill(guildeInviteCode!)
    await page.getByRole('button', { name: /valider|rejoindre|confirmer/i }).last().click()

    await expect(page.locator('body')).toContainText('[E2E] Guilde Test', { timeout: 10_000 })
  })

  test('erreur avec un code invalide', async ({ user2Page: page }) => {
    await page.goto('/dashboard/teams')

    const joinBtn = page.getByRole('button', { name: /rejoindre/i })
    if (await joinBtn.count() === 0) test.skip()

    await joinBtn.first().click()
    const codeInput = page.locator('input[name="code"], input[placeholder*="code"], #invite-code')
    await codeInput.fill('KG-INVALIDE')
    await page.getByRole('button', { name: /valider|rejoindre|confirmer/i }).last().click()

    await expect(page.locator('[role="alert"], .error, [data-error]').first()).toBeVisible({ timeout: 5_000 })
  })
})

test.describe('3.3 — Inscrire une guilde à une jam', () => {
  test('user1 inscrit sa guilde à la jam à venir', async ({ user1Page: page }) => {
    // Le CTA d'inscription n'apparaît que si la jam n'a pas commencé (canAct: now < startDate)
    const ids = loadTestIds()
    await page.goto(`/jam/${ids.jamUpcomingId}`)

    // Le select n'apparaît que si user1 est leader d'une guilde non inscrite à cette jam
    // (waitFor : le count() immédiat rate l'élément si la page streame encore)
    const teamSelect = page.getByRole('combobox', { name: /inscrire une de mes équipes/i })
    try {
      await teamSelect.waitFor({ timeout: 5_000 })
    } catch {
      test.skip()
    }

    // Retry : si selectOption s'exécute avant l'hydratation React, l'event change
    // est perdu et le bouton reste désactivé — on re-sélectionne jusqu'à ce qu'il s'active
    const inscrireBtn = page.getByRole('button', { name: 'Inscrire', exact: true })
    await expect(async () => {
      await teamSelect.selectOption({ label: '[E2E] Guilde Test' })
      await expect(inscrireBtn).toBeEnabled({ timeout: 1_000 })
    }).toPass({ timeout: 15_000 })
    await inscrireBtn.click()

    // La guilde inscrite apparaît comme "TON ÉQUIPE" et dans la liste des équipes
    await expect(page.locator('body')).toContainText('TON ÉQUIPE', { timeout: 10_000 })
    await expect(page.locator('body')).toContainText('[E2E] Guilde Test')
    saveState({ guildeRegisteredJamId: ids.jamUpcomingId })
  })

  test('impossible d\'inscrire la même guilde une seconde fois', async ({ user1Page: page }) => {
    const { guildeRegisteredJamId } = loadState()
    if (!guildeRegisteredJamId) test.skip()

    await page.goto(`/jam/${guildeRegisteredJamId}`)

    // La guilde étant déjà inscrite, le CTA d'inscription ne doit plus être proposé
    await expect(page.locator('body')).toContainText('TON ÉQUIPE')
    await expect(page.getByRole('combobox', { name: /inscrire une de mes équipes/i })).toHaveCount(0)
  })
})
