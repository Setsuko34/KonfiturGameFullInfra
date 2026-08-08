#!/usr/bin/env bash
# Smoke test de la chaîne de supervision — à lancer stack démarrée.
#
# `promtool` valide la syntaxe et la logique des règles hors ligne ; ce script
# vérifie l'autre moitié, celle qui ne se voit qu'à l'exécution : les cibles
# répondent-elles, les sondes aboutissent-elles, les règles sont-elles
# réellement chargées, et une alerte a-t-elle quelque part où aller.
#
# Il interroge l'API de Prometheus, qui sait déjà tout cela : c'est la même
# information que le clic dans /targets, mais rejouable et scriptable.
#
# Usage: scripts/ci/monitoring-check.sh [url-prometheus]   (défaut: http://localhost:9090)
set -uo pipefail

PROM="${1:-http://localhost:9090}"
PROM="${PROM%/}"
ERRORS=0

fail() { echo "❌ $1"; ERRORS=$((ERRORS + 1)); }
ok()   { echo "✅ $1"; }
warn() { echo "⚠️  $1"; }

for bin in curl jq; do
  command -v "$bin" >/dev/null 2>&1 || { echo "ERREUR : $bin est requis"; exit 1; }
done

# Interroge l'API et échoue proprement si Prometheus ne répond pas : sans ce
# garde, chaque `jq` suivant recevrait une chaîne vide et signalerait une
# anomalie différente pour la même cause.
api() { curl -sS --max-time 10 "$PROM$1" 2>/dev/null; }

echo "🔎 Supervision — $PROM"
echo ""

# ── 1. Prometheus répond ────────────────────────────────────────────────────
if [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$PROM/-/healthy")" != "200" ]; then
  echo "❌ Prometheus injoignable sur $PROM — stack démarrée ?"
  exit 1
fi
ok "Prometheus répond"

# ── 2. Les règles sont chargées ─────────────────────────────────────────────
# LE contrôle le plus important du script. Une erreur de syntaxe dans
# alerts.yml n'empêche pas Prometheus de démarrer : il sert son interface,
# collecte normalement, et n'évalue simplement plus rien. La supervision
# échoue alors en silence et en vert — le pire des modes de panne, puisque
# tout paraît fonctionner. `promtool check rules` couvre ce cas en CI, ce
# contrôle-ci couvre le fichier réellement monté dans le conteneur.
RULES=$(api /api/v1/rules)
RULE_COUNT=$(printf '%s' "$RULES" | jq '[.data.groups[].rules[]] | length' 2>/dev/null || echo 0)
if [ "${RULE_COUNT:-0}" -eq 0 ]; then
  fail "Aucune règle chargée : alerts.yml est absent du conteneur ou refusé au chargement"
else
  GROUP_COUNT=$(printf '%s' "$RULES" | jq '.data.groups | length')
  ok "$RULE_COUNT règles chargées ($GROUP_COUNT groupes)"
fi

# ── 3. Un Alertmanager est raccordé ─────────────────────────────────────────
# Défaut constaté lors de la validation du 2026-08-01 : les règles passaient
# en `firing` dans Prometheus et dans Grafana sans que personne ne soit
# prévenu. Une alerte sans destination n'est pas une alerte.
AM_COUNT=$(api /api/v1/alertmanagers | jq '.data.activeAlertmanagers | length' 2>/dev/null || echo 0)
if [ "${AM_COUNT:-0}" -eq 0 ]; then
  fail "Aucun Alertmanager actif : les alertes évaluées ne seront notifiées nulle part"
else
  ok "$AM_COUNT Alertmanager actif"
fi

# ── 4. Toutes les cibles de collecte répondent ──────────────────────────────
TARGETS=$(api /api/v1/targets)
DOWN=$(printf '%s' "$TARGETS" \
  | jq -r '.data.activeTargets[] | select(.health != "up") | "\(.labels.job) → \(.scrapeUrl) [\(.lastError)]"' 2>/dev/null)
