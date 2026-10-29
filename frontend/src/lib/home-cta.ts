// ═══════════════════════════════════════════════════════════
// Variante du CTA de la page d'accueil selon l'état de session
// Fonction pure — aucun I/O, aucune dépendance externe
// ═══════════════════════════════════════════════════════════

export type HomeCtaVariant = 'loading' | 'guest' | 'member'

// `loading` prime sur `user` : tant que la session charge, on n'affiche ni
// l'invitation à s'inscrire ni le lien membre, pour éviter un flash de contenu.
export function getHomeCtaVariant(auth: { loading: boolean; user: unknown | null }): HomeCtaVariant {
  if (auth.loading) return 'loading'
  return auth.user ? 'member' : 'guest'
}
