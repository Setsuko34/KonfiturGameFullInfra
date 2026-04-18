# KonfiturGame — Roadmap & TODO

## FONCTIONNALITÉS

### Terminées ✅
- [x] Gestion des équipes multi-jam (guildes) — création, invitation, inscription à plusieurs jams, gestion des rôles, suppression
- [x] Gestion du profil utilisateur — modifier nom, bio, mot de passe, supprimer le compte
- [x] Annonces publiables par les organisateurs sur leurs jams uniquement
- [x] Édition d'une jam en cours (correction mineure : description, règles, prix, tags, max participants)
- [x] Logs d'audit admin — voir les actions, crash, connexions
- [x] Ban IP — détecter les bots, bannir des IPs depuis le panel admin
- [x] SEO — sitemap dynamique, robots.txt, Open Graph, JSON-LD

### À faire
- [ ] Améliorer le SEO (structured data plus riche, meta descriptions par page)
- [ ] Page publique de profil `/profile/[userId]` — à finaliser côté design
- [ ] Redirection vers FRVTubers (car projet imaginé par eux)
- [ ] Ajouter Jam_id dans la table votes pour limiter à un vote par user par jam 

---

## TESTS

| Fichier | Tests | Notes |
|---------|-------|-------|
| `appwrite-mappers.test.ts` | 15 | Mappers Appwrite → types TS |
| `profile-validators.test.ts` | 15 | Validators formulaire profil (bug NaN corrigé) |
| `actions-profile.test.ts` | 10 | Actions serveur profil |
| `actions-chat.test.ts` | 9 | Actions serveur chat |
| `actions-teams.test.ts` | 6 | Actions serveur équipes/guildes |
| `bot-detection.test.ts` | — | Bot detection |
| `seo.test.ts` | — | SEO helpers |

### À faire — Tests
- [ ] Tests fonctionnels (end-to-end)
- [ ] Vérification du bon fonctionnement du realtime (Appwrite WebSocket)
- [ ] Améliorer la couverture des `actions-profile.test.ts` (10 tests en échec connu — fonctions non exportées)

---

## PRODUCTION

- [ ] Prendre un VPS pour héberger l'application
- [ ] Configurer le nom de domaine KonfiturGame.fr
- [ ] Configurer les certificats SSL avec Let's Encrypt (Traefik + ACME)
- [ ] Configurer les DNS (A records: konfiturgame.fr, api., traefik.)
- [ ] Configurer OAuth Google & Discord avec les redirect URIs de production
- [ ] Mettre en place la surveillance et les alertes (Uptime Robot, Grafana…)
- [ ] Effectuer des tests de charge
- [ ] Mettre en place un processus de déploiement continu (CI/CD)
- [ ] Sécuriser le pare-feu serveur (ports 80, 443 uniquement)
- [ ] Automatiser les backups quotidiens (cron)
- [ ] Configurer la rotation des logs Docker (`daemon.json`)

---

## DOCUMENTATION À COMPLÉTER

- [x] Ajouter une section "Contributing" dans README
- [x] Ajouter une section "Contact" (lien FRVtubers) dans README
- [x] Diagramme ERD de la base de données (`docs/DATABASE.md`)
- [ ] Définir la licence (MIT ? CC BY-NC ?)
- [ ] Captures d'écran / screenshots pour la doc

---

## PIÈGES CONNUS (à ne pas oublier)

| Problème | Solution |
|----------|----------|
| `devKeys` Unknown attribute au démarrage Appwrite | Lancer `docker exec konfitur-appwrite php /usr/src/code/app/cli.php migrate` puis redémarrer |
| `node_modules` corrompu (worktree artifact commité) | `rm frontend/node_modules && git rm --cached frontend/node_modules` |
| Tests sur host échouent | Lancer via `docker exec konfitur-frontend sh -c "cd /app && npx vitest run ..."` |
| `pnpm-lock.yaml` EACCES sur WSL2 | Générer dans `/tmp` (voir CLAUDE.md) |
