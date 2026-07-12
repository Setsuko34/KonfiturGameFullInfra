#!/usr/bin/env bash
# =============================================================================
# seed-data.sh — Initialisation des collections Appwrite pour KonfiturGame
#                + données de démonstration (jams, équipes, projets, chat…)
# Usage : ./scripts/seed-data.sh
# Prérequis : curl, jq, variables dans .env
# Idempotent : documentIds fixes, 409 = déjà existant.
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
astr  projects build_file_id    36  false
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

# ═══════════════════════════════════════════════════════════════════════════════
# Données de démonstration
# ═══════════════════════════════════════════════════════════════════════════════

# doc COL ID JSON_DATA — document en lecture publique
doc() {
  create "$1/$2" "databases/$DB/collections/$1/documents" \
    "$(jq -nc --arg id "$2" --argjson d "$3" '{documentId:$id, data:$d, permissions:["read(\"any\")"]}')"
}

d() { date -u -d "$1" "+%Y-%m-%dT%H:%M:%S.000+00:00"; }

# IDs réels de l'environnement de dev (compte Setsuko_Aka + team LE FRVCREW).
# Sur une base vierge sans ces documents, les seeds correspondants créent
# simplement des références inertes — aucune erreur.
USER_ID="69b87cdfa32a4ce69263"   # Setsuko_Aka
USER_TEAM="69e0d7fb081bf8172f68" # LE FRVCREW
KOKORI_JAM="69dfc0ca003bd63933f9"

# ── Jams ─────────────────────────────────────────────────────────────────────
echo; echo '── Seed : game_jams ─────────────────'
doc game_jams jam-001 "$(jq -nc --arg sd "$(d '1 day ago')" --arg ed "$(d '2 days')" '{
  title:"Spring Jam 2025", slug:"spring-jam-2025", theme:"La renaissance",
  description:"Créez un jeu autour du thème de la renaissance — nouvelle vie, nouveau départ, transformation.",
  status:"ongoing", type:"both", start_date:$sd, end_date:$ed, duration:"72h",
  rules:["Le jeu doit être créé pendant la durée de la jam","Toute technologie est acceptée","Les assets pré-créés sont autorisés si déclarés"],
  prizes:["500€","250€","100€"], tags:["2D","Toutes technologies","Débutants bienvenus"],
  organizer_id:"organizer-001"}')"

doc game_jams jam-101 "$(jq -nc --arg sd "$(d '6 months ago')" --arg ed "$(d '6 months ago + 3 days')" '{
  title:"Winter Jam 2026", slug:"winter-jam-2026", theme:"Le silence",
  description:"48h pour créer un jeu où le silence est une mécanique centrale. Ambiance feutrée, tension et minimalisme sonore.",
  status:"ended", type:"team", start_date:$sd, end_date:$ed, duration:"48h",
  rules:["Jeu créé pendant la jam","Équipes de 2 à 5","Assets déclarés obligatoires"],
  prizes:["300€","150€","75€"], tags:["2D","Ambiance","Audio"],
  organizer_id:"organizer-001", organizer:"KonfiturGame", participants:42, featured:false}')"

doc game_jams jam-102 "$(jq -nc --arg sd "$(d '2 months ago')" --arg ed "$(d '2 months ago + 7 days')" '{
  title:"Retro Jam #3", slug:"retro-jam-3", theme:"8 bits, 8 couleurs",
  description:"Une semaine pour créer un jeu rétro limité à une palette de 8 couleurs. Chiptune et pixel art à l'\''honneur.",
  status:"ended", type:"both", start_date:$sd, end_date:$ed, duration:"7 jours",
  rules:["Palette de 8 couleurs max","Résolution 320x180 max","Toute techno acceptée"],
  prizes:["Manette rétro","Jeu au choix","Sticker pack"], tags:["Pixel art","Rétro","Chiptune"],
  organizer_id:"organizer-001", organizer:"KonfiturGame", participants:67, featured:false}')"

