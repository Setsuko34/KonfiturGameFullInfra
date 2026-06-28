#!/usr/bin/env bash
# Agrège les rapports sécurité JSON de la CI en un rapport Markdown.
# Usage: build-security-report.sh <dir-rapports>
# Écrit <dir>/security-report.md ; affiche le total de findings sur stdout.
set -euo pipefail

DIR="${1:?usage: build-security-report.sh <dir-rapports>}"
OUT="$DIR/security-report.md"
TOTAL=0
MAX_LINES=50

# Valide les JSON en amont : un artefact tronqué doit produire une erreur claire,
# pas un rapport partiel silencieux.
for f in semgrep.json pnpm-audit.json trivy-fs.json trivy-config.json; do
  if [ -f "$DIR/$f" ] && ! jq empty "$DIR/$f" 2>/dev/null; then
    echo "ERREUR : $f invalide ou tronqué" >&2
    exit 1
  fi
done

{
  echo "# Rapport sécurité automatique"
  echo
  echo "_Généré par la CI le $(date -u +'%Y-%m-%d %H:%M UTC') — commit \`${GITHUB_SHA:-local}\`_"
  echo
  echo "Jobs non bloquants (Semgrep, audit dépendances, Trivy). Mis à jour à chaque push sur \`main\`."
} > "$OUT"

section() { # $1=titre  $2=count  $3=détails markdown
  {
    echo
    echo "## $1 — $2 finding(s)"
    if [ "$2" -gt 0 ] && [ -n "$3" ]; then
      echo
      printf '%s\n' "$3"
      [ "$2" -gt "$MAX_LINES" ] && echo "" && echo "_… liste tronquée à $MAX_LINES lignes, voir les artefacts du run pour le détail._" || true
    fi
  } >> "$OUT"
}

if [ -f "$DIR/semgrep.json" ]; then
  COUNT=$(jq '.results | length' "$DIR/semgrep.json")
  DETAILS=$(jq -r '.results[] | "- `\(.check_id)` — \(.path):\(.start.line)"' "$DIR/semgrep.json" | head -n "$MAX_LINES" || true)
  section "Semgrep (SAST / OWASP Top 10)" "$COUNT" "$DETAILS"
  TOTAL=$((TOTAL + COUNT))
fi

if [ -f "$DIR/pnpm-audit.json" ]; then
  COUNT=$(jq '[.metadata.vulnerabilities[]] | add // 0' "$DIR/pnpm-audit.json")
  DETAILS=$(jq -r '(.advisories // {}) | to_entries[] | "- [\(.value.severity)] `\(.value.module_name)` — \(.value.title)"' "$DIR/pnpm-audit.json" | head -n "$MAX_LINES" || true)
  section "pnpm audit (dépendances)" "$COUNT" "$DETAILS"
  TOTAL=$((TOTAL + COUNT))
fi

if [ -f "$DIR/trivy-fs.json" ]; then
  COUNT=$(jq '[.Results[]? | (.Vulnerabilities // [])[]] | length' "$DIR/trivy-fs.json")
  DETAILS=$(jq -r '.Results[]? | (.Vulnerabilities // [])[] | "- [\(.Severity)] \(.VulnerabilityID) — `\(.PkgName)`"' "$DIR/trivy-fs.json" | head -n "$MAX_LINES" || true)
  section "Trivy fs (CVE dépendances)" "$COUNT" "$DETAILS"
  TOTAL=$((TOTAL + COUNT))
fi

if [ -f "$DIR/trivy-config.json" ]; then
  COUNT=$(jq '[.Results[]? | (.Misconfigurations // [])[]] | length' "$DIR/trivy-config.json")
  DETAILS=$(jq -r '.Results[]? as $r | ($r.Misconfigurations // [])[] | "- [\(.Severity)] \(.ID) — \($r.Target) : \(.Title)"' "$DIR/trivy-config.json" | head -n "$MAX_LINES" || true)
  section "Trivy config (Docker / Compose)" "$COUNT" "$DETAILS"
  TOTAL=$((TOTAL + COUNT))
fi

echo "$TOTAL"
