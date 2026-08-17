# KonfiturGame — Journal des versions

Journal des versions déployées. Chaque entrée documente les nouveautés, les correctifs
appliqués et les anomalies connues à la livraison.

**Convention :** versionnage sémantique `MAJEUR.MINEUR.CORRECTIF`.

| Incrément | Signification |
|-----------|--------------|
| MAJEUR | Rupture de compatibilité ou changement de périmètre structurant |
| MINEUR | Nouvelle fonctionnalité sans rupture |
| CORRECTIF | Correction d'anomalie sans nouvelle fonctionnalité |

**Flux Git :** fonctionnalités sur `feat/*`, correctifs sur `fix/*` ou `hotfix/*`,
intégration sur `develop`, production sur `main`. Les deux branches principales sont
protégées par des rulesets GitHub exigeant les quatre contrôles bloquants de la CI —
aucun commit direct sur `main` n'est possible.

**Identifiants d'anomalies :** `B-xx` pour les bogues (numérotation continue depuis le
dossier Bloc 2), `R-xx` pour les constats de campagne de recette.

---

## v1.1.1 — non publiée (2026-08-15) — Rollback frontend par image

> **Pourquoi un incrément CORRECTIF et non MINEUR :** le produit livré à l'utilisateur est
> strictement inchangé — aucune fonctionnalité ajoutée, aucun écran, aucun comportement
> applicatif modifié ; seule une procédure d'exploitation défectueuse, qui laissait le
> serveur dans un état à réparer à la main, est réparée.

### Correctifs

- **Le rollback frontend n'impose plus de réécrire l'historique du serveur.** Le service
  `frontend` n'avait pas de clé `image:` : Compose lui donnait un nom implicite, écrasé à
  chaque build, et la seule procédure de retour arrière documentée était un
  `git reset --hard` sur le dépôt du VPS — qui faisait échouer le `git pull --ff-only` du
  déploiement suivant. Chaque build produit désormais `konfitur-frontend:<sha>` ; revenir en
  arrière est une bascule de `FRONTEND_TAG` dans `.env`, sans rebuild
- **`stable` ne désigne qu'une image vérifiée.** La promotion est une étape distincte,
  postérieure au healthcheck externe : si celui-ci échoue, l'alias reste sur l'image
  précédente
- **La sonde de dernier recours respecte le rollback.** `health-check.sh` relance les
  conteneurs tombés avec le même fichier compose, donc le même `.env` : elle ne peut pas
  ramener silencieusement la version qu'on vient d'écarter. Le tag n'est écrit qu'à un seul
  endroit, `scripts/deploy-frontend.sh`
- Rétention de 5 tags de SHA, plus `stable` et les alias `vX.Y.Z`. Le
  `docker system prune -f` hebdomadaire ne touche que les images *dangling* — l'interdiction
  d'y ajouter `-a` est désormais écrite dans le crontab, à l'endroit où l'on serait tenté
  de le faire
- **Image de développement isolée** (`konfitur-frontend-dev:latest` dans
  `docker-compose.override.yml`) : sans nom distinct, un build local avec `Dockerfile.dev`
  et `NODE_ENV=development` écraserait `konfitur-frontend:latest` sur la machine du
  développeur

### Tests et intégration continue

- Contrôle #6 de `scripts/ci/prod-config-check.sh` : le service `frontend` doit porter une
  image nommée et versionnée. Sans ce garde-fou, la suppression de la clé `image:` ferait
  disparaître le seul point de retour du frontend sans qu'aucun test ne s'en aperçoive.
  Écrit avant le changement qu'il garde, et vérifié rouge d'abord
- `scripts/deploy-frontend.sh` ajouté au périmètre shellcheck (liste explicite et manuelle
  par choix documenté : un script d'exploitation absent de cette liste n'est jamais vérifié)