doc game_jams jam-103 "$(jq -nc --arg sd "$(d '2 days ago')" --arg ed "$(d '5 days')" '{
  title:"Summer Jam 2026", slug:"summer-jam-2026", theme:"Chaleur écrasante",
  description:"La grande jam de l'\''été ! Une semaine pour créer un jeu autour de la canicule, du désert ou du soleil de plomb.",
  status:"ongoing", type:"team", start_date:$sd, end_date:$ed, duration:"7 jours",
  rules:["Jeu créé pendant la jam","Équipes uniquement","Build jouable obligatoire"],
  prizes:["500€","250€","100€"], tags:["Été","Toutes technologies","Multijoueur bienvenu"],
  organizer_id:"organizer-001", organizer:"KonfiturGame", participants:38, featured:true, featured_order:1}')"

doc game_jams jam-104 "$(jq -nc --arg sd "$(d '3 months + 12 days')" --arg ed "$(d '3 months + 14 days')" '{
  title:"Halloween Jam 2026", slug:"halloween-jam-2026", theme:"(révélé au lancement)",
  description:"48h d'\''horreur et de frissons pour la nuit d'\''Halloween. Le thème exact sera révélé au coup d'\''envoi.",
  status:"upcoming", type:"both", start_date:$sd, end_date:$ed, duration:"48h",
  rules:["Jeu créé pendant la jam","Solo ou équipe","Contenu -16 accepté avec avertissement"],
  prizes:["250€","125€","50€"], tags:["Horreur","Halloween","Ambiance"],
  organizer_id:"'"$USER_ID"'", organizer:"Setsuko_Aka", participants:0, featured:true, featured_order:2}')"

doc game_jams jam-105 "$(jq -nc --arg sd "$(d '5 months + 8 days')" --arg ed "$(d '5 months + 18 days')" '{
  title:"Konfitur Noël 2026", slug:"konfitur-noel-2026", theme:"Cadeau empoisonné",
  description:"10 jours pour créer un jeu cosy (ou pas) sur le thème du cadeau empoisonné. Vin chaud non fourni.",
  status:"upcoming", type:"both", start_date:$sd, end_date:$ed, duration:"10 jours",
  rules:["Jeu créé pendant la jam","Solo ou équipe"],
  prizes:["400€","200€","100€"], tags:["Noël","Cosy","Débutants bienvenus"],
  organizer_id:"organizer-001", organizer:"KonfiturGame", participants:0, featured:false}')"

# ── Équipes ──────────────────────────────────────────────────────────────────
echo; echo '── Seed : teams ─────────────────────'
doc teams team-101 '{"name":"Les Croissants Furieux","invite_code":"KG-CR01SSAN","leader_id":"user-alice","jam_ids":["jam-103","jam-101"]}'
doc teams team-102 '{"name":"Pixel Baguette","invite_code":"KG-P1XBAGET","leader_id":"user-david","jam_ids":["jam-103"]}'
doc teams team-103 '{"name":"Studio Chartreuse","invite_code":"KG-CHARTREU","leader_id":"user-felix","jam_ids":["jam-101","jam-102"]}'
doc teams team-104 '{"name":"GigaOctet","invite_code":"KG-G1GAOCTE","leader_id":"user-hugo","jam_ids":["jam-102"]}'
doc teams team-105 '{"name":"La Confiture Sauvage","invite_code":"KG-C0NF1TUR","leader_id":"user-jules","jam_ids":[]}'

