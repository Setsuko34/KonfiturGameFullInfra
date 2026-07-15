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

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
