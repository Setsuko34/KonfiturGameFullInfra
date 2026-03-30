# KonfiturGame — Documentation Complète

> Plateforme française de Game Jams — Guide complet pour utilisateurs et développeurs

---

## Table des matières

1. [C'est quoi KonfiturGame ?](#1-cest-quoi-konfiturgame-)
2. [Qui utilise la plateforme ?](#2-qui-utilise-la-plateforme-)
3. [Guide Visiteur (sans compte)](#3-guide-visiteur-sans-compte)
4. [Guide Participant](#4-guide-participant)
5. [Guide Organisateur de Jam](#5-guide-organisateur-de-jam)
6. [Guide Administrateur](#6-guide-administrateur)
7. [User Stories complètes](#7-user-stories-complètes)
8. [Architecture technique](#8-architecture-technique)
9. [Carte du code — Où trouver quoi](#9-carte-du-code--où-trouver-quoi)
10. [Design System](#10-design-system)
11. [Base de données — Collections](#11-base-de-données--collections)
12. [Choix architecturaux expliqués](#12-choix-architecturaux-expliqués)
13. [Démarrer le projet (développeur)](#13-démarrer-le-projet-développeur)

---

## 1. C'est quoi KonfiturGame ?

KonfiturGame est une **plateforme de Game Jams en français**.

### Qu'est-ce qu'une Game Jam ?

Imagine un marathon de création de jeux vidéo. Des gens se retrouvent, et en un temps limité (48h, 72h, une semaine…), ils créent un jeu autour d'un thème commun. C'est un concours créatif, mais l'esprit est avant tout de partager et d'apprendre.

### Ce que fait KonfiturGame

- **Lister** les Game Jams disponibles (à venir, en cours, terminées)
- **Permettre** aux participants de s'inscrire et former des équipes
- **Héberger** le chat en direct pendant les jams
- **Afficher** les projets soumis et permettre les votes
- **Donner** aux organisateurs un outil pour créer et gérer leur jam
- **Fournir** aux administrateurs un panel de modération complet

---

## 2. Qui utilise la plateforme ?

Il y a **4 types d'utilisateurs** sur KonfiturGame :

| Type | Qui ? | Ce qu'il peut faire |
|------|-------|---------------------|
| **Visiteur** | Tout le monde (sans compte) | Voir les jams, les projets, lire les infos |
| **Participant** | Toute personne inscrite | Rejoindre des jams, former des équipes, voter |
| **Organisateur** | Participant qui crée une jam | Créer et gérer des jams |
| **Administrateur** | Équipe KonfiturGame | Modérer, gérer utilisateurs, configurer la plateforme |

---

## 3. Guide Visiteur (sans compte)

Tout le monde peut accéder aux pages publiques **sans créer de compte**.

### Page d'accueil — `/`

C'est la première page qu'on voit. Elle contient :

- **Le slogan** : "CRÉE. JAM. SHIP_" — l'esprit du site en 3 mots
- **2 boutons** : "Commencer gratuitement" (→ inscription) et "Explorer les jams"
- **Statistiques défilantes** : nombre de jams organisées, participants, projets soumis, pays représentés
- **La jam en cours** : avec un countdown (compte à rebours) en temps réel
- **Les jams à venir** : grille de cards
- **4 blocs de statistiques** : chiffres clés de la plateforme
- **Le Hall of Fame** : les gagnants des jams précédentes

### Explorer les jams — `/explore`

La bibliothèque complète de toutes les jams.

- **Barre de recherche** : chercher par titre, thème ou tag
- **Filtres à gauche** (desktop) ou dans un drawer (mobile) :
  - Par statut : Toutes, En cours, À venir, Terminées
  - Par type : Tous, Solo, Équipe, Solo & Équipe
- **Compteur de résultats** affiché en temps réel
- **État vide** si aucun résultat

### Détail d'une Jam — `/jam/[jamId]`

La page d'une jam spécifique. Elle contient des **onglets** :

| Onglet | Contenu |
|--------|---------|
| **Informations** | Règles numérotées, Prix (médailles) |
| **Équipes** | Liste des équipes inscrites |
| **Projets** | Projets soumis, avec vote possible si connecté |
| **Annonces** | Annonces officielles de l'organisateur |
| **Chat** | Chat en direct, 3 canaux (Général, Cherche équipe, Aide) |

Sur le côté : organisateur, tags, dates de début/fin, type de jam.

### Détail d'un Projet — `/project/[projectId]`

La page d'un projet soumis pendant une jam.

- Titre, description, technologies utilisées
- Boutons : **Voter**, Télécharger, Code source (GitHub)
- Screenshots si disponibles
- Commentaires (lecture libre, écriture si connecté)

### Détail d'une Équipe — `/team/[teamId]`

- Nom de l'équipe, nombre de membres
- Code d'invitation (pour rejoindre)
- Liste des membres avec leur rôle (dev, artiste, son, designer, auteur)
- Lien vers le projet de l'équipe

### Pages d'auth — `/auth/login` et `/auth/register`

- Connexion via **email/mot de passe**
- Connexion via **OAuth** : Google ou Discord (1 clic)
- Inscription : nom, email, mot de passe

---

## 4. Guide Participant

Un participant est un utilisateur **connecté** qui prend part aux jams.

### S'inscrire et se connecter

1. Aller sur `/auth/register`
2. Remplir : nom d'utilisateur, email, mot de passe
3. Ou cliquer "Continuer avec Google / Discord" pour une connexion rapide
4. Une fois connecté, le Header affiche les liens Dashboard et Déconnexion

### Le Dashboard — Vue d'ensemble `/dashboard`

Le tableau de bord personnel. On y voit :

- **Participations** : combien de jams rejointes
- **Projets soumis** : combien de projets envoyés
- **Jams organisées** : si on en a créé
- **Jam en cours** : si une jam est active, countdown + lien pour la rejoindre

### Mes Participations — `/dashboard/participations`

La liste de toutes les jams auxquelles on participe.

- Chaque card montre : statut (badge coloré), titre, thème, dates
- Cliquer sur une card mène à la page de la jam
- Si aucune participation : message "Tu n'as pas encore rejoint de jam" avec un lien pour explorer

### Mon Équipe — `/dashboard/team`

L'équipe active (dans la jam en cours).

- Nom de l'équipe
- Code d'invitation à partager pour recruter
- Liste des membres avec leurs rôles et le badge "Chef d'équipe"
- Si pas d'équipe : message pour en rejoindre ou en créer une

### Comment rejoindre une Jam ?

1. Aller sur la page de la jam (`/jam/[jamId]`)
2. Cliquer sur "Participer" (visible si connecté et jam `upcoming` ou `ongoing`)
3. Choisir : **rejoindre une équipe** (avec code) ou **créer une équipe**

### Comment rejoindre une Équipe ?

1. Obtenir le code d'invitation de l'équipe (ex: `KG-ABC12345`)
2. L'entrer dans le formulaire "Rejoindre avec un code"
3. Choisir son rôle : Développeur, Artiste, Compositeur, Designer, Auteur
4. Cliquer "Rejoindre"

### Comment voter pour un projet ?

1. Aller sur la page d'un projet (`/project/[projectId]`)
2. Cliquer le bouton "Voter" (pouce levé)
3. Un seul vote par projet par utilisateur est autorisé

---

## 5. Guide Organisateur de Jam

Un organisateur est un participant qui crée et gère des jams.

> N'importe quel utilisateur connecté peut créer une jam !

### Créer une Jam — `/dashboard/my-jams/new`

Un formulaire en plusieurs sections :

**Informations de base :**
- Titre de la jam (obligatoire)
- Slug (généré automatiquement depuis le titre, modifiable)
- Thème (obligatoire) — ex: "Dualité", "Limites"
- Description complète (obligatoire)

**Paramètres :**
- Type : Solo uniquement / Équipe uniquement / Les deux
- Date de début (obligatoire)
- Date de fin (obligatoire)

**Règles :** (liste dynamique)
- Ajouter autant de règles que voulu avec le bouton "+"
- Retirer une règle avec le bouton "-"

**Prix :** (liste dynamique)
- Définir les récompenses (ex: "1ère place : 100€", "Coup de cœur du jury")

**Tags :** (séparés par virgules)
- ex: `pixel-art, rpg, horror`

Cliquer "Créer la jam" → redirection vers la liste des jams.

### Gérer mes Jams — `/dashboard/my-jams`

La liste de toutes les jams créées, en tableau :

| Colonne | Description |
|---------|-------------|
| Titre & Thème | Nom + sous-titre thème |
| Statut | Badge : À venir (bleu), En cours (vert), Terminée (gris) |
| Date de fin | Quand se termine la jam |
| Actions | Bouton "Gérer" |

### Gérer une Jam spécifique — `/dashboard/my-jams/[jamId]`

La page de gestion d'une jam créée :

- **En-tête** : titre, thème
- **Stats rapides** : nombre d'équipes inscrites, nombre de projets soumis
- **Liste des équipes** : nom + code d'invitation de chaque équipe
- **Liste des projets soumis** : titre, votes, date de soumission

---

## 6. Guide Administrateur

Les administrateurs ont accès au **panel d'administration** via `/admin`. L'accès est réservé aux membres de l'équipe admin dans Appwrite (`ADMIN_TEAM_ID`).

> Si quelqu'un qui n'est pas admin essaie d'accéder à `/admin`, il reçoit une page 404 — la plateforme ne révèle même pas que cette section existe.

### Vue d'ensemble Admin — `/admin`

4 blocs de statistiques clés :
- Utilisateurs totaux
- Jams totales
- Jams actives en ce moment
- Signalements en attente (badge rouge urgent si > 0)

Actions rapides : "Voir les signalements", "Nouvelle annonce"

### Gestion des Utilisateurs — `/admin/users`

- **Recherche** par nom ou email
- **Tableau** : Nom, Email (masqué sur mobile), Statut, Actions
- **Statut** : Actif (vert) ou Bloqué (rouge)
- **Actions** :
  - Bloquer un utilisateur (il ne peut plus se connecter)
  - Débloquer un utilisateur
- **Pagination** : 25 utilisateurs par page

### Gestion des Jams — `/admin/jams`

- **Filtres** : Toutes, À venir, En cours, Terminées
- **Tableau** : Titre (⭐ si featured), Statut, Date de fin, Actions
- **Actions** :
  - Mettre en avant (⭐) ou retirer de la mise en avant
  - Supprimer une jam (avec confirmation)

### Modération — `/admin/moderation`

Deux sections :

**Messages signalés :**
- Affichage : auteur, date, contenu du message
- Actions : Supprimer le message / Marquer comme résolu (garder le message)

**Projets signalés :**
- Affichage : titre, description
- Action : Marquer comme résolu

### Mise en Avant & Gagnants — `/admin/featured`

Deux fonctions en une page :

**Mise en avant des jams :**
- Grid de toutes les jams
- Toggle "Featured" (met la jam en avant sur la page d'accueil)
- Bouton "Gagnants" pour aller désigner les gagnants

**Désignation des gagnants :**
- Sélectionner une jam → affiche tous ses projets
- Toggle "Gagnant" (icône trophée) sur chaque projet
- Ces projets apparaissent dans le Hall of Fame de l'accueil

### Annonces Globales — `/admin/announcements`

**Créer une annonce :**
- Titre de l'annonce
- Contenu (texte)
- Ciblage : jam spécifique (optionnel, sinon annonce globale)
- Case "Important" (affiche un badge rouge dans la jam)

**Liste des annonces publiées :**
- Titre, badge Important, jam ciblée, date
- Bouton "Supprimer"

---

## 7. User Stories complètes

### Visiteur

- En tant que visiteur, je veux voir les jams en cours pour savoir si je peux encore m'inscrire
- En tant que visiteur, je veux filtrer les jams par statut pour trouver des jams à venir
- En tant que visiteur, je veux voir les projets d'une jam terminée pour m'inspirer
- En tant que visiteur, je veux voir le Hall of Fame pour découvrir les meilleurs projets
- En tant que visiteur, je veux m'inscrire rapidement via Google ou Discord

### Participant

- En tant que participant, je veux rejoindre une jam pour participer au défi créatif
- En tant que participant, je veux créer une équipe pour collaborer avec d'autres
- En tant que participant, je veux partager mon code d'invitation pour recruter des coéquipiers
- En tant que participant, je veux rejoindre une équipe existante avec un code pour collaborer
- En tant que participant, je veux chatter en direct dans la jam pour communiquer
- En tant que participant, je veux chatter dans le canal "Cherche équipe" pour trouver des coéquipiers
- En tant que participant, je veux voir le countdown de la jam pour gérer mon temps
- En tant que participant, je veux voir mes participations passées pour suivre mon historique
- En tant que participant, je veux voter pour les projets qui m'ont impressionné
- En tant que participant, je veux commenter les projets pour donner du feedback

### Organisateur

- En tant qu'organisateur, je veux créer une jam avec un thème et des règles personnalisés
- En tant qu'organisateur, je veux définir une durée et des dates précises pour ma jam
- En tant qu'organisateur, je veux voir en temps réel combien d'équipes ont rejoint ma jam
- En tant qu'organisateur, je veux publier des annonces pour informer les participants
- En tant qu'organisateur, je veux voir quels projets ont été soumis à ma jam
- En tant qu'organisateur, je veux définir des prix pour motiver les participants

### Administrateur

- En tant qu'admin, je veux voir les statistiques globales de la plateforme
- En tant qu'admin, je veux bloquer un utilisateur qui enfreint les règles
- En tant qu'admin, je veux modérer les messages signalés pour maintenir la qualité
- En tant qu'admin, je veux mettre en avant certaines jams sur la page d'accueil
- En tant qu'admin, je veux désigner les gagnants d'une jam terminée
- En tant qu'admin, je veux publier des annonces globales pour toute la plateforme
- En tant qu'admin, je veux supprimer une jam problématique

---

## 8. Architecture technique

### Vue d'ensemble

```
Internet → Traefik (reverse proxy)
                ↓
         Next.js Frontend ←→ Appwrite (BaaS)
                                    ↓
                              MariaDB + Redis
```

### Stack technique

| Composant | Technologie | Version |
|-----------|------------|---------|
| Frontend | Next.js (App Router) | 14 |
| Langage | TypeScript | Strict |
| CSS | Tailwind CSS | v4 |
| Backend | Appwrite (self-hosted) | 1.5 |
| Reverse proxy | Traefik | v3.6.7 |
| Orchestration | Docker Compose | v2 |
| Base de données | MariaDB | via Appwrite |
| Cache/Queue | Redis | via Appwrite |
| Package manager | pnpm | — |

### Flux de données

```
Utilisateur (browser)
    │
    ├── Page publique → Server Component → Appwrite (lecture)
    │
    ├── Action (formulaire) → Server Action → Appwrite (écriture)
    │
    └── Chat temps réel → useRealtimeChat hook → Appwrite Realtime (WebSocket)
```

### Environnements

**Développement** (`docker compose up`) :

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Appwrite Console | http://localhost:8080/console |
| Appwrite API | http://localhost:8080/v1 |
| Traefik Dashboard | http://localhost:8081/dashboard/ |

**Production** (sans override) :

| URL | Service |
|-----|---------|
| https://konfiturgame.fr | Frontend |
| https://api.konfiturgame.fr | Appwrite |
| https://traefik.konfiturgame.fr | Dashboard Traefik |

---

## 9. Carte du code — Où trouver quoi

### Principe de navigation

Le code est dans `frontend/src/`. Il est organisé en 5 grandes zones :

```
frontend/src/
├── app/          → Les PAGES (routes URL)
├── components/   → Les COMPOSANTS réutilisables
├── lib/          → La LOGIQUE (Appwrite, actions)
├── hooks/        → Les HOOKS React
└── types/        → Les TYPES TypeScript
```

### Carte des Pages (`app/`)

| Je veux modifier... | Je modifie... |
|---------------------|---------------|
| La page d'accueil | `app/page.tsx` |
| Le header/footer | `components/Header.tsx` et `components/Footer.tsx` |
| La page Explorer | `app/explore/page.tsx` |
| Une page de jam | `app/jam/[jamId]/page.tsx` |
| Une page de projet | `app/project/[projectId]/page.tsx` |
| Une page d'équipe | `app/team/[teamId]/page.tsx` |
| La page de connexion | `app/auth/login/page.tsx` |
| La page d'inscription | `app/auth/register/page.tsx` |
| Le dashboard (accueil) | `app/dashboard/page.tsx` |
| Mes participations | `app/dashboard/participations/page.tsx` |
| Mon équipe | `app/dashboard/team/page.tsx` |
| Mes jams (liste) | `app/dashboard/my-jams/page.tsx` |
| Créer une jam | `app/dashboard/my-jams/new/page.tsx` |
| Gérer une jam | `app/dashboard/my-jams/[jamId]/page.tsx` |
| Layout dashboard | `app/dashboard/layout.tsx` |
| Sidebar dashboard | `app/dashboard/DashboardSidebar.tsx` |
| Admin — Accueil | `app/admin/page.tsx` |
| Admin — Utilisateurs | `app/admin/users/page.tsx` |
| Admin — Jams | `app/admin/jams/page.tsx` |
| Admin — Modération | `app/admin/moderation/page.tsx` |
| Admin — Mise en avant | `app/admin/featured/page.tsx` |
| Admin — Annonces | `app/admin/announcements/page.tsx` |
| Layout admin | `app/admin/layout.tsx` |
| Sidebar admin | `app/admin/AdminSidebar.tsx` |
| Page 404 | `app/not-found.tsx` |
| Gestion erreurs | `app/error.tsx` |

### Carte de la Logique (`lib/actions/`)

| Je veux modifier... | Je modifie... |
|---------------------|---------------|
| Données du dashboard | `lib/actions/dashboard.ts` |
| CRUD des jams | `lib/actions/jams.ts` |
| CRUD des équipes | `lib/actions/teams.ts` |
| CRUD des projets | `lib/actions/projects.ts` |
| Chat (messages) | `lib/actions/chat.ts` |
| Toutes les actions admin | `lib/actions/admin.ts` |

### Carte Appwrite (`lib/appwrite/`)

| Je veux modifier... | Je modifie... |
|---------------------|---------------|
| IDs des collections | `lib/appwrite/config.ts` |
| Client browser (pages 'use client') | `lib/appwrite/client.ts` |
| Client serveur (Server Actions) | `lib/appwrite/server.ts` |
| Mappers Appwrite → Types | `lib/appwrite/types.ts` |
| Lecture session | `lib/appwrite/session.ts` |

### Carte des Composants (`components/`)

| Composant | Rôle |
|-----------|------|
| `Header.tsx` | Barre de navigation principale (sticky) |
| `Footer.tsx` | Pied de page |
| `JamCard.tsx` | Card d'une jam (utilisée dans les grilles) |
| `JamChat.tsx` | Chat temps réel (3 canaux) |
| `CountdownTimer.tsx` | Compte à rebours dynamique |
| `MarqueeStats.tsx` | Stats défilantes (page d'accueil) |
| `StatBlock.tsx` | Bloc de statistique avec icône |
| `WinnerCard.tsx` | Card d'un projet gagnant |
| `EmptyState.tsx` | Message "pas de résultats" réutilisable |
| `providers/AuthProvider.tsx` | Contexte d'authentification global |

### Carte de la Protection des routes

La protection est dans **`middleware.ts`** à la racine de `src/` :

```
/dashboard/* → Vérifie cookie session Appwrite → Si absent, redirige /auth/login
/admin/*     → Vérifie cookie session Appwrite → Si absent, redirige /auth/login
              → Le layout admin vérifie aussi l'appartenance à l'équipe admin
```

### Carte des Types (`types/index.ts`)

```typescript
GameJam     → Une jam (titre, dates, statut, type, règles...)
Team        → Une équipe (nom, code, membres...)
TeamMember  → Un membre (userId, rôle, chef d'équipe...)
Project     → Un projet soumis (titre, technos, votes...)
Comment     → Un commentaire sur un projet
ChatMessage → Un message de chat (canal, auteur, contenu...)
Announcement → Une annonce officielle
PastWinner  → Un gagnant (pour le Hall of Fame)
SiteStats   → Statistiques globales de la plateforme
```

---

## 10. Design System

### Palette de couleurs

Tout le design est basé sur des **variables CSS**. Ne jamais utiliser les codes hex directement dans le code.

| Variable CSS | Valeur | Utilisation |
|-------------|--------|-------------|
| `--background` | `#0C1018` | Fond principal (noir bleuté) |
| `--card` | `#131921` | Fond des cards |
| `--foreground` | `#FFFFFF` | Texte principal |
| `--muted-foreground` | `#9CA3AF` | Texte secondaire (gris) |
| `--border` | `#2D3139` | Bordures |
| `--primary` | `#4F6AFF` | Couleur principale (bleu) |
| `--secondary` | `#EF233C` | Couleur d'accent (rouge) |
| `--success` | `#10B981` | Succès (vert) |
| `--muted` | `#1F2335` | Fonds légèrement plus clairs |

### Règles de style

1. **Zéro border-radius** — Tout est carré. La variable `--radius: 0px` est définie partout.
2. **Couleurs via `style={}`** — Les couleurs du design system passent en inline style, pas en classes Tailwind
3. **Layout via classes Tailwind** — `flex`, `grid`, `gap`, `p-`, `m-` etc.
4. **Typographie** — Space Grotesk (`--font-sans`) pour le texte, JetBrains Mono (`--font-mono`) pour le code
5. **Icônes** — Lucide React exclusivement (import `{ IconName } from 'lucide-react'`)

### Exemple de code correct

```tsx
// ✅ Correct
<div
  className="flex items-center gap-3 p-4 mb-4"
  style={{ background: 'var(--card)', borderLeft: '2px solid var(--primary)' }}
>
  <span style={{ color: 'var(--primary)' }}>Texte principal</span>
</div>

// ❌ Incorrect (couleur hardcodée)
<div className="bg-[#131921] rounded-lg border-blue-500">

// ❌ Incorrect (rounded = border-radius)
<div className="rounded-md bg-card">
```

---

## 11. Base de données — Collections

### Schéma global

```
game_jams
    │
    ├── teams (jam_id)
    │       └── team_members (team_id)
    │
    ├── projects (jam_id, team_id)
    │       ├── votes (project_id)
    │       └── comments (project_id)
    │
    ├── chat_messages (jam_id)
    │
    └── announcements (jam_id)
```

### Détail des collections

#### `game_jams`
| Champ | Type | Description |
|-------|------|-------------|
| `title` | String | Titre de la jam |
| `slug` | String | URL-friendly identifier |
| `theme` | String | Thème du défi |
| `description` | String | Description complète |
| `status` | Enum | `upcoming`, `ongoing`, `ended` |
| `type` | Enum | `solo`, `team`, `both` |
| `start_date` | DateTime | Date de début |
| `end_date` | DateTime | Date de fin |
| `duration` | String | Durée lisible (ex: "72h") |
| `participants` | Integer | Nombre de participants |
| `max_participants` | Integer | Limite (optionnel) |
| `rules[]` | String[] | Liste des règles |
| `prizes[]` | String[] | Liste des prix |
| `tags[]` | String[] | Tags de catégorie |
| `organizer` | String | Nom de l'organisateur |
| `organizer_id` | String | ID Appwrite de l'organisateur |
| `cover_image_id` | String | ID fichier dans le bucket |
| `featured` | Boolean | Mis en avant sur l'accueil |
| `featured_order` | Integer | Ordre d'affichage |

#### `teams`
| Champ | Type | Description |
|-------|------|-------------|
| `jam_id` | String | Référence à la jam |
| `name` | String | Nom de l'équipe |
| `invite_code` | String | Code unique (ex: `KG-ABC12345`) |
| `leader_id` | String | ID de l'utilisateur chef |
| `project_id` | String | ID du projet soumis (optionnel) |

#### `team_members`
| Champ | Type | Description |
|-------|------|-------------|
| `team_id` | String | Référence à l'équipe |
| `user_id` | String | ID Appwrite de l'utilisateur |
| `name` | String | Nom affiché |
| `role` | Enum | `dev`, `artist`, `sound`, `designer`, `writer` |
| `is_leader` | Boolean | Est le chef d'équipe ? |
| `avatar_url` | String | URL avatar (optionnel) |

#### `projects`
| Champ | Type | Description |
|-------|------|-------------|
| `jam_id` | String | Référence à la jam |
| `team_id` | String | Référence à l'équipe |
| `title` | String | Titre du projet/jeu |
| `description` | String | Description |
| `technologies[]` | String[] | Technos utilisées |
| `download_url` | String | Lien de téléchargement |
| `repo_url` | String | Lien GitHub/GitLab |
| `submitted` | Boolean | Soumis officiellement ? |
| `submission_date` | DateTime | Quand soumis |
| `votes_count` | Integer | Nombre de votes reçus |
| `cover_image_id` | String | Image principale |
| `screenshot_ids[]` | String[] | IDs captures d'écran |
| `reported` | Boolean | Signalé pour modération |
| `winner` | Boolean | Désigné gagnant par admin |

#### `chat_messages`
| Champ | Type | Description |
|-------|------|-------------|
| `jam_id` | String | Dans quelle jam |
| `channel` | Enum | `general`, `team-search`, `help` |
| `author_id` | String | ID de l'auteur |
| `author_name` | String | Nom affiché |
| `content` | String | Contenu du message (max 2048 chars) |
| `role` | Enum | `user`, `organizer`, `moderator` |
| `pinned` | Boolean | Message épinglé |
| `reported` | Boolean | Signalé pour modération |

#### `announcements`
| Champ | Type | Description |
|-------|------|-------------|
| `jam_id` | String | Jam ciblée (optionnel = global) |
| `title` | String | Titre de l'annonce |
| `content` | String | Contenu |
| `important` | Boolean | Affiche badge rouge "Important" |
| `author_id` | String | ID de l'auteur |
| `author_name` | String | Nom affiché |

#### `votes`
| Champ | Type | Description |
|-------|------|-------------|
| `project_id` | String | Projet voté |
| `user_id` | String | Qui a voté |

#### `comments`
| Champ | Type | Description |
|-------|------|-------------|
| `project_id` | String | Projet commenté |
| `author_id` | String | ID de l'auteur |
| `author_name` | String | Nom affiché |
| `content` | String | Contenu du commentaire |

### Buckets de fichiers

| Bucket | Contenu |
|--------|---------|
| `jam-covers` | Images de couverture des jams |
| `project-assets` | Images et assets des projets |
| `avatars` | Avatars des utilisateurs |

---

## 12. Choix architecturaux expliqués

### Pourquoi Next.js App Router ?

Next.js 14 avec l'App Router permet d'avoir des **Server Components** par défaut. Ça veut dire que la majorité du code s'exécute côté serveur : les pages chargent plus vite, le SEO est meilleur, et les données Appwrite sont appelées directement côté serveur sans exposer les clés API.

Seuls les composants interactifs (chat, formulaires dynamiques, explore avec filtres) utilisent `'use client'`.

### Pourquoi Appwrite plutôt qu'une API custom ?

Appwrite est un **Backend-as-a-Service** (BaaS) auto-hébergé. Il fournit "gratuitement" :
- Authentification (email, OAuth Google/Discord)
- Base de données avec permissions granulaires
- Stockage de fichiers
- Realtime (WebSockets)
- Gestion d'équipes (utilisé pour les admins)

Ça évite d'écrire une API REST complète. La logique métier est dans les **Server Actions** Next.js qui appellent l'SDK Appwrite serveur.

### Pourquoi Traefik ?

Traefik est un **reverse proxy** qui gère :
- Le routage des requêtes vers le bon service (frontend ou appwrite)
- Les certificats TLS automatiques (Let's Encrypt) en production
- Les middlewares de sécurité (headers HTTP, rate limiting, compression)

### Server Actions vs API Routes

Le projet utilise des **Server Actions** plutôt que des API Routes traditionnelles. Les avantages :
- Appel direct depuis les Server Components ou les formulaires
- Pas besoin de `fetch('/api/...')` + gestion des erreurs HTTP
- TypeScript end-to-end (même types partagés)
- Invalidation du cache Next.js intégrée (`revalidatePath`)

### Deux clients Appwrite

Il y a intentionnellement deux façons d'accéder à Appwrite :

1. **`client.ts`** (browser) — utilisé dans les pages `'use client'`. Utilise la session de l'utilisateur. Ne contient pas la clé API admin.

2. **`server.ts`** (serveur) — utilisé dans les Server Actions. Utilise la clé API admin (`APPWRITE_API_KEY`). Cette clé n'est jamais envoyée au browser.

### Protection admin en deux couches

L'accès `/admin` est protégé à deux niveaux :
1. **Middleware** (`middleware.ts`) — vérifie qu'on est connecté
2. **Layout admin** (`app/admin/layout.tsx`) — vérifie qu'on est membre de l'équipe admin dans Appwrite

Si le layout échoue, il appelle `notFound()` (retourne 404). Ça évite de révéler l'existence du panel admin aux non-admins.

### CSS Variables plutôt que Tailwind pour les couleurs

Les couleurs du design system sont des CSS variables, pas des classes Tailwind. Raison : la cohérence du thème. Si on veut changer le bleu primaire, on change une seule variable CSS et tout le site change d'un coup. Avec des classes Tailwind codées partout, ce serait une recherche-remplacement globale risquée.

### Zero border-radius

Un choix esthétique fort qui définit l'identité visuelle de KonfiturGame : des angles droits, une esthétique "technique" et "game dev". Tous les éléments UI sont des rectangles parfaits.

---

## 13. Démarrer le projet (développeur)

### Prérequis

- Docker et Docker Compose v2 installés
- pnpm installé (ou Node.js pour l'installer)

### 1. Cloner et configurer

```bash
# Copier le template des variables d'environnement
cp .env.example .env

# Éditer .env avec vos valeurs (voir .env.example pour les commentaires)
nano .env
```

### 2. Démarrer l'environnement

```bash
docker compose up
```

Cela démarre : frontend (hot-reload), appwrite, traefik, mariadb, redis.

### 3. Initialiser Appwrite

1. Ouvrir http://localhost:8080/console
2. Créer un compte admin
3. Créer un projet avec l'ID `konfiturgame` (ou celui dans `.env`)
4. Récupérer la clé API dans Appwrite Console → API Keys
5. Ajouter la clé dans `.env` : `APPWRITE_API_KEY=...`

```bash
# Initialiser les collections et buckets
bash scripts/init-appwrite.sh

# (Optionnel) Peupler avec des données de test
cd frontend && npx tsx ../scripts/seed-data.ts
```

### 4. Commandes utiles

```bash
# Démarrer
docker compose up

# Build frontend seul
cd frontend && pnpm build

# Vérifier les types TypeScript
cd frontend && pnpm type-check

# Linter
cd frontend && pnpm lint

# Backup des données
bash scripts/backup.sh

# Restaurer un backup
bash scripts/restore.sh
```

### 5. Structure des variables d'environnement

Voir `.env.example` pour la liste complète. Les variables clés :

| Variable | Description | Obligatoire |
|----------|-------------|-------------|
| `NEXT_PUBLIC_APPWRITE_ENDPOINT` | URL Appwrite (browser) | Oui |
| `NEXT_PUBLIC_APPWRITE_PROJECT_ID` | ID du projet Appwrite | Oui |
| `APPWRITE_API_KEY` | Clé API admin (serveur uniquement) | Oui |
| `APPWRITE_INTERNAL_ENDPOINT` | URL Appwrite interne Docker | Oui |
| `NEXT_PUBLIC_SITE_URL` | URL du site | Oui |
| `ADMIN_EMAIL` | Email admin Traefik | Production |

### 6. Pièges connus

| Problème | Solution |
|----------|----------|
| `new URL()` crash | Le fallback doit contenir `http://`, pas juste `'localhost'` |
| `getaddrinfo for redis failed` | Déclarer `networks:` explicitement dans l'override |
| `pnpm-lock.yaml` erreur EACCES | Générer dans `/tmp` (voir commande dans CLAUDE.md) |
| Admin inaccessible | Vérifier `ADMIN_TEAM_ID` dans `config.ts` et l'appartenance à l'équipe dans Appwrite |

---

## Annexe — Flux complets illustrés

### Flux : Créer et rejoindre une jam

```
Organisateur                    Plateforme                    Participant
     │                              │                              │
     ├──/dashboard/my-jams/new──→  Formulaire                     │
     ├──Rempli titre, thème, dates─→│                             │
     ├──Submit createJam()─────────→│                             │
     │                         Appwrite (game_jams créé)          │
     │                              │                             │
     │                         /jam/[jamId] visible               │
     │                              │←──── Visiteur voit la jam ──┤
     │                              │                             │
     │                              │←─── Participant clique ─────┤
     │                              │     "Rejoindre"              │
     │                              │←─── createTeam() ───────────┤
     │                              │   (Appwrite: teams créé)     │
     │                              │                             │
     │                    code d'invitation généré                 │
     │                              │──── Code partagé ──────────→│
     │                              │←──── joinTeamByCode() ──────┤
     │                              │  (team_members ajouté)       │
```

### Flux : Soumettre et voter pour un projet

```
Équipe                          Plateforme                    Communauté
  │                                 │                              │
  ├──submitProject() ──────────────→│                             │
  │  (submitted: true)           Appwrite                         │
  │                                 │                             │
  │                         Projet visible sur /jam/[id]           │
  │                                 │                             │
  │                                 │←── /project/[id] ──────────┤
  │                                 │←── voteForProject() ────────┤
  │                           votes_count++                        │
  │                                 │                             │
Admin désigne gagnant (winner: true)│                             │
  │                           Hall of Fame                         │
  │                           mis à jour                           │
```

---

*Documentation générée le 2026-03-24 — KonfiturGame v1.0*