# ── Membres ──────────────────────────────────────────────────────────────────
echo; echo '── Seed : team_members ──────────────'
doc team_members tm-101 '{"team_id":"team-101","user_id":"user-alice","name":"Alice Verne","role":"dev","is_leader":true}'
doc team_members tm-102 '{"team_id":"team-101","user_id":"user-bob","name":"Bob Marchand","role":"artist","is_leader":false}'
doc team_members tm-103 '{"team_id":"team-101","user_id":"user-chloe","name":"Chloé Danton","role":"sound","is_leader":false}'
doc team_members tm-104 '{"team_id":"team-102","user_id":"user-david","name":"David Okonkwo","role":"dev","is_leader":true}'
doc team_members tm-105 '{"team_id":"team-102","user_id":"user-emma","name":"Emma Rousseau","role":"artist","is_leader":false}'
doc team_members tm-106 '{"team_id":"team-103","user_id":"user-felix","name":"Félix Bardin","role":"dev","is_leader":true}'
doc team_members tm-107 '{"team_id":"team-103","user_id":"user-gabrielle","name":"Gabrielle Sy","role":"designer","is_leader":false}'
doc team_members tm-108 '{"team_id":"team-104","user_id":"user-hugo","name":"Hugo Lemoine","role":"dev","is_leader":true}'
doc team_members tm-109 '{"team_id":"team-104","user_id":"user-ines","name":"Inès Belkacem","role":"writer","is_leader":false}'
doc team_members tm-110 '{"team_id":"team-105","user_id":"user-jules","name":"Jules Ferry","role":"dev","is_leader":true}'
doc team_members tm-111 '{"team_id":"team-105","user_id":"user-karim","name":"Karim Nasser","role":"sound","is_leader":false}'
doc team_members tm-112 '{"team_id":"team-105","user_id":"user-lea","name":"Léa Fontaine","role":"artist","is_leader":false}'

# ── Projets ──────────────────────────────────────────────────────────────────
echo; echo '── Seed : projects ──────────────────'
# Winter Jam 2026 (terminée) — podium
doc projects proj-101 "$(jq -nc --arg sub "$(d '6 months ago + 3 days')" '{
  jam_id:"jam-101", team_id:"team-101", title:"Murmure",
  description:"Un jeu d'\''infiltration où le moindre bruit alerte les gardiens. Le micro du joueur est la manette : chuchotez pour avancer.",
  technologies:["Godot 4","GDScript","Audacity"], repo_url:"https://github.com/demo/murmure",
  submitted:true, submission_date:$sub, likes_count:5, placement:1}')"
doc projects proj-102 "$(jq -nc --arg sub "$(d '6 months ago + 3 days')" '{
  jam_id:"jam-101", team_id:"team-103", title:"Silencio",
  description:"Puzzle contemplatif dans une bibliothèque abandonnée. Chaque page tournée raconte un souvenir.",
  technologies:["Unity","C#","Blender"], repo_url:"https://github.com/demo/silencio",
  download_url:"https://demo.itch.io/silencio",
  submitted:true, submission_date:$sub, likes_count:3, placement:2}')"
# Retro Jam #3 (terminée)
doc projects proj-103 "$(jq -nc --arg sub "$(d '2 months ago + 7 days')" '{
  jam_id:"jam-102", team_id:"team-103", title:"OCTOPALETTE",
  description:"Shoot'\''em up en 8 couleurs où chaque couleur ramassée change vos tirs. Chiptune composée pendant la jam.",
  technologies:["PICO-8","Lua"], download_url:"https://demo.itch.io/octopalette",
  submitted:true, submission_date:$sub, likes_count:6, placement:1}')"
doc projects proj-104 "$(jq -nc --arg sub "$(d '2 months ago + 6 days')" '{
  jam_id:"jam-102", team_id:"team-104", title:"Baguette Quest",
  description:"RPG parodique où un boulanger affronte des viennoiseries mutantes. 100% pixel art 8 couleurs.",
  technologies:["Löve2D","Lua","Aseprite"], repo_url:"https://github.com/demo/baguette-quest",
  submitted:true, submission_date:$sub, likes_count:2, placement:2}')"
# Summer Jam 2026 (en cours)
doc projects proj-105 "$(jq -nc --arg sub "$(d '1 day ago')" '{
  jam_id:"jam-103", team_id:"team-101", title:"Canicule",
  description:"Survival dans un Paris à 50°C : trouvez de l'\''ombre, de l'\''eau, et un ventilateur avant midi.",
  technologies:["Godot 4","GDScript"], repo_url:"https://github.com/demo/canicule",
  submitted:true, submission_date:$sub, likes_count:2, placement:0}')"
