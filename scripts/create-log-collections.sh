#!/bin/bash
# ═══════════════════════════════════════════════════════════
# Crée les collections audit_logs et banned_ips dans Appwrite
# Usage : bash scripts/create-log-collections.sh
# Prérequis : Appwrite running, APPWRITE_API_KEY dans .env
# ═══════════════════════════════════════════════════════════

set -euo pipefail
if [ -f .env ]; then export $(grep -v '^#' .env | xargs); fi

ENDPOINT="${APPWRITE_INTERNAL_ENDPOINT:-http://localhost:8080/v1}"
PROJECT="${NEXT_PUBLIC_APPWRITE_PROJECT_ID}"
KEY="${APPWRITE_API_KEY}"
DB="konfitur-db"

call() {
  curl -sf -X "$1" "${ENDPOINT}$2" \
    -H "Content-Type: application/json" \
    -H "X-Appwrite-Project: ${PROJECT}" \
    -H "X-Appwrite-Key: ${KEY}" \
    -d "$3" | jq -r '.name // .message // .'
}

echo "→ Création collection audit_logs"
call POST "/databases/${DB}/collections" '{
  "collectionId": "audit_logs",
  "name": "Audit Logs",
  "documentSecurity": false,
  "permissions": ["read(\"team:'"${ADMIN_TEAM_ID:-admin}"'\")"]
}'

echo "→ Attributs audit_logs"
for attr in \
  '{"key":"type","type":"string","size":32,"required":true}' \
  '{"key":"ip","type":"string","size":45,"required":false}' \
  '{"key":"country_code","type":"string","size":2,"required":false}' \
  '{"key":"user_agent","type":"string","size":512,"required":false}' \
  '{"key":"path","type":"string","size":512,"required":false}' \
  '{"key":"user_id","type":"string","size":64,"required":false}' \
  '{"key":"message","type":"string","size":2048,"required":false}'
do
  call POST "/databases/${DB}/collections/audit_logs/attributes/string" "$attr" || true
  sleep 0.3
done

echo "→ Index audit_logs sur type"
call POST "/databases/${DB}/collections/audit_logs/indexes" '{
  "key": "type_created",
  "type": "key",
  "attributes": ["type"]
}' || true

echo "→ Création collection banned_ips"
call POST "/databases/${DB}/collections" '{
  "collectionId": "banned_ips",
  "name": "Banned IPs",
  "documentSecurity": false,
  "permissions": ["read(\"team:'"${ADMIN_TEAM_ID:-admin}"'\")"]
}'

echo "→ Attributs banned_ips (string)"
for attr in \
  '{"key":"ip","type":"string","size":45,"required":true}' \
  '{"key":"reason","type":"string","size":256,"required":false}'
do
  call POST "/databases/${DB}/collections/banned_ips/attributes/string" "$attr" || true
  sleep 0.3
done

echo "→ Attribut banned_ips (boolean)"
call POST "/databases/${DB}/collections/banned_ips/attributes/boolean" \
  '{"key":"auto","required":false,"default":false}' || true
sleep 0.3

echo "→ Index banned_ips sur ip (unique)"
call POST "/databases/${DB}/collections/banned_ips/indexes" '{
  "key": "ip_unique",
  "type": "unique",
  "attributes": ["ip"]
}' || true

echo "✅ Collections audit_logs et banned_ips créées."
