import type { Metadata } from 'next'
import NewJamForm from './NewJamForm'

export const metadata: Metadata = {
  title: 'Créer une jam',
  description: 'Créez et configurez une nouvelle game jam sur KonfiturGame.',
  robots: { index: false },
}

export default function NewJamPage() {
  return <NewJamForm />
}