TOTAL=$(printf '%s' "$TARGETS" | jq '.data.activeTargets | length' 2>/dev/null || echo 0)
if [ -n "$DOWN" ]; then
  while IFS= read -r line; do fail "Cible injoignable : $line"; done <<< "$DOWN"
else
  ok "$TOTAL cibles de collecte joignables"
fi

# ── 5. Les sondes blackbox aboutissent ──────────────────────────────────────
# `up` ne dit que « l'exportateur a répondu » : une sonde peut être `up` et
# rapporter un échec. C'est probe_success qui porte le verdict, et c'est lui
# que lisent SiteIndisponible, ApiAppwriteIndisponible et
# DashboardTraefikNonProtege.
PROBES=$(api '/api/v1/query?query=probe_success')
PROBE_COUNT=$(printf '%s' "$PROBES" | jq '.data.result | length' 2>/dev/null || echo 0)
if [ "${PROBE_COUNT:-0}" -eq 0 ]; then
  fail "Aucune sonde blackbox n'a produit de résultat"
else
  KO=$(printf '%s' "$PROBES" | jq -r '.data.result[] | select(.value[1] == "0") | .metric.instance' 2>/dev/null)
  if [ -n "$KO" ]; then
    while IFS= read -r inst; do fail "Sonde en échec : $inst"; done <<< "$KO"
  else
    ok "$PROBE_COUNT sondes blackbox au vert"
  fi
fi

# ── 6. Le collecteur textfile est bien monté ────────────────────────────────
# Maillon que rien d'autre ne vérifie : les scripts cron écrivent des fichiers
# .prom, node-exporter les relit. Si le montage saute, les métriques
# disparaissent sans qu'aucun conteneur ne tombe.
#
# On contrôle la PRÉSENCE, pas la fraîcheur : hors du serveur de production il
# n'y a pas de cron, les valeurs sont donc figées à la dernière exécution
# manuelle. Faire échouer là-dessus rendrait le script inutilisable en dev,
# et un script de vérification qu'on prend l'habitude d'ignorer ne vérifie
# plus rien. La fraîcheur, elle, est la responsabilité de HealthCheckArrete.
for metric in konfitur_healthcheck_last_run_timestamp_seconds \
              konfitur_backup_last_success_timestamp_seconds; do
  VALUE=$(api "/api/v1/query?query=$metric" | jq -r '.data.result[0].value[1] // empty' 2>/dev/null)
  if [ -z "$VALUE" ]; then
    fail "Métrique $metric absente : montage textfile_collector rompu, ou script jamais exécuté"
  else
    AGE_H=$(( ( $(date +%s) - ${VALUE%%.*} ) / 3600 ))
    if [ "$AGE_H" -gt 24 ]; then
      warn "$metric présente mais figée depuis ${AGE_H} h (normal hors production : pas de cron)"
    else
      ok "$metric à jour (${AGE_H} h)"
    fi
  fi
done

# ── 7. État des alertes — informatif ────────────────────────────────────────
# Non bloquant : une alerte active est le signe que la chaîne fonctionne, pas
# qu'elle est cassée. C'est à l'opérateur de juger.
FIRING=$(api /api/v1/alerts | jq -r '.data.alerts[] | select(.state == "firing") | "\(.labels.severity) \(.labels.alertname)"' 2>/dev/null | sort -u)
echo ""
if [ -n "$FIRING" ]; then
  echo "🔔 Alertes actives :"
  printf '%s\n' "$FIRING" | sed 's/^/   /'
else
  echo "🔕 Aucune alerte active"
fi

echo ""
if [ "$ERRORS" -gt 0 ]; then
  echo "❌ $ERRORS anomalie(s) — la chaîne de supervision n'est pas fiable en l'état"
  exit 1
fi
echo "✅ Chaîne de supervision opérationnelle"