- Job `deploy-frontend` : le bloc SSH se réduit à `bash scripts/deploy-frontend.sh
  "$APP_DIR" build`, et une étape SSH distincte `Promotion de l'image en 'stable'` est
  ajoutée **après** le healthcheck. Une commande par ligne, zéro contrôle de flux —
  `script_stop: true` n'est pas un `set -e`
- `FRONTEND_TAG` documenté dans `.env.example`, sans quoi le contrôle #3 fait échouer le job
  bloquant `Lint + type-check`

### Documentation

- `docs/MISE-A-JOUR.md` §9 : procédure de rollback réécrite, limites explicitées
  (l'image ne couvre pas la configuration d'infrastructure, ni les migrations de schéma) ;
  le rollback d'une mise à jour de dépendance npm renvoie d'abord à la bascule d'image
- `docs/CI-CD.md` : séquence du job `deploy-frontend` corrigée, étape de promotion
  décrite, et section « Rollback manuel » réécrite — c'est la page vers laquelle pointe
  l'issue `deploy-failure`, donc celle qu'on lit un jour de panne. Le retour arrière de la
  configuration d'infrastructure y est distingué : `git revert` (qui avance l'historique),
  jamais `git reset`
- `docs/DEPLOIEMENT.md` : mise à jour manuelle du frontend et aide-mémoire alignés sur
  `deploy-frontend.sh`
- `CLAUDE.md` : nouveau piège connu — un `docker compose build frontend` lancé à la main en
  production reconstruit sous le tag déjà inscrit dans `.env`, celui du déploiement
  précédent, et fait perdre ce point de retour sans un message

### Reste à faire

- Répétition du rollback sur le VPS après deux déploiements successifs, relevés à consigner
  dans `docs/CAHIER-DE-RECETTES.md` (tâche 5 du plan). Un mécanisme de retour arrière jamais
  éprouvé n'est pas un mécanisme de retour arrière

---

## v1.1.0 — 2026-08-01 — Supervision et maintien en condition opérationnelle

### Nouveautés

- **Stack de supervision** : Prometheus (rétention 30 jours), Grafana, node-exporter,
  cAdvisor, blackbox-exporter, isolés sur le réseau `monitoring-net`
- **20 règles d'alerte** réparties en 7 groupes (disponibilité, erreurs, TLS, ressources,
  conteneurs, sondes, sauvegardes), sévérités P0 à P3
- **Alertmanager** : routage, regroupement, inhibition et rappels des alertes.
  Prometheus évalue les règles, Alertmanager décide qui prévenir. Sans lui, une règle
  passe en `firing` sans que personne ne soit notifié — les politiques de notification
  de Grafana ne routent que les alertes qu'il évalue lui-même, pas celles d'un
  Prometheus externe
- **Notifications Discord** via le récepteur `discord_configs` d'Alertmanager, cadence
  de rappel différenciée par sévérité (P0 : 10 s puis toutes les 30 min)
- **Sondes externes** sur les surfaces publiques, dont une sonde de non-régression du
  routage same-origin `/v1` (anomalie B-11) et une sonde de sécurité vérifiant que le
  dashboard Traefik répond toujours 401
- **Métriques Traefik** exposées sur un entrypoint interne dédié (`:8082`), jamais publié
- **Workers de statistiques Appwrite** : `worker-stats-usage`, `worker-stats-resources` et
  la tâche d'ordonnancement `stats-resources`
- **`scripts/health-check.sh`** : sonde hors conteneur, exécutée par cron toutes les
  5 minutes, avec relance automatique des conteneurs critiques
- **Supervision rejouable en développement** : `prometheus.dev.yml` et
  `blackbox.dev.yml` visent les conteneurs locaux, Grafana est publié sur
  `localhost:3001` et Prometheus sur `localhost:9090`. Le fichier de règles est le
  **même** qu'en production, pour que le test local ait valeur de preuve. Entrypoint
  `metrics` ajouté à `traefik.dev.yml`
