#!/usr/bin/env bash
# =============================================================================
# restore.sh — Restauration complète Konfitur Game depuis un backup
# Usage : ./scripts/restore.sh <dossier-de-backup>
# Exemple : ./scripts/restore.sh ./backups/2025-06-01_14-30
#
# Modes de restauration :
#   Mode STANDARD  — MariaDB + volumes (rapide, même serveur)
#   Mode API       — Schéma + teams + données via API Appwrite (serveur vierge)
#
# Le mode standard restaure tout en ré-injectant le dump MariaDB.
# Le mode API recrée tout via l'API Appwrite — utile après une réinstallation
# complète où la base MariaDB est vide.
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

# Détecter le contenu du backup
HAS_MARIADB=false
HAS_SCHEMA=false
HAS_TEAMS=false
HAS_DATA=false
HAS_STORAGE=false
HAS_FUNCTIONS=false
[[ -f "$BACKUP_DIR/mariadb.sql" ]] && HAS_MARIADB=true
[[ -f "$BACKUP_DIR/appwrite-schema.json" ]] && HAS_SCHEMA=true
[[ -f "$BACKUP_DIR/appwrite-teams.json" ]] && HAS_TEAMS=true
[[ -f "$BACKUP_DIR/appwrite-data.json" ]] && HAS_DATA=true
[[ -f "$BACKUP_DIR/appwrite-storage.json" ]] && HAS_STORAGE=true
[[ -f "$BACKUP_DIR/appwrite-functions.json" ]] && HAS_FUNCTIONS=true

echo ""
echo "♻️  Restauration depuis : $BACKUP_DIR"
echo ""
echo "Contenu détecté :"
$HAS_MARIADB   && echo "   ✅ mariadb.sql" || echo "   ❌ mariadb.sql (absent)"
$HAS_SCHEMA    && echo "   ✅ appwrite-schema.json" || echo "   ❌ appwrite-schema.json (absent)"
$HAS_TEAMS     && echo "   ✅ appwrite-teams.json" || echo "   ❌ appwrite-teams.json (absent)"
$HAS_DATA      && echo "   ✅ appwrite-data.json" || echo "   ❌ appwrite-data.json (absent)"
$HAS_STORAGE   && echo "   ✅ appwrite-storage.json (buckets)" || echo "   ❌ appwrite-storage.json (absent)"
$HAS_FUNCTIONS && echo "   ✅ appwrite-functions.json (functions)" || echo "   ❌ appwrite-functions.json (absent)"
echo ""

# Choisir le mode
echo "Mode de restauration :"
echo "  1. Standard — MariaDB + volumes Docker (recommandé, même serveur)"
echo "  2. API       — Schéma + teams + documents via API (serveur Appwrite vierge)"
echo "  3. Teams uniquement — Restaurer seulement les teams/memberships via API"
echo ""
read -rp "Mode (1/2/3) : " RESTORE_MODE
case "$RESTORE_MODE" in
  1|2|3) ;;
  *) echo "Mode invalide. Annulé."; exit 1 ;;
esac

echo ""
echo "⚠️  ATTENTION : ceci va modifier les données actuelles d'Appwrite !"
read -rp "Confirmer ? (oui/non) : " CONFIRM
if [[ "$CONFIRM" != "oui" ]]; then
  echo "Annulé."
  exit 0
fi

echo "────────────────────────────────────────"

# =============================================================================
# Variables et helpers API Appwrite
# =============================================================================
AW_ENDPOINT="${NEXT_PUBLIC_APPWRITE_ENDPOINT:-http://localhost/v1}"
AW_PROJECT="${NEXT_PUBLIC_APPWRITE_PROJECT_ID:-}"
AW_KEY="${APPWRITE_API_KEY:-}"

aw_get() {
  curl -sf \
    -H "X-Appwrite-Project: $AW_PROJECT" \
    -H "X-Appwrite-Key: $AW_KEY" \
    "${AW_ENDPOINT}${1}" 2>/dev/null || echo "null"
}

aw_post() {
  local path="$1"
  local body="$2"
  curl -sf -X POST \
    -H "X-Appwrite-Project: $AW_PROJECT" \
    -H "X-Appwrite-Key: $AW_KEY" \
    -H "Content-Type: application/json" \
    -d "$body" \
    "${AW_ENDPOINT}${path}" 2>/dev/null || echo "null"
}

