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

  test('page de connexion accessible sans session', async ({ page }) => {
    // Contexte anonyme (storageState vide) — la page de login doit être visible
    await page.goto('/auth/login')
    await expect(page.locator('h1')).toContainText('Connexion')
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
  })

  test('erreur pour email déjà utilisé', async ({ page }) => {
    await page.goto('/auth/register')
    await page.locator('#name').fill('Doublon')
    await page.locator('#email').fill(TEST_USERS.regTest.email)
    await page.locator('#password').fill(TEST_USERS.regTest.password)
    await page.locator('button[type="submit"]').click()

    await expect(page.locator('[role="alert"]:not([id="__next-route-announcer__"])')).toBeVisible()
    await expect(page.locator('[role="alert"]:not([id="__next-route-announcer__"])')).toContainText(/exist|déjà/i)
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
    // Cliquer d'abord pour déclencher onFocus (passwordTouched = true)
    await page.locator('#password').click()
    await page.locator('#password').fill('abc')
    // Les exigences doivent s'afficher dès que le champ a du contenu
    await expect(page.locator('#password-requirements')).toBeVisible()
    await page.locator('button[type="submit"]').click()
    // La validation client-côté bloque la soumission et affiche l'erreur
    await expect(page.locator('[role="alert"]:not([id="__next-route-announcer__"])')).toBeVisible({ timeout: 5_000 })
  })

  test('les critères de mot de passe montrent X quand non satisfaits, Check quand satisfaits', async ({ page }) => {
    await page.goto('/auth/register')
    const pwd = page.locator('#password')
    await pwd.click() // déclenche onFocus → passwordTouched → liste visible

    const requirements = page.locator('#password-requirements li')
    await expect(requirements.first()).toBeVisible()

    // Champ vide : tous les critères non satisfaits → aucune coche, que des X
    await expect(page.locator('#password-requirements [data-icon="check"]')).toHaveCount(0)
    const totalCriteria = await requirements.count()
    await expect(page.locator('#password-requirements [data-icon="x"]')).toHaveCount(totalCriteria)

    // Mot de passe fort : tous satisfaits → que des Check
    await pwd.fill('MotDePasseSolide123!')
    await expect(page.locator('#password-requirements [data-icon="x"]')).toHaveCount(0)
    await expect(page.locator('#password-requirements [data-icon="check"]')).toHaveCount(totalCriteria)
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

    await expect(page.locator('[role="alert"]:not([id="__next-route-announcer__"])')).toBeVisible()
    await expect(page).toHaveURL(/\/auth\/login/)

    // Issue #50 — le texte d'erreur doit utiliser --error (#FF6B81), pas --secondary
    const alertColor = await page.locator('[role="alert"]:not([id="__next-route-announcer__"])').evaluate(el => getComputedStyle(el).color)
    expect(alertColor).toBe('rgb(255, 107, 129)') // #FF6B81
  })
})

test.describe('1.3 — Mot de passe oublié', () => {
  test.use({ storageState: { cookies: [], origins: [] } }) // contexte anonyme

  test('la page forgot-password se charge et affiche le formulaire', async ({ page }) => {
    await page.goto('/auth/forgot-password')
    await expect(page.locator('h1')).toContainText('Mot de passe oublié')
    await expect(page.locator('#email')).toBeVisible()
  })

  test("la demande affiche le même message de confirmation quel que soit l'email (anti-énumération)", async ({ page }) => {
    await page.goto('/auth/forgot-password')
    await page.locator('#email').fill('nexiste-pas-du-tout@test.local')
    await page.getByRole('button', { name: 'Envoyer le lien de réinitialisation' }).click()
    await expect(page.getByRole('status')).toContainText('Si un compte existe pour cette adresse', { timeout: 10_000 })
  })

  test('reset-password sans paramètres affiche le message de lien invalide', async ({ page }) => {
    await page.goto('/auth/reset-password')
    await expect(page.locator('[role="alert"]:not([id="__next-route-announcer__"])')).toContainText('Lien invalide ou expiré')
  })

  test('reset-password refuse des mots de passe différents (validation client)', async ({ page }) => {
    await page.goto('/auth/reset-password?userId=fake&secret=fake')
    await page.locator('#new-password').fill('MotDePasse123!')
    await page.locator('#confirm-password').fill('Different456!')
    await page.getByRole('button', { name: 'Réinitialiser le mot de passe' }).click()
    await expect(page.locator('[role="alert"]:not([id="__next-route-announcer__"])')).toContainText('Les mots de passe ne correspondent pas')
  })
})
