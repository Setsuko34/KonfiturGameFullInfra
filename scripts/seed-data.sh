#!/usr/bin/env bash
# =============================================================================
# seed-data.sh — Initialisation des collections Appwrite pour KonfiturGame
# Usage : ./scripts/seed-data.sh
# Prérequis : curl, jq, variables dans .env
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# ── Dépendances ───────────────────────────────────────────────────────────────
for cmd in curl jq; do
  command -v "$cmd" &>/dev/null || { echo "❌ '$cmd' requis (sudo apt install $cmd)"; exit 1; }
done

# ── Chargement .env (sans évaluation shell — gère les $ dans les mots de passe)
load_env() {
  local file="$1"
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"                          # strip \r Windows
    [[ "$line" =~ ^[[:space:]]*$ ]] && continue  # ligne vide
    [[ "$line" =~ ^[[:space:]]*# ]] && continue  # commentaire
    local key value
    key="${line%%=*}"
    value="${line#*=}"
    # strip guillemets éventuels
    [[ "$value" =~ ^\"(.*)\"$ ]] && value="${BASH_REMATCH[1]}"
    [[ "$value" =~ ^\'(.*)\'$ ]] && value="${BASH_REMATCH[1]}"
    printf -v "$key" '%s' "$value"
    export "$key"
  done < "$file"
}

[[ -f "$PROJECT_DIR/.env" ]] || { echo "❌ .env introuvable dans $PROJECT_DIR"; exit 1; }
load_env "$PROJECT_DIR/.env"

ENDPOINT="${NEXT_PUBLIC_APPWRITE_ENDPOINT:?Variable NEXT_PUBLIC_APPWRITE_ENDPOINT manquante}"
PROJECT_ID="${APPWRITE_PROJECT_ID:?Variable APPWRITE_PROJECT_ID manquante}"
API_KEY="${APPWRITE_API_KEY:?Variable APPWRITE_API_KEY manquante}"

DB="konfitur-db"
AW_TMP=$(mktemp)
trap 'rm -f "$AW_TMP"' EXIT

# ── API Helper ────────────────────────────────────────────────────────────────
# Retourne le code HTTP, la réponse est dans $AW_TMP
aw() {
  local method="$1" path="$2" data="${3:-}"
  local args=(
    -s -o "$AW_TMP" -w "%{http_code}"
    -X "$method"
    -H "Content-Type: application/json"
    -H "X-Appwrite-Project: $PROJECT_ID"
    -H "X-Appwrite-Key: $API_KEY"
  )
  [[ -n "$data" ]] && args+=(-d "$data")
  curl "${args[@]}" "$ENDPOINT/$path"
}

# Création idempotente : OK si 200/201, silencieux si 409 (déjà existant)
create() {
  local label="$1" path="$2" data="$3"
  local code
  code=$(aw POST "$path" "$data")
  case "$code" in
    200|201|202) echo "  ✓ $label" ;;
    409)     echo "  ℹ $label (déjà existant)" ;;
    *)       echo "  ❌ $label (HTTP $code)"; jq -r '.message // .' "$AW_TMP" 2>/dev/null; return 1 ;;
  esac
}

# Attend que tous les attributs d'une collection soient "available"
wait_attrs() {
  local col="$1" attempt=0
  echo -n "    ⏳ Attributs [$col]"
  while [[ $attempt -lt 60 ]]; do
    local code
    code=$(aw GET "databases/$DB/collections/$col/attributes?limit=50")
    if [[ "$code" == "200" ]]; then
      local pending
      pending=$(jq '[.attributes[] | select(.status != "available")] | length' "$AW_TMP" 2>/dev/null || echo "?")
      [[ "$pending" == "0" ]] && { echo " ✅"; return 0; }
      echo -n "($pending)"; sleep 3; attempt=$((attempt + 1))
    else
      echo -n "[HTTP $code]"; sleep 3; attempt=$((attempt + 1))
    fi
  done
  echo " ⚠️  timeout"
}

# ── Raccourcis attributs ──────────────────────────────────────────────────────
# Chaque fonction construit le JSON via jq pour éviter les problèmes d'échappement

# astr COL KEY SIZE REQUIRED [ARRAY=false]
astr() {
  create ".$2" "databases/$DB/collections/$1/attributes/string" \
    "$(jq -nc --arg k "$2" --argjson sz "$3" --argjson req "$4" --argjson arr "${5:-false}" \
      '{key:$k, size:$sz, required:$req, array:$arr}')"
}

# aint COL KEY REQUIRED [DEFAULT] [MIN] [MAX]
aint() {
  local data
  local jq_args=(--arg k "$2" --argjson req "$3")
  local filter='{key:$k, required:$req}'
  if [[ -n "${4:-}" ]]; then
    jq_args+=(--argjson def "$4")
    filter='{key:$k, required:$req, default:$def}'
  fi
  if [[ -n "${5:-}" ]]; then
    jq_args+=(--argjson min "$5")
    filter="${filter%\}} , min:\$min}"
  fi
  if [[ -n "${6:-}" ]]; then
    jq_args+=(--argjson max "$6")
    filter="${filter%\}} , max:\$max}"
  fi
  data=$(jq -nc "${jq_args[@]}" "$filter")
  create ".$2" "databases/$DB/collections/$1/attributes/integer" "$data"
}

# abool COL KEY REQUIRED DEFAULT
# Appwrite interdit default + required:true — on omet le default si required=true
abool() {
  local data
  if [[ "$3" == "true" ]]; then
    data=$(jq -nc --arg k "$2" --argjson req "$3" '{key:$k, required:$req}')
  else
    data=$(jq -nc --arg k "$2" --argjson req "$3" --argjson def "$4" '{key:$k, required:$req, default:$def}')
  fi
  create ".$2" "databases/$DB/collections/$1/attributes/boolean" "$data"
}

# adt COL KEY REQUIRED
adt() {
  create ".$2" "databases/$DB/collections/$1/attributes/datetime" \
    "$(jq -nc --arg k "$2" --argjson req "$3" '{key:$k, required:$req}')"
}

# aenum COL KEY '["a","b"]' REQUIRED DEFAULT
# Appwrite interdit default + required:true — on omet le default si required=true
aenum() {
  local data
  if [[ "$4" == "true" ]]; then
    data=$(jq -nc --arg k "$2" --argjson elems "$3" --argjson req "$4" '{key:$k, elements:$elems, required:$req}')
  else
    data=$(jq -nc --arg k "$2" --argjson elems "$3" --argjson req "$4" --arg def "$5" '{key:$k, elements:$elems, required:$req, default:$def}')
  fi
  create ".$2" "databases/$DB/collections/$1/attributes/enum" "$data"
}

# aidx COL KEY TYPE '["attr1","attr2"]'
aidx() {
  create "index .$2" "databases/$DB/collections/$1/indexes" \
    "$(jq -nc --arg k "$2" --arg t "$3" --argjson attrs "$4" '{key:$k, type:$t, attributes:$attrs}')"
}

# new_col ID NAME [EXTRA_PERMS_JSON_ARRAY]
new_col() {
  local extra="${3:-[]}"
  create "Collection $2" "databases/$DB/collections" \
    "$(jq -nc --arg i "$1" --arg n "$2" --argjson extra "$extra" \
      '{collectionId:$i, name:$n, permissions:(["read(\"any\")","create(\"users\")"] + $extra)}')"
}

# ── Base de données ───────────────────────────────────────────────────────────
echo '═══ KonfiturGame — Seed Appwrite ═══'
echo
echo '── Base de données ──────────────────'
create "Database KonfiturDB" "databases" \
  '{"databaseId":"konfitur-db","name":"KonfiturDB"}'

# ── Collections + attributs ───────────────────────────────────────────────────
echo
echo '── game_jams ────────────────────────'
new_col game_jams game_jams
astr  game_jams title              256  true
astr  game_jams slug               256  true
astr  game_jams theme              512  true
astr  game_jams description       4096  true
aenum game_jams status   '["upcoming","ongoing","ended"]'         true  upcoming
aenum game_jams type     '["solo","team","both"]'                 true  both
adt   game_jams start_date         true
adt   game_jams end_date           true
astr  game_jams duration            32  true
aint  game_jams max_participants  false
astr  game_jams rules             4096  false  true   # array
astr  game_jams prizes             512  false  true   # array
astr  game_jams tags                64  false  true   # array
astr  game_jams cover_image_id     256  false
astr  game_jams organizer_id        36  true
astr  game_jams organizer          256  false
aint  game_jams participants       false  0
abool game_jams featured           false  false
aint  game_jams featured_order     false
wait_attrs game_jams

echo
echo '── teams ────────────────────────────'
new_col teams teams
astr teams jam_ids      36  false  true  # array — [] = guilde sans jam
astr teams name        256  true
astr teams invite_code  16  true
astr teams leader_id    36  true
# project_id supprimé — projets normalisés dans la collection projects (team_id + jam_id)
wait_attrs teams

echo
echo '── team_members ─────────────────────'
new_col team_members team_members
astr  team_members team_id   36   true
astr  team_members user_id   36   true
astr  team_members name     128   true
aenum team_members role '["dev","artist","sound","designer","writer"]'  true  dev
abool team_members is_leader  true  false
astr  team_members avatar_url  512  false
wait_attrs team_members

echo
echo '── projects ─────────────────────────'
new_col projects projects
astr  projects jam_id           36  true
astr  projects team_id          36  true
astr  projects title           256  true
astr  projects description    4096  true
astr  projects technologies     64  false  true  # array
astr  projects download_url   2048  false
astr  projects repo_url       2048  false
abool projects submitted       true  false
adt   projects submission_date false
aint  projects likes_count    false  0
astr  projects cover_image_id  256  false
astr  projects screenshot_ids  256  false  true  # array
abool projects reported        false  false
aint  projects placement       false  0      0    3
wait_attrs projects

echo
echo '── chat_messages ────────────────────'
new_col chat_messages chat_messages
astr  chat_messages jam_id        36   true
aenum chat_messages channel '["general","team-search","help"]'  true  general
astr  chat_messages author_id     36   true
astr  chat_messages author_name  128   true
astr  chat_messages content     2048   true
aenum chat_messages role '["user","organizer","moderator"]'      true  user
abool chat_messages pinned       false  false
abool chat_messages reported     false  false
wait_attrs chat_messages

echo
echo '── announcements ────────────────────'
new_col announcements announcements
astr  announcements jam_id    36   true
astr  announcements title    256   true
astr  announcements content 4096   true
abool announcements important  true  false
astr  announcements author_id  36   true
wait_attrs announcements

echo
echo '── comments ─────────────────────────'
new_col comments comments
astr comments project_id   36   true
astr comments author_id    36   true
astr comments author_name 128   true
astr comments content    2048   true
wait_attrs comments

echo
echo '── likes ────────────────────────────'
new_col likes likes '["delete(\"users\")"]'
astr likes project_id  36  true
astr likes user_id     36  true
wait_attrs likes
aidx likes uniq_project_user unique '["project_id","user_id"]'

# ── Données de test ───────────────────────────────────────────────────────────
echo
echo '── Seed data ────────────────────────'

START_DATE=$(date -u -d "1 day ago" "+%Y-%m-%dT%H:%M:%S.000+00:00")
END_DATE=$(date -u   -d "2 days"    "+%Y-%m-%dT%H:%M:%S.000+00:00")

create "Jam Spring Jam 2025" "databases/$DB/collections/game_jams/documents" \
  "$(jq -nc --arg sd "$START_DATE" --arg ed "$END_DATE" '{
    documentId: "jam-001",
    data: {
      title:       "Spring Jam 2025",
      slug:        "spring-jam-2025",
      theme:       "La renaissance",
      description: "Créez un jeu autour du thème de la renaissance — nouvelle vie, nouveau départ, transformation.",
      status:      "ongoing",
      type:        "both",
      start_date:  $sd,
      end_date:    $ed,
      duration:    "72h",
      rules: [
        "Le jeu doit être créé pendant la durée de la jam",
        "Toute technologie est acceptée",
        "Les assets pré-créés sont autorisés si déclarés"
      ],
      prizes: ["500€","250€","100€"],
      tags:   ["2D","Toutes technologies","Débutants bienvenus"],
      organizer_id: "organizer-001"
    },
    permissions: ["read(\"any\")"]
  }')"

create "Message épinglé" "databases/$DB/collections/chat_messages/documents" \
  "$(jq -nc '{
    documentId: "msg-001",
    data: {
      jam_id:      "jam-001",
      channel:     "general",
      author_id:   "organizer-001",
      author_name: "KonfiturGame",
      content:     "Bienvenue dans Spring Jam 2025 ! Le thème est \"La renaissance\". Bonne chance à tous !",
      role:        "organizer",
      pinned:      true
    },
    permissions: ["read(\"any\")"]
  }')"

create "Annonce" "databases/$DB/collections/announcements/documents" \
  "$(jq -nc '{
    documentId: "ann-001",
    data: {
      jam_id:    "jam-001",
      title:     "Le thème est révélé !",
      content:   "Le thème de Spring Jam 2025 est \"La renaissance\". Toutes les interprétations sont valides.",
      important: true,
      author_id: "organizer-001"
    },
    permissions: ["read(\"any\")"]
  }')"

echo
echo '✅ Seed terminé !'
