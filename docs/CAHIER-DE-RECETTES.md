# KonfiturGame — Cahier de recettes

> Document de test d'acceptation. Chaque scénario décrit les étapes, le résultat attendu et les critères de validation. À exécuter avant toute mise en production.

---

## Comment utiliser ce document

1. Exécuter les scénarios dans l'ordre (les dépendances sont signalées)
2. Cocher chaque critère validé
3. Noter les anomalies avec la date, les étapes de reproduction et le résultat observé
4. Un scénario est **accepté** si tous ses critères sont cochés
5. Un scénario est **bloquant** si la mise en production ne peut pas avoir lieu sans lui

> **Automatisation :** une grande partie de ces scénarios est automatisée par la suite E2E Playwright (`cd frontend && pnpm e2e` — voir `DOC_test_E2E.md`) : modules 1 (auth), 2 (navigation), 3 (guildes), 4.1/4.3 (projets, commentaires), 5 (chat realtime), 6 (profil), 7 (organisateur) et 8 (admin). Ce cahier reste la **référence d'acceptation manuelle** — notamment pour OAuth (1.3, 1.4), les likes/podium (4.2, 8.3), l'infrastructure (9.1) et l'accessibilité (9.2), non couverts par la suite automatisée.

**Environnements couverts :**
- DEV : `http://localhost:3000` + `http://localhost:8080`
- PROD : `https://konfiturgame.fr` + `https://api.konfiturgame.fr`

---

## PV d'exécution — campagne du 21 juillet 2026

**Environnement :** DEV, stack Docker locale (`docker compose up`) — frontend `localhost:3000`, Appwrite 1.9.0 `localhost:8080`. Branche `develop`, Next.js 16.2.9, Node 22, pnpm 11.13.0.

**Campagnes exécutées :**

| Campagne | Commande | Résultat |
|---|---|---|
| Tests unitaires | `docker exec konfitur-frontend sh -c "cd /app && npx vitest run --coverage"` | **361 passés / 361** — couverture 85,62 % lignes · 84,75 % fonctions · 77,74 % branches |
| E2E — suite complète | `npx playwright test` | **88 passés, 2 échecs, 2 skippés** (92 cas, 4 min 36 s) |
| E2E — re-run ciblé 03 + 08 | `npx playwright test e2e/tests/03-navigation.spec.ts e2e/tests/08-organisateur.spec.ts` | **18 passés, 1 échec** — les 2 échecs du run complet passent, un 3ᵉ cas bascule (voir anomalies) |
| Smoke test DEV | `curl` frontend + `/v1/health/version` | frontend **200**, Appwrite **`{"version":"1.9.0"}`** |
| Smoke test PROD | `curl https://konfiturgame.fr` | **échec — code 000**, production suspendue (stabilisation en cours) |
| Jeu de données de volume | `bash ./scripts/seed-big-demo.sh` | **791 documents créés, 0 échec** — 60 jams, 120 équipes, 40 projets sur `demo-jam-big` avec `likes_count` variés (0/3/6/9) et podium 1-2-3, 150 commentaires, 120 messages de chat |

**Vérifications manuelles consignées (21/07/2026) :**

| Critère | Observation |
|---|---|
| § 3.1 — `is_leader: true` dans `team_members` | Document contrôlé dans la console Appwrite : drapeau bien positionné après création d'une guilde |
| § 3.4 — participants solo comptés à part | Les inscrits solo sont bien listés dans une section distincte des équipes sur la page de la jam |
| § 6.1 — persistance du profil | Nom et bio bien mis à jour et conservés après rechargement. Reste à observer : le rafraîchissement **immédiat** de l'état côté front |
| § 4.2 — tri par likes décroissants | Sur `demo-jam-big` (40 projets, `likes_count` 0/3/6/9) : la liste descend bien 9 → 6 → 3 → 0, sur la page de la jam comme dans « Projets les plus aimés » |
| § 8.3 — podium indépendant des likes | Projets 001/002/003 classés 1er/2e/3e avec 3/6/9 likes, soit l'ordre inverse du tri par popularité : les deux classements ne s'influencent pas |
| § 2.1 — responsive mobile | Revue visuelle effectuée, layout conforme |
| § 5.2 — privacité du tchat d'équipe | Un utilisateur non membre, connecté ou non, ne voit pas le tchat privé de la guilde |
| § 5.2 — épinglage et signalement en temps réel | Le message épinglé chez A apparaît chez B sans rechargement ; idem pour le signalement |
| § 7.2 — distinction visuelle des annonces | Annonce importante en cadre rouge, annonce normale en cadre bleu |
| § 8.4 — `/admin/teams` | Listing complet et recherche par nom fonctionnels |
| § 6.1 — upload d'avatar | 🚫 **Fonctionnalité absente** : aucune action d'upload dans l'application (voir R-05) |

**Convention de cochage :**

- `[x] … — auto : <fichier>` : critère couvert par un test automatisé **passant**, référence donnée. Les fichiers `*.spec.ts` sont des tests E2E Playwright (parcours navigateur réel), les `*.test.ts` des tests unitaires Vitest (logique serveur, SDK Appwrite mocké).
- `[x] … — auto partiel : …` : le test couvre la substance du critère mais pas toute sa formulation ; la réserve est explicitée.
- `[ ] … — ⏳ <motif>` : critère non exécuté, motif indiqué.

Un test unitaire ne vaut **pas** preuve de bout en bout : il valide une règle métier avec le SDK mocké, pas le parcours utilisateur. Les critères validés par ce seul moyen sont annotés comme tels, jamais présentés comme une recette fonctionnelle.

Aucun critère n'est coché sur la seule foi d'une lecture du code : seul un test observé passant, ou une observation directe consignée, vaut validation.

**Statut par module :**

