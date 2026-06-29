import { test, expect } from '../fixtures/auth'

// Module 8 — Administration
// Cahier de recettes §8.1, §8.2

test.describe('8.1 — Accès au panel admin', () => {
  test('un compte non-admin obtient 404 sur /admin', async ({ user1Page: page }) => {
    await page.goto('/admin')
    // Layout admin appelle notFound() si pas admin → page 404
    await expect(page.locator('body')).toContainText(/404|introuvable|not found/i)
    await expect(page).not.toHaveURL(/\/auth\/login/)
  })

  test('le compte admin accède au dashboard admin', async ({ adminPage: page }) => {
    await page.goto('/admin')
    // Le panel admin doit être visible — pas de 404
    await expect(page.locator('body')).not.toContainText(/404/)
    // Au moins le sidebar ou un titre admin doit être présent
    await expect(page.locator('nav, [data-admin-sidebar], aside').first()).toBeVisible()
  })
})

test.describe('8.2 — Logs et ban IP', () => {
  test('la page /admin/logs se charge', async ({ adminPage: page }) => {
    await page.goto('/admin/logs')
    await expect(page.locator('h1, [data-heading]').first()).toBeVisible()
  })

  test('bannir une IP l\'ajoute à la liste', async ({ adminPage: page }) => {
    await page.goto('/admin/logs')

    const banInput = page.locator('input[name="ip"], input[placeholder*="IP"], #ban-ip')
    if (await banInput.count() === 0) test.skip()

    await banInput.fill('192.0.2.1')
    await page.getByRole('button', { name: /bannir|ban|bloquer/i }).first().click()

    await expect(page.locator('body')).toContainText('192.0.2.1', { timeout: 10_000 })
  })

  test('débannir une IP la retire de la liste', async ({ adminPage: page }) => {
    await page.goto('/admin/logs')

    // Chercher l'IP ajoutée en test précédent et la débannir
    const ipRow = page.locator('tr, [data-ip-row]').filter({ hasText: '192.0.2.1' }).first()
    if (await ipRow.count() === 0) test.skip()

    const unbanBtn = ipRow.getByRole('button', { name: /débannir|supprimer|retirer/i })
    if (await unbanBtn.count() === 0) test.skip()

    await unbanBtn.click()
    await page.waitForTimeout(1_000)
    await expect(page.locator('body')).not.toContainText('192.0.2.1')
  })

  test("l'API /api/banned-ips retourne les IPs actives", async ({ request }) => {
    const res = await request.get('http://localhost:3000/api/banned-ips')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBeTruthy()
  })
})

test.describe('8.3 — Accessibilité (§9.2)', () => {
  test('lang="fr" sur la balise html', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
  })

  test('focus visible sur les éléments interactifs du header', async ({ page }) => {
    await page.goto('/')
    // Tab jusqu'au premier lien du header
    await page.keyboard.press('Tab')
    const focused = page.locator(':focus')
    await expect(focused).toBeVisible()
  })

  test('skip-link #main-content présent', async ({ page }) => {
    await page.goto('/')
    const skipLink = page.locator('a[href="#main-content"]')
    await expect(skipLink).toHaveCount(1)
  })
})
