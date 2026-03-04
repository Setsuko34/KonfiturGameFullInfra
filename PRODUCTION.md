# KonfiturGame — Guide de déploiement Production

Ce document décrit pas à pas comment remettre en place l'infrastructure complète en production à partir de zéro.

---

## Architecture des services

```
Internet
   │
   ▼
Traefik v3 (ports 80 / 443)
   ├── konfiturgame.fr     → Frontend Next.js :3000
   ├── api.konfiturgame.fr → Appwrite :80  (API + Console + Realtime)
   └── traefik.konfiturgame.fr → Dashboard Traefik (Basic Auth)
         │
         ├── appwrite ──► MariaDB 10.11
         └── appwrite ──► Redis 7
```

**Réseaux Docker :**
- `konfitur-net` — Traefik ↔ Frontend ↔ Appwrite
- `appwrite-net` — Appwrite ↔ MariaDB ↔ Redis (isolé, pas accessible depuis l'extérieur)

---

## Prérequis serveur

| Élément | Minimum recommandé |
|---|---|
| OS | Ubuntu 22.04 LTS ou Debian 12 |
| RAM | 4 Go (8 Go recommandés) |
| CPU | 2 vCPU |
| Disque | 40 Go SSD |
| Docker | ≥ 24.x |
| Docker Compose | ≥ 2.x (plugin) |
| Ports ouverts | 80, 443 |

```bash
# Installer Docker (Ubuntu)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

---

## Étape 1 — DNS

Pointer les enregistrements A (ou CNAME) vers l'IP du serveur :

```
konfiturgame.fr         A   <IP_SERVEUR>
www.konfiturgame.fr     A   <IP_SERVEUR>
api.konfiturgame.fr     A   <IP_SERVEUR>
traefik.konfiturgame.fr A   <IP_SERVEUR>
```

> Attendre la propagation DNS avant de démarrer les services (sinon Let's Encrypt échoue).
> Vérifier avec : `dig konfiturgame.fr +short`

---

## Étape 2 — Cloner le dépôt

```bash
git clone https://github.com/<votre-org>/KonfiturGame.git /opt/konfiturgame
cd /opt/konfiturgame
```

---

## Étape 3 — Préparer les fichiers de config

### 3.1 — Permissions Traefik ACME

```bash
mkdir -p traefik/acme
touch traefik/acme/acme.json
chmod 600 traefik/acme/acme.json
```

> **Critique :** Si `acme.json` n'est pas en `chmod 600`, Traefik refuse de démarrer.

### 3.2 — Fichier `.env`

```bash
cp .env.example .env
```

Éditer `.env` avec les valeurs réelles :

```bash
nano .env
```

| Variable | Valeur / commande de génération |
|---|---|
| `DOMAIN` | `konfiturgame.fr` |
| `ADMIN_EMAIL` | Email valide pour Let's Encrypt |
| `APPWRITE_PROJECT_ID` | `konfiture-game` (ou autre, fixé une fois) |
| `APPWRITE_API_KEY` | Généré dans la console Appwrite après 1er démarrage |
| `APPWRITE_OPENSSL_KEY` | `openssl rand -hex 32` |
| `MARIADB_ROOT_PASSWORD` | `openssl rand -base64 32` |
| `MARIADB_PASSWORD` | `openssl rand -base64 32` |
| `REDIS_PASSWORD` | `openssl rand -base64 32` |
| `SMTP_HOST` | ex. `smtp.postmarkapp.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | Identifiant SMTP |
| `SMTP_PASS` | Mot de passe SMTP |
| `TRAEFIK_DASHBOARD_AUTH` | Voir §3.3 ci-dessous |
| `NEXT_PUBLIC_SITE_URL` | `https://konfiturgame.fr` |

### 3.3 — Générer le mot de passe du dashboard Traefik

```bash
# Installer htpasswd si nécessaire
sudo apt install -y apache2-utils

# Générer le hash bcrypt (remplacer MonMotDePasse)
htpasswd -nB admin MonMotDePasse
# Sortie : admin:$2y$05$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Copier la sortie dans .env
# TRAEFIK_DASHBOARD_AUTH=admin:$2y$05$xxx...
```

> Les `$` dans le hash doivent être échappés en `$$` si vous les placez dans le `command:` d'un docker-compose, mais dans un fichier `.env` ils restent tels quels.

### 3.4 — Mettre à jour le middleware BasicAuth

Éditer `traefik/dynamic/middlewares.yml` et remplacer la ligne `users` :

```yaml
auth-dashboard:
  basicAuth:
    users:
      - "admin:$2y$05$VOTRE_HASH_ICI"
```

### 3.5 — Mettre à jour le Content-Security-Policy

Dans `traefik/dynamic/middlewares.yml`, mettre à jour `connect-src` avec le vrai domaine :

```yaml
connect-src 'self' https://api.konfiturgame.fr wss://api.konfiturgame.fr;
```

---

## Étape 4 — Vérifier le pnpm-lock.yaml du frontend

Le lockfile doit être présent pour que Docker build ne fail pas en `--frozen-lockfile` :

```bash
ls frontend/pnpm-lock.yaml
```

S'il est absent :

```bash
mkdir -p /tmp/pnpm-gen
cp frontend/package.json /tmp/pnpm-gen/
docker run --rm -v /tmp/pnpm-gen:/app -w /app node:20-alpine \
  sh -c "corepack enable pnpm && pnpm install --no-frozen-lockfile"
cp /tmp/pnpm-gen/pnpm-lock.yaml frontend/
```

---

## Étape 5 — Démarrer les services (sans l'override dev)

```bash
# S'assurer que docker-compose.override.yml n'est PAS utilisé en prod
# Soit en le renommant, soit en spécifiant explicitement le fichier :
docker compose -f docker-compose.yml up -d
```

Ordre de démarrage automatique géré par `depends_on` :
1. `mariadb` + `redis`
2. `appwrite` + `appwrite-realtime`
3. `frontend`
4. `traefik` (en parallèle, attend les labels Docker)

Vérifier que tout est up :

```bash
docker compose ps
docker compose logs traefik --tail=50
```

---

## Étape 6 — Première configuration Appwrite

### 6.1 — Accéder à la console

Ouvrir `https://api.konfiturgame.fr/console` dans un navigateur.

Créer le compte administrateur avec l'email défini dans `ADMIN_EMAIL`.

### 6.2 — Créer le projet

- Nom : `KonfiturGame`
- Project ID : `konfiture-game` (**doit correspondre à `APPWRITE_PROJECT_ID` dans `.env`**)

### 6.3 — Créer la base de données

- Database ID : `konfiture-db`

### 6.4 — Créer les collections

Créer chaque collection avec cet ID exact :

| Collection ID | Nom affiché | Notes |
|---|---|---|
| `game_jams` | Game Jams | |
| `teams` | Teams | |
| `team_members` | Team Members | |
| `projects` | Projects | |
| `chat_messages` | Chat Messages | |
| `announcements` | Announcements | |
| `comments` | Comments | |
| `votes` | Votes | |

Schémas détaillés : voir `frontend/src/lib/appwrite/types.ts` et `frontend/src/types/index.ts`.

### 6.5 — Créer les buckets Storage

| Bucket ID | Nom | Max file size |
|---|---|---|
| `jam-covers` | Jam Covers | 5 Mo |
| `project-assets` | Project Assets | 20 Mo |
| `avatars` | Avatars | 2 Mo |

### 6.6 — Générer l'API Key

Dans la console Appwrite :
- Paramètres du projet → API Keys → **Create API Key**
- Scopes : `databases.read`, `databases.write`, `storage.read`, `storage.write`, `users.read`, `users.write`
- Copier la clé dans `.env` → `APPWRITE_API_KEY`

### 6.7 — Redémarrer le frontend

```bash
docker compose -f docker-compose.yml restart frontend
```

### 6.8 — Seeder les données initiales (optionnel)

```bash
docker compose -f docker-compose.yml exec frontend npx tsx /app/../scripts/seed-data.ts
```

---

## Étape 7 — Vérifications finales

```bash
# TLS Let's Encrypt actif
curl -I https://konfiturgame.fr

# API Appwrite répond
curl https://api.konfiturgame.fr/v1/health

# Dashboard Traefik accessible (demande mot de passe)
curl -I https://traefik.konfiturgame.fr/dashboard/
```

---

## Mises à jour

### Mettre à jour le frontend

```bash
git pull
docker compose -f docker-compose.yml build frontend
docker compose -f docker-compose.yml up -d frontend
```

### Mettre à jour Appwrite

```bash
# 1. Mettre à jour le tag d'image dans docker-compose.yml
# 2. Redémarrer avec migration automatique
docker compose -f docker-compose.yml pull appwrite appwrite-realtime
docker compose -f docker-compose.yml up -d appwrite appwrite-realtime
# Appwrite lance les migrations au démarrage automatiquement
```

---

## Sauvegardes

### Base de données MariaDB

```bash
# Dump complet
docker compose -f docker-compose.yml exec mariadb \
  sh -c 'mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" appwrite' \
  > backup-$(date +%Y%m%d).sql
```

### Volumes Appwrite (uploads, config)

```bash
# Sauvegarder les volumes Docker
docker run --rm \
  -v konfiturgame_appwrite-uploads:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/appwrite-uploads-$(date +%Y%m%d).tar.gz /data
```

### Automatiser avec cron

```bash
# Éditer crontab
crontab -e

# Ajouter (backup quotidien à 3h)
0 3 * * * /opt/konfiturgame/scripts/backup.sh >> /var/log/konfiturgame-backup.log 2>&1
```

---

## Variables d'environnement — récapitulatif complet

```env
# Domaine
DOMAIN=konfiturgame.fr
ADMIN_EMAIL=admin@konfiturgame.fr

# Appwrite
APPWRITE_PROJECT_ID=konfiture-game
APPWRITE_API_KEY=<généré dans la console>
APPWRITE_OPENSSL_KEY=<openssl rand -hex 32>

# MariaDB
MARIADB_ROOT_PASSWORD=<openssl rand -base64 32>
MARIADB_PASSWORD=<openssl rand -base64 32>

# Redis
REDIS_PASSWORD=<openssl rand -base64 32>

# SMTP
SMTP_HOST=smtp.postmarkapp.com
SMTP_PORT=587
SMTP_USER=<identifiant postmark>
SMTP_PASS=<mot de passe postmark>

# Traefik dashboard
TRAEFIK_DASHBOARD_AUTH=admin:<hash htpasswd>

# Next.js
NEXT_PUBLIC_SITE_URL=https://konfiturgame.fr
```

---

## Dépannage

### Let's Encrypt échoue

- Vérifier que les DNS pointent bien vers le serveur (`dig api.konfiturgame.fr`)
- Vérifier que le port 80 est ouvert depuis l'extérieur
- Vérifier les permissions : `ls -la traefik/acme/acme.json` → doit être `-rw-------`
- Consulter les logs Traefik : `docker compose logs traefik | grep -i acme`

### Frontend ne joint pas Appwrite

- En prod, `APPWRITE_INTERNAL_ENDPOINT` n'est pas défini → le SDK server utilise `NEXT_PUBLIC_APPWRITE_ENDPOINT`
- S'assurer que le frontend peut résoudre `api.konfiturgame.fr` depuis le container (tester avec `docker exec konfitur-frontend curl https://api.konfiturgame.fr/v1/health`)

### Appwrite "variable not set" warnings

Les warnings `WARNING: variable RdUYG6fvB2EI8Oiz9Q4r2 not set` sont des variables internes Appwrite, inoffensives. Les ignorer.

### Redis connexion refusée

Vérifier que `REDIS_PASSWORD` dans `.env` correspond à celui utilisé au démarrage Redis. Si Redis est redémarré avec un nouveau mot de passe, vider le volume :

```bash
docker compose down
docker volume rm konfiturgame_redis-data
docker compose up -d
```
