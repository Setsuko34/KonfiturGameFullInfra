# Documentation — Tests End-to-End Playwright

## Vue d'ensemble

Suite de tests E2E couvrant les parcours utilisateur critiques de KonfiturGame.
Technologie : **Playwright** avec **Chromium headless** en mode séquentiel (`workers: 1`).

---

## Commandes

```bash
# Lancer tous les tests (depuis frontend/)
pnpm e2e

# Mode UI interactif
pnpm exec playwright test --ui

# Un seul fichier
pnpm exec playwright test e2e/tests/02-auth.spec.ts

# Un test précis (par nom)
pnpm exec playwright test --grep "user1 crée une équipe"

# Voir le rapport HTML du dernier run
pnpm exec playwright show-report
```

---

## Prérequis

- Docker Compose lancé (`docker compose up`) — frontend sur :3000, Appwrite sur :8080
- Variables `.env` renseignées : `NEXT_PUBLIC_APPWRITE_PROJECT_ID`, `APPWRITE_API_KEY`, `NEXT_PUBLIC_APPWRITE_ENDPOINT`
- Dépendances système Playwright (Chromium) installées :
  ```bash
  sudo pnpm exec playwright install-deps chromium
  ```

---

## Structure

```
frontend/
├── playwright.config.ts          # Config globale : baseURL, timeout, reporters
└── e2e/
    ├── global-setup.ts           # Exécuté UNE FOIS avant tous les tests
    ├── global-teardown.ts        # Exécuté UNE FOIS après tous les tests
    ├── diag.ts                   # Script de diagnostic manuel (ts-node)
    ├── fixtures/
    │   ├── auth.ts               # Fixtures de contexte authentifié (user1Page, adminPage…)
    │   └── test-data.ts          # Constantes TEST_USERS, loadTestIds(), saveState()…
    └── tests/
        ├── 01-smoke.spec.ts      # Infrastructure de base
        ├── 02-auth.spec.ts       # Inscription / connexion
        ├── 03-navigation.spec.ts # Pages publiques
        ├── 04-guildes.spec.ts    # Équipes
        ├── 05-projets.spec.ts    # Soumission + commentaires
        ├── 06-chat.spec.ts       # Chat temps réel
        ├── 07-profil.spec.ts     # Dashboard profil
        ├── 08-organisateur.spec.ts # Créer et gérer une jam
        └── 09-admin.spec.ts      # Panel d'administration
```

---

## Cycle de vie d'un run

```
global-setup.ts
  │  1. Supprime les résidus du run précédent (users E2E + .test-ids.json)
  │  2. Purge les données de démo (tout document dont l'ID commence par "demo-",
  │     8 collections, même logique que scripts/clean-big-demo.sh)
  │  3. Crée 3 utilisateurs via API (e2e-user1, e2e-user2, e2e-admin)
  │  4. Ajoute e2e-admin à la team admin (ADMIN_TEAM_ID)
  │  5. Crée 3 jams de référence dans game_jams
  │     └─ Jam "En Cours" : featured=true pour apparaître sur la home page
  │  6. Sauvegarde les IDs dans e2e/.test-ids.json
  │  7. Sauvegarde les sessions Playwright dans e2e/.auth/*.json
  ▼
Tests (séquentiels, workers: 1)
  │  Chaque test a son propre BrowserContext isolé
  │  État partagé entre tests : e2e/.test-state.json (invite code, project ID)
  ▼
global-teardown.ts
     1. Supprime toutes les données E2E dans Appwrite (jams, teams, projets, chat…)
     2. Supprime les utilisateurs de test
     3. Supprime e2e/.test-ids.json et e2e/.test-state.json
```

### Données de démo vs tests E2E

Les données de `scripts/seed-big-demo.sh` (IDs préfixés `demo-`) faussent les tests :
leur volume évince les jams `[E2E]` des sections plafonnées de la homepage (top 6
« Jams à venir », hero featured), ce qui faisait échouer `03-navigation` §2.1 de façon
déterministe. Le `global-setup` les **purge donc automatiquement avant chaque run**
(constat mesuré : 791 documents supprimés au premier passage). Pour les récupérer
après une session de tests : `./scripts/seed-big-demo.sh`. La `KOKORI JAM` de
`seed-data.sh` (ID non préfixé) n'est pas concernée et peut rester en héros de la
homepage sans faire échouer l'assertion.

### Fichiers persistants entre tests (dans e2e/)

