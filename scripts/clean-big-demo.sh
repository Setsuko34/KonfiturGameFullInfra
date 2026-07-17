#!/usr/bin/env bash
# clean-big-demo.sh — Supprime toutes les données créées par seed-big-demo.sh
# (tous les documents dont l'ID commence par "demo-").
# Usage : ./scripts/clean-big-demo.sh
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

load_env() {
  local file="$1"
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ "$line" =~ ^[[:space:]]*$ ]] && continue
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    local key value
    key="${line%%=*}"; value="${line#*=}"
    [[ "$value" =~ ^\"(.*)\"$ ]] && value="${BASH_REMATCH[1]}"
    [[ "$value" =~ ^\'(.*)\'$ ]] && value="${BASH_REMATCH[1]}"
    printf -v "$key" '%s' "$value"; export "$key"
  done < "$file"
}
load_env "$PROJECT_DIR/.env"

ENDPOINT="${NEXT_PUBLIC_APPWRITE_ENDPOINT:?}"
PROJECT_ID="${APPWRITE_PROJECT_ID:?}"
API_KEY="${APPWRITE_API_KEY:?}"
DB="konfitur-db"

deleted_total=0

clean_collection() { # COL
  local col="$1" count=0
  while :; do
    # Lot d'IDs demo- (pas de curseur : on supprime au fur et à mesure,
    # la "première page" suivante est toujours le lot d'après)
    local ids
    ids=$(curl -s -G \
      -H "X-Appwrite-Project: $PROJECT_ID" \
      -H "X-Appwrite-Key: $API_KEY" \
      --data-urlencode 'queries[]={"method":"startsWith","attribute":"$id","values":["demo-"]}' \
      --data-urlencode 'queries[]={"method":"limit","values":[100]}' \
      "$ENDPOINT/databases/$DB/collections/$col/documents" | jq -r '.documents[]."$id"' 2>/dev/null)
    if [ -z "$ids" ]; then break; fi
    local id
    for id in $ids; do
      local code
      code=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE \
        -H "X-Appwrite-Project: $PROJECT_ID" \
        -H "X-Appwrite-Key: $API_KEY" \
        "$ENDPOINT/databases/$DB/collections/$col/documents/$id")
      if [ "$code" = "204" ]; then
        count=$((count+1))
      else
        echo "  ❌ $col/$id (HTTP $code)"
      fi
    done
  done
  deleted_total=$((deleted_total+count))
  echo "  ✓ $col : $count supprimé(s)"
}

echo "═══ Nettoyage des données demo- ═══"
for col in projects team_members teams announcements chat_messages comments game_jams likes; do
  clean_collection "$col"
done
echo
echo "✅ Terminé : $deleted_total document(s) supprimé(s)"
