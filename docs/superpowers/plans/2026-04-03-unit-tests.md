# Tests Unitaires — KonfiturGame Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une couverture de tests unitaires complète sur les fonctions pures (mappeurs, validators) et les Server Actions Next.js (logique de validation et sanitisation), sans dépendances lourdes comme jsdom ou @testing-library.

**Architecture:** Les tests sont organisés en deux couches — (1) fonctions pures sans I/O (mappeurs Appwrite, validators) testées directement, (2) Server Actions (profile, chat, teams) testées avec `vi.mock()` pour isoler les appels Appwrite. Vitest est déjà configuré (`environment: 'node'`). On n'ajoute PAS de tests de composants React (nécessiterait jsdom + @testing-library — YAGNI).

**Tech Stack:** Vitest 2.1.8, `vi.mock()` pour isoler node-appwrite et next/cache, TypeScript strict.

---

## Périmètre : ce qu'on NE teste PAS

- **Appwrite self-hosted** : son moteur n'est pas notre code. Les Server Actions Next.js sont notre "backend".
- **Composants React** : coût setup jsdom élevé, valeur marginale sur ce projet.
- **Fonctions 100% I/O** : `getJams()`, `getTeamsByJam()` etc. — pas de logique à tester.

## Map des fichiers

| Fichier créé/modifié | Responsabilité |
|---|---|
| `frontend/src/__tests__/appwrite-mappers.test.ts` *(créer)* | Tests des 7 mappeurs Appwrite → types applicatifs |
| `frontend/src/__tests__/profile-validators.test.ts` *(modifier)* | Étendre : ajouter tests maxParticipants |
| `frontend/src/__tests__/actions-profile.test.ts` *(créer)* | Tests guards de validation dans profile.ts |
| `frontend/src/__tests__/actions-chat.test.ts` *(créer)* | Tests sanitisation sendChatMessage |
| `frontend/src/__tests__/actions-teams.test.ts` *(créer)* | Tests format invite code + guards joinTeamByCode |
| `frontend/vitest.config.ts` *(modifier)* | Ajouter config coverage |
| `frontend/package.json` *(modifier)* | Ajouter script `test:coverage` |

---

## Task 1 : Tests mappeurs Appwrite

**Files:**
- Create: `frontend/src/__tests__/appwrite-mappers.test.ts`
- Read: `frontend/src/lib/appwrite/types.ts`
- Read: `frontend/src/types/index.ts`

- [ ] **Step 1 : Écrire les tests (ils vont passer car ce sont des fonctions pures déjà existantes)**

