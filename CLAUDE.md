# KonfiturGame — Guide Claude

Plateforme française de Game Jams. Stack: Next.js 16.2.3 (App Router), TypeScript strict, Tailwind CSS v4, Appwrite 1.9.0 self-hosted, Traefik v3.6.7, Docker Compose.

---

## Architecture

```
KonfiturGameFullInfra/
├── docker-compose.yml          # PROD: 8 services, TLS Let's Encrypt
├── docker-compose.override.yml # DEV: appliqué auto par `docker compose up`
├── .env                        # Variables actives — NE PAS COMMITER
├── .env.example                # Template à documenter
├── traefik/
│   ├── traefik.yml             # Config prod (ACME, web+websecure)
│   ├── traefik.dev.yml         # Config dev (HTTP only, port 80+8080)
│   └── dynamic/middlewares.yml # security-headers, rate-limit, compress
├── scripts/                    # seed-data.sh, backup.sh, restore.sh
└── frontend/                   # App Next.js
    ├── Dockerfile              # PROD (build optimisé)
    ├── Dockerfile.dev          # DEV (hot-reload)
    └── src/
        ├── app/                # Next.js App Router
        ├── components/         # Header, Footer, JamCard, JamChat, FooterCTA…
        ├── lib/
        │   ├── appwrite/       # client.ts, server.ts, config.ts, types.ts, session.ts
        │   └── actions/        # jams.ts, teams.ts, projects.ts, chat.ts, profile.ts, logs.ts…
        ├── hooks/              # useRealtimeChat.ts
        ├── proxy.ts            # Middleware bot-detection + ban IP (s'exécute avant middleware.ts)
        ├── middleware.ts       # Protège /dashboard + /admin, redirige /auth/login
        └── types/index.ts
```

---

## DEV vs PROD

### DEV — `docker compose up`
| Service | URL | Notes |
|---------|-----|-------|
| frontend | http://localhost:3000 | hot-reload |
| appwrite | http://localhost:8080/console | accès direct |
| appwrite API | http://localhost:8080/v1 | |
| traefik dashboard | http://localhost:8081/dashboard/ | |

### PROD — `docker compose up -d` (sans override)
| URL | Service |
|-----|---------|
| https://konfiturgame.fr | frontend |
| https://api.konfiturgame.fr | appwrite |
| https://api.konfiturgame.fr/v1/realtime | appwrite-realtime |
| https://traefik.konfiturgame.fr | dashboard (basic auth) |

### Variables d'env clés
| Variable | DEV | PROD |
|----------|-----|------|
| `NEXT_PUBLIC_APPWRITE_ENDPOINT` | `http://localhost:8080/v1` | `https://api.konfiturgame.fr/v1` |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | `https://konfiturgame.fr` |
| `APPWRITE_INTERNAL_ENDPOINT` | `http://appwrite/v1` | `http://appwrite/v1` |

---

## Appwrite

- **Version:** 1.9.0
- **Database:** `konfitur-db`
- **Collections:** `game_jams`, `teams`, `team_members`, `projects`, `chat_messages`, `announcements`, `comments`, `votes`, `audit_logs`, `banned_ips`
- **Buckets:** `jam-covers`, `project-assets`, `avatars`
- **IDs définis dans:** `frontend/src/lib/appwrite/config.ts` — toujours importer de là
- `APPWRITE_API_KEY` → server only, jamais préfixer `NEXT_PUBLIC_`
- `APPWRITE_INTERNAL_ENDPOINT` → utilisé dans `server.ts` pour les Server Actions (réseau Docker interne)
- Realtime: `databases.{DB}.collections.{COL}.documents`

### Schéma `teams` (guildes multi-jam)
```ts
// teams collection — schéma actuel
jam_ids: string[]   // tableau — [] = guilde pure sans jam active
name: string
invite_code: string // format KG-XXXXXXXX
leader_id: string
// project_id SUPPRIMÉ — projets retrouvés par (team_id, jam_id)
```

Query pour les équipes d'une jam : `Query.contains('jam_ids', jamId)`

---

## Frontend — Conventions de code

