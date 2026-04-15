// Appwrite 1.8 route les requêtes par Host header ; quand le frontend appelle
// Appwrite via le réseau Docker (ex: http://appwrite/v1), Host = "appwrite"
// ne matche pas _APP_DOMAIN et tombe en fallback Sites (rule_not_found).
// Fix : forcer le Host sur la valeur publique attendue côté Appwrite.
export const appwritePublicHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? '').hostname
  } catch {
    return ''
  }
})()

export const appwriteInternalEndpoint =
  process.env.APPWRITE_INTERNAL_ENDPOINT ?? process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!