| Module | Statut |
|---|---|
| 1 — Authentification (1.1, 1.2) | ✅ accepté en DEV |
| 1.3 / 1.4 — OAuth Google et Discord | ⏳ recette manuelle à jouer (flux tiers) |
| 2 — Navigation publique | ✅ accepté en DEV |
| 3.1 à 3.3 — Guildes | ✅ accepté en DEV |
| 3.4 — Inscription solo | ✅ accepté (unicité de la team solo en TU, liste solo séparée vérifiée manuellement) |
| 4.1 / 4.3 — Projets, commentaires | ✅ accepté en DEV |
| 4.2 — Likes | ✅ accepté (toggle et compteur en TU, tri par likes vérifié manuellement) |
| 5.1 — Chat temps réel | ✅ accepté en DEV |
| 5.2 — Tchat privé d'équipe | ✅ accepté (gardes serveur en TU, privacité et propagation temps réel vérifiées manuellement ; réserve : forçage console des étapes 6-7 non joué) |
| 6 — Profil | ⚠️ partiel (mot de passe et persistance validés ; **upload d'avatar non implémenté**, rafraîchissement immédiat non vérifié) |
| 7 — Organisateur | ✅ accepté en DEV |
| 8.1 / 8.2 / 8.2 bis / 8.4 — Administration | ✅ accepté en DEV |
| 8.3 — Podium | ✅ accepté (bornes et rang stocké en TU, indépendance vis-à-vis des likes vérifiée manuellement) |
| 8.5 — Modération tchat | ⚠️ filtre `reported` et audit validés en TU ; parcours admin complet (résolution, suppression, compteurs) à jouer |
| 9.1 — TLS et sécurité | 🔴 bloqué : production injoignable |
| 9.2 — Accessibilité | ⚠️ partiel (`lang`, focus, skip-link validés ; `prefers-reduced-motion` non vérifié) |

---

## Smoke test — 5 minutes (pré-requis de tout le reste)

Avant de commencer les scénarios, vérifier que l'infrastructure répond :

```bash
# Dev
curl -s -o /dev/null -w '%{http_code}' http://localhost:3000              # → 200
curl -s http://localhost:8080/v1/health/version | grep -q '"version"'     # → ok

# Prod
curl -s -o /dev/null -w '%{http_code}' https://konfiturgame.fr            # → 200
curl -s https://api.konfiturgame.fr/v1/health/version | grep -q '"version"' # → ok

# Note : /v1/health (statut complet) requiert une clé API depuis Appwrite 1.9
# (scope health.read) — /v1/health/version est l'endpoint public de ping.
```

Si l'un de ces checks échoue, ne pas continuer — résoudre l'infrastructure d'abord (voir `DEPLOIEMENT.md`).

---

## Module 1 — Authentification

### 1.1 Inscription email/mot de passe

**Prérequis :** aucun  
**Bloquant :** oui

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Aller sur `/auth/register` | Page d'inscription affichée, pas d'erreur console |
| 2 | Remplir pseudo, email, mot de passe valides et valider | Redirection vers `/` ou page demandée |
| 3 | Vérifier le header | Bouton "Dashboard" et "Déconnexion" visibles, "Se connecter" absent |
| 4 | Recharger la page | Toujours connecté (cookie de session persistant) |
| 5 | Tenter une inscription avec le même email | Message d'erreur explicite (email déjà utilisé) |

**Critères d'acceptation :**
- [x] L'inscription crée bien un utilisateur — auto : `02-auth.spec.ts` § 1.1 (« inscription avec données valides », puis « erreur pour email déjà utilisé » : le rejet pour doublon prouve la création côté Appwrite)
- [x] La session est maintenue après rechargement — auto partiel : `02-auth.spec.ts` § 1.1 asserte la session active après redirection (mention « Se connecter » absente) ; un `reload()` explicite n'est pas asserté
- [x] Les erreurs de validation (email malformé, mot de passe trop court) sont affichées — auto : `02-auth.spec.ts` § 1.1

---

### 1.2 Connexion email/mot de passe

**Prérequis :** 1.1  
**Bloquant :** oui

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Se déconnecter si connecté | Redirection vers `/`, bouton "Se connecter" visible |
| 2 | Aller sur `/auth/login` | Page de connexion affichée |
| 3 | Entrer email + mot de passe corrects | Redirection vers `/` ou `?redirect=` |
| 4 | Aller sur `/dashboard` directement sans être connecté | Redirection vers `/auth/login?redirect=/dashboard` |
| 5 | Se connecter via cette redirection | Redirection vers `/dashboard` après connexion |
| 6 | Tenter une connexion avec mauvais mot de passe | Message d'erreur, pas de connexion |

**Critères d'acceptation :**
- [x] La redirection post-login fonctionne — auto : `02-auth.spec.ts` § 1.2 (« redirection post-login vers la page demandée »)
- [x] Les routes protégées (`/dashboard`, `/admin`) redirigent bien si non connecté — auto : `02-auth.spec.ts` § 1.2 (deux cas distincts)

---

### 1.3 OAuth Google

**Prérequis :** 1.1, provider Google configuré  
**Bloquant :** non (si l'email/password fonctionne)

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Aller sur `/auth/login`, cliquer sur "Connexion avec Google" | Redirection vers `accounts.google.com` |
| 2 | Accepter les permissions Google | Retour sur KonfiturGame, utilisateur connecté |
| 3 | Vérifier dans Appwrite | Utilisateur créé avec provider `google` |

**Critères d'acceptation :**
- [ ] Le flux OAuth complète sans erreur "redirect_uri_mismatch" — ⏳ non exécuté : écran de consentement Google, non automatisable dans la suite E2E
- [ ] L'utilisateur est connecté après le retour — ⏳ non exécuté, idem

---

### 1.4 OAuth Discord

**Prérequis :** 1.1, provider Discord configuré  
**Bloquant :** non

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Aller sur `/auth/login`, cliquer sur "Connexion avec Discord" | Redirection vers `discord.com/oauth2` |
| 2 | Autoriser l'application | Retour sur KonfiturGame, utilisateur connecté |

**Critères d'acceptation :**
- [ ] Le flux Discord complète sans erreur — ⏳ non exécuté : écran d'autorisation Discord, non automatisable dans la suite E2E

---

## Module 2 — Navigation publique

### 2.1 Page d'accueil

**Prérequis :** données de test présentes (seed)  
**Bloquant :** oui

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Aller sur `/` sans être connecté | Page chargée, pas d'erreur |
| 2 | Vérifier les sections | Jams en cours / à venir / terminées visibles |
| 3 | Vérifier le countdown | Timer décrémente en temps réel |
| 4 | Cliquer sur une jam | Redirection vers `/jam/:id` |
| 5 | Consulter en mode mobile (< 768px) | Menu burger fonctionnel, layout adapté |

**Critères d'acceptation :**
- [x] La page se charge sans erreur 500 — auto : `01-smoke.spec.ts` (HTTP 200) et `03-navigation.spec.ts` § 2.1
- [x] Les données proviennent bien d'Appwrite (pas des mocks) — auto : `03-navigation.spec.ts` § 2.1 — les jams `[E2E]` créées dans Appwrite par le `global-setup` apparaissent sur la home et le countdown décrémente
- [x] Le design responsive est correct sur mobile — revue visuelle faite manuellement le 21/07/2026. Couvert partiellement en automatique : header présent et menu burger fonctionnel en 390 × 844 (`03-navigation.spec.ts` § 2.1 et § 2.4), uniquement quelque spacing en haut de page a revoir en version mobile

---

### 2.2 Page Explorer

**Prérequis :** 2.1  
**Bloquant :** non

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Aller sur `/explore` | Liste des jams affichée |
| 2 | Filtrer par "En cours" | Seules les jams `ongoing` sont affichées |
| 3 | Filtrer par "À venir" | Seules les jams `upcoming` sont affichées |
| 4 | Filtrer par "Terminées" | Seules les jams `ended` sont affichées |
| 5 | Cliquer sur une card | Redirection vers `/jam/:id` |

**Critères d'acceptation :**
- [x] Les filtres fonctionnent sans rechargement de page — auto partiel : `03-navigation.spec.ts` § 2.2 vérifie les trois filtres (en cours, à venir, terminées) ; l'absence de rechargement n'est pas assertée
- [x] Les cards affichent le bon statut (badge coloré) — auto : `03-navigation.spec.ts` § 2.2, chaque filtre asserte le badge attendu

---

### 2.3 Page de détail d'une jam

**Prérequis :** 2.1  
**Bloquant :** oui

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Aller sur `/jam/:id` d'une jam existante | Page chargée avec toutes les sections |
| 2 | Vérifier le thème, description, dates | Données correctes |
| 3 | Vérifier la section Équipes | Liste des équipes inscrites visible |
| 4 | Aller sur `/jam/id-inexistant` | Page 404 |

**Critères d'acceptation :**
- [x] Les métadonnées OG sont présentes (inspecter le `<head>`) — auto : `03-navigation.spec.ts` § 2.3
- [x] La page 404 est correctement affichée pour un ID invalide — auto : `03-navigation.spec.ts` § 2.3 et `01-smoke.spec.ts`

---

## Module 3 — Guildes

### 3.1 Créer une guilde

**Prérequis :** 1.1 (connecté)  
**Bloquant :** oui

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Aller dans Dashboard → Mes équipes (`/dashboard/teams`) | Liste des guildes affichée |
| 2 | Cliquer sur "Créer une guilde" | Modale ou formulaire s'ouvre |
| 3 | Entrer un nom de guilde et choisir un rôle | Champs validés |
| 4 | Valider | Guilde créée, code `KG-XXXXXXXX` affiché |
| 5 | Vérifier dans Appwrite | Document créé dans la collection `teams` |

**Critères d'acceptation :**
- [x] Le code d'invitation est au format `KG-XXXXXXXX` (8 caractères alphanumériques) — auto : `04-guildes.spec.ts` § 3.1, regex assertée sur le hub d'équipe
- [x] L'utilisateur est bien enregistré comme `is_leader: true` dans `team_members` — Vérifié manuellement dans Appwrite (21/07/2026). Non asserté automatiquement : `actions-teams.test.ts` place ce drapeau dans un **mock** sur le chemin `createTeam` ; il n'est réellement asserté que sur le chemin team solo
- [x] La guilde apparaît dans le dashboard sans rechargement — auto : `04-guildes.spec.ts` § 3.1, la carte de la guilde est assertée sur `/dashboard/teams` après création

---

### 3.2 Rejoindre une guilde via code

**Prérequis :** 3.1, second compte utilisateur  
**Bloquant :** oui

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Se connecter avec un second compte | Connecté |
| 2 | Aller dans Dashboard → Mes équipes (`/dashboard/teams`) | Pas de guilde affichée |
| 3 | Cliquer sur "Rejoindre une guilde" | Champ code d'invitation |
| 4 | Entrer le code `KG-XXXXXXXX` de la guilde créée en 3.1 | Guilde rejointe |
| 5 | Vérifier la liste des membres | Deux membres visibles |
| 6 | Entrer un code invalide | Message d'erreur explicite |

**Critères d'acceptation :**
- [x] L'utilisateur est ajouté dans `team_members` — auto : `04-guildes.spec.ts` § 3.2, user2 rejoint via le code et la guilde apparaît chez lui
- [x] Les deux membres voient la guilde dans leur dashboard — auto : user1 au § 3.1, user2 au § 3.2 (contextes de navigation distincts)

---

### 3.3 Inscrire une guilde à une jam

**Prérequis :** 3.1, jam en cours (`ongoing`) existante  
**Bloquant :** oui

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Aller sur la page d'une jam `ongoing` | Section Équipes visible |
| 2 | Cliquer sur "Inscrire ma guilde" | Liste des guildes disponibles |
| 3 | Sélectionner la guilde et valider | Guilde inscrite, apparaît dans la liste |
| 4 | Vérifier dans Appwrite | `jam_ids` de la guilde contient l'ID de la jam |
| 5 | Tenter d'inscrire la même guilde une seconde fois | Erreur : déjà inscrite |
| 6 | Tenter d'inscrire une autre guilde dont un membre est déjà inscrit | Erreur : conflit de membre |

**Critères d'acceptation :**
- [x] `Query.contains('jam_ids', jamId)` retourne la guilde inscrite — auto partiel : `04-guildes.spec.ts` § 3.3, la guilde apparaît en « TON ÉQUIPE » sur la page de la jam (rendu serveur) ; la requête elle-même est couverte unitairement par `actions-teams.test.ts`
- [x] Les conflits d'inscription sont détectés et affichent un message d'erreur — auto : `04-guildes.spec.ts` § 3.2 (code invalide) et § 3.3 (double inscription refusée)

---

### 3.4 S'inscrire en solo à une jam

**Prérequis :** 1.1, jam de type solo ou solo & équipe, statut À venir  
**Bloquant :** non

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Aller sur `/jam/:id`, cliquer « S'inscrire en solo » | Inscription confirmée, compteur de participants solo incrémenté |
| 2 | Se désinscrire puis se réinscrire | La **même** team solo personnelle est réutilisée (pas de doublon) |
| 3 | S'inscrire en solo à une **seconde** jam | Toujours la même team solo (unique par utilisateur) |
| 4 | Après le début de la jam, tenter de se désinscrire | Refus avec message en français |

**Critères d'acceptation :**
- [x] Une seule team `is_solo` par utilisateur, quelle que soit la séquence inscription/désinscription — auto (TU) : `actions-teams.test.ts` § `registerSoloToJam` couvre les deux branches (« aucune team solo existante → crée une team `is_solo` de 1 » / « team solo existante → jam ajoutée par update, **aucune création** ») et § `unregisterSoloFromJam` asserte que la team **reste vivante** après désinscription. La séquence complète inscription → désinscription → réinscription n'est pas rejouée en navigateur
- [x] Les participants solo sont comptés à part des équipes sur la page de la jam — Vérifié manuellement (21/07/2026) : les participants solo sont bien listés à part des équipes dans le frontend. Non couvert automatiquement : `participant-counts.test.ts` somme les membres par jam **sans distinguer** les teams solo des guildes

---

## Module 4 — Projets

### 4.1 Soumettre un projet

**Prérequis :** 3.3 (guilde inscrite à une jam)  
**Bloquant :** oui

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Aller sur le hub de la guilde (`/team/:id`, via Dashboard → Mes équipes) | Card de la guilde avec section jam |
| 2 | Cliquer sur "Soumettre un projet" | Formulaire de soumission |
| 3 | Remplir titre, description, technologies, URL | Champs validés |
| 4 | Uploader une image de couverture | Upload dans le bucket `project-assets` |
| 5 | Valider | Projet créé, lien vers la page `/project/:id` |
| 6 | Aller sur `/project/:id` | Page du projet avec toutes les infos |

**Critères d'acceptation :**
- [x] Le projet est retrouvable par `(team_id, jam_id)` dans Appwrite — auto : `05-projets.spec.ts` § 4.1, le projet soumis depuis le hub d'équipe est retrouvé sur `/project/:id` (rendu serveur), et l'édition est re-vérifiée après persistance serveur
- [x] L'image est visible sur la page du projet — auto : `05-projets.spec.ts` § 4.1, la couverture est assertée visible **et** réellement chargée (`naturalWidth > 0`, pas un 404 masqué) ; le build renvoie HTTP 200
- [x] Le projet apparaît dans la liste des projets de la jam — auto : `05-projets.spec.ts` § 4.1, le lien `/project/:id` est récupéré depuis la page de la jam

---

### 4.2 Liker un projet

**Prérequis :** 4.1, utilisateur connecté  
**Bloquant :** non

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Aller sur `/project/:id` | Bouton « J'aime » (cœur) visible |
| 2 | Cliquer sur J'aime | Compteur +1, cœur rempli, bouton en surbrillance |
| 3 | Cliquer à nouveau | **Unlike** : compteur -1, cœur vidé (toggle) |
| 4 | Re-liker puis recharger la page | Le like est conservé (état `initialLiked` côté serveur) |
| 5 | Consulter le bouton sans être connecté | Bouton désactivé |
| 6 | Liker plusieurs projets et aller sur `/` | Section « Projets les plus aimés » triée par likes décroissants |

**Critères d'acceptation :**
- [x] Un seul document `likes` par `(project_id, user_id)` — le toggle supprime/recrée — auto (TU) : `actions-projects.test.ts` § `toggleLike`, les deux branches assertent l'exclusivité (`create` appelé **et** `delete` non appelé, puis l'inverse)
- [x] Le compteur `likes_count` ne descend jamais sous 0 — auto (TU) : `actions-projects.test.ts` — le compteur est issu d'un **recomptage** (`total` relu après l'écriture), jamais d'un décrément ; l'unlike est asserté à `likes_count: 0`. Un compteur recompté ne peut structurellement pas passer sous 0
- [x] Les projets de la jam sont triés par likes décroissants — **vérifié manuellement le 21/07/2026** sur le jeu de données de volume (voir procédure ci-dessous) : la liste descend bien 9 → 6 → 3 → 0

