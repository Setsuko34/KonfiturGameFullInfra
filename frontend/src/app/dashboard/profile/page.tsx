import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/actions/profile'
import ProfileForm from './ProfileForm'

export const metadata: Metadata = {
  title: 'Mon profil',
}

export default async function ProfilePage() {
  const user = await getProfile()

  if (!user) {
    redirect('/auth/login?redirect=/dashboard/profile')
  }
  const plainUser = JSON.parse(JSON.stringify(user)) as typeof user

  return (
    <section aria-labelledby="profile-heading">
      <div className="mb-8">
        <p className="label-tech mb-1" style={{ color: 'var(--muted-foreground)' }}>
          DASHBOARD
        </p>
        <h1 id="profile-heading" className="text-2xl font-bold">Mon profil</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          Membre depuis le {new Date(user.$createdAt).toLocaleDateString('fr-FR', {
            day: 'numeric', month: 'long', year: 'numeric'
          })}
        </p>
      </div>
      <ProfileForm user={plainUser} />
    </section>
  )
}
