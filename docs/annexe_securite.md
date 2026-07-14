# Annexe A — Sécurité : couverture OWASP Top 10 & audit du code source

> Annexe au dossier (section V — Sécurité et accessibilité). Détaille la
> couverture **OWASP Top 10 (2025)** et les mesures de sécurité effectivement
> implémentées dans le code. Chaque affirmation renvoie à un fichier vérifiable
> du dépôt.

---

## A.1 Couverture OWASP Top 10 (2025)

| Code | Risque OWASP 2025 | Mesures implémentées | Références code |
|------|-------------------|----------------------|-----------------|
| **A01** | Broken Access Control | Middleware `middleware.ts` (redirige `/dashboard`, `/admin` vers `/auth/login`) + layout admin (`notFound()` si non-membre de la team admin) ; Server Actions vérifient l'identité via la session Appwrite, avec garde admin serveur (`requireAdminOrThrow`) sur les actions sensibles (`admin.ts`, `logs.ts` — lecture des audit logs, ban/déban IP) ; permissions par collection Appwrite ; contrainte d'unicité métier (`isUserInTeamForJam`) avant écriture. | `frontend/src/middleware.ts`, `src/lib/actions/admin.ts`, `src/lib/actions/logs.ts` |
| **A02** | Security Misconfiguration | Headers Traefik : CSP, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` restrictive ; container Docker non-root (`nextjs`, uid 1001) ; `.env` exclu via `.gitignore`, `.env.example` versionné sans secret ; réseaux Docker cloisonnés (BDD + Redis jamais exposés) ; job gitleaks en CI. | `traefik/dynamic/middlewares.yml`, `frontend/Dockerfile:39-47`, `docker-compose.yml` |
| **A03** | Software Supply Chain Failures | Images Docker épinglées (`appwrite:1.9.0`, `appwrite/console:7.5.7`, `openruntimes/executor:0.11.4`, `traefik:v3.6.7`, `mariadb:10.11`, `redis:7-alpine`) ; `pnpm-lock.yaml` versionné + `--frozen-lockfile` ; images construites **localement** depuis sources vérifiées (pas d'image tierce inconnue) ; Trivy filesystem scan (HIGH + CRITICAL) + `pnpm audit` + gitleaks en CI ; issue `security-report` mise à jour à chaque push sur `main`. | `.github/workflows/ci-cd.yml:130-190`, `frontend/Dockerfile` |
| **A04** | Cryptographic Failures | TLS 1.2+ obligatoire en prod (Traefik + Let's Encrypt, redirection HTTP→HTTPS) ; HSTS `stsSeconds: 31536000` + `stsPreload` ; `APPWRITE_OPENSSL_KEY` (32 bytes) ; `APPWRITE_API_KEY` jamais exposée (séparation stricte `NEXT_PUBLIC_*`) ; cookies de session `httpOnly` (Appwrite) ; hachage fort **Argon2ID** par défaut (Appwrite Auth). | `traefik/dynamic/middlewares.yml`, `.env.example` |
| **A05** | Injection | Échappement de `<` et `>` sur les messages chat (`sendChatMessage`) ; échappement de `<` en `<` dans le JSON-LD (`serializeJsonLd`) contre l'injection `</script>` ; validators stricts sur les Server Actions ; pas de SQL direct (SDK `node-appwrite`, requêtes paramétrées) ; scan Semgrep `p/owasp-top-ten` en CI. | `src/lib/actions/chat.ts:43`, `src/lib/seo.ts:14` |
| **A06** | Insecure Design | Pas d'API REST publique de mutation (Server Actions Next.js uniquement) ; sanitisation du chat documentée ; architecture multi-réseau (BDD jamais exposée) ; codes d'invitation `KG-[A-Z0-9]{8}` (≈ 2,8 × 10¹² combinaisons, brute-force impraticable) ; défense SSRF : seule requête sortante (géoloc) vers un **hôte fixe** (`ip-api.com`), désactivée par défaut (`GEOIP_ENABLED=false`), filtre des IP privées. | `docker-compose.yml`, `src/lib/actions/teams.ts`, `src/app/api/log/route.ts:64-69` |
| **A07** | Authentication Failures | Appwrite Auth gère complexité, sessions, expiration ; OAuth multi-provider (Email, Google, Discord) ; critères de mot de passe affichés en UI ; rate limiting Traefik (100 req/min général, 50 req/min sur l'API Appwrite) ; détection de bots (`isBot`) avant vérification d'identité. | `traefik/dynamic/middlewares.yml`, `src/lib/bot-detection.ts` |
| **A08** | Software or Data Integrity Failures | Lockfile `pnpm-lock.yaml` versionné + `--frozen-lockfile` ; `git pull --ff-only` au déploiement (refus de tout merge non explicite) ; CI exécute lint + tests + scans avant déploiement (impossible de pousser un code non validé en prod). | `.github/workflows/ci-cd.yml:246`, `frontend/Dockerfile` |
| **A09** | Security Logging & Alerting Failures | Collection `audit_logs` (actions administratives) ; endpoint `/api/log` (path, IP, user-agent, état d'authentification) ; collection `banned_ips` (bans persistants avec raison + drapeau `auto`) ; logs Traefik (`accessLog`, statut 400-599 en prod) ; boucle de health checks après chaque déploiement ; **alerte automatique** via issue `deploy-failure` en cas d'échec. | `src/app/api/log/route.ts`, `.github/workflows/ci-cd.yml:360` |
| **A10** | Mishandling of Exceptional Conditions | Gestion explicite des cas limites : `/api/log` **fail-secure** (500 si secret absent, 401 non autorisé, 400 sur payload invalide via `isValidPayload`) ; `proxy.ts` **fail-open assumé** sur indisponibilité d'Appwrite (disponibilité > blocage, documenté) ; `AbortSignal.timeout(1500)` sur les appels réseau ; aucun `catch {}` vide (règle projet). | `src/app/api/log/route.ts:20-52`, `src/proxy.ts:46` |

> **Note sur l'évolution 2021 → 2025 :** l'ancien A10:2021 *Server-Side Request Forgery (SSRF)* n'est plus une catégorie autonome ; les mesures correspondantes sont désormais rattachées à **A06 (Insecure Design)** et **A02 (Security Misconfiguration)**. L'ancien A06:2021 *Vulnerable & Outdated Components* est absorbé et élargi par **A03:2025 Software Supply Chain Failures**.

L'ensemble est vérifié à chaque pull request via les scans Semgrep, Trivy et gitleaks de la CI.

---

## A.2 Mesures de sécurité détaillées (audit du code source)

### A.2.1 Headers de sécurité — `traefik/dynamic/middlewares.yml`

```yaml
security-headers:
  headers:
    browserXssFilter: true
    contentTypeNosniff: true
    frameDeny: true
    stsIncludeSubdomains: true
    stsPreload: true
    stsSeconds: 31536000               # 1 an
    customFrameOptionsValue: "SAMEORIGIN"
    referrerPolicy: "strict-origin-when-cross-origin"
    permissionsPolicy: "camera=(), microphone=(), geolocation=(), payment=()"
    contentSecurityPolicy: >
      default-src 'self';
      script-src 'self' 'unsafe-inline' 'unsafe-eval';
      style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
      font-src 'self' https://fonts.gstatic.com;
      img-src 'self' data: https://images.unsplash.com https://cloud.appwrite.io;
      connect-src 'self' https://api.localhost wss://api.localhost;
      frame-ancestors 'none';
