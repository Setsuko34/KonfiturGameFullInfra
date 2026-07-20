#!/usr/bin/env bash
# seed-big-demo.sh — Volume de démo pour tester paginations et plafonds.
# Tous les IDs sont préfixés "demo-" → nettoyage possible via startsWith($id,"demo-").
# Idempotent : documentIds fixes, 409 = déjà existant.
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
USER_ID="69b87cdfa32a4ce69263"   # Setsuko_Aka (compte réel de dev)

AW_TMP=$(mktemp); trap 'rm -f "$AW_TMP"' EXIT
ok=0; exists=0; fail=0

doc() { # COL ID DATA_JSON
  local code
  code=$(curl -s -o "$AW_TMP" -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -H "X-Appwrite-Project: $PROJECT_ID" \
    -H "X-Appwrite-Key: $API_KEY" \
    -d "$(jq -nc --arg id "$2" --argjson d "$3" '{documentId:$id, data:$d, permissions:["read(\"any\")"]}')" \
    "$ENDPOINT/databases/$DB/collections/$1/documents")
  case "$code" in
    2*) ok=$((ok+1)) ;;
    409) exists=$((exists+1)) ;;
    *) fail=$((fail+1)); echo "  ❌ $1/$2 (HTTP $code) $(jq -r '.message // .' "$AW_TMP" 2>/dev/null | head -1)" ;;
  esac
  local total=$((ok+exists+fail))
  (( total % 50 == 0 )) && echo "  … $total docs (ok=$ok, déjà=$exists, fail=$fail)"
}

d() { date -u -d "$1" "+%Y-%m-%dT%H:%M:%S.000+00:00"; }

echo "═══ Seed volumétrique (préfixe demo-) ═══"

# ── 40 jams terminées (end_date étalées de 1 à 40 jours en arrière) ──────────
echo "── jams terminées (40) ──"
for i in $(seq 1 40); do
  n=$(printf '%03d' "$i")
  doc game_jams "demo-jam-$n" "$(jq -nc \
    --arg t "Jam Démo #$n" --arg s "jam-demo-$n" \
    --arg sd "$(d "$((i+3)) days ago")" --arg ed "$(d "$i days ago")" \
    --argjson p $((10 + (i*7) % 80)) '{
    title:$t, slug:$s, theme:"Thème démo", status:"ended", type:"both",
    description:"Jam de démonstration générée pour tester les listes longues et la pagination.",
    start_date:$sd, end_date:$ed, duration:"72h", tags:["Démo"],
    organizer_id:"organizer-001", organizer:"KonfiturGame", participants:$p, featured:false}')"
done

# ── 15 jams à venir ──────────────────────────────────────────────────────────
echo "── jams à venir (15) ──"
for i in $(seq 41 55); do
  n=$(printf '%03d' "$i")
  doc game_jams "demo-jam-$n" "$(jq -nc \
    --arg t "Jam Démo #$n" --arg s "jam-demo-$n" \
    --arg sd "$(d "$((i-38)) days")" --arg ed "$(d "$((i-35)) days")" '{
    title:$t, slug:$s, theme:"(révélé au lancement)", status:"upcoming", type:"both",
    description:"Jam de démonstration à venir, pour remplir les listes upcoming.",
    start_date:$sd, end_date:$ed, duration:"72h", tags:["Démo"],
    organizer_id:"organizer-001", organizer:"KonfiturGame", participants:0, featured:false}')"
done

# ── 5 jams en cours ──────────────────────────────────────────────────────────
echo "── jams en cours (5) ──"
for i in $(seq 56 60); do
  n=$(printf '%03d' "$i")
  doc game_jams "demo-jam-$n" "$(jq -nc \
    --arg t "Jam Démo #$n (en cours)" --arg s "jam-demo-$n" \
    --arg sd "$(d '1 day ago')" --arg ed "$(d "$((i-53)) days")" \
    --argjson p $((20 + i)) '{
    title:$t, slug:$s, theme:"Thème démo", status:"ongoing", type:"both",
    description:"Jam de démonstration en cours, pour remplir les listes ongoing.",
    start_date:$sd, end_date:$ed, duration:"96h", tags:["Démo"],
    organizer_id:"organizer-001", organizer:"KonfiturGame", participants:$p, featured:false}')"
done

# ── La grosse jam : 120 équipes, 40 projets soumis ──────────────────────────
echo "── demo-jam-big ──"
doc game_jams demo-jam-big "$(jq -nc \
  --arg sd "$(d '6 days ago')" --arg ed "$(d '3 days ago')" '{
  title:"Mega Jam Démo (120 équipes)", slug:"mega-jam-demo", theme:"La démesure",
  description:"Jam volumineuse : 120 équipes, 40 projets soumis, 60 annonces. Sert à vérifier les compteurs, le podium et les listes au-delà des plafonds Appwrite (25 et 100).",
  status:"ended", type:"team", start_date:$sd, end_date:$ed, duration:"72h", tags:["Démo","Volume"],
  organizer_id:"organizer-001", organizer:"KonfiturGame", participants:300, featured:false}')"

echo "── 120 équipes ──"
for i in $(seq 1 120); do
  n=$(printf '%03d' "$i")
  # Les équipes 1..30 sont aussi inscrites à une jam en cours (demo-jam-056)
  if (( i <= 30 )); then jams='["demo-jam-big","demo-jam-056"]'; else jams='["demo-jam-big"]'; fi
  doc teams "demo-team-$n" "$(jq -nc --arg name "Guilde Démo $n" --arg code "KG-DEMO0$n" \
    --arg lead "user-demo-$n" --argjson jams "$jams" \
    '{name:$name, invite_code:$code, leader_id:$lead, jam_ids:$jams}')"
done

