Reste a faire ! 

- [ ] Ajouter une section "Contributing" pour encourager les contributions à la documentation.
- [ ] Ajouter une section "License" pour préciser les droits d'utilisation de la documentation.
- [ ] Ajouter une section "Contact" pour fournir des informations de contact en cas de questions ou de problèmes.
- [ ] Ajouter une section "Changelog" pour documenter les changements majeurs dans la documentation au fil du temps.
- [ ] Ajouter des liens vers des ressources externes utiles, comme la documentation officielle d'Appwrite, des tutoriels, ou des forums de discussion.
- [ ] Ajouter une section "FAQ" pour répondre aux questions fréquemment posées sur le projet, l'installation, ou l'utilisation.
- [ ] Ajouter des captures d'écran ou des diagrammes pour illustrer les étapes d'installation, la structure du projet, ou les flux de travail.
- [ ] Ajouter des exemples de commandes Docker Compose pour démarrer, arrêter, ou dépanner l'environnement de développement.
- [ ] Ajouter des instructions pour la mise à jour de l'environnement de développement, notamment comment gérer les mises à jour d'Appwrite ou des dépendances.
  - [ ] Ajouter des conseils pour le dépannage des problèmes courants, comme les erreurs de connexion à la base de données, les problèmes d'authentification, ou les erreurs de configuration de Traefik.
  
TEST : 
1. Ajout des test unitaires 
2. Ajout des test fonctionnels 
3. Vérification du bon fonctionnement de realtime
4. Redirection vers FRVTuber (car projet imaginer par eux)

FONCTIONNALITÉS :
1. Possibilité d'acceder a son profil, de le gérer, modifier, et de le supprimer
2. Annonces publiables par les organisateurs sur leurs Jams uniquement
3. Possibilité de modifier une jam en cours (correction mineure seulement) 
4. Ajouter des logs pour l'admin pour voir tout les crash et autre, suivre les connexions a l'app (voir une map des emplacement, autoban les bot qui scanne le web etc etc )
5. Améliorer le SEO de toute l'app
   Récapitulatif de l'implémentation

┌─────────────────────────────────┬───────────────┬────────────────────────────────────┐                                                
│             Fichier             │     Tests     │       Bugs trouvés en route        │                                                
├─────────────────────────────────┼───────────────┼────────────────────────────────────┤                                                
│ appwrite-mappers.test.ts        │ 15            │ —                                  │                                                
├─────────────────────────────────┼───────────────┼────────────────────────────────────┤                                                
│ profile-validators.test.ts      │ +7 (total 15) │ Bug NaN dans validators.ts corrigé │                                                
├─────────────────────────────────┼───────────────┼────────────────────────────────────┤                                                
│ actions-profile.test.ts         │ 10            │ Asymétrie trim bio documentée      │                                                
├─────────────────────────────────┼───────────────┼────────────────────────────────────┤                                                
│ actions-chat.test.ts            │ 9             │ —                                  │                                                
├─────────────────────────────────┼───────────────┼────────────────────────────────────┤                                                
│ actions-teams.test.ts           │ 6             │ —                                  │                                                
├─────────────────────────────────┼───────────────┼────────────────────────────────────┤                                                
│ vitest.config.ts + package.json │ —             │ —                                  │                                                
└─────────────────────────────────┴───────────────┴────────────────────────────────────┘

PROD : 
1. Mettre en place l'environnement de production (Docker Compose ou Kubernetes)
2. Prendre un VPS pour héberger l'application
3. Configurer le nom de domaine KonfiturGame.fr
4. Configurer les certificats SSL avec Let's Encrypt
5. Mettre en place de la surveillance et des alertes pour l'application en production
6. Effectuer des tests de charge pour s'assurer que l'application peut gérer le trafic attendu
7. Mettre en place un processus de déploiement continu pour faciliter les mises à jour
8. Documenter le processus de déploiement et les étapes à suivre pour les mises à jour futures
9. Assurer la sécurité de l'application en production, notamment en configurant correctement les pare-feu, en utilisant des mots de passe forts, et en appliquant les mises à jour de sécurité régulièrement.