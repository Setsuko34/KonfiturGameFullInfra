# KonfiturGame — Manuel de déploiement

Pas à pas pour déployer l'infrastructure complète, la maintenir et la migrer d'un serveur à un autre.

---

## Table des matières

1. [Architecture des services](#1-architecture-des-services)
2. [Prérequis serveur](#2-prérequis-serveur)
3. [Déploiement initial](#3-déploiement-initial)
4. [Configuration Appwrite](#4-configuration-appwrite)
5. [Configuration OAuth (Google & Discord)](#5-configuration-oauth-google--discord)
6. [Vérifications finales](#6-vérifications-finales)
7. [Mises à jour](#7-mises-à-jour)
8. [Sauvegardes](#8-sauvegardes)
9. [Restauration](#9-restauration)
10. [Migrer d'un serveur à un autre](#10-migrer-dun-serveur-à-un-autre)
11. [Maintenance Appwrite](#11-maintenance-appwrite)
12. [Dépannage production](#12-dépannage-production)
13. [Variables d'environnement](#13-variables-denvironnement)

---

## 1. Architecture des services

```
Internet
   │
   ▼
Traefik v3.6.7 (ports 80 / 443)
   ├── konfiturgame.fr          → Frontend Next.js 16.2.9 :3000
   ├── api.konfiturgame.fr      → Appwrite 1.9.0 (API + Realtime)
   │      └── /console          → appwrite-console 7.5.7 (image séparée depuis 1.9)
   └── traefik.konfiturgame.fr  → Dashboard Traefik (Basic Auth)
         │
         ├── appwrite ──► MariaDB 10.11  (appwrite-net)
         ├── appwrite ──► Redis 7        (appwrite-net)
         ├── appwrite ──► ClamAV 1.4     (scan antivirus des uploads)
         └── workers  ──► databases · mails · builds · functions
                          + appwrite-executor 0.11.4 (sandbox fonctions)
```

**Réseaux Docker :**
- `konfitur-net` — Traefik ↔ Frontend ↔ Appwrite
- `appwrite-net` — Appwrite ↔ workers ↔ MariaDB ↔ Redis (isolé, non exposé à Traefik)

---

## 2. Prérequis serveur

| Élément | Minimum recommandé |
|---|---|
| OS | Ubuntu 22.04 LTS ou Debian 12 |
| RAM | 4 Go (8 Go recommandés) |
| CPU | 2 vCPU |
| Disque | 40 Go SSD |
| Docker | ≥ 24.x |
| Docker Compose | ≥ 2.x (plugin v2) |
| Ports ouverts | 80, 443 |
| Outils | `curl`, `jq`, `git`, `apache2-utils` |

```bash
# Installer Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Outils
sudo apt install -y curl jq git apache2-utils
```

---

## 3. Déploiement initial

### 3.1 — DNS

Pointer les enregistrements A vers l'IP du serveur :

```
konfiturgame.fr         A   <IP_SERVEUR>
www.konfiturgame.fr     A   <IP_SERVEUR>
api.konfiturgame.fr     A   <IP_SERVEUR>
traefik.konfiturgame.fr A   <IP_SERVEUR>
```

> Attendre la propagation DNS avant de démarrer — sinon Let's Encrypt échoue.
> Vérifier : `dig konfiturgame.fr +short`

### 3.2 — Cloner le dépôt

```bash
git clone git@github.com:Setsuko34/KonfiturGameFullInfra.git /opt/konfiturgame
cd /opt/konfiturgame
```

### 3.3 — Permissions Traefik ACME

```bash
mkdir -p traefik/acme
touch traefik/acme/acme.json
chmod 600 traefik/acme/acme.json
```

> **Critique :** Si `acme.json` n'est pas en `chmod 600`, Traefik refuse de démarrer.

### 3.4 — Fichier `.env`

```bash
cp .env.example .env
nano .env
```

| Variable | Valeur / commande de génération |
|---|---|
| `DOMAIN` | `konfiturgame.fr` |
| `ADMIN_EMAIL` | Email valide pour Let's Encrypt |
| `APPWRITE_PROJECT_ID` | `konfitur-game` (fixé une fois pour toutes) |
| `APPWRITE_API_KEY` | Généré dans la console Appwrite (étape 4) |
| `APPWRITE_OPENSSL_KEY` | `openssl rand -hex 32` |
| `MARIADB_ROOT_PASSWORD` | `openssl rand -base64 32` |
| `MARIADB_PASSWORD` | `openssl rand -base64 32` |
| `SMTP_HOST` | ex. `smtp.postmarkapp.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | Identifiant SMTP |
| `SMTP_PASS` | Mot de passe SMTP |
| `TRAEFIK_DASHBOARD_AUTH` | Voir §3.5 |
| `NEXT_PUBLIC_SITE_URL` | `https://konfiturgame.fr` |
| `LOG_INTERNAL_SECRET` | `openssl rand -hex 32` |

### 3.5 — Mot de passe du dashboard Traefik

```bash
# Générer un hash bcrypt
htpasswd -nB admin MonMotDePasse
# Sortie : admin:$2y$05$xxxxx...
# Copier dans .env → TRAEFIK_DASHBOARD_AUTH=admin:$2y$05$xxx...
```

### 3.6 — Mettre à jour middlewares.yml

Éditer `traefik/dynamic/middlewares.yml` — deux choses à adapter manuellement :

```yaml
# Hash de l'authentification dashboard
auth-dashboard:
  basicAuth:
    users:
      - "admin:$2y$05$VOTRE_HASH_ICI"
```

```yaml
# CSP — mettre le vrai domaine (Traefik file provider ne substitue pas les vars d'env)
connect-src 'self' https://api.konfiturgame.fr wss://api.konfiturgame.fr;
```

### 3.7 — Vérifier le lockfile frontend

```bash
ls frontend/pnpm-lock.yaml
```

Si absent :
```bash
docker run --rm -v "$(pwd)/frontend:/app" -w /app node:20-alpine \
  sh -c "corepack enable pnpm && pnpm install --no-frozen-lockfile"
```

### 3.8 — Démarrer les services

```bash
# Production : toujours spécifier le fichier (évite l'override dev)
docker compose -f docker-compose.yml up -d
```

Ordre de démarrage (géré par `depends_on`) :
1. `mariadb` + `redis`
2. `appwrite` + `appwrite-console` + `appwrite-realtime` + les workers (`databases`, `mails`, `builds`, `functions`) + `appwrite-executor` + `clamav`
3. `frontend`
4. `traefik` (en parallèle)

```bash
docker compose ps
docker compose logs traefik --tail=50
```

---

## 4. Configuration Appwrite

### 4.1 — Console

Ouvrir `https://api.konfiturgame.fr/console`. Créer le compte administrateur.

### 4.2 — Créer le projet

- Nom : `KonfiturGame`
- Project ID : `konfitur-game` (**doit correspondre à `APPWRITE_PROJECT_ID` dans `.env`**)

### 4.3 — Déclarer la plateforme web

Settings → Platforms → Add Platform → **Web** → Hostname : `konfiturgame.fr`

### 4.4 — `appwrite.json` — source de vérité IaC

`appwrite.json` (racine du repo) est le fichier de configuration de l'Appwrite CLI. Il décrit toute la configuration Appwrite versionnée dans Git — l'équivalent d'un `docker-compose.yml` pour les ressources Appwrite.

| Section | État actuel | Déploiement |
|---------|-------------|-------------|
| `functions` | `update-jam-status` (cron toutes les 5 min, node-20) | CI auto sur push `main` |
| `tables` | Capturé — 10 collections dans `appwrite.json` | CI auto sur push `main` si `appwrite.json` modifié (job `deploy-schema`, voir `CI-CD.md`) |
| `buckets` | Capturé — 4 buckets dans `appwrite.json` | `appwrite push buckets` manuel |
| `teams` | Capturé — team `admins` | `appwrite push teams` manuel |

### 4.5 — Installer et configurer l'Appwrite CLI

> **Version critique :** la CLI doit être compatible avec la version serveur — voir le tableau de compatibilité dans `MISE-A-JOUR.md §4`. Pour Appwrite 1.9.0 : `appwrite-cli@17.3.1`.

```bash
npm install -g appwrite-cli@17.3.1

appwrite client \
  --endpoint https://api.konfiturgame.fr/v1 \
  --project-id 69a19b8d00175f1d0b99 \
  --key "$APPWRITE_API_KEY"
```

### 4.6 — Déployer le schéma, les buckets et les teams

```bash
# Schéma (10 collections) — 'collections' est déprécié, utiliser 'tables'
appwrite push tables --force

# Buckets Storage (jam-covers 2 Mo, project-assets 10 Mo, project-builds 150 Mo, avatars 1 Mo)
appwrite push buckets

# Team admins (accès /admin)
appwrite push teams
```

Puis insérer les **données de test** (optionnel — le script crée aussi le schéma s'il manque, il est idempotent) :

```bash
chmod +x scripts/seed-data.sh
./scripts/seed-data.sh
```

### 4.7 — Déployer les fonctions Appwrite

Le CI déploie automatiquement les fonctions à chaque push sur `main` modifiant `appwrite.json` ou `functions/**`.

**Premier déploiement (avant que la CI ne soit configurée) :**

```bash
appwrite push functions --force
```

### 4.8 — Générer l'API Key

Settings → API Keys → **Create API Key** :

| Usage | Scopes minimaux |
|-------|----------------|
| Clé `.env` (backend Next.js) | `databases.read`, `databases.write`, `storage.read`, `storage.write`, `users.read`, `users.write` |
| Clé CI GitHub (`APPWRITE_API_KEY` secret) | `functions.read`, `functions.write`, `databases.read`, `databases.write` (requis par le job `deploy-schema`, voir `CI-CD.md`) |

Copier la clé backend dans `.env` → `APPWRITE_API_KEY`.
Clé CI → `gh secret set APPWRITE_API_KEY --body "<la-clé>"`.

### 4.9 — Redémarrer le frontend

```bash
docker compose -f docker-compose.yml restart frontend
```

---

## 5. Configuration OAuth (Google & Discord)

### Google Cloud Console

1. [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials → OAuth 2.0 Client IDs
2. Authorized redirect URIs → Add URI :
   ```
   https://api.konfiturgame.fr/v1/account/sessions/oauth2/callback/google/konfitur-game
   ```

### Discord Developer Portal

1. [discord.com/developers](https://discord.com/developers/applications) → app → OAuth2 → Redirects
2. Add Redirect :
   ```
   https://api.konfiturgame.fr/v1/account/sessions/oauth2/callback/discord/konfitur-game
   ```

### Activer dans Appwrite

Console → projet → Auth → Settings → OAuth2 Providers → coller Client ID + Secret pour chaque provider.

---

## 6. Vérifications finales

```bash
# TLS Let's Encrypt
curl -I https://konfiturgame.fr
# → HTTP/2 200 + strict-transport-security

# API Appwrite (endpoint public — /v1/health sans clé renvoie 401 depuis la 1.9)
curl https://api.konfiturgame.fr/v1/health/version
# → {"version":"1.9.0"}

# Healthcheck complet (nécessite une clé API avec scope health.read)
curl -H "X-Appwrite-Project: konfitur-game" -H "X-Appwrite-Key: $APPWRITE_API_KEY" \
  https://api.konfiturgame.fr/v1/health
# → {"status":"pass",...}

# Dashboard Traefik (authentification requise)
curl -I https://traefik.konfiturgame.fr/dashboard/
# → HTTP/2 401

# Test OAuth Google (doit rediriger vers accounts.google.com)
curl -Ls -o /dev/null -w '%{url_effective}' \
  "https://api.konfiturgame.fr/v1/account/sessions/oauth2/google?project=konfitur-game&success=https://konfiturgame.fr&failure=https://konfiturgame.fr/auth/login"
```

---

## 7. Mises à jour

> Voir `docs/MISE-A-JOUR.md` pour la procédure détaillée par composant.

### Frontend

```bash
cd /opt/konfiturgame
git pull
docker compose -f docker-compose.yml build frontend
docker compose -f docker-compose.yml up -d frontend
```

Le CI/CD effectue cette étape automatiquement sur push vers `main` si `frontend/**` est modifié.

### Appwrite

> **Ne pas improviser une montée de version Appwrite.** Depuis la 1.9, la procédure implique tous les workers, l'executor, la migration de base, le flush Redis et des corrections potentielles de métadonnées. Suivre la procédure complète pas à pas : **`MISE-A-JOUR.md §4`**.

Résumé (les détails sont dans MISE-A-JOUR.md) :

```bash
./scripts/backup.sh                                             # 1. Backup OBLIGATOIRE
# 2. Mettre à jour TOUS les tags d'images (appwrite, console, realtime, workers, executor)
# 3. docker compose pull + up -d des services Appwrite
docker exec konfitur-appwrite php /usr/src/code/app/cli.php migrate   # 4. Migration DB
docker exec konfitur-redis redis-cli FLUSHALL                   # 5. Flush cache
docker compose -f docker-compose.yml restart appwrite           # 6. Recharger les métadonnées
```

### Traefik

```bash
# Modifier le tag dans docker-compose.yml puis :
docker compose -f docker-compose.yml pull traefik
docker compose -f docker-compose.yml up -d traefik
```

---

## 8. Sauvegardes

### Manuel

```bash
./scripts/backup.sh
# → ./backups/YYYY-MM-DD_HH-MM/
# Contient : mariadb.sql, volumes Appwrite (uploads, config, functions, certificates), MANIFEST.txt
```

### Automatique (cron)

```bash
crontab -e
# Backup quotidien à 3h
0 3 * * * /opt/konfiturgame/scripts/backup.sh >> /var/log/konfiturgame-backup.log 2>&1
# Purge des backups > 30 jours
0 4 * * * find /opt/konfiturgame/backups -maxdepth 1 -type d -mtime +30 -exec rm -rf {} \;
```

### Transférer

```bash
tar -czf konfitur-backup-$(date +%Y%m%d).tar.gz ./backups/YYYY-MM-DD_HH-MM/
rsync -avz konfitur-backup-20260628.tar.gz user@nas:/backups/
```

---

## 9. Restauration

```bash
./scripts/restore.sh ./backups/2025-06-01_14-30
# → confirmation requise (choisir mode 1 : MariaDB + volumes)
docker compose -f docker-compose.yml up -d
curl https://api.konfiturgame.fr/v1/health/version
```

Ce que fait le script :
1. Démarre MariaDB + Redis uniquement
2. Attend que MariaDB accepte les connexions
3. Importe le dump SQL
4. Restaure les 4 volumes Appwrite
5. Affiche les prochaines étapes

---

## 10. Migrer d'un serveur à un autre

```bash
# ── ANCIEN SERVEUR ──────────────────────────────
./scripts/backup.sh /tmp/migration
tar -czf /tmp/konfitur-migration.tar.gz -C /tmp migration/
cp .env /tmp/konfitur-env.txt
rsync -avz /tmp/konfitur-migration.tar.gz /tmp/konfitur-env.txt user@nouveau:/tmp/

# ── NOUVEAU SERVEUR ─────────────────────────────
curl -fsSL https://get.docker.com | sh && sudo usermod -aG docker $USER && newgrp docker
sudo apt install -y curl jq

git clone git@github.com:Setsuko34/KonfiturGameFullInfra.git /opt/konfiturgame
cd /opt/konfiturgame
cp /tmp/konfitur-env.txt .env
mkdir -p traefik/acme && touch traefik/acme/acme.json && chmod 600 traefik/acme/acme.json
mkdir -p backups && tar -xzf /tmp/konfitur-migration.tar.gz -C backups/

chmod +x scripts/restore.sh
./scripts/restore.sh ./backups/migration
docker compose -f docker-compose.yml up -d

# ── VÉRIFICATION ───────────────────────────────
docker compose ps
curl https://api.konfiturgame.fr/v1/health/version
curl -I https://konfiturgame.fr
```

Ensuite : pointer les DNS vers l'IP du nouveau serveur. Propagation : 5 min à 48h selon le TTL.

---

## 11. Maintenance Appwrite

### Consulter / modifier des données

Console Appwrite → Databases → konfitur-db → [collection] → Documents

### Logs Appwrite

```bash
docker compose logs -f appwrite
docker compose logs -f appwrite-realtime
docker compose logs -f appwrite-worker-databases
```

### Vérifier les workers

```bash
docker compose ps appwrite-worker-databases
# Doit être "Up" — traite les créations d'attributs et d'indexes
```

### Réinitialisation complète (reset dev)

```bash
# ⚠️ SUPPRIME TOUTES LES DONNÉES
docker compose down -v
docker compose up -d
# Attendre ~30s
./scripts/seed-data.sh && ./scripts/create-log-collections.sh
```

---

## 12. Dépannage production

### Let's Encrypt échoue

```bash
dig konfiturgame.fr +short                         # vérifier DNS
curl -I http://konfiturgame.fr                     # Traefik doit répondre sur 80
ls -la traefik/acme/acme.json                      # → -rw------- (600)
docker compose logs traefik | grep -i "acme\|certif\|error"
```

### Frontend ne joint pas Appwrite

```bash
docker exec konfitur-frontend curl https://api.konfiturgame.fr/v1/health/version
docker exec konfitur-frontend env | grep APPWRITE
```

### Appwrite "Unknown attribute: xyz" (post-migration de version)

```bash
docker exec konfitur-appwrite php /usr/src/code/app/cli.php migrate
docker exec konfitur-redis redis-cli FLUSHALL
docker compose -f docker-compose.yml restart appwrite
```

Si l'erreur persiste, la migration a laissé des métadonnées incomplètes — correction manuelle documentée dans `MISE-A-JOUR.md §4 → Bugs connus après migration`.

### Espace disque saturé

```bash
df -h && docker system df
docker image prune -a
# Configurer la rotation dans /etc/docker/daemon.json :
# { "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }
```

### Redémarrage d'urgence

```bash
docker compose -f docker-compose.yml restart
# ou
docker compose -f docker-compose.yml up -d --force-recreate
```

---

## 13. Variables d'environnement

```env
# ═══ DOMAINE ═══
DOMAIN=konfiturgame.fr
ADMIN_EMAIL=admin@konfiturgame.fr

# ═══ APPWRITE ═══
APPWRITE_PROJECT_ID=konfitur-game
APPWRITE_API_KEY=<console Appwrite — jamais commité>
APPWRITE_OPENSSL_KEY=<openssl rand -hex 32>

# ═══ BASE DE DONNÉES ═══
MARIADB_ROOT_PASSWORD=<openssl rand -base64 32>
MARIADB_PASSWORD=<openssl rand -base64 32>

# ═══ EMAIL ═══
SMTP_HOST=smtp.postmarkapp.com
SMTP_PORT=587
SMTP_USER=<identifiant SMTP>
SMTP_PASS=<mot de passe SMTP>

# ═══ TRAEFIK ═══
TRAEFIK_DASHBOARD_AUTH=admin:<hash htpasswd -nB>

# ═══ NEXT.JS (public) ═══
NEXT_PUBLIC_SITE_URL=https://konfiturgame.fr
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://api.konfiturgame.fr/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=konfitur-game

# ═══ NEXT.JS (serveur uniquement) ═══
APPWRITE_INTERNAL_ENDPOINT=http://appwrite/v1
LOG_INTERNAL_SECRET=<openssl rand -hex 32>
```

> **Note Redis :** pas de `REDIS_PASSWORD` — Appwrite (bug toujours présent en 1.9.0) n'envoie pas `AUTH` à Redis. Redis est isolé sur `appwrite-net`.

---

## Aide-mémoire

```
DÉMARRER               → docker compose -f docker-compose.yml up -d
ARRÊTER                → docker compose down
LOGS                   → docker compose logs -f [service]
REBUILD FRONTEND       → docker compose -f docker-compose.yml up -d --build frontend
BACKUP                 → ./scripts/backup.sh
RESTORE                → ./scripts/restore.sh ./backups/<date>
SEED (données de test) → ./scripts/seed-data.sh
PUSH FONCTIONS         → appwrite push functions --force
PULL SCHÉMA            → appwrite pull tables
PUSH SCHÉMA            → appwrite push tables --force
PUSH BUCKETS / TEAMS   → appwrite push buckets && appwrite push teams
MIGRATION APPWRITE     → docker exec konfitur-appwrite php .../cli.php migrate
CONSOLE APPWRITE       → https://api.konfiturgame.fr/console
DASHBOARD TRAEFIK      → https://traefik.konfiturgame.fr/dashboard/
SITE                   → https://konfiturgame.fr
```

---

*KonfiturGame · Next.js 16.2.9 · Appwrite 1.9.0 · Traefik v3.6.7 · Docker Compose v2 · Mis à jour : 2026-07-14*