```typescript
// frontend/src/__tests__/appwrite-mappers.test.ts
import { describe, it, expect } from 'vitest'
import {
  mapDocToGameJam,
  mapDocToTeam,
  mapDocToTeamMember,
  mapDocToProject,
  mapDocToChatMessage,
  mapDocToAnnouncement,
  mapDocToComment,
} from '@/lib/appwrite/types'
import type { Models } from 'appwrite'

// Document Appwrite minimal avec les champs système requis
function makeDoc(fields: Record<string, unknown>): Models.Document {
  return {
    $id: 'doc-1',
    $createdAt: '2026-01-15T10:00:00.000Z',
    $updatedAt: '2026-01-15T10:00:00.000Z',
    $permissions: [],
    $collectionId: 'col-1',
    $databaseId: 'db-1',
    ...fields,
  } as Models.Document
}

// ────────────────────────────────────────
// mapDocToGameJam
// ────────────────────────────────────────
describe('mapDocToGameJam', () => {
  const baseJam = {
    title: 'Spring Jam 2026',
    slug: 'spring-jam-2026',
    theme: 'Printemps',
    description: 'Une jam printanière',
    status: 'upcoming',
    type: 'team',
    start_date: '2026-04-01T00:00:00.000Z',
    end_date: '2026-04-07T00:00:00.000Z',
    duration: '7 jours',
    organizer_id: 'org-1',
  }

  it('mappe les champs requis', () => {
    const jam = mapDocToGameJam(makeDoc(baseJam))
    expect(jam.id).toBe('doc-1')
    expect(jam.title).toBe('Spring Jam 2026')
    expect(jam.slug).toBe('spring-jam-2026')
    expect(jam.theme).toBe('Printemps')
    expect(jam.organizerId).toBe('org-1')
  })

  it('convertit start_date et end_date en objets Date', () => {
    const jam = mapDocToGameJam(makeDoc(baseJam))
    expect(jam.startDate).toBeInstanceOf(Date)
    expect(jam.endDate).toBeInstanceOf(Date)
    expect(jam.startDate.toISOString()).toBe('2026-04-01T00:00:00.000Z')
    expect(jam.endDate.toISOString()).toBe('2026-04-07T00:00:00.000Z')
  })

  it('applique les valeurs par défaut sur les champs optionnels', () => {
    const jam = mapDocToGameJam(makeDoc(baseJam))
    expect(jam.participants).toBe(0)
    expect(jam.rules).toEqual([])
    expect(jam.prizes).toEqual([])
    expect(jam.tags).toEqual([])
    expect(jam.organizer).toBe('')
    expect(jam.featured).toBe(false)
    expect(jam.coverImage).toBeUndefined()
  })

  it('mappe les champs optionnels quand présents', () => {
    const jam = mapDocToGameJam(makeDoc({
      ...baseJam,
      participants: 42,
      max_participants: 100,
      rules: ['Règle 1', 'Règle 2'],
      prizes: ['1er prix'],
      tags: ['retro'],
      organizer: 'KonfiturTeam',
      cover_image_id: 'img-abc',
      featured: true,
      featured_order: 1,
    }))
    expect(jam.participants).toBe(42)
    expect(jam.maxParticipants).toBe(100)
    expect(jam.rules).toEqual(['Règle 1', 'Règle 2'])
    expect(jam.prizes).toEqual(['1er prix'])
    expect(jam.tags).toEqual(['retro'])
    expect(jam.organizer).toBe('KonfiturTeam')
    expect(jam.coverImage).toBe('img-abc')
    expect(jam.featured).toBe(true)
    expect(jam.featuredOrder).toBe(1)
  })
})

// ────────────────────────────────────────
// mapDocToTeam
// ────────────────────────────────────────
describe('mapDocToTeam', () => {
  it('mappe les champs requis et initialise members à []', () => {
    const team = mapDocToTeam(makeDoc({
      jam_id: 'jam-1',
      name: 'Pixel Makers',
      invite_code: 'KG-ABCD1234',
      leader_id: 'user-1',
    }))
    expect(team.id).toBe('doc-1')
    expect(team.jamId).toBe('jam-1')
    expect(team.name).toBe('Pixel Makers')
    expect(team.inviteCode).toBe('KG-ABCD1234')
    expect(team.leaderId).toBe('user-1')
    expect(team.members).toEqual([])
    expect(team.projectId).toBeUndefined()
  })
})

// ────────────────────────────────────────
// mapDocToTeamMember
// ────────────────────────────────────────
describe('mapDocToTeamMember', () => {
  it('mappe les champs requis', () => {
    const member = mapDocToTeamMember(makeDoc({
      user_id: 'user-2',
      name: 'Alice',
      role: 'dev',
      is_leader: true,
      avatar_url: 'https://example.com/avatar.png',
    }))
    expect(member.id).toBe('doc-1')
    expect(member.userId).toBe('user-2')
    expect(member.name).toBe('Alice')
    expect(member.role).toBe('dev')
    expect(member.isLeader).toBe(true)
    expect(member.avatarUrl).toBe('https://example.com/avatar.png')
  })

  it("utilise '' comme valeur par défaut pour name si absent", () => {
    const member = mapDocToTeamMember(makeDoc({
      user_id: 'user-3',
      role: 'artist',
      is_leader: false,
    }))
    expect(member.name).toBe('')
  })
})

// ────────────────────────────────────────
// mapDocToProject
// ────────────────────────────────────────
describe('mapDocToProject', () => {
  const baseProject = {
    jam_id: 'jam-1',
    team_id: 'team-1',
    title: 'Pixel Garden',
    description: 'Un jeu de jardinage',
  }

  it('mappe les champs requis avec les valeurs par défaut', () => {
    const project = mapDocToProject(makeDoc(baseProject))
    expect(project.id).toBe('doc-1')
    expect(project.jamId).toBe('jam-1')
    expect(project.teamId).toBe('team-1')
    expect(project.title).toBe('Pixel Garden')
    expect(project.technologies).toEqual([])
    expect(project.submitted).toBe(false)
    expect(project.votesCount).toBe(0)
    expect(project.screenshotIds).toEqual([])
    expect(project.reported).toBe(false)
    expect(project.winner).toBe(false)
  })

  it('convertit submission_date en Date si présente', () => {
    const project = mapDocToProject(makeDoc({
      ...baseProject,
      submission_date: '2026-04-07T12:00:00.000Z',
      submitted: true,
    }))
    expect(project.submissionDate).toBeInstanceOf(Date)
    expect(project.submissionDate?.toISOString()).toBe('2026-04-07T12:00:00.000Z')
  })

  it("ne set pas submissionDate si submission_date est absent", () => {
    const project = mapDocToProject(makeDoc(baseProject))
    expect(project.submissionDate).toBeUndefined()
  })
})

// ────────────────────────────────────────
// mapDocToChatMessage
// ────────────────────────────────────────
describe('mapDocToChatMessage', () => {
  it('mappe les champs requis et convertit $createdAt en Date', () => {
    const msg = mapDocToChatMessage(makeDoc({
      jam_id: 'jam-1',
      channel: 'general',
      author_id: 'user-1',
      author_name: 'Bob',
      content: 'Bonjour !',
      role: 'user',
    }))
    expect(msg.id).toBe('doc-1')
    expect(msg.jamId).toBe('jam-1')
    expect(msg.channel).toBe('general')
    expect(msg.authorId).toBe('user-1')
    expect(msg.authorName).toBe('Bob')
    expect(msg.content).toBe('Bonjour !')
    expect(msg.role).toBe('user')
    expect(msg.pinned).toBe(false)
    expect(msg.createdAt).toBeInstanceOf(Date)
    expect(msg.createdAt.toISOString()).toBe('2026-01-15T10:00:00.000Z')
  })
})

// ────────────────────────────────────────
// mapDocToAnnouncement
// ────────────────────────────────────────
describe('mapDocToAnnouncement', () => {
  it('mappe les champs requis et convertit $createdAt en Date', () => {
    const ann = mapDocToAnnouncement(makeDoc({
      jam_id: 'jam-1',
      title: 'Thème révélé',
      content: 'Le thème est : Printemps',
      important: true,
      author_id: 'user-1',
    }))
    expect(ann.id).toBe('doc-1')
    expect(ann.jamId).toBe('jam-1')
    expect(ann.title).toBe('Thème révélé')
    expect(ann.content).toBe('Le thème est : Printemps')
    expect(ann.important).toBe(true)
    expect(ann.authorId).toBe('user-1')
    expect(ann.createdAt).toBeInstanceOf(Date)
  })

  it("utilise false comme valeur par défaut pour important", () => {
    const ann = mapDocToAnnouncement(makeDoc({
      jam_id: 'jam-1',
      title: 'T',
      content: 'C',
      author_id: 'user-1',
    }))
    expect(ann.important).toBe(false)
  })
})

// ────────────────────────────────────────
// mapDocToComment
// ────────────────────────────────────────
describe('mapDocToComment', () => {
  it('mappe les champs requis et convertit $createdAt en Date', () => {
    const comment = mapDocToComment(makeDoc({
      project_id: 'proj-1',
      author_id: 'user-1',
      author_name: 'Alice',
      content: 'Super jeu !',
    }))
    expect(comment.id).toBe('doc-1')
    expect(comment.projectId).toBe('proj-1')
    expect(comment.authorId).toBe('user-1')
    expect(comment.authorName).toBe('Alice')
    expect(comment.content).toBe('Super jeu !')
    expect(comment.createdAt).toBeInstanceOf(Date)
  })
})
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils passent**

```bash
cd frontend && pnpm test --reporter=verbose 2>&1 | grep -E "(PASS|FAIL|✓|✗|appwrite-mappers)"
```

Expected : tous les tests du fichier `appwrite-mappers.test.ts` passent (PASS).

- [ ] **Step 3 : Commit**

```bash
cd frontend && git add src/__tests__/appwrite-mappers.test.ts
git commit -m "test: ajouter tests unitaires pour les 7 mappeurs Appwrite"
```

---

## Task 2 : Étendre les tests validators (maxParticipants)

**Files:**
- Modify: `frontend/src/__tests__/profile-validators.test.ts`
- Read: `frontend/src/lib/validators.ts` (déjà lu — confirme que maxParticipants est validé entre 2 et 10000)

- [ ] **Step 1 : Écrire le test en échec — il n'échouera pas (logique existe déjà) mais documente la couverture manquante**

Ajouter à la fin de `frontend/src/__tests__/profile-validators.test.ts` :

```typescript
describe('validateUpdateJamData — maxParticipants', () => {
  it('accepte une valeur limite basse (2)', () => {
    const result = validateUpdateJamData({ maxParticipants: 2 })
    expect(result.valid).toBe(true)
  })

  it('accepte une valeur limite haute (10000)', () => {
    const result = validateUpdateJamData({ maxParticipants: 10000 })
    expect(result.valid).toBe(true)
  })

  it('accepte une valeur intermédiaire (50)', () => {
    const result = validateUpdateJamData({ maxParticipants: 50 })
    expect(result.valid).toBe(true)
  })

  it('refuse maxParticipants < 2', () => {
    const result = validateUpdateJamData({ maxParticipants: 1 })
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/maxParticipants/)
  })

  it('refuse maxParticipants > 10000', () => {
    const result = validateUpdateJamData({ maxParticipants: 10001 })
    expect(result.valid).toBe(false)
  })

  it('refuse maxParticipants non-numérique', () => {
    const result = validateUpdateJamData({ maxParticipants: 'beaucoup' as unknown as number })
    expect(result.valid).toBe(false)
  })
})
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils passent**

