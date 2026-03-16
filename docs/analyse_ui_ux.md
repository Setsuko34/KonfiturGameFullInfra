# Analyse UI/UX — KonfiturGame Frontend

> Générée le 16 mars 2026 à partir de l'inspection du code source.
> Stack : Next.js 15 · Tailwind CSS · Appwrite · Lucide icons
> Design system : thème sombre (#0C1018 / #F0EDE8) · Space Grotesk · `--radius: 0px`

---

## Résumé exécutif

Le frontend présente une **base d'accessibilité solide** (skip link, aria-labels, autocomplete, role=alert) qui dépasse la majorité des projets comparables. Les problèmes identifiés sont principalement dans les **micro-interactions** et quelques **lacunes WCAG de niveau AA** concentrées sur deux composants.

| Priorité | Nb de problèmes |
|----------|----------------|
| P0 — Critique (WCAG AA / bloquant UX) | 4 |
| P1 — Important (UX dégradé) | 7 |
| P2 — Amélioration (polish / bonnes pratiques) | 8 |
| ✅ Points positifs notables | 18 |

---

## Points positifs — Ce qui fonctionne bien

| # | Élément | Fichier | Détail |
|---|---------|---------|--------|
| 1 | Skip link | `globals.css:64` | Correctement implémenté, z-index 9999, visible au focus |
| 2 | `role="alert"` + `aria-live="assertive"` | `login/page.tsx:132` | Messages d'erreur annoncés aux lecteurs d'écran |
| 3 | Labels `htmlFor` + `id` cohérents | `login/page.tsx:147` `register/page.tsx:155` | 100% des champs ont un label associé |
| 4 | `autocomplete` sémantique | Login: `email`, `current-password` / Register: `username`, `email`, `new-password` | Autofill browser + gestionnaires de mots de passe fonctionnels |
| 5 | `aria-describedby="password-requirements"` | `register/page.tsx:219` | Le champ mot de passe est lié à ses critères |
| 6 | Bouton show/hide mot de passe | `login/page.tsx:194–206` | `aria-label` dynamique, icône `aria-hidden` |
| 7 | `aria-current="page"` sur les liens actifs | `Header.tsx:59` | Conformité WCAG 2.1 critère 2.4.4 |
| 8 | `aria-expanded` + `aria-controls` sur le burger | `Header.tsx:131–133` | Disclosure pattern correct |
| 9 | `role="dialog"` + `aria-modal="true"` sur le menu mobile | `Header.tsx:148–149` | Sémantique modale déclarée |
| 10 | `aria-label` sur le logo | `Header.tsx:42` | `"KonfiturGame — Accueil"` explicite |
| 11 | `type="email"` sur les inputs email | `login/page.tsx:155` | Clavier optimisé mobile |
| 12 | `disabled:opacity-50` sur les boutons | `login/page.tsx:212` | État désactivé visuellement distinct |
| 13 | `prefers-reduced-motion` | `globals.css` | Animations désactivées selon préférence système |
| 14 | `focus-visible` styles | `globals.css` | Focus rings visibles sans affecter les clics souris |
| 15 | Line-height 1.6 | `globals.css:58` | Lisibilité corpo optimale |
| 16 | Font-size base 16px | `globals.css:49` | Évite le zoom automatique iOS |
| 17 | Icônes SVG Lucide (aucun emoji fonctionnel) | Tous les composants | Cohérence, scalabilité, thémabilité |
| 18 | `aria-hidden="true"` sur toutes les icônes décoratives | Header, Login, Register | Pas de pollution lecteur d'écran |

---

## Problèmes P0 — Critiques

### P0-1 · Focus trap manquant dans le menu mobile

**Fichier :** `Header.tsx:145–228`
**Sévérité :** WCAG 2.1 critère 2.1.2 (No Keyboard Trap) — mais inverse : le focus *sort* de la modale au lieu d'y rester.

Le menu mobile déclare `role="dialog"` et `aria-modal="true"` — ce qui signale aux lecteurs d'écran que le focus doit rester dans cet élément. Or aucun focus trap n'est implémenté : un utilisateur clavier peut tabber hors du menu sans le fermer.

Problèmes associés :
- Pas de gestion de la touche `Escape` pour fermer
- Le focus n'est pas restitué au bouton burger à la fermeture

```tsx
// Manque dans Header.tsx — bouton burger (ligne 128)
// onKeyDown={(e) => e.key === 'Escape' && setMenuOpen(false)}

// Manque dans le <div id="mobile-menu"> — focus trap
// useFocusTrap() ou bibliothèque comme focus-trap-react
```

**Fix recommandé :** Ajouter `focus-trap-react` ou implémenter un hook `useFocusTrap` + handler `Escape` sur le bouton burger.

---

### P0-2 · Icône `<Check>` affichée pour les critères NON satisfaits

**Fichier :** `register/page.tsx:252`
**Sévérité :** Information erronée — visuellement trompeur

```tsx
// Actuel : toujours une coche, juste grise ou verte
<Check size={11} aria-hidden="true" />
{req.label}
```

Un utilisateur voyant une coche grise peut penser que le critère est "optionnel" et non "non satisfait". La convention universelle est coche verte = OK, croix rouge = NON satisfait.

```tsx
// Fix
import { Check, X } from 'lucide-react'

{ok
  ? <Check size={11} aria-hidden="true" style={{ color: 'var(--success)' }} />
  : <X size={11} aria-hidden="true" style={{ color: 'var(--secondary)' }} />
}
```

---

### P0-3 · Contraste insuffisant — messages d'erreur

**Fichier :** `login/page.tsx:134–139`, `register/page.tsx:142–147`
**Sévérité :** WCAG 1.4.3 — ratio mesuré ≈ 4.0:1 (seuil AA : 4.5:1)

La couleur du texte d'erreur (`--secondary: #EF233C`) sur le fond de l'alerte (`rgba(239, 35, 60, 0.1)` composité sur `--card: #131921`) donne un fond rendu ≈ `#2A1319`, ce qui produit un ratio insuffisant.

```css
/* Actuel : #EF233C sur fond composité ~#2A1319 ≈ 4.0:1 — ÉCHEC AA */
color: var(--secondary);  /* #EF233C */
background: rgba(239, 35, 60, 0.1);

/* Fix : utiliser une couleur de texte plus claire sur l'erreur */
color: #FF6B81;  /* ≈ 7:1 sur #2A1319 */
/* ou augmenter la luminosité : --error-text: #FF8A99 */
```

---

### P0-4 · Critères de mot de passe masqués avant frappe

**Fichier :** `register/page.tsx:236`
**Sévérité :** UX bloquant — les utilisateurs ne connaissent pas les règles avant de commencer

```tsx
// Actuel : liste conditionnelle — invisible au focus
{password && (
  <ul id="password-requirements">...</ul>
)}
```

L'utilisateur doit taper quelque chose pour *découvrir* les règles, alors que l'objectif est l'inverse. Le `aria-describedby="password-requirements"` pointe vers un élément qui n'existe pas encore dans le DOM au premier focus, ce qui casse l'association ARIA.

**Fix :** Afficher les requirements dès que l'input est focalisé (ou toujours), en les initialisant tous à l'état "non satisfait".

```tsx
const [passwordTouched, setPasswordTouched] = useState(false)

// Sur l'input : onFocus={() => setPasswordTouched(true)}
// Dans le JSX : {(passwordTouched || password) && <ul ...>}
```

---

## Problèmes P1 — Importants

### P1-1 · Layout Shift sur les CTAs du header pendant le chargement

**Fichier :** `Header.tsx:74`, `Header.tsx:174`

```tsx
{!loading && (/* ... boutons auth ... */)}
```

Pendant l'hydratation (quelques centaines de ms), les boutons Login/Register disparaissent complètement, causant un saut de layout visible (CLS). L'espace n'est pas réservé.

**Fix :** Afficher un skeleton placeholder pendant `loading`.

```tsx
{loading
  ? <div className="w-32 h-8 animate-pulse" style={{ background: 'var(--muted)' }} />
  : (/* ... boutons ... */)
}
```

---

### P1-2 · Pas de lien "Mot de passe oublié"

**Fichier :** `login/page.tsx`
**Impact :** Fort — parcours utilisateur courant bloqué, taux d'abandon élevé.

Aucun lien vers une page de réinitialisation de mot de passe entre le champ password et le bouton submit. Même si la feature n'est pas encore implémentée, le lien devrait exister (éventuellement pointer vers `/auth/forgot-password`).

---

### P1-3 · Indicateurs de champs requis absents visuellement

**Fichier :** `register/page.tsx:154–175`, `login/page.tsx:146–168`

Les champs ont `aria-required="true"` mais aucun indicateur visuel (`*` ou mention "Obligatoire"). C'est une attente standard pour tous les formulaires. Les utilisateurs qui scannent visuellement ne savent pas quels champs sont requis.

```tsx
// Ajouter sur chaque label requis
<label htmlFor="email" className="block text-sm font-medium mb-2">
  Adresse e-mail <span aria-hidden="true" style={{ color: 'var(--secondary)' }}>*</span>
</label>
```

---

### P1-4 · Cursor manquant sur les boutons et le menu mobile

**Fichier :** `login/page.tsx:93–118`, `register/page.tsx:102–128`

Les boutons OAuth et le bouton submit n'ont pas `cursor-pointer`. Sur desktop, le curseur reste en flèche, ce qui réduit la perception d'interactivité. Pareil pour les items du menu mobile.

**Fix :** Ajouter globalement dans `globals.css` :
```css
button { cursor: pointer; }
button:disabled { cursor: not-allowed; }
```

---

### P1-5 · Absence d'état de chargement avec spinner sur le submit

**Fichier :** `login/page.tsx:218`, `register/page.tsx:269`

Le texte change en `"Connexion..."` mais sans spinner. Sur connexion lente, l'utilisateur peut penser que rien ne se passe et re-cliquer. Le bouton est bien `disabled`, mais sans indication visuelle forte.

```tsx
// Ajouter un spinner inline
{loading && <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />}
{loading ? 'Connexion...' : 'Se connecter'}
```

---

### P1-6 · Pas de `role="navigation"` explicite sur le menu mobile

**Fichier :** `Header.tsx:157`

Le `<nav>` dans le dialog mobile a `aria-label="Navigation mobile"` mais le `<div>` parent (le dialog) n't a pas de premier élément focalisable — le focus ne va nulle part à l'ouverture. Le premier élément interactif du dialog devrait recevoir le focus automatiquement.

---

### P1-7 · Mentions légales sur la page register — lien trop discret

**Fichier :** `register/page.tsx:274–280`

```tsx
<Link href="/legal/terms" style={{ color: 'var(--muted-foreground)', textDecoration: 'underline' }}>
  conditions d'utilisation
</Link>
```

Le lien est en `--muted-foreground` (#8891A4) sur fond `--background` — peu visible, mais surtout : **le lien vers `/legal/terms` n'existe probablement pas encore**. Un clic dessus mènera vers la 404.

---

## Problèmes P2 — Améliorations

### P2-1 · Aucun `hover` ni `focus` visible sur les liens de navigation desktop

**Fichier :** `Header.tsx:60–68`

Les liens nav ont `transition-colors` mais uniquement une couleur en `active`. Pas de `:hover` défini en dehors de la couleur `primary` pour le lien courant. Les liens inactifs n'ont pas de feedback hover, ce qui réduit la sensation d'interactivité.

---

### P2-2 · `--radius: 0px` — cohérence à documenter

**Fichier :** `globals.css:30`

Les coins carrés sont intentionnels (esthétique cyberpunk/flat) mais non documentés. Si un développeur ajoute un composant avec `rounded-md`, ça créera une incohérence. Recommandation : documenter explicitement la convention dans un commentaire ou dans un fichier `design-tokens.md`.

---

### P2-3 · `EmptyState` — icône optionnelle sans fallback accessible

**Fichier :** `EmptyState.tsx`

Si l'icône n'est pas passée mais que l'état vide a un sens visuel fort, les lecteurs d'écran n'ont aucune indication. Vérifier que le `title` et `subtitle` sont toujours fournis quand l'icône est absente.

---

### P2-4 · `CountdownTimer` — pas d'alternative textuelle temps réel

**Fichier :** `CountdownTimer.tsx`

Le timer tourne et pulse en rouge à <2h. Il n'y a pas de `aria-live="polite"` pour annoncer les changements d'état critiques (passage à "urgent"). Un utilisateur lecteur d'écran ne saura pas que le délai est imminent.

```tsx
// Ajouter quand < 2h
<span className="sr-only" aria-live="polite">
  {isUrgent ? 'Attention : moins de 2 heures restantes' : ''}
</span>
```

---

### P2-5 · `JamCard` — interactivité implicite

**Fichier :** `JamCard.tsx`

Si la card entière est cliquable (wrappée dans un `<Link>`), le `role` doit être cohérent. Vérifier que le titre de la jam est le texte accessible de la card et non l'URL brute.

---

### P2-6 · `MarqueeStats` — animation sans pause au focus/hover

**Fichier :** `MarqueeStats.tsx`

Les marquees accessibles doivent se mettre en pause au hover ou focus clavier. Si le contenu défile en continu, un utilisateur lecteur d'écran ou à faible motricité ne peut pas lire les stats.

```css
/* globals.css — ajouter */
.marquee-container:hover .marquee-track,
.marquee-container:focus-within .marquee-track {
  animation-play-state: paused;
}
```

---

### P2-7 · Police `JetBrains Mono` utilisée uniquement pour le timer

**Fichier :** `globals.css`, `CountdownTimer.tsx`

`JetBrains Mono` est chargée pour la classe `.timer-font` uniquement. Si elle n'est utilisée que sur le CountdownTimer, envisager de la charger en `font-display: optional` ou de la subsetter pour éviter un chargement réseau inutile.

---

### P2-8 · Dashboard — données mockées visibles en production

**Fichier :** `dashboard/page.tsx`

Le dashboard utilise des données mock importées de `@/lib/mockData`. Si ces données sont visibles en production, des utilisateurs pourraient voir des noms/statistiques fictifs. Ajouter un guard `process.env.NODE_ENV === 'development'` ou supprimer le fallback mock avant le déploiement.

---

## Analyse du design system

### Palette actuelle

| Token | Valeur | Usage |
|-------|--------|-------|
| `--background` | `#0C1018` | Fond global |
| `--foreground` | `#F0EDE8` | Texte principal |
| `--primary` | `#4F6AFF` | CTAs, liens actifs, accents |
| `--secondary` | `#EF233C` | Erreurs, urgence |
| `--success` | `#34D399` | Validation, succès |
| `--muted-foreground` | `#8891A4` | Texte secondaire |
| `--card` | `#131921` | Surfaces élevées |
| `--radius` | `0px` | Sharp corners (esthétique intentionnelle) |

**Contraste mesuré :**
- `--foreground` / `--background` : ≈ 15:1 ✅ AAA
- `--muted-foreground` / `--background` : ≈ 6.3:1 ✅ AA
- `--muted-foreground` / `--card` : ≈ 5.9:1 ✅ AA
- `--secondary` / erreur background : ≈ 4.0:1 ❌ ÉCHEC AA (voir P0-3)

### Typographie

| Rôle | Police | Statut |
|------|--------|--------|
| Interface / titres | Space Grotesk | ✅ Excellent choix pour gaming/tech |
| Timers / code | JetBrains Mono | ✅ Cohérent avec l'identité dev |
| Body | Space Grotesk | ✅ Lisible, moderne |

Space Grotesk est supérieure à la recommandation automatique (Amatic SC) pour un produit gaming/tech sérieux. Pas de changement recommandé.

### Recommandation design system

Le style actuel "flat dark / brutalist" avec `--radius: 0px` est **cohérent et distinctif**. Il ne faut pas ajouter de border-radius arbitraires. Si des composants tiers (toasts, modals) sont intégrés plus tard, s'assurer qu'ils héritent de `--radius`.

---

## Checklist de livraison

### Avant chaque PR touchant les formulaires
- [ ] Chaque input a un `<label>` visible avec `htmlFor`
- [ ] Les messages d'erreur utilisent `role="alert"` ou `aria-live`
- [ ] Le ratio de contraste texte/fond est ≥ 4.5:1
- [ ] Le bouton submit montre un état loading (spinner ou texte)
- [ ] `autocomplete` approprié sur chaque input

### Avant chaque PR touchant la navigation
- [ ] Les liens actifs ont `aria-current="page"`
- [ ] Les menus/dialogs gèrent Escape et le focus trap
- [ ] Le focus est restitué à l'élément déclencheur à la fermeture

### Avant le déploiement production
- [ ] Supprimer / guarder les données mockées
- [ ] Vérifier `/legal/terms` et `/legal/privacy` existent
- [ ] Tester à 375px (mobile) et 1440px (desktop)
- [ ] Tester avec le lecteur d'écran navigateur (macOS VoiceOver ou NVDA)
- [ ] Tester avec `prefers-reduced-motion: reduce` activé

---

## Priorisation recommandée

```
Sprint 1 (sécurité/accessibilité légale)
  └── P0-1 : Focus trap menu mobile
  └── P0-2 : Icône Check/X sur password requirements
  └── P0-3 : Contraste messages d'erreur
  └── P0-4 : Password requirements visibles au focus

Sprint 2 (UX conversionnelle)
  └── P1-1 : Skeleton header pendant loading
  └── P1-2 : Lien "Mot de passe oublié"
  └── P1-3 : Indicateurs champs requis (*)
  └── P1-4 : cursor-pointer global
  └── P1-5 : Spinner sur submit

Sprint 3 (polish)
  └── P2-4 : aria-live sur CountdownTimer urgent
  └── P2-6 : Pause marquee au hover/focus
  └── P2-8 : Guard données mockées
```
