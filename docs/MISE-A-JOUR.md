# KonfiturGame — Manuel de mise à jour

Procédures pour maintenir les dépendances, les services et le schéma à jour.

> **Règle générale :** toujours faire un backup avant toute mise à jour. Toujours tester en dev avant d'appliquer en prod.

---

## Table des matières

1. [Règles générales](#1-règles-générales)
2. [Dépendances npm (frontend)](#2-dépendances-npm-frontend)
3. [Mise à jour Next.js](#3-mise-à-jour-nextjs)
4. [Mise à jour Appwrite](#4-mise-à-jour-appwrite) — procédure complète, migration DB, bugs connus
5. [Mise à jour Traefik](#5-mise-à-jour-traefik)
6. [Mise à jour MariaDB et Redis](#6-mise-à-jour-mariadb-et-redis)
7. [Mise à jour du schéma Appwrite](#7-mise-à-jour-du-schéma-appwrite)
8. [Checklist post-mise à jour](#8-checklist-post-mise-à-jour)
9. [Rollback](#9-rollback)

---

## 1. Règles générales

### Avant toute mise à jour

```bash
# 1. Backup obligatoire
./scripts/backup.sh

# 2. Vérifier l'état actuel
docker compose ps
git status
```

### Versionnement

Toutes les versions sont épinglées dans `docker-compose.yml` et `frontend/package.json`. Ne jamais utiliser `:latest` en production — toujours épingler une version précise.

### Ordre de priorité des mises à jour

1. **Sécurité critique** — appliquer dans les 24h (CVE CVSS ≥ 9)
2. **Sécurité modérée** — appliquer dans la semaine
3. **Fonctionnelle / bug fix** — appliquer au prochain sprint
4. **Minor / cosmétique** — regrouper avec d'autres mises à jour

### Où trouver les nouvelles versions

| Composant | Source |
|-----------|--------|
| Next.js | [github.com/vercel/next.js/releases](https://github.com/vercel/next.js/releases) |
| Appwrite | [github.com/appwrite/appwrite/releases](https://github.com/appwrite/appwrite/releases) |
| Traefik | [github.com/traefik/traefik/releases](https://github.com/traefik/traefik/releases) |
| SDK appwrite (npm) | [npmjs.com/package/appwrite](https://www.npmjs.com/package/appwrite) |
| SDK node-appwrite | [npmjs.com/package/node-appwrite](https://www.npmjs.com/package/node-appwrite) |
| MariaDB | [hub.docker.com/_/mariadb](https://hub.docker.com/_/mariadb) |
| Redis | [hub.docker.com/_/redis](https://hub.docker.com/_/redis) |

---

## 2. Dépendances npm (frontend)

### Voir les dépendances obsolètes

```bash
# Dans le container (node_modules disponibles uniquement là)
docker exec konfitur-frontend sh -c "cd /app && pnpm outdated"

# Ou depuis l'hôte si pnpm est installé
cd frontend && pnpm outdated
```

### Audit de sécurité

```bash
docker exec konfitur-frontend sh -c "cd /app && pnpm audit"
# → liste les CVE avec leur sévérité
```

Le CI/CD exécute ce check automatiquement à chaque push (job `Audit dépendances`, non bloquant).

### Mettre à jour une dépendance précise

```bash
# Dans le container
docker exec konfitur-frontend sh -c "cd /app && pnpm update <package>@<version>"

# Sur l'hôte (WSL2 — attention à l'EACCES)
# Si erreur EACCES, générer le lockfile dans /tmp :
mkdir -p /tmp/pnpm-gen && cp frontend/package.json /tmp/pnpm-gen/
# Éditer /tmp/pnpm-gen/package.json avec la nouvelle version
docker run --rm -v /tmp/pnpm-gen:/app -w /app node:20-alpine \
  sh -c "corepack enable pnpm && pnpm install --no-frozen-lockfile"
cp /tmp/pnpm-gen/pnpm-lock.yaml frontend/
```

### Mettre à jour toutes les dépendances (patch uniquement)

```bash
docker exec konfitur-frontend sh -c "cd /app && pnpm update"
# Applique uniquement les patches (x.y.Z → x.y.Z+1)
# Ne touche pas aux versions majeures ni mineures
```

### Après une mise à jour des dépendances

```bash
# Type-check
docker exec konfitur-frontend sh -c "cd /app && pnpm type-check"

# Tests
docker exec konfitur-frontend sh -c "cd /app && npx vitest run"

# Build complet
docker exec konfitur-frontend sh -c "cd /app && pnpm build"
```

### Cas particulier : overrides pnpm (sécurité)

Si un audit signale une CVE dans une dépendance transitive (non directe), utiliser les overrides dans `frontend/package.json` :

```json
{
  "pnpm": {
    "overrides": {
      "vulnerable-package": ">=fixed-version"
    }
  }
}
```

Les overrides actuels sont dans `frontend/package.json` → section `pnpm.overrides`.

---

## 3. Mise à jour Next.js

**Version actuelle :** 16.2.12

### Mise à jour mineure ou patch (16.x.y → 16.x.z)

Risque faible — comportement stable.

```bash
# 1. Éditer frontend/package.json → "next": "16.x.z"

# 2. Regénérer le lockfile
mkdir -p /tmp/pnpm-gen && cp frontend/package.json /tmp/pnpm-gen/
docker run --rm -v /tmp/pnpm-gen:/app -w /app node:20-alpine \
  sh -c "corepack enable pnpm && pnpm install --no-frozen-lockfile"
cp /tmp/pnpm-gen/pnpm-lock.yaml frontend/

# 3. Rebuild du container
docker compose up -d --build frontend

# 4. Vérifier
docker compose logs -f frontend
curl -I http://localhost:3000
```

### Points d'attention hérités du passage à Next 16

- **Convention middleware renommée `middleware.ts` → `proxy.ts`.** Depuis Next 16, le
  middleware Edge est le fichier `src/proxy.ts` (export `proxy`). **Ne pas** recréer un
  `src/middleware.ts` : Next détecte alors les deux et **fait échouer le build**
  (`Both middleware file and proxy file are detected`). Toute la logique (bot-detection,
  ban IP, protection de routes) vit dans `proxy.ts`.
- **Cache navigateur des pages prérendues (`Cache-Control`).** Next sert les pages
  statiques avec `s-maxage=31536000`, une directive destinée à un **CDN**. Sans CDN
  (ici uniquement Traefik), le navigateur — Safari en particulier — met le HTML en cache
  par heuristique et, après un redeploy, référence des chunks JS aux hash disparus →
  **écran blanc / boutons morts**. Le correctif est dans `frontend/next.config.mjs` :
  `headers()` force `Cache-Control: no-cache` sur les documents (revalidation via ETag),
  `/_next/*` restant exclu pour garder les chunks immutables. **À conserver** lors des
  montées de version (issue #65).

### Mise à jour majeure (16.x → 17.x)

Risque élevé — lire le changelog et le guide de migration Next.js.

Points d'attention spécifiques à ce projet :
- **App Router** : vérifier les breaking changes sur les Server Components, Server Actions, middlewares
- **`proxy.ts`** : vérifier la compatibilité du middleware Edge (renommé depuis `middleware.ts` en Next 16) avec le nouveau runtime
- **`next.config.mjs`** : conserver l'override `Cache-Control: no-cache` (voir ci-dessus)
- **Images** : le comportement du composant `<Image>` peut évoluer

Procédure :
```bash
# 1. Lire le CHANGELOG et le guide de migration officiel Next.js
# 2. Tester en dev avec le nouveau Dockerfile.dev
# 3. Corriger les erreurs TypeScript (pnpm type-check)
# 4. Vérifier les tests (npx vitest run)
# 5. Build de prod (pnpm build) — doit passer sans erreur
# 6. Tester manuellement le cahier de recettes §Module 1-5
# 7. Déployer en prod (CI/CD ou manuellement)
```

---

## 4. Mise à jour Appwrite

**Version actuelle :** 1.9.0 (server) + `appwrite-cli@17.3.1` (local)

> **Critique :** toujours consulter les notes de migration Appwrite avant de mettre à jour. La migration de schéma est **obligatoire** et peut nécessiter des corrections manuelles en base de données.

### Compatibilité CLI ↔ serveur

La CLI Appwrite envoie un header `X-Appwrite-Response-Format: <version>` — une CLI mauvaise version provoque des erreurs "Route not found" ou pousse des attributs inexistants.

| Appwrite Server | CLI locale (`npm install -g`) | SDK `appwrite` (npm) | SDK `node-appwrite` |
|-----------------|-------------------------------|---------------------|---------------------|
| 1.9.0 | `appwrite-cli@17.3.1` | 17.x | 15.x (environ) |
| 1.9.5 | `appwrite-cli@22.x` | — | — |

Pour vérifier la version installée : `appwrite --version`

### Services requis dans docker-compose.yml

Depuis Appwrite 1.9.0, plusieurs workers supplémentaires sont nécessaires. Sans eux, les fonctions ne se déploient pas et les mails ne partent pas.

| Service | Entrypoint | Rôle |
|---------|-----------|------|
| `appwrite` | *(main)* | API HTTP |
| `appwrite-console` | *(image `appwrite/console`)* | **Console web** (image séparée depuis 1.9, servie sur `/console`) |
| `appwrite-realtime` | `realtime` | WebSocket temps réel |
| `appwrite-worker-databases` | `worker-databases` | Création d'attributs et indexes |
| `appwrite-worker-mails` | `worker-mails` | Envoi SMTP |
| `appwrite-worker-builds` | `worker-builds` | **Compilation des fonctions** (nouveau en 1.9) |
| `appwrite-worker-functions` | `worker-functions` | **Exécution des fonctions** (cron, triggers) |
| `appwrite-executor` | *(openruntimes)* | **Sandbox d'exécution** (image séparée) |

Variables obligatoires à ajouter dans tous les services qui touchent aux fonctions :
```yaml
- _APP_EXECUTOR_HOST=http://exc1/v1       # hostname fixe de l'executor
- _APP_EXECUTOR_SECRET=${APPWRITE_EXECUTOR_SECRET}
- _APP_FUNCTIONS_RUNTIMES=node-20.0
```

Variable obligatoire sur le service `appwrite` pour que le SSR fonctionne (voir Bugs connus ci-dessous) :
```yaml
- _APP_MIGRATION_HOST=appwrite            # hostname Docker interne reconnu par le routeur
```

### Procédure de mise à jour pas à pas

```bash
# ── Étape 1 : Backup OBLIGATOIRE ────────────────────────────────────────
./scripts/backup.sh

# ── Étape 2 : Lire les notes de release ────────────────────────────────
# https://github.com/appwrite/appwrite/releases
# Vérifier : nouveaux services requis ? nouveaux paramètres env ? breaking changes SDK ?

# ── Étape 3 : Mettre à jour les tags dans docker-compose.yml ───────────
# Remplacer TOUTES les occurrences de l'ancien tag :
# appwrite/appwrite:1.9.0 → appwrite/appwrite:x.y.z
# (appwrite, appwrite-realtime, tous les workers)
# Vérifier aussi l'image de l'executor : openruntimes/executor:x.y.z

# ── Étape 4 : Vérifier les nouvelles variables d'environnement ──────────
# Chaque release peut introduire de nouveaux paramètres _APP_*.
# Comparer le docker-compose.yml officiel de la release cible avec le nôtre.
# Source : https://github.com/appwrite/appwrite/blob/x.y.z/docker-compose.yml

# ── Étape 5 : Tirer les nouvelles images ────────────────────────────────
docker compose pull appwrite appwrite-realtime \
  appwrite-worker-databases appwrite-worker-mails \
  appwrite-worker-builds appwrite-worker-functions

# ── Étape 6 : Redémarrer tous les services Appwrite ─────────────────────
docker compose up -d appwrite appwrite-realtime \
  appwrite-worker-databases appwrite-worker-mails \
  appwrite-worker-builds appwrite-worker-functions \
  appwrite-executor

# ── Étape 7 : Attendre le démarrage (~30-60s) ───────────────────────────
docker compose logs -f appwrite | grep -i "ready\|started\|error"

# ── Étape 8 : MIGRATION DE BASE DE DONNÉES — OBLIGATOIRE ────────────────
docker exec konfitur-appwrite php /usr/src/code/app/cli.php migrate
# Durée : 1-5 minutes selon la taille de la base
# Les "Warning: Failed to delete index..." sont normaux (non bloquants)
# Attendre "Migration completed successfully" à la fin

# ── Étape 9 : Vider le cache Redis ──────────────────────────────────────
# Obligatoire après migration — le cache peut contenir des schémas obsolètes
docker exec konfitur-redis redis-cli FLUSHALL

# ── Étape 10 : Redémarrer Appwrite pour recharger les métadonnées ────────
docker compose restart appwrite appwrite-worker-builds appwrite-worker-functions

# ── Étape 11 : Vérifier les erreurs ─────────────────────────────────────
docker compose logs appwrite --since=2m | grep -i "error\|exception" | grep -v "password"
curl https://api.konfiturgame.fr/v1/health/version   # → doit renvoyer la nouvelle version

# ── Étape 12 : Pousser la config Appwrite (buckets, fonctions) ───────────
appwrite push buckets
appwrite push functions
```

### Bugs connus après migration (apparus en 1.8→1.9)

#### SSR cassé — 401 "router" sur les Server Actions

Après la migration 1.9, les appels internes du frontend (réseau Docker, `http://appwrite/v1`) peuvent être rejetés en 401 par le routeur Appwrite : le hostname interne `appwrite` n'est plus reconnu.

**Fix :** ajouter `_APP_MIGRATION_HOST=appwrite` dans l'`environment:` du service `appwrite` (c'est cette variable qui réinjecte le hostname dans la liste des hôtes autorisés — pas `_APP_ROUTER_PROTECTION`), puis `docker compose up -d appwrite`.

#### Attributs manquants dans les métadonnées SQL

Après une mise à jour majeure, Appwrite peut avoir des **attributs manquants dans les métadonnées SQL** — le code PHP attend un champ qui n'a pas été ajouté par la migration. Constaté en 1.8→1.9 sur les tables `_console_buckets`, `_1_buckets` et `_console_rules` (transformations absentes du script de migration). Symptômes :

- `Unknown attribute: "xyz"` → attribut présent dans le PHP mais absent du JSON de métadonnées
- `Invalid query: Attribute not found in schema: type` → même cause, mais au niveau d'une query (pas d'insertion)

**Diagnostic :**
```bash
# Voir l'erreur exacte dans les logs
docker logs konfitur-appwrite --since=1m 2>&1 | grep -A5 "Exception\|500"

# Identifier la table concernée (exemple : _console_buckets, _1_buckets, _console_rules)
docker exec konfitur-mariadb sh -c \
  'mysql -u root -p"$MYSQL_ROOT_PASSWORD" appwrite -e "DESCRIBE _console_buckets;" 2>/dev/null'
```

**Correction si un attribut manque dans les métadonnées JSON** (table `_1__metadata` ou `_console__metadata`) :
```bash
# 1. Extraire le JSON actuel
docker exec konfitur-mariadb sh -c \
  'mysql -u root -p"$MYSQL_ROOT_PASSWORD" appwrite \
   -e "SELECT attributes FROM _1__metadata WHERE _uid = \"buckets\";" \
   --skip-column-names 2>/dev/null' > /tmp/attrs.json

# 2. Ajouter l'attribut manquant avec Python (évite les problèmes d'échappement shell)
python3 -c "
import json
with open('/tmp/attrs.json') as f:
    attrs = json.loads(f.read().strip())
attrs.append({'\\$id':'xyz','type':'string','size':255,'required':False,
              'signed':True,'array':False,'filters':[],'default':None,'format':''})
sql = \"UPDATE _1__metadata SET attributes='\" + json.dumps(attrs, separators=(',',':')) + \"', _updatedAt=NOW(3) WHERE _uid='buckets';\"
with open('/tmp/fix.sql','w') as f:
    f.write(sql)
"
docker cp /tmp/fix.sql konfitur-mariadb:/tmp/fix.sql
docker exec konfitur-mariadb sh -c \
  'mysql -u root -p"$MYSQL_ROOT_PASSWORD" appwrite < /tmp/fix.sql 2>/dev/null'

# 3. Si la colonne SQL est aussi absente, l'ajouter
docker exec konfitur-mariadb sh -c \
  'mysql -u root -p"$MYSQL_ROOT_PASSWORD" appwrite \
   -e "ALTER TABLE _1_buckets ADD COLUMN xyz varchar(255) DEFAULT NULL;" 2>/dev/null'

# 4. Vider le cache et redémarrer
docker exec konfitur-redis redis-cli FLUSHALL
docker compose restart appwrite
```

> Cette procédure de correction (extraction JSON → ajout de l'attribut via Python → `ALTER TABLE` si besoin → flush Redis) est celle appliquée lors de la migration 1.8→1.9. La conserver comme référence pour les prochaines migrations majeures.

### Mettre à jour les SDKs en même temps

```bash
# Éditer frontend/package.json avec les nouvelles versions SDK
# Regénérer le lockfile (voir §2)
# Vérifier les breaking changes du SDK dans le CHANGELOG npm
# Corriger les usages dépréciés dans src/lib/appwrite/
```

### Mettre à jour l'Appwrite CLI (CI/CD et local)

- **Local :** `npm install -g appwrite-cli@<version-compatible-serveur>` (voir tableau de compatibilité ci-dessus)
- **CI/CD :** dans `.github/workflows/ci-cd.yml`, chercher `appwrite-cli@` et mettre à jour la version.

---

## 5. Mise à jour Traefik

**Version actuelle :** v3.6.7

Traefik est relativement stable — les mises à jour de patch sont généralement transparentes.

```bash
# 1. Modifier le tag dans docker-compose.yml
# traefik:v3.6.7 → traefik:v3.x.y

# 2. Tirer la nouvelle image
docker compose -f docker-compose.yml pull traefik

# 3. Redémarrer
docker compose -f docker-compose.yml up -d traefik

# 4. Vérifier les logs
docker compose logs traefik --tail=30

# 5. Vérifier que les certificats TLS sont toujours valides
curl -I https://konfiturgame.fr | grep -i "strict-transport"
```

### Mise à jour majeure (v3 → v4)

Risque élevé — la syntaxe des middlewares et des labels Docker peut changer. Points à vérifier :
- `traefik/dynamic/middlewares.yml` — syntaxe des middlewares
- `traefik/traefik.yml` et `traefik.dev.yml` — config statique
- Labels Traefik dans `docker-compose.yml` et `docker-compose.override.yml`

---

## 6. Mise à jour MariaDB et Redis

**Versions actuelles :** MariaDB 10.11, Redis 7-alpine

> Ces composants sont des dépendances internes d'Appwrite. Vérifier la compatibilité avec la version d'Appwrite cible avant de les mettre à jour.

### MariaDB

```bash
# 1. Backup OBLIGATOIRE (les volumes MariaDB contiennent toutes les données)
./scripts/backup.sh

# 2. Modifier le tag dans docker-compose.yml
# mariadb:10.11 → mariadb:10.11.x (ou mariadb:11.x si compatible Appwrite)

# 3. Arrêter MariaDB proprement
docker compose stop mariadb

# 4. Tirer la nouvelle image
docker compose pull mariadb

# 5. Redémarrer
docker compose -f docker-compose.yml up -d mariadb

# 6. Vérifier
docker compose logs mariadb --tail=30
```

> Ne jamais sauter de version majeure MariaDB (10.11 → 11.x) sans tester d'abord un dump/restore.

### Redis

Redis est utilisé uniquement comme cache et bus d'événements. Les données ne sont pas persistées entre redémarrages (pas de volume dédié pour les données Redis). La mise à jour est donc moins risquée.

```bash
docker compose pull redis
docker compose -f docker-compose.yml up -d redis
```

---

## 7. Schéma et fonctions Appwrite via `appwrite.json`

`appwrite.json` (racine du repo) est la **source de vérité** pour toute la configuration Appwrite versionnée. Le principe : modifier via la console Appwrite → capturer dans `appwrite.json` → committer → déployer (CLI ou CI).

### État actuel des phases

| Phase | Ressource | État | Déploiement |
|-------|-----------|------|-------------|
| Phase 1 | Fonctions (`functions/**`) | Actif | CI — push `main` |
| Phase 2 | Tables / Schéma (10 collections) | **Capturé dans `appwrite.json`** | CI — push `main` (job `deploy-schema`, si `appwrite.json` modifié) |
| Phase 3 | Buckets + Teams | **Capturés dans `appwrite.json`** | Manuel (`appwrite push buckets` / `push teams`) |

### Commandes CLI — migrations de schéma

> CLI compatible serveur obligatoire (voir tableau §4). Pour Appwrite 1.9.0 : `npm install -g appwrite-cli@17.3.1`. Depuis la CLI 17+, `pull/push collections` est **déprécié** au profit de `pull/push tables`.

```bash
# Configurer le client (une fois)
appwrite client \
  --endpoint https://api.konfiturgame.fr/v1 \
  --project-id 69b1a2b500083affc894 \
  --key "$APPWRITE_API_KEY"

# Capturer l'état du serveur → appwrite.json
appwrite pull tables        # schéma des collections
appwrite pull buckets       # buckets Storage
appwrite pull teams         # teams (admins)
appwrite pull functions     # config des fonctions

# Appliquer appwrite.json → serveur
appwrite push tables --force
appwrite push buckets
appwrite push teams
appwrite push functions --force

# Tout pousser d'un coup
appwrite push all
```

> Ne pas confondre avec la migration de **version** du serveur (`docker exec konfitur-appwrite php /usr/src/code/app/cli.php migrate`) documentée au §4 — celle-ci migre la structure interne d'Appwrite lors d'une montée de version, pas le schéma applicatif.

---

### Modifier ou ajouter une fonction

Le code des fonctions est dans `functions/<id>/src/`. La déclaration (schedule, runtime, timeout…) est dans `appwrite.json → functions[]`.

```bash
# Modifier une fonction existante
# 1. Éditer functions/update-jam-status/src/main.js
# 2. Commit + push sur main → CI déploie automatiquement (job deploy-functions)
```

**Ajouter une nouvelle fonction :**

```bash
# 1. Créer la structure
mkdir -p functions/<function-id>/src
# Créer functions/<function-id>/src/main.js et package.json

# 2. Ajouter l'entrée dans appwrite.json → tableau "functions"
```

```json
{
  "$id": "<function-id>",
  "name": "<Nom lisible>",
  "runtime": "node-20.0",
  "path": "functions/<function-id>",
  "entrypoint": "src/main.js",
  "commands": "npm install",
  "schedule": "",
  "timeout": 30,
  "enabled": true,
  "logging": true,
  "execute": [],
  "scopes": []
}
```

```bash
# 3. Commit + push sur main → CI déploie automatiquement
```

**Déploiement manuel (sans CI) :**

```bash
appwrite push functions --force
```

---

### Modifier le schéma (workflow `appwrite.json`)

#### Ajouter un attribut à une collection existante

1. Ajouter l'attribut dans la console Appwrite (Databases → collection → Attributes)
2. Attendre que le statut passe de `processing` à `available`
3. Capturer : `appwrite pull tables` puis `git diff appwrite.json`
4. Mettre à jour les types TypeScript :
   - `frontend/src/lib/appwrite/types.ts` — mapper Appwrite → type TS
   - `frontend/src/types/index.ts` — interface TypeScript
5. Mettre à jour `docs/DATABASE.md`
6. `pnpm type-check` + tests

#### Ajouter une nouvelle collection

1. Créer la collection dans la console Appwrite avec les attributs et permissions
2. Capturer : `appwrite pull tables` puis `git diff appwrite.json`
3. Ajouter la constante dans `frontend/src/lib/appwrite/config.ts`
4. Ajouter le mapper dans `frontend/src/lib/appwrite/types.ts`
5. Ajouter les Server Actions dans `frontend/src/lib/actions/`
6. Mettre à jour `docs/DATABASE.md`

> `scripts/seed-data.sh` reste utile pour insérer des **données de test** — le schéma, lui, vit dans `appwrite.json`.

---

### Job CI `deploy-schema` (déploiement automatique du schéma)

> **Activé le 2026-07-14** dans `ci-cd.yml`. La CI pousse le schéma (`appwrite push tables --force`) à chaque push sur `main` modifiant `appwrite.json`.

Prérequis opérationnel restant (à faire une fois si pas déjà fait) :

```bash
# 1. Étendre la clé API CI pour inclure le schéma
# Console → API Keys → clé CI → ajouter : databases.read + databases.write

# 2. Mettre à jour le secret GitHub
gh secret set APPWRITE_API_KEY --body "<nouvelle-clé-avec-scopes-databases>"
```

**Après activation :** ne plus modifier le schéma directement dans la console sans répercuter dans `appwrite.json` (workflow : console → `appwrite pull tables` → `git diff` → commit → push `main` → CI déploie).

---

## 8. Checklist post-mise à jour

À exécuter après toute mise à jour avant de considérer le déploiement terminé.

### Tests techniques

```bash
# Type-check
docker exec konfitur-frontend sh -c "cd /app && pnpm type-check"
# → 0 erreur

# Tests unitaires
docker exec konfitur-frontend sh -c "cd /app && npx vitest run"
# → tous passent

# Tests end-to-end (infra Docker complète requise — voir docs/DOC_test_E2E.md)
cd frontend && pnpm e2e
# → tous passent

# Build de prod
docker exec konfitur-frontend sh -c "cd /app && pnpm build"
# → succès sans erreur
```

### Vérifications infrastructure (prod)

```bash
curl -s -o /dev/null -w '%{http_code}' https://konfiturgame.fr        # → 200
curl -s https://api.konfiturgame.fr/v1/health/version | grep '"version"' # → ok (health complet : clé API requise)
curl -I https://konfiturgame.fr | grep strict-transport                # → présent
docker compose ps                                                        # → tous "Up"
```

### Tests fonctionnels (smoke)

Exécuter au minimum les scénarios bloquants du cahier de recettes (`CAHIER-DE-RECETTES.md`) :
- Scénario 1.1 (inscription)
- Scénario 1.2 (connexion + protection routes)
- Scénario 5.1 étape 4 (chat temps réel)
- Scénario 2.1 (page d'accueil)

---

## 9. Rollback

### Rollback d'une mise à jour Docker (Appwrite, Traefik, MariaDB)

```bash
# Remettre l'ancien tag dans docker-compose.yml
# puis :
docker compose -f docker-compose.yml up -d [service]
```

### Rollback avec restauration de données (si schéma migré)

```bash
# Arrêter les services
docker compose down

# Restaurer le backup pré-mise à jour
./scripts/restore.sh ./backups/YYYY-MM-DD_HH-MM
# → mode 1 (MariaDB + volumes)

# Remettre les anciens tags dans docker-compose.yml
# puis redémarrer
docker compose -f docker-compose.yml up -d
```

### Rollback frontend (via git)

```bash
# Sur le VPS
cd /opt/konfiturgame
git log --oneline -5
git reset --hard <commit-avant-mise-a-jour>
docker compose -f docker-compose.yml build frontend
docker compose -f docker-compose.yml up -d frontend
```

Après un rollback git, le prochain `git pull --ff-only` de la CI échouera. Une fois le fix mergé sur `main` :
```bash
git reset --hard origin/main
```

### Rollback d'une mise à jour de dépendance npm

```bash
# Remettre l'ancienne version dans frontend/package.json
# Regénérer le lockfile (voir §2)
# Rebuild le container
docker compose -f docker-compose.yml up -d --build frontend
```

---

## Versions de référence (2026-07-14)

| Composant | Version actuelle | Fichier de référence |
|-----------|-----------------|---------------------|
| Next.js | 16.2.12 | `frontend/package.json` |
| SDK `appwrite` (npm) | 23.0.0 | `frontend/package.json` |
| SDK `node-appwrite` (npm) | 22.1.3 | `frontend/package.json` |
| Playwright (`@playwright/test`) | 1.50.x | `frontend/package.json` |
| Appwrite server | 1.9.0 | `docker-compose.yml` |
| Appwrite console | 7.5.7 | `docker-compose.yml` |
| Appwrite CLI (local) | 17.3.1 | — (`npm install -g appwrite-cli@17.3.1`) |
| openruntimes/executor | 0.11.4 | `docker-compose.yml` |
| Traefik | v3.6.7 | `docker-compose.yml` |
| MariaDB | 10.11 | `docker-compose.yml` |
| Redis | 7-alpine | `docker-compose.yml` |
| ClamAV | 1.4 | `docker-compose.yml` |
| Node.js (build) | 20-alpine | `frontend/Dockerfile` |

---

*KonfiturGame · Manuel de mise à jour · Mis à jour : 2026-07-14*
