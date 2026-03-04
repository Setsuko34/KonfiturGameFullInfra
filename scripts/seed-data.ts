#!/usr/bin/env tsx
// ═══════════════════════════════════════════════════════════
// Script de seeding Appwrite — KonfiturGame
// Usage : cd frontend && npx tsx ../scripts/seed-data.ts
// Prérequis : NEXT_PUBLIC_APPWRITE_ENDPOINT et APPWRITE_API_KEY dans .env
// ═══════════════════════════════════════════════════════════

import { Client, Databases, Users, Permission, Role } from 'node-appwrite'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(__dirname, '../.env') })

const DATABASE_ID = 'konfitur-db'

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!)

const databases = new Databases(client)

async function createCollections() {
  console.log('Création de la base de données...')
  try {
    await databases.create(DATABASE_ID, 'KonfiturDB')
    console.log('✓ Base de données créée')
  } catch {
    console.log('ℹ Base de données déjà existante')
  }

  // ═══ game_jams ═══
  try {
    await databases.createCollection(
      DATABASE_ID,
      'game_jams',
      'game_jams',
      [Permission.read(Role.any()), Permission.create(Role.users())]
    )
    const attrs = [
      databases.createStringAttribute(DATABASE_ID, 'game_jams', 'title', 256, true),
      databases.createStringAttribute(DATABASE_ID, 'game_jams', 'slug', 256, true),
      databases.createStringAttribute(DATABASE_ID, 'game_jams', 'theme', 512, true),
      databases.createStringAttribute(DATABASE_ID, 'game_jams', 'description', 4096, true),
      databases.createEnumAttribute(DATABASE_ID, 'game_jams', 'status', ['upcoming', 'ongoing', 'ended'], true, 'upcoming'),
      databases.createEnumAttribute(DATABASE_ID, 'game_jams', 'type', ['solo', 'team', 'both'], true, 'both'),
      databases.createDatetimeAttribute(DATABASE_ID, 'game_jams', 'start_date', true),
      databases.createDatetimeAttribute(DATABASE_ID, 'game_jams', 'end_date', true),
      databases.createStringAttribute(DATABASE_ID, 'game_jams', 'duration', 32, true),
      databases.createIntegerAttribute(DATABASE_ID, 'game_jams', 'max_participants', false),
      databases.createStringAttribute(DATABASE_ID, 'game_jams', 'rules', 4096, false, undefined, true),
      databases.createStringAttribute(DATABASE_ID, 'game_jams', 'prizes', 512, false, undefined, true),
      databases.createStringAttribute(DATABASE_ID, 'game_jams', 'tags', 64, false, undefined, true),
      databases.createStringAttribute(DATABASE_ID, 'game_jams', 'cover_image_id', 256, false),
      databases.createStringAttribute(DATABASE_ID, 'game_jams', 'organizer_id', 36, true),
    ]
    await Promise.all(attrs)
    console.log('✓ Collection game_jams créée')
  } catch {
    console.log('ℹ Collection game_jams déjà existante')
  }

  // ═══ teams ═══
  try {
    await databases.createCollection(
      DATABASE_ID,
      'teams',
      'teams',
      [Permission.read(Role.any()), Permission.create(Role.users())]
    )
    await Promise.all([
      databases.createStringAttribute(DATABASE_ID, 'teams', 'jam_id', 36, true),
      databases.createStringAttribute(DATABASE_ID, 'teams', 'name', 256, true),
      databases.createStringAttribute(DATABASE_ID, 'teams', 'invite_code', 16, true),
      databases.createStringAttribute(DATABASE_ID, 'teams', 'leader_id', 36, true),
      databases.createStringAttribute(DATABASE_ID, 'teams', 'project_id', 36, false),
    ])
    console.log('✓ Collection teams créée')
  } catch {
    console.log('ℹ Collection teams déjà existante')
  }

  // ═══ team_members ═══
  try {
    await databases.createCollection(
      DATABASE_ID,
      'team_members',
      'team_members',
      [Permission.read(Role.any()), Permission.create(Role.users())]
    )
    await Promise.all([
      databases.createStringAttribute(DATABASE_ID, 'team_members', 'team_id', 36, true),
      databases.createStringAttribute(DATABASE_ID, 'team_members', 'user_id', 36, true),
      databases.createStringAttribute(DATABASE_ID, 'team_members', 'name', 128, true),
      databases.createEnumAttribute(DATABASE_ID, 'team_members', 'role', ['dev', 'artist', 'sound', 'designer', 'writer'], true, 'dev'),
      databases.createBooleanAttribute(DATABASE_ID, 'team_members', 'is_leader', true, false),
    ])
    console.log('✓ Collection team_members créée')
  } catch {
    console.log('ℹ Collection team_members déjà existante')
  }

  // ═══ projects ═══
  try {
    await databases.createCollection(
      DATABASE_ID,
      'projects',
      'projects',
      [Permission.read(Role.any()), Permission.create(Role.users())]
    )
    await Promise.all([
      databases.createStringAttribute(DATABASE_ID, 'projects', 'jam_id', 36, true),
      databases.createStringAttribute(DATABASE_ID, 'projects', 'team_id', 36, true),
      databases.createStringAttribute(DATABASE_ID, 'projects', 'title', 256, true),
      databases.createStringAttribute(DATABASE_ID, 'projects', 'description', 4096, true),
      databases.createStringAttribute(DATABASE_ID, 'projects', 'technologies', 64, false, undefined, true),
      databases.createStringAttribute(DATABASE_ID, 'projects', 'download_url', 2048, false),
      databases.createStringAttribute(DATABASE_ID, 'projects', 'repo_url', 2048, false),
      databases.createBooleanAttribute(DATABASE_ID, 'projects', 'submitted', true, false),
      databases.createDatetimeAttribute(DATABASE_ID, 'projects', 'submission_date', false),
      databases.createIntegerAttribute(DATABASE_ID, 'projects', 'votes_count', false, 0),
      databases.createStringAttribute(DATABASE_ID, 'projects', 'cover_image_id', 256, false),
      databases.createStringAttribute(DATABASE_ID, 'projects', 'screenshot_ids', 256, false, undefined, true),
    ])
    console.log('✓ Collection projects créée')
  } catch {
    console.log('ℹ Collection projects déjà existante')
  }

  // ═══ chat_messages ═══
  try {
    await databases.createCollection(
      DATABASE_ID,
      'chat_messages',
      'chat_messages',
      [Permission.read(Role.any()), Permission.create(Role.users())]
    )
    await Promise.all([
      databases.createStringAttribute(DATABASE_ID, 'chat_messages', 'jam_id', 36, true),
      databases.createEnumAttribute(DATABASE_ID, 'chat_messages', 'channel', ['general', 'team-search', 'help'], true, 'general'),
      databases.createStringAttribute(DATABASE_ID, 'chat_messages', 'author_id', 36, true),
      databases.createStringAttribute(DATABASE_ID, 'chat_messages', 'author_name', 128, true),
      databases.createStringAttribute(DATABASE_ID, 'chat_messages', 'content', 2048, true),
      databases.createEnumAttribute(DATABASE_ID, 'chat_messages', 'role', ['user', 'organizer', 'moderator'], true, 'user'),
      databases.createBooleanAttribute(DATABASE_ID, 'chat_messages', 'pinned', false, false),
    ])
    console.log('✓ Collection chat_messages créée')
  } catch {
    console.log('ℹ Collection chat_messages déjà existante')
  }

  // ═══ announcements ═══
  try {
    await databases.createCollection(
      DATABASE_ID,
      'announcements',
      'announcements',
      [Permission.read(Role.any()), Permission.create(Role.users())]
    )
    await Promise.all([
      databases.createStringAttribute(DATABASE_ID, 'announcements', 'jam_id', 36, true),
      databases.createStringAttribute(DATABASE_ID, 'announcements', 'title', 256, true),
      databases.createStringAttribute(DATABASE_ID, 'announcements', 'content', 4096, true),
      databases.createBooleanAttribute(DATABASE_ID, 'announcements', 'important', true, false),
      databases.createStringAttribute(DATABASE_ID, 'announcements', 'author_id', 36, true),
    ])
    console.log('✓ Collection announcements créée')
  } catch {
    console.log('ℹ Collection announcements déjà existante')
  }

  // ═══ comments ═══
  try {
    await databases.createCollection(
      DATABASE_ID,
      'comments',
      'comments',
      [Permission.read(Role.any()), Permission.create(Role.users())]
    )
    await Promise.all([
      databases.createStringAttribute(DATABASE_ID, 'comments', 'project_id', 36, true),
      databases.createStringAttribute(DATABASE_ID, 'comments', 'author_id', 36, true),
      databases.createStringAttribute(DATABASE_ID, 'comments', 'author_name', 128, true),
      databases.createStringAttribute(DATABASE_ID, 'comments', 'content', 2048, true),
    ])
    console.log('✓ Collection comments créée')
  } catch {
    console.log('ℹ Collection comments déjà existante')
  }

  // ═══ votes ═══
  try {
    await databases.createCollection(
      DATABASE_ID,
      'votes',
      'votes',
      [Permission.read(Role.any()), Permission.create(Role.users())]
    )
    await Promise.all([
      databases.createStringAttribute(DATABASE_ID, 'votes', 'project_id', 36, true),
      databases.createStringAttribute(DATABASE_ID, 'votes', 'user_id', 36, true),
    ])
    console.log('✓ Collection votes créée')
  } catch {
    console.log('ℹ Collection votes déjà existante')
  }
}

