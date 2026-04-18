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
- Former des guildes (équipes persistantes réutilisables sur plusieurs jams)
- Soumettre et voter pour des projets
- Chatter en temps réel pendant la jam
- Gérer son profil utilisateur
- Administrer la plateforme (utilisateurs, modération, logs, ban IP)

**Ce projet est découpé en deux grandes parties :**

| Partie | Rôle | Technologie |
|--------|------|-------------|
| **Frontend** | L'interface web que l'utilisateur voit | Next.js 16.2.3 (React) |
| **Backend** | La base de données, l'auth, le stockage | Appwrite 1.8.0 |

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
│  port 3000 │    │   Storage)                     │
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
4. Depuis le navigateur, les appels à l'API Appwrite vont vers `api.konfiturgame.fr`
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
- Il route les requêtes vers le bon service selon le domaine
- Il applique des règles de sécurité (headers HTTP, rate limiting, CSP)
- Il possède un dashboard web d'administration

### Next.js (Frontend)
**C'est l'application web.** Ce que l'utilisateur voit et utilise.

- Il génère les pages HTML côté serveur (Server-Side Rendering) pour les performances et le SEO
- Il contient toute la logique métier frontend (formulaires, navigation, état)
- Il communique avec Appwrite pour lire/écrire des données
- Il intègre un middleware de bot-detection (`proxy.ts`) qui bloque les IPs bannies
- En production, il tourne dans un conteneur Docker minimal (Node.js alpine)

### Appwrite
**C'est le backend clé en main.** Il remplace un backend custom (Express, Django, etc.).

Il fournit d'office :
- **Auth** : inscription, connexion, sessions, OAuth (Google, Discord)
- **Database** : base de données NoSQL avec permissions granulaires
- **Realtime** : WebSocket pour le chat en direct
- **Storage** : stockage de fichiers (images de couverture, screenshots, avatars)

Appwrite a sa propre **console web** d'administration.
> **Note Appwrite 1.8.0 :** Si la console renvoie une erreur 500 au premier démarrage après une migration depuis une ancienne version, lancer `docker exec konfitur-appwrite php /usr/src/code/app/cli.php migrate` puis redémarrer le container.

### Appwrite Realtime
C'est un **worker séparé** d'Appwrite qui gère uniquement les connexions WebSocket.
Le chat en direct passe par lui. Il est routé séparément par Traefik via le path `/v1/realtime`.

### MariaDB
**La base de données** d'Appwrite. Tu n'interagis jamais directement avec elle — tout passe par Appwrite. Elle est sur le réseau privé, invisible depuis l'extérieur.

### Redis
**Le cache et le bus d'événements** d'Appwrite. Il sert à :
- Accélérer les requêtes fréquentes
- Transmettre les événements Realtime entre les workers