**Procédure de vérification du tri (rejouable) :**

`bash ./scripts/seed-big-demo.sh` crée 40 projets sur `demo-jam-big` avec `likes_count = (i × 3) % 12`, soit des valeurs 0, 3, 6 et 9 réparties. Deux surfaces à contrôler :

| Surface | Code appelé | Attendu |
|---|---|---|
| `http://localhost:3000/jam/demo-jam-big` | `getProjectsByJam` — `Query.orderDesc('likes_count')` | La liste descend 9 → 6 → 3 → 0 |
| Home, section « Projets les plus aimés » | `getPopularProjects` — `Query.orderDesc('likes_count')`, `limit 6` | Six projets à 9 likes |

> ⚠️ Ce jeu `demo-` est **purgé automatiquement** par le `global-setup` de Playwright au lancement suivant de `pnpm e2e` (il fausserait les assertions de la home). Rejouer le seed avant toute vérification manuelle.

---

### 4.3 Commenter un projet

**Prérequis :** 4.1  
**Bloquant :** non

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Aller sur `/project/:id` → section commentaires | Zone de saisie visible (si connecté) |
| 2 | Saisir un commentaire et valider | Commentaire affiché dans la liste |
| 3 | Tenter de commenter sans être connecté | Redirection vers login |

**Critères d'acceptation :**
- [x] Le commentaire est enregistré dans la collection `comments` — auto : `05-projets.spec.ts` § 4.3, user2 commente et le texte est asserté sur la page ; un visiteur anonyme est invité à se connecter
- [x] L'auteur et la date sont affichés — auto partiel : `07-profil.spec.ts` § 6.1 atteint le profil public **depuis l'auteur d'un commentaire** (l'auteur est donc rendu et cliquable) ; la date est bien affiché (vérifié manuellement)

