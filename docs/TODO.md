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
- [x] Votes et commentaires sur les projets

### À faire

- [ ] Ajouter `jam_id` dans la table `votes` pour limiter à un vote par user par jam (actuellement : un vote par projet, pas par jam)
- [ ] Page publique de profil `/profile/[userId]` — à finaliser côté design
- [ ] Améliorer le SEO (structured data plus riche, meta descriptions par page)
- [ ] Redirection / lien vers FRVTubers (origine du projet)
- [ ] Surveillance et alertes production (Uptime Robot, Grafana ou équivalent)
- [ ] Tests de charge

---

## TESTS

| Fichier | Tests | Couvre |
|---------|-------|--------|
| `appwrite-mappers.test.ts` | 15 | Mappers Appwrite → types TS |
| `profile-validators.test.ts` | 15 | validateUpdateProfile* (bug NaN corrigé) |
| `actions-profile.test.ts` | 10 | updateProfileName, updateProfileBio |
| `actions-chat.test.ts` | 9 | sendMessage, pinMessage, reportMessage |
| `actions-teams.test.ts` | 6 | createTeam, joinTeamByCode, getTeamsByJam |
| `bot-detection.test.ts` | — | Détection bots (User-Agent + URL patterns) |
| `seo.test.ts` | 8 | JSON-LD helpers |

### À faire — Tests

- [ ] Tests end-to-end (Playwright ou Cypress)
- [ ] Vérification du fonctionnement du realtime (Appwrite WebSocket)
- [ ] Améliorer la couverture de `actions-profile.test.ts` (certaines fonctions non exportées)
- [ ] Tests de `actions-teams.test.ts` : couvrir registerTeamToJam, leaveTeam

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

- [x] DOCUMENTATION.md — guide complet (setup, architecture, commandes)
- [x] CI-CD.md — guide pipeline CI/CD
- [x] DATABASE.md — schéma ERD et détail des collections
- [x] BRANCH-PROTECTION.md — rulesets GitHub
- [x] PRODUCTION.md — guide déploiement production
- [ ] Définir la licence (MIT ? CC BY-NC ?)
- [ ] Captures d'écran / screenshots pour la doc

---

## PIÈGES CONNUS

| Problème | Solution |
|----------|----------|
| `devKeys` Unknown attribute au démarrage Appwrite | `docker exec konfitur-appwrite php /usr/src/code/app/cli.php migrate` puis redémarrer |
| `node_modules` corrompu (artefact worktree committé) | `rm frontend/node_modules && git rm --cached frontend/node_modules` |
| Tests sur host échouent | `docker exec konfitur-frontend sh -c "cd /app && npx vitest run ..."` |
| `pnpm-lock.yaml` EACCES sur WSL2 | Générer dans `/tmp` (voir DOCUMENTATION.md §16) |
| `new URL()` crash | Le fallback doit contenir `http://`, pas juste `'localhost'` |
| `getaddrinfo for redis failed` | Déclarer `networks:` explicitement dans l'override pour appwrite et appwrite-realtime |
| Attributs Appwrite bloqués en "processing" | `docker compose ps appwrite-worker-databases` — doit être "Up" |
| CSP `connect-src` hardcodée dans middlewares.yml | Traefik file provider ne substitue pas les vars d'env — modifier manuellement en prod |
| Redis sans `--requirepass` | Bug Appwrite 1.8.0 dans Queue\Connection\Redis — Redis isolé sur appwrite-net, pas de risque |