```

Décisions notables :
- **`default-src 'self'`** : toute ressource externe doit être explicitement autorisée (Google Fonts, Unsplash, Appwrite listés nommément).
- **`frame-ancestors 'none'`** : bloque tout embarquement en iframe (protection clickjacking).
- **`Permissions-Policy` minimal** : caméra, micro, géolocalisation et paiement refusés (aucun usage légitime).
- **`'unsafe-inline'` / `'unsafe-eval'`** sur `script-src` : compromis imposé par Next.js et Tailwind v4. Documenté comme dette technique.
- **`connect-src`** utilise la valeur de gabarit `api.localhost` : le file provider Traefik ne substitue pas les variables d'env, la valeur de production est remplacée manuellement (voir `# TODO PROD` dans le fichier).

### A.2.2 Rate limiting — `traefik/dynamic/middlewares.yml`

| Middleware | Moyenne | Burst | Cible |
|------------|---------|-------|-------|
| `rate-limit` | 100 req/min | 200 | Frontend |
| `appwrite-rate-limit` | 50 req/min | 100 | API Appwrite |

Limites par IP source. Protègent contre scraping, brute-force et déni de service à faible débit.

### A.2.3 Détection de bots & bannissement IP — `frontend/src/proxy.ts`, `src/lib/bot-detection.ts`

`isBot` (testée unitairement) autorise en priorité les crawlers légitimes (Googlebot, Twitterbot, facebookexternalhit, LinkedInBot…) puis bloque les outils abusifs (scrapy, python-requests, curl, semrushbot, nikto, sqlmap, zgrab…) avec un `403`.

La vérification d'IP bannie utilise un **cache module-level à TTL 2 min** (évite un appel Appwrite par requête), un `AbortSignal.timeout(1500)`, et laisse passer en cas d'erreur (disponibilité > blocage systématique pour cette couche). Endpoint interne `/api/banned-ips` protégé par secret partagé (`LOG_INTERNAL_SECRET`).

### A.2.4 Sanitisation XSS

Trois mécanismes complémentaires :
1. **Échappement React automatique** du contenu inséré via `{}`.
2. **Sanitisation chat** — `sendChatMessage` échappe `<` et `>` avant insertion (`src/lib/actions/chat.ts:43`).
3. **JSON-LD safe** — `serializeJsonLd` (`src/lib/seo.ts:14`) échappe `<` en `<`, empêchant l'injection `</script>` dans les blocs `<script type="application/ld+json">` :

```ts
// src/lib/seo.ts
export function serializeJsonLd(jsonLd: JsonLdObject): string {
  return JSON.stringify(jsonLd).replace(/</g, '\\u003c')
}
```

### A.2.5 Gestion des secrets

- Secrets de production dans **GitHub Actions Secrets** (chiffrés au repos).
- `.env.example` versionné (variables sans valeur) ; `.env` exclu via `.gitignore`.
- Job **gitleaks** en CI scanne l'historique Git à chaque PR.
- Séparation `NEXT_PUBLIC_*` / variables serveur appliquée systématiquement.
