#!/usr/bin/env bash
# =============================================================================
# backup.sh — Sauvegarde complète Konfitur Game
# Usage : ./scripts/backup.sh [dossier-de-sortie]
# Par défaut, crée ./backups/YYYY-MM-DD_HH-MM/
#
# Contenu du backup :
#   mariadb.sql                — dump SQL complet (schéma + données internes Appwrite)
#   appwrite-*.tar.gz          — volumes Docker (uploads, config, functions, builds, certificates)
#   project-config.tar.gz      — fichiers du projet hors secrets
#   appwrite-schema.json        — schéma Appwrite via API (databases, collections, attributs, indexes)
#   appwrite-teams.json         — teams et memberships via API
#   appwrite-data.json          — documents de toutes les collections via API
#   appwrite-storage.json       — configuration des buckets via API
#   appwrite-functions.json     — configuration des functions + déploiement actif via API
#   MANIFEST.txt               — inventaire du backup
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

# =============================================================================
# 1. MariaDB : dump SQL complet
# =============================================================================
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

# =============================================================================
# 2. Volumes Appwrite : tar via container temporaire
# =============================================================================
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

# Détecter le préfixe du projet Docker Compose
PROJECT_NAME=$(docker inspect konfitur-mariadb --format '{{ index .Config.Labels "com.docker.compose.project"}}' 2>/dev/null || echo "konfiturga mefullinfra")

backup_volume "${PROJECT_NAME}_appwrite-uploads"      "appwrite-uploads"      /storage/uploads
backup_volume "${PROJECT_NAME}_appwrite-config"       "appwrite-config"       /storage/config
backup_volume "${PROJECT_NAME}_appwrite-functions"    "appwrite-functions"    /storage/functions
backup_volume "${PROJECT_NAME}_appwrite-builds"       "appwrite-builds"       /storage/builds
backup_volume "${PROJECT_NAME}_appwrite-certificates" "appwrite-certificates" /storage/certificates

# =============================================================================
# 3. Fichiers de config du projet (hors secrets)
# =============================================================================
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

# =============================================================================
# 4. Appwrite API Export : schéma, teams, documents
#    (non-bloquant si Appwrite est inaccessible)
# =============================================================================
# En dev, NEXT_PUBLIC_APPWRITE_ENDPOINT est dans docker-compose.override.yml (pas dans .env).
# Fallback : localhost/v1 via Traefik (port 80) ou localhost:8080/v1 (les deux fonctionnent).
AW_ENDPOINT="${NEXT_PUBLIC_APPWRITE_ENDPOINT:-http://localhost/v1}"
AW_PROJECT="${NEXT_PUBLIC_APPWRITE_PROJECT_ID:-}"
AW_KEY="${APPWRITE_API_KEY:-}"

aw_get() {
  # Appelle l'API Appwrite et retourne le JSON, ou "null" en cas d'erreur
  curl -sf \
    -H "X-Appwrite-Project: $AW_PROJECT" \
    -H "X-Appwrite-Key: $AW_KEY" \
    "${AW_ENDPOINT}${1}" 2>/dev/null || echo "null"
}

