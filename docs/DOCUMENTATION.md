# KonfiturGame — Documentation complète

> Guide de prise en main de l'infrastructure et du code, du démarrage à la production.

---

## Table des matières

1. [Vue d'ensemble du projet](#1-vue-densemble-du-projet)
2. [Architecture globale](#2-architecture-globale)
3. [Les services expliqués](#3-les-services-expliqués)
4. [Structure des fichiers](#4-structure-des-fichiers)
5. [Choix techniques](#5-choix-techniques)
6. [Premier démarrage (setup complet)](#6-premier-démarrage-setup-complet)
7. [Démarrage quotidien](#7-démarrage-quotidien)
8. [Accéder aux différents services](#8-accéder-aux-différents-services)
9. [Le projet Next.js en détail](#9-le-projet-nextjs-en-détail)
10. [Appwrite — Le backend](#10-appwrite--le-backend)
11. [Flux d'authentification](#11-flux-dauthentification)
12. [Flux de données (exemple complet)](#12-flux-de-données-exemple-complet)
13. [OAuth (Google & Discord)](#13-oauth-google--discord)
14. [Variables d'environnement](#14-variables-denvironnement)
15. [Scripts utilitaires](#15-scripts-utilitaires)
16. [Commandes utiles](#16-commandes-utiles)
17. [Cloner l'environnement sur un autre PC](#17-cloner-lenvironnement-sur-un-autre-pc)
18. [Problèmes fréquents](#18-problèmes-fréquents)

---

## 1. Vue d'ensemble du projet

KonfiturGame est une **plateforme web de game jams** (compétitions de création de jeux vidéo).
Elle permet de :
- Créer et rejoindre des game jams
- Former des équipes avec un code d'invitation
- Soumettre et noter des projets
- Chatter en temps réel pendant la jam

**Ce projet est découpé en deux grandes parties :**

| Partie | Rôle | Technologie |
|---|---|---|
| **Frontend** | L'interface web que l'utilisateur voit | Next.js 15 (React) |
| **Backend** | La base de données, l'auth, le stockage | Appwrite 1.5 |

Les deux sont **conteneurisés dans Docker** et exposés sur internet via **Traefik** (le reverse proxy).

---

## 2. Architecture globale

```
Internet
    │
    ▼
┌─────────────────────────────────────────┐
│           TRAEFIK (port 80/443)         │  ← Point d'entrée unique
│   Gère le TLS (HTTPS), route le trafic │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴────────┐
       │                │
       ▼                ▼
┌────────────┐    ┌────────────────────────────────┐
│  FRONTEND  │    │          APPWRITE              │
│  Next.js   │    │  (Auth + DB + Realtime +       │
│  port 3000 │    │   Storage + Functions)          │
└────────────┘    └──────────────┬─────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
             ┌──────────┐             ┌──────────┐
             │  MariaDB │             │  Redis   │
             │ (données)│             │  (cache) │
             └──────────┘             └──────────┘
```

### Comment le trafic circule

1. L'utilisateur tape `konfiturgame.fr` dans son navigateur
2. **Traefik** reçoit la requête, vérifie le certificat TLS, et la redirige vers **Next.js**
3. **Next.js** génère la page (côté serveur) et la renvoie
4. Le navigateur de l'utilisateur charge la page. Depuis le navigateur, les appels à l'API Appwrite vont vers `api.konfiturgame.fr`
5. **Traefik** route `api.konfiturgame.fr` vers **Appwrite**

### Les réseaux Docker

Il y a **deux réseaux Docker** séparés pour la sécurité :

```
konfitur-net  → Traefik + Frontend + Appwrite   (réseau "public")
appwrite-net  → Appwrite + MariaDB + Redis       (réseau "privé")
```

MariaDB et Redis ne sont **jamais exposés** directement. Seul Appwrite peut leur parler.

---

## 3. Les services expliqués

### Traefik
**C'est le portier.** Tout le trafic internet passe par lui.

- Il gère automatiquement les certificats HTTPS via Let's Encrypt (renouvellement automatique)
- Il redirige HTTP → HTTPS
- Il route les requêtes vers le bon service selon le domaine (`konfiturgame.fr` → Next.js, `api.konfiturgame.fr` → Appwrite)
- Il applique des règles de sécurité (headers HTTP, rate limiting)
- Il possède un dashboard web d'administration

### Next.js (Frontend)
**C'est l'application web.** Ce que l'utilisateur voit et utilise.

- Il génère les pages HTML côté serveur (Server-Side Rendering) pour les performances et le SEO
- Il contient toute la logique métier frontend (formulaires, navigation, état)
- Il communique avec Appwrite pour lire/écrire des données
- En production, il tourne dans un conteneur Docker minimal (Node.js alpine)

### Appwrite
**C'est le backend clé en main.** Il remplace un backend custom (Express, Django, etc.).

Il fournit d'office :
- **Auth** : inscription, connexion, sessions, OAuth (Google, Discord)
- **Database** : base de données NoSQL avec permissions granulaires
- **Realtime** : WebSocket pour le chat en direct
- **Storage** : stockage de fichiers (images de couverture, screenshots)
- **Functions** : fonctions serverless (optionnel)

Appwrite a sa propre **console web** d'administration accessible sur `api.konfiturgame.fr`.

### Appwrite Realtime
C'est un **worker séparé** d'Appwrite qui gère uniquement les connexions WebSocket.
Le chat en direct passe par lui. Il est routé séparément par Traefik via le path `/v1/realtime`.

### MariaDB
**La base de données** d'Appwrite. Tu n'interagis jamais directement avec elle — tout passe par Appwrite. Elle est sur le réseau privé, invisible depuis l'extérieur.

### Redis
**Le cache et le bus d'événements** d'Appwrite. Il sert à :
- Accélérer les requêtes fréquentes
- Transmettre les événements Realtime entre les workers

> **Note Redis :** Redis tourne sans mot de passe (`--requirepass` désactivé) car Appwrite 1.5 a un bug dans `Queue\Connection\Redis` — il n'envoie jamais la commande `AUTH`. Redis est sur `appwrite-net` (réseau isolé, non exposé vers l'extérieur), donc ce n'est pas un risque de sécurité.

---

## 4. Structure des fichiers

```
KonfiturGameFullInfra/
│
├── docker-compose.yml          ← Définit tous les services Docker (production)
├── docker-compose.override.yml ← Surcharges pour le développement local
├── .env                        ← Tes secrets (à créer, jamais commité)
├── .env.example                ← Template des variables d'env
├── .gitignore
│
├── traefik/
│   ├── traefik.yml             ← Config statique Traefik (production)
│   ├── traefik.dev.yml         ← Config statique Traefik (dev — pas de TLS)
│   ├── dynamic/
│   │   ├── middlewares.yml     ← Sécurité, rate limiting, CSP, headers
│   │   └── tls.yml             ← Options TLS (versions, ciphers)
│   └── acme/
│       └── acme.json           ← Certificats Let's Encrypt (auto-géré, chmod 600)
│
├── scripts/
│   ├── seed-data.sh            ← Crée les collections ET insère les données de test
│   ├── backup.sh               ← Sauvegarde MariaDB + volumes Appwrite
│   ├── restore.sh              ← Restaure depuis un backup
│   └── init-appwrite.sh        ← Crée uniquement la base de données (usage limité)
│
├── docs/
│   ├── DOCUMENTATION.md        ← Ce fichier
│   └── PRODUCTION.md           ← Guide de déploiement production
│
└── frontend/                   ← L'application Next.js
    ├── Dockerfile              ← Build de production (multi-stage)
    ├── Dockerfile.dev          ← Build de développement (hot reload)
    ├── package.json
    ├── next.config.mjs
    ├── tsconfig.json
    ├── postcss.config.mjs
    ├── analyse_ui_ux.md        ← Analyse UI/UX des pages (générée)
    ├── public/                 ← Fichiers statiques (favicon, images locales)
    └── src/
        ├── app/                ← Routes Next.js (App Router)
        ├── components/         ← Composants React réutilisables
        ├── lib/                ← Utilitaires, SDK Appwrite, actions serveur
        ├── hooks/              ← Custom React hooks
        ├── types/              ← Types TypeScript
        └── middleware.ts       ← Protection des routes (auth)
```

### Détail du dossier `src/app/` (les pages)

```
src/app/
├── layout.tsx                  ← Layout racine (fonts, metadata, AuthProvider)
├── page.tsx                    ← Page d'accueil (/)
├── globals.css                 ← Styles globaux + variables CSS
├── error.tsx                   ← Page d'erreur générique
├── not-found.tsx               ← Page 404
│
├── explore/
│   └── page.tsx                ← /explore — Toutes les jams avec filtres
│
├── jam/[jamId]/
│   ├── page.tsx                ← /jam/:id — Détail d'une jam
│   └── loading.tsx             ← Skeleton affiché pendant le chargement
│
├── team/[teamId]/
│   └── page.tsx                ← /team/:id — Page d'une équipe
│
├── project/[projectId]/
│   └── page.tsx                ← /project/:id — Page d'un projet soumis
│
├── dashboard/
│   ├── layout.tsx
│   └── page.tsx                ← /dashboard — Espace organisateur (protégé)
│
└── auth/
    ├── login/page.tsx          ← /auth/login
    └── register/page.tsx       ← /auth/register
```

### Détail du dossier `src/lib/` (la logique)

```
src/lib/
├── appwrite/
│   ├── client.ts   ← SDK Appwrite pour le navigateur (account, databases, storage)
│   ├── server.ts   ← SDK Appwrite pour le serveur (avec la clé API secrète)
│   ├── config.ts   ← Les IDs des collections et buckets (constantes)
│   └── types.ts    ← Fonctions qui transforment les documents Appwrite en types TS
│
├── actions/
│   ├── jams.ts     ← Server Actions : lire/créer des jams
│   ├── teams.ts    ← Server Actions : créer une équipe, rejoindre avec un code
│   ├── projects.ts ← Server Actions : soumettre un projet, voter
│   └── chat.ts     ← Server Actions : envoyer un message, épingler
│
└── mockData.ts     ← Données de démonstration (utilisées sans Appwrite connecté)
```

---

## 5. Choix techniques

### Pourquoi Next.js 15 avec App Router ?
L'**App Router** est la nouvelle architecture de Next.js. Elle permet de mélanger :
- Des **Server Components** (composants qui tournent côté serveur, invisibles au client)
- Des **Client Components** (composants interactifs avec état, hooks)
- Des **Server Actions** (fonctions serveur appelées depuis le client, sans API REST manuelle)

Résultat : moins de code, meilleures performances, meilleur SEO.

### Pourquoi Appwrite plutôt qu'un backend custom ?
Écrire un backend from scratch (authentification, gestion de sessions, stockage de fichiers, WebSockets) est long et risqué. Appwrite fournit tout ça, battle-tested, en self-hosted. Tu gardes le contrôle de tes données sans dépendre d'un service cloud externe.

### Pourquoi Traefik ?
Traefik **découvre automatiquement** les services Docker via leurs labels. Quand tu ajoutes un service Docker avec les bons labels, Traefik le route automatiquement sans redémarrer. Il gère aussi Let's Encrypt nativement.

### Pourquoi Tailwind CSS v4 ?
La v4 utilise les **variables CSS natives** (CSS custom properties) plutôt que des classes utilitaires pré-générées. Cela donne un design system plus flexible et des bundles CSS plus légers. Le design system de KonfiturGame repose entièrement sur des variables CSS (`--primary`, `--background`, etc.).

### Pourquoi TypeScript strict ?
Avec `strict: true` dans `tsconfig.json`, TypeScript vérifie tout. Ça oblige à gérer les cas `null`, les types incorrects, etc. Le coût est quelques lignes de code en plus ; le bénéfice est l'élimination d'une énorme classe de bugs.

### Pourquoi pnpm ?
pnpm est plus rapide et plus efficace qu'npm ou yarn. Il partage les dépendances entre projets (économise de l'espace disque) et installe les paquets beaucoup plus vite.

---

## 6. Premier démarrage (setup complet)

### Prérequis
- Docker Desktop installé et démarré
- `curl` et `jq` installés (`sudo apt install curl jq` sur Linux/WSL)
- Un nom de domaine pointant vers ton serveur (uniquement pour la prod)

---

### Étape 1 — Créer le fichier `.env`

```bash
# Depuis la racine du projet
cp .env.example .env
```

Ouvre `.env` et remplis chaque variable. Pour les secrets, utilise ces commandes :

```bash
# Générer APPWRITE_OPENSSL_KEY
openssl rand -hex 32

# Générer MARIADB_ROOT_PASSWORD
openssl rand -base64 32

# Générer MARIADB_PASSWORD
openssl rand -base64 32

# Générer TRAEFIK_DASHBOARD_AUTH (remplace 'ton-mot-de-passe')
htpasswd -nB admin
# → Copie la sortie dans TRAEFIK_DASHBOARD_AUTH
```

Exemple de `.env` pour le développement local :
```env
DOMAIN=localhost
APPWRITE_PROJECT_ID=konfitur-game
APPWRITE_API_KEY=                    # remplir après l'étape 3
APPWRITE_OPENSSL_KEY=abc123...
MARIADB_ROOT_PASSWORD=XYZ...
MARIADB_PASSWORD=ABC...
ADMIN_EMAIL=admin@konfiturgame.fr
SMTP_HOST=smtp.postmarkapp.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
TRAEFIK_DASHBOARD_AUTH=admin:$2y$05$...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

---

### Étape 2 — Lancer l'infrastructure

```bash
# Depuis la racine du projet
docker compose up -d
```

Attends 30-60 secondes que tous les services démarrent.

```bash
# Vérifier que tout tourne
docker compose ps
```

Tu devrais voir tous les services avec le statut `Up`.

---

### Étape 3 — Configurer Appwrite (première fois uniquement)

1. **Ouvre la console Appwrite** dans ton navigateur :
   - En local : `http://localhost:8080`
   - En production : `https://api.DOMAIN`

2. **Crée un compte administrateur** (premier compte = admin automatiquement)

3. **Crée un projet** :
   - Clique sur "Create Project"
   - ID du projet : `konfitur-game` (doit correspondre à `APPWRITE_PROJECT_ID`)
   - Nom : `KonfiturGame`

4. **Déclare la plateforme web** (obligatoire pour l'auth) :
   - Dans le projet → Settings → Platforms → Add Platform → Web
   - Hostname : `localhost` (dev) ou `konfiturgame.fr` (prod)

5. **Crée une API Key** :
   - Dans le projet → Settings → API Keys → Create API Key
   - Nom : `server-key`
   - Permissions : coche tout (ou au minimum : databases, storage, users)
   - Copie la clé générée

6. **Ajoute la clé dans `.env`** :
   ```env
   APPWRITE_API_KEY=ta-clé-copiée-ici
   ```

7. **Redémarre le frontend** pour qu'il prenne en compte la nouvelle variable :
   ```bash
   docker compose restart frontend
   ```

---

### Étape 4 — Initialiser la base de données

Ce script crée automatiquement toutes les collections ET insère des données de test :

```bash
# Depuis la racine du projet
chmod +x scripts/seed-data.sh
./scripts/seed-data.sh
```

Le script va créer :
- La base de données `konfitur-db`
- 8 collections (game_jams, teams, team_members, projects, chat_messages, announcements, comments, votes)
- Une jam de démonstration "Spring Jam 2025"
- Un message épinglé et une annonce de test

Le script est **idempotent** : il peut être relancé sans risque (les éléments déjà existants sont ignorés avec HTTP 409).

---

### Étape 5 — Configurer OAuth (optionnel pour le dev)

Voir la section [13. OAuth (Google & Discord)](#13-oauth-google--discord).

---

### Étape 6 — Vérifier que tout fonctionne

```bash
# Test frontend (dev)
curl -I http://localhost:3000

# Test Appwrite (dev)
curl http://localhost:8080/v1/health
# ou via Traefik :
curl http://localhost/v1/health

# Test headers de sécurité (prod)
curl -I https://konfiturgame.fr | grep -E "strict|x-frame|x-content"
```

---

## 7. Démarrage quotidien

### En développement local

```bash
# Démarre tous les services (utilise docker-compose.override.yml automatiquement)
docker compose up

# Ou en arrière-plan
docker compose up -d

# Voir les logs en temps réel
docker compose logs -f

# Voir les logs d'un seul service
docker compose logs -f frontend
docker compose logs -f appwrite
docker compose logs -f traefik
```

Accès en dev :
- Frontend : `http://localhost:3000` (hot reload activé)
- Appwrite console : `http://localhost:8080`
- Appwrite API : `http://localhost/v1` (via Traefik) ou `http://localhost:8080/v1` (direct)
- Dashboard Traefik : `http://localhost:8081/dashboard/`

### En production

```bash
# Premier démarrage ou après une mise à jour
docker compose -f docker-compose.yml up -d --build

# Démarrage normal (sans rebuild)
docker compose -f docker-compose.yml up -d

# Arrêter tous les services
docker compose down

# Arrêter ET supprimer les volumes (⚠️ SUPPRIME LES DONNÉES)
docker compose down -v
```

> **Note :** En production, n'utilise PAS `docker-compose.override.yml`. Utilise explicitement `-f docker-compose.yml`.

### Mettre à jour le frontend

```bash
git pull
docker compose build frontend
docker compose up -d frontend
```

---

## 8. Accéder aux différents services

### En production

| Service | URL | Identifiants |
|---|---|---|
| **Site web** | `https://konfiturgame.fr` | Public |
| **Console Appwrite** | `https://api.konfiturgame.fr` | Ton compte admin |
| **Dashboard Traefik** | `https://traefik.konfiturgame.fr` | `TRAEFIK_DASHBOARD_AUTH` (htpasswd) |

### En développement local

| Service | URL | Notes |
|---|---|---|
| **Site web** | `http://localhost:3000` | Hot reload activé |
| **Console Appwrite** | `http://localhost:8080` | Accès direct (port mappé) |
| **Appwrite API (Traefik)** | `http://localhost/v1` | Via Traefik, Host(localhost) |
| **Dashboard Traefik** | `http://localhost:8081/dashboard/` | Insecure en dev |

### Se connecter à la base de données MariaDB (debug)

```bash
docker compose exec mariadb mysql -u appwrite -p
# Entre MARIADB_PASSWORD quand demandé
```

### Se connecter à Redis

```bash
docker compose exec redis redis-cli
```

### Accéder au shell du frontend

```bash
docker compose exec frontend sh
```

---

## 9. Le projet Next.js en détail

### Comment les pages sont construites

Next.js App Router distingue deux types de composants :

**Server Components** (par défaut) — s'exécutent sur le serveur :
```tsx
// src/app/page.tsx — Server Component
// Pas de 'use client', pas de useState, pas de useEffect
export default async function HomePage() {
  const jams = await getJams() // Appel serveur direct
  return <div>...</div>
}
```

**Client Components** — s'exécutent dans le navigateur :
```tsx
// src/components/Header.tsx
'use client' // Cette directive est obligatoire

import { useState } from 'react'

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  return <header>...</header>
}
```

### Les Server Actions

Les Server Actions permettent d'appeler du code serveur depuis un composant client **sans écrire une API REST**.

```tsx
// src/lib/actions/jams.ts
'use server'

export async function createJam(data: {...}) {
  const doc = await serverDatabases.createDocument(...)
  return { success: true, id: doc.$id }
}

// Dans un composant client :
import { createJam } from '@/lib/actions/jams'

function CreateJamForm() {
  const handleSubmit = async () => {
    const result = await createJam({ title: '...', ... })
  }
}
```

### Le design system CSS

Toutes les couleurs et typographies sont définies comme **variables CSS** dans `globals.css`.

Variables disponibles :
```
--background       Fond principal      (#0C1018)
--card             Fond des cartes     (#131921)
--surface-elevated Fond surélevé       (#1A2130)
--foreground       Texte principal     (#F0EDE8)
--muted-foreground Texte secondaire    (#8891A4)
--primary          Bleu               (#4F6AFF)
--secondary        Rouge              (#EF233C)
--success          Vert               (#34D399)
--border           Bordure            (#1E2736)
--radius           Coins             (0px — intentionnel)
--font-sans        Space Grotesk
--font-mono        JetBrains Mono
```

Classes utilitaires spéciales (définies dans globals.css) :
```
.label-tech        → Texte en majuscules, monospace, 10px, tracking large
.timer-font        → Chiffres à largeur fixe (pour les countdowns)
.skip-link         → Lien d'accessibilité "Aller au contenu principal"
.animate-marquee   → Animation défilement infini
.accent-line-red   → Barre rouge 3px en haut (via ::before)
.accent-line-blue  → Barre bleue 3px en haut
.accent-line-gray  → Barre grise 3px en haut
.grid-overlay      → Grille subtile en fond (via ::before)
.noise             → Texture grain en pseudo-élément (via ::after)
```

### Le middleware d'authentification

Le fichier `src/middleware.ts` s'exécute avant chaque requête et protège les routes :

```tsx
// Routes protégées → redirige vers /auth/login si non connecté
const protectedRoutes = ['/dashboard']

// Routes auth → redirige vers / si déjà connecté
const authRoutes = ['/auth/login', '/auth/register']
```

Il détecte la session via le cookie Appwrite (`a_session_{projectId}`).

---

## 10. Appwrite — Le backend

### La console d'administration

La console Appwrite (`https://api.DOMAIN` ou `http://localhost:8080`) te permet de :
- Voir et modifier les données directement
- Gérer les utilisateurs
- Configurer les permissions
- Voir les logs en temps réel
- Créer des buckets de stockage

### Structure de la base de données

```
Base de données : konfitur-db
│
├── game_jams         ← Les jams (titre, thème, dates, règles...)
├── teams             ← Les équipes/guildes (jam_ids[], nom, code d'invitation, chef)
├── team_members      ← Qui est dans quelle équipe (avec son rôle)
├── projects          ← Les jeux soumis (avec votes)
├── chat_messages     ← Messages du chat en direct
├── announcements     ← Annonces des organisateurs
├── comments          ← Commentaires sur les projets
└── votes             ← Qui a voté pour quel projet (1 vote par personne)
```

### Les permissions

Chaque collection a des règles d'accès. Par exemple :
- **game_jams** : Tout le monde peut lire. Seulement les connectés peuvent créer.
- **chat_messages** : Tout le monde peut lire. Seulement les connectés peuvent écrire.
- **votes** : Index unique sur `(project_id, user_id)` → impossible de voter deux fois.

### Le Realtime (chat en direct)

Appwrite Realtime utilise les **WebSockets**. Voici comment ça marche :

1. Le navigateur ouvre une connexion WebSocket vers `wss://api.DOMAIN/v1/realtime`
2. Il s'abonne aux événements d'une collection : `databases.konfitur-db.collections.chat_messages.documents`
3. Quand quelqu'un envoie un message, Appwrite notifie **tous les abonnés** en temps réel
4. Le hook `useRealtimeChat` reçoit l'événement et met à jour l'état React

### Les buckets de stockage

| Bucket | Contenu | Taille max |
|---|---|---|
| `jam-covers` | Images de couverture des jams | 5 MB |
| `project-assets` | Screenshots et builds de jeux | 100 MB |
| `avatars` | Photos de profil | 2 MB |

---

## 11. Flux d'authentification

### Inscription (`/auth/register`)

```
1. Utilisateur remplit le formulaire (pseudo, email, mot de passe)
2. Appel à account.create('unique()', email, password, name)
   → Appwrite crée l'utilisateur dans sa DB interne
3. Appel immédiat à account.createEmailPasswordSession(email, password)
   → Appwrite crée une session et pose un cookie dans le navigateur
4. Redirection vers /
```

### Connexion (`/auth/login`)

```
1. Utilisateur entre email + mot de passe
2. Appel à account.createEmailPasswordSession(email, password)
   → Appwrite vérifie les credentials et crée une session
   → Cookie de session posé automatiquement dans le navigateur
3. Appel à account.get() pour récupérer les infos utilisateur
4. AuthContext mis à jour avec l'utilisateur connecté
5. Redirection vers / ou vers la page demandée
```

### Vérification de session (middleware)

```
Pour chaque requête vers /dashboard :
1. middleware.ts lit le cookie a_session_{projectId}
2. Si le cookie existe → laisse passer
3. Si le cookie n'existe pas → redirige vers /auth/login
```

### Déconnexion

```
1. Appel à account.deleteSession('current')
   → Appwrite invalide la session et supprime le cookie
2. AuthContext mis à jour (user = null)
3. Redirection vers /
```

---

## 12. Flux de données (exemple complet)

### Envoyer un message dans le chat

```
Navigateur (Client Component JamChat)
    │
    │ 1. L'utilisateur tape un message et appuie sur Entrée
    │
    ▼
databases.createDocument(...)     ← SDK Appwrite côté navigateur
    │
    │ 2. Requête HTTP vers http://localhost/v1/databases/.../documents (dev)
    │                  ou https://api.DOMAIN/v1/... (prod)
    │
    ▼
Appwrite
    │
    │ 3. Appwrite vérifie la session de l'utilisateur
    │ 4. Appwrite vérifie les permissions
    │ 5. Appwrite insère le document dans MariaDB
    │ 6. Appwrite publie l'événement dans Redis
    │
    ▼
Appwrite Realtime Worker
    │
    │ 7. Le worker lit l'événement depuis Redis
    │ 8. Il notifie tous les clients abonnés via WebSocket
    │
    ▼
Navigateurs de TOUS les participants connectés
    │
    │ 9. useRealtimeChat reçoit l'événement
    │ 10. setMessages() met à jour l'état React
    │ 11. React re-render → le nouveau message apparaît
```

---

## 13. OAuth (Google & Discord)

### Problème spécifique à Appwrite v1.5

Appwrite v1.5 traite `_APP_DOMAIN` comme un **hostname pur** — il ignore le port lors de la construction du `redirect_uri` OAuth. Si `_APP_DOMAIN=localhost:8080`, Appwrite génère des callbacks `http://localhost/v1/...` (sans port 8080), ce que Google/Discord rejettent.

**Solution en dev :** On utilise `_APP_DOMAIN: localhost` (sans port) et Traefik route `Host(localhost)` → Appwrite. Le port 80 est le port implicite HTTP, donc le `redirect_uri` `http://localhost/v1/...` est valide et routable.

### Configuration dev (docker-compose.override.yml)

Le service appwrite en dev est configuré ainsi :
```yaml
appwrite:
  labels:
    - "traefik.enable=true"
    - "traefik.http.routers.appwrite-dev.rule=Host(`localhost`)"
    - "traefik.http.routers.appwrite-dev.entrypoints=web"
    - "traefik.http.routers.appwrite-dev.service=appwrite-dev"
    - "traefik.http.services.appwrite-dev.loadbalancer.server.port=80"
    - "traefik.docker.network=konfitur-net"  # important : appwrite est sur 2 réseaux
  environment:
    _APP_DOMAIN: localhost
    _APP_DOMAIN_TARGET: localhost
```

> **Important :** `traefik.docker.network=konfitur-net` est nécessaire car le container Appwrite est sur deux réseaux (`konfitur-net` et `appwrite-net`). Sans ce label, Traefik peut choisir le mauvais réseau et le router ne se crée pas.

### Redirect URIs à enregistrer

#### Google Cloud Console
Dans "APIs & Services" → "Credentials" → ton client OAuth → "Authorized redirect URIs" :

| Environnement | URI à ajouter |
|---|---|
| **Développement** | `http://localhost/v1/account/sessions/oauth2/callback/google/konfitur-game` |
| **Production** | `https://api.konfiturgame.fr/v1/account/sessions/oauth2/callback/google/konfitur-game` |

#### Discord Developer Portal
Dans ton application → "OAuth2" → "Redirects" :

| Environnement | URI à ajouter |
|---|---|
| **Développement** | `http://localhost/v1/account/sessions/oauth2/callback/discord/konfitur-game` |
| **Production** | `https://api.konfiturgame.fr/v1/account/sessions/oauth2/callback/discord/konfitur-game` |

### Activer OAuth dans la console Appwrite

1. Console Appwrite → ton projet → Auth → Settings
2. Section "OAuth2 Providers"
3. Activer **Google** : entrer `Client ID` et `Client Secret` depuis Google Cloud Console
4. Activer **Discord** : entrer `Client ID` et `Client Secret` depuis Discord Developer Portal

### Vérifier que le routing OAuth fonctionne

```bash
# Dev — vérifie que Traefik route bien vers Appwrite
curl -v http://localhost/v1/health

# Dashboard Traefik — vérifie que le router appwrite-dev existe
# → http://localhost:8081/dashboard/#/http/routers
```

---

## 14. Variables d'environnement

### Règle d'or
Les variables qui commencent par `NEXT_PUBLIC_` sont **visibles par le navigateur**. Ne jamais y mettre de secrets.

| Variable | Côté | Description |
|---|---|---|
| `NEXT_PUBLIC_APPWRITE_ENDPOINT` | Client + Serveur | URL publique de l'API Appwrite |
| `NEXT_PUBLIC_APPWRITE_PROJECT_ID` | Client + Serveur | ID du projet Appwrite |
| `NEXT_PUBLIC_SITE_URL` | Client | URL du site (pour les métadonnées) |
| `APPWRITE_INTERNAL_ENDPOINT` | Serveur uniquement | URL interne (Server Actions → réseau Docker) |
| `APPWRITE_API_KEY` | Serveur uniquement | Clé secrète (Server Actions) |
| `DOMAIN` | Docker | Domaine principal |
| `APPWRITE_PROJECT_ID` | Docker + Appwrite | ID du projet (doit correspondre) |
| `APPWRITE_OPENSSL_KEY` | Appwrite | Clé de chiffrement des données |
| `MARIADB_ROOT_PASSWORD` | Docker | Mot de passe root MariaDB |
| `MARIADB_PASSWORD` | Docker | Mot de passe utilisateur appwrite |
| `ADMIN_EMAIL` | Traefik | Email pour Let's Encrypt + admin Appwrite |
| `SMTP_*` | Appwrite | Configuration email transactionnel |
| `TRAEFIK_DASHBOARD_AUTH` | Traefik | Auth basique dashboard Traefik |

### Variables spécifiques au dev (dans docker-compose.override.yml)

En dev, ces variables sont définies directement dans l'override et ne passent pas par `.env` :

```yaml
# frontend
NEXT_PUBLIC_APPWRITE_ENDPOINT=http://localhost:8080/v1   # accès direct depuis le browser
APPWRITE_INTERNAL_ENDPOINT=http://appwrite/v1            # résolution Docker interne
NODE_ENV=development
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# appwrite
_APP_DOMAIN: localhost
_APP_DOMAIN_TARGET: localhost
```

---

## 15. Scripts utilitaires

Tous les scripts sont dans `scripts/` et nécessitent que `.env` soit présent à la racine.

### `seed-data.sh` — Initialiser la base de données

```bash
chmod +x scripts/seed-data.sh
./scripts/seed-data.sh
```

Crée :
- La base de données `konfitur-db`
- 8 collections avec tous leurs attributs et indexes
- Une jam "Spring Jam 2025" de démonstration
- Un message épinglé et une annonce de test

**Le script est idempotent** : relancer sur une base déjà initialisée ne cause pas d'erreur.

Prérequis : `curl`, `jq`, Appwrite démarré, `APPWRITE_API_KEY` défini dans `.env`.

---

### `backup.sh` — Sauvegarder les données

```bash
chmod +x scripts/backup.sh

# Backup dans ./backups/YYYY-MM-DD_HH-MM/ (par défaut)
./scripts/backup.sh

# Backup dans un dossier personnalisé
./scripts/backup.sh /chemin/vers/dossier
```

Le script sauvegarde :
- **`mariadb.sql`** — Dump SQL complet de la base de données Appwrite (avec `--single-transaction`)
- **`appwrite-uploads.tar.gz`** — Uploads utilisateurs
- **`appwrite-config.tar.gz`** — Configuration Appwrite
- **`appwrite-functions.tar.gz`** — Fonctions serverless
- **`appwrite-certificates.tar.gz`** — Certificats SSL Appwrite
- **`project-config.tar.gz`** — Code source du projet (hors `.env`, `node_modules`, `backups`)
- **`MANIFEST.txt`** — Métadonnées du backup (date, hostname, tailles)

**Pour archiver et transférer le backup :**
```bash
cd backups
tar -czf konfitur-backup-2025-06-01.tar.gz 2025-06-01_14-30/
# Puis copier via USB, rsync, scp...
```

---

### `restore.sh` — Restaurer depuis un backup

```bash
chmod +x scripts/restore.sh

./scripts/restore.sh ./backups/2025-06-01_14-30
```

Le script :
1. Demande confirmation (données actuelles effacées)
2. Démarre MariaDB et Redis
3. Attend que MariaDB soit prêt
4. Restaure le dump SQL
5. Restaure les 4 volumes Appwrite

Après la restauration :
```bash
docker compose up -d
```

> **Prérequis :** Le fichier `.env` doit exister avec les bons mots de passe avant de restaurer.

---

### `init-appwrite.sh` — Créer la base de données uniquement

```bash
bash scripts/init-appwrite.sh
```

Script minimaliste qui crée uniquement la base de données `konfitur-db` via l'API REST.
Utilisé comme étape préalable si nécessaire. **Préférer `seed-data.sh`** qui fait tout.

---

## 16. Commandes utiles

### Docker

```bash
# État de tous les services
docker compose ps

# Logs de tous les services
docker compose logs -f

# Logs d'un service spécifique
docker compose logs -f frontend
docker compose logs -f appwrite
docker compose logs -f traefik

# Redémarrer un service
docker compose restart frontend
docker compose restart appwrite traefik

# Rebuild et redémarrer le frontend
docker compose up -d --build frontend

# Voir la consommation de ressources
docker stats

# Supprimer les images inutilisées (libère de l'espace)
docker image prune

# Voir les volumes Docker
docker volume ls | grep konfitur
```

### Seed et maintenance Appwrite

```bash
# Initialiser les collections (première fois ou après un reset)
./scripts/seed-data.sh

# Backup manuel
./scripts/backup.sh

# Restaurer depuis un backup
./scripts/restore.sh ./backups/2025-06-01_14-30

# Voir les logs Appwrite workers
docker compose logs -f appwrite-worker-databases
```

### Next.js (développement sans Docker)

```bash
cd frontend

# Installer les dépendances
pnpm install

# Démarrer en mode dev (hot reload)
pnpm dev

# Vérifier les types TypeScript
pnpm type-check

# Linter
pnpm lint

# Build de production
pnpm build
```

### Traefik — Diagnostics

```bash
# Vérifier le routing — dashboard en dev
open http://localhost:8081/dashboard/

# Vérifier les headers de sécurité
curl -I https://konfiturgame.fr

# Vérifier le certificat TLS
openssl s_client -connect konfiturgame.fr:443 -servername konfiturgame.fr

# Logs Traefik avec filtre
docker compose logs traefik | grep -i "appwrite\|error\|acme"
```

### Réinitialisation complète

```bash
# ⚠️ SUPPRIME TOUTES LES DONNÉES
docker compose down -v
docker compose up -d
./scripts/seed-data.sh
```

---

## 17. Cloner l'environnement sur un autre PC

### Méthode A — Depuis Git (nouveau PC, données fraîches)

```bash
# 1. Cloner le dépôt
git clone https://github.com/<org>/KonfiturGame.git
cd KonfiturGame

# 2. Créer le .env (les secrets ne sont pas dans Git !)
cp .env.example .env
# → Remplir manuellement les secrets (ou les copier depuis l'ancien PC)

# 3. Permissions Traefik ACME
mkdir -p traefik/acme
touch traefik/acme/acme.json
chmod 600 traefik/acme/acme.json

# 4. Démarrer
docker compose up -d

# 5. Configurer Appwrite (créer projet + API key)
# → Voir Étape 3 de la section 6

# 6. Initialiser la base de données
./scripts/seed-data.sh
```

---

### Méthode B — Depuis un backup (migrations données existantes)

**Sur l'ancien PC** — créer le backup :

```bash
./scripts/backup.sh

# Archiver le backup + le .env
cd backups
tar -czf konfitur-migration.tar.gz 2025-06-01_14-30/
cp ../.env ../konfitur-env-backup.txt   # copier les secrets séparément
```

**Transférer** sur le nouveau PC (USB, rsync, scp) :
```bash
# Via rsync (SSH)
rsync -avz konfitur-migration.tar.gz user@nouveau-pc:/destination/

# Via scp
scp konfitur-migration.tar.gz user@nouveau-pc:/destination/
```

**Sur le nouveau PC** — restaurer :

```bash
# 1. Cloner le dépôt
git clone https://github.com/<org>/KonfiturGame.git
cd KonfiturGame

# 2. Restaurer les secrets
cp /chemin/vers/konfitur-env-backup.txt .env

# 3. Permissions Traefik ACME
mkdir -p traefik/acme
touch traefik/acme/acme.json
chmod 600 traefik/acme/acme.json

# 4. Extraire le backup
mkdir -p backups
cd backups
tar -xzf /chemin/vers/konfitur-migration.tar.gz
cd ..

# 5. Restaurer
chmod +x scripts/restore.sh
./scripts/restore.sh ./backups/2025-06-01_14-30

# 6. Démarrer tous les services
docker compose up -d
```

---

### Checklist de vérification après migration

```bash
# Tous les services sont up ?
docker compose ps

# Frontend répond ?
curl -I http://localhost:3000

# Appwrite répond ?
curl http://localhost:8080/v1/health

# Routing Traefik OK ?
curl http://localhost/v1/health

# Dashboard Traefik — router appwrite-dev visible ?
open http://localhost:8081/dashboard/#/http/routers
```

---

## 18. Problèmes fréquents

### "Le site ne s'affiche pas / certificat invalide"

1. Vérifie que le DNS pointe vers l'IP du serveur :
   ```bash
   nslookup konfiturgame.fr
   ```
2. Vérifie que les ports 80 et 443 sont ouverts
3. Vérifie le fichier `traefik/acme/acme.json` — il doit avoir `chmod 600`
4. Regarde les logs Traefik : `docker compose logs -f traefik`

### "Appwrite ne répond pas"

```bash
# Vérifie que MariaDB et Redis sont démarrés
docker compose ps mariadb redis

# Regarde les logs Appwrite
docker compose logs -f appwrite
```

### "Erreur lors du seed : unauthorized"

L'`APPWRITE_API_KEY` dans `.env` est vide ou incorrecte. Assure-toi d'avoir :
1. Créé le projet dans la console Appwrite
2. Créé une API Key avec les bonnes permissions
3. Copié la clé dans `.env`
4. Redémarré le frontend : `docker compose restart frontend`

### "Le chat ne se met pas à jour en temps réel"

1. Vérifie que le service `appwrite-realtime` tourne :
   ```bash
   docker compose ps appwrite-realtime
   ```
2. Vérifie que Traefik route bien `/v1/realtime` vers `appwrite-realtime`
3. Vérifie la CSP dans `middlewares.yml` — elle doit autoriser `wss://api.DOMAIN`

### "OAuth : redirect_uri mismatch"

En dev : le `redirect_uri` généré par Appwrite est `http://localhost/v1/...` (port 80 implicite). Vérifie :
1. Que les URIs dans Google/Discord correspondent exactement (voir section 13)
2. Que le router `appwrite-dev` apparaît dans le dashboard Traefik
3. Que `_APP_DOMAIN: localhost` est bien dans `docker-compose.override.yml` (pas `localhost:8080`)

### "Router appwrite-dev absent du dashboard Traefik"

Cause probable : Appwrite est sur 2 réseaux, Traefik choisit le mauvais.

Vérifie que le label `traefik.docker.network=konfitur-net` est présent sur le service appwrite dans `docker-compose.override.yml`. Ensuite :

```bash
docker compose down appwrite traefik && docker compose up -d traefik appwrite
```

### "Erreur TypeScript lors du build"

```bash
cd frontend
pnpm type-check
```

Les erreurs affichées indiquent exactement le fichier et la ligne à corriger.

### "Page blanche / hydration error"

Cela arrive quand un **Server Component** utilise des hooks React, ou quand un **Client Component** tente d'accéder à `window`/`document` côté serveur.

Solution : Ajoute `'use client'` en première ligne du fichier si le composant est interactif.

### "Attributs Appwrite bloqués en 'processing'"

Le worker `appwrite-worker-databases` doit tourner pour traiter les créations d'attributs.

```bash
docker compose ps appwrite-worker-databases
docker compose logs appwrite-worker-databases
```

Le script `seed-data.sh` attend automatiquement (`wait_attrs`) que tous les attributs soient `available` avant de passer à la collection suivante.

### Réinitialiser complètement la base de données

```bash
# Arrête tout et supprime les volumes (SUPPRIME TOUTES LES DONNÉES)
docker compose down -v

# Redémarre
docker compose up -d

# Re-seed
./scripts/seed-data.sh
```

---

## Résumé rapide — Aide-mémoire

```
DÉMARRER (dev)          → docker compose up -d
DÉMARRER (prod)         → docker compose -f docker-compose.yml up -d --build
ARRÊTER                 → docker compose down
LOGS                    → docker compose logs -f [service]
SEED                    → ./scripts/seed-data.sh
BACKUP                  → ./scripts/backup.sh
RESTORE                 → ./scripts/restore.sh ./backups/<date>
CONSOLE APPWRITE        → http://localhost:8080 (dev) | https://api.DOMAIN (prod)
DASHBOARD TRAEFIK       → http://localhost:8081/dashboard/ (dev) | https://traefik.DOMAIN (prod)
SITE                    → http://localhost:3000 (dev) | https://DOMAIN (prod)
APPWRITE API (dev)      → http://localhost/v1 (Traefik) | http://localhost:8080/v1 (direct)
```

---

*Documentation — KonfiturGame · Stack : Next.js 15 · Appwrite 1.5 · Traefik v3 · Docker Compose v2*
