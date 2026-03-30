# Profil Utilisateur + Annonces Organisateurs + Édition Jam — Plan d'Implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre aux utilisateurs de gérer leur profil (modification, suppression), aux organisateurs de publier des annonces sur leurs jams, et d'éditer les champs mineurs d'une jam en cours.

**Architecture:** Les actions de profil utilisent `createSessionClient()` (scoped session) pour accéder aux APIs Appwrite Account avec les permissions correctes. Les annonces et l'édition de jam réutilisent le pattern `serverDatabases` + vérification `organizer_id === user.$id`. Les composants de formulaire sont `'use client'` et appellent des Server Actions.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, node-appwrite 13 (server), appwrite 14 (client), Tailwind CSS v4, lucide-react. Vitest pour les tests unitaires des fonctions pures.

---

## Cartographie des fichiers

| Fichier | Action | Responsabilité |
|---------|--------|----------------|
| `frontend/package.json` | Modifier | Ajouter vitest, @vitejs/plugin-react |
| `frontend/vitest.config.ts` | Créer | Config vitest (jsdom, path aliases) |
| `frontend/src/types/index.ts` | Modifier | Ajouter `UpdateJamData` |
| `frontend/src/lib/actions/profile.ts` | Créer | Server Actions profil : lecture, mise à jour nom/bio, mot de passe, suppression compte |
| `frontend/src/lib/actions/announcements.ts` | Créer | Server Actions annonces organisateur : créer, lister, supprimer |
| `frontend/src/lib/actions/dashboard.ts` | Modifier | Ajouter `updateJam()` |
| `frontend/src/app/dashboard/profile/page.tsx` | Créer | Page dashboard profil (Server Component) |
| `frontend/src/app/dashboard/profile/ProfileForm.tsx` | Créer | Formulaire édition profil (Client Component) |
| `frontend/src/app/dashboard/DashboardSidebar.tsx` | Modifier | Ajouter lien "Mon profil" |
| `frontend/src/app/dashboard/my-jams/[jamId]/page.tsx` | Modifier | Intégrer EditJamForm + AnnouncementForm + liste annonces |
| `frontend/src/app/dashboard/my-jams/[jamId]/EditJamForm.tsx` | Créer | Formulaire édition jam (Client Component) |
| `frontend/src/app/dashboard/my-jams/[jamId]/AnnouncementForm.tsx` | Créer | Formulaire publication annonce (Client Component) |
| `frontend/src/app/profile/[userId]/page.tsx` | Créer | Profil public d'un utilisateur |
| `frontend/src/__tests__/profile-validators.test.ts` | Créer | Tests unitaires fonctions de validation |

---

### Task 1 : Setup Vitest

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/vitest.config.ts`

- [ ] **Step 1 : Ajouter vitest aux devDependencies**

Dans `frontend/package.json`, ajouter dans `"scripts"` et `"devDependencies"` :

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2 : Créer `frontend/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 3 : Installer les dépendances**

```bash
cd frontend && pnpm install
```

Attendu : installation sans erreur, `pnpm-lock.yaml` mis à jour.

- [ ] **Step 4 : Vérifier que vitest fonctionne**

```bash
cd frontend && pnpm test
```

Attendu : `No test files found, exiting with code 1` (OK, pas encore de tests).

- [ ] **Step 5 : Commit**

```bash
git add frontend/package.json frontend/vitest.config.ts frontend/pnpm-lock.yaml
git commit -m "chore: ajouter vitest pour les tests unitaires"
```

---

### Task 2 : Types et fonctions de validation

**Files:**
- Modify: `frontend/src/types/index.ts`
- Create: `frontend/src/lib/validators.ts`
- Create: `frontend/src/__tests__/profile-validators.test.ts`

- [ ] **Step 1 : Écrire le test de la fonction `validateUpdateJamData`**

Créer `frontend/src/__tests__/profile-validators.test.ts` :

```typescript
import { describe, it, expect } from 'vitest'
import { validateUpdateJamData, validateAnnouncementData } from '@/lib/validators'

describe('validateUpdateJamData', () => {
  it('accepte des champs valides', () => {
    const result = validateUpdateJamData({ description: 'texte', rules: ['règle 1'] })
    expect(result.valid).toBe(true)
  })

  it('refuse les champs non autorisés', () => {
    const result = validateUpdateJamData({ title: 'nouveau titre' } as never)
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/champ.*non autorisé/i)
  })

  it('refuse une description vide', () => {
    const result = validateUpdateJamData({ description: '' })
    expect(result.valid).toBe(false)
  })

  it('refuse plus de 20 règles', () => {
    const result = validateUpdateJamData({ rules: Array(21).fill('règle') })
    expect(result.valid).toBe(false)
  })
})

describe('validateAnnouncementData', () => {
  it('accepte des données valides', () => {
    const result = validateAnnouncementData({ title: 'Titre', content: 'Contenu', important: false })
    expect(result.valid).toBe(true)
  })

  it('refuse un titre vide', () => {
    const result = validateAnnouncementData({ title: '', content: 'Contenu', important: false })
    expect(result.valid).toBe(false)
  })

  it('refuse un contenu > 2000 chars', () => {
    const result = validateAnnouncementData({ title: 'T', content: 'x'.repeat(2001), important: false })
    expect(result.valid).toBe(false)
  })

  it('refuse un titre > 100 chars', () => {
    const result = validateAnnouncementData({ title: 'x'.repeat(101), content: 'contenu', important: false })
    expect(result.valid).toBe(false)
  })
})
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

```bash
cd frontend && pnpm test
```

Attendu : FAIL — `Cannot find module '@/lib/validators'`

- [ ] **Step 3 : Créer `frontend/src/lib/validators.ts`**

```typescript
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

