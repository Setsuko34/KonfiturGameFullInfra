import { Client, Users, Databases } from 'node-appwrite'
import fs from 'fs'
import path from 'path'

const envPath = path.resolve(__dirname, '../../.env')

if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf-8')
    .split('\n')
    .forEach(line => {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=([^#\n]*)/)
      if (m) process.env[m[1]] = m[2].trim()
    })
  console.log('✔ .env chargé depuis', envPath)
} else {
  console.error('✗ .env introuvable à', envPath)
}

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? 'http://localhost:8080/v1'
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? ''
const API_KEY = process.env.APPWRITE_API_KEY ?? ''

console.log('ENDPOINT   :', ENDPOINT)
console.log('PROJECT_ID :', PROJECT_ID || '⚠️  vide')
console.log('API_KEY    :', API_KEY ? `${API_KEY.slice(0, 6)}…${API_KEY.slice(-4)} (${API_KEY.length} chars)` : '⚠️  vide')

async function main() {
  if (!PROJECT_ID || !API_KEY) {
    console.error('\n✗ Variables manquantes — vérifier le .env')
    process.exit(1)
  }

  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY)
  const users = new Users(client)
  const databases = new Databases(client)

  console.log('\n--- Test users.list() ---')
  try {
    const res = await users.list()
    console.log('✔ users.list() OK —', res.total, 'utilisateurs')
  } catch (e: any) {
    console.error('✗ users.list() échoué:', e.code, e.message)
  }

  console.log('\n--- Test users.create() ---')
  try {
    await users.delete('e2e-diag-tmp').catch(() => {})
    const u = await users.create({ userId: 'e2e-diag-tmp', email: 'e2e-diag@test.local', password: 'E2eTest1234!', name: 'Diag' })
    console.log('✔ users.create() OK — id:', u.$id)
    await users.delete('e2e-diag-tmp')
    console.log('✔ users.delete() OK')
  } catch (e: any) {
    console.error('✗ users.create() échoué — code:', e.code, '| message:', e.message)
    if (e.response) console.error('  response:', JSON.stringify(e.response))
  }

  console.log('\n--- Test databases.listDocuments(game_jams) ---')
  try {
    const res = await databases.listDocuments('konfitur-db', 'game_jams', [])
    console.log('✔ listDocuments() OK —', res.total, 'jams')
  } catch (e: any) {
    console.error('✗ listDocuments() échoué:', e.code, e.message)
  }
}

main().catch(console.error)
