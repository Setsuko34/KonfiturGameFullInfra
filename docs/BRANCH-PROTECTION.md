# Protections de branche — Rulesets GitHub

Référence des rulesets du repo `Setsuko34/KonfiturGameFullInfra` : ce qui est en place, pourquoi, et comment les gérer via `gh api`.

> **Prérequis** : `gh auth login` effectué. Toutes les commandes ci-dessous se lancent depuis n'importe quel répertoire.

---

## Limitation plan Free + repo privé

Le repo est **privé**. Sur un plan GitHub **Free**, les rulesets et protections de branche **ne sont pas appliqués sur les repos privés** (fonctionnalité Pro/Team). Les commandes de création réussissent, le ruleset apparaît `active`, mais **l'enforcement est sans effet**.

Options : passer le repo en public, ou prendre GitHub Pro. Vérifier après tout changement de plan/visibilité avec un test (tenter un push direct sur `main`).

---

## État actuel

| Ruleset | ID | Branches ciblées | Règles | Statut |
|---------|----|------------------|--------|--------|
| `protect-main` | `17600321` | `main` | deletion, non_fast_forward, pull_request, required_status_checks (strict) | Actif — créé le 2026-06-12 |
| `protect-develop` | `17600329` | `develop` | non_fast_forward, pull_request, required_status_checks | Actif — créé le 2026-06-12 |
| `Prod` | `14894070` | **AUCUNE** (`include` vide) | deletion, non_fast_forward | Inopérant — créé le 2026-04-10, jamais ciblé sur une branche. Supprimable : `gh api repos/Setsuko34/KonfiturGameFullInfra/rulesets/14894070 --method DELETE` |

Vérifier l'état réel à tout moment :

```bash
gh api repos/Setsuko34/KonfiturGameFullInfra/rulesets --jq '.[] | {id, name, enforcement}'
```

---

## Configuration cible

### `main` — branche qui déploie (protection stricte)

| Protection | Règle API | Pourquoi |
|------------|-----------|----------|
| PR obligatoire avant merge | `pull_request` | Aucun déploiement sans PR validée |
| Status checks requis (4 bloquants) | `required_status_checks` | Lint + type-check, Tests unitaires, Scan secrets, Checklist RGPD |
| Branche à jour avant merge | `strict_required_status_checks_policy: true` | Ce qui est testé = ce qui est déployé |
| Force push interdit | `non_fast_forward` | Le `paths-filter` redéploie tout sur un force-push ; le `git pull --ff-only` du VPS casserait |
| Suppression interdite | `deletion` | Évidence |

### `develop` — protection légère

| Protection | Règle API |
|------------|-----------|
| PR obligatoire avant merge | `pull_request` |
| Status checks requis (les 4 mêmes) | `required_status_checks` (sans `strict`) |
| Force push interdit | `non_fast_forward` |

### Points d'attention

- **Les `context` des status checks = les `name:` exacts des jobs** dans `.github/workflows/ci-cd.yml`. Si un job est renommé, mettre à jour le ruleset, sinon les PR resteront bloquées en « Expected ».
- **Ne jamais ajouter** les jobs non bloquants (Semgrep, audit deps, lint Docker) ni les jobs `deploy-*` comme checks requis.
- **`integration_id: 15368`** = GitHub Actions. Garantit que seul Actions peut fournir ces checks.
- **`required_approving_review_count: 0`** : PR obligatoire mais pas l'approbation — indispensable en solo.
- **`bypass_actors: []`** : personne ne contourne le ruleset, pas même l'admin du repo.

---

## Créer les rulesets

### Ruleset `main`

```bash
gh api repos/Setsuko34/KonfiturGameFullInfra/rulesets --method POST --input - <<'EOF'
{
  "name": "protect-main",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": { "include": ["refs/heads/main"], "exclude": [] }
  },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          { "context": "Lint + type-check", "integration_id": 15368 },
          { "context": "Tests unitaires", "integration_id": 15368 },
          { "context": "Scan secrets (gitleaks)", "integration_id": 15368 },
          { "context": "Checklist RGPD", "integration_id": 15368 }
        ]
      }
    }
  ]
}
EOF
```

### Ruleset `develop`

```bash
gh api repos/Setsuko34/KonfiturGameFullInfra/rulesets --method POST --input - <<'EOF'
{
  "name": "protect-develop",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": { "include": ["refs/heads/develop"], "exclude": [] }
  },
  "rules": [
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [
          { "context": "Lint + type-check", "integration_id": 15368 },
          { "context": "Tests unitaires", "integration_id": 15368 },
          { "context": "Scan secrets (gitleaks)", "integration_id": 15368 },
          { "context": "Checklist RGPD", "integration_id": 15368 }
        ]
      }
    }
  ]
}
EOF
```

---

## Consulter

```bash
# Lister tous les rulesets
gh api repos/Setsuko34/KonfiturGameFullInfra/rulesets --jq '.[] | {id, name, enforcement}'

# Détail complet d'un ruleset
gh api repos/Setsuko34/KonfiturGameFullInfra/rulesets/<ID>

# Règles effectives sur une branche
gh api "repos/Setsuko34/KonfiturGameFullInfra/rules/branches/main"
```

Interface web : `https://github.com/Setsuko34/KonfiturGameFullInfra/settings/rules`

---

## Modifier

`PUT` remplace la config. Le plus sûr : récupérer le JSON existant, l'éditer, le renvoyer.

```bash
# 1. Exporter la config actuelle
gh api repos/Setsuko34/KonfiturGameFullInfra/rulesets/<ID> > /tmp/ruleset.json

# 2. Éditer /tmp/ruleset.json (garder : name, target, enforcement, conditions, rules, bypass_actors)

# 3. Renvoyer
gh api repos/Setsuko34/KonfiturGameFullInfra/rulesets/<ID> --method PUT --input /tmp/ruleset.json
```

### Désactiver temporairement (sans supprimer)

Utile pour un hotfix d'urgence — passer `enforcement` à `"disabled"` puis `"active"` :

```bash
gh api repos/Setsuko34/KonfiturGameFullInfra/rulesets/<ID> --method PUT \
  --input <(gh api repos/Setsuko34/KonfiturGameFullInfra/rulesets/<ID> | jq '.enforcement = "disabled" | {name, target, enforcement, conditions, rules}')
```

---

## Supprimer

```bash
gh api repos/Setsuko34/KonfiturGameFullInfra/rulesets/<ID> --method DELETE
```

Aucune confirmation demandée — vérifier l'ID avant.

---

## Cas pratiques

| Situation | Action |
|-----------|--------|
| Hotfix urgent bloqué par les checks | Désactiver temporairement le ruleset (`enforcement: disabled`), merger, réactiver. Jamais de force push sur `main`. |
| Un job du workflow est renommé | Mettre à jour le `context` correspondant dans les deux rulesets |
| Nouveau check bloquant dans le CI | L'ajouter dans `required_status_checks` des deux rulesets |
| PR bloquée « Expected — Waiting for status » | Le check requis n'a pas tourné : nom de job différent du `context`, ou workflow non déclenché sur cette branche |
| Le merge est bloqué « branch out of date » | Normal sur `main` (`strict: true`) : rebase/merge `main` dans la branche de PR et laisser les checks retourner |

---

*KonfiturGame · Rulesets GitHub · Mis à jour : 2026-07-08*