doc projects proj-106 "$(jq -nc --arg sub "$(d '6 hours ago')" '{
  jam_id:"jam-103", team_id:"team-102", title:"Mirage",
  description:"Course dans le désert où les checkpoints sont peut-être des mirages. Ne faites confiance à rien.",
  technologies:["Unity","C#"],
  submitted:true, submission_date:$sub, likes_count:1, placement:0}')"
# KOKORI JAM (en cours) — projet de l'équipe réelle LE FRVCREW, modifiable pour tester
doc projects proj-200 "$(jq -nc --arg jam "$KOKORI_JAM" --arg team "$USER_TEAM" --arg sub "$(d '3 days ago')" '{
  jam_id:$jam, team_id:$team, title:"Konfitur Quest",
  description:"Le projet de LE FRVCREW pour la KOKORI JAM — encore modifiable tant que la jam est en cours.",
  technologies:["Godot 4","GDScript","Aseprite"],
  submitted:true, submission_date:$sub, likes_count:3, placement:0}')"

# ── Likes (cohérents avec likes_count) ───────────────────────────────────────
echo; echo '── Seed : likes ─────────────────────'
i=0
seed_likes() { # PROJECT N
  local p="$1" n="$2" u
  for u in $(seq 1 "$n"); do
    i=$((i+1))
    doc likes "like-$(printf '%03d' $i)" "{\"project_id\":\"$p\",\"user_id\":\"user-liker-$u\"}"
  done
}
seed_likes proj-101 5
seed_likes proj-102 3
seed_likes proj-103 6
seed_likes proj-104 2
seed_likes proj-105 2
seed_likes proj-106 1
seed_likes proj-200 3

# ── Messages de chat (jams en cours) ─────────────────────────────────────────
echo; echo '── Seed : chat_messages ─────────────'
doc chat_messages msg-001 '{"jam_id":"jam-001","channel":"general","author_id":"organizer-001","author_name":"KonfiturGame","content":"Bienvenue dans Spring Jam 2025 ! Le thème est \"La renaissance\". Bonne chance à tous !","role":"organizer","pinned":true}'
doc chat_messages msg-101 '{"jam_id":"jam-103","channel":"general","author_id":"organizer-001","author_name":"KonfiturGame","content":"Bienvenue dans la Summer Jam 2026 ! Thème : Chaleur écrasante. Hydratez-vous et bon courage ! ☀️","role":"organizer","pinned":true}'
doc chat_messages msg-102 '{"jam_id":"jam-103","channel":"general","author_id":"user-alice","author_name":"Alice Verne","content":"Le thème est génial, on part sur un survival urbain !","role":"user","pinned":false}'
doc chat_messages msg-103 '{"jam_id":"jam-103","channel":"general","author_id":"user-david","author_name":"David Okonkwo","content":"Quelqu'\''un sait si les assets audio CC0 sont autorisés ?","role":"user","pinned":false}'
doc chat_messages msg-104 '{"jam_id":"jam-103","channel":"general","author_id":"organizer-001","author_name":"KonfiturGame","content":"@David oui, tant que c'\''est déclaré dans la description du projet.","role":"organizer","pinned":false}'
doc chat_messages msg-105 '{"jam_id":"jam-103","channel":"team-search","author_id":"user-karim","author_name":"Karim Nasser","content":"Sound designer dispo ! J'\''ai un home studio et 3 jams au compteur.","role":"user","pinned":false}'
doc chat_messages msg-106 '{"jam_id":"jam-103","channel":"team-search","author_id":"user-lea","author_name":"Léa Fontaine","content":"Cherche équipe — pixel artist, portfolio sur demande 🎨","role":"user","pinned":false}'
doc chat_messages msg-107 '{"jam_id":"jam-103","channel":"help","author_id":"user-emma","author_name":"Emma Rousseau","content":"L'\''upload du build .zip plafonne à combien ?","role":"user","pinned":false}'
doc chat_messages msg-108 '{"jam_id":"jam-103","channel":"help","author_id":"organizer-001","author_name":"KonfiturGame","content":"150 Mo max pour le build. Pensez à compresser vos assets !","role":"organizer","pinned":false}'
doc chat_messages msg-201 "$(jq -nc --arg jam "$KOKORI_JAM" '{jam_id:$jam, channel:"general", author_id:"organizer-001", author_name:"KonfiturGame", content:"La KOKORI JAM bat son plein — plus que quelques semaines pour soumettre vos projets !", role:"organizer", pinned:true}')"
doc chat_messages msg-202 "$(jq -nc --arg jam "$KOKORI_JAM" '{jam_id:$jam, channel:"general", author_id:"user-jules", author_name:"Jules Ferry", content:"On vise une démo jouable pour la fin du mois, qui teste ?", role:"user", pinned:false}')"

