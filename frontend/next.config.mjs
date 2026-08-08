/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['node-appwrite'],
  // Pages prérendues → Next les sert en `s-maxage=31536000` (pensé pour un CDN,
  // qu'on n'a pas). Le navigateur (Safari surtout) cache alors le HTML par
  // heuristique et, après un redeploy, référence des chunks JS aux hash disparus
  // → 404 → écran blanc sur les pages client. On force la revalidation du HTML/RSC
  // (l'ETag rend le 304 gratuit). `/_next/*` EXCLU : ses chunks hashés restent
  // immutables (sinon on tuerait leur cache).
  async headers() {
    return [
      {
        source: '/((?!_next/).*)',
        headers: [{ key: 'Cache-Control', value: 'no-cache' }],
      },
    ]
  },
  // Aucun hôte distant autorisé — et c'est une décision de sécurité, pas un
  // oubli. `/_next/image?url=…` est un endpoint PUBLIC : tout hôte listé ici
  // devient une source d'octets que notre serveur va chercher lui-même puis
  // faire décoder par sharp/libvips, avec les CVE que ça traîne
  // (GHSA-f88m-g3jw-g9cj). `cloud.appwrite.io` y figurait alors qu'il n'est
  // référencé nulle part dans src/ : n'importe qui pouvant déposer un fichier
  // sur Appwrite Cloud disposait d'un chemin vers libvips côté serveur.
  //
  // Les images utilisateur sont servies en <img> nu depuis notre Appwrite
  // auto-hébergé et ne passent donc jamais par l'optimiseur ; le seul
  // next/image sur du contenu non local est l'aperçu de cover, en objectURL
  // + `unoptimized`, qui reste côté navigateur.
  //
  // Ajouter un hôte ici, c'est accepter de décoder ses octets sur le serveur.
  images: {
    remotePatterns: [],
  },
}

export default nextConfig
