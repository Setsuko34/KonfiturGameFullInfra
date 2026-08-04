#!/usr/bin/env bash
# =============================================================================
# health-check.sh — sonde de dernier recours et remédiation automatique
#
# Prometheus observe et alerte ; ce script AGIT. Les deux sont complémentaires
# et volontairement indépendants :
#
#   - Prometheus/Grafana tournent dans la même stack Docker que l'application.
#     Si le démon Docker se dégrade ou si le disque sature, la supervision
#     tombe avec ce qu'elle surveille — et personne n'est prévenu.
#   - Ce script ne dépend que de bash, docker et curl. Lancé par cron, il
#     constitue le plancher de supervision qui survit à la panne de l'étage
#     au-dessus, et il redémarre les conteneurs tombés sans intervention.
#
# Il publie aussi son résultat dans le collecteur textfile de node-exporter :
# Grafana sait donc si le script lui-même tourne encore.
#
# Usage : ./scripts/health-check.sh
# Cron  : */5 * * * * /opt/KonfiturGameFullInfra/scripts/health-check.sh
# Sortie: 0 si tout est sain, 1 si au moins une anomalie subsiste après action
# =============================================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Fichiers compose employés pour relancer un conteneur tombé.
# `-f docker-compose.yml` SEUL par défaut : docker-compose.override.yml est
# versionné, donc un `docker compose` nu l'appliquerait et relancerait le
# service en configuration de DÉVELOPPEMENT — en pleine production.
# Pour éprouver le script en local, demander explicitement les deux fichiers :
#   COMPOSE_FILES="-f docker-compose.yml -f docker-compose.override.yml" \
#     HEALTHCHECK_URL=http://localhost:3000 ./scripts/health-check.sh
COMPOSE_FILES="${COMPOSE_FILES:--f $PROJECT_DIR/docker-compose.yml}"

LOG_FILE="${HEALTHCHECK_LOG:-/var/log/konfiturgame-health.log}"
TEXTFILE_DIR="$PROJECT_DIR/monitoring/textfile"
METRICS_FILE="$TEXTFILE_DIR/health_check.prom"

DOMAIN_URL="${HEALTHCHECK_URL:-https://konfiturgame.fr}"
API_URL="${HEALTHCHECK_API_URL:-https://api.konfiturgame.fr/v1/health/version}"

# User-Agent de navigateur OBLIGATOIRE : bot-detection.ts bloque /curl\//i.
# Avec l'UA par défaut, proxy.ts répond 403 et bannit l'IP du serveur —
# la sonde déclencherait une fausse alerte puis se couperait l'accès.
# Même contrainte que le healthcheck de la CI et que blackbox-exporter.
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"

# Conteneurs dont l'arrêt rend la plateforme inutilisable.
CRITICAL_SERVICES=(
  konfitur-traefik
  konfitur-frontend
  konfitur-appwrite
  konfitur-appwrite-realtime
  konfitur-mariadb
  konfitur-redis
)

FAILURES=0
RESTARTS=0

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE" >&2; }

# ── 1. État des conteneurs critiques ────────────────────────────────────────
# `restart: unless-stopped` couvre déjà le crash simple. Ce qu'il ne couvre
# pas : le conteneur en état `exited` après un échec de démarrage répété, ou
# stoppé à la main puis oublié. D'où la relance explicite.
for svc in "${CRITICAL_SERVICES[@]}"; do
  status="$(docker inspect -f '{{.State.Status}}' "$svc" 2>/dev/null || echo "absent")"
  if [ "$status" != "running" ]; then
    log "P0 — $svc est '$status' : tentative de relance"
    # shellcheck disable=SC2086 — COMPOSE_FILES porte plusieurs arguments
    if docker compose $COMPOSE_FILES up -d "${svc#konfitur-}" >>"$LOG_FILE" 2>&1; then
      RESTARTS=$((RESTARTS + 1))
      sleep 5
      status="$(docker inspect -f '{{.State.Status}}' "$svc" 2>/dev/null || echo "absent")"
      if [ "$status" = "running" ]; then
        log "P0 — $svc relancé avec succès"
      else
        log "P0 — ÉCHEC de relance de $svc (état: $status) — intervention manuelle requise"
        FAILURES=$((FAILURES + 1))
      fi
    else
      log "P0 — commande de relance de $svc en échec — intervention manuelle requise"
      FAILURES=$((FAILURES + 1))
    fi
  fi