```bash
cd frontend && pnpm test --reporter=verbose 2>&1 | grep -E "(maxParticipants|PASS|FAIL)"
```

Expected : 6 nouveaux tests passent.

- [ ] **Step 3 : Commit**

```bash
cd frontend && git add src/__tests__/profile-validators.test.ts
git commit -m "test: ajouter couverture maxParticipants dans validators"
```

---

## Task 3 : Tests guards de validation — actions/profile.ts

**Files:**
- Create: `frontend/src/__tests__/actions-profile.test.ts`
- Read: `frontend/src/lib/actions/profile.ts` (déjà lu)

Les guards de validation retournent **avant** tout appel Appwrite. Les mocks sont nécessaires uniquement pour que le fichier s'importe sans erreur (il importe `next/cache`, `@/lib/appwrite/server`, `@/lib/appwrite/session`).

- [ ] **Step 1 : Écrire les tests**

```typescript
// frontend/src/__tests__/actions-profile.test.ts
import { describe, it, expect, vi } from 'vitest'

// Mocks déclarés avant l'import des actions
// (nécessaires pour que le module s'importe sans erreur dans node)
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/appwrite/server', () => ({
  serverUsers: { delete: vi.fn() },
  serverDatabases: {},
  serverStorage: {},
  serverTeams: {},
}))
vi.mock('@/lib/appwrite/session', () => ({
  createSessionClient: vi.fn(() => ({
    account: {
      get: vi.fn(),
      updateName: vi.fn(),
      updatePrefs: vi.fn(),
      updatePassword: vi.fn(),
      deleteSessions: vi.fn(),
    },
  })),
}))

import {
  updateProfileName,
  updateProfileBio,
  updateProfilePassword,
} from '@/lib/actions/profile'

// ────────────────────────────────────────
// updateProfileName — guards de validation
// ────────────────────────────────────────
describe('updateProfileName — validation', () => {
  it('refuse un nom vide', async () => {
    const result = await updateProfileName('')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/vide/)
  })

  it('refuse un nom composé uniquement d\'espaces', async () => {
    const result = await updateProfileName('   ')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/vide/)
  })

  it('refuse un nom de 129 caractères', async () => {
    const result = await updateProfileName('a'.repeat(129))
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/128/)
  })

  it('accepte un nom de 128 caractères exactement', async () => {
    const result = await updateProfileName('a'.repeat(128))
    // Le guard passe, l'appel Appwrite est mocké → succès
    expect(result.success).toBe(true)
  })
})

// ────────────────────────────────────────
// updateProfileBio — guards de validation
// ────────────────────────────────────────
describe('updateProfileBio — validation', () => {
  it('refuse une bio de 301 caractères', async () => {
    const result = await updateProfileBio('x'.repeat(301))
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/300/)
  })

  it('accepte une bio de 300 caractères exactement', async () => {
    const result = await updateProfileBio('x'.repeat(300))
    expect(result.success).toBe(true)
  })

  it('accepte une bio vide (suppression)', async () => {
    const result = await updateProfileBio('')
    expect(result.success).toBe(true)
  })
})

// ────────────────────────────────────────
// updateProfilePassword — guards de validation
// ────────────────────────────────────────
describe('updateProfilePassword — validation', () => {
  it('refuse un nouveau mot de passe de moins de 8 caractères', async () => {
    const result = await updateProfilePassword('ancien123', 'court')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/8/)
  })

  it('accepte un mot de passe de 8 caractères exactement', async () => {
    const result = await updateProfilePassword('ancien123', '12345678')
    expect(result.success).toBe(true)
  })
})
```

