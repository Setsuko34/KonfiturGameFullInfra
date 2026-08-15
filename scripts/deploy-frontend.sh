#!/usr/bin/env bash
# =============================================================================
# deploy-frontend.sh — build tagué et promotion de l'image frontend
#
# ── Ce que ça corrige ───────────────────────────────────────────────────────
# Le service `frontend` n'avait pas de clé `image:` : Compose lui donnait un
# nom implicite, écrasé à chaque build. Aucun artefact ne survivait au
# déploiement suivant, et le seul rollback documenté était
#     git reset --hard <commit>  +  rebuild
# sur le dépôt du serveur. Cette réécriture d'historique fait échouer le
# `git pull --ff-only` du déploiement suivant : MISE-A-JOUR.md le reconnaissait
# et proposait un `git reset --hard origin/main` de rattrapage, à ne pas
# oublier, un jour de panne.
#
# Ici chaque build produit `konfitur-frontend:<sha>`. Revenir en arrière est un
# changement de variable dans .env, jamais une opération git.
#
# ── Pourquoi deux actions et non une ────────────────────────────────────────
# `build` construit et démarre ; `promote` pose l'alias `stable`. Entre les
# deux, la CI vérifie depuis l'extérieur que le site répond 200. `stable` ne
# désigne donc QUE des images dont on a la preuve qu'elles ont servi du trafic.
# Un point de retour non vérifié ne vaut pas mieux que pas de point de retour.
# Si la CI meurt entre les deux, `stable` reste sur l'image précédente : le
# comportement dégradé est le comportement sûr.
#
# ── Pourquoi un script et pas quelques lignes dans ci-cd.yml ────────────────
# `script_stop: true` d'appleboy/ssh-action n'est pas un `set -e` : drone-ssh
# découpe le script en LIGNES et insère après chacune un test du code retour.
# Ce test atterrit à l'intérieur des structures multi-lignes et coupe le job
# sans un mot (voir l'en-tête de deploy-cron.sh, panne du 2026-08-08). Un appel
# sur UNE SEULE ligne depuis le workflow est la seule forme immunisée.
#
# Usage : deploy-frontend.sh <APP_DIR> build|promote
# Sortie: 0 si l'action a réussi, 1 sinon
# =============================================================================
set -euo pipefail

APP_DIR="${1:?usage: deploy-frontend.sh <APP_DIR> build|promote}"
ACTION="${2:?usage: deploy-frontend.sh <APP_DIR> build|promote}"

IMAGE_NAME=konfitur-frontend
ENV_FILE="$APP_DIR/.env"
KEEP=5

# `-f docker-compose.yml` SEUL : docker-compose.override.yml est versionné,
# donc un `docker compose` nu l'appliquerait et redéploierait le frontend en
# configuration de DÉVELOPPEMENT, en pleine production. Même précaution que
# health-check.sh.
COMPOSE=(docker compose -f "$APP_DIR/docker-compose.yml")

cd "$APP_DIR"

# ── Écriture idempotente du tag dans .env ───────────────────────────────────
# La valeur est lue par docker-compose.yml, mais AUSSI par health-check.sh, qui
# relance les conteneurs tombés avec le même fichier compose. Les deux voient
# donc toujours la même image : la sonde de dernier recours ne peut pas
# ramener silencieusement la version qu'on vient d'écarter. Ne jamais coder le
# tag ailleurs qu'ici.
#
# Remplacement de ligne ou ajout, jamais de réécriture globale : .env porte
# tous les secrets de la production.
set_env_tag() {
  local tag="$1"
  if grep -q '^FRONTEND_TAG=' "$ENV_FILE"; then
    sed -i "s/^FRONTEND_TAG=.*/FRONTEND_TAG=$tag/" "$ENV_FILE"
  else
    printf 'FRONTEND_TAG=%s\n' "$tag" >> "$ENV_FILE"
  fi
}

read_env_tag() {
  # `|| true` : grep sort 1 quand la ligne est absente, ce que `set -e`
  # traiterait comme une panne alors que c'est un cas nominal au premier
  # déploiement. Le contrôle de vacuité est fait par l'appelant.
  grep '^FRONTEND_TAG=' "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2 | tr -d ' \r' || true
}

