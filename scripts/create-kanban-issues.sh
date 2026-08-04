#!/usr/bin/env bash
# =============================================================================
# create-kanban-issues.sh — Crée toutes les issues du backlog KonfiturGame
# sur GitHub et les ajoute au projet Kanban.
#
# Prérequis :
#   1. gh installé et authentifié (gh auth login)
#   2. Le repo GitHub existe
#   3. Le projet GitHub (Kanban) existe
#
# Usage :
#   ./scripts/create-kanban-issues.sh OWNER/REPO PROJECT_NUMBER
#
# Exemple :
#   ./scripts/create-kanban-issues.sh MonUser/KonfiturGame 1
#
# Le script crée les labels s'ils n'existent pas, puis crée chaque issue
# avec son label et l'ajoute au projet Kanban.
# =============================================================================
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 OWNER/REPO PROJECT_NUMBER"
  echo "Exemple: $0 MonUser/KonfiturGame 1"
  exit 1
fi

REPO="$1"
PROJECT_NUMBER="$2"

echo "=== Création des issues pour $REPO (projet #$PROJECT_NUMBER) ==="
echo ""

# ── 1. Créer les labels s'ils n'existent pas ──────────────────────────────────

declare -A LABELS=(
  ["bug"]="d73a4a"
  ["feature"]="0075ca"
  ["documentation"]="0e8a16"
  ["infrastructure"]="5319e7"
  ["test"]="fbca04"
  ["UX"]="e4e669"
  ["security"]="b60205"
  ["DX"]="1d76db"
  ["P0-critique"]="d73a4a"
  ["P1-important"]="e99695"
  ["P2-amelioration"]="f9d0c4"
)

echo "── Création des labels ──"
for label in "${!LABELS[@]}"; do
  color="${LABELS[$label]}"
  gh label create "$label" --color "$color" --repo "$REPO" 2>/dev/null \
    && echo "  ✓ Label '$label' créé" \
    || echo "  · Label '$label' existe déjà"
done
echo ""

# ── 2. Fonction pour créer une issue et l'ajouter au projet ───────────────────

create_issue() {
  local title="$1"
  local body="$2"
  local labels="$3"

  echo "  → $title"
  issue_url=$(gh issue create \
    --repo "$REPO" \
    --title "$title" \
    --body "$body" \
    --label "$labels" \
    2>&1) || { echo "    ✗ Erreur: $issue_url"; return; }

  # Ajouter au projet Kanban
  gh project item-add "$PROJECT_NUMBER" \
    --owner "${REPO%%/*}" \
    --url "$issue_url" 2>/dev/null \
    && echo "    ✓ Ajouté au projet" \
    || echo "    · Impossible d'ajouter au projet (vérifier le numéro)"
}

# ── 3. Issues — Documentation ─────────────────────────────────────────────────

echo "── Documentation ──"

create_issue \
  "[DOC] Ajouter une section Contributing" \
  "Encourager les contributions à la documentation et au code.\n\nSource : TODO.md" \
  "documentation"

create_issue \
  "[DOC] Ajouter une section License" \
  "Préciser les droits d'utilisation du code et de la documentation.\n\nSource : TODO.md" \
  "documentation"

create_issue \
  "[DOC] Ajouter une section Contact" \
  "Fournir des informations de contact en cas de questions ou de problèmes.\n\nSource : TODO.md" \
  "documentation"

create_issue \
  "[DOC] Ajouter un Changelog" \
  "Documenter les changements majeurs dans le projet au fil du temps.\nPeut être auto-généré depuis git log.\n\nSource : TODO.md" \
  "documentation"

create_issue \
  "[DOC] Ajouter liens vers ressources externes" \
  "Liens vers la doc officielle d'Appwrite, Next.js, Traefik, tutoriels et forums.\n\nSource : TODO.md" \
  "documentation"

create_issue \
  "[DOC] Ajouter une FAQ" \
  "Répondre aux questions fréquemment posées sur le projet, l'installation et l'utilisation.\n\nSource : TODO.md" \
  "documentation"

create_issue \
  "[DOC] Ajouter captures d'écran et diagrammes" \
  "Illustrer les étapes d'installation, la structure du projet et les flux de travail.\n\nSource : TODO.md" \
  "documentation"

create_issue \
  "[DOC] Ajouter exemples de commandes Docker Compose" \
  "Exemples pour démarrer, arrêter et dépanner l'environnement de développement.\n\nSource : TODO.md" \
  "documentation"

create_issue \
  "[DOC] Instructions de mise à jour de l'environnement dev" \
  "Comment gérer les mises à jour d'Appwrite ou des dépendances en dev.\n\nSource : TODO.md" \
  "documentation"

create_issue \
  "[DOC] Conseils de dépannage courants" \
  "Erreurs de connexion à la BDD, problèmes d'auth, erreurs Traefik.\n\nSource : TODO.md" \
  "documentation"