backup_appwrite_api() {
  if [[ -z "$AW_PROJECT" || -z "$AW_KEY" ]]; then
    echo "   ⚠️  NEXT_PUBLIC_APPWRITE_PROJECT_ID ou APPWRITE_API_KEY manquant"
    return 0
  fi

  if ! command -v jq &>/dev/null; then
    echo "   ⚠️  jq requis pour l'export API (sudo apt install jq)"
    return 0
  fi

  # Test de connectivité — /health est public et stable (sans -f pour tolérer les 5xx internes)
  local health
  health=$(curl -s \
    -H "X-Appwrite-Project: $AW_PROJECT" \
    -H "X-Appwrite-Key: $AW_KEY" \
    "${AW_ENDPOINT}/health" 2>/dev/null || echo "null")
  if [[ "$health" == "null" ]] || ! echo "$health" | jq -e '.status' &>/dev/null; then
    echo "   ⚠️  Appwrite API inaccessible depuis $AW_ENDPOINT — export API ignoré"
    echo "   💡 Lance le stack avec 'docker compose up' avant le backup pour inclure l'export API"
    return 1
  fi

  # ── 4a. Schéma (databases → collections → attributs + indexes) ──────────────
  echo "📐 Schéma Appwrite (collections, attributs, indexes)..."

  local dbs
  dbs=$(aw_get "/databases?limit=100")

  local schema_json
  schema_json=$(echo "$dbs" | jq \
    --arg date "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{version: "1.0", exportedAt: $date, databases: [.databases[] | {
      "$id": ."$id",
      name: .name
    }]}')

  while IFS= read -r db_id; do
    # listCollections inclut déjà les attributs et indexes dans Appwrite 1.5
    local cols_response
    cols_response=$(aw_get "/databases/${db_id}/collections?limit=100")

    schema_json=$(echo "$schema_json" | jq \
      --arg db_id "$db_id" \
      --argjson cols "$cols_response" \
      '.databases = [.databases[] | if ."$id" == $db_id then . + {collections: ($cols.collections // [])} else . end]')

    local col_count
    col_count=$(echo "$cols_response" | jq '.total // 0')
    echo "   DB $db_id : $col_count collection(s)"
  done < <(echo "$dbs" | jq -r '.databases[]."$id"')

  echo "$schema_json" > "$BACKUP_DIR/appwrite-schema.json"
  echo "   ✅ appwrite-schema.json"

  # ── 4b. Teams et memberships ─────────────────────────────────────────────────
  echo "👥 Teams Appwrite..."

  local teams_raw
  teams_raw=$(aw_get "/teams?limit=100")

  local teams_json
  teams_json=$(echo "$teams_raw" | jq \
    --arg date "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{version: "1.0", exportedAt: $date, teams: [.teams[] | {
      "$id": ."$id",
      name: .name,
      total: .total
    }]}')

  while IFS= read -r team_id; do
    local team_name memberships_raw
    team_name=$(echo "$teams_raw" | jq -r --arg id "$team_id" '.teams[] | select(."$id" == $id) | .name')
    memberships_raw=$(aw_get "/teams/${team_id}/memberships?limit=100")

    teams_json=$(echo "$teams_json" | jq \
      --arg team_id "$team_id" \
      --argjson members "$memberships_raw" \
      '.teams = [.teams[] | if ."$id" == $team_id then . + {
        memberships: [($members.memberships // [])[] | {
          userId: .userId,
          userName: .userName,
          userEmail: .userEmail,
          roles: .roles,
          confirm: .confirm
        }]
      } else . end]')

    local member_count
    member_count=$(echo "$memberships_raw" | jq '.total // 0')
    echo "   Team \"$team_name\" : $member_count membre(s)"
  done < <(echo "$teams_raw" | jq -r '.teams[]."$id"')

  echo "$teams_json" > "$BACKUP_DIR/appwrite-teams.json"
  echo "   ✅ appwrite-teams.json"

  # ── 4c. Documents (toutes les collections, paginé) ───────────────────────────
  echo "📄 Documents Appwrite (toutes collections)..."

  local data_json
  data_json=$(jq -n \
    --arg date "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{version: "1.0", exportedAt: $date, databases: {}}')

  local total_docs=0

  while IFS= read -r db_id; do
    data_json=$(echo "$data_json" | jq --arg db "$db_id" '.databases[$db] = {}')

    while IFS= read -r col_id; do
      # Pagination : récupère tous les documents par tranches de 100
      local all_docs="[]"
      local offset=0
      local limit=100
      local total=0

      # Premier appel pour connaître le total
      local first_page
      first_page=$(aw_get "/databases/${db_id}/collections/${col_id}/documents?limit=${limit}&offset=0")
      total=$(echo "$first_page" | jq '.total // 0')
      all_docs=$(echo "$first_page" | jq '.documents // []')
      offset=$limit

      # Pages suivantes si nécessaire
      while [ "$offset" -lt "$total" ]; do
        local page
        page=$(aw_get "/databases/${db_id}/collections/${col_id}/documents?limit=${limit}&offset=${offset}")
        local page_docs
        page_docs=$(echo "$page" | jq '.documents // []')
        all_docs=$(jq -n --argjson a "$all_docs" --argjson b "$page_docs" '$a + $b')
        offset=$((offset + limit))
      done

      local doc_count
      doc_count=$(echo "$all_docs" | jq 'length')
      total_docs=$((total_docs + doc_count))

      data_json=$(echo "$data_json" | jq \
        --arg db "$db_id" \
        --arg col "$col_id" \
        --argjson docs "$all_docs" \
        --argjson count "$doc_count" \
        '.databases[$db][$col] = {total: $count, documents: $docs}')

      echo "   ${db_id}/${col_id} : $doc_count document(s)"
    done < <(echo "$schema_json" | jq -r --arg db "$db_id" '.databases[] | select(."$id" == $db) | .collections[]."$id"')

  done < <(echo "$schema_json" | jq -r '.databases[]."$id"')

  echo "$data_json" > "$BACKUP_DIR/appwrite-data.json"
  echo "   ✅ appwrite-data.json ($total_docs document(s) au total)"

  # ── 4d. Storage buckets (configuration) ──────────────────────────────────────
  echo "🪣  Buckets Appwrite..."

  local buckets_raw
  buckets_raw=$(aw_get "/storage/buckets?limit=100")

  local buckets_json
  buckets_json=$(echo "$buckets_raw" | jq \
    --arg date "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{version: "1.0", exportedAt: $date, buckets: [.buckets[] | {
      "$id":                  ."$id",
      name:                   .name,
      "$permissions":         ."$permissions",
      fileSecurity:           .fileSecurity,
      enabled:                .enabled,
      maximumFileSize:        .maximumFileSize,
      allowedFileExtensions:  .allowedFileExtensions,
      compression:            .compression,
      encryption:             .encryption,
      antivirus:              .antivirus,
      transformations:        .transformations
    }]}')

  local bucket_count
  bucket_count=$(echo "$buckets_raw" | jq '.total // 0')
  echo "$buckets_json" > "$BACKUP_DIR/appwrite-storage.json"
  echo "   ✅ appwrite-storage.json ($bucket_count bucket(s))"

  # ── 4e. Functions + déploiement actif ────────────────────────────────────────
  echo "⚡ Functions Appwrite..."

  local functions_raw
  functions_raw=$(aw_get "/functions?limit=100")

  local functions_json
  functions_json=$(echo "$functions_raw" | jq \
    --arg date "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{version: "1.0", exportedAt: $date, functions: [.functions[] | {
      "$id":          ."$id",
      name:           .name,
      runtime:        .runtime,
      execute:        .execute,
      events:         .events,
      schedule:       .schedule,
      timeout:        .timeout,
      enabled:        .enabled,
      logging:        .logging,
      entrypoint:     .entrypoint,
      commands:       .commands,
      deploymentId:   .deploymentId,
      vars:           (.vars // [])
    }]}')

  # Pour chaque function, récupérer la liste des déploiements
  while IFS= read -r fn_id; do
    local deployments_raw active_dep
    deployments_raw=$(aw_get "/functions/${fn_id}/deployments?limit=25")

    # Garder uniquement le déploiement actif (status=ready) ou les 3 derniers
    active_dep=$(echo "$deployments_raw" | jq '[
      .deployments[] | {
        "$id":        ."$id",
        status:       .status,
        activate:     .activate,
        entrypoint:   .entrypoint,
        commands:     .commands,
        size:         .size,
        "$createdAt": ."$createdAt"
      }
    ] | sort_by(."$createdAt") | reverse | .[0:3]')

    functions_json=$(echo "$functions_json" | jq \
      --arg fn "$fn_id" \
      --argjson deps "$active_dep" \
      '.functions = [.functions[] | if ."$id" == $fn then . + {deployments: $deps} else . end]')

    local dep_count
    dep_count=$(echo "$active_dep" | jq 'length')
    echo "   Function $fn_id : $dep_count déploiement(s) sauvegardé(s)"
  done < <(echo "$functions_raw" | jq -r '.functions[]."$id"')

  local fn_count
  fn_count=$(echo "$functions_raw" | jq '.total // 0')
  echo "$functions_json" > "$BACKUP_DIR/appwrite-functions.json"
  echo "   ✅ appwrite-functions.json ($fn_count function(s))"
}

echo ""
echo "🔌 Export API Appwrite..."
( backup_appwrite_api ) \
  && echo "   ✅ Export API terminé" \
  || echo "   ⚠️  Export API partiel ou échoué (le backup MariaDB reste valide)"

# =============================================================================
# 5. Manifeste
# =============================================================================
cat > "$BACKUP_DIR/MANIFEST.txt" <<EOF
Backup Konfitur Game
Date     : $BACKUP_DATE
Hostname : $(hostname)
Docker   : $(docker --version)

Fichiers :
$(ls -lh "$BACKUP_DIR")
EOF

echo ""
echo "────────────────────────────────────────"
echo "✅ Backup terminé : $BACKUP_DIR"
echo ""
echo "Pour transférer sur un autre PC :"
echo "  tar -czf konfitur-backup-${BACKUP_DATE}.tar.gz -C \"$(dirname "$BACKUP_DIR")\" \"$BACKUP_DATE\""
echo "  # puis copier l'archive via USB, rsync, scp, etc."
