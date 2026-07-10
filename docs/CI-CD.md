# CI/CD — Guide opérateur

Pipeline : `.github/workflows/ci-cd.yml`
Protections de branche : `docs/BRANCH-PROTECTION.md`

---

## Vue d'ensemble

- **PR ou push vers `main` et `develop`** — contrôles bloquants : `Lint + type-check`, `Tests unitaires`, `Scan secrets (gitleaks)`, `Checklist RGPD` ; non bloquants (rapport) : Semgrep, audit dépendances, lint Docker.
- **Push sur `main` uniquement** — après les contrôles, déploiements **uniquement pour les zones modifiées** :
  - `frontend/**` → rebuild + restart du service `frontend` sur le VPS (SSH)
  - `docker-compose.yml`, `traefik/**` → `docker compose up -d` complet sur le VPS (SSH)
  - `appwrite.json`, `functions/**` → `appwrite push functions` depuis le runner CI
- **Issues automatiques** : `deploy-failure` (échec de déploiement ou healthcheck), `security-report` (issue unique mise à jour avec les findings non bloquants).

---

## Secrets GitHub requis

Créer dans Settings → Secrets and variables → Actions (ou `gh secret set <NOM>`) :

| Secret | Contenu |
|--------|---------|
| `VPS_HOST` | IP ou hostname du VPS |
| `VPS_USER` | Utilisateur SSH de déploiement |
| `VPS_SSH_KEY` | Clé **privée** ed25519 dédiée au déploiement |
| `VPS_APP_DIR` | Chemin du repo sur le VPS (ex: `/opt/KonfiturGameFullInfra`) |
| `APPWRITE_API_KEY` | Clé API Appwrite de **prod**, scope functions uniquement |

`GITHUB_TOKEN` est fourni automatiquement par GitHub Actions — ne pas créer manuellement.

---

## Mise en place initiale (one-shot)

### 1. Clé SSH de déploiement (CI → VPS)

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f /tmp/deploy_key -N ""
ssh-copy-id -i /tmp/deploy_key.pub <user>@<vps>
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

Console Appwrite prod → Project → API keys → créer une clé avec le scope `functions` uniquement :

```bash
gh secret set APPWRITE_API_KEY --body "<la-clé>"
```

### 4. Labels GitHub (optionnel — créés automatiquement au premier besoin)

```bash
gh label create deploy-failure  --color D73A4A --description "Échec de déploiement automatique"
gh label create security-report --color D93F0B --description "Rapport sécurité CI"
```

### 5. Protection de branche `main`

Settings → Branches → Rulesets → voir `docs/BRANCH-PROTECTION.md`.
Status checks requis : `Lint + type-check`, `Tests unitaires`, `Scan secrets (gitleaks)`, `Checklist RGPD`.

---

## Détail des jobs

### Étage 1 — contrôles (PR + push sur main et develop)

| Job | Bloquant | Description |
|-----|----------|-------------|
| `Lint + type-check` | Oui | `pnpm lint` + `pnpm type-check` dans `frontend/` |
| `Tests unitaires` | Oui | `pnpm test:coverage` — artefact `coverage` conservé 7 jours |
| `Scan secrets (gitleaks)` | Oui | gitleaks-action v3, fetch-depth 0 (historique complet) |
| `Checklist RGPD` | Oui | `scripts/ci/rgpd-check.sh` — voir section RGPD ci-dessous |
| `Semgrep OWASP (non bloquant)` | Non | Configs `p/owasp-top-ten`, `p/typescript`, `p/react` — artefact `security-sast` |
| `Audit dépendances (non bloquant)` | Non | `pnpm audit` + Trivy fs (HIGH/CRITICAL) — artefact `security-deps` |
| `Lint Docker (non bloquant)` | Non | hadolint sur les deux Dockerfiles + Trivy config — artefact `security-docker` |

### Étage 2 — déploiement (push sur `main` uniquement)

Tous les jobs de déploiement attendent les 4 contrôles bloquants. La détection des changements est assurée par `Détection des changements` (dorny/paths-filter v3).

**`Déploiement infra (compose / traefik)`** — déclenché si `docker-compose.yml` ou `traefik/**` est modifié.
- SSH via appleboy/ssh-action v1.2.0, `script_stop: true`.
- `VPS_APP_DIR` transmis comme variable d'environnement `APP_DIR` via `envs: APP_DIR`.
- Séquence : `git pull --ff-only origin main` → `docker compose -f docker-compose.yml up -d --remove-orphans`.
- Healthchecks (10 × 10 s) : frontend (`https://konfiturgame.fr`, HTTP 200) et Appwrite (`https://api.konfiturgame.fr/v1/health`, 200 ou 401).