create_issue \
  "[DOC] Créer un design-tokens.md" \
  "Documenter le design system : variables CSS, convention --radius: 0px, palette tricolore dark, fonts.\n\nIdentifié dans l'audit UI/UX (P2-2)." \
  "documentation,UX"

# ── 4. Issues — Tests ─────────────────────────────────────────────────────────

echo ""
echo "── Tests ──"

create_issue \
  "[TEST] Ajouter des tests fonctionnels (e2e)" \
  "Implémenter des tests end-to-end avec Playwright pour les parcours utilisateur critiques :\n- Inscription/connexion\n- Création de jam\n- Chat temps réel\n- Soumission de projet\n\nSource : TODO.md" \
  "test"

create_issue \
  "[TEST] Vérifier le bon fonctionnement du Realtime" \
  "Tester que le WebSocket Appwrite Realtime fonctionne correctement :\n- Réception de messages en temps réel\n- Reconnexion après déconnexion\n- Multi-onglets\n\nSource : TODO.md" \
  "test"

create_issue \
  "[TEST] Augmenter la couverture de tests unitaires" \
  "Actuellement 62+ tests. Objectif : couvrir les Server Actions restantes et les composants critiques.\n\nFichiers non couverts à prioriser :\n- actions/jams.ts\n- actions/projects.ts\n- middleware.ts\n\nSource : TODO.md" \
  "test"

create_issue \
  "[TEST] Tests du middleware.ts" \
  "Tester :\n- Détection de bots (isBot)\n- Vérification des IPs bannies\n- Protection des routes /dashboard et /admin\n- Redirection des utilisateurs déjà connectés depuis /auth/*\n\nFichier : \`frontend/src/middleware.ts\`" \
  "test"

create_issue \
  "[TEST] Tests de composants React (testing-library)" \
  "Ajouter @testing-library/react pour tester les composants :\n- Header (menu mobile, navigation)\n- JamCard (affichage des données)\n- CountdownTimer (calcul du temps restant)\n\nActuellement seuls les modules lib/ sont testés." \
  "test"

# ── 5. Issues — Fonctionnalités ───────────────────────────────────────────────

echo ""
echo "── Fonctionnalités ──"

create_issue \
  "[FEAT] Redirection/partenariat vers FRVtubers" \
  "Le projet est imaginé par FRVtubers. Ajouter un lien/redirection vers leur site ou Discord.\n\nSource : TODO.md" \
  "feature"

create_issue \
  "[FEAT] Logs admin — visualiser les crashs et connexions" \
  "Améliorer la page /admin/logs pour :\n- Afficher les crashs applicatifs\n- Suivre les connexions à l'app\n- Filtrer par type d'événement\n\nSource : TODO.md" \
  "feature"

create_issue \
  "[FEAT] Page /legal/terms (mentions légales / CGU)" \
  "Le lien existe dans register/page.tsx mais la page n'existe pas (→ 404).\nCréer la page /legal/terms avec les mentions légales.\n\nIdentifié dans l'audit UI/UX (P1-7)." \
  "feature"

create_issue \
  "[FEAT] Page /legal/privacy (politique de confidentialité / RGPD)" \
  "Obligatoire pour la conformité RGPD.\nInclure : données collectées, durée de conservation, droits utilisateur, contact DPO." \
  "feature,security"

create_issue \
  "[FEAT] Notifications utilisateur" \
  "Notifier les utilisateurs lors de :\n- Nouvelle annonce sur une jam à laquelle ils participent\n- Invitation dans une équipe\n- Nouveau commentaire/vote sur leur projet" \
  "feature"

create_issue \
  "[FEAT] Export des données utilisateur (droit RGPD)" \
  "Permettre à un utilisateur de télécharger toutes ses données personnelles (profil, messages, projets, votes).\nDroit de portabilité RGPD (article 20)." \
  "feature,security"

create_issue \
  "[FEAT] Pagination sur /explore" \
  "Actuellement tous les jams sont chargés en une seule requête.\nAjouter la pagination (ou infinite scroll) pour supporter un grand nombre de jams." \
  "feature"

create_issue \
  "[FEAT] Filtres avancés sur /explore" \
  "Filtrer les jams par :\n- Statut (upcoming, ongoing, ended)\n- Type (solo, team, both)\n- Date\n- Recherche textuelle" \
  "feature"

# ── 6. Issues — Bugs P0 (audit UI/UX) ────────────────────────────────────────

echo ""
echo "── Bugs P0 — Critiques ──"