### Design system (Tricolore Dark)
- Toujours utiliser les CSS variables, jamais les valeurs hex directement
- `--background: #0C1018` | `--card: #131921` | `--primary: #4F6AFF` | `--secondary: #EF233C`
- `--radius: 0px` → **zéro border-radius partout**, pas d'arrondi
- Fonts: `var(--font-sans)` (Space Grotesk) + `var(--font-mono)` (JetBrains Mono)
- Icônes: `lucide-react` exclusivement
- Dates: `toLocaleDateString('fr-FR')`
- UI entièrement en français

### Patterns de style
```tsx
// ✅ Correct — CSS variables via style={}
<div style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>

// ✅ Classes Tailwind pour layout, style={} pour couleurs du design system
<div className="flex items-center gap-3 mb-8" style={{ color: 'var(--primary)' }}>

// ❌ Jamais de border-radius
className="rounded-lg"  // à éviter
```

### Appwrite client vs serveur
```ts
// Client (browser) — 'use client' uniquement
import { account, databases } from '@/lib/appwrite/client'

// Serveur (Server Actions, API routes) — node-appwrite
import { serverDatabases } from '@/lib/appwrite/server'
```

### Tests
```bash
# Les tests DOIVENT tourner dans le container (node_modules uniquement là)
docker exec konfitur-frontend sh -c "cd /app && npx vitest run"
docker exec konfitur-frontend sh -c "cd /app && npx vitest run src/__tests__/actions-teams.test.ts"
```

### Accessibilité obligatoire
- `html lang="fr"`, skip-link `#main-content`, hiérarchie h1>h2>h3
- `:focus-visible` outline 2px primary, touch targets 44×44px mobile
- `role="timer"` sur CountdownTimer, `role="log" aria-live="polite"` sur chat
- `@media prefers-reduced-motion` : désactive toutes les animations

---

## Commandes clés

```bash
# Démarrer l'environnement de dev
docker compose up

# Seed Appwrite (après avoir rempli APPWRITE_API_KEY dans .env)
./scripts/seed-data.sh

# Build frontend seul
cd frontend && pnpm build

# Type-check
cd frontend && pnpm type-check

# Linting
cd frontend && pnpm lint

# Tests (dans le container)
docker exec konfitur-frontend sh -c "cd /app && npx vitest run"

# Migration Appwrite (après upgrade de version)
docker exec konfitur-appwrite php /usr/src/code/app/cli.php migrate

# Générer pnpm-lock.yaml sur Windows FS (EACCES sur /mnt/c/...)
mkdir -p /tmp/pnpm-gen && cp frontend/package.json /tmp/pnpm-gen/
docker run --rm -v /tmp/pnpm-gen:/app -w /app node:20-alpine sh -c "corepack enable pnpm && pnpm install --no-frozen-lockfile"
cp /tmp/pnpm-gen/pnpm-lock.yaml frontend/

# Reprise d'une backup 
bash ./scripts/restore.sh ./backups/2026-xx-xx_xx-xx-xx
# choisir en premier mode 1 
```

---

## Pièges connus