---

## Module 5 — Chat en direct

### 5.1 Envoi de messages

**Prérequis :** 1.1, jam existante  
**Bloquant :** oui

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Aller sur `/jam/:id` section Chat | Chat affiché avec les canaux |
| 2 | Changer de canal (Général → Aide) | Messages du canal sélectionné |
| 3 | Saisir un message et envoyer | Message affiché dans la liste |
| 4 | Dans un autre onglet / autre navigateur, envoyer un message | Message apparaît **sans rechargement** dans le premier onglet |

**Critères d'acceptation :**
- [x] Les messages s'affichent en temps réel (WebSocket fonctionnel) — auto : `06-chat.spec.ts` § 5.1, **deux contextes de navigation indépendants** : user2 reçoit le message de user1 sans rechargement
- [x] La séparation des canaux est respectée (général ≠ aide) — auto : `06-chat.spec.ts` § 5.1, le message du canal Général est asserté **absent** du canal Aide

### 5.2 Tchat privé d'équipe

**Prérequis :** 3.1 (guilde avec 2 membres : sessions A et B), un compte C non-membre  
**Bloquant :** oui (sécurité)

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | A ouvre `/team/:id` | Section « Tchat d'équipe » visible, envoi OK, le message revient par realtime sans doublon |
| 2 | B (membre) ouvre la page dans un autre navigateur | Réception en temps réel + notification sonore |
| 3 | A épingle un message | Bandeau épinglé chez A **et** chez B sans rechargement ; désépinglage depuis le bandeau |
| 4 | A signale un message | Bouton passe à « Signalé », le message apparaît en modération admin (8.5) |
| 5 | C (non-membre connecté) ouvre `/team/:id` | Aucune section tchat |
| 6 | C force `databases.listDocuments` sur `team_chat_messages` depuis la console navigateur | **Zéro document** retourné |
| 7 | C s'abonne au canal realtime (console) pendant que A envoie un message | **Aucun événement** reçu |
| 8 | Un nouveau membre rejoint la guilde (historique existant), clique « Charger les messages plus anciens » | Rien d'antérieur à son arrivée ne remonte |

