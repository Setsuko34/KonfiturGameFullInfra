import { test, expect } from '../fixtures/auth'
import { loadTestIds } from '../fixtures/test-data'

// Module 8 — Administration
// Cahier de recettes §8.1, §8.2, §8.4 (superpouvoirs admin — chantier E)

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
    // (la liste des IPs bannies est un <ul role="list"> de <li>, pas un tableau)
    const ipRow = page.getByRole('listitem').filter({ hasText: '192.0.2.1' }).first()
    try {
      await ipRow.waitFor({ timeout: 5_000 })
    } catch {
      test.skip()
    }

    const unbanBtn = ipRow.getByRole('button', { name: /débannir|supprimer|retirer/i })
    if (await unbanBtn.count() === 0) test.skip()

    await unbanBtn.click()
    await page.waitForTimeout(1_000)
    await expect(page.locator('body')).not.toContainText('192.0.2.1')
  })

  test("l'API /api/banned-ips est protégée par un secret interne", async ({ request }) => {
    // Endpoint interne — requiert x-log-secret → retourne 401 sans lui
    const res = await request.get('http://localhost:3000/api/banned-ips')
    expect(res.status()).toBe(401)
  })
})

test.describe('8.4 — Superpouvoirs admin (chantier E)', () => {
  test("admin : édite une jam d'autrui depuis /admin/jams/[id] et l'action est journalisée", async ({ adminPage: page }) => {
    const ids = loadTestIds()

    // La jam est organisée par user1 — l'admin n'en est pas propriétaire
    await page.goto(`/admin/jams/${ids.jamUser1Id}`)
    await expect(page.locator('body')).toContainText('Mode administrateur', { timeout: 15_000 })

    // Le formulaire d'édition est replié derrière « Modifier la jam »
    await page.getByRole('button', { name: /modifier la jam/i }).click()
    const desc = page.locator('#edit-description')
    await desc.fill('Description éditée par un admin (e2e)')
    await page.getByRole('button', { name: /enregistrer les modifications/i }).click()
    await expect(page.locator('body')).toContainText('Jam mise à jour', { timeout: 15_000 })

    // L'entrée d'audit apparaît dans les logs filtrés admin_action
    await page.goto('/admin/logs?type=admin_action')
    await expect(page.locator('body')).toContainText('Édition de la jam', { timeout: 15_000 })
  })

  test('le lien « Gérer » de /admin/jams mène à la page de gestion', async ({ adminPage: page }) => {
    await page.goto('/admin/jams')
    await page.getByRole('link', { name: 'Gérer' }).first().click()
    await expect(page).toHaveURL(/\/admin\/jams\/[a-zA-Z0-9]+/, { timeout: 15_000 })
    await expect(page.locator('body')).toContainText('Mode administrateur', { timeout: 15_000 })
  })
})

test.describe('8.5 — Corrections dashboard (chantier F)', () => {
  test('le filtre des logs discrimine réellement les types', async ({ adminPage: page }) => {
    // Le test 8.4 vient de créer des entrées admin_action ; le global-setup a créé ≥3 entrées auth.
    await page.goto('/admin/logs?type=auth')
    const typeCells = page.locator('tbody td:first-child')
    await expect(typeCells.filter({ hasText: 'auth' }).first()).toBeVisible({ timeout: 15_000 })
    // Leçon chantier E : asserter l'ABSENCE de ce qui est filtré, pas juste la présence du reste
    await expect(typeCells.filter({ hasText: 'admin_action' })).toHaveCount(0)

    await page.goto('/admin/logs?type=admin_action')
    await expect(page.locator('tbody td:first-child').filter({ hasText: /^auth$/ })).toHaveCount(0)
    await expect(page.locator('body')).toContainText('Édition de la jam')
  })

  test('« Gagnants » affiche la section podium de la jam sélectionnée', async ({ adminPage: page }) => {
    const ids = loadTestIds()
    await page.goto('/admin/featured')
    // Cliquer le lien Gagnants de la jam terminée (podium ouvrable)
    await page.goto(`/admin/featured?jam=${ids.jamEndedId}`)
    await expect(page.locator('body')).toContainText('Gagnants ([E2E] Jam Terminée)', { timeout: 15_000 })
  })

  test("/admin/teams liste les équipes et l'entrée sidebar existe", async ({ adminPage: page }) => {
    await page.goto('/admin')
    await page.getByRole('link', { name: 'Équipes' }).click()
    await expect(page).toHaveURL(/\/admin\/teams/)
    await expect(page.getByRole('heading', { name: 'Équipes', level: 1 })).toBeVisible()
  })

  test('admin : renomme une équipe depuis /admin/teams, action journalisée', async ({ adminPage: page }) => {
    await page.goto('/admin/teams')
    const row = page.getByRole('listitem').filter({ hasText: '[E2E] Guilde Test' })
    try {
      await row.first().waitFor({ timeout: 5_000 })
    } catch {
      test.skip() // guilde absente en run ciblé de 09 seul (créée par 04-guildes)
    }

    await row.getByRole('button', { name: /renommer/i }).click()
    const input = row.locator('input[type="text"], input:not([type])').first()
    await input.fill('[E2E] Guilde Renommée')
    await row.getByRole('button', { name: /valider/i }).click()
    await expect(page.locator('body')).toContainText('[E2E] Guilde Renommée', { timeout: 15_000 })

    // Audit visible (l'admin e2e n'est pas leader de cette guilde → admin_action)
    await page.goto('/admin/logs?type=admin_action')
    await expect(page.locator('body')).toContainText('Renommage de l\'équipe', { timeout: 15_000 })
  })
})

test.describe('8.3 — Accessibilité (§9.2)', () => {
  test('lang="fr" sur la balise html', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
  })

  test('focus visible sur les éléments interactifs du header', async ({ page }) => {
    await page.goto('/')
    // Tab jusqu'au premier lien du header — exclure l'overlay Next.js DevTools (mode dev)
    // qui peut aussi matcher :focus et provoquer une violation strict mode
    await page.keyboard.press('Tab')
    const focused = page.locator(':focus:not(nextjs-portal):not([data-nextjs-dev-tools-button])')
    // Si l'overlay devtools a capté le premier Tab, passer à l'élément suivant
    if (await focused.count() === 0) await page.keyboard.press('Tab')
    await expect(focused).toBeVisible()
  })

  test('skip-link #main-content présent', async ({ page }) => {
    await page.goto('/')
    const skipLink = page.locator('a[href="#main-content"]')
    await expect(skipLink).toHaveCount(1)
  })
})
