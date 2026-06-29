import { test, expect } from '@playwright/test'
import { TEST_USERS } from '../fixtures/test-data'

// Module 1 — Authentification
// Cahier de recettes §1.1, §1.2

test.describe('1.1 — Inscription email/mot de passe', () => {
  test.use({ storageState: { cookies: [], origins: [] } }) // contexte anonyme

  test('inscription avec données valides redirige vers accueil', async ({ page }) => {
    await page.goto('/auth/register')
    await expect(page.locator('h1')).toContainText('Créer un compte')

    await page.locator('#name').fill(TEST_USERS.regTest.name)
    await page.locator('#email').fill(TEST_USERS.regTest.email)
    await page.locator('#password').fill(TEST_USERS.regTest.password)
    await page.locator('button[type="submit"]').click()

    await page.waitForURL(url => !url.pathname.startsWith('/auth'), { timeout: 15_000 })
    // Session active — le bouton login ne doit plus apparaître
    await expect(page.locator('body')).not.toContainText('Se connecter')
  })

  test('session persistante après rechargement', async ({ page }) => {
    // L'utilisateur créé dans le test précédent est encore connecté dans ce contexte
    await page.goto('/auth/login')
    // Si déjà connecté, on est redirigé ailleurs
    await page.waitForURL(url => !url.pathname.startsWith('/auth'), { timeout: 10_000 })
  })

  test('erreur pour email déjà utilisé', async ({ page }) => {
    await page.goto('/auth/register')
    await page.locator('#name').fill('Doublon')
    await page.locator('#email').fill(TEST_USERS.regTest.email)
    await page.locator('#password').fill(TEST_USERS.regTest.password)
    await page.locator('button[type="submit"]').click()

    await expect(page.locator('[role="alert"]')).toBeVisible()
    await expect(page.locator('[role="alert"]')).toContainText(/exist|déjà/i)
  })

  test('erreur de validation — email malformé', async ({ page }) => {
    await page.goto('/auth/register')
    await page.locator('#name').fill('Test')
    await page.locator('#email').fill('pas-un-email')
    await page.locator('#password').fill(TEST_USERS.regTest.password)
    // Le bouton doit rester cliquable mais le navigateur ou l'app valide
    const submitBtn = page.locator('button[type="submit"]')
    // HTML5 type="email" bloque nativement — on vérifie que la page ne change pas
    await submitBtn.click()
    await expect(page).toHaveURL(/\/auth\/register/)
  })

  test('erreur de validation — mot de passe trop court', async ({ page }) => {
    await page.goto('/auth/register')
    await page.locator('#name').fill('Test')
    await page.locator('#email').fill('e2e-short@test.local')
    await page.locator('#password').fill('abc')
    await page.locator('button[type="submit"]').click()

    // Les exigences de mot de passe s'affichent
    await expect(page.locator('#password-requirements')).toBeVisible()
    await expect(page.locator('[role="alert"]')).toBeVisible()
  })
})

test.describe('1.2 — Connexion email/mot de passe', () => {
  test.use({ storageState: { cookies: [], origins: [] } }) // contexte anonyme

  test('connexion avec identifiants corrects redirige vers accueil', async ({ page }) => {
    await page.goto('/auth/login')
    await expect(page.locator('h1')).toContainText('Connexion')

    await page.locator('#email').fill(TEST_USERS.user1.email)
    await page.locator('#password').fill(TEST_USERS.user1.password)
    await page.locator('button[type="submit"]').click()

    await page.waitForURL(url => !url.pathname.startsWith('/auth'), { timeout: 15_000 })
  })

  test('/dashboard redirige vers login si non connecté', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/auth\/login\?redirect=.*dashboard/)
  })

  test('/admin redirige si non connecté', async ({ page }) => {
    await page.goto('/admin')
    // L'admin retourne 404 si pas admin, mais si pas du tout connecté → login ou 404
    const url = page.url()
    const body = await page.locator('body').textContent()
    // Soit redirigé vers login, soit 404 — dans tous les cas pas le panel admin
    expect(url.includes('/auth/login') || (body ?? '').includes('404')).toBeTruthy()
  })

  test('redirection post-login vers la page demandée', async ({ page }) => {
    await page.goto('/dashboard?redirect_check=1')
    // Redirigé vers login avec redirect param
    await expect(page).toHaveURL(/\/auth\/login/)

    await page.locator('#email').fill(TEST_USERS.user1.email)
    await page.locator('#password').fill(TEST_USERS.user1.password)
    await page.locator('button[type="submit"]').click()

    await page.waitForURL(/\/dashboard/, { timeout: 15_000 })
  })

  test('erreur avec mauvais mot de passe', async ({ page }) => {
    await page.goto('/auth/login')
    await page.locator('#email').fill(TEST_USERS.user1.email)
    await page.locator('#password').fill('mauvais-mot-de-passe')
    await page.locator('button[type="submit"]').click()

    await expect(page.locator('[role="alert"]')).toBeVisible()
    await expect(page).toHaveURL(/\/auth\/login/)
  })
})