# Poll jusqu'à ce que tous les attributs d'une collection soient "available"
wait_for_attributes() {
  local db_id="$1"
  local col_id="$2"
  local max_wait=120
  local waited=0

  echo -n "      ⏳ Attributs en cours de traitement..."
  while [ "$waited" -lt "$max_wait" ]; do
    local processing
    processing=$(aw_get "/databases/${db_id}/collections/${col_id}/attributes?limit=200" | \
      jq '[.attributes[]? | select(.status == "processing")] | length' 2>/dev/null || echo "0")

    if [[ "${processing:-1}" == "0" ]]; then
      echo " prêt"
      return 0
    fi
    echo -n "."
    sleep 3
    waited=$((waited + 3))
  done
  echo ""
  echo "      ⚠️  Timeout — certains attributs sont peut-être encore en traitement"
}

# Crée un attribut dans une collection en détectant son type
create_attribute() {
  local db_id="$1"
  local col_id="$2"
  local attr="$3"

  local key type format
  key=$(echo "$attr" | jq -r '.key')
  type=$(echo "$attr" | jq -r '.type // "string"')
  format=$(echo "$attr" | jq -r '.format // ""')

  local endpoint body

  case "$type" in
    "string")
      case "$format" in
        "enum")
          endpoint="/databases/${db_id}/collections/${col_id}/attributes/enum"
          body=$(echo "$attr" | jq '{
            key: .key, required: .required, array: (.array // false),
            elements: .elements, default: .default
          }')
          ;;
        "email")
          endpoint="/databases/${db_id}/collections/${col_id}/attributes/email"
          body=$(echo "$attr" | jq '{key: .key, required: .required, array: (.array // false), default: .default}')
          ;;
        "url")
          endpoint="/databases/${db_id}/collections/${col_id}/attributes/url"
          body=$(echo "$attr" | jq '{key: .key, required: .required, array: (.array // false), default: .default}')
          ;;
        "ip")
          endpoint="/databases/${db_id}/collections/${col_id}/attributes/ip"
          body=$(echo "$attr" | jq '{key: .key, required: .required, array: (.array // false), default: .default}')
          ;;
        "datetime")
          endpoint="/databases/${db_id}/collections/${col_id}/attributes/datetime"
          body=$(echo "$attr" | jq '{key: .key, required: .required, array: (.array // false), default: .default}')
          ;;
        *)
          # Chaîne de caractères standard
          endpoint="/databases/${db_id}/collections/${col_id}/attributes/string"
          body=$(echo "$attr" | jq '{
            key: .key, required: .required, array: (.array // false),
            size: (.size // 255), default: .default
          }')
          ;;
      esac
      ;;
    "integer")
      endpoint="/databases/${db_id}/collections/${col_id}/attributes/integer"
      body=$(echo "$attr" | jq '{
        key: .key, required: .required, array: (.array // false),
        min: .min, max: .max, default: .default
      }')
      ;;
    "double")
      endpoint="/databases/${db_id}/collections/${col_id}/attributes/float"
      body=$(echo "$attr" | jq '{
        key: .key, required: .required, array: (.array // false),
        min: .min, max: .max, default: .default
      }')
      ;;
    "boolean")
      endpoint="/databases/${db_id}/collections/${col_id}/attributes/boolean"
      body=$(echo "$attr" | jq '{key: .key, required: .required, array: (.array // false), default: .default}')
      ;;
    "relationship")
      echo "      ⚠️  Relation '${key}' ignorée — à recréer manuellement dans la console Appwrite"
      return 0
      ;;
    *)
      echo "      ⚠️  Type inconnu '${type}' pour '${key}', ignoré"
      return 0
      ;;
  esac

  local result
  result=$(aw_post "$endpoint" "$body")
  if [[ "$result" == "null" ]]; then
    echo "      ⚠️  Échec création attribut '${key}' — peut-être déjà existant"
  else
    echo "      + $key ($type${format:+/$format})"
  fi
}