| Fichier | Créé par | Contenu |
|---------|----------|---------|
| `.auth/user1.json` | global-setup | Session Playwright de e2e-user1 |
| `.auth/user2.json` | global-setup | Session Playwright de e2e-user2 |
| `.auth/admin.json` | global-setup | Session Playwright de e2e-admin |
| `.test-ids.json` | global-setup | IDs des 3 jams créées |
| `.test-state.json` | tests (saveState) | Code d'invitation guilde, ID de projet |

---

## Utilisateurs de test

Définis dans `fixtures/test-data.ts` :

| ID Appwrite | Email | Mot de passe | Rôle |
|-------------|-------|-------------|------|
| `e2e-user1` | e2e-user1@test.local | E2eTest1234! | Joueur / créateur jam |
| `e2e-user2` | e2e-user2@test.local | E2eTest1234! | Joueur secondaire |
| `e2e-admin` | e2e-admin@test.local | E2eTest1234! | Admin (ajouté à la team admin) |
| `e2e-reg-test` | e2e-reg-test@test.local | E2eTest1234! | Créé via le formulaire UI dans les tests |

> **Note :** `e2e-reg-test` est créé par le test UI (`account.create('unique()', ...)`), donc son ID Appwrite est un UUID aléatoire. Le cleanup dans global-setup tente de le supprimer par l'ID fixe `e2e-reg-test` — s'il a été créé via le formulaire, il persiste. Cela est intentionnel pour que le test "email déjà utilisé" fonctionne en chaîne.

---

## Fixtures d'authentification (`fixtures/auth.ts`)

Étend `@playwright/test` avec des fixtures qui créent un `BrowserContext` authentifié :

```ts
import { test, expect } from '../fixtures/auth'

test('exemple', async ({ user1Page: page }) => {
  // `page` est automatiquement connecté en tant que e2e-user1
})
```

| Fixture | Session utilisée | Usage |
|---------|-----------------|-------|
| `user1Page` | e2e-user1 | Tests participant / créateur |
| `user2Page` | e2e-user2 | Tests multi-utilisateur |
| `adminPage` | e2e-admin | Tests panel admin |
| `user1Context` | e2e-user1 | Tests multi-onglets (chat realtime) |
| `user2Context` | e2e-user2 | Tests multi-onglets (chat realtime) |

Pour un test **anonyme** (sans session) :
```ts
import { test, expect } from '@playwright/test'
test.use({ storageState: { cookies: [], origins: [] } })
```

---

## Modules de test

### 01 — Smoke test
Vérifie que l'infrastructure répond avant tout.
- Frontend renvoie HTTP 200
- Titre de page correct, `lang="fr"` présent
- Appwrite répond sur `/v1/health/version` (endpoint public — `/v1/health` requiert `health.read`)
- Page 404 pour route inconnue

### 02 — Authentification
**Contexte :** anonyme (`storageState: { cookies: [], origins: [] }`)

| # | Test | Dépendance |
|---|------|------------|
| 1.1 | Inscription avec données valides | — |
| 1.1 | Page de connexion accessible sans session | — |
| 1.1 | Erreur email déjà utilisé | Test inscription précédent |
| 1.1 | Email malformé (HTML5 validation) | — |
| 1.1 | Mot de passe trop court (validation client) | — |
| 1.2 | Connexion avec identifiants corrects | — |
| 1.2 | /dashboard redirige vers login si non connecté | — |
| 1.2 | Erreur avec mauvais mot de passe | — |

### 03 — Navigation publique
**Contexte :** anonyme

- Home page contient les jams E2E (nécessite `featured: true` sur la jam "En Cours")
- Timer de compte à rebours présent si jam en cours
- Navigation vers `/jam/:id` fonctionne
- `/explore` liste les jams
- Page de détail jam : titre, thème, OG tags, 404 pour ID inexistant

### 04 — Guildes / Équipes
**Contexte :** user1, user2

- user1 crée une équipe (bouton "Créer une équipe") → code `KG-XXXXXXXX` visible
- Code KG sauvegardé dans `.test-state.json` pour les tests suivants
- user2 rejoint via le code
- Erreur avec code invalide
- user1 inscrit sa guilde à la jam en cours
- Erreur double inscription

### 05 — Projets
**Contexte :** user1, user2

- user1 soumet un projet pour sa guilde inscrite
- Projet accessible via `/project/:id`
- user2 commente le projet
- Commenter sans être connecté → redirect login

> **Note :** Les tests de l'ancien système de vote ont été supprimés lors du passage au modèle **likes togglables** (collection `likes`, bouton « J'aime »). Les specs likes et podium organisateur restent à écrire — voir `TODO.md → À faire — Tests`.

### 06 — Chat temps réel
**Contexte :** user1, user2

