#!/usr/bin/env bash
# Checklist RGPD — job bloquant en CI.
# Usage: scripts/ci/rgpd-check.sh [racine-du-repo]   (défaut: répertoire courant)
set -uo pipefail

ROOT="${1:-.}"
ALLOWLIST="$(cd "$(dirname "$0")" && pwd)/allowed-third-party-domains.txt"
ERRORS=0

if [ ! -f "$ALLOWLIST" ]; then
  echo "ERREUR : liste d'autorisation introuvable : $ALLOWLIST"
  exit 1
fi

fail() { echo "❌ $1"; ERRORS=$((ERRORS + 1)); }
ok()   { echo "✅ $1"; }

# 1. Pages légales obligatoires
for page in legal/mentions-legales legal/privacy; do
  if [ -f "$ROOT/frontend/src/app/$page/page.tsx" ]; then
    ok "Page /$page présente"
  else
    fail "Page /$page manquante (frontend/src/app/$page/page.tsx)"
  fi
done

# 2. lang="fr" sur le layout racine
if grep -q 'lang="fr"' "$ROOT/frontend/src/app/layout.tsx" 2>/dev/null; then
  ok 'Layout racine : lang="fr"'
else
  fail 'lang="fr" absent de frontend/src/app/layout.tsx'
fi

# 3. Aucun domaine tiers hors liste d'autorisation
# tr -d '\r' : le repo vit sur un FS Windows — neutralise d'éventuels CRLF
ALLOWED=$(grep -vE '^[[:space:]]*(#|$)' "$ALLOWLIST" | tr -d '\r')
FOUND=$(grep -rEoh 'https?://[a-zA-Z0-9.-]+\.[a-z]{2,}' \
  "$ROOT/frontend/src" --include='*.ts' --include='*.tsx' 2>/dev/null \
  | sed -E 's|https?://||' | sort -u)

DOMAIN_ERRORS=0
while IFS= read -r domain; do
  [ -z "$domain" ] && continue
  if ! printf '%s\n' "$ALLOWED" | grep -qxF "$domain"; then
    fail "Domaine tiers non autorisé : $domain (si légitime, l'ajouter à scripts/ci/allowed-third-party-domains.txt)"
    DOMAIN_ERRORS=$((DOMAIN_ERRORS + 1))
  fi
done <<< "$FOUND"
[ "$DOMAIN_ERRORS" -eq 0 ] && ok "Tous les domaines référencés sont dans la liste d'autorisation"

echo
if [ "$ERRORS" -gt 0 ]; then
  echo "Checklist RGPD : ÉCHEC ($ERRORS erreur(s))"
  exit 1
fi
echo "Checklist RGPD : OK"