done

# ── 2. Disponibilité HTTP réelle ────────────────────────────────────────────
# Un conteneur `running` n'implique pas une application qui répond : Next.js
# peut être démarré mais planter au rendu, Traefik peut router vers le vide.
http_code="$(curl -s -o /dev/null -w '%{http_code}' -A "$UA" --max-time 15 "$DOMAIN_URL" 2>/dev/null || echo "000")"
if [ "$http_code" != "200" ]; then
  log "P0 — frontend injoignable ($DOMAIN_URL → HTTP $http_code)"
  FAILURES=$((FAILURES + 1))
fi

api_code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$API_URL" 2>/dev/null || echo "000")"
case "$api_code" in
  200|401) : ;;   # 401 = le service répond et applique son contrôle d'accès
  *)
    log "P0 — API Appwrite injoignable ($API_URL → HTTP $api_code)"
    FAILURES=$((FAILURES + 1))
    ;;
esac

# ── 3. Espace disque ────────────────────────────────────────────────────────
# Seuil bas volontairement large : à disque plein, MariaDB cesse d'écrire et
# les données en cours d'écriture peuvent être corrompues.
disk_used="$(df --output=pcent / 2>/dev/null | tail -1 | tr -dc '0-9')"
disk_used="${disk_used:-0}"
if [ "$disk_used" -ge 95 ]; then
  log "P0 — disque à ${disk_used}% : MariaDB risque de s'arrêter"
  FAILURES=$((FAILURES + 1))
elif [ "$disk_used" -ge 85 ]; then
  log "P2 — disque à ${disk_used}%"
fi

# ── 4. Publication des métriques pour node-exporter ─────────────────────────
# Écriture atomique (fichier temporaire puis mv) : node-exporter lit ce
# répertoire en continu et parserait un fichier tronqué comme une erreur.
mkdir -p "$TEXTFILE_DIR"
tmp="$(mktemp "$TEXTFILE_DIR/.health.XXXXXX")"
{
  echo "# HELP konfitur_healthcheck_last_run_timestamp_seconds Date de la dernière exécution du health-check."
  echo "# TYPE konfitur_healthcheck_last_run_timestamp_seconds gauge"
  echo "konfitur_healthcheck_last_run_timestamp_seconds $(date +%s)"
  echo "# HELP konfitur_healthcheck_failures Nombre d'anomalies non résolues au dernier passage."
  echo "# TYPE konfitur_healthcheck_failures gauge"
  echo "konfitur_healthcheck_failures $FAILURES"
  echo "# HELP konfitur_healthcheck_restarts Nombre de conteneurs relancés au dernier passage."
  echo "# TYPE konfitur_healthcheck_restarts gauge"
  echo "konfitur_healthcheck_restarts $RESTARTS"
  echo "# HELP konfitur_disk_used_percent Occupation du système de fichiers racine."
  echo "# TYPE konfitur_disk_used_percent gauge"
  echo "konfitur_disk_used_percent $disk_used"
} >"$tmp"
chmod 644 "$tmp"
mv "$tmp" "$METRICS_FILE"

if [ "$FAILURES" -gt 0 ]; then
  log "Bilan : $FAILURES anomalie(s) non résolue(s), $RESTARTS relance(s)"
  exit 1
fi

[ "$RESTARTS" -gt 0 ] && log "Bilan : sain après $RESTARTS relance(s)"
exit 0