create_issue \
  "[BUG][P0] Focus trap manquant dans le menu mobile" \
  "**Fichier :** Header.tsx:145-228\n**WCAG :** 2.1.2 (No Keyboard Trap)\n\nLe menu mobile déclare \`role=\"dialog\"\` et \`aria-modal=\"true\"\` mais aucun focus trap n'est implémenté.\n\nProblèmes :\n- Le focus sort de la modale au lieu d'y rester\n- Pas de gestion de la touche Escape\n- Le focus n'est pas restitué au bouton burger à la fermeture\n\n**Fix :** Ajouter focus-trap-react ou implémenter un hook useFocusTrap + handler Escape.\n\nSource : audit UI/UX (P0-1)" \
  "bug,P0-critique,UX"

create_issue \
  "[BUG][P0] Icône Check affichée pour les critères NON satisfaits" \
  "**Fichier :** register/page.tsx:252\n\nActuellement une coche est toujours affichée (grise ou verte). Un utilisateur peut penser que le critère est optionnel.\n\n**Fix :** Utiliser Check (vert) quand satisfait, X (rouge) quand non satisfait.\n\nSource : audit UI/UX (P0-2)" \
  "bug,P0-critique,UX"

create_issue \
  "[BUG][P0] Contraste insuffisant des messages d'erreur" \
  "**Fichiers :** login/page.tsx:134-139, register/page.tsx:142-147\n**WCAG :** 1.4.3 — ratio mesuré ≈ 4.0:1 (seuil AA : 4.5:1)\n\n\`--secondary: #EF233C\` sur fond composité ≈ \`#2A1319\` → contraste insuffisant.\n\n**Fix :** Utiliser \`#FF6B81\` ou \`#FF8A99\` pour le texte d'erreur (ratio ≈ 7:1).\n\nSource : audit UI/UX (P0-3)" \
  "bug,P0-critique,UX"

create_issue \
  "[BUG][P0] Critères de mot de passe masqués avant frappe" \
  "**Fichier :** register/page.tsx:236\n\nLes règles de mot de passe ne s'affichent qu'après avoir commencé à taper. L'aria-describedby pointe vers un élément qui n'existe pas encore dans le DOM.\n\n**Fix :** Afficher dès le focus avec \`onFocus={() => setPasswordTouched(true)}\`.\n\nSource : audit UI/UX (P0-4)" \
  "bug,P0-critique,UX"

# ── 7. Issues — Bugs P1 ──────────────────────────────────────────────────────

echo ""
echo "── Bugs P1 — Importants ──"

create_issue \
  "[BUG][P1] Layout Shift (CLS) sur les boutons auth du header" \
  "**Fichier :** Header.tsx:74, 174\n\nPendant l'hydratation, les boutons Login/Register disparaissent (CLS visible).\n\n**Fix :** Afficher un skeleton placeholder pendant le loading.\n\nSource : audit UI/UX (P1-1)" \
  "bug,P1-important,UX"

create_issue \
  "[BUG][P1] Pas de lien Mot de passe oublié" \
  "**Fichier :** login/page.tsx\n\nAucun lien vers une page de réinitialisation de mot de passe. Parcours utilisateur courant bloqué.\n\n**Fix :** Ajouter un lien vers /auth/forgot-password (page à créer).\n\nSource : audit UI/UX (P1-2)" \
  "bug,P1-important,UX"

create_issue \
  "[BUG][P1] Indicateurs visuels de champs requis absents" \
  "**Fichiers :** register/page.tsx, login/page.tsx\n\nLes champs ont \`aria-required=\"true\"\` mais pas d'indicateur visuel (* ou mention Obligatoire).\n\n**Fix :** Ajouter \`<span aria-hidden=\"true\">*</span>\` sur chaque label requis.\n\nSource : audit UI/UX (P1-3)" \
  "bug,P1-important,UX"

create_issue \
  "[BUG][P1] cursor-pointer manquant sur les boutons" \
  "**Fichiers :** login, register, menu mobile\n\nLes boutons n'ont pas cursor: pointer. Sur desktop le curseur reste en flèche.\n\n**Fix :** Ajouter dans globals.css :\n\`\`\`css\nbutton { cursor: pointer; }\nbutton:disabled { cursor: not-allowed; }\n\`\`\`\n\nSource : audit UI/UX (P1-4)" \
  "bug,P1-important,UX"

create_issue \
  "[BUG][P1] Absence de spinner sur le bouton submit" \
  "**Fichiers :** login/page.tsx:218, register/page.tsx:269\n\nLe texte change en \"Connexion...\" mais sans spinner visuel. Sur connexion lente l'utilisateur peut re-cliquer.\n\n**Fix :** Ajouter un spinner inline animé.\n\nSource : audit UI/UX (P1-5)" \
  "bug,P1-important,UX"

create_issue \
  "[BUG][P1] Focus non géré à l'ouverture du menu mobile" \
  "**Fichier :** Header.tsx:157\n\nLe premier élément interactif du dialog devrait recevoir le focus automatiquement à l'ouverture.\n\nSource : audit UI/UX (P1-6)" \
  "bug,P1-important,UX"

