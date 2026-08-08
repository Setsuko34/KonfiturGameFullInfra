# KonfiturGame — Supervision et alertes

Périmètre supervisé, sondes en place, seuils d'alerte et modalités de signalement.

> Principe directeur : une plateforme de game jams a un profil de charge très
> irrégulier. Elle est quasi déserte entre deux événements, puis encaisse un
> pic à l'ouverture des inscriptions et un second à l'heure limite de
> soumission — moment où une indisponibilité est la plus coûteuse, parce que
> les participants ne peuvent pas décaler leur rendu. La supervision est
> dimensionnée sur ce pic, pas sur la moyenne.

---

## Table des matières

1. [Architecture de supervision](#1-architecture-de-supervision)
2. [Périmètre supervisé](#2-périmètre-supervisé)
3. [Inventaire des sondes](#3-inventaire-des-sondes)
4. [Seuils et règles d'alerte](#4-seuils-et-règles-dalerte)
5. [Modalités de signalement](#5-modalités-de-signalement)
6. [Installation](#6-installation)
7. [Exploitation courante](#7-exploitation-courante)
8. [Dépannage](#8-dépannage)

---

## 1. Architecture de supervision

Trois étages indépendants. L'indépendance est délibérée : chacun couvre l'angle
mort du précédent.

```
              ┌────────────────────┐  ┌──────────────────────────┐
   Étage 3    │ Grafana (TLS)      │  │ Alertmanager             │
   Visualiser │ Tableaux de bord   │  │ Routage · inhibition ·   │──▶ Discord
   Notifier   │ Consultation des   │  │ regroupement · rappels   │  (P0 → 10 s)
              │ alertes            │  └────────────┬─────────────┘
              └─────────┬──────────┘               │ alertes
                        │ PromQL                   │
                        └───────────┬──────────────┘
                        ┌───────────┴──────────────┐
   Étage 2              │       Prometheus         │
   Collecte             │  30 j de rétention       │
   et évaluation        │  20 règles d'alerte      │
                        └────────────┬─────────────┘
                    ┌────────────────┼────────────────┐
                    │                │                │
            ┌───────┴──────┐ ┌───────┴──────┐ ┌───────┴────────┐
   Étage 1  │   Traefik    │ │   cAdvisor   │ │   blackbox     │
   Sondes   │  /metrics    │ │ node-exporter│ │   exporter     │
            │ (boîte       │ │  (boîte      │ │  (boîte noire, │
            │  blanche)    │ │   blanche)   │ │   vue externe) │
            └──────────────┘ └───────┬──────┘ └────────────────┘
                                     │ textfile collector
                             ┌───────┴──────────────┐
   Étage 0                   │  cron (hors Docker)  │
   Plancher                  │  health-check.sh 5'  │──▶ relance auto
   et remédiation            │  backup.sh    1 j    │    des conteneurs
                             └──────────────────────┘
```

**Pourquoi Alertmanager et pas Grafana.** Les règles sont écrites en PromQL et
évaluées par Prometheus. Grafana sait les *afficher* — elles y apparaissent en
« data source-managed » — mais ses politiques de notification ne routent que
les alertes qu'il évalue lui-même. Sans Alertmanager, une règle passe donc en
`firing` dans Prometheus **et** dans Grafana sans que personne ne soit prévenu.
Le défaut a été constaté lors de la validation locale du 2026-08-01 : les
alertes se déclenchaient, les politiques Grafana affichaient « 0 instance ».
Alertmanager apporte en plus ce que Grafana ne fait pas ici : l'inhibition
(taire la latence quand le site entier est down) et la déduplication.

**Pourquoi l'étage 0 existe malgré Prometheus.** Prometheus et Grafana tournent
dans la même stack Docker que l'application. Si le démon Docker se dégrade ou
si le disque sature, la supervision tombe *avec* ce qu'elle surveille et
personne n'est prévenu. `health-check.sh` ne dépend que de `bash`, `docker` et
`curl`, il est lancé par cron hors conteneur, et il **agit** (relance) au lieu
de seulement observer.

---

## 2. Périmètre supervisé

| Couche | Ce qui est surveillé | Pourquoi |
|--------|---------------------|----------|
| **Expérience utilisateur** | Disponibilité et temps de réponse de `konfiturgame.fr` et `/explore`, validité TLS | Seule mesure qui reflète ce que vit un participant. Un conteneur « up » qui répond 500 est indisponible pour lui |
| **Application** | Codes retour HTTP par service et par router, taux de 5xx, latence | Localise la panne : frontend, API ou routage |
| **Backend** | API Appwrite (`/v1/health/version`), routing same-origin `/v1` | L'API porte l'authentification et toutes les écritures. Le routing `/v1` est surveillé parce que sa perte a déjà causé un incident (B-11) |
| **Conteneurs** | État, redémarrages, CPU et mémoire des 21 services | Attribue une consommation à un service précis |
| **Hôte** | CPU, RAM, espace disque, charge | Le VPS est mutualisé entre tous les services : sa saturation les fait tomber ensemble |
| **Sécurité** | Dashboard Traefik toujours en 401, volume de 4xx, IP bannies | Détecte la régression de configuration et le scan automatisé |
| **Données** | Fraîcheur et intégrité des sauvegardes | Une sauvegarde non vérifiée est une sauvegarde absente |

**Hors périmètre assumé :** traçage distribué (une seule application, sans
architecture microservices), agrégation centralisée des logs (le volume ne le
justifie pas encore ; `docker compose logs` et la collection `audit_logs`
suffisent), supervision synthétique des parcours utilisateur (couverte par la
suite Playwright, jouée avant chaque mise en production).

---

## 3. Inventaire des sondes

### Sondes externes — blackbox-exporter

Interrogent les URL publiques depuis l'extérieur de l'application, comme le
ferait un visiteur : TLS, routage Traefik et rendu SSR compris.

| Sonde | Cible | Attendu | Finalité |
|-------|-------|---------|----------|
| `frontend` | `https://konfiturgame.fr` | 200 | Disponibilité de la page d'accueil (rendu serveur) |
| `frontend` | `https://konfiturgame.fr/explore` | 200 | Vérifie la chaîne complète jusqu'à la base : cette page liste les jams |
| `appwrite` | `https://api.konfiturgame.fr/v1/health/version` | 200 | Santé de l'API et version servie |
| `appwrite` | `https://konfiturgame.fr/v1/account` | 401 | Non-régression du routing same-origin (incident B-11) |
| `traefik` | `https://traefik.konfiturgame.fr` | **401** | Sonde de sécurité : un 200 signifierait que l'authentification est tombée |

> **Piège traité.** L'User-Agent par défaut de blackbox est `Go-http-client`,
> listé dans `MALICIOUS_BOT_PATTERNS` (`frontend/src/lib/bot-detection.ts`).
> Sans surcharge, `proxy.ts` répond 403 **et bannit l'IP de la sonde** : la
> supervision se saborde et déclenche une fausse alerte. Tous les modules de
> `monitoring/blackbox/blackbox.yml` forcent donc un UA de navigateur — même
> contrainte que le healthcheck de la CI et que `health-check.sh`.

Chaque sonde HTTPS produit gratuitement `probe_ssl_earliest_cert_expiry`, ce
qui couvre la surveillance des certificats sans sonde dédiée.

### Sondes internes — boîte blanche

| Sonde | Source | Métriques clés | Finalité |
|-------|--------|---------------|----------|
| **Traefik** | entrypoint `metrics` (:8082) | `traefik_service_requests_total` par `code`, `service`, `router` | Taux d'erreur et volumétrie, ventilés par surface |
| **node-exporter** | hôte (`/` monté en lecture seule) | CPU, RAM, disque, charge | Ressources de la machine |
| **cAdvisor** | démon Docker | `container_memory_working_set_bytes`, `container_start_time_seconds` | Consommation et redémarrages par conteneur |
| **textfile collector** | `monitoring/textfile/*.prom` | `konfitur_backup_*`, `konfitur_healthcheck_*` | Pont entre les tâches cron et Prometheus |

L'entrypoint `metrics` n'est **jamais publié** sur l'hôte : il n'est joignable
que depuis `monitoring-net`. Ces métriques révèlent la topologie complète du
routage.

### Sondes applicatives — déjà en place avant cette stack

| Sonde | Mécanisme | Finalité |
|-------|-----------|----------|
| **Healthcheck de déploiement** | `.github/workflows/ci-cd.yml`, 10 tentatives × 10 s | Bloque un déploiement qui ne répond pas et ouvre une issue `deploy-failure` |
| **`audit_logs`** | collection Appwrite, types `auth`, `error`, `connection`, `solo`, `admin_action` | Journal applicatif consultable dans `/admin/logs` |
| **`logClientError`** | error boundary React → Server Action | Remonte les plantages côté navigateur, y compris pour les visiteurs anonymes |
| **Détection de bots** | `proxy.ts` + `bot-detection.ts` + `banned_ips` | Bannissement automatique, visible dans `/admin/logs` |
| **`prod-config-check.sh`** | job CI bloquant | Attrape en PR les incohérences de configuration de production |
| **Workers de stats Appwrite** | `worker-stats-usage`, `worker-stats-resources`, tâche `stats-resources` | Alimentent les métriques d'usage de la console Appwrite |

---

## 4. Seuils et règles d'alerte

20 règles réparties en 7 groupes (`monitoring/prometheus/alerts.yml`). La
sévérité reprend l'échelle déjà utilisée pour les anomalies du projet.

| Sévérité | Signification | Délai de traitement visé |
|----------|--------------|--------------------------|
| **P0** | Service indisponible ou perte de données possible | Immédiat |
| **P1** | Fonctionnalité dégradée | Dans l'heure |
| **P2** | Ressource sous tension, échéance à traiter | Dans la semaine |
| **P3** | Information | Revue hebdomadaire |

### Règles principales

| Alerte | Condition | Durée | Sév. |
|--------|-----------|-------|------|
| `SiteIndisponible` | `probe_success{service="frontend"} == 0` | 2 min | P0 |
| `ApiAppwriteIndisponible` | `probe_success{service="appwrite"} == 0` | 2 min | P0 |
| `DashboardTraefikNonProtege` | la sonde n'obtient plus 401 | 5 min | P0 |
| `CertificatTlsExpireImminent` | expiration < 3 jours | 10 min | P0 |
| `EspaceDisqueCritique` | < 5 % libre | 5 min | P0 |
| `ConteneurAbsent` | un service critique a disparu | 3 min | P0 |
| `TauxErreurs5xx` | > 5 % des requêtes | 5 min | P1 |
| `LatenceElevee` | temps de réponse > 3 s | 10 min | P1 |
| `ConteneurRedemarrageEnBoucle` | > 3 redémarrages en 1 h | 5 min | P1 |
| `SauvegardeManquante` | aucune réussite depuis 25 h | 30 min | P1 |
| `HealthCheckAnomalie` | anomalie non résolue par la sonde | 10 min | P1 |
| `HealthCheckArrete` | aucune exécution depuis 30 min | 15 min | P1 |
| `CollecteMetriquesInterrompue` | `up == 0` | 5 min | P1 |
| `CertificatTlsBientotExpire` | expiration < 14 jours | 1 h | P2 |
| `EspaceDisqueFaible` | < 15 % libre | 15 min | P2 |
| `MemoireSaturee` | > 90 % | 15 min | P2 |
| `ChargeCpuSoutenue` | > 85 % | 20 min | P2 |
| `SauvegardePartielle` | code de sortie ≠ 0 | 10 min | P2 |
| `PicErreurs4xx` | > 5 req/s en 4xx | 10 min | P3 |

> **Garde sur les règles conteneurs.** `ConteneurAbsent` porte un garde
> `and on() count(container_last_seen{name=~"konfitur-.*"}) > 0`. Sans lui,
> l'alerte se déclenche en permanence dès que cAdvisor n'expose pas le label
> `name` — le cas sur Docker Desktop/WSL2, où il ne remonte que des cgroups
> sans métadonnée de conteneur. `absent()` est alors vrai en continu et
> l'alerte crie au loup pendant que tout tourne. Constaté lors de la
> validation locale du 2026-08-01.
>
> Les deux règles `HealthCheck*` sont le filet de cette dépendance : issues de
> `scripts/health-check.sh`, elles ne reposent sur aucune métadonnée cAdvisor
> et couvrent la détection de conteneur mort même si cAdvisor reste muet.

**Justification des durées.** Le champ `for:` est la durée pendant laquelle la
condition doit rester vraie avant notification. Sans lui, chaque redéploiement
— qui provoque quelques secondes de coupure le temps du `docker compose up`
— réveillerait l'astreinte. Deux minutes couvrent un redémarrage normal du
frontend tout en gardant une détection rapide d'une vraie panne.

**Justification des seuils.** 14 jours sur le certificat TLS : Let's Encrypt
renouvelle automatiquement à 30 jours de l'échéance, donc passer sous 14 jours
ne signifie pas « bientôt expiré » mais « le renouvellement ACME échoue »,
ce qui laisse deux semaines pour intervenir. 25 heures sur la sauvegarde :
juste au-delà du cycle quotidien, pour ne pas alerter sur un décalage d'exécution.

---

## 5. Modalités de signalement

### Canal

Les alertes partent vers un **salon Discord privé de l'équipe**, via le
récepteur `discord_configs` d'**Alertmanager** (`monitoring/alertmanager/`).
Discord est déjà le canal de la communauté FRVtubers et celui par lequel
remontent les retours utilisateurs : router les alertes techniques au même
endroit évite d'avoir à surveiller deux surfaces, et permet de corréler
immédiatement une alerte technique avec un signalement d'utilisateur.

### Cadence de rappel

| Sévérité | Délai avant 1er envoi | Rappel tant que non résolu |
|----------|----------------------|---------------------------|
| P0 | 10 s | toutes les 30 min |
| P1 | 45 s | toutes les 4 h |
| P2 / P3 | 45 s | toutes les 24 h |

Le regroupement (`group_by: [alertname, severity]`, `group_wait`) évite la
rafale : une coupure réseau déclenche simultanément `SiteIndisponible` et
`ApiAppwriteIndisponible`, autant n'envoyer qu'une notification. Le retour à
la normale est notifié également (`send_resolved: true`), sans quoi on ne
saurait jamais qu'un incident s'est résorbé seul.

**Inhibition.** Deux règles taisent les alertes de conséquence quand la cause
est déjà notifiée : `LatenceElevee` est supprimée si `SiteIndisponible` est
active sur la même cible — un site injoignable est trivialement lent, l'alerter
deux fois dilue le signal. De même, les alertes P2/P3 d'une cible sont tues
quand sa collecte est interrompue : leurs valeurs ne veulent plus rien dire.

### Autres canaux de signalement

| Événement | Canal | Automatisme |
|-----------|-------|-------------|
| Échec de déploiement ou de healthcheck | Issue GitHub `deploy-failure` | Créée par la CI ; commentaire ajouté si une issue est déjà ouverte |
| Findings de sécurité (Semgrep, Trivy, `pnpm audit`) | Issue GitHub `security-report` | Issue unique mise à jour, fermée automatiquement à 0 finding |
| Conteneur tombé | Aucun — relance automatique | `health-check.sh`, journalisé dans `/var/log/konfiturgame-health.log` |
| Crash côté navigateur | Collection `audit_logs` type `error` | `logClientError`, consultable dans `/admin/logs` |

---

## 6. Installation

### Stack de supervision

```bash
# 1. Renseigner les variables (voir .env.example)
#    GRAFANA_ADMIN_USER, GRAFANA_ADMIN_PASSWORD, DISCORD_ALERT_WEBHOOK
openssl rand -base64 24     # mot de passe admin Grafana

# 2. Démarrer (production — l'override de dev n'est pas appliqué)
docker compose -f docker-compose.yml up -d \
  prometheus grafana node-exporter cadvisor blackbox-exporter

# 3. Vérifier que toutes les cibles sont collectées
docker exec konfitur-prometheus \
  wget -qO- http://localhost:9090/api/v1/targets | grep -o '"health":"[a-z]*"' | sort | uniq -c

# 4. Ouvrir https://grafana.konfiturgame.fr
#    Tableau de bord « KonfiturGame — Production » déjà provisionné
```

### Valider la supervision en local avant de déployer

La stack tourne aussi en développement, avec un simple `docker compose up`.
C'est volontaire : une supervision dont on ne découvre les défauts qu'en
production ne remplit pas son office. La seule différence tient aux cibles des
sondes — les URL locales au lieu de `konfiturgame.fr`, sans quoi le poste de
développement viendrait marteler le site public et remonter de fausses alertes.

| Élément | Production | Développement |
|---------|-----------|---------------|
| Config Prometheus | `prometheus.yml` | `prometheus.dev.yml` |
| Modules blackbox | `blackbox.yml` | `blackbox.dev.yml` (sans `fail_if_not_ssl`) |
| Cibles des sondes | `konfiturgame.fr`, `api.konfiturgame.fr` | `frontend:3000`, `appwrite`, `traefik` |
| Grafana | `https://grafana.konfiturgame.fr` (TLS, Traefik) | `http://localhost:3001` (admin / admin) |
| Prometheus | non exposé | `http://localhost:9090` |
| **Règles d'alerte** | `alerts.yml` | **`alerts.yml` — le même fichier** |

Les seuils et les sévérités ne divergent pas entre les deux environnements :
c'est la condition pour qu'un test local prouve quelque chose sur la production.

```bash
# 1. Démarrer la stack complète, supervision comprise
docker compose up -d

# 2. Vérifier la chaîne de bout en bout (cibles, sondes, règles chargées,
#    Alertmanager raccordé, collecteur textfile monté) — sortie 1 si anomalie
bash scripts/ci/monitoring-check.sh

# 3. Grafana → http://localhost:3001 (admin / admin)
#    Le tableau de bord « KonfiturGame — Production » est déjà provisionné
```

Le script s'adresse aussi à une instance distante : `monitoring-check.sh
http://prometheus.interne:9090`.

**Exercer une alerte pour de vrai.** Le meilleur test de la chaîne complète
consiste à provoquer une panne :

```bash
docker compose stop frontend      # → SiteIndisponible (P0) après 2 min
docker compose start frontend     # → notification de résolution
```

En dev, `SauvegardeJamaisExecutee` se déclenche au bout d'une heure si
`backup.sh` n'a jamais tourné localement. Ce n'est pas un faux positif : c'est
une occasion gratuite de vérifier que le webhook Discord fonctionne avant la
mise en production. Pointer `DISCORD_ALERT_WEBHOOK` sur un salon de test —
**jamais celui de la production**.

**Deux limites du test local**, à connaître pour ne pas se croire couvert :

- `node-exporter` et cAdvisor mesurent la VM Docker Desktop, pas l'hôte
  Windows. Les valeurs absolues de CPU, mémoire et disque n'ont donc pas de
  sens en dev ; ce qui est validé, c'est que la collecte et l'évaluation des
  règles fonctionnent.
- Les sondes TLS et la sonde de protection du dashboard Traefik n'existent pas
  en dev : la stack locale est en HTTP simple et le dashboard y est en accès
  libre (`api.insecure: true`). `CertificatTlsBientotExpire` et
  `DashboardTraefikNonProtege` ne peuvent pas être éprouvées par la stack
  locale — d'où les tests de règles ci-dessous, qui les couvrent hors ligne.

### Tests automatisés de la supervision

Une supervision est du code de production : elle se teste. Trois niveaux, du
moins cher au plus proche du réel.

| Niveau | Outil | Ce qu'il attrape | Où |
|--------|-------|------------------|-----|
| Syntaxe | `promtool check config` / `amtool check-config` | Fichier refusé au chargement | CI, job `monitoring` |
| Logique des règles | `promtool test rules` | Seuil, `for:`, expression PromQL fausse | CI, job `monitoring` |
| Chaîne réelle | `scripts/ci/monitoring-check.sh` | Cible morte, sonde en échec, montage rompu | manuel, stack démarrée |

Le mode de panne qui justifie le premier niveau : une erreur de syntaxe dans
`alerts.yml` **n'empêche pas Prometheus de démarrer**. Il sert son interface,
collecte normalement, et n'évalue plus aucune règle. La supervision échoue en
silence et en vert — rien ne le signale, puisque c'est précisément ce qui
signale les choses qui est tombé.

`monitoring/prometheus/alerts.test.yml` couvre les règles que la stack de dev
ne peut pas exercer : seuils temporels (25 h pour les sauvegardes, 30 min pour
la sonde), certificats TLS, protection du dashboard Traefik, et la
non-régression du faux positif cAdvisor sous WSL2. promtool évalue sur une
horloge virtuelle : un `for: 1h` se vérifie en millisecondes.

```bash
# Les trois validations, avec les versions exactes de la production
PROM=$(sed -n 's|.*image: \(prom/prometheus:v[0-9.]*\).*|\1|p' docker-compose.yml | head -1)
docker run --rm --entrypoint promtool -v "$PWD/monitoring/prometheus:/etc/prometheus:ro" \
  "$PROM" check config /etc/prometheus/prometheus.yml
docker run --rm --entrypoint promtool -v "$PWD/monitoring/prometheus:/etc/prometheus:ro" \
  "$PROM" test rules /etc/prometheus/alerts.test.yml
```

Les versions sont lues dans `docker-compose.yml`, en CI comme ici : valider
avec un `promtool` d'une autre version que le Prometheus déployé ne prouve
rien.

> **Attention en modifiant `alerts.yml`.** promtool compare les alertes
> attendues sur la totalité de leurs labels **et** de leurs annotations, sans
> correspondance partielle : reformuler une `description` fait rougir le test
> correspondant. C'est voulu — cette description est le mode d'emploi que lit
> l'astreinte, elle se modifie sciemment. Mettre à jour `alerts.test.yml` dans
> la même passe.

### Tâches planifiées

```bash
sudo cp scripts/crontab.konfiturgame /etc/cron.d/konfiturgame
sudo chown root:root /etc/cron.d/konfiturgame
sudo chmod 644 /etc/cron.d/konfiturgame    # cron ignore un fichier
                                           # writable par le groupe
sudo systemctl restart cron

# Vérifier au bout de 5 minutes
tail -f /var/log/konfiturgame-health.log
cat monitoring/textfile/health_check.prom
```

| Tâche | Cadence | Effet |
|-------|---------|-------|
| `health-check.sh` | toutes les 5 min | Relance les conteneurs critiques tombés |
| `backup.sh` | tous les jours à 2 h | Produit `backups/AAAA-MM-JJ_HH-MM.tar.gz` et purge au-delà de 7 archives |
| `docker system prune -f` | lundi 5 h | Images intermédiaires des rebuilds |
| Troncature des journaux | 1er du mois | Fichiers `/var/log/konfiturgame-*.log` > 50 Mo |

La rotation des sauvegardes est portée par `backup.sh` lui-même, pas par une
ligne de cron distincte : deux endroits qui décident de la rétention finissent
par diverger. Sept archives couvrent une semaine glissante — assez pour
remonter avant un incident détecté le lundi matin, sans laisser `backups/`
saturer le disque et déclencher `EspaceDisqueCritique`.

### Webhook Discord

Il s'agit d'un **webhook entrant**, créé dans le client Discord — et non dans le
Developer Portal, dont la section « Webhooks » sert à l'inverse (recevoir des
événements Discord vers une application).

```
Serveur → clic droit sur le salon → Modifier le salon
       → Intégrations → Webhooks → Nouveau webhook
       → Copier l'URL du webhook
```

L'URL a la forme `https://discord.com/api/webhooks/<id>/<token>`. La permission
« Gérer les webhooks » est requise sur le serveur.

```bash
# .env — jamais commité (.gitignore + scan gitleaks bloquant en CI)
DISCORD_ALERT_WEBHOOK=https://discord.com/api/webhooks/...
docker compose -f docker-compose.yml up -d alertmanager
```

Tester la chaîne complète sans attendre un incident :

```bash
curl -s -XPOST http://localhost:9093/api/v2/alerts -H 'Content-Type: application/json'   -d '[{"labels":{"alertname":"TestRoutage","severity":"P0"},
       "annotations":{"summary":"Test","description":"Vérification du routage"}}]'
docker compose logs alertmanager --since=1m | grep -i notify
```

L'alerte doit apparaître dans le salon en une dizaine de secondes (P0 :
`group_wait: 10s`). Elle se résout d'elle-même au bout de 5 minutes.

> **Deux salons distincts.** Le webhook de développement doit pointer un salon
> dédié (`#alertes-dev`), jamais celui de la production : valider la chaîne
> revient à provoquer un P0, et un salon de production qui crie au loup finit
> par être ignoré — c'est la panne suivante qui passe alors inaperçue.
>
> **Cette URL est un secret.** Quiconque la détient peut publier dans le salon
> sans authentification. En cas de fuite, le bouton « Supprimer » de la même
> interface Discord la révoque immédiatement.
>
> **Ne pas la laisser vide.** Alertmanager démarre quand même, mais chaque
> envoi échoue sur `unsupported protocol scheme ""`. L'URL est masquée dans les
> logs (`<redacted>`), donc c'est ce message précis qu'il faut chercher :
> `docker compose logs alertmanager | grep -i notify`.

---

## 7. Exploitation courante

| Question | Où regarder |
|----------|-------------|
| Le site est-il debout ? | Grafana → « Disponibilité des surfaces publiques » |
| Pourquoi est-ce lent ? | « Temps de réponse des sondes », puis « Mémoire par conteneur » |
| D'où viennent les erreurs ? | « Répartition des codes de retour », puis `docker compose logs traefik` |
| La sauvegarde a-t-elle tourné ? | « Dernière sauvegarde réussie » |
| Qui s'est connecté, quels bots ont été bloqués ? | `/admin/logs` (filtres `auth`, `error`, `admin_action`) |
| Une alerte est-elle active ? | Grafana → Alerting → Alert rules |

**Revue hebdomadaire** (15 min) : parcourir les alertes P2/P3 accumulées,
vérifier la tendance de l'espace disque et de la taille des sauvegardes,
consulter l'issue `security-report`.

---

## 8. Dépannage

| Symptôme | Cause probable | Correction |
|----------|---------------|-----------|
| Toutes les sondes blackbox à 0, site accessible au navigateur | UA de la sonde bloqué par la détection de bots | Vérifier l'en-tête `User-Agent` dans `monitoring/blackbox/blackbox.yml`, puis débannir l'IP dans `/admin/logs` |
| Cible `traefik` en `down` dans Prometheus | Entrypoint `metrics` absent ou Traefik hors de `monitoring-net` | Vérifier `traefik/traefik.yml` (`metrics:` + entrypoint `:8082`) et le bloc `networks:` du service traefik |
| Grafana affiche une page blanche | CSP trop stricte | Le routeur doit utiliser `grafana-headers@file`, pas `security-headers@file` |
| Aucune métrique `konfitur_backup_*` | `backup.sh` n'a jamais tourné, ou montage textfile absent | `ls monitoring/textfile/` puis lancer `./scripts/backup.sh` à la main |
| Alertes non reçues sur Discord | Webhook vide ou révoqué | `docker compose logs alertmanager \| grep -i notify` — l'URL est masquée dans les logs, une erreur `unsupported protocol scheme ""` signifie que `DISCORD_ALERT_WEBHOOK` est vide |
| Alertes `firing` mais aucune notification | Prometheus n'a pas d'Alertmanager | `curl -s localhost:9090/api/v1/alertmanagers` — `activeAlertmanagers` doit être non vide. Les politiques de notification **Grafana** ne routent pas les règles évaluées par Prometheus |
| `health-check.sh` relance en boucle un conteneur | Échec de démarrage répété, pas un crash ponctuel | `docker compose logs --tail=100 <service>` — souvent une variable d'environnement manquante |

---

*KonfiturGame · Supervision et alertes · Mis à jour : 2026-08-01*