- **Plafonds Appwrite** — `listDocuments` tronque silencieusement à 25 sans `Query.limit`, et un filtre `Query.equal(field, [...])` de plus de 100 valeurs est **rejeté** (exception, pas troncature). Symptôme typique : un compteur `array.length` qui plafonne. Ne pas répondre par une limite « généreuse », c'est la même maladie plus loin : utiliser `fetchAllDocs` / `fetchAllByField` (`src/lib/appwrite/fetch-all.ts`) dès qu'il faut tous les documents, et une `Query.limit(N)` explicite et commentée uniquement pour un plafond produit délibéré (50 derniers messages, top 6…).
- **Plafond d'affichage sans porte de sortie** — un `Query.limit(N)` sur une liste rendue n'est légitime que s'il existe un « Voir plus » ou un lien « voir tout ». Sans ça, c'est une troncature silencieuse, quel que soit N. Utiliser `LoadMoreList` (`src/components/`) et le contrat `(filtre?, cursor?) → { items, nextCursor }`. Curseur et non `offset` : les collections qui s'alimentent en continu re-servent des lignes déjà vues avec `offset`.
- **`new URL()` crash** — le fallback doit contenir `http://`, pas juste `'localhost'`
- **`getaddrinfo for redis failed`** — toujours déclarer `networks:` explicitement dans l'override pour `appwrite` et `appwrite-realtime`
- **appwrite-realtime crash Traefik dev** — `traefik.enable=false` dans l'override (entrypoint `websecure` absent de `traefik.dev.yml`)
- **ADMIN_EMAIL ACME vide** — passer `ADMIN_EMAIL` dans `environment:` du service Traefik (pas depuis `.env` Docker Compose)
- **CSP `connect-src` hardcodée** — Traefik file provider ne substitue pas les vars d'env → modifier `middlewares.yml` manuellement en prod
- **Redis sans `--requirepass`** — Appwrite a un bug dans Queue\Connection\Redis qui n'envoie jamais AUTH → Redis isolé sur `appwrite-net` uniquement
- **pnpm-lock.yaml sur Windows FS** — générer dans `/tmp` (voir commande ci-dessus)
- **Appwrite 500 "Unknown attribute: devKeys"** — après upgrade depuis 1.6.x : lancer `docker exec konfitur-appwrite php .../cli.php migrate` puis `docker restart konfitur-appwrite`
- **`node_modules` Docker corrompu** — si `frontend/node_modules` est un fichier texte (artefact worktree git) : `rm frontend/node_modules && git rm --cached frontend/node_modules`
- **Double moteur Docker (résolu 2026-07-16)** — un docker-ce installé DANS la distro WSL ressuscitait une vieille stack qui squattait :3000/:8080/:3306 en parallèle de Docker Desktop (symptôme : vieux code servi, `docker logs` muets pendant un curl). Services `masked` ; ne jamais relancer `systemctl start docker` dans la distro, le CLI passe par le socket Docker Desktop

---

## Auth

- Cookie Appwrite: `a_session_{APPWRITE_PROJECT_ID}` — lu dans `middleware.ts`
- `AuthProvider` (`src/components/providers/AuthProvider.tsx`) — expose `useAuth()`
- Middleware protège `/dashboard` et `/admin`, redirige vers `/auth/login?redirect=...`
- Layout admin vérifie l'appartenance à `ADMIN_TEAM_ID` → `notFound()` si non-admin
- OAuth Google + Discord implémenté et fonctionnel

---

## Réseaux Docker

- `konfitur-net` : traefik, frontend, appwrite, appwrite-realtime
- `appwrite-net` : appwrite, appwrite-realtime, mariadb, redis
- `mariadb` et `redis` : `appwrite-net` UNIQUEMENT (jamais exposés à Traefik)

---

## Package manager

`pnpm` — ne jamais utiliser `npm` ou `yarn` dans ce projet.

---

## Git (Non-Négociable)

- **JAMAIS de `git commit`, `git add`, `git push` sans demande explicite de l'utilisateur**
- Cette règle s'applique aux subagents et agents délégués — ne jamais inclure d'étapes de commit dans leurs instructions
- Laisser systématiquement l'utilisateur gérer tous les commits

---

## Fichiers sensibles (non lisibles par Claude)

Exclus via `.claudeignore`. Claude connaît leur existence et peut les mentionner, mais ne peut pas en lire le contenu. Si une tâche les concerne, demander à l'utilisateur d'agir directement dessus.

| Fichier | Contenu | Action |
|---------|---------|--------|
| `.env` | Vars actives : passwords, API keys, domaine | Éditer manuellement |
| `.env.example` | Template sans secrets — **lisible** | Référence pour les vars attendues |
| `traefik/acme/acme.json` | Certificats TLS + clés privées Let's Encrypt | Ne jamais modifier |
| `backups/` | Dumps Appwrite/MariaDB | Gérer via `scripts/backup.sh` et `restore.sh` |
| `*.pem` / `*.key` / `*.crt` | Clés et certificats génériques | Ne jamais commiter ni lire |