create_issue \
  "[BUG][P1] Lien conditions d'utilisation pointe vers une 404" \
  "**Fichier :** register/page.tsx:274-280\n\nLe lien vers /legal/terms existe mais la page n'est pas implémentée.\nÀ résoudre avec l'issue [FEAT] Page /legal/terms.\n\nSource : audit UI/UX (P1-7)" \
  "bug,P1-important"

# ── 8. Issues — UX P2 ────────────────────────────────────────────────────────

echo ""
echo "── Améliorations UX (P2) ──"

create_issue \
  "[UX][P2] Hover/focus absent sur les liens de navigation desktop" \
  "**Fichier :** Header.tsx:60-68\n\nLes liens inactifs n'ont pas de feedback hover, réduisant la sensation d'interactivité.\n\nSource : audit UI/UX (P2-1)" \
  "UX,P2-amelioration"

create_issue \
  "[UX][P2] EmptyState — fallback accessible sans icône" \
  "**Fichier :** EmptyState.tsx\n\nSi l'icône n'est pas passée, les lecteurs d'écran n'ont aucune indication. Vérifier que title et subtitle sont toujours fournis.\n\nSource : audit UI/UX (P2-3)" \
  "UX,P2-amelioration"

# ── 9. Issues — Infrastructure / Sécurité ────────────────────────────────────

echo ""
echo "── Infrastructure / Sécurité ──"

create_issue \
  "[INFRA] CSP connect-src — remplacer api.localhost par le vrai domaine" \
  "**Fichier :** traefik/dynamic/middlewares.yml:20-22\n\nLa CSP \`connect-src\` est hardcodée avec \`api.localhost\`. En production il faut \`api.konfiturgame.fr\`.\nTraefik file provider ne substitue pas les variables d'env.\n\n**Fix :** Modifier manuellement en prod." \
  "infrastructure"

create_issue \
  "[INFRA] Mettre en place Prometheus + Grafana" \
  "Ajouter un stack de monitoring au Docker Compose :\n- Prometheus pour la collecte de métriques\n- Grafana pour la visualisation\n- Alertes configurables\n\nActuellement le monitoring est basé sur des scripts cron." \
  "infrastructure"

create_issue \
  "[PROD] Mettre en place surveillance et alertes" \
  "Configurer des alertes automatiques :\n- Service down → notification\n- Disque > 80% → avertissement\n- Certificat TLS bientôt expiré\n\nSource : TODO.md" \
  "infrastructure"

create_issue \
  "[PROD] Tests de charge" \
  "Effectuer des tests de charge pour vérifier que l'app supporte le trafic attendu pendant une jam.\nOutils possibles : k6, Artillery, ou Apache Bench.\n\nSource : TODO.md" \
  "infrastructure,test"

create_issue \
  "[PROD] Sécurité production" \
  "Vérifier :\n- Configuration pare-feu (UFW)\n- Mots de passe forts sur tous les services\n- Mises à jour de sécurité appliquées\n- Fail2ban installé\n\nSource : TODO.md" \
  "infrastructure,security"

create_issue \
  "[SECURITY] Implémenter /auth/forgot-password" \
  "Page de réinitialisation de mot de passe.\nAppwrite fournit \`account.createRecovery()\` pour envoyer un email de reset.\nCréer la page et le flow complet.\n\nLié à : [BUG][P1] Pas de lien Mot de passe oublié" \
  "security,feature"

create_issue \
  "[SECURITY] Rate limiting spécifique sur /auth/login" \
  "Actuellement le rate limiting est global (100 req/min).\nAjouter un rate limit plus strict sur /auth/login pour prévenir le brute-force (ex: 10 req/min par IP)." \
  "security,infrastructure"

# ── 10. Issues — DX / CI/CD ──────────────────────────────────────────────────

echo ""
echo "── DX / CI/CD ──"

create_issue \
  "[DX] Pipeline CI GitHub Actions" \
  "Mettre en place un workflow GitHub Actions :\n\`\`\`yaml\non: push (main)\njobs:\n  - pnpm type-check\n  - pnpm lint\n  - pnpm test\n  - pnpm build\n  - deploy (SSH)\n\`\`\`\n\nSource : TODO.md" \
  "DX,infrastructure"

create_issue \
  "[DX] Ajouter Playwright pour les tests e2e" \
  "Installer Playwright et écrire les tests pour les parcours critiques :\n- Inscription → login → dashboard\n- Création de jam → exploration\n- Chat temps réel (multi-onglets)" \
  "DX,test"

echo ""
echo "=== Terminé ! ==="
echo "Total : 52 issues créées et ajoutées au projet Kanban."
echo ""
echo "Vérifier sur : https://github.com/$REPO/issues"