# ── Rétention ───────────────────────────────────────────────────────────────
# On ne purge QUE les tags de SHA : `stable` et les alias `vX.Y.Z` sont les
# points de retour nommés, ils ne se périment pas.
#
# `docker system prune -f` du lundi (scripts/crontab.konfiturgame) ne supprime
# que les images DANGLING : une image taguée lui survit, et c'est ce qui rend
# ces points de retour durables. Ne jamais passer ce prune en `-a`.
prune_old_tags() {
  local old obsolete

  # `|| true` sur le pipeline entier : `grep` sort en 1 quand aucun tag de SHA
  # n'existe encore, et `pipefail` ferait alors échouer la promotion alors
  # qu'il n'y a simplement rien à purger. Le tri porte sur la date de création,
  # d'où le format `CreatedAt\tTag` : les KEEP premiers sont les plus récents.
  obsolete="$(docker images "$IMAGE_NAME" --format '{{.CreatedAt}}\t{{.Tag}}' \
    | sort -r \
    | cut -f2 \
    | grep -E '^[0-9a-f]{7,12}$' \
    | tail -n "+$((KEEP + 1))" || true)"

  [ -n "$obsolete" ] || return 0

  while read -r old; do
    # Un `rmi` sur l'image d'un conteneur en cours d'exécution échoue : c'est
    # le filet de sécurité qui joue, pas une anomalie. Ignoré explicitement.
    docker rmi "$IMAGE_NAME:$old" >/dev/null 2>&1 || true
    echo "ℹ️  Image $IMAGE_NAME:$old purgée (rétention : $KEEP tags)"
  done <<< "$obsolete"
}

case "$ACTION" in
  build)
    SHA="$(git -C "$APP_DIR" rev-parse --short HEAD)"

    # Le tag est passé au build ET écrit dans .env avant le `up` : les deux
    # commandes doivent désigner la même image, y compris si le `up` est
    # rejoué à la main plus tard.
    FRONTEND_TAG="$SHA" "${COMPOSE[@]}" build frontend
    set_env_tag "$SHA"
    "${COMPOSE[@]}" up -d frontend
    echo "✅ Frontend démarré sur $IMAGE_NAME:$SHA"
    echo "ℹ️  Promotion en 'stable' seulement après le healthcheck externe"
    ;;

  promote)
    TAG="$(read_env_tag)"
    if [ -z "$TAG" ]; then
      echo "❌ FRONTEND_TAG absent de $ENV_FILE : rien à promouvoir." >&2
      echo "   L'action 'build' aurait dû l'y écrire — le déploiement a-t-il" >&2
      echo "   bien atteint cette étape ? Voir le journal du job deploy-frontend." >&2
      exit 1
    fi
    if ! docker image inspect "$IMAGE_NAME:$TAG" >/dev/null 2>&1; then
      echo "❌ Image $IMAGE_NAME:$TAG introuvable : promotion refusée." >&2
      echo "   Promouvoir un tag absent ferait pointer 'stable' vers le vide," >&2
      echo "   et le rollback échouerait le jour où on en a besoin." >&2
      exit 1
    fi

    docker tag "$IMAGE_NAME:$TAG" "$IMAGE_NAME:stable"
    echo "✅ $IMAGE_NAME:$TAG promu 'stable' (vérifié 200 depuis l'extérieur)"

    # Alias de version. Un tag git est en pratique posé APRÈS le déploiement :
    # le serveur ne le connaît donc pas encore, et cette branche ne fait rien
    # la plupart du temps. L'aliasage manuel au moment de la release est
    # documenté dans MISE-A-JOUR.md §9. Quand le tag est déjà là, faire
    # coïncider tag git et tag d'image ne coûte rien.
    VTAG="$(git -C "$APP_DIR" tag --points-at HEAD 2>/dev/null | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -1 || true)"
    if [ -n "$VTAG" ]; then
      docker tag "$IMAGE_NAME:$TAG" "$IMAGE_NAME:$VTAG"
      echo "✅ Alias de version posé : $IMAGE_NAME:$VTAG"
    fi

    prune_old_tags
    ;;

  *)
    echo "❌ Action inconnue : '$ACTION' (attendu : build ou promote)" >&2
    exit 1
    ;;
esac
