# KonfiturGame — Cahier de recettes

> Document de test d'acceptation. Chaque scénario décrit les étapes, le résultat attendu et les critères de validation. À exécuter avant toute mise en production.

---

## Comment utiliser ce document

1. Exécuter les scénarios dans l'ordre (les dépendances sont signalées)
2. Cocher chaque critère validé
3. Noter les anomalies avec la date, les étapes de reproduction et le résultat observé
4. Un scénario est **accepté** si tous ses critères sont cochés
5. Un scénario est **bloquant** si la mise en production ne peut pas avoir lieu sans lui

**Environnements couverts :**
- DEV : `http://localhost:3000` + `http://localhost:8080`
- PROD : `https://konfiturgame.fr` + `https://api.konfiturgame.fr`

---

## Smoke test — 5 minutes (pré-requis de tout le reste)

Avant de commencer les scénarios, vérifier que l'infrastructure répond :

```bash
# Dev
curl -s -o /dev/null -w '%{http_code}' http://localhost:3000          # → 200
curl -s http://localhost:8080/v1/health | grep -q '"status":"pass"'  # → ok

# Prod
curl -s -o /dev/null -w '%{http_code}' https://konfiturgame.fr       # → 200
curl -s https://api.konfiturgame.fr/v1/health | grep -q '"status"'   # → ok
```

Si l'un de ces checks échoue, ne pas continuer — résoudre l'infrastructure d'abord (voir `DEPLOIEMENT.md`).

---

## Module 1 — Authentification

### 1.1 Inscription email/mot de passe

**Prérequis :** aucun  
**Bloquant :** oui

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Aller sur `/auth/register` | Page d'inscription affichée, pas d'erreur console |
| 2 | Remplir pseudo, email, mot de passe valides et valider | Redirection vers `/` ou page demandée |
| 3 | Vérifier le header | Bouton "Dashboard" et "Déconnexion" visibles, "Se connecter" absent |
| 4 | Recharger la page | Toujours connecté (cookie de session persistant) |
| 5 | Tenter une inscription avec le même email | Message d'erreur explicite (email déjà utilisé) |

**Critères d'acceptation :**
- [ ] L'inscription crée bien un utilisateur (visible dans la console Appwrite → Auth → Users)
- [ ] La session est maintenue après rechargement
- [ ] Les erreurs de validation (email malformé, mot de passe trop court) sont affichées

---

### 1.2 Connexion email/mot de passe

**Prérequis :** 1.1  
**Bloquant :** oui

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Se déconnecter si connecté | Redirection vers `/`, bouton "Se connecter" visible |
| 2 | Aller sur `/auth/login` | Page de connexion affichée |
| 3 | Entrer email + mot de passe corrects | Redirection vers `/` ou `?redirect=` |
| 4 | Aller sur `/dashboard` directement sans être connecté | Redirection vers `/auth/login?redirect=/dashboard` |
| 5 | Se connecter via cette redirection | Redirection vers `/dashboard` après connexion |
| 6 | Tenter une connexion avec mauvais mot de passe | Message d'erreur, pas de connexion |

**Critères d'acceptation :**
- [ ] La redirection post-login fonctionne
- [ ] Les routes protégées (`/dashboard`, `/admin`) redirigent bien si non connecté

---

### 1.3 OAuth Google

