#!/usr/bin/env bash
# =============================================================================
# backup.sh — Sauvegarde complète Konfitur Game
# Usage : ./scripts/backup.sh [dossier-de-sortie]
# Par défaut, produit ./backups/YYYY-MM-DD_HH-MM.tar.gz
#
# Le dossier de travail est archivé puis supprimé : seule l'archive subsiste.
# Rotation à 7 archives (le jour même + les 6 précédents), voir § 6.
# restore.sh accepte directement cette archive.
#
# Contenu de l'archive :
#   mariadb.sql                — dump SQL complet (schéma + données internes Appwrite)
#   appwrite-*.tar.gz          — volumes Docker (uploads, config, functions, builds, certificates)
#   project-config.tar.gz      — fichiers du projet hors secrets
#   appwrite-schema.json        — schéma Appwrite via API (databases, collections, attributs, indexes)
#   appwrite-teams.json         — teams et memberships via API
#   appwrite-data.json          — documents de toutes les collections via API
#   appwrite-storage.json       — configuration des buckets via API
#   appwrite-functions.json     — configuration des functions + déploiement actif via API
#   SHA256SUMS                 — empreintes de tous les fichiers
#   MANIFEST.txt               — inventaire du backup
#
# Exit code : 0 si backup complet, 1 si l'export API est partiel ou échoué
# (le dump MariaDB et les volumes restent valides dans ce cas).
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

# Fichiers de travail de l'export API (jamais de gros JSON dans des variables bash :
# un argument argv est plafonné à ~128 Ko → "Argument list too long")
API_TMP=$(mktemp -d)
trap 'rm -rf "$API_TMP"' EXIT

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

# Détecter le préfixe du projet Docker Compose — pas de fallback deviné :
# un nom faux produirait des archives de volumes vides en silence
PROJECT_NAME=$(docker inspect konfitur-mariadb --format '{{ index .Config.Labels "com.docker.compose.project"}}' 2>/dev/null || true)
if [[ -z "$PROJECT_NAME" ]]; then
  echo "❌ Impossible de détecter le projet Docker Compose (conteneur konfitur-mariadb absent ?)"
  echo "   Lance le stack avec 'docker compose up' avant le backup."
  exit 1
fi

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
  --warning=no-file-changed \
  --exclude='.env' \
  --exclude='node_modules' \
  --exclude='backups' \
  --exclude='.git' \
  --exclude='frontend/.next' \
  --exclude='frontend/playwright-report' \
  --exclude='frontend/e2e/.auth' \
  --exclude='frontend/e2e/.test-ids.json' \
  --exclude='frontend/e2e/.test-state.json' \
  --exclude='frontend/coverage' \
  . || true
echo "   ✅ project-config.tar.gz"

# =============================================================================
# 4. Appwrite API Export : schéma, teams, documents, buckets, functions
#    (non-bloquant : les erreurs sont collectées et rapportées à la fin)
# =============================================================================
# En dev, NEXT_PUBLIC_APPWRITE_ENDPOINT est dans docker-compose.override.yml (pas dans .env).
# Fallback : localhost/v1 via Traefik (port 80) ou localhost:8080/v1 (les deux fonctionnent).
AW_ENDPOINT="${NEXT_PUBLIC_APPWRITE_ENDPOINT:-http://localhost/v1}"
AW_PROJECT="${NEXT_PUBLIC_APPWRITE_PROJECT_ID:-}"
AW_KEY="${APPWRITE_API_KEY:-}"

EXPORT_ERRORS=()

aw_get_all() {
  # Liste paginée au curseur via queries[] — Appwrite 1.9 IGNORE les paramètres
  # nus limit/offset et rend 25 items en silence (voir "Plafonds Appwrite" dans
  # CLAUDE.md). Émet un item JSON par ligne (NDJSON) sur stdout.
  # Usage : aw_get_all <path> <clé du tableau dans la réponse>
  local path="$1" key="$2"
  local cursor="" page len
  while :; do
    local args=(-sf -G
      -H "X-Appwrite-Project: $AW_PROJECT"
      -H "X-Appwrite-Key: $AW_KEY"
      --data-urlencode 'queries[]={"method":"limit","values":[100]}')
    if [[ -n "$cursor" ]]; then
      args+=(--data-urlencode "queries[]={\"method\":\"cursorAfter\",\"values\":[\"$cursor\"]}")
    fi
    page=$(curl "${args[@]}" "${AW_ENDPOINT}${path}" 2>/dev/null) || return 1
    len=$(echo "$page" | jq --arg k "$key" '.[$k] | length') || return 1
    [[ "$len" -eq 0 ]] && break
    echo "$page" | jq -c --arg k "$key" '.[$k][]'
    [[ "$len" -lt 100 ]] && break
    cursor=$(echo "$page" | jq -r --arg k "$key" '.[$k][-1]."$id"')
  done
}