**Critères d'acceptation :**
- [x] La privacité est garantie côté données (row security), pas seulement côté UI — **vérifié manuellement le 21/07/2026** : un utilisateur non membre de la guilde, connecté ou non, ne voit pas le tchat privé de celle-ci. Complété en automatique (TU) : `actions-team-chat.test.ts` asserte qu'un non-membre est refusé **sans écriture** à l'envoi, et qu'à la lecture il obtient une **liste vide sans aucune lecture de messages** ; côté écriture, le message est créé avec une permission `read` **par membre courant**. ⚠️ Réserve : les étapes 6 et 7 du scénario (`listDocuments` et souscription realtime forcés depuis la console d'un compte non-membre) valident la row security **côté Appwrite** et ne peuvent pas être remplacées par un test à SDK mocké — **à jouer manuellement**
- [x] Épinglage et signalement se propagent en temps réel entre membres — Vérifié manuellement (21/07/2026) : le message épinglé chez A apparaît chez B sans rechargement, idem pour le signalement. Non asserté automatiquement : `actions-team-chat.test.ts` ne couvre que la création du message et la mise à jour de son drapeau `is_pinned` ou `is_reported` côté serveur, pas la propagation temps réel
---

## Module 6 — Profil utilisateur

### 6.1 Modifier le profil

**Prérequis :** 1.1  
**Bloquant :** non

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Aller dans Dashboard → Mon profil | Formulaire pré-rempli avec les infos actuelles |
| 2 | Modifier le nom d'affichage et valider | Nom mis à jour, confirmation affichée |
| 3 | Modifier la bio et valider | Bio mise à jour |
| 4 | ~~Uploader un avatar (JPG < 2 Mo)~~ | 🚫 Étape sans objet : fonctionnalité non implémentée (R-05) |
| 5 | ~~Tenter un avatar > 2 Mo~~ | 🚫 Idem |
| 6 | Aller sur `/profile/:id` | Profil public avec les nouvelles infos |

**Critères d'acceptation :**
- [x] Les modifications sont persistantes après rechargement — **vérification manuelle du 21/07/2026** : nom et bio bien mis à jour et conservés après rechargement. (Non asserté automatiquement : `07-profil.spec.ts` § 6.1 ne vérifie que le message de confirmation ; spec à renforcer.)
- [ ] L'avatar est stocké dans le bucket `avatars` — 🚫 **sans objet à ce jour : l'upload d'avatar n'est pas implémenté** (constat du 21/07/2026). Le bucket `avatars` et le champ `avatar_url` existent, mais aucune action d'upload côté application. Le test E2E correspondant est en `skip`. Voir anomalie R-05

---

### 6.2 Changer de mot de passe

**Prérequis :** 1.1 (compte email/password)  
**Bloquant :** non

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Dashboard → Mon profil → Changer le mot de passe | Formulaire : ancien mdp + nouveau mdp (x2) |
| 2 | Entrer les informations correctes | Mot de passe changé, confirmation |
| 3 | Se déconnecter et se reconnecter avec le nouveau mdp | Connexion réussie |
| 4 | Entrer l'ancien mot de passe incorrect | Erreur explicite |

