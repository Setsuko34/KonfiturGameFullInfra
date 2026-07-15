# Annexe B — Accessibilité : audit WCAG 2.1 AA du code source

> Annexe au dossier (section V — Sécurité et accessibilité). Détaille les points
> d'accessibilité implémentés, mappés aux critères WCAG 2.1 AA. Les défauts
> prioritaires (P0) et leur plan de correction sont documentés dans
> [`analyse_ui_ux.md`](./analyse_ui_ux.md).

---

## B.1 Choix du référentiel — WCAG 2.1 niveau AA

| Critère | WCAG 2.1 AA | RGAA 4.1 | OPQUAST |
|---------|-------------|----------|---------|
| Reconnaissance internationale | ✅ Standard W3C | ⚠️ France uniquement | ⚠️ Spécifique qualité web |
| Précision technique | ✅ Critères mesurables | ✅ Dérivé de WCAG | ⚠️ Plus généraliste |
| Outillage disponible | ✅ axe-core, Lighthouse, Wave | ⚠️ Limité | ⚠️ Limité |

Le niveau **AA** est le compromis recommandé : accessibilité aux principaux publics handicapés sans les contraintes parfois impraticables du niveau AAA (ex. contraste 7:1 sur tout le texte).

---

## B.2 Points implémentés, mappés WCAG (audit code source)

| WCAG | Critère | Implémentation |
|------|---------|----------------|
| 1.3.1 | Information et relations | `<label htmlFor>` lié à `<input id>` sur tous les champs |
| 1.4.3 | Contraste du texte | Palette dark vérifiée (textes principaux ≥ 7:1) |
| 1.4.10 | Reflow (responsive) | Tailwind responsive natif, breakpoints testés |
| 1.4.12 | Espacement du texte | `line-height: 1.6`, `font-size` base 16 px |
| 2.1.1 | Tout au clavier | Aucun `onClick` sans équivalent clavier |
| 2.1.4 | Skip link | `globals.css:69`, visible au focus, `z-index: 9999` |
| 2.4.3 | Ordre du focus | Ordre DOM cohérent avec l'ordre visuel |
| 2.4.4 | Objet du lien (en contexte) | `aria-label` explicite sur les liens icônes |
| 2.4.7 | Focus visible | `:focus-visible` dans `globals.css:90` (pas d'`outline: none` sauvage) |
| 2.5.5 | Taille de cible | Boutons ≥ 44×44 px (`min-h-11` ou padding équivalent) |
| 3.2.4 | Identification cohérente | `aria-current="page"` sur les liens actifs (`Header.tsx`) |
| 3.3.1 | Identification d'erreur | `role="alert"` + `aria-live="assertive"` sur les erreurs |
| 3.3.2 | Étiquettes ou instructions | Labels visibles + `aria-describedby` pour les contraintes de mot de passe |
| 4.1.2 | Nom, rôle, valeur | `aria-expanded`, `aria-controls`, `aria-modal`, `aria-label` sur les éléments ARIA |
| 4.1.3 | Messages d'état | `role="alert"` annoncé aux lecteurs d'écran |

### Bonnes pratiques transversales
- `prefers-reduced-motion` : animations CSS désactivées (`globals.css:223`).
- Polices `next/font` avec `display: swap` (évite le FOIT).
- `autocomplete` sémantique (`email`, `current-password`, `new-password`, `username`).
- `type="email"` / `inputmode` : claviers virtuels adaptés.
- `aria-hidden="true"` sur les icônes décoratives.
- `<html lang="fr">` : prononciation correcte des lecteurs d'écran.

---

## B.3 Limites identifiées (P0) — plan de correction

Défauts prioritaires détaillés dans [`analyse_ui_ux.md`](./analyse_ui_ux.md) :

| ID | Problème | Critère WCAG | Correction planifiée |
|----|----------|--------------|----------------------|
| P0-1 | Pas de focus trap dans le menu mobile (`role="dialog"`) | 2.1.2 (No Keyboard Trap) | `useFocusTrap` + handler `Escape` |
| P0-2 | Icône `<Check>` affichée pour critères mot de passe **non** satisfaits | 1.4.1 (Utilisation de la couleur) | ✅ corrigé (2026-07-15, icône `<X>` + `--error`) |
| P0-3 | Contraste messages d'erreur ≈ 4.0:1 (seuil AA 4.5:1) | 1.4.3 (Contraste minimum) | ✅ corrigé (2026-07-15, couleur d'erreur `--error` `#FF6B81` ≈ 6.36:1) |
| P0-4 | Critères de mot de passe masqués avant frappe | 3.3.2 (Étiquettes ou instructions) | Affichage dès le focus du champ |

---

## B.4 Outils de validation

| Outil | Type | Usage |
|-------|------|-------|
| Lighthouse (Chrome DevTools) | Audit automatisé | Accessibilité, performance, SEO |
| axe DevTools (extension) | Audit approfondi | Violations WCAG en temps réel |
| NVDA (lecteur d'écran Windows) | Test manuel | Annonce correcte des composants ARIA |

Intégration `lighthouse-ci` dans la CI planifiée en post-MVP.
