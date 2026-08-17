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
  - `appwrite.json` → `appwrite push tables --force` depuis le runner CI (job `deploy-schema`)
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
| `APPWRITE_API_KEY` | Clé API Appwrite de **prod**, scopes `functions.read/write` + `databases.read/write` (deploy-functions et deploy-schema) |

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

Console Appwrite prod → Project → API keys → créer une clé avec les scopes `functions.read`, `functions.write`, `databases.read`, `databases.write` :

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

**`Déploiement infra (compose / traefik / supervision)`** — déclenché si `docker-compose.yml`, `traefik/**`, `monitoring/**` ou `scripts/**` est modifié. Les deux derniers chemins ne sont pas décoratifs : règles d'alerte et scripts d'exploitation vivent dans le dépôt sans être embarqués dans aucune image, ils n'atteignent donc la production que par ce job.
- SSH via appleboy/ssh-action v1.2.0, `script_stop: true`.
- `VPS_APP_DIR` transmis comme variable d'environnement `APP_DIR` via `envs: APP_DIR`.
- Séquence : `git pull --ff-only origin main` → `docker compose … up -d --remove-orphans` → `docker compose … kill -s HUP prometheus alertmanager` → `bash scripts/deploy-cron.sh "$APP_DIR"`.
- Le `kill -s HUP` n'est pas un redémarrage : les configurations de supervision sont montées en volume, donc `up -d` ne recrée pas ces conteneurs quand seul un fichier de règles change et l'ancienne configuration reste en mémoire. SIGHUP force la relecture sans trou dans la collecte ni perte des silences en cours.
- Healthchecks (10 × 10 s) : frontend (`https://konfiturgame.fr`, HTTP 200) et Appwrite (`https://api.konfiturgame.fr/v1/health`, 200 ou 401), puis Grafana.
- Smoke test de supervision (5 × 30 s) : `scripts/ci/monitoring-check.sh` exécuté **sur le VPS**, contre l'IP du conteneur Prometheus — son API n'est publiée ni sur Internet ni sur l'hôte.

> ⚠️ **`script_stop: true` n'est pas un `set -e`.** drone-ssh découpe le script en **lignes** et insère après chacune un test du code retour. Ce test atterrit donc *à l'intérieur* des structures multi-lignes : placé en tête d'une branche `else` d'un `if ! cmd`, il lit le code de la condition — que le `!` a mis à 1 quand elle est vraie — et coupe le job **sans un mot**. Symptôme : sortie 1, journal muet.
>
> Règle : **une commande par ligne dans le YAML, tout contrôle de flux dans un script versionné**, appelé sur une seule ligne. C'est la raison d'être de `scripts/deploy-cron.sh`.

**`Déploiement frontend`** — déclenché si `frontend/**` est modifié.
- Attend aussi `Déploiement infra` (`success` ou `skipped`).
- Séquence : `git pull --ff-only origin main` → `bash scripts/deploy-frontend.sh "$APP_DIR" build`.
- Healthcheck frontend identique.
- **Puis, et seulement si le healthcheck a réussi**, une étape SSH distincte appelle `bash "$APP_DIR/scripts/deploy-frontend.sh" "$APP_DIR" promote` : elle pose l'alias `konfitur-frontend:stable` et purge les tags de SHA au-delà des 5 derniers. La séparation est le cœur du dispositif — `stable` ne désigne qu'une image dont on a la **preuve** qu'elle a servi un 200 depuis l'extérieur. Si la CI meurt entre les deux, `stable` reste sur l'image précédente : le comportement dégradé est le comportement sûr.
- Le healthcheck reste sur le runner GitHub et non dans le script : depuis le VPS, un `curl` vers le domaine public ne prouverait ni la résolution DNS publique ni l'ouverture du pare-feu.

**`Déploiement Appwrite functions`** — déclenché si `appwrite.json` ou `functions/**` est modifié.
- S'exécute sur le runner CI (pas SSH) : installe `appwrite-cli@17.3.1` (npm global, exception à pnpm — runner éphémère).
- Configure le client avec `APPWRITE_API_KEY`, endpoint et project-id.
- `appwrite push functions --force`.

**`Déploiement schéma Appwrite`** — déclenché si `appwrite.json` est modifié (filtre `schema` dédié : un changement limité à `functions/**` ne re-pousse pas le schéma).
- Mêmes étapes que deploy-functions (runner CI, `appwrite-cli@17.3.1`, client configuré avec `APPWRITE_API_KEY`).
- `appwrite push tables --force` — `appwrite.json` est la source de vérité du schéma (voir `MISE-A-JOUR.md §7`).
- Prérequis : la clé API de prod porte les scopes `databases.read`/`databases.write`.

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

