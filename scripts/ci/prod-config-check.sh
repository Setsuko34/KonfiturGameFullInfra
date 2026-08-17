#!/usr/bin/env bash
# Cohérence de la configuration de PRODUCTION — job bloquant en CI.
#
# La stack de prod n'est jamais exercée en local (le dev contourne Traefik pour
# le frontend, et aucun router dev n'applique les middlewares). Ces
# vérifications remplacent cette absence de test : elles relisent la config de
# prod à chaque PR plutôt que de la découvrir cassée le jour du déploiement.
#
# Usage: scripts/ci/prod-config-check.sh [racine-du-repo]   (défaut: répertoire courant)
set -uo pipefail

ROOT="${1:-.}"
COMPOSE="$ROOT/docker-compose.yml"
MIDDLEWARES="$ROOT/traefik/dynamic/middlewares.yml"
ENV_EXAMPLE="$ROOT/.env.example"
ERRORS=0

fail() { echo "❌ $1"; ERRORS=$((ERRORS + 1)); }
ok()   { echo "✅ $1"; }

for f in "$COMPOSE" "$MIDDLEWARES" "$ENV_EXAMPLE"; do
  [ -f "$f" ] || { echo "ERREUR : fichier introuvable : $f"; exit 1; }
done

# tr -d '\r' : le repo vit sur un FS Windows — neutralise d'éventuels CRLF
DECLARED=$(tr -d '\r' < "$MIDDLEWARES" | grep -E '^    [a-z][a-z0-9-]*:$' | tr -d ' :')
REFS=$(grep -oE '\.middlewares=[a-zA-Z0-9,@_-]+' "$COMPOSE" | sed 's/\.middlewares=//' | tr ',' '\n' | tr -d '\r' | sort -u)

MW_ERRORS=0
while IFS= read -r ref; do
  [ -z "$ref" ] && continue
  case "$ref" in
    *@internal) continue ;;   # fourni par Traefik lui-même
    *@file)
      name="${ref%@file}"
      if ! printf '%s\n' "$DECLARED" | grep -qxF "$name"; then
        fail "Middleware '$name' référencé dans docker-compose.yml mais absent de traefik/dynamic/middlewares.yml"
        MW_ERRORS=$((MW_ERRORS + 1))
      fi
      ;;
    *@*) continue ;;          # autre provider explicite, hors de notre portée
    *)
      fail "Middleware '$ref' sans suffixe de provider : les routers sont déclarés côté docker, écrire '$ref@file' (sinon Traefik désactive le router → 404)"
      MW_ERRORS=$((MW_ERRORS + 1))
      ;;
  esac
done <<< "$REFS"
[ "$MW_ERRORS" -eq 0 ] && ok "Middlewares Traefik : toutes les références résolvent"

# 2. La CSP de prod ne doit pas pointer vers une adresse locale.
CSP=$(sed -n '/contentSecurityPolicy/,/frame-ancestors/p' "$MIDDLEWARES")
if printf '%s' "$CSP" | grep -qE 'localhost|127\.0\.0\.1'; then
  fail "La CSP de traefik/dynamic/middlewares.yml référence une adresse locale (localhost / 127.0.0.1)"
else
  ok "CSP : aucune adresse locale"
fi

# 3. Toute variable consommée par le compose de prod est documentée dans
#    .env.example.
VARS=$(grep -oE '\$\{[A-Z_][A-Z0-9_]*' "$COMPOSE" | sed 's/\${//' | tr -d '\r' | sort -u)
VAR_ERRORS=0
while IFS= read -r var; do
  [ -z "$var" ] && continue
  if ! grep -qE "^${var}=" "$ENV_EXAMPLE"; then
    fail "Variable '$var' utilisée par docker-compose.yml mais absente de .env.example"
    VAR_ERRORS=$((VAR_ERRORS + 1))
  fi
done <<< "$VARS"
[ "$VAR_ERRORS" -eq 0 ] && ok "Variables d'environnement : toutes documentées dans .env.example"

