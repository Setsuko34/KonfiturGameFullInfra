import { test, expect } from '@playwright/test'

// Scénario : Smoke test — infrastructure répond avant tout le reste
// Cahier de recettes §Smoke test

test('frontend répond avec HTTP 200', async ({ page }) => {
  const res = await page.goto('/')
  expect(res?.status()).toBe(200)
})

test("page d'accueil se charge sans erreur", async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Konfitur/i)
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
})

test('Appwrite health check passe', async ({ request }) => {
  const res = await request.get('http://localhost:8080/v1/health')
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.status).toBe('pass')
})

test('page 404 pour une route inexistante', async ({ page }) => {
  await page.goto('/route-qui-nexiste-pas-du-tout-e2e')
  // Next.js retourne 404 — la page doit indiquer une erreur
  await expect(page.locator('body')).toContainText(/404|introuvable|not found/i)
})
