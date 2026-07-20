# KonfiturGame — Documentation

> Guide de prise en main de l'infrastructure et du code, du démarrage à la production.

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture globale](#2-architecture-globale)
3. [Les services](#3-les-services)
4. [Structure des fichiers](#4-structure-des-fichiers)
5. [Choix techniques](#5-choix-techniques)
6. [Premier démarrage](#6-premier-démarrage)
7. [Démarrage quotidien](#7-démarrage-quotidien)
8. [Accéder aux services](#8-accéder-aux-services)
9. [Le projet Next.js en détail](#9-le-projet-nextjs-en-détail)
10. [Appwrite — Le backend](#10-appwrite--le-backend)
11. [Flux d'authentification](#11-flux-dauthentification)
12. [Flux de données](#12-flux-de-données)
13. [OAuth (Google & Discord)](#13-oauth-google--discord)
14. [Variables d'environnement](#14-variables-denvironnement)
15. [Scripts utilitaires](#15-scripts-utilitaires)
16. [Commandes utiles](#16-commandes-utiles)
17. [Cloner l'environnement](#17-cloner-lenvironnement)
18. [Problèmes fréquents](#18-problèmes-fréquents)

---

## 1. Vue d'ensemble

KonfiturGame est une **plateforme web de game jams** (compétitions de création de jeux vidéo). Elle permet de :

- Créer et rejoindre des game jams (en équipe ou en solo, via une team solo personnelle unique)
- Former des guildes (équipes persistantes réutilisables sur plusieurs jams), avec liste `/dashboard/teams` et page hub/vitrine `/team/[teamId]`
- Soumettre des projets, les liker et les commenter
- Désigner un podium (top 3) par jam, côté organisateur
- Chatter en temps réel pendant la jam, et en privé au sein de son équipe (épinglage, signalement)
- Gérer son profil utilisateur
- Administrer la plateforme (utilisateurs, jams, équipes, modération, logs, ban IP — actions admin journalisées)

**Stack principale :**

| Composant | Technologie | Version |
|-----------|-------------|---------|
| Frontend | Next.js (App Router) | 16.2.9 |
| Backend | Appwrite self-hosted | 1.9.0 |
| Console Appwrite | appwrite/console (image séparée depuis 1.9) | 7.5.7 |
| Exécution des fonctions | openruntimes/executor | 0.11.4 |
| Reverse proxy | Traefik | v3.6.7 |
| Base de données | MariaDB | 10.11 |
| Cache / Realtime | Redis | 7-alpine |
| Package manager | pnpm | — |

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

**Réseaux Docker :**

```
konfitur-net  → Traefik + Frontend + Appwrite   (réseau "public")
appwrite-net  → Appwrite + MariaDB + Redis       (réseau "privé")
```

MariaDB et Redis ne sont **jamais exposés** directement à Traefik. Seul Appwrite peut leur parler.

---

## 3. Les services

### Traefik
Point d'entrée unique. Gère le TLS Let's Encrypt (renouvellement automatique), redirige HTTP → HTTPS, route selon le domaine, applique les middlewares de sécurité (CSP, HSTS, rate limiting).

### Next.js (Frontend)
L'application web. Génère les pages côté serveur (SSR), contient la logique métier, communique avec Appwrite. Intègre deux middlewares empilés :
- `proxy.ts` — bot-detection + vérification ban IP (s'exécute en premier, Edge runtime)
- `middleware.ts` — protection des routes `/dashboard/*` et `/admin/*`

### Appwrite
Backend clé en main auto-hébergé. Fournit : Auth (email/password + OAuth2), Database NoSQL, Realtime (WebSocket), Storage, Functions.

> **Après toute montée de version Appwrite :** la migration de base est obligatoire — `docker exec konfitur-appwrite php /usr/src/code/app/cli.php migrate` puis flush Redis et redémarrage. Procédure complète : `MISE-A-JOUR.md §4`.

### Appwrite Console
Depuis Appwrite 1.9, la console web est une **image Docker séparée** (`appwrite/console`), servie sur `/console`. Elle ne fait que du statique — toute la logique passe par l'API `appwrite`.

### Appwrite Realtime
Worker séparé gérant uniquement les connexions WebSocket. Le chat en direct passe exclusivement par lui. Routé séparément via le path `/v1/realtime`.

### Workers Appwrite
Depuis la 1.9, plusieurs workers dédiés sont requis (sans eux, certaines features échouent silencieusement) :

| Service | Rôle |
|---------|------|
| `appwrite-worker-databases` | Création d'attributs et d'indexes |
| `appwrite-worker-mails` | Envoi SMTP (vérification email, récupération mdp) |
| `appwrite-worker-builds` | Compilation des fonctions |
| `appwrite-worker-functions` | Exécution des fonctions (cron, triggers) |
| `appwrite-executor` | Sandbox d'exécution des fonctions (image `openruntimes/executor`) |

### ClamAV
Scan antivirus des fichiers uploadés (`clamav/clamav:1.4`) — utilisé par le bucket `project-builds` (`antivirus: true`). Partage le volume `appwrite-uploads` en lecture seule avec Appwrite (clamd reçoit un chemin de fichier, pas le contenu).

### MariaDB
Base de données d'Appwrite. On n'interagit jamais directement avec elle — tout passe par Appwrite.

### Redis
Cache et bus d'événements d'Appwrite.

> **Redis sans `--requirepass` :** Appwrite (bug toujours présent en 1.9.0) n'envoie jamais la commande `AUTH` dans `Queue\Connection\Redis`. Redis est isolé sur `appwrite-net` (non exposé), donc ce n'est pas un risque de sécurité.

---

## 4. Structure des fichiers

```
KonfiturGameFullInfra/
│
├── docker-compose.yml          ← Définit tous les services (production)
├── docker-compose.override.yml ← Surcharges pour le développement local (auto-appliqué)
├── .env                        ← Secrets actifs (jamais commité)
├── .env.example                ← Template des variables
│
├── traefik/
│   ├── traefik.yml             ← Config statique prod (ACME, ports 80+443)
│   ├── traefik.dev.yml         ← Config statique dev (HTTP uniquement, ports 80+8080)
│   └── dynamic/
│       ├── middlewares.yml     ← Sécurité, rate limiting, CSP, headers
│       └── tls.yml             ← Options TLS (versions, ciphers)
│
├── scripts/
│   ├── seed-data.sh            ← Crée les collections ET insère des données de test (idempotent)
│   ├── create-log-collections.sh ← Crée les collections audit_logs et banned_ips
│   ├── backup.sh               ← Sauvegarde MariaDB + volumes Appwrite
│   ├── restore.sh              ← Restaure depuis un backup
│   └── init-appwrite.sh        ← Crée uniquement la base de données (usage limité)
│
├── appwrite.json               ← Config Appwrite versionnée (tables, buckets, teams, fonctions)
├── functions/
│   └── update-jam-status/      ← Fonction Appwrite cron (statuts des jams, toutes les 5 min)
│
├── .github/workflows/
│   └── ci-cd.yml               ← Pipeline CI/CD complet (lint, tests, scan, déploiement)
│
├── docs/
│   ├── DOCUMENTATION.md        ← Ce fichier (guide technique développeur)
│   ├── UTILISATION.md          ← Manuel d'utilisation (participants, organisateurs, admins)
│   ├── DEPLOIEMENT.md          ← Manuel de déploiement production
│   ├── MISE-A-JOUR.md          ← Manuel de mise à jour (npm, Appwrite, Traefik…)
│   ├── CAHIER-DE-RECETTES.md   ← Tests d'acceptation et checklist avant mise en prod
│   ├── DOC_test_E2E.md         ← Documentation de la suite E2E Playwright
│   ├── CI-CD.md                ← Guide pipeline CI/CD
│   ├── DATABASE.md             ← Schéma ERD de la base de données
│   ├── BRANCH-PROTECTION.md    ← Rulesets GitHub et gestion des branches
│   └── TODO.md                 ← Roadmap et fonctionnalités
│
└── frontend/                   ← L'application Next.js
    ├── Dockerfile              ← Build production (multi-stage)
    ├── Dockerfile.dev          ← Build développement (hot reload)
    ├── package.json
    ├── next.config.mjs
    ├── tsconfig.json
    ├── vitest.config.ts
    ├── playwright.config.ts    ← Config E2E (baseURL, workers: 1, reporters)
    ├── e2e/                    ← Tests end-to-end Playwright (voir docs/DOC_test_E2E.md)
    │   ├── global-setup.ts     ← Crée users + jams de test avant le run
    │   ├── global-teardown.ts  ← Nettoie toutes les données E2E après le run
    │   ├── fixtures/           ← Contextes authentifiés (user1Page, adminPage…)
    │   └── tests/              ← 9 specs : smoke, auth, navigation, guildes, projets, chat, profil, organisateur, admin
    └── src/
        ├── app/                ← Routes Next.js (App Router)
        ├── components/         ← Composants React réutilisables
        ├── lib/                ← Utilitaires, SDK Appwrite, actions serveur
        ├── hooks/              ← Custom React hooks
        ├── types/              ← Types TypeScript
        ├── __tests__/          ← Tests unitaires Vitest
        ├── proxy.ts            ← Middleware bot-detection + ban IP (Edge)
        └── middleware.ts       ← Protection des routes (auth)
```

### Détail `src/app/` (les pages)

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
├── og/route.tsx                ← Open Graph image dynamique (Edge)
│
├── api/
│   ├── banned-ips/route.ts     ← API route : liste des IPs bannies (lue par proxy.ts)
│   └── log/route.ts            ← API route : enregistrement des logs
│
├── explore/
│   ├── page.tsx                ← /explore — Toutes les jams
│   └── ExploreGrid.tsx         ← Grille + filtres (Client Component)
│
├── jam/[jamId]/
│   ├── page.tsx                ← /jam/:id — Détail d'une jam
│   ├── JamTeamsSection.tsx     ← Section équipes avec actions (Client)
│   └── loading.tsx             ← Skeleton
│
├── team/[teamId]/              ← /team/:id — Vitrine publique / hub privé (double mode selon viewerRole)
│   ├── page.tsx                ← Server Component — tchat privé rendu pour les membres uniquement
│   ├── TeamCard.tsx            ← Gestion membre (code d'invitation, renommage, quitter)
│   ├── SubmitProjectForm.tsx
│   └── FileUploadField.tsx
│
├── project/[projectId]/
│   ├── page.tsx                ← /project/:id — Page d'un projet soumis
│   └── ProjectInteractions.tsx ← Likes et commentaires (Client)
│
├── profile/[userId]/page.tsx   ← /profile/:id — Profil public d'un utilisateur
│
├── legal/
│   ├── _components.tsx         ← Composants partagés des pages légales
│   ├── layout.tsx
│   ├── mentions-legales/       ← /legal/mentions-legales (requis RGPD, vérifié par CI)
│   ├── privacy/                ← /legal/privacy (politique vie privée, requis RGPD)
│   └── terms/                  ← /legal/terms — Conditions d'utilisation
│
├── dashboard/
│   ├── layout.tsx              ← Layout dashboard (sidebar)
│   ├── page.tsx                ← /dashboard — Vue d'ensemble
│   ├── DashboardSidebar.tsx
│   ├── participations/page.tsx ← /dashboard/participations
│   ├── teams/                  ← /dashboard/teams — Liste de mes guildes (cards → hub /team/:id)
│   │   ├── page.tsx            ← Server Component
│   │   ├── TeamsListClient.tsx ← Liste + modales (Client)
│   │   ├── CreateTeamModal.tsx
│   │   └── JoinTeamModal.tsx
│   ├── profile/
│   │   ├── page.tsx            ← /dashboard/profile — Modifier son profil
│   │   └── ProfileForm.tsx
│   └── my-jams/
│       ├── page.tsx            ← /dashboard/my-jams — Mes jams organisées
│       ├── new/page.tsx        ← /dashboard/my-jams/new — Créer une jam
│       └── [jamId]/
│           ├── page.tsx        ← /dashboard/my-jams/:id — Gérer une jam
│           ├── EditJamForm.tsx
│           └── AnnouncementForm.tsx
│
├── admin/
│   ├── layout.tsx              ← Vérification appartenance équipe admin
│   ├── page.tsx                ← /admin — Statistiques globales
│   ├── AdminSidebar.tsx
│   ├── users/page.tsx          ← Recherche + liste des utilisateurs
│   ├── jams/
│   │   ├── page.tsx            ← Liste filtrable par statut + lien « Gérer »
│   │   ├── DeleteJamButton.tsx
│   │   └── [jamId]/            ← /admin/jams/:id — Gestion d'une jam (superpouvoirs)
│   │       ├── page.tsx        ← Édition de n'importe quelle jam + équipes + projets
│   │       ├── AdminTeamActions.tsx    ← Renommer / retirer un membre / dissoudre
│   │       └── AdminProjectActions.tsx ← Retirer la soumission d'un projet
│   ├── teams/page.tsx          ← /admin/teams — Toutes les équipes (recherche + actions)
│   ├── moderation/             ← Signalements avec liens de contexte + retrait de soumission
│   │   ├── page.tsx            ← 3 sections : messages de jam, messages de team, projets
│   │   ├── ReportedMessagesList.tsx
│   │   ├── ReportedTeamMessagesList.tsx
│   │   └── ReportedProjectsList.tsx
│   ├── featured/page.tsx       ← Mises en avant + podium (« Gagnants »)
│   ├── announcements/page.tsx
│   └── logs/
│       ├── page.tsx            ← /admin/logs — Logs d'audit filtrables par type + IPs bannies
│       ├── BanIPForm.tsx
│       ├── UnbanButton.tsx
│       └── ClearLogsButton.tsx
│
└── auth/
    ├── login/page.tsx + layout.tsx
    ├── register/page.tsx + layout.tsx
    ├── forgot-password/        ← Demande de réinitialisation du mot de passe
    ├── reset-password/         ← Saisie du nouveau mot de passe (lien email)
    └── verify-email/           ← Vérification d'adresse email
```

### Détail `src/lib/` (la logique)

```
src/lib/
├── appwrite/
│   ├── client.ts           ← SDK Appwrite navigateur (package `appwrite` 23.0.0)
│   ├── server.ts           ← SDK Appwrite serveur (package `node-appwrite`, clé API)
│   ├── config.ts           ← IDs collections, buckets, ADMIN_TEAM_ID — source de vérité
│   ├── types.ts            ← Mappers : Documents Appwrite → Types TypeScript
│   ├── session.ts          ← createSessionClient() — client serveur scopé par le cookie de session
│   ├── fetch-all.ts        ← fetchAllDocs / fetchAllByField — pagination complète (anti-plafond 25)
│   ├── guards.ts           ← Gardes réutilisables
│   ├── file-url.ts         ← URLs des fichiers de bucket
│   ├── participant-counts.ts ← Compteurs participants dérivés des teams (2 requêtes batchées)
│   └── internal-host.ts    ← URL Appwrite interne Docker (Server Actions)
│
├── actions/
│   ├── jams.ts             ← CRUD jams
│   ├── teams.ts            ← Guildes : créer, rejoindre, inscrire, gérer rôles
│   ├── projects.ts         ← Soumettre un projet, toggleLike, getPopularProjects, getProjectByTeamAndJam
│   ├── chat.ts             ← Chat de jam : épingler/signaler, pagination des messages
│   ├── team-chat.ts        ← Tchat privé d'équipe : envoi avec permissions par membre, pagination, épinglage, signalement
│   ├── comments.ts         ← CRUD commentaires
│   ├── export.ts           ← Export RGPD des données utilisateur
│   ├── announcements.ts    ← CRUD annonces
│   ├── dashboard.ts        ← getUserTeams, getUserParticipations
│   ├── home.ts             ← Stats page d'accueil (jams en cours, gagnants)
│   ├── admin.ts            ← Actions admin (modération, featured, setProjectPlacement, listAllJams, listAllTeams) — garde `requireAdminOrThrow`
│   ├── logs.ts             ← Logs d'audit + ban/unban IP — lectures et écritures gardées admin
│   ├── profile.ts          ← Server Actions profil (nom, bio, mdp, suppression compte)
│   └── profile.client.ts   ← Upload avatar (côté client)
│
├── validators.ts           ← Validateurs profil, jam
├── jam-status.ts           ← computeJamStatus(start, end) — statut calculé depuis les dates
├── seo.ts                  ← Helpers JSON-LD (generateJamJsonLd, generateProjectJsonLd…)
├── bot-detection.ts        ← Détection bots (User-Agent, patterns URL) — Edge-compatible
└── mockData.ts             ← Données de démonstration (fallback)
```

### Tests unitaires (`src/__tests__/`)

**354 tests** répartis sur 26 fichiers (mappers, validators, actions — profil, chat, team-chat, teams, projects, home, dashboard, announcements, admin, logs, export —, gardes, URLs de fichiers, compteurs participants, bot-detection, SEO). Détail par fichier : `docs/TODO.md → TESTS`.

### Tests end-to-end (`e2e/`)

Suite Playwright (Chromium headless, séquentielle) couvrant les parcours critiques : smoke, auth, navigation publique, guildes, projets, chat temps réel, profil, organisateur, admin.

```bash
cd frontend && pnpm e2e     # infra Docker requise (frontend :3000 + Appwrite :8080)
```

Documentation complète (fixtures, cycle de vie, pièges) : `docs/DOC_test_E2E.md`.

---

## 5. Choix techniques

Sept choix structurants, avec le contexte, les alternatives envisagées et la justification retenue.

### Next.js 16 + App Router

**Alternatives envisagées :** SPA React + API REST séparée, Nuxt (Vue), Remix.
**Retenu parce que :** le SSR natif est indispensable pour le SEO d'une plateforme publique (pages jams et projets indexables) et pour la performance perçue. Les Server Components réduisent le JavaScript envoyé au client — les pages de consultation (jam, projet, équipe) n'embarquent quasiment aucun JS applicatif. Les Server Actions fournissent des mutations typées de bout en bout **sans exposer d'API REST publique** : moins de surface d'attaque, pas de couche de sérialisation à maintenir, pas de waterfall client.
**Trade-off assumé :** couplage au modèle mental App Router (frontière Server/Client Components à maîtriser).

### Appwrite plutôt qu'un backend custom

**Alternatives envisagées :** backend Node.js/Express custom, Firebase, Supabase.
**Retenu parce que :** Appwrite fournit Auth (email + OAuth2), base de données, temps réel (WebSocket), stockage et fonctions serverless en un seul service **open-source auto-hébergé** — un gain estimé à plusieurs mois de développement par rapport à un backend custom. Contrairement à Firebase, les données restent sur notre serveur : indépendance vis-à-vis des cloud providers américains et conformité RGPD facilitée (données en Europe, maîtrise complète).
**Trade-off assumé :** on dépend du cycle de release d'Appwrite (les migrations de version demandent une procédure rigoureuse — voir `MISE-A-JOUR.md §4`).

### Traefik

**Alternatives envisagées :** Nginx + certbot, Caddy.
**Retenu parce que :** auto-discovery des services Docker via labels (ajouter un service = ajouter des labels, pas de config à recharger), ACME/Let's Encrypt natif (renouvellement automatique sans cron), middlewares dynamiques centralisés (CSP, HSTS, rate limiting déclarés une fois dans `middlewares.yml` et appliqués par routeur).

### Tailwind CSS v4

**Alternatives envisagées :** CSS Modules, styled-components.
**Retenu parce que :** utility-first avec purge automatique au build (CSS final minimal), excellente DX, et la v4 s'appuie nativement sur les CSS custom properties — le design system entier repose sur des variables (`--primary`, `--background`…) : changer le thème = changer une variable.

### TypeScript strict

`strict: true` dans `tsconfig.json`, zéro `any` toléré. Coût : quelques annotations en plus. Bénéfice : élimination d'une classe entière de bugs à la compilation et refactoring en confiance — les migrations `votes_count → likes_count` et `winner → placement` ont été guidées de bout en bout par le type-checker.

### pnpm

Plus rapide et plus économe en disque qu'npm/yarn (store global + hardlinks), lockfile strict (`--frozen-lockfile` en CI et dans le Dockerfile). **Ne jamais utiliser `npm` ou `yarn` dans ce projet.**

### Guildes multi-jam plutôt qu'équipes éphémères

**Choix produit, pas technique :** la plateforme est née dans la communauté FRVtubers — l'objectif est de favoriser la formation de **communautés durables**, pas d'équipes jetables. L'architecture initiale (`jam_id: string`, une équipe = une jam) a été migrée vers `jam_ids: string[]` : une guilde persiste et s'inscrit à plusieurs jams sans se reformer. Conséquence sur le schéma : les projets ne sont plus rattachés à l'équipe mais retrouvés par `(team_id, jam_id)` — une guilde soumet un projet différent par jam.

---

## 6. Premier démarrage

### Prérequis
- Docker Desktop installé et démarré
- `curl` et `jq` (`sudo apt install curl jq` sur WSL/Linux)

### Étape 1 — Créer `.env`

```bash
cp .env.example .env
# Remplir les secrets :
openssl rand -hex 32     # → APPWRITE_OPENSSL_KEY
openssl rand -base64 32  # → MARIADB_ROOT_PASSWORD
openssl rand -base64 32  # → MARIADB_PASSWORD
```

### Étape 2 — Lancer l'infrastructure

```bash
docker compose up -d
docker compose ps   # vérifier que tout est "Up"
```

### Étape 3 — Configurer Appwrite (première fois uniquement)

1. Ouvrir `http://localhost:8080/console`
2. Créer un compte administrateur
3. Créer un projet, ID : `konfitur-game` (doit correspondre à `APPWRITE_PROJECT_ID` dans `.env`)
4. Settings → Platforms → Web → hostname : `localhost`
5. Settings → API Keys → créer une clé avec tous les scopes
6. Copier la clé dans `.env` → `APPWRITE_API_KEY`
7. `docker compose restart frontend`

### Étape 4 — Initialiser la base de données

```bash
chmod +x scripts/seed-data.sh
./scripts/seed-data.sh
```

Crée `konfitur-db`, les collections principales et une jam de démonstration. **Idempotent** — relançable sans risque.

Pour les collections de logs (audit_logs, banned_ips) :

```bash
chmod +x scripts/create-log-collections.sh
./scripts/create-log-collections.sh
```

Puis ajouter `LOG_INTERNAL_SECRET=<secret>` dans `.env`.

### Étape 5 — Vérifier

```bash
curl -I http://localhost:3000         # frontend
curl http://localhost:8080/v1/locale  # Appwrite API
```

---

## 7. Démarrage quotidien

```bash
# Démarre tout (dev — docker-compose.override.yml appliqué automatiquement)
docker compose up

# En arrière-plan
docker compose up -d

# Logs en temps réel
docker compose logs -f
docker compose logs -f frontend
```

---

## 8. Accéder aux services

### Développement

| Service | URL |
|---------|-----|
| Site web | `http://localhost:3000` |
| Console Appwrite | `http://localhost:8080/console` |
| Appwrite API | `http://localhost:8080/v1` |
| Dashboard Traefik | `http://localhost:8081/dashboard/` |

### Production

| Service | URL |
|---------|-----|
| Site web | `https://konfiturgame.fr` |
| Console Appwrite | `https://api.konfiturgame.fr/console` |
| Dashboard Traefik | `https://traefik.konfiturgame.fr/dashboard/` |

---

## 9. Le projet Next.js en détail

### Server vs Client Components

```tsx
// Server Component (par défaut) — fetch directement côté serveur
export default async function JamPage({ params }) {
  const jam = await getJam(params.jamId)
  return <div>...</div>
}

// Client Component — directive obligatoire
'use client'
import { useState } from 'react'
export default function JamTeamsSection({ teams }) {
  const [showCreate, setShowCreate] = useState(false)
  return <section>...</section>
}
```

**Pattern Server → Client :** le Server Component fetch les données et les passe sérialisées au Client Component. Pas de waterfall client-side.

### Server Actions

```tsx
// src/lib/actions/teams.ts
'use server'
export async function createTeam(data: { name: string; leaderId: string }) {
  const doc = await serverDatabases.createDocument(...)
  return { success: true, id: doc.$id }
}

// Dans un Client Component :
import { createTeam } from '@/lib/actions/teams'
const result = await createTeam({ name: 'Team Pixel', leaderId: user.$id })
```

### Client Appwrite : navigateur vs serveur

```ts
// Navigateur uniquement (dans 'use client')
import { account, databases } from '@/lib/appwrite/client'

// Serveur (Server Actions, API routes)
import { serverDatabases } from '@/lib/appwrite/server'
```

### Middleware empilés

```
proxy.ts       → vérifie IP bannie → si oui : 403
middleware.ts  → vérifie cookie session → si absent : redirect /auth/login
admin/layout   → vérifie appartenance équipe admin → si non : notFound() (404)
```

### Design system (Tricolore Dark)

```css
--background       #0C1018   /* Fond principal */
--card             #131921   /* Fond des cartes */
--foreground       #F0EDE8   /* Texte principal */
--muted-foreground #8891A4   /* Texte secondaire */
--primary          #4F6AFF   /* Bleu — CTA, liens actifs */
--secondary        #EF233C   /* Rouge — danger, accents */
--error            #FF6B81   /* Texte d'erreur (contraste AA) */
--success          #34D399   /* Vert */
--border           #1E2736   /* Bordures */
--radius           0px       /* Pas d'arrondi — intentionnel */
--font-sans        Space Grotesk
--font-mono        JetBrains Mono
```

**Règles absolues :**
1. Zéro `border-radius` — tout est rectangulaire
2. Couleurs via `style={}` — jamais hardcodées en classe Tailwind
3. Layout via classes Tailwind (`flex`, `grid`, `gap`, `p-`, `m-`)
4. Icônes : Lucide React exclusivement
5. Dates : `toLocaleDateString('fr-FR')`

---

## 10. Appwrite — Le backend

### Collections

```
Base de données : konfitur-db
│
├── game_jams          ← Les jams (titre, thème, dates, règles, statut, featured…)
├── teams              ← Les guildes (jam_ids[], nom, code invitation, chef, is_solo)
├── team_members       ← Membres des guildes (rôle, is_leader, avatar_url)
├── projects           ← Jeux soumis (likes_count, placement 0-3, retrouvés par team_id + jam_id)
├── chat_messages      ← Messages du chat de jam (3 canaux)
├── team_chat_messages ← Tchat privé des équipes (row security, permissions read par membre, 0 permission table)
├── announcements      ← Annonces des organisateurs
├── comments           ← Commentaires sur les projets
├── likes              ← Likes togglables (1 doc par couple user + projet)
├── audit_logs         ← Logs d'actions admin et erreurs
└── banned_ips         ← IPs bannies par les admins
```

> Voir `docs/DATABASE.md` pour le schéma ERD complet et les types de chaque attribut.

### Buckets

| Bucket ID | Contenu | Taille max |
|-----------|---------|-----------|
| `jam-covers` | Images de couverture des jams | 2 Mo |
| `project-assets` | Covers et screenshots des projets | 10 Mo |
| `project-builds` | Builds jouables (zip) — scan ClamAV | 150 Mo |
| `avatars` | Photos de profil | 1 Mo |

### Realtime (chats en direct)

1. Le browser ouvre une WebSocket vers `wss://api.konfiturgame.fr/v1/realtime`
2. Il s'abonne : `databases.konfitur-db.collections.{chat_messages | team_chat_messages}.documents`
3. Quand un document est créé/modifié/supprimé, Appwrite notifie les abonnés **autorisés à le lire** (pour `team_chat_messages`, seuls les membres porteurs d'une permission `read` reçoivent l'événement : la privacité est native)
4. Le hook partagé `useRealtimeChat` (utilisé par `JamChat` et `TeamChat`) reçoit l'événement : create dédoublonné par id + ping sonore, update remplacé (épinglage/signalement propagés), delete retiré

### IDs — source de vérité

Tous les IDs (DATABASE_ID, collections, buckets, ADMIN_TEAM_ID) sont définis dans `frontend/src/lib/appwrite/config.ts`. Toujours importer de là, jamais hardcoder ailleurs.

---

## 11. Flux d'authentification

### Inscription
```
1. Formulaire (pseudo, email, mot de passe)
2. account.create('unique()', email, password, name)
3. account.createEmailPasswordSession(email, password)
   → Cookie a_session_{PROJECT_ID} posé automatiquement
4. Redirection vers /
```

### Connexion
```
1. account.createEmailPasswordSession(email, password)
   → Cookie posé dans le browser
2. AuthContext mis à jour via AuthProvider
3. Redirection vers / ou la page demandée (?redirect=...)
```

### Protection des routes
```
proxy.ts → ban IP → 403
middleware.ts → cookie absent → redirect /auth/login?redirect=...
admin/layout.tsx → équipe admin → notFound() si non-admin
```

---

## 12. Flux de données

### Envoyer un message dans le chat

```
Chat de jam (public)                          Tchat d'équipe (privé)
Client Component JamChat                      Client Component TeamChat
    │                                             │
    │ sendChatMessage(...) ← Server Action        │ sendTeamChatMessage(...) ← Server Action
    │                                             │
    └──────────────────┬──────────────────────────┘
                       │
       Les deux chemins sont identiques : identité dérivée de la session
       serveur (jamais fournie par le client), contenu échappé et longueur
       validée après échappement (sanitizeChatContent, src/lib/chat-utils.ts).
       Seul le tchat d'équipe pose en plus une permission read(user:X) par
       membre courant (row security de team_chat_messages).
                       │
                       ▼
Appwrite (vérifie session + permissions → insère en MariaDB → publie dans Redis)
    │
    ▼
Appwrite Realtime Worker (lit Redis → notifie les WebSocket subscribers autorisés)
    │
    ▼
useRealtimeChat → setMessages() → React re-render (dédoublonné par id, pas d'ajout optimiste)
```

### Créer une guilde et s'inscrire à une jam

```
Client Component (CreateTeamModal)
    │
    ├── createTeam({ name, leaderId }) → Server Action
    │     - Génère invite_code (KG-XXXXXXXX)
    │     - Crée doc teams avec jam_ids: [jamId]
    │     - Crée doc team_members (is_leader: true)
    │
    └── registerTeamToJam(teamId, jamId) → Server Action
          - Vérifie qu'il n'y a pas de conflit (Query.contains('jam_ids', jamId))
          - Ajoute jamId au tableau jam_ids de la guilde
```

---

## 13. OAuth (Google & Discord)

### Configuration dev

Le service appwrite en dev utilise `_APP_DOMAIN: localhost` (sans port). Traefik route `Host(localhost)` → Appwrite via `docker-compose.override.yml`.

### Redirect URIs

| Provider | Dev | Prod |
|----------|-----|------|
| Google | `http://localhost/v1/account/sessions/oauth2/callback/google/konfitur-game` | `https://api.konfiturgame.fr/v1/account/sessions/oauth2/callback/google/konfitur-game` |
| Discord | `http://localhost/v1/account/sessions/oauth2/callback/discord/konfitur-game` | `https://api.konfiturgame.fr/v1/account/sessions/oauth2/callback/discord/konfitur-game` |

**Activer dans la console Appwrite :** Console → projet → Auth → Settings → OAuth2 Providers → coller Client ID + Secret.

---

## 14. Variables d'environnement

> Les variables `NEXT_PUBLIC_*` sont **visibles par le navigateur**. Ne jamais y mettre de secrets.

| Variable | Côté | Description |
|----------|------|-------------|
| `NEXT_PUBLIC_APPWRITE_ENDPOINT` | Client | URL publique Appwrite |
| `NEXT_PUBLIC_APPWRITE_PROJECT_ID` | Client | ID du projet Appwrite |
| `NEXT_PUBLIC_SITE_URL` | Client | URL du site |
| `APPWRITE_INTERNAL_ENDPOINT` | Serveur | URL interne Docker (Server Actions) |
| `APPWRITE_API_KEY` | Serveur | Clé secrète admin — jamais préfixer NEXT_PUBLIC_ |
| `LOG_INTERNAL_SECRET` | Serveur | Secret pour l'API route `/api/log` |
| `DOMAIN` | Docker | Domaine principal |
| `APPWRITE_PROJECT_ID` | Docker | ID du projet |
| `APPWRITE_OPENSSL_KEY` | Appwrite | Clé de chiffrement |
| `MARIADB_ROOT_PASSWORD` | Docker | Mot de passe root MariaDB |
| `MARIADB_PASSWORD` | Docker | Mot de passe utilisateur appwrite |
| `ADMIN_EMAIL` | Traefik | Email pour Let's Encrypt |
| `SMTP_*` | Appwrite | Configuration email |
| `TRAEFIK_DASHBOARD_AUTH` | Traefik | Auth basique dashboard (htpasswd) |

---

## 15. Scripts utilitaires

### `seed-data.sh` — Initialiser la base de données

```bash
chmod +x scripts/seed-data.sh
./scripts/seed-data.sh
```

Crée `konfitur-db`, les 8 collections principales, une jam "Spring Jam 2025", un message épinglé, une annonce. **Idempotent** — HTTP 409 ignoré sur collections existantes.

### `create-log-collections.sh` — Collections de monitoring

```bash
chmod +x scripts/create-log-collections.sh
./scripts/create-log-collections.sh
```

Crée les collections `audit_logs` et `banned_ips`. À lancer après `seed-data.sh`. Requiert `APPWRITE_API_KEY` dans `.env`.

### `backup.sh` — Sauvegarder les données

```bash
./scripts/backup.sh                      # → ./backups/YYYY-MM-DD_HH-MM/
./scripts/backup.sh /chemin/personnalisé
```

Contenu : `mariadb.sql`, volumes Appwrite (uploads, config, functions, certificates), code source, `MANIFEST.txt`.

### `restore.sh` — Restaurer depuis un backup

```bash
./scripts/restore.sh ./backups/2025-06-01_14-30
```

Demande confirmation avant d'écraser les données. Mode 1 (MariaDB + volumes) recommandé au premier choix.

---

## 16. Commandes utiles

```bash
# ── Docker ────────────────────────────────────
docker compose ps                          # état des services
docker compose logs -f [service]           # logs
docker compose restart frontend            # redémarrer un service
docker compose up -d --build frontend      # rebuild + redémarrer

# ── Tests (DOIVENT tourner dans le container) ──
docker exec konfitur-frontend sh -c "cd /app && npx vitest run"
docker exec konfitur-frontend sh -c "cd /app && npx vitest run src/__tests__/actions-teams.test.ts"

# ── Type-check et lint ──────────────────────────
docker exec konfitur-frontend sh -c "cd /app && pnpm type-check"
docker exec konfitur-frontend sh -c "cd /app && pnpm lint"

# ── Appwrite ──────────────────────────────────
./scripts/seed-data.sh
./scripts/create-log-collections.sh
./scripts/backup.sh

# Migration Appwrite (après upgrade de version)
docker exec konfitur-appwrite php /usr/src/code/app/cli.php migrate

# ── pnpm-lock.yaml sur Windows FS (EACCES sur /mnt/...) ──
mkdir -p /tmp/pnpm-gen && cp frontend/package.json /tmp/pnpm-gen/
docker run --rm -v /tmp/pnpm-gen:/app -w /app node:20-alpine sh -c "corepack enable pnpm && pnpm install --no-frozen-lockfile"
cp /tmp/pnpm-gen/pnpm-lock.yaml frontend/

# ── Réinitialisation complète ─────────────────
docker compose down -v && docker compose up -d && ./scripts/seed-data.sh
```

---

## 17. Cloner l'environnement

### Méthode A — Depuis Git (données fraîches)

```bash
git clone https://github.com/Setsuko34/KonfiturGameFullInfra.git
cd KonfiturGameFullInfra
cp .env.example .env    # remplir les secrets
mkdir -p traefik/acme && touch traefik/acme/acme.json && chmod 600 traefik/acme/acme.json
docker compose up -d
# Configurer Appwrite (étape 3 de la section 6)
./scripts/seed-data.sh
./scripts/create-log-collections.sh
```

### Méthode B — Depuis un backup

```bash
# Sur l'ancien PC
./scripts/backup.sh /tmp/migration
tar -czf /tmp/konfitur-migration.tar.gz -C /tmp migration/

# Sur le nouveau PC
git clone https://github.com/Setsuko34/KonfiturGameFullInfra.git && cd KonfiturGameFullInfra
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
| Appwrite → 500 "Unknown attribute: xyz" après montée de version | Migration incomplète : `docker exec konfitur-appwrite php /usr/src/code/app/cli.php migrate`, flush Redis, redémarrer. Si l'attribut manque encore : correction manuelle des métadonnées (voir `MISE-A-JOUR.md §4`) |
| SSR renvoie 401 "router" après migration 1.9 | Ajouter `_APP_MIGRATION_HOST=appwrite` dans l'environnement du service `appwrite` (le hostname interne Docker doit être connu du routeur Appwrite) |
| Les fonctions Appwrite ne se déploient/exécutent pas | Vérifier que `appwrite-worker-builds`, `appwrite-worker-functions` et `appwrite-executor` sont "Up" (`docker compose ps`) |
| `node_modules` Docker corrompu (fichier texte) | `rm frontend/node_modules && git rm --cached frontend/node_modules` |
| Tests `vitest` Permission denied sur host | `docker exec konfitur-frontend sh -c "cd /app && npx vitest run"` |
| `pnpm-lock.yaml` EACCES sur WSL2 | Générer dans /tmp (voir section 16) |
| OAuth "redirect_uri mismatch" | Vérifier `_APP_DOMAIN: localhost` (sans port) dans l'override + router `appwrite-dev` dans le dashboard Traefik |
| Router Traefik `appwrite-dev` absent | Ajouter `traefik.docker.network=konfitur-net` sur le service appwrite dans l'override |
| Attributs Appwrite bloqués en "processing" | `docker compose ps appwrite-worker-databases` — doit être "Up" |
| Chat ne se met pas à jour en temps réel | Vérifier `appwrite-realtime` + CSP `connect-src` dans `middlewares.yml` |
| `new URL()` crash | Le fallback doit contenir `http://`, pas juste `'localhost'` |
| `getaddrinfo for redis failed` | Déclarer `networks:` explicitement dans l'override pour `appwrite` et `appwrite-realtime` |

---

## Aide-mémoire

```
DÉMARRER (dev)          → docker compose up -d
DÉMARRER (prod)         → docker compose -f docker-compose.yml up -d
ARRÊTER                 → docker compose down
LOGS                    → docker compose logs -f [service]
SEED                    → ./scripts/seed-data.sh
LOG COLLECTIONS         → ./scripts/create-log-collections.sh
BACKUP                  → ./scripts/backup.sh
RESTORE                 → ./scripts/restore.sh ./backups/<date>
TESTS                   → docker exec konfitur-frontend sh -c "cd /app && npx vitest run"
TYPE-CHECK              → docker exec konfitur-frontend sh -c "cd /app && pnpm type-check"
MIGRATION APPWRITE      → docker exec konfitur-appwrite php .../cli.php migrate
CONSOLE APPWRITE (dev)  → http://localhost:8080/console
CONSOLE APPWRITE (prod) → https://api.konfiturgame.fr/console
DASHBOARD TRAEFIK (dev) → http://localhost:8081/dashboard/
SITE (dev)              → http://localhost:3000
SITE (prod)             → https://konfiturgame.fr
```

---

*KonfiturGame · Next.js 16.2.9 · Appwrite 1.9.0 · Traefik v3.6.7 · Docker Compose v2 · Mis à jour : 2026-07-14*
