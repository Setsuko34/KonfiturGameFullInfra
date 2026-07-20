#!/usr/bin/env bash
# Cohérence de la configuration de PRODUCTION — job bloquant en CI.
#
# La stack de prod n'est jamais exercée en local (le dev contourne Traefik pour
# le frontend, et aucun router dev n'applique les middlewares). Ces trois
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
# 1. Chaque middleware référencé dans une étiquette existe et porte son suffixe.
#    Traefik n'ignore pas un middleware introuvable : il désactive le router
#    entier, donc 404 sur tout le site. Le suffixe @file est obligatoire car
#    les routers sont déclarés côté docker et les middlewares côté fichier.
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
#    Le file provider ne substitue pas les variables d'env : le domaine est en
#    dur, et une valeur de dev oubliée ici bloque tous les appels Appwrite et le
#    WebSocket du chat côté navigateur, sans erreur serveur visible.
CSP=$(sed -n '/contentSecurityPolicy/,/frame-ancestors/p' "$MIDDLEWARES")
if printf '%s' "$CSP" | grep -qE 'localhost|127\.0\.0\.1'; then
  fail "La CSP de traefik/dynamic/middlewares.yml référence une adresse locale (localhost / 127.0.0.1)"
else
  ok "CSP : aucune adresse locale"
fi

# 3. Toute variable consommée par le compose de prod est documentée dans
#    .env.example. Attrape la variable ajoutée côté dev et oubliée côté prod,
#    ou l'inverse : une variable vide donne un conteneur qui démarre puis
#    échoue silencieusement à l'usage.
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

echo
if [ "$ERRORS" -gt 0 ]; then
  echo "Config de production : ÉCHEC ($ERRORS erreur(s))"
  exit 1
fi
echo "Config de production : OK"