- [ ] **Step 2 : Lancer et vérifier**

```bash
cd frontend && pnpm test --reporter=verbose 2>&1 | grep -E "(actions-profile|PASS|FAIL|✓|✗)"
```

Expected : 7 tests passent dans `actions-profile.test.ts`.

- [ ] **Step 3 : Commit**

```bash
cd frontend && git add src/__tests__/actions-profile.test.ts
git commit -m "test: ajouter tests guards de validation pour les actions profile"
```

---

## Task 4 : Tests sanitisation sendChatMessage

**Files:**
- Create: `frontend/src/__tests__/actions-chat.test.ts`
- Read: `frontend/src/lib/actions/chat.ts` (déjà lu)

`sendChatMessage` a de la logique de sanitisation avant l'appel Appwrite : trim, slice à 2048, et échappement HTML `<` → `&lt;`. C'est ce qu'on teste.

- [ ] **Step 1 : Écrire les tests**

```typescript
// frontend/src/__tests__/actions-chat.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/appwrite/server', () => ({
  serverDatabases: {
    createDocument: vi.fn(),
    listDocuments: vi.fn(),
    updateDocument: vi.fn(),
  },
}))

import { sendChatMessage } from '@/lib/actions/chat'
import { serverDatabases } from '@/lib/appwrite/server'

const mockCreate = vi.mocked(serverDatabases.createDocument)

const baseData = {
  jamId: 'jam-1',
  channel: 'general' as const,
  authorId: 'user-1',
  authorName: 'Alice',
}

beforeEach(() => {
  mockCreate.mockReset()
  // Par défaut : succès Appwrite avec un document minimal
  mockCreate.mockResolvedValue({
    $id: 'msg-1',
    $createdAt: '2026-04-01T00:00:00.000Z',
    $updatedAt: '2026-04-01T00:00:00.000Z',
    $permissions: [],
    $collectionId: 'chat_messages',
    $databaseId: 'konfitur-db',
    jam_id: 'jam-1',
    channel: 'general',
    author_id: 'user-1',
    author_name: 'Alice',
    content: 'ok',
    role: 'user',
    pinned: false,
  } as never)
})

describe('sendChatMessage — validation du contenu', () => {
  it('refuse un message vide', async () => {
    const result = await sendChatMessage({ ...baseData, content: '' })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/vide/)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('refuse un message composé uniquement d\'espaces', async () => {
    const result = await sendChatMessage({ ...baseData, content: '   ' })
    expect(result.success).toBe(false)
    expect(mockCreate).not.toHaveBeenCalled()
  })
})

describe('sendChatMessage — sanitisation HTML', () => {
  it('échappe les chevrons ouvrants < en &lt;', async () => {
    await sendChatMessage({ ...baseData, content: '<script>alert(1)</script>' })
    const savedContent: string = mockCreate.mock.calls[0][3].content as string
    expect(savedContent).toContain('&lt;script&gt;')
    expect(savedContent).not.toContain('<script>')
  })

  it('échappe uniquement < et >, pas les autres caractères spéciaux', async () => {
    await sendChatMessage({ ...baseData, content: 'test & "quotes" <tag>' })
    const savedContent: string = mockCreate.mock.calls[0][3].content as string
    expect(savedContent).toBe('test & "quotes" &lt;tag&gt;')
  })
})

describe('sendChatMessage — troncature à 2048 caractères', () => {
  it('tronque les messages de plus de 2048 caractères', async () => {
    await sendChatMessage({ ...baseData, content: 'a'.repeat(3000) })
    const savedContent: string = mockCreate.mock.calls[0][3].content as string
    expect(savedContent.length).toBe(2048)
  })

  it('ne tronque pas les messages de 2048 caractères exactement', async () => {
    await sendChatMessage({ ...baseData, content: 'a'.repeat(2048) })
    const savedContent: string = mockCreate.mock.calls[0][3].content as string
    expect(savedContent.length).toBe(2048)
  })
})

describe('sendChatMessage — gestion erreur Appwrite', () => {
  it('retourne success:false et le message d\'erreur si Appwrite échoue', async () => {
    mockCreate.mockRejectedValue(new Error('Permission refusée'))
    const result = await sendChatMessage({ ...baseData, content: 'Bonjour' })
    expect(result.success).toBe(false)
    expect(result.error).toBe('Permission refusée')
  })
})
```