### Frontend — bascule d'image, jamais de `git reset`

Chaque déploiement construit `konfitur-frontend:<sha>` et `stable` désigne la dernière image ayant répondu 200 depuis l'extérieur. Le retour arrière est un changement de variable dans `.env`, non versionné : **l'historique git du serveur n'est pas touché et le `git pull --ff-only` du déploiement suivant continue de passer.**

```bash
ssh <user>@<vps>
cd <VPS_APP_DIR>
docker images konfitur-frontend --format '{{.Tag}}\t{{.CreatedAt}}'   # points de retour disponibles
# Éditer FRONTEND_TAG dans .env : un SHA, `stable`, ou un alias de version (`v1.1.0`)
docker compose -f docker-compose.yml up -d frontend
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"
curl -s -o /dev/null -w '%{http_code}\n' -A "$UA" https://konfiturgame.fr   # attendu: 200
```

L'image existant déjà localement, `up -d` ne reconstruit rien. Le déploiement suivant réécrit `FRONTEND_TAG` au nouveau SHA : aucune étape de rattrapage à ne pas oublier.

> L'UA de navigateur est obligatoire : `proxy.ts` répond 403 à `curl/` et bannit l'IP appelante.

Procédure détaillée, limites et aliasage de version : **`docs/MISE-A-JOUR.md §9`**.

### Configuration d'infrastructure — `git revert`, jamais `git reset`

L'image ne contient que le frontend. Un commit qui touche `docker-compose.yml`, `traefik/`, `monitoring/` ou `scripts/` n'est pas annulé par une bascule d'image : ces fichiers viennent du dépôt. Utiliser `git revert` sur `main`, qui **avance** l'historique au lieu de le réécrire et reste donc compatible `--ff-only` — puis laisser la CI redéployer.

Un `git reset --hard` sur le dépôt du VPS fait échouer le `git pull --ff-only` de tous les déploiements suivants et laisse le serveur dans un état à réparer à la main : ne pas le faire.

---

## Phase 2 — schéma Appwrite dans la CI

**Activée (2026-07-14)** : le job `deploy-schema` pousse `appwrite push tables --force` sur push `main` quand `appwrite.json` change (la commande `push collections` est dépréciée depuis la CLI 17). Son échec alimente l'issue `deploy-failure` comme les autres jobs de déploiement.

- **Prérequis opérationnel** : la clé API de prod (`APPWRITE_API_KEY`) doit porter les scopes `databases.read`/`databases.write` — sinon le job échoue au push.
- Les scripts shell de schéma (`init-appwrite.sh`, `update-schema-phase1.sh`) sont obsolètes (`seed-data.sh` reste utile pour les données de test).

Procédure détaillée : `MISE-A-JOUR.md §7`.

---

## Durcir le pipeline

Les jobs Semgrep / audit dépendances / Docker sont non bloquants (`continue-on-error: true`). Une fois les faux positifs triés via l'issue `security-report`, retirer `continue-on-error: true` du job concerné pour le rendre bloquant.

---

## Notes diverses

- **Tests E2E hors CI** : la suite Playwright (`pnpm e2e`) nécessite l'infrastructure Docker complète (frontend + Appwrite + données de test) — elle ne tourne **pas** dans le pipeline. L'exécuter localement avant de merger (voir `docs/DOC_test_E2E.md`).
- **Version Appwrite CLI épinglée** : le workflow épingle `appwrite-cli@17.3.1` (`ci-cd.yml`, jobs deploy-functions et deploy-schema), compatible serveur 1.9.0 (une CLI incompatible provoque des erreurs "Route not found" — tableau de compatibilité dans `MISE-A-JOUR.md §4`). Revalider à chaque upgrade Appwrite.
- **Force-push sans ancêtre commun** : paths-filter considère alors tous les fichiers comme modifiés → redéploiement complet. Ne pas force-pusher sur `main` inutilement.
- **Concurrence** : un seul run à la fois par branche (`concurrency` au niveau workflow) ; les runs de PR sont annulés si un nouveau push arrive, les runs de push sur `main` attendent.
- **gitleaks-action v3** : gratuit pour les comptes personnels ; une licence est requise pour les organisations GitHub.

---

*KonfiturGame · Pipeline CI/CD · Mis à jour : 2026-08-08*