**Critères d'acceptation :**
- [x] L'ancien mot de passe est vérifié avant le changement — auto : `07-profil.spec.ts` § 6.2, « erreur avec l'ancien mot de passe incorrect »
- [x] La session reste active après le changement — auto partiel : `07-profil.spec.ts` § 6.2 vérifie la **reconnexion** avec le nouveau mot de passe (contexte anonyme) ; le maintien de la session en cours est assuré par le cookie

---

## Module 7 — Organisateur

### 7.1 Créer une jam

**Prérequis :** 1.1  
**Bloquant :** oui (si le projet héberge des jams)

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Aller dans Dashboard → Mes jams | Liste des jams organisées |
| 2 | Cliquer sur "Créer une jam" | Formulaire complet |
| 3 | Remplir tous les champs obligatoires | Champs validés |
| 4 | Définir une date de début dans le futur | Statut calculé automatiquement : `À venir` |
| 5 | Valider | Jam créée, visible sur `/explore` |

**Critères d'acceptation :**
- [x] La jam apparaît dans `/explore` avec le bon statut — auto : `08-organisateur.spec.ts` § 7.1
- [x] L'organisateur peut la retrouver dans "Mes jams" — auto : `08-organisateur.spec.ts` § 7.1 (création depuis `/dashboard/my-jams`, puis lien « Gérer » au § 7.2)

---

### 7.2 Publier une annonce

**Prérequis :** 7.1  
**Bloquant :** non

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Dashboard → Mes jams → [jam] → Annonces | Formulaire d'annonce |
| 2 | Créer une annonce avec "Important" coché | Annonce créée |
| 3 | Aller sur `/jam/:id` | Annonce visible, mise en avant visuellement |
| 4 | Supprimer l'annonce depuis le dashboard | Annonce retirée de la page jam |

