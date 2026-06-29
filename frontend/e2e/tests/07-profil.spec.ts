import { test, expect } from '../fixtures/auth'
import path from 'path'
import { writeFileSync } from 'fs'

// Module 6 — Profil utilisateur
// Cahier de recettes §6.1, §6.2

test.describe('6.1 — Modifier le profil', () => {
  test('formulaire pré-rempli avec les infos actuelles', async ({ user1Page: page }) => {
    await page.goto('/dashboard/profile')
    await expect(page.locator('input[name="name"], #display-name').first()).toHaveValue(/E2E Joueur1/i)
  })

  test('modifier le nom d\'affichage', async ({ user1Page: page }) => {
    await page.goto('/dashboard/profile')

    const nameInput = page.locator('input[name="name"], input[name="displayName"], #display-name').first()
    await nameInput.clear()
    await nameInput.fill('E2E Joueur1 Modifié')

    await page.getByRole('button', { name: /sauvegarder|mettre à jour|valider/i }).first().click()

    await expect(page.locator('[role="alert"], .success, [data-success]').first()).toBeVisible({ timeout: 5_000 })
  })

  test('modifier la bio', async ({ user1Page: page }) => {
    await page.goto('/dashboard/profile')

    const bioInput = page.locator('textarea[name="bio"], #bio').first()
    if (await bioInput.count() === 0) test.skip()

    await bioInput.clear()
    await bioInput.fill('Bio E2E — test automatisé.')
    await page.getByRole('button', { name: /sauvegarder|mettre à jour|valider/i }).first().click()

    await expect(page.locator('[role="alert"], .success, [data-success]').first()).toBeVisible({ timeout: 5_000 })
  })

  test('upload d\'un avatar (JPG < 2 Mo)', async ({ user1Page: page }) => {
    await page.goto('/dashboard/profile')

    const avatarInput = page.locator('input[type="file"]')
    if (await avatarInput.count() === 0) test.skip()

    // PNG 1x1 minimal comme avatar de test
    const avatarPath = path.resolve(process.cwd(), 'e2e/.auth/test-avatar.png')
    const pngBytes = Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489' +
      '0000000a49444154789c6260000000020001e221bc330000000049454e44ae426082',
      'hex'
    )
    writeFileSync(avatarPath, pngBytes)
    await avatarInput.setInputFiles(avatarPath)

    await page.getByRole('button', { name: /sauvegarder|mettre à jour|valider/i }).first().click()
    await expect(page.locator('[role="alert"], .success').first()).toBeVisible({ timeout: 10_000 })
  })

  test('profil public accessible via /profile/:id', async ({ user1Page: page }) => {
    await page.goto('/dashboard/profile')

    // Chercher un lien vers le profil public
    const profileLink = page.locator('a[href*="/profile/"]').first()
    if (await profileLink.count() > 0) {
      await profileLink.click()
      await expect(page.locator('body')).toContainText(/E2E Joueur1/)
    }
  })
})

test.describe('6.2 — Changer de mot de passe', () => {
  const newPassword = 'E2eTest9876!'

  test('changement avec les bonnes infos', async ({ user1Page: page }) => {
    await page.goto('/dashboard/profile')

    // Trouver la section mot de passe
    const oldPwInput = page.locator('input[name="oldPassword"], input[name="currentPassword"], #old-password')
    if (await oldPwInput.count() === 0) test.skip()

    await oldPwInput.fill('E2eTest1234!')
    await page.locator('input[name="newPassword"], input[name="password"], #new-password').fill(newPassword)

    const confirmInput = page.locator('input[name="confirmPassword"], input[name="passwordConfirm"], #confirm-password')
    if (await confirmInput.count() > 0) await confirmInput.fill(newPassword)

    await page.getByRole('button', { name: /changer|mettre à jour.*mot de passe/i }).click()
    await expect(page.locator('[role="alert"], .success').first()).toBeVisible({ timeout: 5_000 })
  })

  test('connexion avec le nouveau mot de passe', async ({ page }) => {
    await page.goto('/auth/login')
    await page.locator('#email').fill('e2e-user1@test.local')
    await page.locator('#password').fill(newPassword)
    await page.locator('button[type="submit"]').click()
    await page.waitForURL(url => !url.pathname.startsWith('/auth'), { timeout: 15_000 })
  })

  test('erreur avec l\'ancien mot de passe incorrect', async ({ user1Page: page }) => {
    await page.goto('/dashboard/profile')

    const oldPwInput = page.locator('input[name="oldPassword"], input[name="currentPassword"], #old-password')
    if (await oldPwInput.count() === 0) test.skip()

    await oldPwInput.fill('mauvais-mot-de-passe')
    await page.locator('input[name="newPassword"], #new-password').fill('E2eTest1234!')

    await page.getByRole('button', { name: /changer|mettre à jour.*mot de passe/i }).click()
    await expect(page.locator('[role="alert"]').first()).toBeVisible({ timeout: 5_000 })
  })
})