- **`scripts/crontab.konfiturgame`** : tâches planifiées versionnées — sauvegarde
  quotidienne à 2 h, nettoyage Docker hebdomadaire, rotation des journaux
- **`backup.sh`** produit désormais une archive unique `AAAA-MM-JJ_HH-MM.tar.gz` et porte
  lui-même sa rotation (7 archives conservées), au lieu de laisser un dossier par
  exécution purgé par une tâche cron distincte

### Correctifs et améliorations

- Fraîcheur des sauvegardes rendue observable : `backup.sh` publie
  `konfitur_backup_last_success_timestamp_seconds` et son code de sortie dans le
  collecteur textfile de node-exporter
- Middleware d'en-têtes dédié à Grafana (`grafana-headers`) : la CSP applicative rendait
  son interface inutilisable (page blanche sans erreur serveur)
- Sondes et healthchecks dotés d'un User-Agent de navigateur — l'UA par défaut
  (`Go-http-client`, `curl/`) est bloqué par notre propre détection de bots, ce qui
  bannissait l'IP de la sonde et produisait une fausse alerte d'indisponibilité

### Sécurité des dépendances

- **Next.js 16.2.9 → 16.2.12** : corrige quatre avis HIGH et cinq MODERATE. Quatre
  d'entre eux ne concernaient pas ce déploiement (bypass de middleware exigeant une
  configuration `i18n` absente, SSRF exclue par `output: 'standalone'`, SSRF via des
  `rewrites()` inexistants, DoS SVG neutralisé par `dangerouslyAllowSVG` désactivé).
  Restaient bien applicables le DoS par Server Actions et la divulgation d'endpoints
  de Server Function
- **postcss → 8.5.25, sharp → 0.35.3** via `pnpm-workspace.yaml` : monter Next ne les
  corrigeait pas, la 16.2.12 épinglant toujours `postcss@8.4.31` et `sharp@^0.34.5`
- **`images.remotePatterns` vidé.** `/_next/image?url=…` est un endpoint public : tout
  hôte autorisé devient une source d'octets que le serveur récupère puis fait décoder
  par libvips. `cloud.appwrite.io` y figurait sans être référencé nulle part — quiconque
  pouvant y déposer un fichier disposait d'un chemin vers les CVE de sharp. Les images
  utilisateur sont servies en `<img>` nu et ne passent jamais par l'optimiseur
- **`HEALTHCHECK` sur les deux Dockerfiles** (Trivy DS-0026) et **utilisateur non-root
  en développement** (DS-0002). La sonde vise un fichier statique dont l'extension est
  exemptée par les `SKIP_PATTERNS` de `proxy.ts` et porte un User-Agent de navigateur :
  celui de wget vaut un 403, donc un conteneur sain marqué *unhealthy* puis redémarré
  en boucle par notre propre supervision

### Tests et intégration continue

- **Job CI `monitoring`** (bloquant) : `promtool check config` sur les configurations de
  production et de développement, `promtool test rules`, `amtool check-config`. Comble un
  angle mort — une erreur de syntaxe dans `alerts.yml` n'empêche pas Prometheus de
  démarrer : il collecte normalement et n'évalue plus rien. La supervision échouait en
  silence, et en vert. Les versions de `promtool` et `amtool` sont lues dans
  `docker-compose.yml`, pour qu'elles ne puissent pas diverger de ce qui tourne en prod
- **`monitoring/prometheus/alerts.test.yml`** : 15 scénarios / 19 assertions sur horloge
  virtuelle, couvrant les règles que la stack de développement ne peut pas exercer —
  seuils temporels (sauvegarde 25 h, sonde 30 min), certificats TLS encadrés de part et
  d'autre du seuil, protection du dashboard Traefik, et non-régression du faux positif
  cAdvisor sous WSL2. Jeu validé par mutation : sept altérations de `alerts.yml` (seuils,
  `for:`, sévérité, comparateur) sont toutes détectées
