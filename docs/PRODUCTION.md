# KonfiturGame — Guide de déploiement Production

Ce document décrit pas à pas comment déployer l'infrastructure complète en production, la maintenir, et la migrer d'un serveur à un autre.

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
13. [Variables d'environnement — récapitulatif](#13-variables-denvironnement--récapitulatif)

---

## 1. Architecture des services

```
Internet
   │
   ▼
Traefik v3 (ports 80 / 443)
   ├── konfiturgame.fr          → Frontend Next.js :3000
   ├── api.konfiturgame.fr      → Appwrite :80  (API + Console + Realtime)
   └── traefik.konfiturgame.fr  → Dashboard Traefik (Basic Auth)
         │
         ├── appwrite ──► MariaDB 10.11  (appwrite-net)
         └── appwrite ──► Redis 7        (appwrite-net)
```

**Réseaux Docker :**
- `konfitur-net` — Traefik ↔ Frontend ↔ Appwrite
- `appwrite-net` — Appwrite ↔ MariaDB ↔ Redis (isolé, non accessible depuis l'extérieur)

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
| Outils | `curl`, `jq`, `git` |

```bash
# Installer Docker (Ubuntu)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Installer les outils nécessaires
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

> Attendre la propagation DNS avant de démarrer les services (sinon Let's Encrypt échoue).
> Vérifier avec : `dig konfiturgame.fr +short`

---

### 3.2 — Cloner le dépôt

```bash
git clone https://github.com/<votre-org>/KonfiturGame.git /opt/konfiturgame
cd /opt/konfiturgame
```

---

### 3.3 — Permissions Traefik ACME

```bash
mkdir -p traefik/acme
touch traefik/acme/acme.json
chmod 600 traefik/acme/acme.json
```

> **Critique :** Si `acme.json` n'est pas en `chmod 600`, Traefik refuse de démarrer.

---

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

---

### 3.5 — Générer le mot de passe du dashboard Traefik

```bash
# Générer le hash bcrypt
htpasswd -nB admin MonMotDePasse
# Sortie : admin:$2y$05$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Copier la sortie dans .env :
# TRAEFIK_DASHBOARD_AUTH=admin:$2y$05$xxx...
```

> Les `$` dans le hash doivent rester tels quels dans le fichier `.env`.

---

### 3.6 — Mettre à jour middlewares.yml

Éditer `traefik/dynamic/middlewares.yml` — mettre le hash BasicAuth :

```yaml
auth-dashboard:
  basicAuth:
    users:
      - "admin:$2y$05$VOTRE_HASH_ICI"
```

Et mettre à jour la CSP avec le vrai domaine :
```yaml
connect-src 'self' https://api.konfiturgame.fr wss://api.konfiturgame.fr;
```

---

### 3.7 — Vérifier le lockfile frontend

```bash
ls frontend/pnpm-lock.yaml
```

S'il est absent :
```bash
docker run --rm -v "$(pwd)/frontend:/app" -w /app node:20-alpine \
  sh -c "corepack enable pnpm && pnpm install --no-frozen-lockfile"
```

---

### 3.8 — Démarrer les services

```bash
# En production : toujours spécifier explicitement le fichier (sans override dev)
docker compose -f docker-compose.yml up -d
```

Ordre de démarrage géré par `depends_on` :
1. `mariadb` + `redis`
2. `appwrite` + `appwrite-realtime` + `appwrite-worker-databases`
3. `frontend`
4. `traefik` (en parallèle)

```bash
# Vérifier que tout est up
docker compose ps
docker compose logs traefik --tail=50
```

---

## 4. Configuration Appwrite

### 4.1 — Accéder à la console

Ouvrir `https://api.konfiturgame.fr/console` dans un navigateur.

Créer le compte administrateur avec l'email défini dans `ADMIN_EMAIL`.

### 4.2 — Créer le projet

- Nom : `KonfiturGame`
- Project ID : `konfitur-game` (**doit correspondre à `APPWRITE_PROJECT_ID` dans `.env`**)

### 4.3 — Déclarer la plateforme web

Dans Settings → Platforms → Add Platform → **Web** :
- Hostname : `konfiturgame.fr`

### 4.4 — Créer les collections via le script

```bash
# Crée la DB, toutes les collections et les données de test
chmod +x scripts/seed-data.sh
./scripts/seed-data.sh
```

Ce script est idempotent — il peut être relancé sans risque. Les collections déjà existantes sont ignorées (HTTP 409).

Si le script échoue sur l'authentification : voir §4.5 pour créer l'API Key d'abord.

**Collections créées :**

| Collection ID | Contenu |
|---|---|
| `game_jams` | Les jams (titre, thème, dates, règles, statut...) |
| `teams` | Les équipes (nom, code invitation, leader) |
| `team_members` | Membres des équipes avec leur rôle |
| `projects` | Jeux soumis (titre, description, technologies, votes) |
| `chat_messages` | Messages du chat temps réel (channels : general, team-search, help) |
| `announcements` | Annonces des organisateurs |
| `comments` | Commentaires sur les projets |
| `votes` | Votes (contrainte unique project_id + user_id) |

### 4.5 — Créer les buckets Storage

Dans la console Appwrite → Storage → Create Bucket :

| Bucket ID | Nom | Max file size |
|---|---|---|
| `jam-covers` | Jam Covers | 5 Mo |
| `project-assets` | Project Assets | 20 Mo |
| `avatars` | Avatars | 2 Mo |

### 4.6 — Générer l'API Key

Dans Settings → API Keys → **Create API Key** :
- Scopes : `databases.read`, `databases.write`, `storage.read`, `storage.write`, `users.read`, `users.write`
- Copier la clé dans `.env` → `APPWRITE_API_KEY`

### 4.7 — Redémarrer le frontend

```bash
docker compose -f docker-compose.yml restart frontend
```

---

## 5. Configuration OAuth (Google & Discord)

### Pourquoi c'est nécessaire

Les providers OAuth (Google, Discord) doivent avoir la liste des `redirect_uri` autorisées. Appwrite génère ces callbacks en utilisant `_APP_DOMAIN`. En production avec TLS, le format est `https://api.konfiturgame.fr/v1/...`.

### Google Cloud Console

1. Aller sur [console.cloud.google.com](https://console.cloud.google.com)
2. APIs & Services → Credentials → ton client OAuth 2.0
3. Authorized redirect URIs → **Add URI** :
   ```
   https://api.konfiturgame.fr/v1/account/sessions/oauth2/callback/google/konfitur-game
   ```

### Discord Developer Portal

1. Aller sur [discord.com/developers](https://discord.com/developers/applications)
2. Ton application → OAuth2 → Redirects → **Add Redirect** :
   ```
   https://api.konfiturgame.fr/v1/account/sessions/oauth2/callback/discord/konfitur-game
   ```

### Activer dans la console Appwrite

Console → ton projet → Auth → Settings → OAuth2 Providers :
- **Google** : coller `Client ID` et `Client Secret` depuis Google Cloud Console
- **Discord** : coller `Client ID` et `Client Secret` depuis Discord Developer Portal

---

## 6. Vérifications finales

```bash
# TLS Let's Encrypt actif
curl -I https://konfiturgame.fr
# → doit contenir "HTTP/2 200" et "strict-transport-security"

# API Appwrite répond
curl https://api.konfiturgame.fr/v1/health
# → {"status":"pass",...}

# Dashboard Traefik accessible (demande mot de passe)
curl -I https://traefik.konfiturgame.fr/dashboard/
# → HTTP/2 401 (normal, authentification requise)

# Test OAuth (doit rediriger vers Google)
curl -v "https://api.konfiturgame.fr/v1/account/sessions/oauth2/google?project=konfitur-game&success=https://konfiturgame.fr&failure=https://konfiturgame.fr/auth/login?error=oauth"
```

---

## 7. Mises à jour

### Mettre à jour le frontend

```bash
cd /opt/konfiturgame
git pull
docker compose -f docker-compose.yml build frontend
docker compose -f docker-compose.yml up -d frontend
```

### Mettre à jour Appwrite

```bash
# 1. Mettre à jour le tag d'image dans docker-compose.yml (ex: 1.5 → 1.6)
# 2. Tirer les nouvelles images
docker compose -f docker-compose.yml pull appwrite appwrite-realtime appwrite-worker-databases

# 3. Redémarrer — Appwrite lance les migrations automatiquement au démarrage
docker compose -f docker-compose.yml up -d appwrite appwrite-realtime appwrite-worker-databases

# 4. Vérifier que les migrations sont terminées
docker compose logs -f appwrite | grep -i "migrat"
```

> **Important :** Faire un backup avant toute mise à jour Appwrite (voir §8).

### Mettre à jour Traefik

```bash
# Modifier le tag dans docker-compose.yml puis :
docker compose -f docker-compose.yml pull traefik
docker compose -f docker-compose.yml up -d traefik
```

---

## 8. Sauvegardes

### Backup manuel

```bash
cd /opt/konfiturgame
./scripts/backup.sh
```

Le backup est créé dans `./backups/YYYY-MM-DD_HH-MM/` et contient :
- `mariadb.sql` — Dump SQL complet (toutes les données Appwrite)
- `appwrite-uploads.tar.gz` — Fichiers uploadés par les utilisateurs
- `appwrite-config.tar.gz` — Configuration Appwrite
- `appwrite-functions.tar.gz` — Fonctions serverless
- `appwrite-certificates.tar.gz` — Certificats internes Appwrite
- `project-config.tar.gz` — Code source du projet (sans `.env`, `node_modules`)
- `MANIFEST.txt` — Métadonnées du backup

### Backup dans un dossier personnalisé

```bash
./scripts/backup.sh /mnt/nas/backups/konfiturgame
```

### Automatiser avec cron (backup quotidien à 3h du matin)

```bash
crontab -e
```

Ajouter :
```cron
0 3 * * * /opt/konfiturgame/scripts/backup.sh >> /var/log/konfiturgame-backup.log 2>&1
```

### Vérifier les backups automatiques

```bash
# Voir les derniers backups
ls -lt /opt/konfiturgame/backups/

# Vérifier les logs
tail -50 /var/log/konfiturgame-backup.log
```

### Nettoyage automatique des vieux backups (optionnel)

Ajouter dans le crontab après le backup quotidien :
```cron
# Supprimer les backups de plus de 30 jours
0 4 * * * find /opt/konfiturgame/backups -maxdepth 1 -type d -mtime +30 -exec rm -rf {} \;
```

### Archiver et transférer un backup

```bash
cd /opt/konfiturgame/backups
# Créer une archive transportable
tar -czf konfitur-backup-$(date +%Y%m%d).tar.gz 2025-06-01_14-30/

# Envoyer sur un NAS ou PC distant
rsync -avz konfitur-backup-20250601.tar.gz user@nas:/backups/
# ou
scp konfitur-backup-20250601.tar.gz user@autre-serveur:/backups/
```

---

## 9. Restauration

### Restaurer sur le même serveur

```bash
./scripts/restore.sh ./backups/2025-06-01_14-30
# → demande confirmation avant d'écraser les données
```

Ensuite :
```bash
docker compose -f docker-compose.yml up -d
```

### Restaurer depuis une archive

```bash
# Extraire l'archive
mkdir -p /opt/konfiturgame/backups
cd /opt/konfiturgame/backups
tar -xzf /chemin/vers/konfitur-backup-20250601.tar.gz

# Restaurer
cd /opt/konfiturgame
./scripts/restore.sh ./backups/2025-06-01_14-30
```

### Ce que la restauration fait

1. Démarre MariaDB et Redis uniquement
2. Attend que MariaDB accepte les connexions
3. Importe le dump SQL dans MariaDB
4. Restaure les 4 volumes Appwrite (uploads, config, functions, certificates)
5. Affiche les prochaines étapes

### Après une restauration

```bash
# Démarrer tous les services
docker compose -f docker-compose.yml up -d

# Vérifier que tout fonctionne
curl https://api.konfiturgame.fr/v1/health
```

---

## 10. Migrer d'un serveur à un autre

### Étape 1 — Sur l'ancien serveur : créer un backup complet

```bash
cd /opt/konfiturgame
./scripts/backup.sh /tmp/migration

# Archiver
tar -czf /tmp/konfitur-migration.tar.gz -C /tmp migration/

# Archiver aussi le .env (séparément, avec les secrets)
cp .env /tmp/konfitur-env.txt
```

### Étape 2 — Transférer sur le nouveau serveur

```bash
# Depuis l'ancien serveur vers le nouveau
rsync -avz /tmp/konfitur-migration.tar.gz user@nouveau-serveur:/tmp/
rsync -avz /tmp/konfitur-env.txt user@nouveau-serveur:/tmp/
```

### Étape 3 — Sur le nouveau serveur : préparer l'environnement

```bash
# Installer Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
sudo apt install -y curl jq

# Cloner le dépôt
git clone https://github.com/<org>/KonfiturGame.git /opt/konfiturgame
cd /opt/konfiturgame

# Restaurer les secrets
cp /tmp/konfitur-env.txt .env

# Permissions Traefik
mkdir -p traefik/acme
touch traefik/acme/acme.json
chmod 600 traefik/acme/acme.json

# Extraire le backup
mkdir -p /opt/konfiturgame/backups
cd /opt/konfiturgame/backups
tar -xzf /tmp/konfitur-migration.tar.gz
```

### Étape 4 — Restaurer les données

```bash
cd /opt/konfiturgame
chmod +x scripts/restore.sh
./scripts/restore.sh ./backups/migration
```

### Étape 5 — Démarrer et vérifier

```bash
# Démarrer
docker compose -f docker-compose.yml up -d

# Vérifier
docker compose ps
curl https://api.konfiturgame.fr/v1/health
curl -I https://konfiturgame.fr
```

### Étape 6 — Mettre à jour le DNS

Pointer les DNS vers l'IP du nouveau serveur. Attendre la propagation (5 min à 48h selon le TTL).

### Étape 7 — Vérifier les certificats TLS

```bash
# Les certificats Let's Encrypt se renouvellent automatiquement
# Mais si le backup contient l'ancien acme.json avec les anciens certs,
# Traefik peut avoir besoin de les regénérer.
docker compose logs traefik | grep -i "acme\|certif"
```

---

## 11. Maintenance Appwrite

### Voir les utilisateurs

Console Appwrite → Auth → Users

### Supprimer un utilisateur

Console Appwrite → Auth → Users → clic sur l'utilisateur → Delete

### Modifier des données directement

Console Appwrite → Databases → konfitur-db → [collection] → Documents

### Vider la collection chat_messages (maintenance)

```bash
# Via l'API (supprimer tous les messages d'une jam)
curl -X DELETE "https://api.konfiturgame.fr/v1/databases/konfitur-db/collections/chat_messages/documents/[doc-id]" \
  -H "X-Appwrite-Project: konfitur-game" \
  -H "X-Appwrite-Key: $APPWRITE_API_KEY"
```

### Logs Appwrite en temps réel

```bash
docker compose logs -f appwrite
docker compose logs -f appwrite-realtime
docker compose logs -f appwrite-worker-databases
```

### Réinitialiser les collections (reset complet)

```bash
# ⚠️ SUPPRIME TOUTES LES DONNÉES APPWRITE
docker compose down -v
docker compose up -d

# Attendre 30s que Appwrite démarre
sleep 30

# Re-créer les collections et données de test
./scripts/seed-data.sh
```

### Mettre à jour le schéma (ajouter un attribut)

1. Dans la console Appwrite → ajouter l'attribut manuellement
2. Mettre à jour `scripts/seed-data.sh` pour que la prochaine initialisation inclut l'attribut
3. Mettre à jour `frontend/src/lib/appwrite/types.ts` et `frontend/src/types/index.ts`

### Vérifier l'état de santé des workers

```bash
docker compose ps appwrite-worker-databases
# doit être "Up" — ce worker traite les créations d'attributs/indexes
```

---

## 12. Dépannage production

### Let's Encrypt échoue

```bash
# Vérifier DNS
dig konfiturgame.fr +short
dig api.konfiturgame.fr +short

# Vérifier ports ouverts
curl -I http://konfiturgame.fr   # doit répondre (Traefik écoute en 80)

# Vérifier permissions acme.json
ls -la traefik/acme/acme.json    # → -rw------- (600)

# Logs Traefik
docker compose logs traefik | grep -i "acme\|certif\|error"
```

### Frontend ne joint pas Appwrite

```bash
# Test depuis le container frontend
docker exec konfitur-frontend curl https://api.konfiturgame.fr/v1/health

# Vérifier APPWRITE_INTERNAL_ENDPOINT
docker exec konfitur-frontend env | grep APPWRITE
```

### Appwrite "variable not set" warnings

Les warnings `WARNING: variable RdUYG6fvB2EI8Oiz9Q4r2 not set` sont des variables internes Appwrite. Inoffensives, à ignorer.

### Redémarrage d'urgence

```bash
# Redémarrer tous les services
docker compose -f docker-compose.yml restart

# Forcer la recréation des containers
docker compose -f docker-compose.yml up -d --force-recreate
```

### Espace disque saturé

```bash
# Voir l'espace utilisé
df -h
docker system df

# Nettoyer les images non utilisées
docker image prune -a

# Nettoyer les volumes orphelins (attention !)
docker volume prune

# Voir les logs les plus volumineux
du -sh /var/lib/docker/containers/*/

# Rotation des logs Docker (à configurer dans /etc/docker/daemon.json)
# {
#   "log-driver": "json-file",
#   "log-opts": { "max-size": "10m", "max-file": "3" }
# }
```

---

## 13. Variables d'environnement — récapitulatif

```env
# ═══ DOMAINE ═══
DOMAIN=konfiturgame.fr
ADMIN_EMAIL=admin@konfiturgame.fr

# ═══ APPWRITE ═══
APPWRITE_PROJECT_ID=konfitur-game
APPWRITE_API_KEY=<généré dans la console — jamais commité>
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

# ═══ NEXT.JS ═══
NEXT_PUBLIC_SITE_URL=https://konfiturgame.fr
```

> **Note Redis :** `REDIS_PASSWORD` n'est pas utilisé — Redis tourne sans auth en prod car Appwrite 1.5 ne supporte pas AUTH Redis. Redis est sur le réseau `appwrite-net` (isolé, non exposé).

---

## Aide-mémoire production

```
DÉMARRER               → docker compose -f docker-compose.yml up -d
ARRÊTER                → docker compose down
LOGS                   → docker compose logs -f [service]
REBUILD FRONTEND       → docker compose -f docker-compose.yml up -d --build frontend
BACKUP                 → ./scripts/backup.sh
RESTORE                → ./scripts/restore.sh ./backups/<date>
SEED                   → ./scripts/seed-data.sh
CONSOLE APPWRITE       → https://api.konfiturgame.fr/console
DASHBOARD TRAEFIK      → https://traefik.konfiturgame.fr/dashboard/
SITE                   → https://konfiturgame.fr
```

---

*Guide Production — KonfiturGame · Stack : Next.js 15 · Appwrite 1.5 · Traefik v3 · Docker Compose v2*
