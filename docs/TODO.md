# KonfiturGame — Roadmap & TODO

---

## FONCTIONNALITÉS

### Terminées ✅

- [x] Gestion des équipes multi-jam (guildes) — création, invitation, inscription, gestion des rôles, suppression
- [x] Gestion du profil utilisateur — modifier nom, bio, mot de passe, supprimer le compte, upload avatar
- [x] Annonces publiables par les organisateurs sur leurs jams uniquement
- [x] Édition d'une jam en cours (description, règles, prix, tags, max participants)
- [x] Logs d'audit admin — actions, crashs, connexions
- [x] Ban IP — détecter les bots, bannir des IPs depuis le panel admin
- [x] SEO — sitemap dynamique, robots.txt, Open Graph, JSON-LD (Event, SoftwareApplication, Organization)
- [x] Pages légales — mentions légales, politique de confidentialité, conditions d'utilisation
- [x] OAuth Google & Discord
- [x] Chat temps réel (Appwrite Realtime / WebSocket)
- [x] Commentaires sur les projets
- [x] Likes togglables sur les projets + classement popularité (tri in-jam et section « Projets les plus aimés » sur la home) — collection `likes`, compteur `likes_count`
- [x] Podium top 3 par jam (`placement` 1/2/3) désigné par l'organisateur après la fin de la jam — remplace l'ancien booléen `winner` et le placement factice de la home

### À faire

- [ ] Page publique de profil `/profile/[userId]` — à finaliser côté design
- [ ] Améliorer le SEO (structured data plus riche, meta descriptions par page)
- [ ] Redirection / lien vers FRVTubers (origine du projet)
- [ ] Surveillance et alertes production (Uptime Robot, Grafana ou équivalent)
- [ ] Tests de charge

---

## TESTS

### Unitaires (Vitest — `src/__tests__/`)

| Fichier | Couvre |
|---------|--------|
| `appwrite-mappers.test.ts` | Mappers Appwrite → types TS |
| `profile-validators.test.ts` | validateUpdateProfile* (bug NaN corrigé) |
| `actions-profile.test.ts` | updateProfileName, updateProfileBio |
| `actions-chat.test.ts` | sendMessage, pinMessage, reportMessage |
| `actions-teams.test.ts` | createTeam, joinTeamByCode, getTeamsByJam |
| `actions-projects.test.ts` | toggleLike (like/unlike, compteur jamais négatif) |
| `actions-home.test.ts` | getHomePageData (placement réel des gagnants) |
| `bot-detection.test.ts` | Détection bots (User-Agent + URL patterns) |
| `seo.test.ts` | JSON-LD helpers |

### End-to-end (Playwright — `frontend/e2e/`)

- [x] Suite E2E Playwright : 9 specs (smoke, auth, navigation, guildes, projets, chat, profil, organisateur, admin) — voir `docs/DOC_test_E2E.md`
- [x] Vérification du realtime (Appwrite WebSocket) — `06-chat.spec.ts` : user2 voit le message de user1 sans rechargement

### À faire — Tests

- [ ] Améliorer la couverture de `actions-profile.test.ts` (certaines fonctions non exportées)
- [ ] Tests de `actions-teams.test.ts` : couvrir registerTeamToJam, leaveTeam
- [ ] Tests E2E des likes et du podium organisateur (specs à ajouter à la suite Playwright)

---

## INFRASTRUCTURE & PRODUCTION

- [x] Pipeline CI/CD GitHub Actions (lint, tests, scan secrets, checklist RGPD, déploiement)
- [x] Protections de branche `main` et `develop` (rulesets GitHub)
- [ ] Prendre un VPS et déployer en production
- [ ] Configurer les DNS (A records: konfiturgame.fr, api., traefik.)
- [ ] Configurer OAuth Google & Discord avec les redirect URIs de production
- [ ] Sécuriser le pare-feu serveur (ports 80, 443 uniquement)
- [ ] Automatiser les backups quotidiens (cron)
- [ ] Configurer la rotation des logs Docker (`daemon.json`)
- [ ] Mettre en place la surveillance et les alertes
- [ ] Activer les jobs Semgrep / audit dépendances / lint Docker en mode bloquant (après tri des faux positifs)
- [ ] Activer la Phase 2 CI/CD : déploiement du schéma Appwrite depuis le pipeline

---

## DOCUMENTATION

- [x] DOCUMENTATION.md — guide complet (setup, architecture, choix techniques, commandes)
- [x] UTILISATION.md — manuel d'utilisation (participants, organisateurs, admins)
- [x] DEPLOIEMENT.md — manuel de déploiement production
- [x] MISE-A-JOUR.md — manuel de mise à jour (npm, Appwrite, Traefik, schéma)
- [x] CAHIER-DE-RECETTES.md — tests d'acceptation
- [x] DOC_test_E2E.md — documentation de la suite E2E Playwright
- [x] CI-CD.md — guide pipeline CI/CD
- [x] DATABASE.md — schéma ERD et détail des collections
- [x] BRANCH-PROTECTION.md — rulesets GitHub
- [x] PRODUCTION.md — fiche réflexe production (pointe vers DEPLOIEMENT.md)
- [ ] Définir la licence (MIT ? CC BY-NC ?)
- [ ] Captures d'écran / screenshots pour la doc

---

## PIÈGES CONNUS

| Problème | Solution |
|----------|----------|
| `Unknown attribute: xyz` après montée de version Appwrite | `php cli.php migrate` + flush Redis + redémarrer ; si persistant : correction métadonnées (MISE-A-JOUR.md §4) |
| SSR 401 "router" après migration 1.9 | `_APP_MIGRATION_HOST=appwrite` dans l'environment du service appwrite |
| `node_modules` corrompu (artefact worktree committé) | `rm frontend/node_modules && git rm --cached frontend/node_modules` |
| Tests sur host échouent | `docker exec konfitur-frontend sh -c "cd /app && npx vitest run ..."` |
| `pnpm-lock.yaml` EACCES sur WSL2 | Générer dans `/tmp` (voir DOCUMENTATION.md §16) |
| `new URL()` crash | Le fallback doit contenir `http://`, pas juste `'localhost'` |
| `getaddrinfo for redis failed` | Déclarer `networks:` explicitement dans l'override pour appwrite et appwrite-realtime |
| Attributs Appwrite bloqués en "processing" | `docker compose ps appwrite-worker-databases` — doit être "Up" |
| CSP `connect-src` hardcodée dans middlewares.yml | Traefik file provider ne substitue pas les vars d'env — modifier manuellement en prod |
| Redis sans `--requirepass` | Bug Appwrite (toujours présent en 1.9.0) dans Queue\Connection\Redis — Redis isolé sur appwrite-net, pas de risque |