echo "── membres (leaders + seconds + 30 adhésions Setsuko) ──"
roles=(dev artist sound designer writer)
for i in $(seq 1 120); do
  n=$(printf '%03d' "$i")
  doc team_members "demo-tm-l-$n" "$(jq -nc --arg tid "demo-team-$n" --arg uid "user-demo-$n" \
    --arg name "Leader Démo $n" --arg role "${roles[$((i % 5))]}" \
    '{team_id:$tid, user_id:$uid, name:$name, role:$role, is_leader:true}')"
done
for i in $(seq 1 60); do
  n=$(printf '%03d' "$i")
  doc team_members "demo-tm-m-$n" "$(jq -nc --arg tid "demo-team-$n" --arg uid "user-demo-m-$n" \
    --arg name "Membre Démo $n" --arg role "${roles[$(((i+2) % 5))]}" \
    '{team_id:$tid, user_id:$uid, name:$name, role:$role, is_leader:false}')"
done
# Le compte réel Setsuko_Aka rejoint les équipes 1..30 → dashboard user >25 adhésions
for i in $(seq 1 30); do
  n=$(printf '%03d' "$i")
  doc team_members "demo-tm-setsuko-$n" "$(jq -nc --arg tid "demo-team-$n" --arg uid "$USER_ID" \
    '{team_id:$tid, user_id:$uid, name:"Setsuko_Aka", role:"dev", is_leader:false}')"
done

echo "── 40 projets soumis sur demo-jam-big (podium 1/2/3) ──"
for i in $(seq 1 40); do
  n=$(printf '%03d' "$i")
  if (( i <= 3 )); then place=$i; else place=0; fi
  doc projects "demo-proj-big-$n" "$(jq -nc --arg tid "demo-team-$n" --arg t "Projet Démo $n" \
    --arg sub "$(d '3 days ago')" --argjson lk $(( (i*3) % 12 )) --argjson pl "$place" '{
    jam_id:"demo-jam-big", team_id:$tid, title:$t,
    description:"Projet de démonstration pour gonfler les listes de soumissions au-delà de 25.",
    technologies:["Godot 4"], submitted:true, submission_date:$sub, likes_count:$lk, placement:$pl}')"
done

echo "── podiums des 5 jams terminées les plus récentes (Hall of Fame) ──"
for j in 001 002 003 004 005; do
  for p in 1 2 3; do
    ti=$(( (10#$j * 3 + p + 40) % 120 + 1 ))   # équipes variées 41..120
    tn=$(printf '%03d' "$ti")
    doc projects "demo-proj-hof-$j-$p" "$(jq -nc --arg jam "demo-jam-$j" --arg tid "demo-team-$tn" \
      --arg t "Podium $p — Jam Démo #$j" --arg sub "$(d "$((10#$j)) days ago")" --argjson pl "$p" '{
      jam_id:$jam, team_id:$tid, title:$t,
      description:"Projet placé pour alimenter le Hall of Fame de démonstration.",
      technologies:["Unity"], submitted:true, submission_date:$sub, likes_count:2, placement:$pl}')"
  done
done

echo "── 5 projets sur la jam en cours demo-jam-056 ──"
for i in $(seq 1 5); do
  n=$(printf '%03d' "$i")
  doc projects "demo-proj-ongoing-$n" "$(jq -nc --arg tid "demo-team-$n" --arg t "Projet En Cours $n" \
    --arg sub "$(d '5 hours ago')" '{
    jam_id:"demo-jam-056", team_id:$tid, title:$t,
    description:"Projet soumis sur une jam en cours, pour les cartes de my-jams.",
    technologies:["Godot 4"], submitted:true, submission_date:$sub, likes_count:1, placement:0}')"
done

echo "── 150 commentaires sur demo-proj-big-001 ──"
for i in $(seq 1 150); do
  n=$(printf '%03d' "$i")
  doc comments "demo-com-$n" "$(jq -nc --arg uid "user-demo-c-$n" --arg name "Commentateur $n" \
    --arg c "Commentaire de démonstration numéro $n pour tester la liste des commentaires au-delà de 100." '{
    project_id:"demo-proj-big-001", author_id:$uid, author_name:$name, content:$c}')"
done

echo "── 60 annonces sur demo-jam-big + 10 sur demo-jam-056 ──"
for i in $(seq 1 60); do
  n=$(printf '%03d' "$i")
  doc announcements "demo-ann-$n" "$(jq -nc --arg t "Annonce démo $n" \
    --arg c "Contenu de l annonce de démonstration numéro $n, pour dépasser le plafond de 50." '{
    jam_id:"demo-jam-big", title:$t, content:$c, important:false, author_id:"organizer-001"}')"
done
for i in $(seq 61 70); do
  n=$(printf '%03d' "$i")
  doc announcements "demo-ann-$n" "$(jq -nc --arg t "Annonce jam en cours $n" \
    --arg c "Annonce sur la jam en cours, pour le feed du dashboard." '{
    jam_id:"demo-jam-056", title:$t, content:$c, important:false, author_id:"organizer-001"}')"
done

echo "── 120 messages de chat sur demo-jam-056 ──"
for i in $(seq 1 120); do
  n=$(printf '%03d' "$i")
  doc chat_messages "demo-msg-$n" "$(jq -nc --arg uid "user-demo-$((i % 20 + 1))" \
    --arg name "Jammeur $((i % 20 + 1))" \
    --arg c "Message de chat numéro $n — on dépasse les 100 pour tester le plafond délibéré du realtime." '{
    jam_id:"demo-jam-056", channel:"general", author_id:$uid, author_name:$name, content:$c,
    role:"user", pinned:false}')"
done

echo
echo "✅ Terminé : ok=$ok, déjà existants=$exists, échecs=$fail"