> **Note Redis :** Redis tourne sans mot de passe (`--requirepass` désactivé) car Appwrite a un bug dans `Queue\Connection\Redis` — il n'envoie jamais la commande `AUTH`. Redis est sur `appwrite-net` (réseau isolé, non exposé), donc ce n'est pas un risque de sécurité.

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
│   ├── PRODUCTION.md           ← Guide de déploiement production
│   ├── TODO.md                 ← Roadmap et fonctionnalités
│   └── MEMORY.md               ← Historique des sessions de développement
│
└── frontend/                   ← L'application Next.js
    ├── Dockerfile              ← Build de production (multi-stage)
    ├── Dockerfile.dev          ← Build de développement (hot reload)
    ├── package.json
    ├── next.config.mjs
    ├── tsconfig.json
    ├── vitest.config.ts        ← Configuration des tests unitaires
    ├── public/                 ← Fichiers statiques (favicon, images locales)
    └── src/
        ├── app/                ← Routes Next.js (App Router)
        ├── components/         ← Composants React réutilisables
        ├── lib/                ← Utilitaires, SDK Appwrite, actions serveur
        ├── hooks/              ← Custom React hooks
        ├── types/              ← Types TypeScript
        ├── __tests__/          ← Tests unitaires Vitest
        ├── proxy.ts            ← Middleware bot-detection + ban IP
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
├── sitemap.ts                  ← Sitemap dynamique (SEO)
├── robots.ts                   ← robots.txt dynamique (SEO)
│
├── og/route.tsx                ← Open Graph image dynamique
│
├── api/
│   ├── banned-ips/route.ts     ← API route : liste des IPs bannies (lue par proxy.ts)
│   └── log/route.ts            ← API route : enregistrement des logs côté client
│
├── explore/
│   ├── page.tsx                ← /explore — Toutes les jams
│   └── ExploreGrid.tsx         ← Grille + filtres (Client Component)
│
├── jam/[jamId]/
│   ├── page.tsx                ← /jam/:id — Détail d'une jam
│   ├── JamTeamsSection.tsx     ← Section équipes avec actions contextuelles (Client)
│   └── loading.tsx             ← Skeleton affiché pendant le chargement
│
├── team/[teamId]/
│   └── page.tsx                ← /team/:id — Page publique d'une équipe
│
├── project/[projectId]/
│   ├── page.tsx                ← /project/:id — Page d'un projet soumis
│   └── ProjectInteractions.tsx ← Votes et commentaires (Client Component)
│
├── profile/[userId]/
│   └── page.tsx                ← /profile/:id — Page publique d'un profil
│
├── dashboard/
│   ├── layout.tsx              ← Layout dashboard (sidebar)
│   ├── page.tsx                ← /dashboard — Vue d'ensemble
│   ├── DashboardSidebar.tsx    ← Sidebar navigation
│   ├── participations/
│   │   └── page.tsx            ← /dashboard/participations
│   ├── team/
│   │   ├── page.tsx            ← /dashboard/team — Mes guildes (Server Component)
│   │   ├── TeamPageClient.tsx  ← Wrapper client (modales)
│   │   ├── TeamCard.tsx        ← Card d'une guilde (rôles, membres, jams, actions)
│   │   ├── CreateTeamModal.tsx ← Modal création de guilde
│   │   ├── JoinTeamModal.tsx   ← Modal rejoindre via code
│   │   └── SubmitProjectForm.tsx ← Formulaire soumission projet (dans TeamCard)
│   ├── profile/
│   │   ├── page.tsx            ← /dashboard/profile — Modifier son profil
│   │   └── ProfileForm.tsx     ← Formulaire profil (nom, bio, mdp, suppression)
│   └── my-jams/
│       ├── page.tsx            ← /dashboard/my-jams — Mes jams organisées
│       ├── new/page.tsx        ← /dashboard/my-jams/new — Créer une jam
│       └── [jamId]/
│           ├── page.tsx        ← /dashboard/my-jams/:id — Gérer une jam
│           ├── EditJamForm.tsx ← Formulaire d'édition (corrections mineures)
│           └── AnnouncementForm.tsx ← Créer/supprimer des annonces
│
├── admin/
│   ├── layout.tsx              ← Layout admin (vérif appartenance équipe admin)
│   ├── page.tsx                ← /admin — Statistiques globales
│   ├── AdminSidebar.tsx        ← Sidebar admin
│   ├── users/page.tsx          ← /admin/users — Gestion utilisateurs
│   ├── jams/
│   │   ├── page.tsx            ← /admin/jams — Gestion jams
│   │   └── DeleteJamButton.tsx ← Bouton suppression jam (Client)
│   ├── moderation/page.tsx     ← /admin/moderation — Messages/projets signalés
│   ├── featured/page.tsx       ← /admin/featured — Mise en avant + gagnants
│   ├── announcements/page.tsx  ← /admin/announcements — Annonces globales
│   └── logs/
│       ├── page.tsx            ← /admin/logs — Logs d'audit + IPs bannies
│       ├── BanIPForm.tsx       ← Bannir une IP manuellement
│       ├── UnbanButton.tsx     ← Débannir une IP
│       └── ClearLogsButton.tsx ← Vider les logs
│
└── auth/
    ├── login/
    │   ├── page.tsx            ← /auth/login
    │   └── layout.tsx
    └── register/
        ├── page.tsx            ← /auth/register
        └── layout.tsx
