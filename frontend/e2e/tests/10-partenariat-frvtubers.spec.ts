import { test, expect } from '../fixtures/auth'

// Module 10 — Partenariat FRVtubers (issue #40)
// Encart partenaire, lien footer et CTA d'accueil conditionnel à la session

const FRVTUBERS_URL = 'https://frvtubers.com'

test.describe('10.1 — Visiteur anonyme', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('l\'encart FRVtubers pointe vers le site partenaire en lien sécurisé', async ({ page }) => {
    await page.goto('/')

    const link = page.locator('main').locator(`a[href="${FRVTUBERS_URL}"]`)
    await expect(link).toHaveCount(1)
    await expect(link).toHaveAttribute('rel', /noopener/)
    await expect(link).toHaveAttribute('rel', /noreferrer/)
  })

  test('le bloc « PRÊT ? » propose de créer un compte', async ({ page }) => {
    await page.goto('/')

    const register = page.locator('main').getByRole('link', { name: 'Créer mon compte' })
    await expect(register).toBeVisible()
    await expect(register).toHaveAttribute('href', '/auth/register')
    // Le bloc réservé aux membres n'apparaît jamais pour un visiteur
    await expect(page.locator('main').getByRole('link', { name: 'Créer une jam' })).toHaveCount(0)
  })

  test('le footer contient le lien FRVtubers', async ({ page }) => {
    await page.goto('/')

    const link = page.locator('footer').locator(`a[href="${FRVTUBERS_URL}"]`)
    await expect(link).toHaveCount(1)
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(link).toHaveAttribute('rel', /noopener/)
    await expect(link).toHaveAttribute('rel', /noreferrer/)
  })

  test('l\'encart partenaire précède le bloc d\'appel à l\'action', async ({ page }) => {
    await page.goto('/')

    // Le CTA est rendu côté client après le chargement de la session
    await expect(page.locator('#cta-heading')).toBeVisible()

    const banner = page.locator('main section[aria-labelledby="frvtubers-heading"]')
    const cta = page.locator('main section[aria-labelledby="cta-heading"]')
    await expect(banner).toHaveCount(1)
    await expect(cta).toHaveCount(1)

    const bannerBeforeCta = await banner.evaluate(
      (el, ctaEl) => Boolean(el.compareDocumentPosition(ctaEl as Node) & Node.DOCUMENT_POSITION_FOLLOWING),
      await cta.elementHandle(),
    )
    expect(bannerBeforeCta).toBe(true)
  })
})

test.describe('10.2 — Utilisateur connecté', () => {
  test('le CTA propose de créer une jam au lieu de créer un compte', async ({ user1Page }) => {
    await user1Page.goto('/')
    const main = user1Page.locator('main')

    // Attendre le lien membre : le CTA est rendu côté client une fois la session chargée
    const createJam = main.getByRole('link', { name: 'Créer une jam' })
    await expect(createJam).toBeVisible({ timeout: 15_000 })
    await expect(createJam).toHaveAttribute('href', '/dashboard/my-jams/new')

    await expect(main.getByRole('link', { name: 'Créer mon compte' })).toHaveCount(0)
  })

  test('l\'encart FRVtubers reste présent', async ({ user1Page }) => {
    await user1Page.goto('/')

    await expect(user1Page.locator('#frvtubers-heading')).toBeVisible()
    await expect(user1Page.locator('main').locator(`a[href="${FRVTUBERS_URL}"]`)).toHaveCount(1)
  })
})