# =============================================================================
# MODE 1 : Restauration standard (MariaDB + volumes)
# =============================================================================
restore_standard() {
  # Démarrer uniquement les services dépendants
  echo "🚀 Démarrage MariaDB et Redis..."
  docker compose -f "$PROJECT_DIR/docker-compose.yml" up -d mariadb redis
  echo "   Attente que MariaDB soit prêt..."
  until docker exec konfitur-mariadb mysqladmin ping --silent --user=root --password="${MARIADB_ROOT_PASSWORD}" 2>/dev/null; do
    sleep 2
  done
  echo "   ✅ MariaDB prêt"

  # Restauration MariaDB
  if $HAS_MARIADB; then
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
  local PROJECT_NAME
  PROJECT_NAME=$(docker inspect konfitur-mariadb --format '{{ index .Config.Labels "com.docker.compose.project"}}' 2>/dev/null || echo "konfiturga mefullinfra")

  # Restauration volumes Appwrite
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
}

# =============================================================================
# MODE 2 : Restauration API — schéma + données (serveur Appwrite vierge)
# =============================================================================
restore_schema() {
  if ! $HAS_SCHEMA; then
    echo "   ⚠️  appwrite-schema.json absent, schéma non restauré"
    return
  fi

  echo "📐 Restauration schéma Appwrite..."
  local schema
  schema=$(cat "$BACKUP_DIR/appwrite-schema.json")

  while IFS= read -r db_json; do
    local db_id db_name
    db_id=$(echo "$db_json" | jq -r '."$id"')
    db_name=$(echo "$db_json" | jq -r '.name')

    # Créer la database (ignore si elle existe déjà)
    local db_body
    db_body=$(jq -n --arg id "$db_id" --arg name "$db_name" '{databaseId: $id, name: $name}')
    aw_post "/databases" "$db_body" > /dev/null 2>&1 || true
    echo "   DB : $db_id"

    while IFS= read -r col_json; do
      local col_id col_name permissions doc_security col_body
      col_id=$(echo "$col_json" | jq -r '."$id"')
      col_name=$(echo "$col_json" | jq -r '.name')
      permissions=$(echo "$col_json" | jq -c '."$permissions" // []')
      doc_security=$(echo "$col_json" | jq -r '.documentSecurity // false')

      col_body=$(jq -n \
        --arg id "$col_id" \
        --arg name "$col_name" \
        --argjson perms "$permissions" \
        --argjson ds "$doc_security" \
        '{collectionId: $id, name: $name, permissions: $perms, documentSecurity: $ds}')

      local col_result
      col_result=$(aw_post "/databases/${db_id}/collections" "$col_body")
      if [[ "$col_result" == "null" ]]; then
        echo "   Collection $col_id — déjà existante ou erreur, continue"
      else
        echo "   Collection : $col_id"
      fi

      # Créer les attributs
      while IFS= read -r attr_json; do
        create_attribute "$db_id" "$col_id" "$attr_json"
      done < <(echo "$col_json" | jq -c '.attributes[]? | select(.status == "available" or .status == null)')

      # Attendre que tous les attributs soient disponibles avant les indexes
      wait_for_attributes "$db_id" "$col_id"

      # Créer les indexes
      while IFS= read -r idx_json; do
        local idx_key idx_body idx_result
        idx_key=$(echo "$idx_json" | jq -r '.key')
        idx_body=$(echo "$idx_json" | jq '{key: .key, type: .type, attributes: .attributes, orders: (.orders // [])}')
        idx_result=$(aw_post "/databases/${db_id}/collections/${col_id}/indexes" "$idx_body")
        if [[ "$idx_result" != "null" ]]; then
          echo "      + index $idx_key"
        fi
      done < <(echo "$col_json" | jq -c '.indexes[]?')

    done < <(echo "$db_json" | jq -c '.collections[]?')

  done < <(echo "$schema" | jq -c '.databases[]?')

  echo "   ✅ Schéma restauré"
}