- **`scripts/ci/monitoring-check.sh`** : smoke test de la chaîne réelle, stack démarrée —
  cibles collectées, sondes `probe_success`, règles effectivement chargées, Alertmanager
  raccordé, collecteur textfile monté
- `monitoring/**` ajouté au filtre de chemins `infra` du déploiement : corriger un seuil
  d'alerte et pousser sur `main` ne mettait rien à jour sur le VPS. Le déploiement envoie
  désormais un SIGHUP à Prometheus et Alertmanager — leurs configurations étant montées
  en volume, `docker compose up -d` ne recrée pas ces conteneurs et laissait l'ancienne
  configuration chargée en mémoire

### Documentation

- Ajout de `docs/SUPERVISION.md` : périmètre, sondes, seuils, modalités de signalement
- Ajout de `docs/CHANGELOG.md` (ce fichier)
- `docs/TODO.md` : surveillance et sauvegardes automatisées basculées en « fait »

### Anomalies connues

- R-05 — l'upload d'avatar reste non implémenté (écart de périmètre, priorisé P1)
- R-01 à R-03 — instabilités de la suite end-to-end, sans effet sur le produit

---

## v1.0.0 — 2026-07-21 — Première mise en production

Première version déployée publiquement sur `konfiturgame.fr`. Tag posé après validation
du cahier de recettes en production.

### Correctifs de stabilisation — famille B-11 à B-15

| ID | Correctif | Cause racine | Référence |
|----|-----------|--------------|-----------|
| **B-11** | Routage same-origin de l'API : l'API est routée aussi sous le domaine racine (`konfiturgame.fr/v1`) et `_APP_DOMAIN` pointe sur la racine | Appwrite scellait le cookie de session sur `.api.konfiturgame.fr`, invisible du rendu serveur exécuté sur `konfiturgame.fr` → boucle de connexion infinie | PR #55, #58, #60, #63 |
| **B-12** | Priorités explicites sur les routeurs Traefik du chemin `/v1` | La priorité par défaut de Traefik est la longueur de la règle : le routeur catch-all du frontend est plus long et gagnait, renvoyant un 404 sur `/v1` | `ee44986` |
| **B-13** | Suppression de `middleware.ts` au profit de `proxy.ts` | Next 16 a renommé la convention du middleware Edge ; la présence des deux fichiers fait échouer le build | `ad23d40`, `548b76f` |
| **B-14** | `Cache-Control: no-cache` sur les documents HTML, `/_next/*` exclu | Next sert les pages prérendues avec `s-maxage=31536000`, destiné à un CDN absent ici : le navigateur resservait un HTML référençant des chunks JS aux hash disparus → écran blanc | `0f86efa` |
| **B-15** | User-Agent de navigateur pour le healthcheck de la CI | Notre détection de bots bloque `curl/` : le healthcheck échouait sur un site pourtant sain | `d6a70f1` |

### Nouveautés

- Mise en production sur VPS OVH (Debian 12) : TLS Let's Encrypt, HSTS, en-têtes de
  sécurité, limitation de débit
- Correction de l'identifiant de projet Appwrite dans la configuration de déploiement
- `scripts/ci/prod-config-check.sh` ajouté comme job bloquant : vérifie à chaque pull
  request que les middlewares référencés existent, que la CSP ne pointe pas vers une
  adresse locale et que toute variable du compose est documentée

### Vérification

Cahier de recettes validé en production le 21/07/2026 :

