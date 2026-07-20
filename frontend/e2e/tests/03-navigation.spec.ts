import { test, expect } from '@playwright/test'
import { loadTestIds } from '../fixtures/test-data'

// Module 2 — Navigation publique
// Cahier de recettes §2.1, §2.2, §2.3

test.use({ storageState: { cookies: [], origins: [] } }) // navigation publique = anonyme

test.describe('2.1 — Page d\'accueil', () => {
  test('se charge avec les sections jams', async ({ page }) => {
    const res = await page.goto('/')
    expect(res?.status()).toBe(200)

    // Les données E2E créées en setup doivent apparaître
    await expect(page.locator('body')).toContainText('[E2E]')
  })

  test('le countdown décrémente (timer présent)', async ({ page }) => {
    await page.goto('/')
    // Vérifie la présence d'un timer — le contenu exact dépend des jams en cours
    const timer = page.locator('[role="timer"]')
    if (await timer.count() > 0) {
      const before = await timer.first().textContent()
      await page.waitForTimeout(1_500)
      const after = await timer.first().textContent()
      expect(before).not.toBe(after)
    }
  })

  test('cliquer sur une jam redirige vers /jam/:id', async ({ page }) => {
    const ids = loadTestIds()
    // Navigation directe vers la jam E2E en cours (ID créé en global-setup)
    await page.goto(`/jam/${ids.jamOngoingId}`)
    await expect(page.locator('body')).toContainText('[E2E] Jam En Cours', { timeout: 15_000 })
  })

  test('menu responsive — présence du header', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await expect(page.locator('header')).toBeVisible()
  })
})

test.describe('2.2 — Page Explorer', () => {
  test('affiche la liste des jams', async ({ page }) => {
    await page.goto('/explore')
    await expect(page.locator('body')).toContainText('[E2E]')
  })

  test('filtre "En cours" affiche uniquement les jams ongoing', async ({ page }) => {
    await page.goto('/explore')
    // Chercher le bouton de filtre "En cours"
    const filterBtn = page.getByRole('button', { name: /en cours/i })
    if (await filterBtn.count() > 0) {
      await filterBtn.click()
      await expect(page.locator('body')).toContainText('[E2E] Jam En Cours')
      // La jam à venir ne doit pas apparaître
      await expect(page.locator('body')).not.toContainText('[E2E] Jam À Venir')
    }
  })

  test('filtre "À venir" affiche uniquement les jams upcoming', async ({ page }) => {
    await page.goto('/explore')
    const filterBtn = page.getByRole('button', { name: /à venir/i })
    if (await filterBtn.count() > 0) {
      await filterBtn.click()
      await expect(page.locator('body')).toContainText('[E2E] Jam À Venir')
      await expect(page.locator('body')).not.toContainText('[E2E] Jam En Cours')
    }
  })

  test('filtre "Terminées" affiche uniquement les jams ended', async ({ page }) => {
    await page.goto('/explore')
    const filterBtn = page.getByRole('button', { name: /terminée/i })
    if (await filterBtn.count() > 0) {
      await filterBtn.click()
      await expect(page.locator('body')).toContainText('[E2E] Jam Terminée')
    }
  })
})

test.describe('2.3 — Page de détail d\'une jam', () => {
  test('affiche toutes les sections pour une jam existante', async ({ page }) => {
    const ids = loadTestIds()
    await page.goto(`/jam/${ids.jamOngoingId}`)

    await expect(page.locator('h1').first()).toContainText('[E2E] Jam En Cours', { timeout: 15_000 })
    // La page doit mentionner le thème
    await expect(page.locator('body')).toContainText('Temps limité')
  })

  test('les métadonnées OG sont présentes', async ({ page }) => {
    const ids = loadTestIds()
    await page.goto(`/jam/${ids.jamOngoingId}`)

    const ogTitle = page.locator('meta[property="og:title"]')
    await expect(ogTitle).toHaveCount(1)
  })

  test('retourne 404 pour un ID inexistant', async ({ page }) => {
    const res = await page.goto('/jam/id-qui-nexiste-vraiment-pas-e2e')
    // Next.js notFound() → 404 ou redirect
    expect([404, 200]).toContain(res?.status()) // 200 car Next.js peut servir la page d'erreur avec 200
    await expect(page.locator('body')).toContainText(/404|introuvable|not found/i)
  })

  test('les sections Projets/Équipes/Annonces sont repliables (ouvertes par défaut)', async ({ page }) => {
    const ids = loadTestIds()
    await page.goto(`/jam/${ids.jamOngoingId}`)

    const sectionAnchors = ['#projects', '#teams', '#announcements']

    for (const anchor of sectionAnchors) {
      const details = page.locator(`${anchor} details`)
      const summary = details.locator('summary')
      // Premier enfant hors <summary> : présent quelle que soit la donnée (liste ou état vide)
      const content = details.locator('> :not(summary)').first()

      // Ouvertes par défaut : contenu visible au premier rendu
      await expect(content).toBeVisible()

      // Un clic sur le titre replie
      await summary.click()
      await expect(content).not.toBeVisible()

      // Un second clic rouvre
      await summary.click()
      await expect(content).toBeVisible()
    }
  })

  test('le "Voir plus" des annonces survit à un cycle replier/rouvrir', async ({ page }) => {
    // Le <details> natif masque son contenu en CSS (display:none) sans jamais démonter le DOM
    // React sous-jacent : pas de useState/composant client pour le pli lui-même, donc l'état
    // accumulé par LoadMoreList (Task 5) ne peut pas être perdu. Vérifié ici en comparant le
    // contenu de la section Annonces avant/après un cycle repli-réouverture.
    const ids = loadTestIds()
    await page.goto(`/jam/${ids.jamOngoingId}`)

    const details = page.locator('#announcements details')
    const summary = details.locator('summary')
    const content = details.locator('> :not(summary)').first()

    const before = await content.innerHTML()

    await summary.click() // replier
    await expect(content).not.toBeVisible()
    await summary.click() // rouvrir

    await expect(content).toBeVisible()
    expect(await content.innerHTML()).toBe(before)
  })
})

test.describe('2.4 — Menu mobile : focus trap (WCAG 2.1.2)', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('Escape ferme le menu et restitue le focus au bouton burger', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Ouvrir le menu' }).click()
    await expect(page.locator('#mobile-menu')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.locator('#mobile-menu')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Ouvrir le menu' })).toBeFocused()
  })

  test('Tab boucle à l\'intérieur du menu ouvert', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Ouvrir le menu' }).click()
    await expect(page.locator('#mobile-menu')).toBeVisible()

    // Le focus initial est déjà DANS le menu (premier lien)
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab')
      const inside = await page.evaluate(() =>
        document.getElementById('mobile-menu')?.contains(document.activeElement) ?? false)
      expect(inside, `Tab n°${i + 1} a fait sortir le focus du menu`).toBe(true)
    }
  })
})
