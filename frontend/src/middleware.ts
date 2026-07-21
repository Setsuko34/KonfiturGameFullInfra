// Point d'entrée middleware Edge — Next.js n'exécute QUE ce fichier (nommé
// `middleware.ts`, export `middleware`). Toute la logique (bot-detection, ban
// IP, protection /dashboard+/admin, redirection /auth) vit dans `proxy.ts` ;
// on la ré-exporte ici sous le nom attendu. Sans ce fichier, `proxy.ts` est du
// code mort et rien ne protège les routes en prod.
export { proxy as middleware, config } from './proxy'