async function seedJams() {
  console.log('\nInsertion des données de test...')

  // Attendre que les attributs soient prêts
  await new Promise(resolve => setTimeout(resolve, 3000))

  const now = Date.now()

  try {
    await databases.createDocument(DATABASE_ID, 'game_jams', 'jam-001', {
      title: 'Spring Jam 2025',
      slug: 'spring-jam-2025',
      theme: 'La renaissance',
      description: 'Créez un jeu autour du thème de la renaissance — nouvelle vie, nouveau départ, transformation.',
      status: 'ongoing',
      type: 'both',
      start_date: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
      end_date: new Date(now + 48 * 60 * 60 * 1000).toISOString(),
      duration: '72h',
      rules: [
        'Le jeu doit être créé pendant la durée de la jam',
        'Toute technologie est acceptée',
        'Les assets pré-créés sont autorisés si déclarés',
      ],
      prizes: ['500€', '250€', '100€'],
      tags: ['2D', 'Toutes technologies', 'Débutants bienvenus'],
      organizer_id: 'organizer-001',
    }, [Permission.read(Role.any())])
    console.log('✓ Jam Spring Jam 2025 insérée')
  } catch {
    console.log('ℹ Jam déjà existante')
  }

  try {
    await databases.createDocument(DATABASE_ID, 'chat_messages', 'msg-001', {
      jam_id: 'jam-001',
      channel: 'general',
      author_id: 'organizer-001',
      author_name: 'KonfiturGame',
      content: 'Bienvenue dans Spring Jam 2025 ! Le thème est "La renaissance". Bonne chance à tous !',
      role: 'organizer',
      pinned: true,
    }, [Permission.read(Role.any())])
    console.log('✓ Message épinglé inséré')
  } catch {
    console.log('ℹ Message déjà existant')
  }

  try {
    await databases.createDocument(DATABASE_ID, 'announcements', 'ann-001', {
      jam_id: 'jam-001',
      title: 'Le thème est révélé !',
      content: 'Le thème de Spring Jam 2025 est "La renaissance". Toutes les interprétations sont valides.',
      important: true,
      author_id: 'organizer-001',
    }, [Permission.read(Role.any())])
    console.log('✓ Annonce insérée')
  } catch {
    console.log('ℹ Annonce déjà existante')
  }
}

async function main() {
  console.log('═══ KonfiturGame — Seed Appwrite ═══\n')
  await createCollections()
  await seedJams()
  console.log('\n✅ Seed terminé !')
}

main().catch(err => {
  console.error('Erreur de seed :', err)
  process.exit(1)
})
