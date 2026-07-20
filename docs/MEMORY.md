# KonfiturGame — Historique des sessions

---

## Session 2026-03-30

### Accompli

- Plan A entièrement livré (11 tasks) : profil utilisateur, annonces organisateurs, édition de jam en cours
- Infrastructure de tests Vitest mise en place (8 tests unitaires passent)
- 15 fichiers créés ou modifiés
- Build de production validé ✅

### Décisions clés

- `getProfile()` retourne `null` au lieu de lever une exception (catch → null)
- `deleteAccount` : suppression du compte avant révocation des sessions (ordre critique)
- `getJamAnnouncements` supprimé — doublon de `getAnnouncementsByJam` dans `jams.ts`
- Vérification ownership annonce : double check `jam.organizer_id` + `announcementDoc.jam_id`
- `validateUpdateJamData` accepte `UpdateJamData` directement (cast `Record<string, unknown>` localisé dans la fonction)
- Guard `if (status === 'ended') return null` dans `EditJamForm` placé après tous les hooks (règle ESLint)

---

## Session 2026-04-15 / 2026-04-16 — Guildes multi-jam + fix Appwrite 1.8.0

### Contexte initial

Rollback forcé à `8cb74f9` (commit précédant le merge de `feat/teams-multijam`) à cause d'un artefact git : `frontend/node_modules` avait été commité comme un fichier texte lors du merge du worktree, ce qui corrompait les volumes Docker anonymes.

### Accompli

**Feature : Guildes multi-jam**
- Migration du schéma `teams` : `jam_id: string` → `jam_ids: string[]`, suppression de `project_id`
- `Team` type mis à jour dans `types/index.ts`
- `mapDocToTeam` mis à jour dans `lib/appwrite/types.ts`
- `lib/actions/teams.ts` réécrit : `createTeam`, `joinTeamByCode`, `getTeamsByJam`, `registerTeamToJam`, `updateMemberRole`, `removeMemberFromTeam`, `deleteTeam`
- `lib/actions/dashboard.ts` : `getUserTeams()`, `getUserParticipations()` mis à jour (multi-jam)
- `lib/actions/projects.ts` : `getProjectByTeamAndJam(teamId, jamId)`
- Dashboard `/dashboard/team` refondu : `TeamCard`, `TeamPageClient`, `CreateTeamModal`, `JoinTeamModal`, `SubmitProjectForm`
- `JamTeamsSection.tsx` sur `/jam/[jamId]` : actions contextuelles (créer/rejoindre/inscrire)
- `seed-data.sh` mis à jour : `jam_ids` array au lieu de `jam_id` string
- Tests `actions-teams.test.ts` : 6 tests, `appwrite-mappers.test.ts` : 15 tests

**Fix Appwrite 1.8.0 — erreur "Unknown attribute: devKeys"**
- Cause : projet créé avec Appwrite 1.6.0, migration partielle vers 1.8.0 — `devKeys` ajouté en colonne MariaDB mais pas dans `_console__metadata.projects`
- Fix : injection SQL directe dans `_console__metadata` via `JSON_ARRAY_APPEND`
- Suivi : migration complète lancée via `php cli.php migrate`

### Décisions clés

- `Query.contains('jam_ids', jamId)` pour retrouver les équipes d'une jam
- Les projets ne sont plus rattachés à l'équipe — retrouvés par `(team_id, jam_id)`
- Conflict detection : `isUserInTeamForJam()` vérifie qu'on n'est pas déjà dans une équipe pour la même jam avant de rejoindre
- `invite_code` format `KG-XXXXXXXX` (8 hex chars)
- Les tests doivent tourner dans le container Docker (`npx vitest run` via `docker exec`)

### À retenir

- Ne JAMAIS faire `git worktree` sans vérifier que `node_modules` n'est pas dans le staging avant le merge
- Appwrite 1.8.0 : après upgrade depuis 1.6.x, lancer manuellement `php cli.php migrate` + vérifier `_console__metadata`
- Force push sur `develop` pour nettoyer les commits du serveur avant de repousser le travail propre

---

## Sessions 2026-07 (résumé) — Dashboards, plafonds Appwrite, solo, équipes, tchat

### Accompli

- **Dashboards admin et user** refondus (chantiers E/F) : superpouvoirs admin (`/admin/jams/[id]`, `/admin/teams`), logs filtrables, modération actionnable
- **Plafonds silencieux Appwrite** éradiqués : helpers `fetchAllDocs`/`fetchAllByField` (`lib/appwrite/fetch-all.ts`), pattern `LoadMoreList` (curseur, jamais d'offset) pour toute liste rendue
- **Inscriptions solo** : `teams.is_solo`, team solo personnelle unique par utilisateur réutilisée entre les jams, désinscription avant début de jam, compteurs participants dérivés des teams réelles (`participant-counts.ts`)
- **Pages équipes hub/vitrine** : liste `/dashboard/teams`, page `/team/[teamId]` à double mode (`viewerRole`/`viewerId` via `getTeamById`), codes d'invitation jamais exposés publiquement (fuite préexistante sur la page jam bouchée)
- **Tchat privé d'équipe** : table `team_chat_messages` (row security, zéro permission table, `read(user:X)` par membre à l'envoi), composants chat partagés extraits de JamChat (`components/chat/`), hook realtime commun `useRealtimeChat` (create/update/delete), épinglage et signalement par les membres, modération admin dédiée
- Suite de tests : 196 → **354 tests / 26 fichiers** ; e2e retargetés sur `/dashboard/teams` et le hub

### Décisions clés

- Les permissions Appwrite s'additionnent : le tchat privé exige **zéro permission de table** (un `read("any")` rendrait tout public) ; privacité par document, native côté realtime
- Les lectures paginées du tchat passent par le **client de session** (la clé API contournerait la row security : un arrivant pourrait lire l'historique pré-arrivée)
- Un nouvel arrivant dans la guilde ne lit pas l'historique antérieur ; un partant garde les messages de sa période (choix produit assumé)
- Validation de longueur des messages **après** échappement HTML (l'expansion `&lt;` peut dépasser la colonne 2048)