# ── Annonces ─────────────────────────────────────────────────────────────────
echo; echo '── Seed : announcements ─────────────'
doc announcements ann-001 '{"jam_id":"jam-001","title":"Le thème est révélé !","content":"Le thème de Spring Jam 2025 est \"La renaissance\". Toutes les interprétations sont valides.","important":true,"author_id":"organizer-001"}'
doc announcements ann-101 '{"jam_id":"jam-103","title":"C'\''est parti !","content":"La Summer Jam 2026 est lancée. Thème : Chaleur écrasante. Vous avez 7 jours — soumettez avant la deadline !","important":true,"author_id":"organizer-001"}'
doc announcements ann-102 '{"jam_id":"jam-103","title":"Rappel : build jouable obligatoire","content":"Un projet sans build .zip ou lien de téléchargement ne sera pas noté. Vérifiez vos uploads avant la fin.","important":false,"author_id":"organizer-001"}'
doc announcements ann-103 '{"jam_id":"jam-101","title":"Résultats de la Winter Jam 2026","content":"Félicitations à Murmure (1er) et Silencio (2e) ! Merci aux 42 participants — rendez-vous à la prochaine édition.","important":true,"author_id":"organizer-001"}'
doc announcements ann-104 '{"jam_id":"jam-102","title":"Podium de la Retro Jam #3","content":"OCTOPALETTE remporte la Retro Jam #3 devant Baguette Quest. Les jeux sont jouables sur les pages projets.","important":true,"author_id":"organizer-001"}'
doc announcements ann-105 '{"jam_id":"jam-104","title":"Inscriptions ouvertes","content":"La Halloween Jam 2026 ouvre ses inscriptions. Le thème sera révélé au coup d'\''envoi — préparez vos équipes. 🎃","important":false,"author_id":"'"$USER_ID"'"}'

# ── Commentaires ─────────────────────────────────────────────────────────────
echo; echo '── Seed : comments ──────────────────'
doc comments com-101 '{"project_id":"proj-101","author_id":"user-david","author_name":"David Okonkwo","content":"L'\''idée du micro comme manette est brillante, bravo !"}'
doc comments com-102 '{"project_id":"proj-101","author_id":"user-ines","author_name":"Inès Belkacem","content":"Mérité, la tension est incroyable dans le niveau 3."}'
doc comments com-103 '{"project_id":"proj-103","author_id":"user-alice","author_name":"Alice Verne","content":"La chiptune est restée dans ma tête toute la semaine 🎵"}'
doc comments com-104 '{"project_id":"proj-105","author_id":"user-felix","author_name":"Félix Bardin","content":"Le concept est top, hâte de voir la version finale !"}'
doc comments com-105 '{"project_id":"proj-200","author_id":"user-emma","author_name":"Emma Rousseau","content":"Curieuse de voir ce que LE FRVCREW prépare 👀"}'

echo
echo '✅ Seed terminé !'