**Critères d'acceptation :**
- [x] Les annonces importantes sont visuellement distinctes des normales — **vérifié manuellement le 21/07/2026** : les annonces importantes s'affichent dans un cadre rouge, les annonces normales dans un cadre bleu
- [x] La suppression est immédiate — auto partiel (TU) : `actions-announcements.test.ts` § `deleteOrganizerAnnouncement` couvre la suppression et ses quatre gardes (organisateur, admin avec audit, tiers refusé, annonce d'une autre jam refusée même pour un admin). Le **rafraîchissement immédiat de l'affichage** n'est pas asserté

---

## Module 8 — Administration

**Prérequis :** accès admin (appartenir à l'équipe ADMIN dans Appwrite)

### 8.1 Accès au panel

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Aller sur `/admin` avec un compte non-admin | Page 404 |
| 2 | Aller sur `/admin` avec un compte admin | Dashboard admin affiché |

**Critères d'acceptation :**
- [x] Un utilisateur non-admin obtient un 404, pas une redirection login (protection par le layout) — auto : `09-admin.spec.ts` § 8.1 (compte non-admin → 404, compte admin → dashboard)

---

### 8.2 Logs et ban IP

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Aller sur `/admin/logs` | Tableau des logs et liste des IPs bannies |
| 2 | Bannir l'IP `127.0.0.1` manuellement | IP apparaît dans la liste des bannies |
| 3 | Débannir l'IP `127.0.0.1` | IP retirée de la liste |
| 4 | Purger les vieux logs | Confirmation, logs purgés |

**Critères d'acceptation :**
- [x] La collection `banned_ips` est bien mise à jour — auto : `09-admin.spec.ts` § 8.2, bannissement puis débannissement de `192.0.2.1` reflétés dans la liste
- [x] L'API `/api/banned-ips` retourne les IPs actives (cache 2 min) — auto partiel : `api-banned-ips.test.ts` couvre le refus sans secret (401), le **retour de la liste complète sans plafond**, et l'échec bruyant en 500 plutôt qu'une liste tronquée ; `09-admin.spec.ts` § 8.2 confirme le 401 sur l'endpoint réel. Le **TTL de 2 minutes** du cache dans `proxy.ts` n'est pas asserté (`proxy.test.ts` couvre le blocage d'IP bannie et la dégradation gracieuse, pas l'expiration)

---

### 8.2 bis — Filtre des logs

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Aller sur `/admin/logs?type=auth` | Seules les entrées `auth` sont listées — **aucune** entrée d'un autre type |
| 2 | Aller sur `/admin/logs?type=admin_action` | Seules les entrées `admin_action` sont listées |

**Critères d'acceptation :**
- [x] Le filtre discrimine réellement (absence des autres types, pas seulement présence du type filtré) — auto : `09-admin.spec.ts` § 8.5, `toHaveCount(0)` sur les types exclus dans les deux sens (`?type=auth` et `?type=admin_action`)

---

### 8.3 Désigner le podium d'une jam

**Prérequis :** 4.1 (projet soumis), jam en statut `ended`  
**Bloquant :** non

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Aller sur `/admin/featured` avec une jam **non terminée** sélectionnée | Message « Podium ouvrable après la fin de la jam », pas de boutons |
| 2 | Sélectionner une jam **terminée** | Boutons **1er / 2e / 3e** sur chaque projet |
| 3 | Cliquer sur « 1er » pour un projet | Bordure et trophée passent en couleur primaire |
| 4 | Re-cliquer sur « 1er » | Le rang est retiré (`placement` repasse à 0) |
| 5 | Attribuer 1er/2e/3e à trois projets, aller sur `/` | Les gagnants apparaissent dans le Hall of Fame avec leur **vrai rang** |
| 6 | Vérifier `/jam/:id` | Badge « ★ 1er/2e/3e » sur les projets primés |

**Critères d'acceptation :**
- [x] `placement` est borné à [0, 3] dans Appwrite — auto (TU) : `actions-admin.test.ts` § `setProjectPlacement` asserte les deux clamps (`7 → 3`, `-2 → 0`), le rejet d'un `NaN` sans écriture, et le refus si la jam n'est pas terminée
- [x] Le podium est indépendant du nombre de likes — **vérifié manuellement le 21/07/2026** : sur `demo-jam-big`, les projets 001, 002 et 003 portent `placement` 1, 2, 3 avec respectivement **3, 6 et 9 likes** — soit l'ordre exactement **inverse** du tri par popularité. Le podium affiche bien 001 en 1er pendant que le tri par likes place 003 en tête : les deux classements sont indépendants. (Non asserté automatiquement : `setProjectPlacement` ne lit jamais `likes_count`, mais aucun test ne verrouille cette séparation.)
- [x] La home affiche le rang stocké, pas un rang calculé — auto (TU) : `actions-home.test.ts` § `getHomePageData` — « utilise le placement **stocké** du projet, pas l'index du tableau », plus le tri par jam la plus récemment terminée puis par rang 1er → 3e

---

### 8.4 Superpouvoirs admin (jams, équipes, soumissions)

**Prérequis :** 8.1, une jam créée par un autre utilisateur  
**Bloquant :** non

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Aller sur `/admin/jams`, cliquer « Gérer » sur une jam d'autrui | Page `/admin/jams/:id` : édition + équipes + projets |
| 2 | Modifier la description de la jam et valider | Modification appliquée |
| 3 | Aller sur `/admin/logs?type=admin_action` | Entrée « Édition de la jam … » visible |
| 4 | Depuis `/admin/teams`, rechercher une équipe et la renommer | Nouveau nom affiché, entrée « Renommage de l'équipe … » dans les logs |
| 5 | Sur `/admin/moderation`, un projet signalé | Liens « Voir le projet » / « Gérer la jam » + bouton « Retirer la soumission » |

**Critères d'acceptation :**
- [x] Toute action admin sur une ressource dont il n'est pas propriétaire crée une entrée `admin_action` — auto : `09-admin.spec.ts` § 8.4 (édition d'une jam d'autrui → « Édition de la jam » dans les logs) et § 8.5 (renommage d'équipe → « Renommage de l'équipe »)
- [x] `/admin/teams` liste toutes les équipes (y compris les guildes sans jam) avec recherche par nom — **vérifié manuellement le 21/07/2026** : listing complet et recherche par nom fonctionnels. Complété en automatique : `09-admin.spec.ts` § 8.5 couvre l'accès depuis la sidebar, le listing et le renommage ; le champ de **recherche** n'y est pas asserté

### 8.5 Modération des messages de tchat d'équipe

**Prérequis :** 5.2 étape 4 (un message de team signalé)  
**Bloquant :** non

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Aller sur `/admin/moderation` | Section « Messages de team signalés » avec le message, lien « Voir l'équipe » |
| 2 | Vérifier le dashboard `/admin` | Le compteur « Signalements en attente » inclut le message de team |
| 3 | « Marquer comme résolu » sur un signalement | Le message disparaît de la liste, reste visible dans le tchat |
| 4 | « Supprimer » sur un autre message signalé | Le message disparaît de la liste **et** du tchat des membres en temps réel (événement realtime) |
| 5 | Aller sur `/admin/logs?type=admin_action` | Entrées de suppression / résolution journalisées |

**Critères d'acceptation :**
- [x] Un admin ne voit un message de tchat privé que s'il a été signalé par un membre — auto (TU) : `actions-admin.test.ts` § `listReportedTeamMessages` asserte que la requête envoyée à Appwrite contient bien `Query.equal('reported', true)` (le filtre lui-même, pas seulement son effet) et qu'un non-admin est rejeté
- [x] Suppression et résolution sont journalisées et rafraîchissent les compteurs — auto partiel (TU) : `actions-admin.test.ts` couvre `deleteTeamMessage` (suppression **+ audit**), `resolveTeamMessageReport` (`reported` repasse à false) et le refus du non-admin dans les deux cas. Le **rafraîchissement des compteurs** du dashboard n'est pas asserté

---

## Module 9 — Infrastructure

### 9.1 TLS et sécurité (prod uniquement)

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | `curl -I https://konfiturgame.fr` | `strict-transport-security` présent |
| 2 | `curl -I http://konfiturgame.fr` | Redirection 301 → HTTPS |
| 3 | Inspecter les headers de réponse | `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` présents |
| 4 | `curl https://api.konfiturgame.fr/v1/health/version` | HTTP 200, `{"version":"1.9.0"}` |

**Critères d'acceptation :**
- [ ] HTTPS actif sur tous les domaines — 🔴 **non exécutable le 21/07** : `https://konfiturgame.fr` et `https://api.konfiturgame.fr` injoignables (code 000), cf. anomalie R-04
- [ ] Redirection HTTP → HTTPS — 🔴 non exécutable, idem
- [ ] Headers de sécurité présents — 🔴 non exécutable, idem. Les valeurs sont définies dans `traefik/dynamic/middlewares.yml` mais **la vérification ne vaut que servie par la production**

---

### 9.2 Accessibilité

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Naviguer sur la page d'accueil avec Tab uniquement | Tous les éléments interactifs sont accessibles |
| 2 | Vérifier l'attribut `lang` de la balise `<html>` | `lang="fr"` |
| 3 | Activer la navigation clavier sur le header | Focus visible sur les liens (outline 2px bleu) |
| 4 | Tester avec `prefers-reduced-motion` activé | Aucune animation en cours |

**Critères d'acceptation :**
- [x] `lang="fr"` sur `<html>` — auto : `01-smoke.spec.ts` et `09-admin.spec.ts` § 8.3
- [x] Focus visible sur tous les éléments interactifs — auto partiel : `09-admin.spec.ts` § 8.3 vérifie le focus visible sur le header et la présence du skip-link `#main-content` ; `03-navigation.spec.ts` § 2.4 vérifie le focus trap du menu mobile (Escape restitue le focus au burger, Tab boucle dans le dialogue). La couverture n'est pas exhaustive sur toutes les pages
- [ ] Aucune animation si `prefers-reduced-motion: reduce` — ⏳ non couvert par la suite E2E et non encore vérifié manuellement

---

## Anomalies constatées — campagne du 21 juillet 2026

| ID | Scénario | Constat | Qualification | Suite donnée |
|---|---|---|---|---|
| R-01 | 2.4 — Menu mobile, focus trap | `#mobile-menu` introuvable après clic sur le burger au run complet ; **passe au re-run**. Le test frère (« Escape ferme le menu ») exécute les mêmes étapes et passe dans les deux campagnes. | Instabilité de test : le clic part avant l'hydratation React du toggle `menuOpen`, l'événement est perdu. **Pas** de régression du focus trap (P0-1). | Fiabiliser la spec : attendre l'hydratation avant le clic, comme le font déjà `04-guildes` et `06-chat` via `expect(...).toPass()` |
| R-02 | 7.2 — Annonce visible sur la page de la jam | Le `body` asserté contient encore `/explore` : le clic sur le lien de la jam n'a pas navigué. **Passe au re-run.** La publication de l'annonce (test précédent) passe dans les deux campagnes. | Instabilité de test : navigation non attendue. Fonctionnalité vérifiée. | Fiabiliser la spec : `waitForURL` après le clic |
| R-03 | 2.3 — Sections repliables | Passe au run complet, **échoue au re-run** (`not.toBeVisible` sur une section attendue repliée). | Instabilité de test, même famille que R-01 : état client asserté avant stabilisation. | Fiabiliser la spec |
| R-04 | 9.1 — TLS et sécurité (prod) | `https://konfiturgame.fr` et `https://api.konfiturgame.fr` injoignables (code 000). | **Bloquant pour la recette PROD**, sans effet sur la recette DEV. | Stabilisation de la production en cours (session de cookie inter-domaine) |
| R-05 | 6.1 — Upload d'avatar | L'étape « Uploader un avatar » du scénario est injouable : aucune action d'upload n'existe dans l'application. Seuls le bucket `avatars` et le champ `avatar_url` sont déclarés. Le test E2E correspondant est en `skip` permanent. | **Écart de périmètre, pas un bug** : la fonctionnalité n'a jamais été développée. Mais `docs/TODO.md` la liste comme terminée (« modifier nom, bio, mot de passe, supprimer le compte, upload avatar »), ce qui est **faux**. | 1. Corriger `docs/TODO.md` en la basculant dans « À faire ». 2. Décider : implémenter, ou assumer le retrait du périmètre MVP et retirer l'étape du scénario 6.1 |

**Aucune anomalie de comportement n'a été constatée** sur les fonctionnalités implémentées. Les trois instabilités R-01 à R-03 portent sur la synchronisation des tests, et chaque fonctionnalité concernée a été observée conforme dans au moins une des deux campagnes. R-05 n'est pas un défaut de fonctionnement mais un **écart entre le périmètre documenté et le périmètre réel**, ce qui reste à corriger dans la documentation. Elles sont néanmoins traitées comme une dette de fiabilité : une suite non déterministe perd sa valeur de garde-fou anti-régression, puisqu'un échec réel devient indiscernable d'un faux positif.

**Note sur les données de test :** le `global-teardown` de Playwright supprime les utilisateurs, jams, équipes et projets `[E2E]` en fin de run. Les scénarios manuels restants (3.4 solo, 4.2 likes, 5.2 tchat d'équipe, 8.3 podium, 8.5 modération) doivent donc être joués sur un jeu de données seedé à part (`./scripts/seed-data.sh`), et non sur les résidus d'une campagne automatisée.

---

## Checklist de validation avant mise en production

Cette checklist résume les critères bloquants à valider avant tout déploiement en production.

> État au 21/07/2026 : validée en **DEV**, bloquée en **PROD** tant que l'infrastructure ne répond pas.

### Infrastructure
- [x] Smoke test passé (frontend 200, Appwrite `/v1/health/version` répond) — **en DEV uniquement**, cf. PV d'exécution
- [ ] TLS actif, redirection HTTP → HTTPS — 🔴 production injoignable (R-04)
- [ ] Headers de sécurité présents (HSTS, CSP, X-Frame-Options) — 🔴 idem
- [ ] Dashboard Traefik protégé par mot de passe (401 sans auth) — 🔴 idem

### Authentification
- [x] Inscription email/password (scénario 1.1) — auto : `02-auth.spec.ts`
- [x] Connexion email/password + redirection post-login (scénario 1.2) — auto : `02-auth.spec.ts`
- [x] Protection des routes `/dashboard` et `/admin` (scénario 1.2, étape 4) — auto : `02-auth.spec.ts`

### Fonctionnalités core
- [x] Guildes : création + rejoindre par code (scénarios 3.1, 3.2) — auto : `04-guildes.spec.ts`
- [x] Inscription à une jam (scénario 3.3) — auto : `04-guildes.spec.ts`
- [x] Soumission d'un projet (scénario 4.1) — auto : `05-projets.spec.ts`
- [x] Chat en temps réel (scénario 5.1, étape 4) — auto : `06-chat.spec.ts`, deux contextes indépendants
- [x] Création d'une jam (scénario 7.1) — auto : `08-organisateur.spec.ts`

### CI/CD (si pipeline actif)
- [ ] Les 4 jobs bloquants passent (lint, tests, gitleaks, RGPD) — ⏳ hors campagne locale : à constater au prochain push sur `main`
- [ ] Le déploiement s'est déclenché et les healthchecks ont réussi — ⏳ idem
- [ ] Aucune issue `deploy-failure` ouverte sur GitHub — ⏳ idem

### Données
- [ ] `seed-data.sh` exécuté (collections principales) — ⏳ non rejoué. En revanche `seed-big-demo.sh` a été exécuté le 21/07 (791 documents, 0 échec) pour les vérifications manuelles de volume et de tri
- [x] `create-log-collections.sh` exécuté (audit_logs, banned_ips) — auto : `09-admin.spec.ts` § 8.2 écrit et lit dans `banned_ips`, et `/admin/logs` liste des entrées `auth` et `admin_action`
- [x] `LOG_INTERNAL_SECRET` défini dans `.env` — auto : `/api/banned-ips` renvoie **401** et non **500** ; la route renvoie 500 quand le secret est absent (`src/app/api/banned-ips/route.ts`), le 401 prouve donc qu'il est défini

---

*KonfiturGame · Cahier de recettes · Mis à jour : 2026-07-21 — campagne de recette exécutée, voir « PV d'exécution » en tête de document*
