# KonfiturGame — Manuel d'utilisation

> Guide pour les participants, organisateurs et administrateurs de la plateforme.

---

## Table des matières

1. [Présentation de la plateforme](#1-présentation-de-la-plateforme)
2. [Créer un compte et se connecter](#2-créer-un-compte-et-se-connecter)
3. [Explorer les game jams](#3-explorer-les-game-jams)
4. [Les guildes (équipes)](#4-les-guildes-équipes)
5. [Participer à une game jam](#5-participer-à-une-game-jam)
6. [Soumettre un projet](#6-soumettre-un-projet)
7. [Liker et commenter](#7-liker-et-commenter)
8. [Le chat en direct](#8-le-chat-en-direct)
9. [Gérer son profil](#9-gérer-son-profil)
10. [Rôle Organisateur — Créer et gérer une jam](#10-rôle-organisateur--créer-et-gérer-une-jam)
11. [Rôle Admin — Panneau d'administration](#11-rôle-admin--panneau-dadministration)

---

## 1. Présentation de la plateforme

KonfiturGame est une plateforme française de **game jams** : des compétitions de création de jeux vidéo où des équipes (ou des participants seuls) conçoivent un jeu en un temps limité sur un thème imposé.

### Concepts clés

| Terme | Définition |
|-------|------------|
| **Game jam** | Compétition de création de jeu sur un thème donné, avec une durée limitée (ex : 48h, 72h) |
| **Guilde** | Équipe persistante qui peut s'inscrire à plusieurs jams successives sans se reformer |
| **Projet** | Le jeu soumis par une guilde à la fin d'une jam |
| **Organisateur** | Utilisateur qui crée et gère une jam |
| **Admin** | Utilisateur avec accès au panneau d'administration global |

### Navigation principale

- **Accueil** (`/`) — jams en cours, à venir, résultats, statistiques
- **Explorer** (`/explore`) — toutes les jams, avec filtres par statut
- **Dashboard** (`/dashboard`) — espace personnel (nécessite d'être connecté)

---

## 2. Créer un compte et se connecter

### Créer un compte

1. Cliquer sur **Participer** dans le header (ou **Participer gratuitement** sur mobile)
2. Renseigner un pseudo, une adresse email et un mot de passe
3. Valider le formulaire → connexion automatique et redirection vers l'accueil

### Se connecter

1. Cliquer sur **Se connecter** dans le header
2. Entrer l'email et le mot de passe

**Connexion via Google ou Discord** : cliquer sur le bouton correspondant sur la page de connexion. La première connexion crée automatiquement un compte.

### Se déconnecter

Cliquer sur le bouton **Déconnexion** dans le header (à droite).

---

## 3. Explorer les game jams

### Page d'accueil

La page d'accueil affiche :
- Les **jams en cours** (avec countdown en temps réel)
- Les **jams à venir**
- Les **projets les plus aimés** (classement popularité par likes)
- Les **derniers résultats** (podiums des jams terminées)
- Des statistiques globales (nombre de jams, participants, projets)

### Page Explorer (`/explore`)

Liste toutes les jams avec filtres :
- **En cours** — jams actives maintenant
- **À venir** — jams prochaines
- **Terminées** — archives avec résultats

Cliquer sur une jam pour accéder à sa page de détail.

### Page de détail d'une jam (`/jam/:id`)

Contient :
- Thème, description, dates, durée
- Règles et prix
- Liste des équipes inscrites
- Section chat en direct
- Annonces de l'organisateur

---

## 4. Les guildes (équipes)

Une **guilde** est une équipe persistante — elle peut participer à plusieurs jams successives sans avoir besoin de se reformer à chaque fois.

### Créer une guilde

1. Aller dans **Dashboard → Mon équipe**
2. Cliquer sur **Créer une guilde**
3. Choisir un nom et son rôle (dev, artiste, son, designer, écrivain)
4. La guilde est créée — un **code d'invitation** (`KG-XXXXXXXX`) est généré automatiquement

### Rejoindre une guilde existante

1. Obtenir le code d'invitation auprès du chef de guilde (`KG-XXXXXXXX`)
2. Aller dans **Dashboard → Mon équipe**
3. Cliquer sur **Rejoindre une guilde**
4. Entrer le code et valider

### Gérer sa guilde (chef de guilde uniquement)

Depuis la page **Dashboard → Mon équipe** → carte de la guilde :
- Voir la liste des membres et leurs rôles
- Voir les jams auxquelles la guilde est inscrite
- Accéder au formulaire de soumission de projet
- Gérer les membres

### Code d'invitation

Le code `KG-XXXXXXXX` de la guilde est affiché sur la carte de guilde dans le dashboard. Le partager aux joueurs que l'on veut inviter.

---

## 5. Participer à une game jam

### S'inscrire à une jam (avec une guilde)

Pour participer à une jam, il faut **avoir ou créer une guilde**, puis l'inscrire à la jam.

1. Aller sur la page de détail de la jam (`/jam/:id`)
2. Dans la section **Équipes**, cliquer sur **Inscrire ma guilde**
3. Choisir la guilde à inscrire dans la liste
4. Valider — la guilde apparaît dans la liste des participants

> Un utilisateur ne peut être dans qu'une seule équipe par jam. Si une guilde est déjà inscrite à la jam, ce n'est pas possible d'en inscrire une autre avec le même membre.

### Suivre le déroulé d'une jam

Une fois inscrit, depuis la page de la jam :
- Voir le **countdown** jusqu'à la fin
- Consulter les **annonces** de l'organisateur
- Utiliser le **chat en direct** pour communiquer avec les autres participants
- Soumettre le projet avant la deadline

### Statuts d'une jam

| Statut | Signification |
|--------|---------------|
| `À venir` | La jam n'a pas encore commencé |
| `En cours` | La jam est active — on peut s'inscrire et soumettre |
| `Terminée` | La jam est finie — les likes restent ouverts et le podium (top 3) peut être désigné |

---

## 6. Soumettre un projet

La soumission se fait depuis le **Dashboard**, sur la carte de sa guilde.

### Accéder au formulaire

1. Aller dans **Dashboard → Mon équipe**
2. Sur la carte de la guilde, cliquer sur **Soumettre un projet** (visible pour les jams en cours)
3. Remplir le formulaire :
   - **Titre** du jeu
   - **Description** (ce que le jeu est, comment y jouer)
   - **Technologies** utilisées (ex : Unity, Godot, pygame)
   - **Lien de téléchargement** (itch.io, GitHub Releases, etc.)
   - **Lien du dépôt** (optionnel)
   - **Image de couverture** et **screenshots** (optionnels mais recommandés)
4. Cliquer sur **Soumettre** — le projet est enregistré

### Modifier une soumission

Tant que la jam est **en cours**, il est possible de revenir sur le formulaire pour modifier le projet.

### Page publique du projet

Une fois soumis, le projet est visible sur `/project/:id` avec :
- Description, technologies, liens
- Images et screenshots
- Section likes et commentaires

---

## 7. Liker et commenter

### Liker un projet

1. Aller sur la page du projet (`/project/:id`) — connexion requise
2. Cliquer sur le bouton **J'aime** (cœur) : le like s'ajoute, le compteur s'incrémente
3. Re-cliquer retire le like (**togglable**) — un seul like par projet et par utilisateur

Les likes alimentent le **classement popularité** :
- Les projets d'une jam sont triés par nombre de likes décroissant
- La page d'accueil affiche une section **« Projets les plus aimés »**

> Le classement popularité (likes) est distinct du **podium officiel** (top 3), désigné par l'organisateur — voir la section Admin.

### Commenter un projet

1. Aller sur la page du projet
2. Faire défiler jusqu'à la section **Commentaires**
3. Écrire son commentaire et valider

---

## 8. Le chat en direct

Chaque jam dispose d'un **chat en temps réel**, accessible depuis la page de détail de la jam.

### Canaux disponibles

| Canal | Utilisation |
|-------|-------------|
| **Général** | Discussion générale de la jam |
| **Recherche d'équipe** | Trouver des coéquipiers ou inviter des joueurs |
| **Aide** | Questions sur les règles ou la plateforme |

### Fonctionnalités

- Les messages s'affichent en temps réel (pas besoin de recharger la page)
- Les messages **épinglés** par les organisateurs apparaissent en haut du canal
- Les messages des **organisateurs** et **modérateurs** sont identifiés visuellement

---

## 9. Gérer son profil

Accessible via **Dashboard → Mon profil** (`/dashboard/profile`).

### Modifier ses informations

- **Nom d'affichage** — visible par tous les participants
- **Bio** — courte présentation (visible sur la page publique de profil)
- **Avatar** — image de profil (JPG/PNG, max 2 Mo)

### Changer de mot de passe

Dans la section **Sécurité** du profil, entrer l'ancien mot de passe puis le nouveau (deux fois).

> Cette section n'est pas disponible pour les comptes créés via OAuth (Google/Discord).

### Page publique de profil

Accessible via `/profile/:id` — visible par tous. Affiche le nom, la bio, l'avatar et les participations publiques.

### Supprimer son compte

Dans la section **Zone de danger** du profil. La suppression est **définitive** et irréversible.

---

## 10. Rôle Organisateur — Créer et gérer une jam

Tout utilisateur connecté peut créer et organiser des game jams.

### Créer une jam

1. Aller dans **Dashboard → Mes jams** (`/dashboard/my-jams`)
2. Cliquer sur **Créer une jam**
3. Remplir le formulaire :
   - **Titre** et **thème**
   - **Description** (règles, contexte, ambiance)
   - **Dates** (début et fin)
   - **Type** : solo uniquement, équipes uniquement, ou les deux
   - **Règles** (liste)
   - **Prix** (liste, optionnel)
   - **Tags** pour la catégorisation
   - **Image de couverture** (optionnel)
   - **Nombre maximum de participants** (optionnel)
4. Valider — la jam est créée avec le statut `À venir`

### Gérer une jam en cours

Depuis **Dashboard → Mes jams → [nom de la jam]** :

#### Modifier les informations

Cliquer sur **Modifier** pour corriger la description, les règles, les prix, les tags ou le nombre de participants. Le titre, le thème et les dates ne sont pas modifiables après création.

#### Publier des annonces

1. Aller dans la section **Annonces**
2. Remplir le titre et le contenu
3. Cocher **Importante** si l'annonce doit être mise en avant
4. Valider — l'annonce apparaît immédiatement sur la page de la jam

Les annonces peuvent être **supprimées** par l'organisateur à tout moment.

---

## 11. Rôle Admin — Panneau d'administration

Le panneau admin est accessible à l'adresse `/admin`. L'accès est réservé aux membres de l'équipe admin (configurée dans Appwrite).

### Tableau de bord admin (`/admin`)

- Statistiques globales : nombre de jams, utilisateurs, projets, messages
- Vue d'ensemble de l'activité

### Gestion des utilisateurs (`/admin/users`)

- Liste de tous les utilisateurs
- Voir le profil et les participations
- Bloquer un utilisateur

### Gestion des jams (`/admin/jams`)

- Liste de toutes les jams
- Supprimer une jam (action irréversible)

### Modération (`/admin/moderation`)

- Voir les messages et projets signalés
- Prendre des mesures (suppression de contenu)

### Mise en avant et podium (`/admin/featured`)

- Mettre en avant des jams ou des projets sur la page d'accueil
- **Désigner le podium** d'une jam : boutons **1er / 2e / 3e** sur chaque projet soumis
  - Disponible **uniquement après la fin de la jam** (avant : « Podium ouvrable après la fin de la jam »)
  - Re-cliquer sur le rang attribué le retire
  - Le podium est éditorial — indépendant du nombre de likes

### Annonces globales (`/admin/announcements`)

- Publier des annonces visibles sur l'ensemble de la plateforme (pas liées à une jam)

### Logs et monitoring (`/admin/logs`)

- Voir les logs d'audit (connexions, actions, erreurs)
- Consulter les statistiques de trafic par pays
- **Bannir une IP** manuellement
- **Débannir une IP**
- **Purger les anciens logs**

> Les IPs bannies sont automatiquement bloquées par le middleware de la plateforme avant même qu'elles n'atteignent le site. Les bots détectés sont bannis automatiquement.

---

## Pages légales

| Page | URL |
|------|-----|
| Mentions légales | `/legal/mentions-legales` |
| Politique de confidentialité | `/legal/privacy` |
| Conditions d'utilisation | `/legal/terms` |

---

*KonfiturGame · Manuel d'utilisation · Mis à jour : 2026-07-08*