**`Déploiement frontend`** — déclenché si `frontend/**` est modifié.
- Attend aussi `Déploiement infra` (`success` ou `skipped`).
- Séquence : `git pull --ff-only origin main` → `docker compose … build frontend` → `docker compose … up -d frontend`.
- Healthcheck frontend identique.

**`Déploiement Appwrite functions`** — déclenché si `appwrite.json` ou `functions/**` est modifié.
- S'exécute sur le runner CI (pas SSH) : installe `appwrite-cli@10` (npm global, exception à pnpm — runner éphémère).
- Configure le client avec `APPWRITE_API_KEY`, endpoint et project-id.
- `appwrite push functions --force`.

**`Déploiement schéma Appwrite (phase 2 — désactivé)`** — job présent mais inactif (`if: github.ref == 'refs/heads/__disabled__'`). Voir section Phase 2.

### Issues automatiques

**`Issue si échec de déploiement`** — créé si l'un des trois jobs de déploiement est en `failure`. Si une issue `deploy-failure` est déjà ouverte, un commentaire est ajouté (pas de doublon). Contient le SHA, les jobs en échec et un lien vers les logs.

**`Issue rapport sécurité`** — agrège les artefacts `security-sast`, `security-deps`, `security-docker` via `scripts/ci/build-security-report.sh`. Si le total de findings est nul, l'issue est fermée automatiquement.

---

## RGPD — checklist CI

`scripts/ci/rgpd-check.sh` vérifie à chaque run :

1. Présence de `frontend/src/app/legal/mentions-legales/page.tsx` et `frontend/src/app/legal/privacy/page.tsx`.
2. Attribut `lang="fr"` dans `frontend/src/app/layout.tsx`.
3. Absence de domaines tiers non référencés dans `scripts/ci/allowed-third-party-domains.txt` (scan de tous les `.ts` / `.tsx` dans `frontend/src`).

**Si la checklist échoue** pour un nouveau domaine externe : l'ajouter à `scripts/ci/allowed-third-party-domains.txt` avec un commentaire, et documenter dans `/legal/privacy` s'il reçoit des données personnelles.

---

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

Après un rollback, le prochain `git pull --ff-only` de la CI échouera (historique divergent). Une fois le correctif mergé sur `main` :

```bash
git reset --hard origin/main
```

---

## Phase 2 — schéma Appwrite dans la CI

Le schéma (tables, buckets, teams) est **déjà capturé** dans `appwrite.json`. Reste à activer le job :

1. Dans `ci-cd.yml`, job `deploy-schema` : remplacer `if: github.ref == 'refs/heads/__disabled__'` par la même condition que `deploy-functions`, et utiliser `appwrite push tables --force` (la commande `push collections` est dépréciée depuis la CLI 17).
2. La clé API de prod doit gagner les scopes `databases.read`/`databases.write`.
3. Les scripts shell de schéma (`init-appwrite.sh`, `update-schema-phase1.sh`) deviennent obsolètes (`seed-data.sh` reste utile pour les données de test).

Procédure détaillée : `MISE-A-JOUR.md §7`.

---

## Durcir le pipeline

Les jobs Semgrep / audit dépendances / Docker sont non bloquants (`continue-on-error: true`). Une fois les faux positifs triés via l'issue `security-report`, retirer `continue-on-error: true` du job concerné pour le rendre bloquant.

---

## Notes diverses

- **Tests E2E hors CI** : la suite Playwright (`pnpm e2e`) nécessite l'infrastructure Docker complète (frontend + Appwrite + données de test) — elle ne tourne **pas** dans le pipeline. L'exécuter localement avant de merger (voir `docs/DOC_test_E2E.md`).
- **Version Appwrite CLI épinglée** : le workflow épingle `appwrite-cli@10` (`ci-cd.yml`, job deploy-functions) — **obsolète depuis le passage du serveur en 1.9.0** : à mettre à jour vers `appwrite-cli@17.3.1` (une CLI incompatible provoque des erreurs "Route not found" — tableau de compatibilité dans `MISE-A-JOUR.md §4`). Revalider à chaque upgrade Appwrite.
- **Force-push sans ancêtre commun** : paths-filter considère alors tous les fichiers comme modifiés → redéploiement complet. Ne pas force-pusher sur `main` inutilement.
- **Concurrence** : un seul run à la fois par branche (`concurrency` au niveau workflow) ; les runs de PR sont annulés si un nouveau push arrive, les runs de push sur `main` attendent.
- **gitleaks-action v3** : gratuit pour les comptes personnels ; une licence est requise pour les organisations GitHub.

---

*KonfiturGame · Pipeline CI/CD · Mis à jour : 2026-07-08*
