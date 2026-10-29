// ═══════════════════════════════════════════════════════════
// Partenariat FRVtubers — constantes et détection de la mascotte
// Serveur uniquement (accès au système de fichiers)
// ═══════════════════════════════════════════════════════════

import fs from 'fs'
import path from 'path'

export const FRVTUBERS_URL = 'https://frvtubers.com'
export const KOKORI_SRC = '/kokori.png'

// Vrai si l'image de la mascotte est présente dans `public/`.
// Permet d'afficher la bannière sans image cassée tant que le PNG n'est pas déposé.
export function mascotAvailable(publicDir: string = path.join(process.cwd(), 'public')): boolean {
  return fs.existsSync(path.join(publicDir, 'kokori.png'))
}
