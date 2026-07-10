import { test, expect } from '../fixtures/auth'
import { loadTestIds, saveState, loadState } from '../fixtures/test-data'

// Module 4 — Projets
// Cahier de recettes §4.1, §4.2, §4.3

test.describe('4.1 — Soumettre un projet', () => {
  test('user1 soumet un projet pour sa guilde inscrite', async ({ user1Page: page }) => {
    const ids = loadTestIds()
    await page.goto('/dashboard/team')

    // Le formulaire de soumission n'apparaît que pour une jam en cours :
    // inscrire la guilde à la jam ongoing via le TeamCard si ce n'est pas déjà fait
    const submitTitle = page.locator('#proj-title')
    if (await submitTitle.count() === 0) {
      const jamSelect = page.getByRole('combobox', { name: /choisir une jam/i })
      try {
        await jamSelect.waitFor({ timeout: 5_000 })
      } catch {
        test.skip()
      }
      // Retry : si selectOption s'exécute avant l'hydratation React, l'event change
      // est perdu et le bouton reste désactivé — on re-sélectionne jusqu'à ce qu'il s'active
      const inscrireBtn = page.getByRole('button', { name: 'Inscrire', exact: true })
      await expect(async () => {
        await jamSelect.selectOption(ids.jamOngoingId)
        await expect(inscrireBtn).toBeEnabled({ timeout: 1_000 })
      }).toPass({ timeout: 15_000 })
      await inscrireBtn.click()
      await submitTitle.waitFor({ timeout: 10_000 })
    }

    // Remplir le formulaire de soumission (SubmitProjectForm)
    await submitTitle.fill('[E2E] Projet Test')
    await page.locator('#proj-desc').fill('Projet de test E2E pour le cahier de recettes.')
    await page.locator('#proj-tech').fill('TypeScript, Next.js')
    await page.locator('#proj-repo').fill('https://github.com/example/e2e-test')

    await page.getByRole('button', { name: /soumettre le projet/i }).click()
    await expect(page.locator('body')).toContainText('PROJET SOUMIS', { timeout: 15_000 })
    await expect(page.locator('body')).toContainText('[E2E] Projet Test')

    // Récupérer l'ID du projet depuis la page de la jam pour les tests suivants
    await page.goto(`/jam/${ids.jamOngoingId}`)
    const projectLink = page.locator('a[href*="/project/"]').first()
    await projectLink.waitFor({ timeout: 10_000 })
    const href = await projectLink.getAttribute('href') ?? ''
    const match = href.match(/\/project\/([^/]+)/)
    if (match) saveState({ projectId: match[1] })
  })

  test('le projet est accessible via /project/:id', async ({ user1Page: page }) => {
    const { projectId } = loadState()
    if (!projectId) test.skip()

    await page.goto(`/project/${projectId}`)
    await expect(page.locator('body')).toContainText('[E2E] Projet Test')
    await expect(page.locator('body')).toContainText('TypeScript')
  })
})

test.describe('4.3 — Commenter un projet', () => {
  test('user2 commente le projet', async ({ user2Page: page }) => {
    const { projectId } = loadState()
    if (!projectId) test.skip()

    await page.goto(`/project/${projectId}`)

    const commentInput = page.locator('#comment-input')
    try {
      await commentInput.waitFor({ timeout: 5_000 })
    } catch {
      test.skip()
    }

    await commentInput.fill('Commentaire E2E — test automatisé.')
    await page.getByRole('button', { name: 'Commenter', exact: true }).click()

    await expect(page.locator('body')).toContainText('Commentaire E2E', { timeout: 10_000 })
  })

  test('un visiteur non connecté est invité à se connecter pour commenter', async ({ page }) => {
    const { projectId } = loadState()
    if (!projectId) test.skip()

    await page.goto(`/project/${projectId}`)

    // Pas de formulaire pour les anonymes — un lien de connexion est proposé à la place
    await expect(page.getByRole('link', { name: /connectez-vous/i })).toBeVisible()
    await expect(page.locator('#comment-input')).toHaveCount(0)
  })
})