restore_documents() {
  if ! $HAS_DATA; then
    echo "   ⚠️  appwrite-data.json absent, documents non restaurés"
    return
  fi

  echo "📄 Restauration documents Appwrite..."
  local data total_restored=0
  data=$(cat "$BACKUP_DIR/appwrite-data.json")

  while IFS= read -r db_id; do
    while IFS= read -r col_id; do
      local count=0
      echo "   ${db_id}/${col_id}..."

      while IFS= read -r doc_json; do
        local doc_id permissions doc_data doc_body result
        doc_id=$(echo "$doc_json" | jq -r '."$id"')
        permissions=$(echo "$doc_json" | jq -c '."$permissions" // []')
        # Supprimer les champs système Appwrite — ne garder que les données utilisateur
        doc_data=$(echo "$doc_json" | jq 'with_entries(select(.key | startswith("$") | not))')

        doc_body=$(jq -n \
          --arg id "$doc_id" \
          --argjson perms "$permissions" \
          --argjson data "$doc_data" \
          '{documentId: $id, data: $data, permissions: $perms}')

        result=$(aw_post "/databases/${db_id}/collections/${col_id}/documents" "$doc_body")
        if [[ "$result" != "null" ]]; then
          count=$((count + 1))
        fi
      done < <(echo "$data" | jq -c --arg db "$db_id" --arg col "$col_id" '.databases[$db][$col].documents[]? // empty')

      total_restored=$((total_restored + count))
      echo "      ✅ $count document(s) restaurés"
    done < <(echo "$data" | jq -r --arg db "$db_id" '.databases[$db] | keys[]? // empty')
  done < <(echo "$data" | jq -r '.databases | keys[]? // empty')

  echo "   ✅ $total_restored document(s) restaurés au total"
}

# =============================================================================
# MODE 3 : Teams uniquement (rapide, post-réinstallation)
# =============================================================================
restore_teams() {
  if ! $HAS_TEAMS; then
    echo "   ⚠️  appwrite-teams.json absent, teams non restaurées"
    return
  fi

  if ! command -v jq &>/dev/null; then
    echo "   ⚠️  jq requis (sudo apt install jq)"
    return
  fi

  echo "👥 Restauration teams Appwrite..."
  local teams_data
  teams_data=$(cat "$BACKUP_DIR/appwrite-teams.json")
  local site_url="${NEXT_PUBLIC_SITE_URL:-http://localhost:3000}"

  while IFS= read -r team_json; do
    local team_id team_name
    team_id=$(echo "$team_json" | jq -r '."$id"')
    team_name=$(echo "$team_json" | jq -r '.name')

    # Créer la team (ignore si déjà existante)
    local team_body team_result
    team_body=$(jq -n --arg id "$team_id" --arg name "$team_name" '{teamId: $id, name: $name}')
    team_result=$(aw_post "/teams" "$team_body")
    if [[ "$team_result" == "null" ]]; then
      echo "   Team \"$team_name\" ($team_id) — déjà existante ou erreur"
    else
      echo "   Team : $team_name ($team_id)"
    fi

    # Ajouter les membres
    while IFS= read -r member_json; do
      local user_id user_email user_name roles member_body result
      user_id=$(echo "$member_json" | jq -r '.userId')
      user_email=$(echo "$member_json" | jq -r '.userEmail // ""')
      user_name=$(echo "$member_json" | jq -r '.userName // ""')
      roles=$(echo "$member_json" | jq -c '.roles // ["member"]')

      # userId suffit si l'utilisateur existe déjà (après restauration MariaDB)
      member_body=$(jq -n \
        --arg uid "$user_id" \
        --arg email "$user_email" \
        --arg name "$user_name" \
        --argjson roles "$roles" \
        --arg url "$site_url" \
        '{userId: $uid, email: $email, name: $name, roles: $roles, url: $url}')

      result=$(aw_post "/teams/${team_id}/memberships" "$member_body")
      if [[ "$result" != "null" ]]; then
        echo "      + $user_email (${roles})"
      else
        echo "      ⚠️  Membre $user_email non ajouté — peut-être déjà membre"
      fi
    done < <(echo "$team_json" | jq -c '.memberships[]? // empty')

  done < <(echo "$teams_data" | jq -c '.teams[]? // empty')

  echo "   ✅ Teams restaurées"
}

