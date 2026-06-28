'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Lock, AlertTriangle, Loader2 } from 'lucide-react'
import { updateProfileClient, updatePasswordClient } from '@/lib/actions/profile.client'
import { deleteAccount } from '@/lib/actions/profile'
import type { Models } from 'appwrite'

interface Props {
  user: Models.User<Models.Preferences>
}

export default function ProfileForm({ user }: Props) {
  const router = useRouter()
  const [isProfilePending, startProfileTransition] = useTransition()
  const [isPwdPending, startPwdTransition] = useTransition()
  const [isDeletePending, startDeleteTransition] = useTransition()

  const [name, setName] = useState(user.name || '')
  const [bio, setBio] = useState(((user.prefs as Record<string, unknown>)?.bio as string) || '')
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')

  const [infoMsg, setInfoMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [pwdMsg, setPwdMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSaveProfile = () => {
    startProfileTransition(async () => {
      setInfoMsg(null)
      const result = await updateProfileClient(name, bio, {
        name: user.name || '',
        bio: ((user.prefs as Record<string, unknown>)?.bio as string) || '',
      })
      if (result.success) {
        setInfoMsg({ type: 'success', text: 'Profil mis à jour' })
        router.refresh()
      } else {
        setInfoMsg({ type: 'error', text: result.error ?? 'Erreur' })
      }
    })
  }

  const handleChangePassword = () => {
    if (newPwd !== confirmPwd) {
      setPwdMsg({ type: 'error', text: 'Les mots de passe ne correspondent pas' })
      return
    }
    startPwdTransition(async () => {
      setPwdMsg(null)
      const result = await updatePasswordClient(currentPwd, newPwd)
      if (result.success) {
        setPwdMsg({ type: 'success', text: 'Mot de passe mis à jour' })
        setCurrentPwd('')
        setNewPwd('')
        setConfirmPwd('')
      } else {
        setPwdMsg({ type: 'error', text: result.error ?? 'Erreur' })
      }
    })
  }

  const handleDeleteAccount = () => {
    if (deleteConfirm !== 'SUPPRIMER') return
    startDeleteTransition(async () => {
      const result = await deleteAccount()
      if (result.success) {
        router.push('/')
      } else {
        setInfoMsg({ type: 'error', text: result.error ?? 'Erreur lors de la suppression' })
      }
    })
  }

  const fieldStyle = {
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border)',
    color: 'var(--foreground)',
  }

  const btnStyle = {
    background: 'var(--primary)',
    color: 'var(--primary-foreground)',
  }

  const dangerStyle = {
    background: 'var(--secondary)',
    color: 'var(--secondary-foreground)',
  }

  return (
    <div className="space-y-8">
      {/* ─── Informations de base ─── */}
      <section aria-labelledby="info-heading">
        <h2 id="info-heading" className="text-base font-bold mb-4 flex items-center gap-2">
          Informations du profil
        </h2>
        <div className="p-6 border space-y-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div>
            <label htmlFor="profile-name" className="block text-xs tracking-widest uppercase mb-1.5"
              style={{ color: 'var(--muted-foreground)' }}>
              Nom d&apos;affichage
            </label>
            <input
              id="profile-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={128}
              className="w-full px-3 py-2 text-sm"
              style={fieldStyle}
              aria-describedby="name-hint"
            />
            <p id="name-hint" className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {name.length}/128
            </p>
          </div>

          <div>
            <label htmlFor="profile-bio" className="block text-xs tracking-widest uppercase mb-1.5"
              style={{ color: 'var(--muted-foreground)' }}>
              Bio
            </label>
            <textarea
              id="profile-bio"
              value={bio}
              onChange={e => setBio(e.target.value)}
              maxLength={300}
              rows={3}
              className="w-full px-3 py-2 text-sm resize-none"
              style={fieldStyle}
              aria-describedby="bio-hint"
            />
            <p id="bio-hint" className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {bio.length}/300
            </p>
          </div>

          <div>
            <p className="text-xs tracking-widest uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
              Email
            </p>
            <p className="text-sm" style={{ color: 'var(--foreground)' }}>{user.email}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              La modification de l&apos;email n&apos;est pas disponible pour le moment.
            </p>
          </div>

          {infoMsg && (
            <p role="alert" className="text-sm" style={{
              color: infoMsg.type === 'success' ? 'var(--success)' : 'var(--secondary)',
            }}>
              {infoMsg.text}
            </p>
          )}

          <button
            onClick={handleSaveProfile}
            disabled={isProfilePending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
            style={btnStyle}
            aria-busy={isProfilePending}
          >
            {isProfilePending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Save size={14} aria-hidden="true" />}
            Enregistrer
          </button>
        </div>
      </section>

      {/* ─── Changer le mot de passe ─── */}
      <section aria-labelledby="pwd-heading">
        <h2 id="pwd-heading" className="text-base font-bold mb-4 flex items-center gap-2">
          <Lock size={15} aria-hidden="true" />
          Changer le mot de passe
        </h2>
        <div className="p-6 border space-y-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          {(['current', 'new', 'confirm'] as const).map(field => (
            <div key={field}>
              <label
                htmlFor={`pwd-${field}`}
                className="block text-xs tracking-widest uppercase mb-1.5"
                style={{ color: 'var(--muted-foreground)' }}
              >
                {field === 'current' ? 'Mot de passe actuel' : field === 'new' ? 'Nouveau mot de passe' : 'Confirmer'}
              </label>
              <input
                id={`pwd-${field}`}
                type="password"
                value={field === 'current' ? currentPwd : field === 'new' ? newPwd : confirmPwd}
                onChange={e => {
                  if (field === 'current') setCurrentPwd(e.target.value)
                  else if (field === 'new') setNewPwd(e.target.value)
                  else setConfirmPwd(e.target.value)
                }}
                className="w-full px-3 py-2 text-sm"
                style={fieldStyle}
                autoComplete={field === 'current' ? 'current-password' : 'new-password'}
              />
            </div>
          ))}

          {pwdMsg && (
            <p role="alert" className="text-sm" style={{
              color: pwdMsg.type === 'success' ? 'var(--success)' : 'var(--secondary)',
            }}>
              {pwdMsg.text}
            </p>
          )}

          <button
            onClick={handleChangePassword}
            disabled={isPwdPending || !currentPwd || !newPwd || !confirmPwd}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
            style={btnStyle}
            aria-busy={isPwdPending}
          >
            {isPwdPending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Lock size={14} aria-hidden="true" />}
            Changer le mot de passe
          </button>
        </div>
      </section>

      {/* ─── Zone de danger ─── */}
      <section aria-labelledby="danger-heading">
        <h2 id="danger-heading" className="text-base font-bold mb-4 flex items-center gap-2"
          style={{ color: 'var(--secondary)' }}>
          <AlertTriangle size={15} aria-hidden="true" />
          Zone de danger
        </h2>
        <div className="p-6 border space-y-4"
          style={{ background: 'var(--card)', borderColor: 'var(--secondary)' }}>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            La suppression de ton compte est <strong>irréversible</strong>. Toutes tes données
            (participations, équipes, projets) seront perdues.
          </p>
          <div>
            <label htmlFor="delete-confirm" className="block text-xs tracking-widest uppercase mb-1.5"
              style={{ color: 'var(--muted-foreground)' }}>
              Tape SUPPRIMER pour confirmer
            </label>
            <input
              id="delete-confirm"
              type="text"
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder="SUPPRIMER"
              className="w-full px-3 py-2 text-sm"
              style={fieldStyle}
              aria-describedby="delete-hint"
            />
            <p id="delete-hint" className="sr-only">Entrez le mot SUPPRIMER en majuscules pour activer le bouton.</p>
          </div>
          <button
            onClick={handleDeleteAccount}
            disabled={isDeletePending || deleteConfirm !== 'SUPPRIMER'}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
            style={dangerStyle}
            aria-busy={isDeletePending}
          >
            {isDeletePending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <AlertTriangle size={14} aria-hidden="true" />}
            Supprimer mon compte définitivement
          </button>
        </div>
      </section>
    </div>
  )
}