**Prérequis :** 1.1, provider Google configuré  
**Bloquant :** non (si l'email/password fonctionne)

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Aller sur `/auth/login`, cliquer sur "Connexion avec Google" | Redirection vers `accounts.google.com` |
| 2 | Accepter les permissions Google | Retour sur KonfiturGame, utilisateur connecté |
| 3 | Vérifier dans Appwrite | Utilisateur créé avec provider `google` |

**Critères d'acceptation :**
- [ ] Le flux OAuth complète sans erreur "redirect_uri_mismatch"
- [ ] L'utilisateur est connecté après le retour

---

### 1.4 OAuth Discord

**Prérequis :** 1.1, provider Discord configuré  
**Bloquant :** non

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Aller sur `/auth/login`, cliquer sur "Connexion avec Discord" | Redirection vers `discord.com/oauth2` |
| 2 | Autoriser l'application | Retour sur KonfiturGame, utilisateur connecté |

**Critères d'acceptation :**
- [ ] Le flux Discord complète sans erreur

---

## Module 2 — Navigation publique

### 2.1 Page d'accueil

**Prérequis :** données de test présentes (seed)  
**Bloquant :** oui

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Aller sur `/` sans être connecté | Page chargée, pas d'erreur |
| 2 | Vérifier les sections | Jams en cours / à venir / terminées visibles |
| 3 | Vérifier le countdown | Timer décrémente en temps réel |
| 4 | Cliquer sur une jam | Redirection vers `/jam/:id` |
| 5 | Consulter en mode mobile (< 768px) | Menu burger fonctionnel, layout adapté |

**Critères d'acceptation :**
- [ ] La page se charge sans erreur 500
- [ ] Les données proviennent bien d'Appwrite (pas des mocks)
- [ ] Le design responsive est correct sur mobile

---

### 2.2 Page Explorer

**Prérequis :** 2.1  
**Bloquant :** non

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Aller sur `/explore` | Liste des jams affichée |
| 2 | Filtrer par "En cours" | Seules les jams `ongoing` sont affichées |
| 3 | Filtrer par "À venir" | Seules les jams `upcoming` sont affichées |
| 4 | Filtrer par "Terminées" | Seules les jams `ended` sont affichées |
| 5 | Cliquer sur une card | Redirection vers `/jam/:id` |

**Critères d'acceptation :**
- [ ] Les filtres fonctionnent sans rechargement de page
- [ ] Les cards affichent le bon statut (badge coloré)

---

### 2.3 Page de détail d'une jam

**Prérequis :** 2.1  
**Bloquant :** oui

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Aller sur `/jam/:id` d'une jam existante | Page chargée avec toutes les sections |
| 2 | Vérifier le thème, description, dates | Données correctes |
| 3 | Vérifier la section Équipes | Liste des équipes inscrites visible |
| 4 | Aller sur `/jam/id-inexistant` | Page 404 |

**Critères d'acceptation :**
- [ ] Les métadonnées OG sont présentes (inspecter le `<head>`)
- [ ] La page 404 est correctement affichée pour un ID invalide

---

## Module 3 — Guildes

### 3.1 Créer une guilde

**Prérequis :** 1.1 (connecté)  
**Bloquant :** oui

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Aller dans Dashboard → Mon équipe | Page des guildes affichée |
| 2 | Cliquer sur "Créer une guilde" | Modale ou formulaire s'ouvre |
| 3 | Entrer un nom de guilde et choisir un rôle | Champs validés |
| 4 | Valider | Guilde créée, code `KG-XXXXXXXX` affiché |
| 5 | Vérifier dans Appwrite | Document créé dans la collection `teams` |

**Critères d'acceptation :**
- [ ] Le code d'invitation est au format `KG-XXXXXXXX` (8 caractères alphanumériques)
- [ ] L'utilisateur est bien enregistré comme `is_leader: true` dans `team_members`
- [ ] La guilde apparaît dans le dashboard sans rechargement

---

### 3.2 Rejoindre une guilde via code

**Prérequis :** 3.1, second compte utilisateur  
**Bloquant :** oui

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Se connecter avec un second compte | Connecté |
| 2 | Aller dans Dashboard → Mon équipe | Pas de guilde affichée |
| 3 | Cliquer sur "Rejoindre une guilde" | Champ code d'invitation |
| 4 | Entrer le code `KG-XXXXXXXX` de la guilde créée en 3.1 | Guilde rejointe |
| 5 | Vérifier la liste des membres | Deux membres visibles |
| 6 | Entrer un code invalide | Message d'erreur explicite |

**Critères d'acceptation :**
- [ ] L'utilisateur est ajouté dans `team_members`
- [ ] Les deux membres voient la guilde dans leur dashboard

---

### 3.3 Inscrire une guilde à une jam

**Prérequis :** 3.1, jam en cours (`ongoing`) existante  
**Bloquant :** oui

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Aller sur la page d'une jam `ongoing` | Section Équipes visible |
| 2 | Cliquer sur "Inscrire ma guilde" | Liste des guildes disponibles |
| 3 | Sélectionner la guilde et valider | Guilde inscrite, apparaît dans la liste |
| 4 | Vérifier dans Appwrite | `jam_ids` de la guilde contient l'ID de la jam |
| 5 | Tenter d'inscrire la même guilde une seconde fois | Erreur : déjà inscrite |
| 6 | Tenter d'inscrire une autre guilde dont un membre est déjà inscrit | Erreur : conflit de membre |

**Critères d'acceptation :**
- [ ] `Query.contains('jam_ids', jamId)` retourne la guilde inscrite
- [ ] Les conflits d'inscription sont détectés et affichent un message d'erreur

---

## Module 4 — Projets

### 4.1 Soumettre un projet

**Prérequis :** 3.3 (guilde inscrite à une jam)  
**Bloquant :** oui

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Aller dans Dashboard → Mon équipe | Card de la guilde avec section jam |
| 2 | Cliquer sur "Soumettre un projet" | Formulaire de soumission |
| 3 | Remplir titre, description, technologies, URL | Champs validés |
| 4 | Uploader une image de couverture | Upload dans le bucket `project-assets` |
| 5 | Valider | Projet créé, lien vers la page `/project/:id` |
| 6 | Aller sur `/project/:id` | Page du projet avec toutes les infos |

**Critères d'acceptation :**
- [ ] Le projet est retrouvable par `(team_id, jam_id)` dans Appwrite
- [ ] L'image est visible sur la page du projet
- [ ] Le projet apparaît dans la liste des projets de la jam

---

### 4.2 Voter pour un projet

**Prérequis :** 4.1, jam en statut `ended`  
**Bloquant :** non

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Aller sur `/project/:id` | Bouton Vote visible |
| 2 | Cliquer sur Voter | Compteur augmente de 1 |
| 3 | Cliquer à nouveau sur Voter | Erreur ou bouton désactivé (un seul vote) |
| 4 | Se déconnecter et voter | Redirection vers `/auth/login` |

**Critères d'acceptation :**
- [ ] Un seul vote par `(project_id, user_id)` est enregistré
- [ ] Le compteur de votes est persistant après rechargement

---

### 4.3 Commenter un projet

**Prérequis :** 4.1  
**Bloquant :** non

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Aller sur `/project/:id` → section commentaires | Zone de saisie visible (si connecté) |
| 2 | Saisir un commentaire et valider | Commentaire affiché dans la liste |
| 3 | Tenter de commenter sans être connecté | Redirection vers login |

**Critères d'acceptation :**
- [ ] Le commentaire est enregistré dans la collection `comments`
- [ ] L'auteur et la date sont affichés

---

## Module 5 — Chat en direct

### 5.1 Envoi de messages

**Prérequis :** 1.1, jam existante  
**Bloquant :** oui

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Aller sur `/jam/:id` section Chat | Chat affiché avec les canaux |
| 2 | Changer de canal (Général → Aide) | Messages du canal sélectionné |
| 3 | Saisir un message et envoyer | Message affiché dans la liste |
| 4 | Dans un autre onglet / autre navigateur, envoyer un message | Message apparaît **sans rechargement** dans le premier onglet |

**Critères d'acceptation :**
- [ ] Les messages s'affichent en temps réel (WebSocket fonctionnel)
- [ ] La séparation des canaux est respectée (général ≠ aide)

---

## Module 6 — Profil utilisateur

### 6.1 Modifier le profil

**Prérequis :** 1.1  
**Bloquant :** non

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Aller dans Dashboard → Mon profil | Formulaire pré-rempli avec les infos actuelles |
| 2 | Modifier le nom d'affichage et valider | Nom mis à jour, confirmation affichée |
| 3 | Modifier la bio et valider | Bio mise à jour |
| 4 | Uploader un avatar (JPG < 2 Mo) | Avatar affiché dans le profil |
| 5 | Tenter un avatar > 2 Mo | Message d'erreur de taille |
| 6 | Aller sur `/profile/:id` | Profil public avec les nouvelles infos |

**Critères d'acceptation :**
- [ ] Les modifications sont persistantes après rechargement
- [ ] L'avatar est stocké dans le bucket `avatars`

---

### 6.2 Changer de mot de passe

**Prérequis :** 1.1 (compte email/password)  
**Bloquant :** non

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Dashboard → Mon profil → Changer le mot de passe | Formulaire : ancien mdp + nouveau mdp (x2) |
| 2 | Entrer les informations correctes | Mot de passe changé, confirmation |
| 3 | Se déconnecter et se reconnecter avec le nouveau mdp | Connexion réussie |
| 4 | Entrer l'ancien mot de passe incorrect | Erreur explicite |

**Critères d'acceptation :**
- [ ] L'ancien mot de passe est vérifié avant le changement
- [ ] La session reste active après le changement

---

## Module 7 — Organisateur

### 7.1 Créer une jam

**Prérequis :** 1.1  
**Bloquant :** oui (si le projet héberge des jams)

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Aller dans Dashboard → Mes jams | Liste des jams organisées |
| 2 | Cliquer sur "Créer une jam" | Formulaire complet |
| 3 | Remplir tous les champs obligatoires | Champs validés |
| 4 | Définir une date de début dans le futur | Statut calculé automatiquement : `À venir` |
| 5 | Valider | Jam créée, visible sur `/explore` |

**Critères d'acceptation :**
- [ ] La jam apparaît dans `/explore` avec le bon statut
- [ ] L'organisateur peut la retrouver dans "Mes jams"

---

### 7.2 Publier une annonce

**Prérequis :** 7.1  
**Bloquant :** non

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Dashboard → Mes jams → [jam] → Annonces | Formulaire d'annonce |
| 2 | Créer une annonce avec "Important" coché | Annonce créée |
| 3 | Aller sur `/jam/:id` | Annonce visible, mise en avant visuellement |
| 4 | Supprimer l'annonce depuis le dashboard | Annonce retirée de la page jam |

**Critères d'acceptation :**
- [ ] Les annonces importantes sont visuellement distinctes des normales
- [ ] La suppression est immédiate

---

## Module 8 — Administration

**Prérequis :** accès admin (appartenir à l'équipe ADMIN dans Appwrite)

### 8.1 Accès au panel

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Aller sur `/admin` avec un compte non-admin | Page 404 |
| 2 | Aller sur `/admin` avec un compte admin | Dashboard admin affiché |

**Critères d'acceptation :**
- [ ] Un utilisateur non-admin obtient un 404, pas une redirection login (protection par le layout)

---

### 8.2 Logs et ban IP

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Aller sur `/admin/logs` | Tableau des logs et liste des IPs bannies |
| 2 | Bannir l'IP `127.0.0.1` manuellement | IP apparaît dans la liste des bannies |
| 3 | Débannir l'IP `127.0.0.1` | IP retirée de la liste |
| 4 | Purger les vieux logs | Confirmation, logs purgés |

**Critères d'acceptation :**
- [ ] La collection `banned_ips` est bien mise à jour
- [ ] L'API `/api/banned-ips` retourne les IPs actives (cache 2 min)

---

## Module 9 — Infrastructure

### 9.1 TLS et sécurité (prod uniquement)

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | `curl -I https://konfiturgame.fr` | `strict-transport-security` présent |
| 2 | `curl -I http://konfiturgame.fr` | Redirection 301 → HTTPS |
| 3 | Inspecter les headers de réponse | `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` présents |
| 4 | `curl -I https://api.konfiturgame.fr/v1/health` | HTTP 200, `{"status":"pass"}` |

**Critères d'acceptation :**
- [ ] HTTPS actif sur tous les domaines
- [ ] Redirection HTTP → HTTPS
- [ ] Headers de sécurité présents

---

### 9.2 Accessibilité

| # | Étape | Résultat attendu |
|---|-------|-----------------|
| 1 | Naviguer sur la page d'accueil avec Tab uniquement | Tous les éléments interactifs sont accessibles |
| 2 | Vérifier l'attribut `lang` de la balise `<html>` | `lang="fr"` |
| 3 | Activer la navigation clavier sur le header | Focus visible sur les liens (outline 2px bleu) |
| 4 | Tester avec `prefers-reduced-motion` activé | Aucune animation en cours |

**Critères d'acceptation :**
- [ ] `lang="fr"` sur `<html>`
- [ ] Focus visible sur tous les éléments interactifs
- [ ] Aucune animation si `prefers-reduced-motion: reduce`

---

## Checklist de validation avant mise en production

Cette checklist résume les critères bloquants à valider avant tout déploiement en production.

### Infrastructure
- [ ] Smoke test passé (frontend 200, Appwrite `/health` pass)
- [ ] TLS actif, redirection HTTP → HTTPS
- [ ] Headers de sécurité présents (HSTS, CSP, X-Frame-Options)
- [ ] Dashboard Traefik protégé par mot de passe (401 sans auth)

### Authentification
- [ ] Inscription email/password (scénario 1.1)
- [ ] Connexion email/password + redirection post-login (scénario 1.2)
- [ ] Protection des routes `/dashboard` et `/admin` (scénario 1.2, étape 4)

### Fonctionnalités core
- [ ] Guildes : création + rejoindre par code (scénarios 3.1, 3.2)
- [ ] Inscription à une jam (scénario 3.3)
- [ ] Soumission d'un projet (scénario 4.1)
- [ ] Chat en temps réel (scénario 5.1, étape 4)
- [ ] Création d'une jam (scénario 7.1)

### CI/CD (si pipeline actif)
- [ ] Les 4 jobs bloquants passent (lint, tests, gitleaks, RGPD)
- [ ] Le déploiement s'est déclenché et les healthchecks ont réussi
- [ ] Aucune issue `deploy-failure` ouverte sur GitHub

### Données
- [ ] `seed-data.sh` exécuté (collections principales)
- [ ] `create-log-collections.sh` exécuté (audit_logs, banned_ips)
- [ ] `LOG_INTERNAL_SECRET` défini dans `.env`

---

*KonfiturGame · Cahier de recettes · Mis à jour : 2026-06-28*
