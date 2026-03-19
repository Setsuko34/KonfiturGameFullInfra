#!/bin/bash
set -a
. ./.env
set +a

# export APPWRITE_PROJECT_ID="${APPWRITE_PROJECT_ID:-$NEXT_PUBLIC_APPWRITE_PROJECT_ID}"
# The above line might fail if NEXT_PUBLIC_APPWRITE_PROJECT_ID is empty or undefined.
# Let's read both from .env directly if possible.
# Actually set -a .env should load them.

if [ -z "$APPWRITE_PROJECT_ID" ]; then
  export APPWRITE_PROJECT_ID="$NEXT_PUBLIC_APPWRITE_PROJECT_ID"
fi

if [ -z "$APPWRITE_PROJECT_ID" ]; then
  echo "Error: APPWRITE_PROJECT_ID not found in .env"
  exit 1
fi

if [ -z "$APPWRITE_API_KEY" ]; then
  echo "Error: APPWRITE_API_KEY not found in .env"
  exit 1
fi

echo "Project ID: $APPWRITE_PROJECT_ID"

# NEXT_PUBLIC_APPWRITE_ENDPOINT should be available too
if [ -z "$NEXT_PUBLIC_APPWRITE_ENDPOINT" ]; then
    export NEXT_PUBLIC_APPWRITE_ENDPOINT="http://localhost:8080/v1"
fi
echo "Endpoint: $NEXT_PUBLIC_APPWRITE_ENDPOINT"


# Add featured (boolean) on game_jams
echo "Adding featured to game_jams..."
curl -s -X POST "$NEXT_PUBLIC_APPWRITE_ENDPOINT/databases/konfitur-db/collections/game_jams/attributes/boolean" \
  -H "Content-Type: application/json" \
  -H "X-Appwrite-Project: $APPWRITE_PROJECT_ID" \
  -H "X-Appwrite-Key: $APPWRITE_API_KEY" \
  -d '{"key":"featured","required":false,"default":false}' | jq .

# Add featured_order (integer) on game_jams
echo "Adding featured_order to game_jams..."
curl -s -X POST "$NEXT_PUBLIC_APPWRITE_ENDPOINT/databases/konfitur-db/collections/game_jams/attributes/integer" \
  -H "Content-Type: application/json" \
  -H "X-Appwrite-Project: $APPWRITE_PROJECT_ID" \
  -H "X-Appwrite-Key: $APPWRITE_API_KEY" \
  -d '{"key":"featured_order","required":false}' | jq .

# Add reported (boolean) on chat_messages
echo "Adding reported to chat_messages..."
curl -s -X POST "$NEXT_PUBLIC_APPWRITE_ENDPOINT/databases/konfitur-db/collections/chat_messages/attributes/boolean" \
  -H "Content-Type: application/json" \
  -H "X-Appwrite-Project: $APPWRITE_PROJECT_ID" \
  -H "X-Appwrite-Key: $APPWRITE_API_KEY" \
  -d '{"key":"reported","required":false,"default":false}' | jq .

# Add submitted (boolean) on projects
echo "Adding submitted to projects..."
curl -s -X POST "$NEXT_PUBLIC_APPWRITE_ENDPOINT/databases/konfitur-db/collections/projects/attributes/boolean" \
  -H "Content-Type: application/json" \
  -H "X-Appwrite-Project: $APPWRITE_PROJECT_ID" \
  -H "X-Appwrite-Key: $APPWRITE_API_KEY" \
  -d '{"key":"submitted","required":false,"default":false}' | jq .

# Add reported (boolean) on projects
echo "Adding reported to projects..."
curl -s -X POST "$NEXT_PUBLIC_APPWRITE_ENDPOINT/databases/konfitur-db/collections/projects/attributes/boolean" \
  -H "Content-Type: application/json" \
  -H "X-Appwrite-Project: $APPWRITE_PROJECT_ID" \
  -H "X-Appwrite-Key: $APPWRITE_API_KEY" \
  -d '{"key":"reported","required":false,"default":false}' | jq .

# Add winner (boolean) on projects
echo "Adding winner to projects..."
curl -s -X POST "$NEXT_PUBLIC_APPWRITE_ENDPOINT/databases/konfitur-db/collections/projects/attributes/boolean" \
  -H "Content-Type: application/json" \
  -H "X-Appwrite-Project: $APPWRITE_PROJECT_ID" \
  -H "X-Appwrite-Key: $APPWRITE_API_KEY" \
  -d '{"key":"winner","required":false,"default":false}' | jq .

echo "Waiting for attributes to be available (30s)..."
# Just a placeholder message, script will exit.

