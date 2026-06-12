# CI/CD — Guide opérateur

Pipeline : `.github/workflows/ci-cd.yml`. Spec : `docs/superpowers/specs/2026-06-10-ci-cd-pipeline-design.md`.

## Vue d'ensemble

- **PR ou push vers `main` et `develop`** : contrôles — bloquants : `Lint + type-check`, `Tests unitaires`, `Scan secrets (gitleaks)`, `Checklist RGPD` ; non bloquants (rapport) : Semgrep, audit dépendances, lint Docker.
- **Push sur `main` uniquement** : après les contrôles, déploiements **uniquement pour les zones modifiées** (jamais depuis `develop`) :
  - `frontend/**` → rebuild + restart du service `frontend` sur le VPS (SSH)
  - `docker-compose.yml`, `traefik/**` → `docker compose up -d` complet sur le VPS (SSH)
  - `appwrite.json`, `functions/**` → `appwrite push functions` depuis le runner CI
- **Issues automatiques** : `deploy-failure` (échec de déploiement ou healthcheck), `security-report` (issue unique mise à jour avec les findings non bloquants).

## Secrets GitHub requis

À créer dans Settings → Secrets and variables → Actions (ou `gh secret set <NOM>`) :

| Secret | Contenu |
|--------|---------|
| `VPS_HOST` | IP ou hostname du VPS OVH |
| `VPS_USER` | Utilisateur SSH de déploiement |
| `VPS_SSH_KEY` | Clé **privée** ed25519 dédiée au déploiement (voir ci-dessous) |
| `VPS_APP_DIR` | Chemin du repo sur le VPS (ex: `/opt/KonfiturGameFullInfra`) |
| `APPWRITE_API_KEY` | Clé API Appwrite de **prod**, scope functions uniquement |

`GITHUB_TOKEN` est un token automatique fourni par GitHub Actions — il n'est pas à créer manuellement.

## Mise en place initiale (one-shot)

### 1. Clé SSH de déploiement (CI → VPS)

