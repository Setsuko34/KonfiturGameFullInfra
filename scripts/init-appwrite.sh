#!/bin/bash
# ═══════════════════════════════════════════════════════════
# Script d'initialisation Appwrite
# Usage : bash scripts/init-appwrite.sh
# Prérequis : Appwrite running, APPWRITE_API_KEY défini dans .env
# ═══════════════════════════════════════════════════════════

set -euo pipefail

# Charger les variables d'environnement
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

APPWRITE_ENDPOINT="https://api.${DOMAIN}/v1"
echo "Initialisation Appwrite sur ${APPWRITE_ENDPOINT}..."

# Créer la base de données
curl -X POST "${APPWRITE_ENDPOINT}/databases" \
  -H "Content-Type: application/json" \
  -H "X-Appwrite-Project: ${APPWRITE_PROJECT_ID}" \
  -H "X-Appwrite-Key: ${APPWRITE_API_KEY}" \
  -d '{"databaseId": "konfitur-db", "name": "KonfiturDB"}' \
  --silent | jq .

echo "Base de données créée. Exécutez ensuite : cd frontend && npx tsx ../scripts/seed-data.ts"