# 4. Les scripts invoqués par le crontab de production portent le bit
#    d'exécution DANS L'INDEX GIT.
CRONTAB="$ROOT/scripts/crontab.konfiturgame"
if [ -f "$CRONTAB" ]; then
  if ! git -C "$ROOT" rev-parse --git-dir >/dev/null 2>&1; then
    fail "Modes des tâches cron non vérifiables : '$ROOT' n'est pas un dépôt git lisible (droits d'accès ? mauvais répertoire ?)"
  else
    CRON_ERRORS=0
    CRON_SCRIPTS=$(tr -d '\r' < "$CRONTAB" | grep -vE '^[[:space:]]*#' \
      | grep -oE '\$APP_DIR/[^[:space:]]+\.sh' | sed 's|\$APP_DIR/||' | sort -u)
    # Une extraction vide traverserait la boucle sans rien vérifier et
    # afficherait quand même son ✅ : le contrôle se désactiverait tout seul le
    # jour où le crontab change de forme. C'est la panne qu'il est censé
    # prévenir — un vert qui répond à une autre question que celle posée.
    if [ -z "$CRON_SCRIPTS" ]; then
      fail "Aucun script extrait de $CRONTAB : le contrôle des modes ne vérifie plus rien. Adapter l'extraction à la syntaxe actuelle du crontab."
      CRON_ERRORS=$((CRON_ERRORS + 1))
    fi
    while IFS= read -r rel; do
      [ -z "$rel" ] && continue
      mode_line=$(git -C "$ROOT" ls-files -s -- "$rel")
      mode=${mode_line%% *}
      if [ -z "$mode" ]; then
        fail "Le crontab invoque '$rel', absent de l'index git : le serveur ne le recevra jamais"
        CRON_ERRORS=$((CRON_ERRORS + 1))
      elif [ "$mode" != "100755" ]; then
        fail "Le crontab invoque '$rel' directement alors qu'il est en $mode dans l'index git : cron échouera en « Permission denied », en silence. Corriger avec : git update-index --chmod=+x $rel"
        CRON_ERRORS=$((CRON_ERRORS + 1))
      fi
    done <<< "$CRON_SCRIPTS"
    [ "$CRON_ERRORS" -eq 0 ] && ok "Tâches cron : scripts invoqués exécutables dans l'index git"
  fi
fi

STATIC="$ROOT/traefik/traefik.yml"
if [ -f "$STATIC" ]; then
  if grep -vE '^[[:space:]]*#' "$STATIC" | grep -qE '\$\{[A-Za-z_]'; then
    fail "traefik/traefik.yml contient un \${VAR} : la config statique de Traefik n'est pas interpolée, écrire la valeur en dur"
  else
    ok "Config statique Traefik : aucune variable non interpolée"
  fi
fi

# 6. Le service frontend doit porter une image nommée ET versionnée.
#    Sans clé `image:`, Compose fabrique un nom implicite, écrasé à chaque
#    `build` : il ne reste aucun artefact vers lequel revenir, et le rollback
#    redevient le `git reset --hard` de MISE-A-JOUR.md — qui casse le
#    `git pull --ff-only` du déploiement suivant. Ce contrôle empêche la
#    disparition silencieuse du seul point de retour du frontend.
if grep -qE '^[[:space:]]+image:[[:space:]]+konfitur-frontend:\$\{FRONTEND_TAG' "$COMPOSE"; then
  ok "Image frontend : nommée et versionnée par \${FRONTEND_TAG}"
else
  fail "Le service frontend n'a pas d'image 'konfitur-frontend:\${FRONTEND_TAG...}' : plus aucun rollback par image possible (voir docs/MISE-A-JOUR.md §9 et scripts/deploy-frontend.sh)"
fi

# 7. Le nettoyage Docker hebdomadaire ne doit jamais purger les images taguées.
#    `docker system prune -f` ne supprime que les images DANGLING : les
#    `konfitur-frontend:<sha>`, `:stable` et `:vX.Y.Z` lui survivent, et c'est
#    précisément ce qui rend le rollback par image possible une semaine après
#    le déploiement. Avec `-a`, toute image sans conteneur en cours
#    disparaîtrait — donc TOUS les points de retour d'un coup, y compris le
#    dernier connu sain, un lundi à 5 h et sans le moindre message. Le crontab
#    porte l'avertissement en prose ; ce contrôle le rend opposable.
if [ -f "$CRONTAB" ]; then
  PRUNE=$(tr -d '\r' < "$CRONTAB" | grep -vE '^[[:space:]]*#' | grep 'docker system prune' || true)
  if [ -z "$PRUNE" ]; then
    ok "Nettoyage Docker : aucune tâche de prune planifiée"
  elif printf '%s\n' "$PRUNE" | grep -qE '(^|[[:space:]])(-[a-zA-Z]*a[a-zA-Z]*|--all)([[:space:]]|$)'; then
    fail "Le crontab lance 'docker system prune' avec -a/--all : les images konfitur-frontend taguées (<sha>, stable, vX.Y.Z) seraient détruites et il ne resterait plus aucun point de retour pour le frontend (voir docs/MISE-A-JOUR.md §9)"
  else
    ok "Nettoyage Docker : prune limité aux images dangling, les points de retour survivent"
  fi
fi

echo
if [ "$ERRORS" -gt 0 ]; then
  echo "Config de production : ÉCHEC ($ERRORS erreur(s))"
  exit 1
fi
echo "Config de production : OK"