```

### Détail du dossier `src/lib/` (la logique)

```
src/lib/
├── appwrite/
│   ├── client.ts           ← SDK Appwrite pour le navigateur
│   ├── server.ts           ← SDK Appwrite pour le serveur (avec la clé API secrète)
│   ├── config.ts           ← IDs des collections, buckets, ADMIN_TEAM_ID
│   ├── types.ts            ← Mappers : Documents Appwrite → Types TypeScript
│   ├── session.ts          ← Lecture de la session (getCurrentUser)
│   └── internal-host.ts    ← URL Appwrite interne Docker (Server Actions)
│
├── actions/
│   ├── jams.ts             ← CRUD jams (créer, lire, éditer, supprimer)
│   ├── teams.ts            ← Guildes : créer, rejoindre, inscrire à une jam, gérer rôles
│   ├── projects.ts         ← Soumettre un projet, voter, getProjectByTeamAndJam
│   ├── chat.ts             ← Envoyer/épingler/signaler des messages
│   ├── comments.ts         ← CRUD commentaires
│   ├── announcements.ts    ← CRUD annonces (organisateurs + admin)
│   ├── dashboard.ts        ← Données dashboard : getUserTeams, getUserParticipations
│   ├── home.ts             ← Données page d'accueil (stats, jams en cours, gagnants)
│   ├── admin.ts            ← Actions admin : bloquer users, modération, featured
│   ├── logs.ts             ← Logs d'audit + ban IP
│   ├── profile.ts          ← Server Actions : modifier profil, changer mdp, supprimer compte
│   └── profile.client.ts   ← Actions profil côté client (upload avatar)
│
├── validators.ts           ← Validateurs : profil, jam (longueurs, formats)
├── seo.ts                  ← Helpers génération metadata Next.js
├── bot-detection.ts        ← Détection bots (User-Agent, patterns d'URL)
└── mockData.ts             ← Données de démonstration (fallback sans Appwrite)
```

### Détail du dossier `src/__tests__/` (tests)

```
src/__tests__/
├── appwrite-mappers.test.ts    ← 15 tests — mapDocToTeam, mapDocToJam, etc.
├── profile-validators.test.ts  ← 15 tests — validateUpdateProfileName/Bio/Password
├── actions-profile.test.ts     ← 10 tests — updateProfileName, updateProfileBio
├── actions-chat.test.ts        ←  9 tests — sendMessage, pinMessage, reportMessage
├── actions-teams.test.ts       ←  6 tests — createTeam, joinTeamByCode, getTeamsByJam
├── bot-detection.test.ts       ← Tests bot-detection
└── seo.test.ts                 ← Tests SEO helpers
```

---

## 5. Choix techniques

### Pourquoi Next.js avec App Router ?
L'**App Router** permet de mélanger :
- Des **Server Components** (composants qui tournent côté serveur, invisibles au client)
- Des **Client Components** (composants interactifs avec état, hooks)
- Des **Server Actions** (fonctions serveur appelées depuis le client, sans API REST manuelle)

Résultat : moins de code, meilleures performances, meilleur SEO.

### Pourquoi Appwrite plutôt qu'un backend custom ?
Écrire un backend from scratch (authentification, gestion de sessions, stockage de fichiers, WebSockets) est long et risqué. Appwrite fournit tout ça, battle-tested, en self-hosted. Tu gardes le contrôle de tes données sans dépendre d'un service cloud externe.

### Pourquoi Traefik ?
Traefik **découvre automatiquement** les services Docker via leurs labels. Il gère aussi Let's Encrypt nativement et applique les middlewares de sécurité (CSP, HSTS, rate limiting) de façon centralisée.

### Pourquoi Tailwind CSS v4 ?
La v4 utilise les **variables CSS natives** (CSS custom properties). Le design system de KonfiturGame repose entièrement sur des variables CSS (`--primary`, `--background`, etc.) → changer le thème = changer une variable.

### Pourquoi TypeScript strict ?
Avec `strict: true` dans `tsconfig.json`, TypeScript vérifie tout. Ça oblige à gérer les cas `null`, les types incorrects, etc. Le coût est quelques lignes de code en plus ; le bénéfice est l'élimination d'une énorme classe de bugs.

### Pourquoi pnpm ?
pnpm est plus rapide et plus efficace qu'npm ou yarn. Il partage les dépendances entre projets (économise de l'espace disque) et installe les paquets beaucoup plus vite.

### Guildes multi-jam vs équipes éphémères
L'architecture initiale avait `jam_id: string` (1 équipe par jam). On a migré vers `jam_ids: string[]` pour permettre les **guildes persistantes** : une équipe peut s'inscrire à plusieurs jams sans se reformer. Les projets sont dissociés des équipes et retrouvés par `(team_id, jam_id)`.

---

## 6. Premier démarrage (setup complet)

### Prérequis
- Docker Desktop installé et démarré
- `curl` et `jq` installés (`sudo apt install curl jq` sur Linux/WSL)

---

### Étape 1 — Créer le fichier `.env`

```bash
cp .env.example .env
# Remplir chaque variable. Pour les secrets :
openssl rand -hex 32    # → APPWRITE_OPENSSL_KEY
openssl rand -base64 32 # → MARIADB_ROOT_PASSWORD
openssl rand -base64 32 # → MARIADB_PASSWORD
```

---

### Étape 2 — Lancer l'infrastructure

```bash
docker compose up -d
docker compose ps   # vérifier que tout est "Up"
```

---

### Étape 3 — Configurer Appwrite (première fois uniquement)

1. Ouvrir `http://localhost:8080/console`
2. Créer un compte administrateur
3. Créer un projet :
   - ID : `konfitur-game` (doit correspondre à `APPWRITE_PROJECT_ID` dans `.env`)
4. Déclarer la plateforme web : Settings → Platforms → Web → hostname `localhost`
5. Créer une API Key : Settings → API Keys → tous les scopes
6. Copier la clé dans `.env` → `APPWRITE_API_KEY`
7. Redémarrer le frontend : `docker compose restart frontend`

---

### Étape 4 — Initialiser la base de données

```bash
chmod +x scripts/seed-data.sh
./scripts/seed-data.sh
```

Crée la base de données `konfitur-db`, les 8 collections, et une jam de démonstration.
**Idempotent** : peut être relancé sans risque (collections déjà existantes ignorées).

---

### Étape 5 — Vérifier

```bash
curl -I http://localhost:3000        # frontend
curl http://localhost:8080/v1/locale  # Appwrite API
```

---

## 7. Démarrage quotidien

```bash
# Démarre tout (dev — utilise docker-compose.override.yml automatiquement)
#lancer le compose de prod suivi du override pour etre en dev 
docker compose up 

# En arrière-plan
docker compose up -d

# Logs en temps réel
docker compose logs -f
docker compose logs -f frontend
```

Accès en dev :
- Frontend : `http://localhost:3000` (hot reload)
- Appwrite console : `http://localhost:8080/console`
- Dashboard Traefik : `http://localhost:8081/dashboard/`

---

## 8. Accéder aux différents services

### En développement

| Service | URL | Notes |
|---------|-----|-------|
| Site web | `http://localhost:3000` | Hot reload activé |
| Console Appwrite | `http://localhost:8080/console` | Accès direct |
| Appwrite API | `http://localhost:8080/v1` | Direct (browser) |
| Dashboard Traefik | `http://localhost:8081/dashboard/` | Insecure en dev |

### En production

| Service | URL |
|---------|-----|
| Site web | `https://konfiturgame.fr` |
| Console Appwrite | `https://api.konfiturgame.fr/console` |
| Dashboard Traefik | `https://traefik.konfiturgame.fr/dashboard/` |

---

## 9. Le projet Next.js en détail

### Server vs Client Components

**Server Components** (par défaut) — s'exécutent sur le serveur :
```tsx
// Pas de 'use client' — fetch Appwrite directement côté serveur
export default async function JamPage({ params }) {
  const jam = await getJam(params.jamId)
  return <div>...</div>
}
```

**Client Components** — s'exécutent dans le navigateur :
```tsx
'use client' // directive obligatoire
import { useState } from 'react'

export default function JamTeamsSection({ teams }) {
  const [showCreate, setShowCreate] = useState(false)
  return <section>...</section>
}
```

**Pattern Server → Client** : le Server Component fetch les données et les passe serialisées à un Client Component. Évite les waterfalls client-side.

### Les Server Actions

```tsx
// src/lib/actions/teams.ts
'use server'
export async function createTeam(data: { jamId?: string; name: string; leaderId: string; leaderName: string }) {
  const doc = await serverDatabases.createDocument(...)
  return { success: true, id: doc.$id }
}

// Dans un composant client :
import { createTeam } from '@/lib/actions/teams'
const result = await createTeam({ name: 'Team Pixel', leaderId: user.$id, leaderName: user.name })
```

### Le middleware de protection des routes

`src/middleware.ts` protège les routes `/dashboard/*` et `/admin/*`.
`src/proxy.ts` s'exécute avant le middleware et vérifie les IPs bannies (lecture du cache `/api/banned-ips`).

### Le design system CSS

```
--background       #0C1018   Fond principal
--card             #131921   Fond des cartes
--foreground       #F0EDE8   Texte principal
--muted-foreground #8891A4   Texte secondaire
--primary          #4F6AFF   Bleu (CTA, liens actifs)
--secondary        #EF233C   Rouge (danger, accents)
--success          #34D399   Vert
--border           #1E2736   Bordures
--radius           0px       Pas d'arrondi — intentionnel
--font-sans        Space Grotesk
--font-mono        JetBrains Mono
```

Règles :
1. **Zéro border-radius** — tout est rectangulaire
2. **Couleurs via `style={}`** — jamais en classe Tailwind hardcodée
3. **Layout via classes Tailwind** — `flex`, `grid`, `gap`, `p-`, `m-`
4. **Icônes** — Lucide React exclusivement

---

## 10. Appwrite — Le backend

### Structure de la base de données

```
Base de données : konfitur-db
│
├── game_jams         ← Les jams (titre, thème, dates, règles...)
├── teams             ← Les guildes (jam_ids[], nom, code d'invitation, chef)
├── team_members      ← Qui est dans quelle guilde (avec son rôle)
├── projects          ← Les jeux soumis (retrouvés par team_id + jam_id)
├── chat_messages     ← Messages du chat en direct
├── announcements     ← Annonces des organisateurs
├── comments          ← Commentaires sur les projets
├── votes             ← Qui a voté pour quel projet (1 vote par personne)
├── audit_logs        ← Logs d'actions admin et erreurs
└── banned_ips        ← IPs bannies par les admins
```

### Schéma des collections — détail

#### `game_jams`
| Champ | Type | Notes |
|-------|------|-------|
| `title` | String(256) | Requis |
| `slug` | String(256) | Requis, URL-friendly |
| `theme` | String(512) | Requis |
| `description` | String(4096) | Requis |
| `status` | Enum | `upcoming`, `ongoing`, `ended` |
| `type` | Enum | `solo`, `team`, `both` |
| `start_date` | DateTime | Requis |
| `end_date` | DateTime | Requis |
| `duration` | String(32) | Ex: "72h" |
| `max_participants` | Integer | Optionnel |
| `rules[]` | String[] | Liste des règles |
| `prizes[]` | String[] | Liste des prix |
| `tags[]` | String[] | Tags de catégorie |
| `cover_image_id` | String(256) | ID fichier dans le bucket |
| `organizer_id` | String(36) | Requis |

#### `teams` (guildes)
| Champ | Type | Notes |
|-------|------|-------|
| `jam_ids[]` | String[] | Tableau des jams rejointes — `[]` = guilde pure |
| `name` | String(256) | Requis |
| `invite_code` | String(16) | Requis, format `KG-XXXXXXXX` |
| `leader_id` | String(36) | Requis |

> `project_id` a été supprimé. Les projets sont retrouvés par `(team_id, jam_id)`.

#### `team_members`
| Champ | Type | Notes |
|-------|------|-------|
| `team_id` | String(36) | Requis |
| `user_id` | String(36) | Requis |
| `name` | String(128) | Requis |
| `role` | Enum | `dev`, `artist`, `sound`, `designer`, `writer` |
| `is_leader` | Boolean | Requis |

#### `projects`
| Champ | Type | Notes |
|-------|------|-------|
| `jam_id` | String(36) | Requis |
| `team_id` | String(36) | Requis |
| `title` | String(256) | Requis |
| `description` | String(4096) | Requis |
| `technologies[]` | String[] | Optionnel |
| `download_url` | String(2048) | Optionnel |
| `repo_url` | String(2048) | Optionnel |
| `submitted` | Boolean | Requis |
| `submission_date` | DateTime | Optionnel |
| `votes_count` | Integer | Défaut 0 |
| `cover_image_id` | String(256) | Optionnel |
| `screenshot_ids[]` | String[] | Optionnel |

#### `chat_messages`
| Champ | Type | Notes |
|-------|------|-------|
| `jam_id` | String(36) | Requis |
| `channel` | Enum | `general`, `team-search`, `help` |
| `author_id` | String(36) | Requis |
| `author_name` | String(128) | Requis |
| `content` | String(2048) | Requis |
| `role` | Enum | `user`, `organizer`, `moderator` |
| `pinned` | Boolean | Défaut false |

#### `announcements`
| Champ | Type | Notes |
|-------|------|-------|
| `jam_id` | String(36) | Requis (jam ciblée) |
| `title` | String(256) | Requis |
| `content` | String(4096) | Requis |
| `important` | Boolean | Requis |
| `author_id` | String(36) | Requis |

#### `votes`
| Champ | Type | Notes |
|-------|------|-------|
| `project_id` | String(36) | Requis |
| `user_id` | String(36) | Requis |

#### `comments`
| Champ | Type | Notes |
|-------|------|-------|
| `project_id` | String(36) | Requis |
| `author_id` | String(36) | Requis |
| `author_name` | String(128) | Requis |
| `content` | String(2048) | Requis |

### Buckets de stockage

| Bucket ID | Contenu | Taille max |
|-----------|---------|-----------|
| `jam-covers` | Images de couverture des jams | 5 Mo |
| `project-assets` | Screenshots et builds | 20 Mo |
| `avatars` | Photos de profil | 2 Mo |

### Réaltime (chat en direct)

1. Le browser ouvre une WebSocket vers `wss://api.konfiturgame.fr/v1/realtime`
2. Il s'abonne : `databases.konfitur-db.collections.chat_messages.documents`
3. Quand un message est envoyé, Appwrite notifie tous les abonnés
4. Le hook `useRealtimeChat` reçoit l'événement et met à jour React

---

## 11. Flux d'authentification

### Inscription

```
1. Formulaire (pseudo, email, mot de passe)
2. account.create('unique()', email, password, name)
3. account.createEmailPasswordSession(email, password)
   → Cookie de session posé automatiquement
4. Redirection vers /
```

### Connexion

```
1. account.createEmailPasswordSession(email, password)
   → Cookie a_session_{APPWRITE_PROJECT_ID} posé dans le browser
2. AuthContext mis à jour
3. Redirection vers / ou vers la page demandée
```

### Protection des routes

```
proxy.ts → vérifie IP bannie → si oui : 403
middleware.ts → vérifie cookie session → si absent : redirect /auth/login
admin/layout.tsx → vérifie appartenance équipe admin → si non : notFound() (404)
```

---

## 12. Flux de données (exemple complet)

### Envoyer un message dans le chat

```
Client Component JamChat
    │
    │ 1. databases.createDocument(...)   ← SDK Appwrite (browser)
    │
    ▼
Appwrite (vérifie session + permissions → insère en MariaDB → publie dans Redis)
    │
    ▼
Appwrite Realtime Worker (lit Redis → notifie WebSocket subscribers)
    │
    ▼
useRealtimeChat → setMessages() → React re-render
```

### Créer une guilde et s'inscrire à une jam

```
Client Component (CreateTeamModal)
    │
    ├── createTeam({ name, leaderId }) → Server Action
    │     - Génère invite_code (KG-XXXXXXXX)
    │     - Crée teams doc avec jam_ids: [jamId]
    │     - Crée team_members doc (is_leader: true)
    │
    └── registerTeamToJam(teamId, jamId) → Server Action
          - Vérifie que l'user n'est pas déjà dans une équipe pour cette jam
          - Query.contains('jam_ids', jamId) pour trouver conflits
          - Ajoute jamId au tableau jam_ids de la guilde
```

---

## 13. OAuth (Google & Discord)

### Configuration dev

Le service appwrite en dev est configuré avec `_APP_DOMAIN: localhost` (sans port).
Traefik route `Host(localhost)` → Appwrite via `docker-compose.override.yml`.

### Redirect URIs à enregistrer

#### Google Cloud Console

| Environnement | URI |
|---|---|
| Dev | `http://localhost/v1/account/sessions/oauth2/callback/google/konfitur-game` |
| Prod | `https://api.konfiturgame.fr/v1/account/sessions/oauth2/callback/google/konfitur-game` |

#### Discord Developer Portal

| Environnement | URI |
|---|---|
| Dev | `http://localhost/v1/account/sessions/oauth2/callback/discord/konfitur-game` |
| Prod | `https://api.konfiturgame.fr/v1/account/sessions/oauth2/callback/discord/konfitur-game` |

### Activer dans la console Appwrite

Console → ton projet → Auth → Settings → OAuth2 Providers → Google / Discord → coller Client ID + Secret.

---

## 14. Variables d'environnement

### Règle d'or
Les variables `NEXT_PUBLIC_*` sont **visibles par le navigateur**. Ne jamais y mettre de secrets.

| Variable | Côté | Description |
|----------|------|-------------|
| `NEXT_PUBLIC_APPWRITE_ENDPOINT` | Client + Serveur | URL publique Appwrite |
| `NEXT_PUBLIC_APPWRITE_PROJECT_ID` | Client + Serveur | ID du projet Appwrite |
| `NEXT_PUBLIC_SITE_URL` | Client | URL du site |
| `APPWRITE_INTERNAL_ENDPOINT` | Serveur uniquement | URL interne Docker (Server Actions) |
| `APPWRITE_API_KEY` | Serveur uniquement | Clé secrète admin |
| `DOMAIN` | Docker | Domaine principal |
| `APPWRITE_PROJECT_ID` | Docker + Appwrite | ID du projet |
| `APPWRITE_OPENSSL_KEY` | Appwrite | Clé de chiffrement |
| `MARIADB_ROOT_PASSWORD` | Docker | Mot de passe root MariaDB |
| `MARIADB_PASSWORD` | Docker | Mot de passe utilisateur appwrite |
| `ADMIN_EMAIL` | Traefik | Email pour Let's Encrypt |
| `SMTP_*` | Appwrite | Configuration email |
| `TRAEFIK_DASHBOARD_AUTH` | Traefik | Auth basique dashboard |

---

## 15. Scripts utilitaires

### `seed-data.sh` — Initialiser la base de données

```bash
chmod +x scripts/seed-data.sh
./scripts/seed-data.sh
```

Crée : base `konfitur-db`, 8 collections, jam "Spring Jam 2025", message épinglé, annonce.
**Idempotent** — relançable sans risque.

---

### `backup.sh` — Sauvegarder les données

```bash
./scripts/backup.sh                          # dans ./backups/YYYY-MM-DD_HH-MM/
./scripts/backup.sh /chemin/vers/dossier     # dans un dossier personnalisé
```

Contenu du backup : `mariadb.sql`, volumes Appwrite (uploads, config, functions, certificates), code source, `MANIFEST.txt`.

---

### `restore.sh` — Restaurer depuis un backup

```bash
./scripts/restore.sh ./backups/2025-06-01_14-30
```

Restaure MariaDB + volumes Appwrite. Demande confirmation avant d'écraser les données.

---

## 16. Commandes utiles

```bash
# ── Docker ────────────────────────────────────
docker compose ps                          # état des services
docker compose logs -f [service]           # logs
docker compose restart frontend            # redémarrer un service
docker compose up -d --build frontend      # rebuild + redémarrer

# ── Appwrite ──────────────────────────────────
./scripts/seed-data.sh                     # (re)initialiser les collections
./scripts/backup.sh                        # backup

# Migration Appwrite (après upgrade de version)
docker exec konfitur-appwrite php /usr/src/code/app/cli.php migrate

# ── Next.js (dans le container) ──────────────
docker exec konfitur-frontend sh -c "cd /app && pnpm type-check"
docker exec konfitur-frontend sh -c "cd /app && npx vitest run"

# ── Tests ─────────────────────────────────────
# Les tests DOIVENT tourner dans le container (node_modules uniquement là)
docker exec konfitur-frontend sh -c "cd /app && npx vitest run src/__tests__/actions-teams.test.ts"

# ── Réinitialisation complète ─────────────────
docker compose down -v && docker compose up -d && ./scripts/seed-data.sh
```

---

## 17. Cloner l'environnement sur un autre PC

### Méthode A — Depuis Git (données fraîches)

```bash
git clone https://github.com/<org>/KonfiturGame.git
cd KonfiturGame
cp .env.example .env    # remplir les secrets
mkdir -p traefik/acme && touch traefik/acme/acme.json && chmod 600 traefik/acme/acme.json
docker compose up -d
# Configurer Appwrite (étape 3 de la section 6)
./scripts/seed-data.sh
```

### Méthode B — Depuis un backup

```bash
# Sur l'ancien PC
./scripts/backup.sh /tmp/migration
tar -czf /tmp/konfitur-migration.tar.gz -C /tmp migration/

# Sur le nouveau PC
git clone https://github.com/<org>/KonfiturGame.git && cd KonfiturGame
cp /tmp/konfitur-env.txt .env
mkdir -p traefik/acme && touch traefik/acme/acme.json && chmod 600 traefik/acme/acme.json
mkdir -p backups && tar -xzf /tmp/konfitur-migration.tar.gz -C backups/
./scripts/restore.sh ./backups/migration
docker compose up -d
```

---

## 18. Problèmes fréquents

| Problème | Solution |
|----------|----------|
| Appwrite console → 500 "Unknown attribute: devKeys" | Lancer `docker exec konfitur-appwrite php /usr/src/code/app/cli.php migrate` puis `docker restart konfitur-appwrite` |
| `node_modules` Docker corrompu (fichier texte au lieu d'un dossier) | `rm frontend/node_modules && git rm --cached frontend/node_modules` |
| Tests `vitest` Permission denied sur host | Lancer dans le container : `docker exec konfitur-frontend sh -c "cd /app && npx vitest run"` |
| `pnpm-lock.yaml` EACCES sur WSL2 | Générer dans /tmp : `docker run --rm -v /tmp/pnpm-gen:/app -w /app node:20-alpine sh -c "corepack enable pnpm && pnpm install --no-frozen-lockfile"` |
| OAuth "redirect_uri mismatch" | Vérifier que `_APP_DOMAIN: localhost` (sans port) est dans l'override + que le router `appwrite-dev` existe dans le dashboard Traefik |
| Router Traefik `appwrite-dev` absent | Ajouter `traefik.docker.network=konfitur-net` sur le service appwrite dans l'override (Appwrite est sur 2 réseaux) |
| Attributs Appwrite bloqués en "processing" | Vérifier que `appwrite-worker-databases` tourne : `docker compose ps appwrite-worker-databases` |
| Chat ne se met pas à jour en temps réel | Vérifier `appwrite-realtime` + CSP `connect-src` dans `middlewares.yml` |
| "Le site ne s'affiche pas" en prod | Vérifier DNS (`dig konfiturgame.fr`), ports 80/443 ouverts, `chmod 600 traefik/acme/acme.json` |

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
TESTS                   → docker exec konfitur-frontend sh -c "cd /app && npx vitest run"
MIGRATION APPWRITE      → docker exec konfitur-appwrite php .../cli.php migrate
CONSOLE APPWRITE        → http://localhost:8080/console (dev) | https://api.DOMAIN/console (prod)
DASHBOARD TRAEFIK       → http://localhost:8081/dashboard/ (dev)
SITE                    → http://localhost:3000 (dev) | https://konfiturgame.fr (prod)
```

---

*Documentation — KonfiturGame · Stack : Next.js 16.2.3 · Appwrite 1.8.0 · Traefik v3.6.7 · Docker Compose v2 · Mise à jour : 2026-04-16*