- [ ] **Step 2 : Lancer et vérifier**

```bash
cd frontend && pnpm test --reporter=verbose 2>&1 | grep -E "(actions-chat|PASS|FAIL|✓|✗)"
```

Expected : 7 tests passent dans `actions-chat.test.ts`.

- [ ] **Step 3 : Commit**

```bash
cd frontend && git add src/__tests__/actions-chat.test.ts
git commit -m "test: ajouter tests sanitisation et validation pour sendChatMessage"
```

---

## Task 5 : Tests format invite code + guards joinTeamByCode

**Files:**
- Create: `frontend/src/__tests__/actions-teams.test.ts`
- Read: `frontend/src/lib/actions/teams.ts` (déjà lu)

`generateInviteCode()` est privée mais son résultat est stocké dans le document créé. On vérifie le format via `createTeam`. `joinTeamByCode` a deux guards : code invalide et déjà membre.

- [ ] **Step 1 : Écrire les tests**

```typescript
// frontend/src/__tests__/actions-teams.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/appwrite/server', () => ({
  serverDatabases: {
    createDocument: vi.fn(),
    listDocuments: vi.fn(),
  },
}))

import { createTeam, joinTeamByCode } from '@/lib/actions/teams'
import { serverDatabases } from '@/lib/appwrite/server'

const mockCreate = vi.mocked(serverDatabases.createDocument)
const mockList = vi.mocked(serverDatabases.listDocuments)

function makeTeamDoc(fields: Record<string, unknown>) {
  return {
    $id: 'team-1',
    $createdAt: '2026-04-01T00:00:00.000Z',
    $updatedAt: '2026-04-01T00:00:00.000Z',
    $permissions: [],
    $collectionId: 'teams',
    $databaseId: 'konfitur-db',
    ...fields,
  }
}

beforeEach(() => {
  mockCreate.mockReset()
  mockList.mockReset()
})

// ────────────────────────────────────────
// generateInviteCode (via createTeam)
// ────────────────────────────────────────
describe('createTeam — format du code d\'invitation', () => {
  it("génère un code au format KG-[A-Z0-9]{8}", async () => {
    let capturedInviteCode = ''

    mockCreate.mockImplementation(async (_dbId, _colId, _docId, data) => {
      capturedInviteCode = (data as Record<string, unknown>).invite_code as string
      return makeTeamDoc({
        jam_id: 'jam-1',
        name: 'Test Team',
        invite_code: capturedInviteCode,
        leader_id: 'user-1',
      }) as never
    })

    await createTeam({ jamId: 'jam-1', name: 'Test Team', leaderId: 'user-1' })

    expect(capturedInviteCode).toMatch(/^KG-[A-Z0-9]{8}$/)
  })

  it('génère des codes différents à chaque appel', async () => {
    const codes: string[] = []

    mockCreate.mockImplementation(async (_dbId, _colId, _docId, data) => {
      const code = (data as Record<string, unknown>).invite_code as string
      codes.push(code)
      return makeTeamDoc({
        jam_id: 'jam-1',
        name: 'Team',
        invite_code: code,
        leader_id: 'user-1',
      }) as never
    })

    await createTeam({ jamId: 'jam-1', name: 'Team A', leaderId: 'user-1' })
    await createTeam({ jamId: 'jam-1', name: 'Team B', leaderId: 'user-1' })

    // Probabilité de collision : (36^8)^-1 ≈ 0 → les codes doivent être différents
    expect(codes[0]).not.toBe(codes[1])
  })

  it('retourne success:false si Appwrite échoue', async () => {
    mockCreate.mockRejectedValue(new Error('Quota dépassé'))
    const result = await createTeam({ jamId: 'jam-1', name: 'Team', leaderId: 'user-1' })
    expect(result.success).toBe(false)
    expect(result.error).toBe('Quota dépassé')
  })
})

// ────────────────────────────────────────
// joinTeamByCode — guards
// ────────────────────────────────────────
describe('joinTeamByCode — code invalide', () => {
  it("retourne une erreur si le code n'existe pas", async () => {
    // Appwrite retourne 0 documents → code inconnu
    mockList.mockResolvedValue({ documents: [], total: 0 } as never)

    const result = await joinTeamByCode('KG-INVALID1', 'user-2', 'dev', 'Bob')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/invalide/i)
  })
})

describe('joinTeamByCode — déjà membre', () => {
  it("retourne une erreur si l'utilisateur est déjà dans l'équipe", async () => {
    const teamDoc = makeTeamDoc({
      jam_id: 'jam-1',
      name: 'Pixel Makers',
      invite_code: 'KG-ABCD1234',
      leader_id: 'user-1',
    })

    // Premier appel : le code existe
    mockList.mockResolvedValueOnce({ documents: [teamDoc], total: 1 } as never)
    // Deuxième appel : l'utilisateur est déjà membre
    mockList.mockResolvedValueOnce({
      documents: [{ $id: 'member-1' }],
      total: 1,
    } as never)

    const result = await joinTeamByCode('KG-ABCD1234', 'user-2', 'dev', 'Bob')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/déjà membre/i)
  })
})
```

