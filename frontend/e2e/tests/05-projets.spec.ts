import { test, expect } from '../fixtures/auth'
import { saveState, loadState } from '../fixtures/test-data'
import path from 'path'

// Module 4 — Projets
// Cahier de recettes §4.1, §4.2, §4.3

test.describe('4.1 — Soumettre un projet', () => {
  test('user1 soumet un projet pour sa guilde inscrite', async ({ user1Page: page }) => {
    await page.goto('/dashboard/team')

    // Chercher le bouton "Soumettre un projet" lié à la jam en cours
    const submitBtn = page.getByRole('button', { name: /soumettre un projet/i })
      .or(page.getByRole('link', { name: /soumettre un projet/i }))

    if (await submitBtn.count() === 0) test.skip()
    await submitBtn.first().click()

    // Remplir le formulaire de soumission
    await page.locator('input[name="title"], #project-title').fill('[E2E] Projet Test')
    await page.locator('textarea[name="description"], #project-description').fill(
      'Projet de test E2E pour le cahier de recettes.'
    )

    // Technologies (peut être un champ texte ou des tags)
    const techInput = page.locator('input[name="technologies"], #technologies, input[placeholder*="techno"]')
    if (await techInput.count() > 0) {
      await techInput.fill('TypeScript, Next.js')
    }

    // URL optionnelle
    const urlInput = page.locator('input[name="repo_url"], input[name="download_url"], #repo-url')
    if (await urlInput.count() > 0) {
      await urlInput.fill('https://github.com/example/e2e-test')
    }

    // Image de couverture (optionnelle en test)
    const coverInput = page.locator('input[type="file"]')
    if (await coverInput.count() > 0) {
      // Crée un fichier PNG minimal pour le test
      const testImagePath = path.resolve(process.cwd(), 'e2e/.auth/test-cover.png')
      const { writeFileSync } = await import('fs')
      // PNG 1x1 pixel transparent (89 bytes)
      const pngBytes = Buffer.from(
        '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489' +
        '0000000a49444154789c6260000000020001e221bc330000000049454e44ae426082',
        'hex'
      )
      writeFileSync(testImagePath, pngBytes)
      await coverInput.setInputFiles(testImagePath)
    }

    await page.getByRole('button', { name: /soumettre|valider|publier/i }).last().click()

    // Le projet doit être créé et visible
    await expect(page.locator('body')).toContainText('[E2E] Projet Test', { timeout: 15_000 })

    // Extraire l'ID du projet pour les tests suivants
    const projectLink = page.locator('a[href*="/project/"]').first()
    if (await projectLink.count() > 0) {
      const href = await projectLink.getAttribute('href') ?? ''
      const match = href.match(/\/project\/([^/]+)/)
      if (match) saveState({ projectId: match[1] })
    }
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

    const commentInput = page.locator('textarea[name="comment"], textarea[placeholder*="commentaire"], #comment-input')
    if (await commentInput.count() === 0) test.skip()

    await commentInput.fill('Commentaire E2E — test automatisé.')
    await page.getByRole('button', { name: /commenter|envoyer|publier/i }).last().click()

    await expect(page.locator('body')).toContainText('Commentaire E2E', { timeout: 10_000 })
  })

  test('commenter sans être connecté redirige vers login', async ({ page }) => {
    const { projectId } = loadState()
    if (!projectId) test.skip()

    await page.goto(`/project/${projectId}`)
    const commentInput = page.locator('textarea[name="comment"], #comment-input')
    if (await commentInput.count() > 0) {
      await commentInput.fill('Test sans login')
      await page.getByRole('button', { name: /commenter|envoyer/i }).last().click()
      await expect(page).toHaveURL(/\/auth\/login/, { timeout: 5_000 })
    }
  })
})