# =============================================================================
# MODE 2 — Buckets (recréation via API sur serveur vierge)
# =============================================================================
restore_buckets() {
  if ! $HAS_STORAGE; then
    echo "   ⚠️  appwrite-storage.json absent, buckets non restaurés"
    return
  fi

  echo "🪣  Restauration buckets Appwrite..."
  local storage_data
  storage_data=$(cat "$BACKUP_DIR/appwrite-storage.json")

  while IFS= read -r bucket_json; do
    local bucket_id bucket_name permissions file_security enabled max_size extensions compression encryption antivirus transformations
    bucket_id=$(echo "$bucket_json" | jq -r '."$id"')
    bucket_name=$(echo "$bucket_json" | jq -r '.name')
    permissions=$(echo "$bucket_json" | jq -c '."$permissions" // ["read(\"any\")"]')
    file_security=$(echo "$bucket_json" | jq -r '.fileSecurity // false')
    enabled=$(echo "$bucket_json" | jq -r '.enabled // true')
    max_size=$(echo "$bucket_json" | jq -r '.maximumFileSize // 10485760')
    extensions=$(echo "$bucket_json" | jq -c '.allowedFileExtensions // []')
    compression=$(echo "$bucket_json" | jq -r '.compression // "none"')
    encryption=$(echo "$bucket_json" | jq -r '.encryption // true')
    antivirus=$(echo "$bucket_json" | jq -r '.antivirus // false')
    transformations=$(echo "$bucket_json" | jq -r '.transformations // true')

    local body result
    body=$(jq -n \
      --arg id "$bucket_id" \
      --arg name "$bucket_name" \
      --argjson perms "$permissions" \
      --argjson fs "$file_security" \
      --argjson en "$enabled" \
      --argjson ms "$max_size" \
      --argjson ext "$extensions" \
      --arg comp "$compression" \
      --argjson enc "$encryption" \
      --argjson av "$antivirus" \
      --argjson tr "$transformations" \
      '{
        bucketId: $id, name: $name, permissions: $perms,
        fileSecurity: $fs, enabled: $en, maximumFileSize: $ms,
        allowedFileExtensions: $ext, compression: $comp,
        encryption: $enc, antivirus: $av, transformations: $tr
      }')

    result=$(aw_post "/storage/buckets" "$body")
    if [[ "$result" == "null" ]]; then
      echo "   ⚠️  Bucket \"$bucket_name\" ($bucket_id) — déjà existant ou erreur"
    else
      echo "   + Bucket : $bucket_name ($bucket_id)"
    fi
  done < <(echo "$storage_data" | jq -c '.buckets[]? // empty')

  echo "   ✅ Buckets restaurés"
  echo "   💡 Les fichiers uploadés sont dans le volume appwrite-uploads (restauré en Mode 1)"
}

# =============================================================================
# MODE 2 — Functions (recréation des métadonnées via API sur serveur vierge)
# Note : les déploiements ne sont pas re-uploadés automatiquement.
#        Après restauration, lancer : appwrite push functions
# =============================================================================
restore_functions() {
  if ! $HAS_FUNCTIONS; then
    echo "   ⚠️  appwrite-functions.json absent, functions non restaurées"
    return
  fi

  echo "⚡ Restauration functions Appwrite..."
  local fn_data
  fn_data=$(cat "$BACKUP_DIR/appwrite-functions.json")

  while IFS= read -r fn_json; do
    local fn_id fn_name runtime execute events schedule timeout enabled logging entrypoint commands vars
    fn_id=$(echo "$fn_json" | jq -r '."$id"')
    fn_name=$(echo "$fn_json" | jq -r '.name')
    runtime=$(echo "$fn_json" | jq -r '.runtime')
    execute=$(echo "$fn_json" | jq -c '.execute // []')
    events=$(echo "$fn_json" | jq -c '.events // []')
    schedule=$(echo "$fn_json" | jq -r '.schedule // ""')
    timeout=$(echo "$fn_json" | jq -r '.timeout // 15')
    enabled=$(echo "$fn_json" | jq -r '.enabled // true')
    logging=$(echo "$fn_json" | jq -r '.logging // true')
    entrypoint=$(echo "$fn_json" | jq -r '.entrypoint // "src/main.js"')
    commands=$(echo "$fn_json" | jq -r '.commands // ""')
    vars=$(echo "$fn_json" | jq -c '.vars // []')

    local body result
    body=$(jq -n \
      --arg id "$fn_id" \
      --arg name "$fn_name" \
      --arg runtime "$runtime" \
      --argjson execute "$execute" \
      --argjson events "$events" \
      --arg schedule "$schedule" \
      --argjson timeout "$timeout" \
      --argjson enabled "$enabled" \
      --argjson logging "$logging" \
      --arg entrypoint "$entrypoint" \
      --arg commands "$commands" \
      '{
        functionId: $id, name: $name, runtime: $runtime,
        execute: $execute, events: $events, schedule: $schedule,
        timeout: $timeout, enabled: $enabled, logging: $logging,
        entrypoint: $entrypoint, commands: $commands
      }')

    result=$(aw_post "/functions" "$body")
    if [[ "$result" == "null" ]]; then
      echo "   ⚠️  Function \"$fn_name\" ($fn_id) — déjà existante ou erreur"
    else
      echo "   + Function : $fn_name ($fn_id, $runtime)"
    fi

    # Restaurer les variables de la function
    local var_count=0
    while IFS= read -r var_json; do
      local var_key var_val var_secret var_body var_result
      var_key=$(echo "$var_json" | jq -r '.key')
      var_val=$(echo "$var_json" | jq -r '.value // ""')
      var_secret=$(echo "$var_json" | jq -r '.secret // false')
      var_body=$(jq -n --arg k "$var_key" --arg v "$var_val" '{key: $k, value: $v}')
      var_result=$(aw_post "/functions/${fn_id}/variables" "$var_body")
      [[ "$var_result" != "null" ]] && var_count=$((var_count + 1))
    done < <(echo "$vars" | jq -c '.[]? // empty')
    [[ "$var_count" -gt 0 ]] && echo "      + $var_count variable(s) restaurée(s)"

  done < <(echo "$fn_data" | jq -c '.functions[]? // empty')

  echo "   ✅ Functions restaurées (métadonnées)"
  echo "   💡 Pour redéployer le code : appwrite push functions"
}

