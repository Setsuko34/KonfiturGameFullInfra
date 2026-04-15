import { cookies } from 'next/headers'
import { Client, Account, Databases, Storage } from 'node-appwrite'
import { appwriteInternalEndpoint, appwritePublicHost } from './internal-host'


/**
 * Crée un client Appwrite scopé à la session de l'utilisateur connecté.
 * À utiliser UNIQUEMENT dans les Server Actions et Server Components.
 * Lit le cookie de session Appwrite depuis les headers Next.js.
 */
export async function createSessionClient() {
  const cookieStore = await cookies()
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!
  const sessionCookie = cookieStore.get(`a_session_${projectId}`) ?? cookieStore.get(`a_session_${projectId}_legacy`)

  const client = new Client()
    .setEndpoint(appwriteInternalEndpoint)
    .setProject(projectId)

  if (appwritePublicHost) client.addHeader('host', appwritePublicHost)

  if (sessionCookie?.value) {
    client.setSession(sessionCookie.value)
  }

  return {
    account: new Account(client),
    databases: new Databases(client),
    storage: new Storage(client),
  }
}