- Envoi d'un message dans le canal Général
- Changement de canal (Aide / Help)
- Test realtime : user2 voit le message de user1 sans rechargement (WebSocket Appwrite)

### 07 — Profil utilisateur
**Contexte :** user1 (+ page anonyme pour test de connexion)

- Formulaire pré-rempli avec les infos actuelles (`#profile-name`)
- Modifier le nom d'affichage → bouton "Enregistrer"
- Modifier la bio (`#profile-bio`)
- Upload avatar
- Changer le mot de passe (`#pwd-current`, `#pwd-new`, `#pwd-confirm`)
- Connexion avec le nouveau mot de passe (test en page anonyme)
- Erreur avec l'ancien mot de passe incorrect

### 08 — Organisateur
**Contexte :** user1

Formulaire de création jam — IDs réels des champs :

| Champ | ID HTML |
|-------|---------|
| Titre | `#title` |
| Thème | `#theme` |
| Description | `#description` |
| Date de début | `#startDate` |
| Date de fin | `#endDate` |

- Création jam → apparaît dans "Mes jams"
- Jam visible sur `/explore`
- Publication d'une annonce importante

### 09 — Administration
**Contexte :** user1 (non-admin) + adminPage (e2e-admin)

- Non-admin sur `/admin` → 404
- Admin accède au dashboard (`aside` visible dans le layout)
- `/admin/logs` se charge
- Bannir / débannir une IP
- API `/api/banned-ips` retourne **401** (endpoint interne protégé par `x-log-secret`)
- **8.4 — Superpouvoirs admin (chantier E)** : édition d'une jam d'autrui depuis `/admin/jams/[id]` + vérification du log `admin_action` ; lien « Gérer » de `/admin/jams`
- **8.5 — Corrections dashboard (chantier F)** :
  - Le filtre des logs **discrimine** réellement les types (asserte la présence du type filtré ET l'absence des autres — leçon chantier E : ne jamais tester qu'un filtre par la seule présence)
  - « Gagnants » (`/admin/featured?jam=…`) affiche la section podium de la jam sélectionnée
  - `/admin/teams` : navigation via la sidebar, rename d'une équipe + vérification de l'audit (`Renommage de l'équipe`) — `test.skip()` conditionnel si la guilde `[E2E] Guilde Test` est absente (run ciblé de 09 sans 04)

> Baseline suite complète : **65 passed + 1 skipped** (juillet 2026).

---

## Points d'attention et pièges connus

### Team admin e2e-admin
`global-setup.ts` ajoute e2e-admin à la team `ADMIN_TEAM_ID = '69bc67f1003d025c931a'` via `teams.createMembership()`. Si cette team **n'existe pas** dans l'instance Appwrite locale, l'appel échoue silencieusement (warning affiché dans les logs de setup). Le test `09-admin.spec.ts:14` échouera alors.
→ **Fix :** Vérifier que la team admin existe dans la console Appwrite (Settings → Teams).

### `e2e-reg-test` et cleanup
Le user créé via le formulaire UI a un UUID aléatoire. `global-setup` tente de supprimer l'ID fixe `e2e-reg-test` — échoue silencieusement si le user a été créé via UI. Cela n'est pas un bug : le test "email déjà utilisé" dépend du fait que l'email persiste entre tests dans le même run.

### Home page et `featured`
La home page ne montre que les jams avec `featured: true`. La jam "En Cours" créée en setup a `featured: true, featured_order: 0`. Les tests 03-navigation qui vérifient la home page en dépendent.

### API `/api/banned-ips`
Endpoint interne consommé par `proxy.ts`. Requiert le header `x-log-secret` (valeur dans `.env`). Sans ce header → 401. Ne pas tester cet endpoint avec un accès public.

### Appwrite health endpoint
`/v1/health` requiert le scope `health.read` (API key) → 401 depuis un client non authentifié.
Utiliser `/v1/health/version` pour un ping public.

### Playwright et React 19
`fill()` sur un champ déclenche `onChange` mais pas toujours `onFocus`. Pour des champs avec logique `onFocus` (ex : `passwordTouched`), appeler `.click()` avant `.fill()`.

---

## Diagnostic manuel

Pour tester la connectivité Appwrite sans lancer la suite complète :

```bash
# Depuis frontend/ (nécessite ts-node ou tsx)
npx tsx e2e/diag.ts
```

Teste `users.list()`, `users.create()` et `databases.listDocuments()` avec les vars du `.env`.

---

*KonfiturGame · Tests E2E Playwright · Mis à jour : 2026-07-14*
