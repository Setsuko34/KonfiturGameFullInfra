// URLs publiques des fichiers storage — déterministes, pas d'appel SDK.
// La lecture est accordée fichier par fichier (read("any")) à la soumission.
export function storageFileUrl(
  bucketId: string,
  fileId: string,
  mode: 'view' | 'download' = 'view'
): string {
  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? ''
  const project = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? ''
  return `${endpoint}/storage/buckets/${bucketId}/files/${fileId}/${mode}?project=${project}`
}
