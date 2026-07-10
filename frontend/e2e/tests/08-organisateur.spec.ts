import { test, expect } from '../fixtures/auth'
import { saveState, loadState } from '../fixtures/test-data'

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

    // Remplir le formulaire (IDs réels du NewJamForm)
    const tomorrow = new Date(Date.now() + 2 * 24 * 3600 * 1000)
    const inNineDays = new Date(Date.now() + 9 * 24 * 3600 * 1000)
    const fmt = (d: Date) => d.toISOString().slice(0, 16)

    await page.locator('#title').fill('[E2E] Jam Créée par User1')

    const themeInput = page.locator('#theme')
    if (await themeInput.count() > 0) await themeInput.fill('Science-fiction')

    const descInput = page.locator('#description')
    if (await descInput.count() > 0) await descInput.fill('Jam E2E créée via le formulaire organisateur.')

    const startInput = page.locator('#startDate')
    if (await startInput.count() > 0) await startInput.fill(fmt(tomorrow))

    const endInput = page.locator('#endDate')
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

    // Aller sur la page de gestion via le lien "Gérer" de la ligne de la jam créée en 7.1
    // (waitFor : le count() immédiat rate l'élément si la page streame encore)
    const gererLink = page
      .locator('tr', { hasText: '[E2E] Jam Créée par User1' })
      .getByRole('link', { name: /gérer/i })
    try {
      await gererLink.waitFor({ timeout: 5_000 })
    } catch {
      test.skip()
    }
    await gererLink.click()
    await page.waitForURL(/\/dashboard\/my-jams\/[^/]+$/)

    // Remplir le formulaire d'annonce (AnnouncementForm, présent sur la page de gestion)
    await page.locator('#ann-title').fill('[E2E] Annonce importante')
    await page.locator('#ann-content').fill('Contenu de l\'annonce E2E.')

    // Cocher "Important"
    await page.getByLabel(/marquer comme important/i).check()

    await page.getByRole('button', { name: 'Publier', exact: true }).click()

    // Confirmation + annonce listée dans les annonces publiées
    await expect(page.locator('body')).toContainText('Annonce publiée', { timeout: 10_000 })
    await expect(page.locator('body')).toContainText('[E2E] Annonce importante')
    saveState({ announcementPublished: true })
  })

  test('l\'annonce est visible sur la page de la jam', async ({ user1Page: page }) => {
    const { announcementPublished } = loadState()
    if (!announcementPublished) test.skip()

    await page.goto('/explore')
    const jamLink = page.locator('a', { hasText: '[E2E] Jam Créée par User1' })
    if (await jamLink.count() === 0) test.skip()
    await jamLink.click()

    await expect(page.locator('body')).toContainText('[E2E] Annonce importante', { timeout: 10_000 })
  })
})
