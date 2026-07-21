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
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'cloud.appwrite.io',
      },
      {
        protocol: 'https',
        hostname: '**.localhost',
      },
    ],
  },
}

export default nextConfig
