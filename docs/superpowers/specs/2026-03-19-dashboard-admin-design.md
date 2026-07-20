# Design — Dashboard User (redesign) + Backoffice Admin

**Date :** 2026-03-19
**Statut :** Approuvé
**Approche retenue :** Phase 1 (dashboard user) → Phase 2 (admin backoffice)

---

## Contexte

Le dashboard actuel (`/dashboard`) est un écran unique avec des données mockées, sans distinction de rôle, et des sections vides en attente d'Appwrite. Il faut :
1. Différencier clairement "jams rejointes" et "jams organisées" dans le dashboard user
2. Créer un backoffice admin complet sur une route dédiée `/admin`

---

## Décisions de design

| Question | Décision |
|----------|----------|
| Séparation des rôles dans le dashboard user | Sidebar avec deux blocs : PARTICIPANT et ORGANISATEUR |
| Identification admin | Appartenance à la team Appwrite `admins` |
| Création de jam | Tout utilisateur inscrit, publication directe (pas d'approbation) |
| Route backoffice | `/admin` — complètement séparée de `/dashboard` |
| Sections admin | 6 : stats, utilisateurs, jams, modération, annonces, mise en avant |
| Implémentation | 2 phases — user dashboard d'abord, admin ensuite |
| Sécurité `/admin` | Middleware retourne 404 (pas 403) si non-membre team admins |
---

## Architecture & Routes

### Routes publiques (inchangées)
```
/                        — homepage
/explore                 — liste des jams
/jam/[jamId]             — page jam publique
/auth/login              — connexion
/auth/register           — inscription
```

### Dashboard utilisateur — `/dashboard/*`
Accès : cookie session Appwrite `a_session_{projectId}` requis. Middleware identique à aujourd'hui.

```
/dashboard               — vue d'ensemble (stats perso + activité récente)
/dashboard/participations — jams rejointes (actives + passées)
/dashboard/team          — équipe active (membres, rôles, code d'invitation)
/dashboard/my-jams       — jams organisées (liste)
/dashboard/my-jams/new   — formulaire de création de jam
/dashboard/my-jams/[jamId] — gestion d'une jam (participants, soumissions, chat)
```

### Backoffice admin — `/admin/*`
Accès : session valide + membership dans la team Appwrite `admins`.

```
/admin                   — stats globales plateforme + actions rapides
/admin/users             — liste et gestion des utilisateurs
/admin/jams              — toutes les jams (filtres : statut, date)
/admin/moderation        — signalements, suppression de messages/projets
/admin/announcements     — annonces globales ou ciblées par jam
/admin/featured          — curation homepage (jams et projets gagnants)
```

---

## Phase 1 — Dashboard Utilisateur

### Layout sidebar

La sidebar est divisée en deux groupes visuellement séparés par un label et un séparateur :

**Bloc commun (haut) :**
- Logo KonfiturGame + lien `/`
- Nom de l'utilisateur connecté
- Lien "Vue d'ensemble" (`/dashboard`)

**Bloc PARTICIPANT :**
- Mes participations (`/dashboard/participations`)
- Mon équipe (`/dashboard/team`)
- Mes soumissions (sous-section de participations)

**Bloc ORGANISATEUR :**
- Mes jams (`/dashboard/my-jams`)
- + Créer une jam (`/dashboard/my-jams/new`) — mis en avant avec bordure bleue

**Bas de sidebar :**
- Retour au site (`/`)
- Déconnexion

### Contenu de chaque section

**Vue d'ensemble (`/dashboard`) :**
- Stats personnelles : nombre de participations, projets soumis, jams organisées
- Jam en cours avec countdown temps restant
- Feed d'activité récente (5 dernières actions : soumission, rejoindre équipe, créer jam)

**Mes participations (`/dashboard/participations`) :**
- Grille de cards — une par jam rejointe (passées + actives)
- Chaque card : titre, thème, statut (ongoing/ended), bouton "Voir la jam"
- Filtre : En cours / Terminées

**Mon équipe (`/dashboard/team`) :**
- Équipe active : nom, liste des membres avec rôles (dev/artist/sound/designer/writer)
- Code d'invitation de l'équipe (copier en 1 clic)
- Lien vers le projet soumis si existant

**Mes jams (`/dashboard/my-jams`) :**
- Tableau des jams organisées : titre, statut, nb participants, nb soumissions, date de fin
- Actions par ligne : éditer, voir les participants, archiver
- Bouton "Créer une jam" en haut

**Créer une jam (`/dashboard/my-jams/new`) :**
- Formulaire : titre, slug, thème, description, type (solo/équipe/les deux), dates début/fin, règles (liste dynamique), prix (liste dynamique), tags, cover image
- Server Action → `serverDatabases.createDocument()` + `serverStorage.createFile()` pour la cover

**Gérer une jam (`/dashboard/my-jams/[jamId]`) :**
- Onglets : Participants / Équipes / Soumissions / Chat
- Actions : éditer les infos de la jam, clôturer les inscriptions, publier les résultats

### Données Appwrite

Toutes les lectures passent par des Server Actions dans `lib/actions/dashboard.ts` :

```ts
// Jams organisées
serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.GAME_JAMS, [
  Query.equal('organizer_id', userId)
])

// Participations (via team_members)
serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.TEAM_MEMBERS, [
  Query.equal('user_id', userId)
])

// Équipe active
serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.TEAMS, [
  Query.equal('leader_id', userId)  // ou via team_members
])
```

---

## Phase 2 — Backoffice Admin

### Identité visuelle distincte

Pour éviter toute confusion avec le dashboard user :
- Fond sidebar : `#0A0E16` (plus sombre que `#0E1420`)
- Accent couleur : rouge (`var(--secondary)` = `#EF233C`) au lieu de bleu
- Badge "SUPER ADMIN" sous le logo
- Pas de nav bottom bar mobile (backoffice = desktop first)

### Middleware de sécurité

```ts
// middleware.ts — protection /admin
if (pathname.startsWith('/admin')) {
  if (!sessionCookie) return NextResponse.redirect(loginUrl)

  // Vérification team admins côté serveur (Server Action ou appel direct)
  const isMember = await checkAdminTeamMembership(userId)
  if (!isMember) return NextResponse.rewrite(new URL('/not-found', req.url)) // 404, pas 403
}
```

L'ID de la team admin est une constante dans `lib/appwrite/config.ts` : `ADMIN_TEAM_ID = 'admins'`.

### Sections admin

**Vue d'ensemble (`/admin`) :**
- Métriques globales : total users, total jams, jams actives, signalements en attente
- Actions rapides : accès direct aux signalements non résolus, bouton "Nouvelle annonce"

**Utilisateurs (`/admin/users`) :**
- Liste paginée avec recherche par nom/email
- Par utilisateur : voir profil, jams créées/rejointes, bloquer/débloquer le compte
- Assigner/retirer le rôle admin via `serverTeams.createMembership()` / `deleteMembership()`

**Jams (`/admin/jams`) :**
- Tableau de toutes les jams avec filtres (statut, date, organisateur)
- Actions : éditer, supprimer, basculer le statut "featured"
- Vue détaillée d'une jam : participants, soumissions, messages

**Modération (`/admin/moderation`) :**
- File de signalements non résolus (priorité : plus récent d'abord)
- Par signalement : voir le contenu (message ou projet), actions (supprimer, avertir, bannir), marquer comme résolu
- Suppression d'un message : `serverDatabases.deleteDocument(DATABASE_ID, 'chat_messages', messageId)`

**Annonces (`/admin/announcements`) :**
- Formulaire : titre, contenu, ciblage (plateforme entière ou jam spécifique), importance (booléen)
- Crée un document dans la collection `announcements`
- Liste des annonces actives avec option d'archivage

**Mise en avant (`/admin/featured`) :**
- Interface de curation : liste des jams avec toggle "featured"
- Sélection des projets gagnants par jam (mise à jour du statut dans la collection `projects`)
- Ordre d'affichage sur la homepage modifiable (champ `featured_order` à ajouter sur `game_jams`)

### Données Appwrite

Server Actions dans `lib/actions/admin.ts` utilisant `node-appwrite` avec la clé API :

```ts
// Tous les users (admin only)
serverUsers.list([Query.limit(25), Query.offset(page * 25)])

// Tous les signalements (champ `reported: boolean` à ajouter sur chat_messages et projects)
serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.CHAT_MESSAGES, [
  Query.equal('reported', true),
  Query.orderDesc('$createdAt')
])

// Gérer team admins
serverTeams.createMembership(ADMIN_TEAM_ID, [], email, userId, '', '', `${siteUrl}/admin`)
```

---

## Fichiers à créer / modifier

### Phase 1 — Dashboard user
| Fichier | Action |
|---------|--------|
| `app/dashboard/page.tsx` | Refactor complet |
| `app/dashboard/layout.tsx` | Refactor sidebar |
| `app/dashboard/participations/page.tsx` | Créer |
| `app/dashboard/team/page.tsx` | Créer |
| `app/dashboard/my-jams/page.tsx` | Créer |
| `app/dashboard/my-jams/new/page.tsx` | Créer |
| `app/dashboard/my-jams/[jamId]/page.tsx` | Créer |
| `lib/actions/dashboard.ts` | Créer |
| `middleware.ts` | Mettre à jour le matcher |

### Phase 2 — Backoffice admin
| Fichier | Action |
|---------|--------|
| `app/admin/layout.tsx` | Créer |
| `app/admin/page.tsx` | Créer |
| `app/admin/users/page.tsx` | Créer |
| `app/admin/jams/page.tsx` | Créer |
| `app/admin/moderation/page.tsx` | Créer |
| `app/admin/announcements/page.tsx` | Créer |
| `app/admin/featured/page.tsx` | Créer |
| `lib/actions/admin.ts` | Créer |
| `lib/appwrite/config.ts` | Ajouter `ADMIN_TEAM_ID` |
| `middleware.ts` | Ajouter protection `/admin` |

### Schéma Appwrite — champs à ajouter
| Collection | Champ | Type | Usage |
|------------|-------|------|-------|
| `game_jams` | `featured` | boolean | Mise en avant homepage |
| `game_jams` | `featured_order` | integer | Ordre d'affichage |
| `chat_messages` | `reported` | boolean | File de modération |
| `projects` | `reported` | boolean | File de modération |
| `projects` | `winner` | boolean | Sélection gagnants |

---

## Contraintes et conventions

- Package manager : `pnpm` uniquement
- Design system : CSS variables (`var(--primary)`, etc.), `border-radius: 0px` partout, `lucide-react` pour les icônes
- Toutes les dates : `toLocaleDateString('fr-FR')`
- UI entièrement en français
- Appwrite server calls : toujours via `APPWRITE_INTERNAL_ENDPOINT` (réseau Docker interne)
- `APPWRITE_API_KEY` : jamais côté client, jamais préfixé `NEXT_PUBLIC_`
- Accessibilité : `html lang="fr"`, skip-link, hiérarchie h1>h2>h3, `prefers-reduced-motion`
