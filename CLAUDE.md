# KonfiturGame — Guide Claude

Plateforme française de Game Jams. Stack: Next.js 14 (App Router), TypeScript strict, Tailwind CSS v4, Appwrite 1.5 self-hosted, Traefik v3.6.7, Docker Compose.

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
├── scripts/                    # seed-data.ts, backup.sh, restore.sh
└── frontend/                   # App Next.js
    ├── Dockerfile              # PROD (build optimisé)
    ├── Dockerfile.dev          # DEV (hot-reload)
    └── src/
        ├── app/                # Next.js App Router
        ├── components/         # Header, Footer, JamCard, JamChat…
        ├── lib/
        │   ├── appwrite/       # client.ts (browser), server.ts (Server Actions)
        │   └── actions/        # jams.ts, teams.ts, projects.ts, chat.ts
        ├── hooks/              # useRealtimeChat.ts
        ├── middleware.ts       # Protège /dashboard, redirige /auth/login
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

- **Database:** `konfitur-db`
- **Collections:** `game_jams`, `teams`, `team_members`, `projects`, `chat_messages`, `announcements`, `comments`, `votes`
- **Buckets:** `jam-covers`, `project-assets`, `avatars`
- **IDs définis dans:** `frontend/src/lib/appwrite/config.ts` — toujours importer de là
- `APPWRITE_API_KEY` → server only, jamais préfixer `NEXT_PUBLIC_`
- `APPWRITE_INTERNAL_ENDPOINT` → utilisé dans `server.ts` pour les Server Actions (réseau Docker interne)
- Realtime: `databases.{DB}.collections.{COL}.documents`

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
cd frontend && npx tsx ../scripts/seed-data.ts

# Build frontend seul
cd frontend && pnpm build

# Type-check
cd frontend && pnpm type-check

# Linting
cd frontend && pnpm lint

# Générer pnpm-lock.yaml sur Windows FS (EACCES sur /mnt/c/...)
mkdir -p /tmp/pnpm-gen && cp frontend/package.json /tmp/pnpm-gen/
docker run --rm -v /tmp/pnpm-gen:/app -w /app node:20-alpine sh -c "corepack enable pnpm && pnpm install --no-frozen-lockfile"
cp /tmp/pnpm-gen/pnpm-lock.yaml frontend/
```

---

## Pièges connus

- **`new URL()` crash** — le fallback doit contenir `http://`, pas juste `'localhost'`
- **`getaddrinfo for redis failed`** — toujours déclarer `networks:` explicitement dans l'override pour `appwrite` et `appwrite-realtime`
- **appwrite-realtime crash Traefik dev** — `traefik.enable=false` dans l'override (entrypoint `websecure` absent de `traefik.dev.yml`)
- **ADMIN_EMAIL ACME vide** — passer `ADMIN_EMAIL` dans `environment:` du service Traefik (pas depuis `.env` Docker Compose)
- **CSP `connect-src` hardcodée** — Traefik file provider ne substitue pas les vars d'env → modifier `middlewares.yml` manuellement en prod
- **Redis sans `--requirepass`** — Appwrite 1.5 a un bug dans Queue\Connection\Redis qui n'envoie jamais AUTH → jobs de queue jamais publiés. Redis isolé sur `appwrite-net` uniquement.
- **pnpm-lock.yaml sur Windows FS** — générer dans `/tmp` (voir commande ci-dessus)
- **OAuth fonctionnel après reprise backup**

---

## Auth

- Cookie Appwrite: `a_session_{APPWRITE_PROJECT_ID}` — lu dans `middleware.ts`
- `AuthProvider` (`src/components/providers/AuthProvider.tsx`) — expose `useAuth()`
- Middleware protège `/dashboard`, redirige vers `/auth/login?redirect=...`
- OAuth Google + Discord implémenté UI fonctionnel 

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
