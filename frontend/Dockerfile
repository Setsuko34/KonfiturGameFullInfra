# ═══ Stage 1 : Dependencies ═══
FROM node:22-alpine AS deps
WORKDIR /app

RUN corepack enable pnpm

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ═══ Stage 2 : Build ═══
FROM node:22-alpine AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

# Variables publiques baked dans le bundle client au moment du build.
# Fournir via --build-arg en production ; les valeurs ci-dessous
# servent de placeholder valide pour les builds de développement local.
ARG NEXT_PUBLIC_APPWRITE_ENDPOINT=http://localhost:8080/v1
ARG NEXT_PUBLIC_APPWRITE_PROJECT_ID=konfiture-game
ENV NEXT_PUBLIC_APPWRITE_ENDPOINT=$NEXT_PUBLIC_APPWRITE_ENDPOINT
ENV NEXT_PUBLIC_APPWRITE_PROJECT_ID=$NEXT_PUBLIC_APPWRITE_PROJECT_ID

RUN corepack enable pnpm

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm build

# ═══ Stage 3 : Production ═══
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Fichiers standalone + static générés par Next.js
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# UID numérique (hadolint DL3066) : un nom d'utilisateur n'est pas résolvable
# par l'hôte, notamment quand Kubernetes ou un `docker run --user` compare des
# identifiants. 1001 = nextjs, créé juste au-dessus.
USER 1001

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Sonde de conteneur (Trivy DS-0026). Cible un fichier statique de /public :
# son extension .svg figure dans les SKIP_PATTERNS de proxy.ts, la sonde ne
# traverse donc ni la détection de bots ni le moindre appel Appwrite — inutile
# de réveiller la base toutes les 30 s pour savoir si le process répond.
#
# L'User-Agent explicite reste indispensable en défense : l'UA par défaut de
# wget est classé bot malveillant par bot-detection.ts (`/wget\//i`). Un 403
# marquerait le conteneur unhealthy, et health-check.sh redémarrerait en
# boucle un frontend parfaitement sain — la supervision devenant la panne.
#
# Forme JSON (hadolint DL3025) : pas de `|| exit 1`, wget sort déjà non-nul
# en cas d'échec et Docker en déduit l'état unhealthy. Chemin absolu, la forme
# exec ne passant pas par un shell.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["/usr/bin/wget", "--quiet", "--spider", "--tries=1", \
       "--user-agent=Mozilla/5.0 (compatible; KonfiturGame-Healthcheck/1.0)", \
       "http://127.0.0.1:3000/hautequalite.svg"]

CMD ["node", "server.js"]