# =============================================================================
# Exécution selon le mode choisi
# =============================================================================
case "$RESTORE_MODE" in
  1)
    restore_standard

    # Vérifier jq avant de tenter les teams
    if command -v jq &>/dev/null && [[ -n "$AW_PROJECT" && -n "$AW_KEY" ]]; then
      echo ""
      echo "🚀 Démarrage du stack complet pour restaurer les teams..."
      # Utiliser l'override dev s'il est présent (hot-reload, ports dev)
      if [[ -f "$PROJECT_DIR/docker-compose.override.yml" ]]; then
        docker compose -f "$PROJECT_DIR/docker-compose.yml" -f "$PROJECT_DIR/docker-compose.override.yml" up -d
      else
        docker compose -f "$PROJECT_DIR/docker-compose.yml" up -d
      fi
      # Appwrite 1.8 démarre plusieurs workers + migrations → poll /health plutôt que sleep fixe
      echo "   Attente qu'Appwrite soit prêt..."
      max_wait=120; waited=0
      until curl -sf -H "X-Appwrite-Project: $AW_PROJECT" -H "X-Appwrite-Key: $AW_KEY" \
        "${AW_ENDPOINT}/health" 2>/dev/null | jq -e '.status' &>/dev/null; do
        sleep 5; waited=$((waited + 5))
        echo -n "."
        if [[ "$waited" -ge "$max_wait" ]]; then
          echo ""
          echo "   ⚠️  Timeout — Appwrite peut-être pas prêt. Relance le script en mode 3 manuellement."
          break
        fi
      done
      echo ""
      ( restore_teams ) || echo "   ⚠️  Restauration des teams ignorée"
    else
      echo ""
      echo "💡 Lance 'docker compose up -d' puis relance :"
      echo "   $0 $BACKUP_DIR  (mode 3) pour restaurer les teams"
    fi
    ;;

  2)
    if ! command -v jq &>/dev/null; then
      echo "❌ jq est requis pour le mode API (sudo apt install jq)"
      exit 1
    fi
    restore_schema
    restore_buckets
    restore_functions
    restore_teams
    restore_documents
    ;;

  3)
    if ! command -v jq &>/dev/null; then
      echo "❌ jq est requis (sudo apt install jq)"
      exit 1
    fi
    restore_teams
    ;;
esac

echo ""
echo "────────────────────────────────────────"
echo "✅ Restauration terminée !"
echo ""
if [[ "$RESTORE_MODE" == "1" ]]; then
  echo "Le stack est déjà démarré. Si ce n'est pas le cas :"
  echo "  docker compose up -d"
else
  echo "Prochaine étape :"
  echo "  docker compose up -d"
fi
