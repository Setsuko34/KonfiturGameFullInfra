# KonfiturGame — Schéma de la base de données

Base de données Appwrite : `konfitur-db`

---

## Diagramme ERD

```mermaid
erDiagram
    game_jams {
        string id PK
        string title
        string slug
        string theme
        string description
        enum status "upcoming | ongoing | ended"
        enum type "solo | team | both"
        datetime start_date
        datetime end_date
        string duration
        int max_participants
        string[] rules
        string[] prizes
        string[] tags
        string cover_image_id
        string organizer_id
    }

    teams {
        string id PK
        string[] jam_ids "[] = guilde pure"
        string name
        string invite_code "format KG-XXXXXXXX"
        string leader_id
    }

    team_members {
        string id PK
        string team_id FK
        string user_id
        string name
        enum role "dev | artist | sound | designer | writer"
        bool is_leader
    }

    projects {
        string id PK
        string jam_id FK
        string team_id FK
        string title
        string description
        string[] technologies
        string download_url
        string repo_url
        bool submitted
        datetime submission_date
        int votes_count
        string cover_image_id
        string[] screenshot_ids
    }

    chat_messages {
        string id PK
        string jam_id FK
        enum channel "general | team-search | help"
        string author_id
        string author_name
        string content
        enum role "user | organizer | moderator"
        bool pinned
    }

    announcements {
        string id PK
        string jam_id FK
        string title
        string content
        bool important
        string author_id
    }

    votes {
        string id PK
        string project_id FK
        string user_id
    }

    comments {
        string id PK
        string project_id FK
        string author_id
        string author_name
        string content
    }

    audit_logs {
        string id PK
        string action
        string user_id
        string details
        datetime created_at
    }

    banned_ips {
        string id PK
        string ip
        string reason
        string banned_by
        datetime created_at
    }

    game_jams ||--o{ teams : "jam_ids[] contient id"
    game_jams ||--o{ projects : "jam_id"
    game_jams ||--o{ chat_messages : "jam_id"
    game_jams ||--o{ announcements : "jam_id"
    teams ||--o{ team_members : "team_id"
    teams ||--o{ projects : "team_id"
    projects ||--o{ votes : "project_id"
    projects ||--o{ comments : "project_id"
```

---

## Notes architecturales

### Guildes multi-jam
La relation `game_jams ↔ teams` est **many-to-many côté teams** : le champ `jam_ids[]` est un tableau d'IDs de jams. Une guilde peut être inscrite à 0, 1 ou plusieurs jams simultanément.

Query pour retrouver les équipes d'une jam : `Query.contains('jam_ids', jamId)`

### Projets découplés des équipes
`project_id` a été retiré de `teams`. Un projet est retrouvé par la combinaison `(team_id, jam_id)` — ce qui permet à une guilde de soumettre un projet différent par jam.

### Unicité des votes
Un seul vote par `(project_id, user_id)` est techniquement garanti par la logique applicative (vérification avant insertion).

### Utilisateurs Appwrite
Les utilisateurs ne sont pas dans `konfitur-db` — ils sont gérés nativement par Appwrite (collection interne `_console_users`). Les `user_id` dans les collections font référence à l'ID Appwrite de l'utilisateur.

---

## Buckets de stockage

| Bucket ID | Contenu | Taille max |
|-----------|---------|-----------|
| `jam-covers` | Images de couverture des jams | 5 Mo |
| `project-assets` | Screenshots et builds | 20 Mo |
| `avatars` | Photos de profil | 2 Mo |

---

*Schéma — KonfiturGame · Appwrite 1.8.0 · Base : `konfitur-db` · Mis à jour : 2026-04-16*
