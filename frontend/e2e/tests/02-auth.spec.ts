import { test, expect } from '@playwright/test'
import { test as authTest } from '../fixtures/auth'
import { TEST_USERS } from '../fixtures/test-data'

// Module 1 — Authentification
// Cahier de recettes §1.1, §1.2

test.describe('1.1 — Inscription email/mot de passe', () => {
  test.use({ storageState: { cookies: [], origins: [] } }) // contexte anonyme

  // Bloque les vrais envois SMTP (les @test.local bounceraient chez Resend)
  // tout en laissant le test vérifier que l'appel part bien.
  test.beforeEach(async ({ page }) => {
    await page.route('**/account/verifications/email', route =>
      route.fulfill({ status: 201, contentType: 'application/json', body: '{}' })
    )
  })

  test('inscription avec données valides redirige vers accueil', async ({ page }) => {
    await page.goto('/auth/register')
    await expect(page.locator('h1')).toContainText('Créer un compte')

    await page.locator('#name').fill(TEST_USERS.regTest.name)
    await page.locator('#email').fill(TEST_USERS.regTest.email)
    await page.locator('#password').fill(TEST_USERS.regTest.password)
    // Issue #70 : l'inscription doit déclencher l'envoi de l'email de vérification
    const verificationSent = page.waitForRequest(
      req => req.url().includes('/account/verifications/email') && req.method() === 'POST',
      { timeout: 15_000 }
    )
    await page.locator('button[type="submit"]').click()
    await verificationSent

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

  test('les champs requis portent un astérisque et la légende est visible', async ({ page }) => {
    await page.goto('/auth/register')
    await expect(page.getByText('* champ obligatoire')).toBeVisible()
    for (const id of ['name', 'email', 'password']) {
      await expect(page.locator(`label[for="${id}"] [aria-hidden="true"]`),
        `astérisque manquant sur #${id}`).toHaveText('*')
    }

    await page.goto('/auth/login')
    await expect(page.getByText('* champ obligatoire')).toBeVisible()
    for (const id of ['email', 'password']) {
      await expect(page.locator(`label[for="${id}"] [aria-hidden="true"]`)).toHaveText('*')
    }
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

  test('les boutons ont cursor pointer (not-allowed si désactivés)', async ({ page }) => {
    await page.goto('/auth/login')
    // Bouton submit désactivé tant que les champs sont vides
    const submit = page.getByRole('button', { name: 'Se connecter' })
    expect(await submit.evaluate(el => getComputedStyle(el).cursor)).toBe('not-allowed')

    // Bouton actif (afficher/masquer le mot de passe)
    const toggle = page.getByRole('button', { name: 'Afficher le mot de passe' })
    expect(await toggle.evaluate(el => getComputedStyle(el).cursor)).toBe('pointer')
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

  test('le lien « Mot de passe oublié ? » mène à la page de réinitialisation', async ({ page }) => {
    await page.goto('/auth/login')
    await page.getByRole('link', { name: 'Mot de passe oublié ?' }).click()
    await expect(page).toHaveURL(/\/auth\/forgot-password/)
    await expect(page.locator('h1')).toContainText('Mot de passe oublié')
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

test.describe('1.4 — Vérification d\'adresse email', () => {
  test.use({ storageState: { cookies: [], origins: [] } }) // contexte anonyme

  test('verify-email sans paramètres affiche le message de lien invalide', async ({ page }) => {
    await page.goto('/auth/verify-email')
    await expect(page.locator('[role="alert"]:not([id="__next-route-announcer__"])'))
      .toContainText('Lien invalide ou expiré')
  })

  test('verify-email avec des paramètres bidons affiche le message de lien invalide', async ({ page }) => {
    await page.goto('/auth/verify-email?userId=fake&secret=fake')
    await expect(page.locator('[role="alert"]:not([id="__next-route-announcer__"])'))
      .toContainText('Lien invalide ou expiré', { timeout: 10_000 })
  })

  test('verify-email en erreur sans session propose la connexion, pas le renvoi', async ({ page }) => {
    await page.goto('/auth/verify-email')
    await expect(page.getByRole('link', { name: 'Se connecter pour renvoyer un lien' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Renvoyer l\'email de vérification' })).toHaveCount(0)
  })
})

authTest.describe('1.4bis — Renvoi du lien de vérification (connecté)', () => {
  authTest('le bouton renvoyer déclenche un nouvel envoi et confirme', async ({ user1Page: page }) => {
    // Bloque le vrai envoi SMTP (contrainte globale : jamais de bounce @test.local)
    await page.route('**/account/verifications/email', route =>
      route.fulfill({ status: 201, contentType: 'application/json', body: '{}' })
    )
    await page.goto('/auth/verify-email')
    const resendRequest = page.waitForRequest(
      req => req.url().includes('/account/verifications/email') && req.method() === 'POST',
      { timeout: 10_000 }
    )
    await page.getByRole('button', { name: 'Renvoyer l\'email de vérification' }).click()
    await resendRequest
    await expect(page.getByRole('status')).toContainText('Un nouvel email de vérification vient d\'être envoyé')
  })
})
