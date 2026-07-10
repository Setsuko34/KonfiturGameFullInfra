// Endpoint Appwrite atteint côté serveur via le réseau Docker (ex: http://appwrite/v1).
// NB : forcer le Host pour contourner la router protection est impossible avec
// node-appwrite 22 (fetch natif → "host" est un header interdit, silencieusement ignoré).
// La protection est donc désactivée côté Appwrite (voir docker-compose*.yml).
export const appwriteInternalEndpoint =
  process.env.APPWRITE_INTERNAL_ENDPOINT ?? process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!
