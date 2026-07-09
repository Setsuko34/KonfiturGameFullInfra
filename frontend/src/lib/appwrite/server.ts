import { Client, Databases, Users, Storage, Teams } from 'node-appwrite'
import { appwriteInternalEndpoint } from './internal-host'

const client = new Client()
  .setEndpoint(appwriteInternalEndpoint)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!)

export const serverDatabases = new Databases(client)
export const serverUsers = new Users(client)
export const serverStorage = new Storage(client)
export const serverTeams = new Teams(client)
export { client as serverClient }
