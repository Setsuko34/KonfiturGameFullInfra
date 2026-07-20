// Partagé entre le chat de jam (actions/chat.ts) et le tchat d'équipe (actions/team-chat.ts).
export const CHAT_BATCH_SIZE = 50 // taille de lot délibérée, contrat commun aux deux chats

/**
 * Sanitisation des messages de chat : pas de HTML, longueur validée APRÈS
 * échappement (l'expansion &lt;/&gt; peut faire dépasser la colonne 2048).
 * Ne jamais tronquer après échappement (risque de couper une entité).
 */
export function sanitizeChatContent(
  content: string
): { ok: true; content: string } | { ok: false; error: string } {
  const sanitized = content.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')
  if (!sanitized) return { ok: false, error: 'Le message ne peut pas être vide.' }
  if (sanitized.length > 2048) return { ok: false, error: 'Le message est trop long.' }
  return { ok: true, content: sanitized }
}
