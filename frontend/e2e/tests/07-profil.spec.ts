import { test, expect } from '../fixtures/auth'
import path from 'path'
import { writeFileSync } from 'fs'
import { loadState, loadTestIds } from '../fixtures/test-data'

// Module 6 — Profil utilisateur
// Cahier de recettes §6.1, §6.2

test.describe('6.1 — Modifier le profil', () => {
  test('formulaire pré-rempli avec les infos actuelles', async ({ user1Page: page }) => {
    await page.goto('/dashboard/profile')
    await expect(page.locator('#profile-name')).toHaveValue(/E2E Joueur1/i)
  })

  test('modifier le nom d\'affichage', async ({ user1Page: page }) => {
    await page.goto('/dashboard/profile')

    const nameInput = page.locator('#profile-name')
    await nameInput.clear()
    await nameInput.fill('E2E Joueur1 Modifié')

    await page.getByRole('button', { name: /enregistrer|sauvegarder/i }).first().click()

    await expect(page.locator('[role="alert"], .success, [data-success]').first()).toBeVisible({ timeout: 5_000 })
  })

  test('modifier la bio', async ({ user1Page: page }) => {
    await page.goto('/dashboard/profile')

    const bioInput = page.locator('#profile-bio')
    if (await bioInput.count() === 0) test.skip()

    await bioInput.clear()
    await bioInput.fill('Bio E2E — test automatisé.')
    await page.getByRole('button', { name: /enregistrer|sauvegarder/i }).first().click()

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

    await page.getByRole('button', { name: /enregistrer|sauvegarder/i }).first().click()
    await expect(page.locator('[role="alert"], .success').first()).toBeVisible({ timeout: 10_000 })
  })

  test('profil public accessible depuis l\'auteur d\'un commentaire', async ({ user2Page: page }) => {
    // Le commentaire posté par user2 dans 05-projets.spec.ts (§4.3) doit exister avant ce test
    const { projectId } = loadState()
    if (!projectId) test.skip()

    await page.goto(`/project/${projectId}`)

    // Aucun `if` : le lien DOIT exister, sinon le test échoue (c'est la garantie recherchée)
    const profileLink = page.locator('a[href*="/profile/"]').first()
    await expect(profileLink).toBeVisible()

    await profileLink.click()
    await expect(page.getByRole('heading', { level: 1 })).toContainText('E2E Joueur2')
  })

  test('profil public accessible depuis un membre d\'équipe', async ({ user1Page: page }) => {
    // user2 a rejoint la guilde de user1 dans 04-guildes.spec.ts ; la liste des
    // membres vit désormais sur le hub d'équipe (/team/:id), plus sur /dashboard/team
    const { guildeId } = loadState()
    if (!guildeId) test.skip()

    await page.goto(`/team/${guildeId}`)

    const memberLink = page.locator('a[href*="/profile/"]').first()
    await expect(memberLink).toBeVisible()

    await memberLink.click()
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/E2E Joueur/)
  })

  test('le profil public affiche les jams organisées et les projets postés', async ({ page }) => {
    // Page publique : pas de session nécessaire
    const { jamUser1Id } = loadTestIds()

    await page.goto('/profile/e2e-user1')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('E2E Joueur1')

    // Jam organisée par user1 (créée dans global-setup, toujours présente)
    await expect(page.locator('body')).toContainText('[E2E] Jam User1')

    // Vérifie aussi que le lien vers cette jam pointe bien vers son ID réel
    await expect(page.locator(`a[href="/jam/${jamUser1Id}"]`)).toBeVisible()
  })

  test('le profil public d\'un utilisateur inconnu renvoie une 404', async ({ page }) => {
    const response = await page.goto('/profile/inconnu-e2e-xyz')
    expect(response?.status()).toBe(404)
  })

  test('le profil propose le téléchargement des données personnelles (RGPD)', async ({ user1Page: page }) => {
    await page.goto('/dashboard/profile')
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Télécharger mes données (JSON)' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^konfiturgame-donnees-.*\.json$/)
  })
})

test.describe('6.2 — Changer de mot de passe', () => {
  const newPassword = 'E2eTest9876!'

  test('changement avec les bonnes infos', async ({ user1Page: page }) => {
    await page.goto('/dashboard/profile')

    // IDs réels du formulaire : #pwd-current, #pwd-new, #pwd-confirm
    const oldPwInput = page.locator('#pwd-current')
    if (await oldPwInput.count() === 0) test.skip()

    await oldPwInput.fill('E2eTest1234!')
    await page.locator('#pwd-new').fill(newPassword)
    await page.locator('#pwd-confirm').fill(newPassword)

    await page.getByRole('button', { name: /changer le mot de passe/i }).click()
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

    const oldPwInput = page.locator('#pwd-current')
    if (await oldPwInput.count() === 0) test.skip()

    await oldPwInput.fill('mauvais-mot-de-passe')
    await page.locator('#pwd-new').fill('E2eTest1234!')
    await page.locator('#pwd-confirm').fill('E2eTest1234!')

    await page.getByRole('button', { name: /changer le mot de passe/i }).click()
    await expect(page.locator('[role="alert"]').first()).toBeVisible({ timeout: 5_000 })
  })
})

test.describe('6.9 — Dashboard vue d\'ensemble enrichi', () => {
  test('affiche compteurs, feed, équipes, projets et bouton rafraîchir', async ({ user1Page: page }) => {
    await page.goto('/dashboard')

    for (const label of ['Participations', 'Projets soumis', 'Jams organisées', 'Likes reçus']) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible()
    }

    await expect(page.getByText('À venir', { exact: true })).toBeVisible()
    await expect(page.getByText('Activité récente')).toBeVisible()
    // getByText seul est ambigu depuis le rename de la nav ("Mon équipe" → "Mes équipes")
    // qui duplique désormais le titre du widget TeamsWidget sur cette même page
    await expect(page.getByRole('heading', { name: 'Mes équipes' })).toBeVisible()
    await expect(page.getByText('Mes projets')).toBeVisible()

    // Refresh : la page reste rendue après clic
    await page.getByRole('button', { name: 'Rafraîchir les données' }).click()
    await expect(page.getByRole('heading', { name: 'Vue d\'ensemble' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Mes équipes' })).toBeVisible()
  })
})
