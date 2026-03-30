// ═══════════════════════════════════════════════════════════
// Validators — fonctions de validation pures (sans I/O)
// ═══════════════════════════════════════════════════════════

export interface ValidationResult {
  valid: boolean
  error?: string
}

export interface UpdateJamData {
  description?: string
  rules?: string[]
  prizes?: string[]
  maxParticipants?: number
  tags?: string[]
}

const ALLOWED_JAM_UPDATE_FIELDS = new Set(['description', 'rules', 'prizes', 'maxParticipants', 'tags'])

export function validateUpdateJamData(data: UpdateJamData): ValidationResult {
  const record = data as Record<string, unknown>
  for (const key of Object.keys(record)) {
    if (!ALLOWED_JAM_UPDATE_FIELDS.has(key)) {
      return { valid: false, error: `Champ "${key}" non autorisé à la modification` }
    }
  }
  if ('description' in record) {
    const desc = record.description
    if (typeof desc !== 'string' || desc.trim().length === 0) {
      return { valid: false, error: 'La description ne peut pas être vide' }
    }
    if (desc.length > 5000) {
      return { valid: false, error: 'La description dépasse 5000 caractères' }
    }
  }
  if ('rules' in record) {
    const rules = record.rules
    if (!Array.isArray(rules)) return { valid: false, error: 'Les règles doivent être un tableau' }
    if (rules.length > 20) return { valid: false, error: 'Maximum 20 règles autorisées' }
  }
  if ('maxParticipants' in record) {
    const max = record.maxParticipants
    if (typeof max !== 'number' || max < 2 || max > 10000) {
      return { valid: false, error: 'maxParticipants doit être entre 2 et 10000' }
    }
  }
  return { valid: true }
}

export interface AnnouncementData {
  title: string
  content: string
  important: boolean
}

export function validateAnnouncementData(data: AnnouncementData): ValidationResult {
  if (!data.title || data.title.trim().length === 0) {
    return { valid: false, error: 'Le titre est requis' }
  }
  if (data.title.length > 100) {
    return { valid: false, error: 'Le titre dépasse 100 caractères' }
  }
  if (!data.content || data.content.trim().length === 0) {
    return { valid: false, error: 'Le contenu est requis' }
  }
  if (data.content.length > 2000) {
    return { valid: false, error: 'Le contenu dépasse 2000 caractères' }
  }
  return { valid: true }
}
