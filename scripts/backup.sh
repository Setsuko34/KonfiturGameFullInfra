#!/usr/bin/env bash
# =============================================================================
# backup.sh — Sauvegarde des volumes critiques Konfitur Game
# Usage : ./scripts/backup.sh [dossier-de-sortie]
# Par défaut, crée ./backups/YYYY-MM-DD_HH-MM/
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

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
  echo "❌ Fichier .env introuvable dans $PROJECT_DIR"
  exit 1
fi

BACKUP_DATE=$(date +"%Y-%m-%d_%H-%M")
BACKUP_DIR="${1:-$PROJECT_DIR/backups/$BACKUP_DATE}"
mkdir -p "$BACKUP_DIR"

echo "📦 Backup démarré → $BACKUP_DIR"
echo "────────────────────────────────────────"

# --- MariaDB : dump SQL propre ---
echo "🗄️  Dump MariaDB..."
docker exec konfitur-mariadb \
  mysqldump \
    --user=appwrite \
    --password="${MARIADB_PASSWORD}" \
    --single-transaction \
    --routines \
    --triggers \
    --databases appwrite \
  > "$BACKUP_DIR/mariadb.sql"
echo "   ✅ mariadb.sql ($(du -sh "$BACKUP_DIR/mariadb.sql" | cut -f1))"

# --- Volumes Appwrite : tar via container temporaire ---
backup_volume() {
  local volume_name="$1"
  local archive_name="$2"
  local mount_path="$3"

  echo "📁 Volume $volume_name..."
  docker run --rm \
    -v "${volume_name}:${mount_path}:ro" \
    -v "$BACKUP_DIR:/backup" \
    alpine \
    tar -czf "/backup/${archive_name}.tar.gz" -C "$mount_path" .
  echo "   ✅ ${archive_name}.tar.gz ($(du -sh "$BACKUP_DIR/${archive_name}.tar.gz" | cut -f1))"
}

# Nom des volumes = <nom_projet>_<nom_volume> selon docker compose
# On détecte le préfixe du projet
PROJECT_NAME=$(docker inspect konfitur-mariadb --format '{{ index .Config.Labels "com.docker.compose.project"}}' 2>/dev/null || echo "konfiturga mefullinfra")

backup_volume "${PROJECT_NAME}_appwrite-uploads"      "appwrite-uploads"      /storage/uploads
backup_volume "${PROJECT_NAME}_appwrite-config"       "appwrite-config"       /storage/config
backup_volume "${PROJECT_NAME}_appwrite-functions"    "appwrite-functions"    /storage/functions
backup_volume "${PROJECT_NAME}_appwrite-certificates" "appwrite-certificates" /storage/certificates

# --- Fichiers de config du projet (hors secrets) ---
echo "⚙️  Config projet..."
tar -czf "$BACKUP_DIR/project-config.tar.gz" \
  -C "$PROJECT_DIR" \
  --exclude='.env' \
  --exclude='node_modules' \
  --exclude='backups' \
  --exclude='.git' \
  --exclude='frontend/.next' \
  .
echo "   ✅ project-config.tar.gz"

# --- Manifeste ---
cat > "$BACKUP_DIR/MANIFEST.txt" <<EOF
Backup Konfitur Game
Date     : $BACKUP_DATE
Hostname : $(hostname)
Docker   : $(docker --version)

Fichiers :
$(ls -lh "$BACKUP_DIR")
EOF

echo "────────────────────────────────────────"
echo "✅ Backup terminé : $BACKUP_DIR"
echo ""
echo "Pour transférer sur un autre PC :"
echo "  tar -czf konfitur-backup-${BACKUP_DATE}.tar.gz -C \"$(dirname "$BACKUP_DIR")\" \"$BACKUP_DATE\""
echo "  # puis copier l'archive via USB, rsync, scp, etc."