Sur ta machine :

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f /tmp/deploy_key -N ""
ssh-copy-id -i /tmp/deploy_key.pub <user>@<vps>     # ou ajouter manuellement à ~/.ssh/authorized_keys
gh secret set VPS_SSH_KEY < /tmp/deploy_key
rm /tmp/deploy_key /tmp/deploy_key.pub
gh secret set VPS_HOST    --body "<ip-ou-host>"
gh secret set VPS_USER    --body "<user>"
gh secret set VPS_APP_DIR --body "/opt/KonfiturGameFullInfra"
```

### 2. Deploy key GitHub (VPS → repo privé, lecture seule)

Sur le VPS :

```bash
ssh-keygen -t ed25519 -C "vps-readonly" -f ~/.ssh/github_deploy -N ""
cat ~/.ssh/github_deploy.pub
# Ajouter cette clé : repo GitHub → Settings → Deploy keys → Add (SANS write access)
git -C <VPS_APP_DIR> remote set-url origin git@github.com:Setsuko34/KonfiturGameFullInfra.git
printf 'Host github.com\n  IdentityFile ~/.ssh/github_deploy\n' >> ~/.ssh/config
git -C <VPS_APP_DIR> fetch origin   # doit réussir sans mot de passe
```

### 3. Clé API Appwrite de prod

Console Appwrite prod → Project → API keys → créer une clé avec le scope `functions` uniquement, puis :

```bash
gh secret set APPWRITE_API_KEY --body "<la-clé>"
```

### 4. Labels GitHub (optionnel)

Les labels `deploy-failure` et `security-report` sont créés automatiquement par le
workflow au premier besoin (`gh label create --force`, idempotent). Pour les créer
à l'avance ou personnaliser couleur/description :

```bash
gh label create deploy-failure  --color D73A4A --description "Échec de déploiement automatique"
gh label create security-report --color D93F0B --description "Rapport sécurité CI"
```

### 5. Protection de branche `main` (recommandé)

Settings → Branches → Add rule sur `main` → Require status checks :
`Lint + type-check`, `Tests unitaires`, `Scan secrets (gitleaks)`, `Checklist RGPD`.

## Détails des jobs

### Étage 1 — contrôles (PR + push)

| Job (`name:`) | Bloquant | Description |
|---------------|----------|-------------|
| `Lint + type-check` | Oui | `pnpm lint` + `pnpm type-check` dans `frontend/` |
| `Tests unitaires` | Oui | `pnpm test:coverage` — artefact `coverage` conservé 7 jours |
| `Scan secrets (gitleaks)` | Oui | gitleaks-action v3, fetch-depth 0 (historique complet) |
| `Checklist RGPD` | Oui | `scripts/ci/rgpd-check.sh` — voir section RGPD ci-dessous |
| `Semgrep OWASP (non bloquant)` | Non | Configs `p/owasp-top-ten`, `p/typescript`, `p/react` — artefact `security-sast` |
| `Audit dépendances (non bloquant)` | Non | `pnpm audit` + Trivy fs (HIGH/CRITICAL) — artefact `security-deps` |
| `Lint Docker (non bloquant)` | Non | hadolint sur les deux Dockerfiles + Trivy config — artefact `security-docker` |

### Étage 2 — déploiement (push sur `main` uniquement)

Les trois jobs de déploiement n'existent que sur push. Ils attendent tous les contrôles bloquants (`quality`, `tests`, `secrets`, `rgpd`). La détection des changements est assurée par le job `Détection des changements` (dorny/paths-filter v3).

**`Déploiement infra (compose / traefik)`** — déclenché si `docker-compose.yml` ou `traefik/**` est modifié.

- SSH via appleboy/ssh-action v1.2.0, `script_stop: true`.
- `VPS_APP_DIR` est passé au script distant comme variable d'environnement `APP_DIR` via `envs: APP_DIR`.
- Séquence : `git pull --ff-only origin main` → `docker compose -f docker-compose.yml up -d --remove-orphans`.
- Healthchecks en boucle de retry (10 × 10 s) : frontend (`https://konfiturgame.fr`, attendu HTTP 200) et Appwrite (`https://api.konfiturgame.fr/v1/health`, accepte 200 ou 401).

**`Déploiement frontend`** — déclenché si `frontend/**` est modifié.

- Attend aussi que `Déploiement infra` soit `success` ou `skipped` (gestion de la dépendance dans `if: always()`).
- `VPS_APP_DIR` transmis de la même façon (`APP_DIR`).
- Séquence : `git pull --ff-only origin main` → `docker compose … build frontend` → `docker compose … up -d frontend`.
- Healthcheck frontend identique (10 × 10 s).

**`Déploiement Appwrite functions`** — déclenché si `appwrite.json` ou `functions/**` est modifié.

- S'exécute sur le runner CI (pas SSH) : installe `appwrite-cli@10` (npm global, exception à la règle pnpm du projet — runner éphémère).
- Configure le client avec `APPWRITE_API_KEY`, endpoint et project-id codés dans le workflow.
- `appwrite push functions --force`.

**`Déploiement schéma Appwrite (phase 2 — désactivé)`** — job présent mais inactif (`if: github.ref == 'refs/heads/__disabled__'`). Voir section Phase 2 ci-dessous.

### Issues automatiques

**`Issue si échec de déploiement`** — créé si l'un des trois jobs de déploiement est en `failure`. Si une issue `deploy-failure` est déjà ouverte, un commentaire est ajouté (pas de doublon). Contient le SHA, les jobs en échec et un lien vers les logs. Renvoie vers la procédure de rollback dans ce document.

**`Issue rapport sécurité`** — agrège les artefacts `security-sast`, `security-deps`, `security-docker` via `scripts/ci/build-security-report.sh`. Si le total de findings est nul, l'issue existante est fermée automatiquement. Si les artefacts sont indisponibles (scanners en échec avant upload), le rapport est déclaré indisponible et l'issue existante est laissée en l'état, sans modification.

## RGPD — checklist CI

`scripts/ci/rgpd-check.sh` vérifie à chaque run :

1. Présence de `frontend/src/app/legal/mentions-legales/page.tsx` et `frontend/src/app/legal/privacy/page.tsx`.
2. Attribut `lang="fr"` dans `frontend/src/app/layout.tsx`.
3. Absence de domaines tiers non référencés dans `scripts/ci/allowed-third-party-domains.txt` (scan de tous les `.ts` / `.tsx` dans `frontend/src`).

**Si la checklist échoue** pour un nouveau domaine externe : l'ajouter à `scripts/ci/allowed-third-party-domains.txt` avec un commentaire, et documenter dans `/legal/privacy` s'il reçoit des données personnelles.

## Sécurité — notes

- **gitleaks-action v3** — gratuit pour les comptes personnels ; une licence est requise pour les organisations GitHub.
- **trivy-action v0.36.0** — utilisé pour les scans `fs` (dépendances) et `config` (Dockerfiles / Compose).
- **hadolint-action v3.3.0** — lint des deux Dockerfiles (`frontend/Dockerfile` et `frontend/Dockerfile.dev`).
- **Issue `security-report`** — ne créée ou mise à jour que si les scanners non bloquants ont produit des artefacts JSON valides. Si les artefacts sont absents ou corrompus, le job passe (`exit 0`) et l'issue existante est laissée en l'état.

## Rollback manuel

```bash
ssh <user>@<vps>
cd <VPS_APP_DIR>
git log --oneline -5                       # repérer le commit sain
git reset --hard <commit-sain>
docker compose -f docker-compose.yml build frontend
docker compose -f docker-compose.yml up -d
curl -s -o /dev/null -w '%{http_code}\n' https://konfiturgame.fr   # attendu: 200
```

Après un rollback, le prochain `git pull --ff-only` de la CI échouera (historique divergent). Une fois le correctif mergé sur `main`, remettre le VPS sur l'état courant du remote :

```bash
git reset --hard origin/main
```

## Phase 2 — schéma Appwrite dans la CI

1. En dev (`docker compose up`), récupérer le schéma : `appwrite pull collections` (et `appwrite pull buckets`) → remplit `appwrite.json`.
2. Vérifier le diff de `appwrite.json` (collections complètes, permissions correctes).
3. Dans `.github/workflows/ci-cd.yml`, job `deploy-schema` : remplacer `if: github.ref == 'refs/heads/__disabled__'` par la même condition que le job `deploy-functions`, et ajouter les steps identiques avec `appwrite push collections --force` à la place de `appwrite push functions --force`.
4. La clé API de prod doit gagner les scopes `databases`/`collections`.
5. Les scripts shell de schéma (`init-appwrite.sh`, `update-schema-phase1.sh`) deviennent obsolètes.

## Durcir le pipeline (plus tard)

Les jobs Semgrep / audit dépendances / Docker sont non bloquants (`continue-on-error: true`).
Une fois les faux positifs triés (via l'issue `security-report`), retirer `continue-on-error: true` du job concerné pour le rendre bloquant.

## Notes diverses

- **Version Appwrite CLI épinglée** : `appwrite-cli@10` — compatible serveur 1.8.x. Revalider à chaque upgrade Appwrite.
- **Force-push sans ancêtre commun** : paths-filter (dorny/paths-filter v3) considère alors tous les fichiers comme modifiés → redéploiement complet. C'est le comportement attendu ; ne pas forcer-pousher sur `main` inutilement.
- **Concurrence** : un seul run à la fois par branche (`concurrency` au niveau workflow) ; les runs de PR sont annulés si un nouveau push arrive, les runs de push sur `main` attendent.
