'use client'

import { useState, useRef } from 'react'
import { Upload, X, Loader2, CheckCircle } from 'lucide-react'
import { ID, Permission, Role } from 'appwrite'
import { storage } from '@/lib/appwrite/client'

interface Props {
  label: string
  bucketId: string
  accept: string          // ex. ".zip" ou "image/jpeg,image/png,image/webp"
  maxSizeMo: number
  userId: string
  onUploaded: (fileId: string) => void
  onRemoved: () => void
  onBusyChange?: (busy: boolean) => void  // upload en cours → le parent désactive le submit
  initialFileId?: string
}

export default function FileUploadField({
  label, bucketId, accept, maxSizeMo, userId, onUploaded, onRemoved, onBusyChange, initialFileId,
}: Props) {
  const [fileId, setFileId] = useState<string | undefined>(initialFileId)
  const [fileName, setFileName] = useState<string | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploadedInSession, setUploadedInSession] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setError(null)
    if (file.size > maxSizeMo * 1024 * 1024) {
      setError(`Fichier trop lourd (max ${maxSizeMo} Mo).`)
      return
    }
    setProgress(0)
    try {
      // Permissions provisoires : seul l'uploader lit/modifie — la lecture
      // publique est ouverte côté serveur à la soumission
      onBusyChange?.(true)
      const created = await storage.createFile(
        bucketId,
        ID.unique(),
        file,
        [
          Permission.read(Role.user(userId)),
          Permission.update(Role.user(userId)),
          Permission.delete(Role.user(userId)),
        ],
        p => setProgress(Math.round(p.progress))
      )
      setFileId(created.$id)
      setFileName(file.name)
      setUploadedInSession(true)
      onUploaded(created.$id)
    } catch {
      setError('Échec de l\'upload. Réessaie.')
    } finally {
      setProgress(null)
      onBusyChange?.(false)
    }
  }

  const handleRemove = async () => {
    // Ne supprimer du storage que les fichiers uploadés dans cette session — un fichier initial
    // (potentiellement uploadé par un coéquipier) est délié ici et supprimé par le serveur à la resoumission
    if (fileId && uploadedInSession) await storage.deleteFile(bucketId, fileId).catch(() => {}) // déjà supprimé = OK
    setFileId(undefined)
    setFileName(null)
    setUploadedInSession(false)
    onRemoved()
  }

  return (
    <div>
      <p className="label-tech mb-1" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
      {fileId ? (
        <div className="flex items-center justify-between px-3 py-2 border text-sm"
          style={{ background: 'var(--surface-elevated)', borderColor: 'var(--success)' }}>
          <span className="flex items-center gap-2 truncate">
            <CheckCircle size={14} style={{ color: 'var(--success)' }} aria-hidden="true" />
            {fileName ?? 'Fichier envoyé'}
          </span>
          <button type="button" onClick={handleRemove} aria-label={`Retirer ${label}`}
            className="p-1 cursor-pointer" style={{ color: 'var(--muted-foreground)' }}>
            <X size={13} aria-hidden="true" />
          </button>
        </div>
      ) : progress !== null ? (
        <div className="px-3 py-2 border text-sm flex items-center gap-2"
          style={{ background: 'var(--surface-elevated)', borderColor: 'var(--border)' }}
          role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          Envoi… {progress}%
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()}
          className="w-full px-3 py-2 border text-sm flex items-center gap-2 cursor-pointer"
          style={{ background: 'var(--input-background)', borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
          <Upload size={14} aria-hidden="true" />
          Choisir un fichier (max {maxSizeMo} Mo)
        </button>
      )}
      <input ref={inputRef} type="file" accept={accept} className="sr-only"
        aria-label={label}
        disabled={Boolean(fileId) || progress !== null}
        onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) handleFile(f) }} />
      {error && <p role="alert" className="text-xs mt-1" style={{ color: 'var(--secondary)' }}>{error}</p>}
    </div>
  )
}
