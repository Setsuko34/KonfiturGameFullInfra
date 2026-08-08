#!/usr/bin/env bash
# =============================================================================
# Installation du crontab versionné dans /etc/cron.d — appelé par deploy-infra.
#
# Le crontab est versionné, mais cron ne lit que /etc/cron.d : tant que
# personne ne l'y copie, une cadence corrigée dans le dépôt ne change rien sur
# le serveur.
#
# ── Pourquoi un script et pas quelques lignes dans ci-cd.yml ────────────────
# `script_stop: true` d'appleboy/ssh-action n'est pas un `set -e` : drone-ssh
# découpe le script en LIGNES et insère après chacune un
#   DRONE_SSH_PREV_COMMAND_EXIT_CODE=$? ; if [ ... -ne 0 ]; then exit ...; fi;
# Ce test atterrit donc à l'intérieur des structures multi-lignes. Placé en
# tête d'une branche `else` d'un `if ! cmd`, il lit le code de la condition —
# que le `!` a mis à 1 quand elle est vraie — et coupe le déploiement sans un
# mot. C'est l'échec du 2026-08-08 : sortie 1, journal muet après le SIGHUP,
# alors que le crontab était simplement déjà à jour.
#
# Un appel sur UNE SEULE ligne depuis le workflow est la seule forme immunisée.
# Tout contrôle de flux doit vivre ici, dans un vrai fichier, exécuté par un
# vrai shell — et au passage couvert par shellcheck en CI.
#
# La règle sudoers correspondante est documentée dans
# scripts/sudoers.d/konfitur-deploy-cron : elle filtre sur la ligne de commande
# EXACTE. Modifier un drapeau de `cmp` ou d'`install` ci-dessous sans le
# répercuter là-bas fait échouer le déploiement.
# =============================================================================
set -euo pipefail

APP_DIR="${1:?usage: deploy-cron.sh <APP_DIR>}"
CRON_SRC="$APP_DIR/scripts/crontab.konfiturgame"
CRON_DST=/etc/cron.d/konfiturgame

# `cmp -s` est muet même quand la destination n'existe pas encore (code 2) :
# le premier déploiement passe par la branche d'installation sans bruit.
if sudo -n cmp -s "$CRON_SRC" "$CRON_DST"; then
  echo "✅ Crontab déjà à jour"
  exit 0
fi

if ! sudo -n install -o root -g root -m 644 "$CRON_SRC" "$CRON_DST"; then
  echo "❌ Installation du crontab refusée : sudo a rejeté la commande." >&2
  echo "   /etc/sudoers.d/konfitur-deploy-cron est absent, mal formé," >&2
  echo "   ou ne correspond plus à la ligne de commande ci-dessus." >&2
  echo "   Procédure et règle de référence :" >&2
  echo "   scripts/sudoers.d/konfitur-deploy-cron (en-tête du fichier)." >&2
  echo "   Diagnostic sur le serveur : sudo -u deploy sudo -n -l" >&2
  exit 1
fi

echo "✅ Crontab installé dans $CRON_DST"
