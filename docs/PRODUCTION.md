# KonfiturGame — Production

La procédure complète de déploiement est dans **[DEPLOIEMENT.md](DEPLOIEMENT.md)**.

---

## État IaC Appwrite

L'infrastructure Appwrite est progressivement versionnée dans `appwrite.json` (racine du repo).

| Phase | Ressource | État |
|-------|-----------|------|
| Phase 1 | Fonctions (`functions/**`) | Actif — CI déploie sur push `main` |
| Phase 2 | Collections / Schéma | À activer — voir `docs/MISE-A-JOUR.md §7` |
| Phase 3 | Buckets Storage | Non commencé |

## Rappel des URL de production

| URL | Service |
|-----|---------|
| `https://konfiturgame.fr` | Frontend Next.js |
| `https://api.konfiturgame.fr/console` | Console Appwrite |
| `https://api.konfiturgame.fr/v1/health` | Healthcheck Appwrite |
| `https://traefik.konfiturgame.fr/dashboard/` | Dashboard Traefik (auth requise) |

## Commandes de première urgence

```bash
# État des services
docker compose ps
docker compose logs -f [service]

# Backup immédiat
./scripts/backup.sh

# Healthcheck
curl -s https://api.konfiturgame.fr/v1/health | grep '"status":"pass"'
curl -s -o /dev/null -w '%{http_code}' https://konfiturgame.fr   # → 200

# Redémarrage d'urgence
docker compose -f docker-compose.yml up -d --force-recreate

# Déployer les fonctions Appwrite manuellement
appwrite push functions --force
```

Pour le rollback, la restauration et la migration vers un autre serveur : **[DEPLOIEMENT.md](DEPLOIEMENT.md)**.