- [ ] **Step 2 : Lancer et vérifier**

```bash
cd frontend && pnpm test --reporter=verbose 2>&1 | grep -E "(actions-teams|PASS|FAIL|✓|✗)"
```

Expected : 5 tests passent dans `actions-teams.test.ts`.

- [ ] **Step 3 : Commit**

```bash
cd frontend && git add src/__tests__/actions-teams.test.ts
git commit -m "test: ajouter tests format invite code et guards joinTeamByCode"
```

---

## Task 6 : Script de coverage + config vitest

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/vitest.config.ts`

L'objectif est de pouvoir voir la couverture de tests (lignes non couvertes) avec `pnpm test:coverage`.

- [ ] **Step 1 : Installer @vitest/coverage-v8**

```bash
cd frontend && pnpm add -D @vitest/coverage-v8
```

Expected : `@vitest/coverage-v8` apparaît dans `devDependencies` de `package.json`.

- [ ] **Step 2 : Ajouter le script test:coverage dans package.json**

Dans `frontend/package.json`, ajouter dans `scripts` :

```json
"test:coverage": "vitest run --coverage"
```

Le bloc `scripts` complet doit être :
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "type-check": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
},
```

- [ ] **Step 3 : Ajouter la config coverage dans vitest.config.ts**

Remplacer le contenu de `frontend/vitest.config.ts` par :

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/**/*.ts'],
      exclude: [
        'src/lib/appwrite/client.ts',  // browser-only, initialise le SDK Appwrite côté client
        'src/lib/appwrite/server.ts',  // initialise le SDK côté serveur avec les env vars
        'src/lib/appwrite/session.ts', // factory de client par session — pas de logique testable
        'src/lib/mockData.ts',         // données statiques de développement
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 4 : Lancer la couverture et vérifier l'output**

```bash
cd frontend && pnpm test:coverage 2>&1 | tail -40
```

Expected : tableau de couverture affiché avec les fichiers de `src/lib/`.  
Couverture attendue > 70% sur `validators.ts`, `appwrite/types.ts`, et `actions/profile.ts`, `actions/chat.ts`, `actions/teams.ts`.

- [ ] **Step 5 : Lancer tous les tests pour vérifier qu'aucune régression**

```bash
cd frontend && pnpm test 2>&1 | tail -20
```

Expected : tous les tests passent (0 failed).

- [ ] **Step 6 : Commit**

```bash
cd frontend && git add vitest.config.ts package.json pnpm-lock.yaml
git commit -m "test: ajouter script coverage et config vitest/coverage-v8"
```

---

## Récapitulatif des fichiers créés/modifiés

| Fichier | Action | Contenu |
|---|---|---|
| `src/__tests__/appwrite-mappers.test.ts` | Créer | 20+ tests — 7 mappeurs Appwrite |
| `src/__tests__/profile-validators.test.ts` | Modifier | +6 tests maxParticipants |
| `src/__tests__/actions-profile.test.ts` | Créer | 7 tests guards updateProfileName/Bio/Password |
| `src/__tests__/actions-chat.test.ts` | Créer | 7 tests sanitisation sendChatMessage |
| `src/__tests__/actions-teams.test.ts` | Créer | 5 tests invite code + joinTeamByCode guards |
| `vitest.config.ts` | Modifier | Ajouter config coverage v8 |
| `package.json` | Modifier | Ajouter script `test:coverage` |