| Contrôle | Résultat |
|----------|----------|
| Frontend | `https://konfiturgame.fr` → **200** |
| Redirection TLS | `http://` → **308** vers HTTPS |
| HSTS | `max-age=31536000; includeSubDomains; preload` |
| API Appwrite | `/v1/health/version` → `{"version":"1.9.0"}` |
| Routage same-origin | `/v1/account` → **401** (atteint Appwrite, plus le 404 Next.js d'avant B-11) |
| Dashboard Traefik | **401** sans authentification |

### Anomalies connues à la livraison

- **R-05** — l'upload d'avatar est documenté comme livré alors qu'il n'est pas implémenté.
  Écart de périmètre et non défaut de fonctionnement : le bucket `avatars` et le champ
  `avatar_url` existent, mais aucune action d'upload. Arbitré avec le commanditaire →
  implémentation priorisée
- **R-01 à R-03** — instabilités de la suite end-to-end (assertions jouées avant
  stabilisation du client). Chaque fonctionnalité concernée a été observée conforme dans
  au moins une des deux campagnes

---

## v0.9.0 — 2026-07-16 → 2026-07-19 — Équipes, tchat privé et fiabilité des listes

### Nouveautés

- **Tchat privé d'équipe** : table `team_chat_messages` en row security, permission de
  lecture accordée par membre à l'envoi, épinglage et signalement, modération admin dédiée
- **Guildes** : pages hub et vitrine (`/dashboard/teams`, `/team/[teamId]`), code
  d'invitation jamais exposé publiquement
- **Inscriptions solo** : équipe solo unique par utilisateur, réutilisée entre les jams,
  désinscription possible avant le début de la jam
- Dashboards administrateur et utilisateur enrichis, journaux filtrables, modération
  actionnable, superpouvoirs admin journalisés

### Correctifs

- **Plafonds silencieux Appwrite** : `listDocuments` tronquait à 25 documents sans erreur.
  Helpers `fetchAllDocs` / `fetchAllByField` et pattern `LoadMoreList` (curseur, jamais
  d'offset)
- Fuite du code d'invitation d'équipe sur la page de jam, colmatée
- Permission de création côté client retirée sur `chat_messages`

### Tests

Suite unitaire portée de 196 à **354 tests** sur 26 fichiers.

---

## v0.5.0 — 2026-04 → 2026-06 — Guildes multi-jam

### Nouveautés

- Migration du schéma des équipes vers le multi-jam (`jam_ids: string[]`), gestion des rôles
- Export RGPD des données personnelles (article 20)
- Vérification d'email à l'inscription, mot de passe oublié et réinitialisation

### Correctifs

- **B-08** — `Unknown attribute: devKeys` après la montée d'Appwrite en 1.8. Migration de
  schéma à lancer manuellement (`php cli.php migrate`), procédure documentée

---

## v0.4.0 — 2026-04 — Tests et référencement

### Nouveautés

- Harnais de tests Vitest avec couverture V8
- SEO : sitemap dynamique, `robots.txt`, données structurées JSON-LD

### Correctifs

- **B-01** — le validateur du nombre de participants acceptait une valeur non numérique
  (`Number(value)` renvoie `NaN` sans lever d'erreur). Contrôle explicite ajouté et tests
  de régression

---

## v0.3.0 — 2026-03 — Journalisation et modération

### Nouveautés

- Collection `audit_logs` (types `auth`, `error`, `connection`, `solo`, `admin_action`)
- Bannissement d'IP (collection `banned_ips`) et détection de bots dans le middleware
- Gestion du profil utilisateur, signalement de messages et de projets

---

## v0.2.0 — 2026-03 — Administration

### Nouveautés

- Panneau d'administration, dashboard utilisateur
- `scripts/backup.sh` et `scripts/restore.sh`
- Guide de déploiement en production

---

## v0.1.0 — 2026-03-04 → 2026-03-16 — Fondations

### Nouveautés

- Infrastructure Docker Compose, configuration Traefik (développement et production)
- Authentification par email, pages de base
- Design system (thème sombre tricolore)

### Anomalies connues

- OAuth Google et Discord non fonctionnel, callbacks incomplets — corrigé ultérieurement
  (**B-07** : les URL de redirection pointaient vers le domaine de production)

---

*KonfiturGame · Journal des versions · Mis à jour : 2026-08-01*
