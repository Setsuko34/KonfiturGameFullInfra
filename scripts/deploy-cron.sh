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

# ── 1. Installation du crontab ──────────────────────────────────────────────
# `cmp -s` est muet même quand la destination n'existe pas encore (code 2) :
# le premier déploiement passe par la branche d'installation sans bruit.
#
# Pas de `systemctl restart cron` : cron relit /etc/cron.d à chaque minute dès
# que la mtime change. Le redémarrage que suggère l'en-tête de
# crontab.konfiturgame est superflu, et exigerait une seconde règle sudoers.
if sudo -n cmp -s "$CRON_SRC" "$CRON_DST"; then
  echo "✅ Crontab déjà à jour"
elif sudo -n install -o root -g root -m 644 "$CRON_SRC" "$CRON_DST"; then
  echo "✅ Crontab installé dans $CRON_DST"
else
  echo "❌ Installation du crontab refusée : sudo a rejeté la commande." >&2
  echo "   /etc/sudoers.d/konfitur-deploy-cron est absent, mal formé," >&2
  echo "   ou ne correspond plus à la ligne de commande ci-dessus." >&2
  echo "   Procédure et règle de référence :" >&2
  echo "   scripts/sudoers.d/konfitur-deploy-cron (en-tête du fichier)." >&2
  echo "   Diagnostic sur le serveur : sudo -u deploy sudo -n -l" >&2
  exit 1
fi

# ── 2. Le démon qui lit ce fichier tourne-t-il ? ────────────────────────────
# Déposer un fichier dans /etc/cron.d ne prouve rien. Les images Debian cloud
# minimales n'embarquent pas toujours le paquet cron, et un service arrêté ne
# se signale à personne : le fichier reste là, parfaitement installé, et rien
# ne s'exécute jamais.
#
# C'est toute la panne du 2026-08-10. /etc/cron.d/konfiturgame était présent,
# root:root 644, identique au dépôt au bit près — et zéro ligne CRON dans
# syslog depuis deux jours, le démon étant `inactive`. Chaque déploiement
# annonçait « Crontab déjà à jour », ce qui était vrai et sans le moindre
# rapport avec la question de savoir si les tâches tournaient.
#
# Fatal plutôt qu'avertissement : sans cron, il n'y a ni sonde de dernier
# recours ni sauvegarde quotidienne. Un déploiement vert affirmerait le
# contraire, et c'est précisément ce silence qui a coûté deux jours.
if ! systemctl is-active --quiet cron; then
  echo "❌ Le démon cron n'est pas actif : /etc/cron.d/konfiturgame ne sera jamais lu." >&2
  echo "   Ni la sonde de santé (5 min) ni la sauvegarde (2 h) ne tournent." >&2
  echo "   Sur le serveur : sudo systemctl enable --now cron" >&2
  echo "   Si l'unité n'existe pas : sudo apt-get install -y cron" >&2
  exit 1
fi
echo "✅ Démon cron actif"

# ── 3. Amorçage de la sonde de santé ────────────────────────────────────────
# Au tout premier déploiement, monitoring/textfile/ ne contient que .gitkeep :
# les .prom sont gitignorés, donc rien n'arrive par le `git pull`. La métrique
# de la sonde n'existera qu'au prochain top de 5 minutes — après quoi le smoke
# test de supervision, qui ne réessaie que 2 minutes, a déjà échoué.
#
# Une seule exécution ici suffit à amorcer la série ; les déploiements suivants
# trouvent le fichier et ne font rien. On ne fait PAS la même chose pour
# backup.sh : une sauvegarde complète à chaque premier déploiement est un coût
# qu'on ne veut pas dans le chemin critique, et son absence est traitée comme
# telle par monitoring-check.sh.
HEALTH_METRIC="$APP_DIR/monitoring/textfile/health_check.prom"
if [ ! -f "$HEALTH_METRIC" ]; then
  echo "ℹ️  Aucune métrique de sonde : amorçage de health-check.sh"

  # Journal détourné vers /tmp : le fichier de cron (/var/log/konfiturgame-
  # health.log) appartient à root, et ce script tourne sous le compte de
  # déploiement. Sans ce détournement, chaque écriture échouerait bruyamment
  # sans que le déploiement en pâtisse — du bruit qui apprend à ignorer le
  # journal. Les exécutions cron suivantes reprennent le chemin normal.
  #
  # Le code de sortie est relevé mais non fatal : health-check.sh renvoie 1
  # quand une anomalie SUBSISTE après tentative de remédiation. C'est l'affaire
  # des healthchecks du job, qui interrogent les surfaces publiques ; ici on ne
  # veut qu'amorcer la métrique.
  if HEALTHCHECK_LOG=/tmp/konfiturgame-health-bootstrap.log \
       bash "$APP_DIR/scripts/health-check.sh"; then
    echo "✅ Sonde amorcée — la métrique sera collectée sous 30 s"
  else
    echo "⚠️  health-check.sh signale des anomalies subsistantes (code $?)"
    echo "   Métrique tout de même publiée ; voir /tmp/konfiturgame-health-bootstrap.log"
  fi
fi
