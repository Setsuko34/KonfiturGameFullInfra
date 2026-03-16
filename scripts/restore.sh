#!/usr/bin/env bash
# =============================================================================
# restore.sh — Restauration des volumes Konfitur Game depuis un backup
# Usage : ./scripts/restore.sh <dossier-de-backup>
# Exemple : ./scripts/restore.sh ./backups/2025-06-01_14-30
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

if [[ -z "${1:-}" ]]; then
  echo "Usage : $0 <dossier-de-backup>"
  echo "Exemple : $0 ./backups/2025-06-01_14-30"
  exit 1
fi

BACKUP_DIR="$(realpath "$1")"

if [[ ! -d "$BACKUP_DIR" ]]; then
  echo "❌ Dossier introuvable : $BACKUP_DIR"
  exit 1
fi

# Charger les variables d'environnement (sans évaluation shell)
load_env() {
  local file="$1"
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ "$line" =~ ^[[:space:]]*$ ]] && continue
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    local key value
    key="${line%%=*}"
    value="${line#*=}"
    [[ "$value" =~ ^\"(.*)\"$ ]] && value="${BASH_REMATCH[1]}"
    [[ "$value" =~ ^\'(.*)\'$ ]] && value="${BASH_REMATCH[1]}"
    printf -v "$key" '%s' "$value"
    export "$key"
  done < "$file"
}

if [[ -f "$PROJECT_DIR/.env" ]]; then
  load_env "$PROJECT_DIR/.env"
else
  echo "❌ Fichier .env introuvable. Copie ton .env avant de restaurer."
  exit 1
fi

echo "♻️  Restauration depuis : $BACKUP_DIR"
echo "⚠️  ATTENTION : ceci va écraser les données actuelles !"
read -rp "Confirmer ? (oui/non) : " CONFIRM
if [[ "$CONFIRM" != "oui" ]]; then
  echo "Annulé."
  exit 0
fi

echo "────────────────────────────────────────"

# Démarrer uniquement les services dépendants (sans appwrite)
echo "🚀 Démarrage MariaDB et Redis..."
docker compose -f "$PROJECT_DIR/docker-compose.yml" up -d mariadb redis
echo "   Attente que MariaDB soit prêt..."
until docker exec konfitur-mariadb mysqladmin ping --silent --user=root --password="${MARIADB_ROOT_PASSWORD}" 2>/dev/null; do
  sleep 2
done
echo "   ✅ MariaDB prêt"

# --- Restauration MariaDB ---
if [[ -f "$BACKUP_DIR/mariadb.sql" ]]; then
  echo "🗄️  Restauration MariaDB..."
  docker exec -i konfitur-mariadb \
    mysql \
      --user=root \
      --password="${MARIADB_ROOT_PASSWORD}" \
    < "$BACKUP_DIR/mariadb.sql"
  echo "   ✅ Base de données restaurée"
else
  echo "   ⚠️  mariadb.sql absent, MariaDB non restauré"
fi

# Détecter le préfixe projet
PROJECT_NAME=$(docker inspect konfitur-mariadb --format '{{ index .Config.Labels "com.docker.compose.project"}}' 2>/dev/null || echo "konfiturga mefullinfra")

# --- Restauration volumes Appwrite ---
restore_volume() {
  local archive_name="$1"
  local volume_name="$2"
  local mount_path="$3"

  local archive="$BACKUP_DIR/${archive_name}.tar.gz"
  if [[ ! -f "$archive" ]]; then
    echo "   ⚠️  $archive absent, ignoré"
    return
  fi

  echo "📁 Restauration volume $volume_name..."
  # Vider le volume puis y extraire l'archive
  docker run --rm \
    -v "${volume_name}:${mount_path}" \
    -v "$BACKUP_DIR:/backup:ro" \
    alpine \
    sh -c "rm -rf ${mount_path:?}/* ${mount_path}/.[!.]* 2>/dev/null; tar -xzf /backup/${archive_name}.tar.gz -C $mount_path"
  echo "   ✅ $volume_name restauré"
}

restore_volume "appwrite-uploads"      "${PROJECT_NAME}_appwrite-uploads"      /storage/uploads
restore_volume "appwrite-config"       "${PROJECT_NAME}_appwrite-config"       /storage/config
restore_volume "appwrite-functions"    "${PROJECT_NAME}_appwrite-functions"    /storage/functions
restore_volume "appwrite-certificates" "${PROJECT_NAME}_appwrite-certificates" /storage/certificates

echo "────────────────────────────────────────"
echo "✅ Restauration terminée !"
echo ""
echo "Prochaine étape :"
echo "  docker compose up -d"
