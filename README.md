# KonfiturGame

Plateforme web française d'organisation de **game jams** — des compétitions de création de jeux vidéo limitées dans le temps.

## Contexte

KonfiturGame est né d'un besoin de la communauté **FRVtubers** (VTubers francophones) : disposer d'un outil dédié pour organiser des game jams en français, sans dépendre de plateformes anglophones comme itch.io ou Ludum Dare.

Le projet est développé dans le cadre d'une formation en développement d'applications logicielles. Il couvre l'intégralité du cycle de vie d'un logiciel : cadrage, conception, développement, déploiement et maintenance.

## Ce que fait KonfiturGame

- **Organiser des game jams** — Créer une jam avec un thème, des règles, des dates et des prix
- **Guildes multi-jam** — Créer ou rejoindre une équipe persistante (guilde) réutilisable sur plusieurs jams, via un code d'invitation unique
- **Collaborer en temps réel** — Chat intégré avec WebSocket (channels : general, team-search, help)
- **Soumettre des projets** — Uploader son jeu avec screenshots, technologies et liens
- **Voter et commenter** — Système de votes et commentaires sur les projets soumis
- **Gérer son profil** — Modifier son nom, sa bio, son mot de passe, supprimer son compte
- **Administrer** — Panel admin avec modération du chat, gestion des utilisateurs, logs d'audit et ban IP

## Stack technique

| Couche | Technologie |
|--------|------------|
| Frontend | Next.js 16.2.3 (App Router), React 18, TypeScript strict |
| Styles | Tailwind CSS v4, design system dark tricolore (CSS variables) |
| Backend | Appwrite 1.8.0 self-hosted (Auth, Database, Realtime, Storage) |
| Base de données | MariaDB 10.11 (via Appwrite) |
| Cache / Realtime | Redis 7 |
| Reverse proxy | Traefik v3.6.7 (TLS Let's Encrypt, rate limiting, security headers) |
| Conteneurisation | Docker Compose (8 services) |
| Tests | Vitest 2.x + V8 coverage |
| Package manager | pnpm |

## Architecture

```
Internet
    │
    ▼
 Traefik (HTTPS, rate limiting, CSP)
    ├── konfiturgame.fr       → Next.js (SSR)
    ├── api.konfiturgame.fr   → Appwrite (API + Console)
    └── api.…/v1/realtime     → Appwrite Realtime (WebSocket)
                                    │
                              ┌─────┴─────┐
                              │           │
                           MariaDB    Redis
                           (isolé)    (isolé)
```

Deux réseaux Docker isolés :
- `konfitur-net` — Traefik ↔ Frontend ↔ Appwrite
- `appwrite-net` — Appwrite ↔ MariaDB ↔ Redis (réseau privé, non exposé)

## Démarrage rapide (dev)

```bash
# 1. Copier les variables d'environnement
cp .env.example .env
# Remplir .env (mots de passe, API key Appwrite, etc.)

# 2. Lancer l'infrastructure
docker compose up

# 3. Initialiser la base de données (après avoir rempli APPWRITE_API_KEY)
./scripts/seed-data.sh
```

Accès en dev :
- Frontend : http://localhost:3000
- Appwrite Console : http://localhost:8080/console
- Traefik Dashboard : http://localhost:8081/dashboard/

## Tests

```bash
# Les tests tournent dans le container (node_modules uniquement dans le container)
docker exec konfitur-frontend sh -c "cd /app && npx vitest run"
```

Couverture actuelle : 47+ tests unitaires répartis sur 6 fichiers.

## Documentation

| Document | Contenu |
|----------|---------|
| [`docs/DOCUMENTATION.md`](docs/DOCUMENTATION.md) | Guide complet : architecture, structure du code, DB, design system |
| [`docs/DATABASE.md`](docs/DATABASE.md) | Schéma ERD de la base de données (Mermaid) |
| [`docs/PRODUCTION.md`](docs/PRODUCTION.md) | Guide de déploiement en production |
| [`docs/TODO.md`](docs/TODO.md) | Roadmap et fonctionnalités à implémenter |
| [`CLAUDE.md`](CLAUDE.md) | Instructions pour l'assistant IA Claude |

## Fonctionnalités implémentées

- [x] Page d'accueil avec stats, countdown, Hall of Fame
- [x] Exploration et filtrage des jams
- [x] Page de détail d'une jam (infos, équipes, projets, annonces, chat)
- [x] Authentification email/mot de passe + OAuth Google & Discord
- [x] Dashboard participant : participations, équipes, profil
- [x] Guildes multi-jam : création, invitation, inscription à plusieurs jams, gestion des rôles
- [x] Soumission de projets par équipe
- [x] Votes et commentaires sur les projets
- [x] Dashboard organisateur : créer/éditer une jam, publier des annonces
- [x] Panel admin : utilisateurs, jams, modération, mise en avant, logs d'audit, ban IP
- [x] Gestion du profil (modifier nom/bio/mot de passe, supprimer le compte)
- [x] Chat temps réel (WebSocket Appwrite Realtime)
- [x] SEO : sitemap dynamique, robots.txt, Open Graph, JSON-LD
- [x] Bot detection & ban IP automatique via middleware

## Contact

KonfiturGame est un projet imaginé et porté par la communauté **[FRVtubers](https://www.youtube.com/@FRVtubers)** — les VTubers francophones.

Pour toute question, suggestion ou signalement :
- Ouvrir une [issue GitHub](../../issues) sur ce dépôt
- Contacter la communauté FRVtubers via leurs réseaux

---

## Pour qui est pensé la plateforme ?

Il y a **4 types d'utilisateurs** sur KonfiturGame :

| Type | Qui ? | Ce qu'il peut faire |
|------|-------|---------------------|
| **Visiteur** | Tout le monde (sans compte) | Voir les jams, les projets, lire les infos |
| **Participant** | Toute personne inscrite | Rejoindre des jams, former des équipes, voter |
| **Organisateur** | Participant qui crée une jam | Créer et gérer des jams |
| **Administrateur** | Équipe KonfiturGame | Modérer, gérer utilisateurs, configurer la plateforme |

---

## Guide Visiteur (sans compte)

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

## Guide Participant

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

## Guide Organisateur de Jam

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

## Guide Administrateur

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

## User Stories complètes

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

## Contributing

Les contributions sont les bienvenues ! Voici comment participer :

### Signaler un bug
Ouvrir une [issue](../../issues) avec :
- Une description claire du problème
- Les étapes pour reproduire
- La version du navigateur / OS

### Proposer une fonctionnalité
Ouvrir une [issue](../../issues) avec le label `enhancement` et décrire le besoin concret.

---

*KonfiturGame — Projet FRVtubers & Setsuko_Aka · Licence à définir*