// Champs autorisés pour la modification d'une jam en cours
const ALLOWED_JAM_UPDATE_FIELDS = new Set(['description', 'rules', 'prizes', 'maxParticipants', 'tags'])

export function validateUpdateJamData(data: Record<string, unknown>): ValidationResult {
  for (const key of Object.keys(data)) {
    if (!ALLOWED_JAM_UPDATE_FIELDS.has(key)) {
      return { valid: false, error: `Champ "${key}" non autorisé à la modification` }
    }
  }

  if ('description' in data) {
    const desc = data.description
    if (typeof desc !== 'string' || desc.trim().length === 0) {
      return { valid: false, error: 'La description ne peut pas être vide' }
    }
    if (desc.length > 5000) {
      return { valid: false, error: 'La description dépasse 5000 caractères' }
    }
  }

  if ('rules' in data) {
    const rules = data.rules
    if (!Array.isArray(rules)) return { valid: false, error: 'Les règles doivent être un tableau' }
    if (rules.length > 20) return { valid: false, error: 'Maximum 20 règles autorisées' }
  }

  if ('maxParticipants' in data) {
    const max = data.maxParticipants
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
```

- [ ] **Step 4 : Ajouter `UpdateJamData` dans `frontend/src/types/index.ts`**

Ajouter à la fin du fichier :

```typescript
export interface UpdateJamData {
  description?: string
  rules?: string[]
  prizes?: string[]
  maxParticipants?: number
  tags?: string[]
}
```

- [ ] **Step 5 : Lancer les tests pour vérifier qu'ils passent**

```bash
cd frontend && pnpm test
```

Attendu : ✅ 8 tests passent

- [ ] **Step 6 : Vérifier le type-check**

```bash
cd frontend && pnpm type-check
```

Attendu : aucune erreur TypeScript

- [ ] **Step 7 : Commit**

```bash
git add frontend/src/lib/validators.ts frontend/src/types/index.ts frontend/src/__tests__/profile-validators.test.ts
git commit -m "feat: ajouter validators pour jam update et annonces"
```

---

### Task 3 : Server Actions — Gestion du profil

**Files:**
- Create: `frontend/src/lib/actions/profile.ts`

- [ ] **Step 1 : Créer `frontend/src/lib/actions/profile.ts`**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createSessionClient } from '@/lib/appwrite/session'
import { serverUsers } from '@/lib/appwrite/server'

// ── Lecture ────────────────────────────────────────────────────────────────

export async function getProfile() {
  const { account } = createSessionClient()
  return account.get()
}

// ── Mise à jour du nom ─────────────────────────────────────────────────────

export async function updateProfileName(name: string): Promise<{ success: boolean; error?: string }> {
  const trimmed = name.trim()
  if (trimmed.length === 0) return { success: false, error: 'Le nom ne peut pas être vide' }
  if (trimmed.length > 128) return { success: false, error: 'Le nom dépasse 128 caractères' }

  try {
    const { account } = createSessionClient()
    await account.updateName(trimmed)
    revalidatePath('/dashboard/profile')
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { success: false, error: msg }
  }
}

// ── Mise à jour de la bio (stockée dans Appwrite Preferences) ──────────────

export async function updateProfileBio(bio: string): Promise<{ success: boolean; error?: string }> {
  if (bio.length > 300) return { success: false, error: 'La bio dépasse 300 caractères' }

  try {
    const { account } = createSessionClient()
    const user = await account.get()
    await account.updatePrefs({ ...user.prefs, bio: bio.trim() })
    revalidatePath('/dashboard/profile')
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { success: false, error: msg }
  }
}

// ── Changement de mot de passe ─────────────────────────────────────────────
// Utilise le client session pour que Appwrite vérifie l'ancien mot de passe.

export async function updateProfilePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (newPassword.length < 8) return { success: false, error: 'Le nouveau mot de passe doit contenir au moins 8 caractères' }

  try {
    const { account } = createSessionClient()
    await account.updatePassword(newPassword, currentPassword)
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { success: false, error: msg }
  }
}

// ── Suppression du compte ──────────────────────────────────────────────────
// Supprime toutes les sessions puis le compte. Action irréversible.

export async function deleteAccount(): Promise<{ success: boolean; error?: string }> {
  try {
    const { account } = createSessionClient()
    const user = await account.get()
    // Supprimer via l'API admin (serverUsers) car account.delete() est expérimental en SDK 14
    await account.deleteSessions()
    await serverUsers.delete(user.$id)
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { success: false, error: msg }
  }
}
```

- [ ] **Step 2 : Vérifier le type-check**

```bash
cd frontend && pnpm type-check
```

Attendu : aucune erreur

- [ ] **Step 3 : Commit**

```bash
git add frontend/src/lib/actions/profile.ts
git commit -m "feat: Server Actions gestion profil utilisateur"
```

---

### Task 4 : Server Actions — Annonces organisateurs

**Files:**
- Create: `frontend/src/lib/actions/announcements.ts`

- [ ] **Step 1 : Créer `frontend/src/lib/actions/announcements.ts`**

```typescript
'use server'

import { ID, Query } from 'node-appwrite'
import { revalidatePath } from 'next/cache'
import { createSessionClient } from '@/lib/appwrite/session'
import { serverDatabases } from '@/lib/appwrite/server'
import { DATABASE_ID, COLLECTIONS } from '@/lib/appwrite/config'
import { mapDocToAnnouncement } from '@/lib/appwrite/types'
import { validateAnnouncementData } from '@/lib/validators'
import type { Announcement } from '@/types'

// ── Annonces d'une jam (lecture publique) ─────────────────────────────────

export async function getJamAnnouncements(jamId: string): Promise<Announcement[]> {
  try {
    const res = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.ANNOUNCEMENTS, [
      Query.equal('jam_id', jamId),
      Query.orderDesc('$createdAt'),
      Query.limit(50),
    ])
    return res.documents.map(mapDocToAnnouncement)
  } catch {
    return []
  }
}

// ── Créer une annonce (organisateur uniquement) ───────────────────────────

export async function createOrganizerAnnouncement(
  jamId: string,
  data: { title: string; content: string; important: boolean }
): Promise<{ success: boolean; error?: string }> {
  const validation = validateAnnouncementData(data)
  if (!validation.valid) return { success: false, error: validation.error }

  try {
    const { account } = createSessionClient()
    const user = await account.get()

    // Vérifier que l'utilisateur est bien l'organisateur
    const jamDoc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.GAME_JAMS, jamId)
    if (jamDoc.organizer_id !== user.$id) {
      return { success: false, error: 'Seul l\'organisateur peut publier des annonces' }
    }

    await serverDatabases.createDocument(
      DATABASE_ID,
      COLLECTIONS.ANNOUNCEMENTS,
      ID.unique(),
      {
        title: data.title.trim(),
        content: data.content.trim(),
        jam_id: jamId,
        important: data.important,
        author_id: user.$id,
        author_name: user.name || user.email,
      }
    )

    revalidatePath(`/dashboard/my-jams/${jamId}`)
    revalidatePath(`/jam/${jamId}`)
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { success: false, error: msg }
  }
}

// ── Supprimer une annonce (organisateur uniquement) ───────────────────────

export async function deleteOrganizerAnnouncement(
  jamId: string,
  announcementId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { account } = createSessionClient()
    const user = await account.get()

    // Vérifier propriété via la jam
    const jamDoc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.GAME_JAMS, jamId)
    if (jamDoc.organizer_id !== user.$id) {
      return { success: false, error: 'Accès non autorisé' }
    }

    await serverDatabases.deleteDocument(DATABASE_ID, COLLECTIONS.ANNOUNCEMENTS, announcementId)

    revalidatePath(`/dashboard/my-jams/${jamId}`)
    revalidatePath(`/jam/${jamId}`)
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { success: false, error: msg }
  }
}
```

- [ ] **Step 2 : Vérifier le type-check**

```bash
cd frontend && pnpm type-check
```

Attendu : aucune erreur

- [ ] **Step 3 : Commit**

```bash
git add frontend/src/lib/actions/announcements.ts
git commit -m "feat: Server Actions annonces organisateur avec vérification d'ownership"
```

---

### Task 5 : Server Action — Édition de jam

**Files:**
- Modify: `frontend/src/lib/actions/dashboard.ts`

- [ ] **Step 1 : Ajouter `updateJam` dans `frontend/src/lib/actions/dashboard.ts`**

À la fin du fichier, ajouter :

```typescript
// ── Édition jam (corrections mineures, owner only) ─────────────────────────

import { validateUpdateJamData, type UpdateJamData } from '@/lib/validators'

export async function updateJam(
  jamId: string,
  data: UpdateJamData
): Promise<{ success: boolean; error?: string }> {
  const validation = validateUpdateJamData(data as Record<string, unknown>)
  if (!validation.valid) return { success: false, error: validation.error }

  try {
    const user = await getCurrentUser()
    const jamDoc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.GAME_JAMS, jamId)

    if (jamDoc.organizer_id !== user.$id) {
      return { success: false, error: 'Seul l\'organisateur peut modifier cette jam' }
    }
    if (jamDoc.status === 'ended') {
      return { success: false, error: 'Impossible de modifier une jam terminée' }
    }

    const patch: Record<string, unknown> = {}
    if (data.description !== undefined) patch.description = data.description.trim()
    if (data.rules !== undefined) patch.rules = data.rules
    if (data.prizes !== undefined) patch.prizes = data.prizes
    if (data.maxParticipants !== undefined) patch.max_participants = data.maxParticipants
    if (data.tags !== undefined) patch.tags = data.tags

    await serverDatabases.updateDocument(DATABASE_ID, COLLECTIONS.GAME_JAMS, jamId, patch)

    revalidatePath(`/dashboard/my-jams/${jamId}`)
    revalidatePath(`/jam/${jamId}`)
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { success: false, error: msg }
  }
}
```

Note : ajouter aussi l'import de `validateUpdateJamData` et `UpdateJamData` en haut du fichier `dashboard.ts` avec les autres imports.

- [ ] **Step 2 : Vérifier le type-check**

```bash
cd frontend && pnpm type-check
```

Attendu : aucune erreur

- [ ] **Step 3 : Commit**

```bash
git add frontend/src/lib/actions/dashboard.ts
git commit -m "feat: Server Action updateJam (édition mineure, owner + non-ended seulement)"
```

---

### Task 6 : ProfileForm — Composant client formulaire profil

**Files:**
- Create: `frontend/src/app/dashboard/profile/ProfileForm.tsx`

- [ ] **Step 1 : Créer `frontend/src/app/dashboard/profile/ProfileForm.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Lock, AlertTriangle, Loader2 } from 'lucide-react'
import { updateProfileName, updateProfileBio, updateProfilePassword, deleteAccount } from '@/lib/actions/profile'
import type { Models } from 'appwrite'

interface Props {
  user: Models.User<Models.Preferences>
}

export default function ProfileForm({ user }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState(user.name || '')
  const [bio, setBio] = useState((user.prefs?.bio as string) || '')
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')

  const [infoMsg, setInfoMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [pwdMsg, setPwdMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSaveProfile = () => {
    startTransition(async () => {
      setInfoMsg(null)
      const [nameResult, bioResult] = await Promise.all([
        name !== user.name ? updateProfileName(name) : Promise.resolve({ success: true }),
        bio !== ((user.prefs?.bio as string) || '') ? updateProfileBio(bio) : Promise.resolve({ success: true }),
      ])
      if (!nameResult.success) {
        setInfoMsg({ type: 'error', text: nameResult.error ?? 'Erreur' })
        return
      }
      if (!bioResult.success) {
        setInfoMsg({ type: 'error', text: bioResult.error ?? 'Erreur' })
        return
      }
      setInfoMsg({ type: 'success', text: 'Profil mis à jour' })
    })
  }

  const handleChangePassword = () => {
    if (newPwd !== confirmPwd) {
      setPwdMsg({ type: 'error', text: 'Les mots de passe ne correspondent pas' })
      return
    }
    startTransition(async () => {
      setPwdMsg(null)
      const result = await updateProfilePassword(currentPwd, newPwd)
      if (result.success) {
        setPwdMsg({ type: 'success', text: 'Mot de passe mis à jour' })
        setCurrentPwd('')
        setNewPwd('')
        setConfirmPwd('')
      } else {
        setPwdMsg({ type: 'error', text: result.error ?? 'Erreur' })
      }
    })
  }

  const handleDeleteAccount = () => {
    if (deleteConfirm !== 'SUPPRIMER') return
    startTransition(async () => {
      const result = await deleteAccount()
      if (result.success) {
        router.push('/')
      } else {
        setInfoMsg({ type: 'error', text: result.error ?? 'Erreur lors de la suppression' })
      }
    })
  }

  const fieldStyle = {
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border)',
    color: 'var(--foreground)',
  }

  const btnStyle = {
    background: 'var(--primary)',
    color: 'var(--primary-foreground)',
  }

  const dangerStyle = {
    background: 'var(--secondary)',
    color: 'var(--secondary-foreground)',
  }

  return (
    <div className="space-y-8">
      {/* ─── Informations de base ─── */}
      <section aria-labelledby="info-heading">
        <h2 id="info-heading" className="text-base font-bold mb-4 flex items-center gap-2">
          Informations du profil
        </h2>
        <div className="p-6 border space-y-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div>
            <label htmlFor="profile-name" className="block text-xs tracking-widest uppercase mb-1.5"
              style={{ color: 'var(--muted-foreground)' }}>
              Nom d&apos;affichage
            </label>
            <input
              id="profile-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={128}
              className="w-full px-3 py-2 text-sm"
              style={fieldStyle}
              aria-describedby="name-hint"
            />
            <p id="name-hint" className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {name.length}/128
            </p>
          </div>

          <div>
            <label htmlFor="profile-bio" className="block text-xs tracking-widest uppercase mb-1.5"
              style={{ color: 'var(--muted-foreground)' }}>
              Bio
            </label>
            <textarea
              id="profile-bio"
              value={bio}
              onChange={e => setBio(e.target.value)}
              maxLength={300}
              rows={3}
              className="w-full px-3 py-2 text-sm resize-none"
              style={fieldStyle}
              aria-describedby="bio-hint"
            />
            <p id="bio-hint" className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {bio.length}/300
            </p>
          </div>

          <div>
            <p className="text-xs tracking-widest uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
              Email
            </p>
            <p className="text-sm" style={{ color: 'var(--foreground)' }}>{user.email}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              La modification de l&apos;email n&apos;est pas disponible pour le moment.
            </p>
          </div>

          {infoMsg && (
            <p role="alert" className="text-sm" style={{
              color: infoMsg.type === 'success' ? 'var(--success)' : 'var(--secondary)',
            }}>
              {infoMsg.text}
            </p>
          )}

          <button
            onClick={handleSaveProfile}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
            style={btnStyle}
            aria-busy={isPending}
          >
            {isPending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Save size={14} aria-hidden="true" />}
            Enregistrer
          </button>
        </div>
      </section>

      {/* ─── Changer le mot de passe ─── */}
      <section aria-labelledby="pwd-heading">
        <h2 id="pwd-heading" className="text-base font-bold mb-4 flex items-center gap-2">
          <Lock size={15} aria-hidden="true" />
          Changer le mot de passe
        </h2>
        <div className="p-6 border space-y-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          {(['current', 'new', 'confirm'] as const).map(field => (
            <div key={field}>
              <label
                htmlFor={`pwd-${field}`}
                className="block text-xs tracking-widest uppercase mb-1.5"
                style={{ color: 'var(--muted-foreground)' }}
              >
                {field === 'current' ? 'Mot de passe actuel' : field === 'new' ? 'Nouveau mot de passe' : 'Confirmer'}
              </label>
              <input
                id={`pwd-${field}`}
                type="password"
                value={field === 'current' ? currentPwd : field === 'new' ? newPwd : confirmPwd}
                onChange={e => {
                  if (field === 'current') setCurrentPwd(e.target.value)
                  else if (field === 'new') setNewPwd(e.target.value)
                  else setConfirmPwd(e.target.value)
                }}
                className="w-full px-3 py-2 text-sm"
                style={fieldStyle}
                autoComplete={field === 'current' ? 'current-password' : 'new-password'}
              />
            </div>
          ))}

          {pwdMsg && (
            <p role="alert" className="text-sm" style={{
              color: pwdMsg.type === 'success' ? 'var(--success)' : 'var(--secondary)',
            }}>
              {pwdMsg.text}
            </p>
          )}

          <button
            onClick={handleChangePassword}
            disabled={isPending || !currentPwd || !newPwd || !confirmPwd}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
            style={btnStyle}
            aria-busy={isPending}
          >
            {isPending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Lock size={14} aria-hidden="true" />}
            Changer le mot de passe
          </button>
        </div>
      </section>

      {/* ─── Zone de danger ─── */}
      <section aria-labelledby="danger-heading">
        <h2 id="danger-heading" className="text-base font-bold mb-4 flex items-center gap-2"
          style={{ color: 'var(--secondary)' }}>
          <AlertTriangle size={15} aria-hidden="true" />
          Zone de danger
        </h2>
        <div className="p-6 border space-y-4"
          style={{ background: 'var(--card)', borderColor: 'var(--secondary)' }}>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            La suppression de ton compte est <strong>irréversible</strong>. Toutes tes données
            (participations, équipes, projets) seront perdues.
          </p>
          <div>
            <label htmlFor="delete-confirm" className="block text-xs tracking-widest uppercase mb-1.5"
              style={{ color: 'var(--muted-foreground)' }}>
              Tape SUPPRIMER pour confirmer
            </label>
            <input
              id="delete-confirm"
              type="text"
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder="SUPPRIMER"
              className="w-full px-3 py-2 text-sm"
              style={fieldStyle}
              aria-describedby="delete-hint"
            />
            <p id="delete-hint" className="sr-only">Entrez le mot SUPPRIMER en majuscules pour activer le bouton.</p>
          </div>
          <button
            onClick={handleDeleteAccount}
            disabled={isPending || deleteConfirm !== 'SUPPRIMER'}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
            style={dangerStyle}
            aria-busy={isPending}
          >
            {isPending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <AlertTriangle size={14} aria-hidden="true" />}
            Supprimer mon compte définitivement
          </button>
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 2 : Vérifier le type-check**

```bash
cd frontend && pnpm type-check
```

Attendu : aucune erreur

- [ ] **Step 3 : Commit**

```bash
git add frontend/src/app/dashboard/profile/ProfileForm.tsx
git commit -m "feat: ProfileForm composant client (nom, bio, mot de passe, suppression)"
```

---

### Task 7 : Page Dashboard Profil

**Files:**
- Create: `frontend/src/app/dashboard/profile/page.tsx`

- [ ] **Step 1 : Créer `frontend/src/app/dashboard/profile/page.tsx`**

```tsx
import type { Metadata } from 'next'
import { getProfile } from '@/lib/actions/profile'
import ProfileForm from './ProfileForm'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Mon profil',
}

export default async function ProfilePage() {
  let user: Awaited<ReturnType<typeof getProfile>>
  try {
    user = await getProfile()
  } catch {
    redirect('/auth/login?redirect=/dashboard/profile')
  }

  return (
    <section aria-labelledby="profile-heading">
      <div className="mb-8">
        <p className="label-tech mb-1" style={{ color: 'var(--muted-foreground)' }}>
          DASHBOARD
        </p>
        <h1 id="profile-heading" className="text-2xl font-bold">Mon profil</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          Membre depuis le {new Date(user!.$createdAt).toLocaleDateString('fr-FR', {
            day: 'numeric', month: 'long', year: 'numeric'
          })}
        </p>
      </div>
      <ProfileForm user={user!} />
    </section>
  )
}
```

- [ ] **Step 2 : Vérifier que la page type-check**

```bash
cd frontend && pnpm type-check
```

Attendu : aucune erreur

- [ ] **Step 3 : Test manuel**

Naviguer vers `http://localhost:3000/dashboard/profile`. La page doit afficher le formulaire avec le nom et bio pré-remplis.

- [ ] **Step 4 : Commit**

```bash
git add frontend/src/app/dashboard/profile/page.tsx
git commit -m "feat: page dashboard/profile"
```

---

### Task 8 : Lien profil dans DashboardSidebar

**Files:**
- Modify: `frontend/src/app/dashboard/DashboardSidebar.tsx`

- [ ] **Step 1 : Ajouter l'import User et le lien profil dans la sidebar**

Dans `DashboardSidebar.tsx`, ajouter `User` aux imports lucide-react :

```tsx
import {
  Gamepad2, LayoutDashboard, Trophy, Users, Send,
  List, Plus, LogOut, Menu, X, Home, User,
} from 'lucide-react'
```

Dans le bloc "Participant", après `<NavLink href="/dashboard/participations"...>`, ajouter :

```tsx
<NavLink href="/dashboard/profile" icon={User} label="Mon profil" />
```

- [ ] **Step 2 : Vérifier le type-check + rendu**

```bash
cd frontend && pnpm type-check
```

Attendu : aucune erreur. En manuel : le lien "Mon profil" apparaît dans la sidebar sous "Mes participations".

- [ ] **Step 3 : Commit**

```bash
git add frontend/src/app/dashboard/DashboardSidebar.tsx
git commit -m "feat: lien Mon profil dans la sidebar dashboard"
```

---

### Task 9 : EditJamForm et AnnouncementForm

**Files:**
- Create: `frontend/src/app/dashboard/my-jams/[jamId]/EditJamForm.tsx`
- Create: `frontend/src/app/dashboard/my-jams/[jamId]/AnnouncementForm.tsx`

- [ ] **Step 1 : Créer `EditJamForm.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { Save, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { updateJam } from '@/lib/actions/dashboard'
import type { GameJam } from '@/types'

interface Props {
  jam: GameJam
}

export default function EditJamForm({ jam }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const [description, setDescription] = useState(jam.description)
  const [rulesText, setRulesText] = useState(jam.rules.join('\n'))
  const [prizesText, setPrizesText] = useState((jam.prizes ?? []).join('\n'))
  const [tagsText, setTagsText] = useState((jam.tags ?? []).join(', '))
  const [maxParticipants, setMaxParticipants] = useState(jam.maxParticipants?.toString() ?? '')
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSave = () => {
    startTransition(async () => {
      setMsg(null)
      const result = await updateJam(jam.id, {
        description: description.trim(),
        rules: rulesText.split('\n').map(r => r.trim()).filter(Boolean),
        prizes: prizesText.split('\n').map(p => p.trim()).filter(Boolean),
        tags: tagsText.split(',').map(t => t.trim()).filter(Boolean),
        ...(maxParticipants ? { maxParticipants: parseInt(maxParticipants, 10) } : {}),
      })
      if (result.success) {
        setMsg({ type: 'success', text: 'Jam mise à jour' })
      } else {
        setMsg({ type: 'error', text: result.error ?? 'Erreur inconnue' })
      }
    })
  }

  const fieldStyle = {
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border)',
    color: 'var(--foreground)',
  }

  if (jam.status === 'ended') return null

  return (
    <div className="mb-8 border" style={{ borderColor: 'var(--border)' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold"
        style={{ background: 'var(--card)' }}
        aria-expanded={open}
      >
        <span>Modifier la jam</span>
        {open
          ? <ChevronUp size={14} aria-hidden="true" />
          : <ChevronDown size={14} aria-hidden="true" />
        }
      </button>

      {open && (
        <div className="p-5 border-t space-y-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Seuls les champs mineurs peuvent être modifiés. Le titre, le thème, le slug et les dates sont figés.
          </p>

          <div>
            <label htmlFor="edit-description" className="block text-xs tracking-widest uppercase mb-1"
              style={{ color: 'var(--muted-foreground)' }}>
              Description
            </label>
            <textarea
              id="edit-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 text-sm resize-none"
              style={fieldStyle}
            />
          </div>

          <div>
            <label htmlFor="edit-rules" className="block text-xs tracking-widest uppercase mb-1"
              style={{ color: 'var(--muted-foreground)' }}>
              Règles (une par ligne)
            </label>
            <textarea
              id="edit-rules"
              value={rulesText}
              onChange={e => setRulesText(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 text-sm resize-none font-mono text-xs"
              style={fieldStyle}
            />
          </div>

          <div>
            <label htmlFor="edit-prizes" className="block text-xs tracking-widest uppercase mb-1"
              style={{ color: 'var(--muted-foreground)' }}>
              Prix (un par ligne)
            </label>
            <textarea
              id="edit-prizes"
              value={prizesText}
              onChange={e => setPrizesText(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm resize-none"
              style={fieldStyle}
            />
          </div>

          <div>
            <label htmlFor="edit-tags" className="block text-xs tracking-widest uppercase mb-1"
              style={{ color: 'var(--muted-foreground)' }}>
              Tags (séparés par des virgules)
            </label>
            <input
              id="edit-tags"
              type="text"
              value={tagsText}
              onChange={e => setTagsText(e.target.value)}
              className="w-full px-3 py-2 text-sm"
              style={fieldStyle}
            />
          </div>

          <div>
            <label htmlFor="edit-max" className="block text-xs tracking-widest uppercase mb-1"
              style={{ color: 'var(--muted-foreground)' }}>
              Maximum de participants (optionnel)
            </label>
            <input
              id="edit-max"
              type="number"
              value={maxParticipants}
              onChange={e => setMaxParticipants(e.target.value)}
              min={2}
              max={10000}
              className="w-full px-3 py-2 text-sm"
              style={fieldStyle}
            />
          </div>

          {msg && (
            <p role="alert" className="text-sm" style={{
              color: msg.type === 'success' ? 'var(--success)' : 'var(--secondary)',
            }}>
              {msg.text}
            </p>
          )}

          <button
            onClick={handleSave}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
            aria-busy={isPending}
          >
            {isPending
              ? <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              : <Save size={14} aria-hidden="true" />
            }
            Enregistrer les modifications
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2 : Créer `AnnouncementForm.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { Megaphone, Loader2, Trash2 } from 'lucide-react'
import { createOrganizerAnnouncement, deleteOrganizerAnnouncement } from '@/lib/actions/announcements'
import type { Announcement } from '@/types'

interface Props {
  jamId: string
  announcements: Announcement[]
}

export default function AnnouncementForm({ jamId, announcements }: Props) {
  const [isPending, startTransition] = useTransition()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [important, setImportant] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handlePublish = () => {
    startTransition(async () => {
      setMsg(null)
      const result = await createOrganizerAnnouncement(jamId, { title, content, important })
      if (result.success) {
        setTitle('')
        setContent('')
        setImportant(false)
        setMsg({ type: 'success', text: 'Annonce publiée' })
      } else {
        setMsg({ type: 'error', text: result.error ?? 'Erreur' })
      }
    })
  }

  const handleDelete = (announcementId: string) => {
    startTransition(async () => {
      await deleteOrganizerAnnouncement(jamId, announcementId)
    })
  }

  const fieldStyle = {
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border)',
    color: 'var(--foreground)',
  }

  return (
    <div className="mb-8">
      <h2 className="text-base font-bold mb-4 flex items-center gap-2">
        <Megaphone size={15} aria-hidden="true" />
        Annonces
      </h2>

      {/* Formulaire publication */}
      <div className="p-5 border mb-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <h3 className="text-xs tracking-widest uppercase mb-3" style={{ color: 'var(--muted-foreground)' }}>
          Publier une annonce
        </h3>
        <div className="space-y-3">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Titre de l'annonce"
            maxLength={100}
            className="w-full px-3 py-2 text-sm"
            style={fieldStyle}
            aria-label="Titre de l'annonce"
          />
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Contenu..."
            maxLength={2000}
            rows={3}
            className="w-full px-3 py-2 text-sm resize-none"
            style={fieldStyle}
            aria-label="Contenu de l'annonce"
          />
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={important}
              onChange={e => setImportant(e.target.checked)}
              className="accent-secondary"
            />
            <span>Marquer comme important</span>
          </label>

          {msg && (
            <p role="alert" className="text-sm" style={{
              color: msg.type === 'success' ? 'var(--success)' : 'var(--secondary)',
            }}>
              {msg.text}
            </p>
          )}

          <button
            onClick={handlePublish}
            disabled={isPending || !title.trim() || !content.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
            aria-busy={isPending}
          >
            {isPending
              ? <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              : <Megaphone size={14} aria-hidden="true" />
            }
            Publier
          </button>
        </div>
      </div>

      {/* Liste des annonces existantes */}
      {announcements.length > 0 && (
        <ul className="space-y-2" role="list" aria-label="Annonces publiées">
          {announcements.map(ann => (
            <li
              key={ann.id}
              className="px-4 py-3 border flex items-start justify-between gap-4"
              style={{
                background: 'var(--card)',
                borderColor: ann.important ? 'var(--secondary)' : 'var(--border)',
                borderLeft: ann.important ? '3px solid var(--secondary)' : undefined,
              }}
            >
              <div className="flex-1 min-w-0">
                {ann.important && (
                  <p className="label-tech text-xs mb-1" style={{ color: 'var(--secondary)' }}>IMPORTANT</p>
                )}
                <p className="font-semibold text-sm truncate">{ann.title}</p>
                <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--muted-foreground)' }}>
                  {ann.content}
                </p>
                <time className="text-xs mt-1 block" style={{ color: 'var(--muted-foreground)' }}
                  dateTime={ann.createdAt.toISOString()}>
                  {ann.createdAt.toLocaleDateString('fr-FR')}
                </time>
              </div>
              <button
                onClick={() => handleDelete(ann.id)}
                disabled={isPending}
                className="p-1.5 transition-opacity hover:opacity-70 flex-shrink-0"
                style={{ color: 'var(--muted-foreground)' }}
                aria-label={`Supprimer l'annonce : ${ann.title}`}
              >
                <Trash2 size={13} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {announcements.length === 0 && (
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Aucune annonce publiée.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 3 : Vérifier le type-check**

```bash
cd frontend && pnpm type-check
```

Attendu : aucune erreur

- [ ] **Step 4 : Commit**

```bash
git add "frontend/src/app/dashboard/my-jams/[jamId]/EditJamForm.tsx" \
        "frontend/src/app/dashboard/my-jams/[jamId]/AnnouncementForm.tsx"
git commit -m "feat: EditJamForm et AnnouncementForm pour les organisateurs"
```

---

### Task 10 : Intégrer les formulaires dans la page de gestion jam

**Files:**
- Modify: `frontend/src/app/dashboard/my-jams/[jamId]/page.tsx`

- [ ] **Step 1 : Modifier la page pour importer et afficher les formulaires**

Ajouter les imports en haut de `page.tsx` :

```tsx
import EditJamForm from './EditJamForm'
import AnnouncementForm from './AnnouncementForm'
import { getJamAnnouncements } from '@/lib/actions/announcements'
```

Modifier la fonction de chargement des données :

```tsx
export default async function ManageJamPage({ params }: Props) {
  let data: Awaited<ReturnType<typeof getOrganizedJamDetails>>
  let announcements: Awaited<ReturnType<typeof getJamAnnouncements>>
  try {
    [data, announcements] = await Promise.all([
      getOrganizedJamDetails(params.jamId),
      getJamAnnouncements(params.jamId),
    ])
  } catch {
    notFound()
  }
  const { jam, teams, projects } = data!
```

Juste avant la section "Équipes", insérer `EditJamForm` :

```tsx
<EditJamForm jam={jam} />
```

Juste avant les équipes, insérer `AnnouncementForm` :

```tsx
<AnnouncementForm jamId={jam.id} announcements={announcements!} />
```

- [ ] **Step 2 : Vérifier le type-check + rendu**

```bash
cd frontend && pnpm type-check
```

Attendu : aucune erreur. En manuel : la page `/dashboard/my-jams/[jamId]` affiche les sections édition et annonces.

- [ ] **Step 3 : Commit**

```bash
git add "frontend/src/app/dashboard/my-jams/[jamId]/page.tsx"
git commit -m "feat: intégrer EditJamForm et AnnouncementForm dans la gestion de jam"
```

---

### Task 11 : Page profil public

**Files:**
- Create: `frontend/src/app/profile/[userId]/page.tsx`

- [ ] **Step 1 : Créer `frontend/src/app/profile/[userId]/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Trophy, Gamepad2 } from 'lucide-react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { serverUsers } from '@/lib/appwrite/server'
import { serverDatabases } from '@/lib/appwrite/server'
import { DATABASE_ID, COLLECTIONS } from '@/lib/appwrite/config'
import { Query } from 'node-appwrite'
import { mapDocToGameJam } from '@/lib/appwrite/types'

interface Props { params: { userId: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const user = await serverUsers.get(params.userId)
    return { title: user.name || 'Profil' }
  } catch {
    return { title: 'Profil introuvable' }
  }
}

export default async function PublicProfilePage({ params }: Props) {
  let userName: string
  let userBio: string | undefined
  let memberSince: Date

  try {
    const user = await serverUsers.get(params.userId)
    userName = user.name || 'Anonyme'
    userBio = (user.prefs as Record<string, unknown>)?.bio as string | undefined
    memberSince = new Date(user.$createdAt)
  } catch {
    notFound()
  }

  // Jams organisées
  const organizedRes = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.GAME_JAMS, [
    Query.equal('organizer_id', params.userId),
    Query.orderDesc('$createdAt'),
    Query.limit(6),
  ])
  const organizedJams = organizedRes.documents.map(mapDocToGameJam)

  return (
    <>
      <Header />
      <main id="main-content" className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm mb-8"
          style={{ color: 'var(--muted-foreground)' }}
        >
          <ArrowLeft size={14} aria-hidden="true" /> Retour
        </Link>

        {/* En-tête profil */}
        <div className="p-6 border mb-8" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="flex items-start gap-4">
            <div
              className="w-16 h-16 flex items-center justify-center text-2xl font-bold flex-shrink-0"
              style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
              aria-hidden="true"
            >
              {userName!.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold">{userName!}</h1>
              {userBio && (
                <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>{userBio}</p>
              )}
              <p className="text-xs mt-2" style={{ color: 'var(--muted-foreground)' }}>
                Membre depuis {memberSince!.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        </div>

        {/* Jams organisées */}
        {organizedJams.length > 0 && (
          <section aria-labelledby="org-heading">
            <h2 id="org-heading" className="text-base font-bold mb-4 flex items-center gap-2">
              <Gamepad2 size={14} aria-hidden="true" />
              Jams organisées
            </h2>
            <ul className="space-y-2" role="list">
              {organizedJams.map(jam => (
                <li key={jam.id}>
                  <Link
                    href={`/jam/${jam.id}`}
                    className="block px-4 py-3 border transition-opacity hover:opacity-80"
                    style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                  >
                    <p className="font-semibold text-sm">{jam.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--primary)' }}>
                      Thème : {jam.theme}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="label-tech text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        {jam.status === 'ongoing' ? 'EN COURS' : jam.status === 'upcoming' ? 'À VENIR' : 'TERMINÉ'}
                      </span>
                      <span className="label-tech text-xs flex items-center gap-1" style={{ color: 'var(--muted-foreground)' }}>
                        <Trophy size={10} aria-hidden="true" /> {jam.participants} participants
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <Footer />
    </>
  )
}
```

- [ ] **Step 2 : Vérifier le type-check + rendu**

```bash
cd frontend && pnpm type-check
```

Attendu : aucune erreur.

Test manuel : naviguer vers `http://localhost:3000/profile/[userId]` avec l'ID d'un utilisateur existant.

- [ ] **Step 3 : Commit**

```bash
git add "frontend/src/app/profile/[userId]/page.tsx"
git commit -m "feat: page profil public /profile/[userId]"
```

---

### Vérification finale du Plan A

- [ ] **Type-check complet**

```bash
cd frontend && pnpm type-check
```

Attendu : 0 erreur

- [ ] **Tests unitaires**

```bash
cd frontend && pnpm test
```

Attendu : 8 tests passent

- [ ] **Build**

```bash
cd frontend && pnpm build
```

Attendu : build sans erreur
