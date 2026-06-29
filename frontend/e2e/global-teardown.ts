import { Client, Users, Databases, Query } from 'node-appwrite'
import fs from 'fs'
import path from 'path'

const envPath = path.resolve(process.cwd(), '../.env')
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf-8')
    .split('\n')
    .forEach(line => {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    })
}

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? 'http://localhost:8080/v1'
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!
const API_KEY = process.env.APPWRITE_API_KEY!
const DB = 'konfitur-db'

const E2E_USER_IDS = ['e2e-user1', 'e2e-user2', 'e2e-admin', 'e2e-reg-test']

async function deleteAllDocs(databases: Databases, collection: string, queries: string[]) {
  try {
    const res = await databases.listDocuments(DB, collection, [...queries, Query.limit(100)])
    await Promise.all(
      res.documents.map(doc => databases.deleteDocument(DB, collection, doc.$id).catch(() => {}))
    )
  } catch {}
}

export default async function globalTeardown() {
  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY)
  const users = new Users(client)
  const databases = new Databases(client)

  // Suppression des jams créées par les utilisateurs E2E (via organizer_id)
  await deleteAllDocs(databases, 'game_jams', [Query.equal('organizer_id', 'e2e-admin')])

  // Suppression des jams créées par user1 (test 7.1 — créer une jam)
  await deleteAllDocs(databases, 'game_jams', [Query.equal('organizer_id', 'e2e-user1')])

  // Suppression des équipes créées par les utilisateurs E2E
  await deleteAllDocs(databases, 'teams', [Query.equal('leader_id', 'e2e-user1')])
  await deleteAllDocs(databases, 'teams', [Query.equal('leader_id', 'e2e-user2')])

  // Suppression des membres d'équipe E2E
  await deleteAllDocs(databases, 'team_members', [Query.equal('user_id', 'e2e-user1')])
  await deleteAllDocs(databases, 'team_members', [Query.equal('user_id', 'e2e-user2')])

  // Suppression des projets soumis par les équipes E2E
  // (les projets référencent team_id qui est déjà supprimé — on cible par les jams)
  // Note: les projets seront orphelins après suppression des jams — acceptable

  // Suppression des commentaires et votes créés par les utilisateurs E2E
  await deleteAllDocs(databases, 'comments', [Query.equal('author_id', 'e2e-user1')])
  await deleteAllDocs(databases, 'comments', [Query.equal('author_id', 'e2e-user2')])
  await deleteAllDocs(databases, 'votes', [Query.equal('user_id', 'e2e-user1')])
  await deleteAllDocs(databases, 'votes', [Query.equal('user_id', 'e2e-user2')])

  // Suppression des messages chat créés par les utilisateurs E2E
  await deleteAllDocs(databases, 'chat_messages', [Query.equal('author_id', 'e2e-user1')])
  await deleteAllDocs(databases, 'chat_messages', [Query.equal('author_id', 'e2e-user2')])

  // Suppression des utilisateurs de test
  await Promise.all(E2E_USER_IDS.map(id => users.delete(id).catch(() => {})))

  // Nettoyage des fichiers locaux de test
  const files = [
    'e2e/.test-ids.json',
    'e2e/.test-state.json',
  ].map(f => path.resolve(process.cwd(), f))

  files.forEach(f => { try { fs.unlinkSync(f) } catch {} })

  console.log('✔ Teardown E2E terminé — données de test supprimées')
}