check_json() {
  # Valide un fichier JSON produit ; collecte l'erreur au lieu d'arrêter le backup
  local file="$1" label="$2"
  if jq empty "$file" 2>/dev/null; then
    return 0
  fi
  EXPORT_ERRORS+=("$label : JSON invalide ($file)")
  return 1
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

  local date_utc
  date_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  # ── 4a. Schéma (databases → collections → attributs + indexes) ──────────────
  echo "📐 Schéma Appwrite (collections, attributs, indexes)..."

  if ! aw_get_all "/databases" "databases" > "$API_TMP/databases.ndjson"; then
    EXPORT_ERRORS+=("schéma : échec listing databases")
  fi

  : > "$API_TMP/schema-dbs.ndjson"
  local db_json db_id
  while IFS= read -r db_json; do
    db_id=$(echo "$db_json" | jq -r '."$id"')
    # listCollections inclut déjà les attributs et indexes de chaque collection
    if ! aw_get_all "/databases/${db_id}/collections" "collections" > "$API_TMP/cols-${db_id}.ndjson"; then
      EXPORT_ERRORS+=("schéma : échec listing collections de $db_id")
    fi
    echo "$db_json" | jq -c --slurpfile cols "$API_TMP/cols-${db_id}.ndjson" \
      '{"$id": ."$id", name: .name, collections: $cols}' >> "$API_TMP/schema-dbs.ndjson"
    echo "   DB $db_id : $(wc -l < "$API_TMP/cols-${db_id}.ndjson") collection(s)"
  done < "$API_TMP/databases.ndjson"

  jq -n --arg date "$date_utc" --slurpfile dbs "$API_TMP/schema-dbs.ndjson" \
    '{version: "1.0", exportedAt: $date, databases: $dbs}' \
    > "$BACKUP_DIR/appwrite-schema.json"
  check_json "$BACKUP_DIR/appwrite-schema.json" "schéma" \
    && echo "   ✅ appwrite-schema.json"

  # ── 4b. Teams et memberships ─────────────────────────────────────────────────
  echo "👥 Teams Appwrite..."

  if ! aw_get_all "/teams" "teams" > "$API_TMP/teams.ndjson"; then
    EXPORT_ERRORS+=("teams : échec listing teams")
  fi

  : > "$API_TMP/teams-out.ndjson"
  local team_json team_id team_name
  while IFS= read -r team_json; do
    team_id=$(echo "$team_json" | jq -r '."$id"')
    team_name=$(echo "$team_json" | jq -r '.name')
    if ! aw_get_all "/teams/${team_id}/memberships" "memberships" > "$API_TMP/members-${team_id}.ndjson"; then
      EXPORT_ERRORS+=("teams : échec listing memberships de \"$team_name\"")
    fi
    echo "$team_json" | jq -c --slurpfile members "$API_TMP/members-${team_id}.ndjson" \
      '{"$id": ."$id", name: .name, total: .total,
        memberships: [$members[] | {
          userId: .userId,
          userName: .userName,
          userEmail: .userEmail,
          roles: .roles,
          confirm: .confirm
        }]}' >> "$API_TMP/teams-out.ndjson"
    echo "   Team \"$team_name\" : $(wc -l < "$API_TMP/members-${team_id}.ndjson") membre(s)"
  done < "$API_TMP/teams.ndjson"

  jq -n --arg date "$date_utc" --slurpfile teams "$API_TMP/teams-out.ndjson" \
    '{version: "1.0", exportedAt: $date, teams: $teams}' \
    > "$BACKUP_DIR/appwrite-teams.json"
  check_json "$BACKUP_DIR/appwrite-teams.json" "teams" \
    && echo "   ✅ appwrite-teams.json"

  # ── 4c. Documents (toutes les collections, paginé, streamé sur disque) ───────
  echo "📄 Documents Appwrite (toutes collections)..."

  jq -n --arg date "$date_utc" '{version: "1.0", exportedAt: $date, databases: {}}' \
    > "$API_TMP/data.json"

  local total_docs=0 col_id doc_count docs_file
  while IFS= read -r db_id; do
    while IFS= read -r col_id; do
      docs_file="$API_TMP/docs-${db_id}-${col_id}.ndjson"
      if ! aw_get_all "/databases/${db_id}/collections/${col_id}/documents" "documents" > "$docs_file"; then
        EXPORT_ERRORS+=("documents : échec export ${db_id}/${col_id}")
        echo "   ⚠️  ${db_id}/${col_id} : échec, collection ignorée"
        continue
      fi
      doc_count=$(wc -l < "$docs_file")
      total_docs=$((total_docs + doc_count))

      jq --arg db "$db_id" --arg col "$col_id" --slurpfile docs "$docs_file" \
        '.databases[$db][$col] = {total: ($docs | length), documents: $docs}' \
        "$API_TMP/data.json" > "$API_TMP/data.json.new" \
        && mv "$API_TMP/data.json.new" "$API_TMP/data.json"

      echo "   ${db_id}/${col_id} : $doc_count document(s)"
    done < <(jq -r --arg db "$db_id" 'select(."$id" == $db) | .collections[]."$id"' "$API_TMP/schema-dbs.ndjson")
  done < <(jq -r '."$id"' "$API_TMP/schema-dbs.ndjson")

  mv "$API_TMP/data.json" "$BACKUP_DIR/appwrite-data.json"
  check_json "$BACKUP_DIR/appwrite-data.json" "documents" \
    && echo "   ✅ appwrite-data.json ($total_docs document(s) au total)"

  # ── 4d. Storage buckets (configuration) ──────────────────────────────────────
  echo "🪣  Buckets Appwrite..."

  if ! aw_get_all "/storage/buckets" "buckets" > "$API_TMP/buckets.ndjson"; then
    EXPORT_ERRORS+=("buckets : échec listing")
  fi

  jq -n --arg date "$date_utc" --slurpfile buckets "$API_TMP/buckets.ndjson" \
    '{version: "1.0", exportedAt: $date, buckets: [$buckets[] | {
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
    }]}' > "$BACKUP_DIR/appwrite-storage.json"
  check_json "$BACKUP_DIR/appwrite-storage.json" "buckets" \
    && echo "   ✅ appwrite-storage.json ($(wc -l < "$API_TMP/buckets.ndjson") bucket(s))"

  # ── 4e. Functions + déploiements récents ─────────────────────────────────────
  echo "⚡ Functions Appwrite..."

  if ! aw_get_all "/functions" "functions" > "$API_TMP/functions.ndjson"; then
    EXPORT_ERRORS+=("functions : échec listing")
  fi

  : > "$API_TMP/functions-out.ndjson"
  local fn_json fn_id fn_out dep_count
  while IFS= read -r fn_json; do
    fn_id=$(echo "$fn_json" | jq -r '."$id"')
    if ! aw_get_all "/functions/${fn_id}/deployments" "deployments" > "$API_TMP/deps-${fn_id}.ndjson"; then
      EXPORT_ERRORS+=("functions : échec listing deployments de $fn_id")
    fi
    # Garder les 3 déploiements les plus récents
    fn_out=$(echo "$fn_json" | jq -c --slurpfile deps "$API_TMP/deps-${fn_id}.ndjson" \
      '{
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
        vars:           (.vars // []),
        deployments: ([$deps[] | {
          "$id":        ."$id",
          status:       .status,
          activate:     .activate,
          entrypoint:   .entrypoint,
          commands:     .commands,
          size:         .size,
          "$createdAt": ."$createdAt"
        }] | sort_by(."$createdAt") | reverse | .[0:3])
      }')
    echo "$fn_out" >> "$API_TMP/functions-out.ndjson"
    dep_count=$(echo "$fn_out" | jq '.deployments | length')
    echo "   Function $fn_id : $dep_count déploiement(s) sauvegardé(s)"
  done < "$API_TMP/functions.ndjson"

  jq -n --arg date "$date_utc" --slurpfile fns "$API_TMP/functions-out.ndjson" \
    '{version: "1.0", exportedAt: $date, functions: $fns}' \
    > "$BACKUP_DIR/appwrite-functions.json"
  check_json "$BACKUP_DIR/appwrite-functions.json" "functions" \
    && echo "   ✅ appwrite-functions.json ($(wc -l < "$API_TMP/functions.ndjson") function(s))"

  # ── Rapport d'erreurs ────────────────────────────────────────────────────────
  if [[ ${#EXPORT_ERRORS[@]} -gt 0 ]]; then
    echo ""
    echo "   ⚠️  ${#EXPORT_ERRORS[@]} erreur(s) pendant l'export API :"
    local err
    for err in "${EXPORT_ERRORS[@]}"; do
      echo "      - $err"
    done
    return 1
  fi
  return 0
}

echo ""
echo "🔌 Export API Appwrite..."
API_EXPORT_OK=true
if ( backup_appwrite_api ); then
  echo "   ✅ Export API terminé"
else
  echo "   ⚠️  Export API partiel ou échoué (le backup MariaDB reste valide)"
  API_EXPORT_OK=false
fi

# =============================================================================
# 5. Empreintes + manifeste
# =============================================================================
echo "🔏 Empreintes SHA256..."
(cd "$BACKUP_DIR" && sha256sum * > SHA256SUMS.tmp && mv SHA256SUMS.tmp SHA256SUMS)

cat > "$BACKUP_DIR/MANIFEST.txt" <<EOF
Backup Konfitur Game
Date     : $BACKUP_DATE
Hostname : $(hostname)
Docker   : $(docker --version)

Fichiers :
$(ls -lh "$BACKUP_DIR")
EOF

# =============================================================================
# 6. Archivage et rotation
# =============================================================================
# Le dossier de travail est remplacé par une archive unique : c'est elle que
# restore.sh consomme désormais.
#
# tar/gzip plutôt que zip : présents sur toute installation Debian minimale,
# là où `zip` est un paquet à installer — le cron de 2 h échouerait chaque
# nuit sur un serveur fraîchement provisionné. Le gain de place est le même,
# le contenu étant déjà majoritairement des .tar.gz.
BACKUPS_ROOT="$(dirname "$BACKUP_DIR")"
ARCHIVE="${BACKUP_DIR}.tar.gz"

echo ""
echo "🗜️  Archivage → $(basename "$ARCHIVE")"
tar -czf "$ARCHIVE" -C "$BACKUPS_ROOT" "$(basename "$BACKUP_DIR")"
rm -rf "$BACKUP_DIR"
echo "   ✅ $(du -sh "$ARCHIVE" | cut -f1)"

# Rotation à 7 archives : le jour même plus les 6 précédents (-mtime +6 =
# strictement plus de 6×24 h d'âge). Sans purge, backups/ finit par saturer le
# disque et déclencher EspaceDisqueCritique — la sauvegarde devenant la cause
# de la panne qu'elle est censée couvrir.
# La purge vit ici et non dans le cron : deux endroits qui décident de la
# rétention finissent toujours par diverger.
PURGED=$(find "$BACKUPS_ROOT" -maxdepth 1 -name '*.tar.gz' -mtime +6 -print -delete 2>/dev/null | wc -l)
if [[ "$PURGED" -gt 0 ]]; then
  echo "   🧹 $PURGED archive(s) de plus de 7 jours supprimée(s)"
fi

# =============================================================================
# 7. Publication des métriques pour la supervision
# =============================================================================
# node-exporter relit ce répertoire en continu et expose ces valeurs à
# Prometheus : c'est ce qui alimente les alertes SauvegardeManquante et
# SauvegardePartielle. Sans cette écriture, une sauvegarde qui cesse
# silencieusement de tourner ne se découvre que le jour où on en a besoin.
# Écriture atomique — node-exporter interpréterait un fichier tronqué comme
# une erreur de collecte.
TEXTFILE_DIR="$PROJECT_DIR/monitoring/textfile"
if mkdir -p "$TEXTFILE_DIR" 2>/dev/null; then
  # Taille de l'archive, seul objet qui subsiste sur le disque.
  BACKUP_SIZE_BYTES=$(du -sb "$ARCHIVE" 2>/dev/null | cut -f1 || echo 0)
  if $API_EXPORT_OK; then EXIT_CODE=0; else EXIT_CODE=1; fi
  TMP_METRICS="$(mktemp "$TEXTFILE_DIR/.backup.XXXXXX")"
  {
    echo "# HELP konfitur_backup_last_success_timestamp_seconds Date de la dernière sauvegarde aboutie."
    echo "# TYPE konfitur_backup_last_success_timestamp_seconds gauge"
    echo "konfitur_backup_last_success_timestamp_seconds $(date +%s)"
    echo "# HELP konfitur_backup_last_exit_code Code de sortie (0 = complet, 1 = export API partiel)."
    echo "# TYPE konfitur_backup_last_exit_code gauge"
    echo "konfitur_backup_last_exit_code $EXIT_CODE"
    echo "# HELP konfitur_backup_size_bytes Taille de la dernière archive de sauvegarde."
    echo "# TYPE konfitur_backup_size_bytes gauge"
    echo "konfitur_backup_size_bytes ${BACKUP_SIZE_BYTES:-0}"
  } >"$TMP_METRICS"
  chmod 644 "$TMP_METRICS"
  mv "$TMP_METRICS" "$TEXTFILE_DIR/backup.prom"
fi

echo ""
echo "────────────────────────────────────────"
if $API_EXPORT_OK; then
  echo "✅ Backup terminé : $ARCHIVE"
else
  echo "⚠️  Backup terminé avec un export API INCOMPLET : $ARCHIVE"
fi
echo ""
echo "Restauration :"
echo "  bash ./scripts/restore.sh \"$ARCHIVE\""
echo ""
echo "Transfert vers un autre poste : copier l'archive telle quelle"
echo "(USB, rsync, scp…) — elle est autoportante."

$API_EXPORT_OK || exit 1
