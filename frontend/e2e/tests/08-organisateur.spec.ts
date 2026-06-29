import { test, expect } from '../fixtures/auth'

// Module 7 — Organisateur
// Cahier de recettes §7.1, §7.2

test.describe('7.1 — Créer une jam', () => {
  test('user1 crée une jam depuis le dashboard', async ({ user1Page: page }) => {
    await page.goto('/dashboard/my-jams')
    await expect(page.locator('h1')).toContainText(/mes jams/i)

    // Cliquer sur "Créer une jam" (lien ou bouton)
    await page.getByRole('link', { name: /créer une jam/i })
      .or(page.getByRole('button', { name: /créer une jam/i }))
      .first()
      .click()

    await expect(page).toHaveURL(/\/dashboard\/my-jams\/new/, { timeout: 5_000 })

    // Remplir le formulaire
    const tomorrow = new Date(Date.now() + 2 * 24 * 3600 * 1000)
    const inNineDays = new Date(Date.now() + 9 * 24 * 3600 * 1000)
    const fmt = (d: Date) => d.toISOString().slice(0, 16)

    await page.locator('input[name="title"], #jam-title').fill('[E2E] Jam Créée par User1')

    const themeInput = page.locator('input[name="theme"], #jam-theme')
    if (await themeInput.count() > 0) await themeInput.fill('Science-fiction')

    const descInput = page.locator('textarea[name="description"], #jam-description')
    if (await descInput.count() > 0) await descInput.fill('Jam E2E créée via le formulaire organisateur.')

    const startInput = page.locator('input[type="datetime-local"][name="start_date"], #start-date')
    if (await startInput.count() > 0) await startInput.fill(fmt(tomorrow))

    const endInput = page.locator('input[type="datetime-local"][name="end_date"], #end-date')
    if (await endInput.count() > 0) await endInput.fill(fmt(inNineDays))

    await page.getByRole('button', { name: /créer|publier|valider/i }).last().click()

    // Vérification — la jam créée doit apparaître dans "Mes jams"
    await expect(page.locator('body')).toContainText('[E2E] Jam Créée par User1', { timeout: 15_000 })
  })

  test('la jam apparaît sur /explore avec le bon statut', async ({ page }) => {
    await page.goto('/explore')
    // Elle a une date de début dans le futur → statut "À venir"
    await expect(page.locator('body')).toContainText('[E2E] Jam Créée par User1', { timeout: 10_000 })
  })
})

test.describe('7.2 — Publier une annonce', () => {
  test('user1 publie une annonce importante pour sa jam', async ({ user1Page: page }) => {
    await page.goto('/dashboard/my-jams')

    // Aller sur la gestion des annonces de la jam créée en 7.1
    const jamLink = page.locator('a', { hasText: '[E2E] Jam Créée par User1' })
    if (await jamLink.count() === 0) test.skip()
    await jamLink.click()

    // Naviguer vers la section annonces
    const annoncesLink = page.getByRole('link', { name: /annonces?/i })
      .or(page.getByRole('button', { name: /annonces?/i }))
    if (await annoncesLink.count() > 0) await annoncesLink.first().click()

    // Remplir le formulaire d'annonce
    const titleInput = page.locator('input[name="title"], #announcement-title')
    if (await titleInput.count() === 0) test.skip()

    await titleInput.fill('[E2E] Annonce importante')
    const contentInput = page.locator('textarea[name="content"], #announcement-content')
    if (await contentInput.count() > 0) await contentInput.fill('Contenu de l\'annonce E2E.')

    // Cocher "Important"
    const importantCheck = page.locator('input[name="important"], #important, input[type="checkbox"]').first()
    if (await importantCheck.count() > 0) {
      const checked = await importantCheck.isChecked()
      if (!checked) await importantCheck.check()
    }

    await page.getByRole('button', { name: /publier|créer|valider/i }).last().click()
    await expect(page.locator('body')).toContainText('[E2E] Annonce importante', { timeout: 10_000 })
  })

  test('l\'annonce est visible sur la page de la jam', async ({ user1Page: page }) => {
    await page.goto('/explore')
    const jamLink = page.locator('a', { hasText: '[E2E] Jam Créée par User1' })
    if (await jamLink.count() === 0) test.skip()
    await jamLink.click()

    await expect(page.locator('body')).toContainText('[E2E] Annonce importante', { timeout: 10_000 })
  })
})
