import { Client, Databases, Users, Storage } from 'node-appwrite'

const client = new Client()
  .setEndpoint(process.env.APPWRITE_INTERNAL_ENDPOINT ?? process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!)

export const serverDatabases = new Databases(client)
export const serverUsers = new Users(client)
export const serverStorage = new Storage(client)
export { client as serverClient }
