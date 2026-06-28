'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ID } from 'appwrite'
import { createJam } from '@/lib/actions/dashboard'
import { storage } from '@/lib/appwrite/client'
import { BUCKETS } from '@/lib/appwrite/config'
import { Plus, Trash2, ImageIcon } from 'lucide-react'

const COVER_MAX_BYTES = 5 * 1024 * 1024
const COVER_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export default function NewJamForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [theme, setTheme] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<'solo' | 'team' | 'both'>('both')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [rules, setRules] = useState([''])
  const [prizes, setPrizes] = useState([''])
  const [tags, setTags] = useState('')
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const autoSlug = (v: string) =>
    v.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!COVER_ALLOWED_TYPES.includes(file.type)) {
      setError('Format non supporté. Utilisez JPG, PNG ou WebP.')
      return
    }
    if (file.size > COVER_MAX_BYTES) {
      setError('La cover doit faire moins de 5 Mo.')
      return
    }
    setError('')
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const start = new Date(startDate)
      const end = new Date(endDate)
      const diffH = Math.round((end.getTime() - start.getTime()) / 36e5)
      const duration = diffH >= 24 ? `${Math.round(diffH / 24)}j` : `${diffH}h`

      let coverImageId: string | undefined
      if (coverFile) {
        const uploaded = await storage.createFile(BUCKETS.JAM_COVERS, ID.unique(), coverFile)
        coverImageId = uploaded.$id
      }

      await createJam({
        title,
        slug: slug || autoSlug(title),
        theme,
        description,
        type,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        duration,
        rules: rules.filter(Boolean),
        prizes: prizes.filter(Boolean),
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        coverImageId,
      })

      router.push('/dashboard/my-jams')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    background: 'var(--input-background)',
    border: '1px solid var(--border)',
    color: 'var(--foreground)',
  }

  return (
    <section aria-labelledby="new-jam-heading">
      <p className="text-[9px] tracking-widest uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
        Organisateur
      </p>
      <h1 id="new-jam-heading" className="text-2xl font-bold mb-8">Créer une jam</h1>

      {error && (
        <div
          className="p-3 mb-6 text-sm"
          role="alert"
          style={{ background: 'rgba(239,35,60,.1)', border: '1px solid var(--secondary)', color: 'var(--secondary)' }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl" noValidate>

        {/* Titre */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium mb-2">Titre *</label>
          <input
            id="title" type="text" required value={title}
            onChange={e => { setTitle(e.target.value); setSlug(autoSlug(e.target.value)) }}
            className="w-full px-3 py-2.5 text-sm" style={inputStyle}
          />
        </div>

        {/* Slug */}
        <div>
          <label htmlFor="slug" className="block text-sm font-medium mb-2">Slug (URL)</label>
          <input
            id="slug" type="text" value={slug}
            onChange={e => setSlug(autoSlug(e.target.value))}
            className="w-full px-3 py-2.5 text-sm font-mono" style={inputStyle}
          />
          <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
            /jam/{slug || 'mon-slug'}
          </p>
        </div>

        {/* Thème */}
        <div>
          <label htmlFor="theme" className="block text-sm font-medium mb-2">Thème *</label>
          <input
            id="theme" type="text" required value={theme}
            onChange={e => setTheme(e.target.value)}
            className="w-full px-3 py-2.5 text-sm" style={inputStyle}
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium mb-2">Description *</label>
          <textarea
            id="description" required rows={4} value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full px-3 py-2.5 text-sm resize-y" style={inputStyle}
          />
        </div>

        {/* Type */}
        <div>
          <p className="block text-sm font-medium mb-2">Type de participation</p>
          <div className="flex gap-3">
            {(['solo', 'team', 'both'] as const).map(t => (
              <label key={t} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="type" value={t} checked={type === t} onChange={() => setType(t)} />
                <span className="text-sm capitalize">{t === 'both' ? 'Solo & Équipe' : t === 'team' ? 'Équipe' : 'Solo'}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Cover */}
        <div>
          <p className="block text-sm font-medium mb-2">Image de couverture</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleCoverChange}
            className="hidden"
            id="coverInput"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-3 w-full px-4 py-3 text-sm border"
            style={{ ...inputStyle, borderStyle: 'dashed', color: 'var(--muted-foreground)' }}
          >
            <ImageIcon size={16} aria-hidden="true" />
            {coverFile ? coverFile.name : 'Choisir une image (JPG, PNG, WebP — max 5 Mo)'}
          </button>
          {coverPreview && (
            <Image
              src={coverPreview}
              alt="Aperçu de la cover"
              width={800}
              height={160}
              unoptimized
              className="mt-3 w-full max-h-40 object-cover"
              style={{ border: '1px solid var(--border)' }}
            />
          )}
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium mb-2">Date de début *</label>
            <input
              id="startDate" type="datetime-local" required value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full px-3 py-2.5 text-sm" style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium mb-2">Date de fin *</label>
            <input
              id="endDate" type="datetime-local" required value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full px-3 py-2.5 text-sm" style={inputStyle}
            />
          </div>
        </div>

        {/* Règles */}
        <div>
          <p className="block text-sm font-medium mb-2">Règles</p>
          {rules.map((rule, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input
                type="text" value={rule} placeholder={`Règle ${i + 1}`}
                onChange={e => { const r = [...rules]; r[i] = e.target.value; setRules(r) }}
                className="flex-1 px-3 py-2 text-sm" style={inputStyle}
              />
              <button
                type="button"
                onClick={() => setRules(rules.filter((_, j) => j !== i))}
                className="px-2"
                style={{ color: 'var(--muted-foreground)' }}
                aria-label="Supprimer cette règle"
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setRules([...rules, ''])}
            className="flex items-center gap-2 text-sm"
            style={{ color: 'var(--primary)' }}
          >
            <Plus size={13} aria-hidden="true" /> Ajouter une règle
          </button>
        </div>

        {/* Prix */}
        <div>
          <p className="block text-sm font-medium mb-2">Prix</p>
          {prizes.map((prize, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input
                type="text" value={prize} placeholder={`${i + 1}ᵉ prix`}
                onChange={e => { const p = [...prizes]; p[i] = e.target.value; setPrizes(p) }}
                className="flex-1 px-3 py-2 text-sm" style={inputStyle}
              />
              <button
                type="button"
                onClick={() => setPrizes(prizes.filter((_, j) => j !== i))}
                className="px-2"
                style={{ color: 'var(--muted-foreground)' }}
                aria-label="Supprimer ce prix"
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setPrizes([...prizes, ''])}
            className="flex items-center gap-2 text-sm"
            style={{ color: 'var(--primary)' }}
          >
            <Plus size={13} aria-hidden="true" /> Ajouter un prix
          </button>
        </div>

        {/* Tags */}
        <div>
          <label htmlFor="tags" className="block text-sm font-medium mb-2">Tags (séparés par des virgules)</label>
          <input
            id="tags" type="text" value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="2D, Unity, Débutants bienvenus"
            className="w-full px-3 py-2.5 text-sm" style={inputStyle}
          />
        </div>

        {/* Submit */}
        <div className="flex gap-4 pt-2">
          <button
            type="submit"
            disabled={loading || !title || !theme || !description || !startDate || !endDate}
            className="px-6 py-3 font-bold text-sm disabled:opacity-50"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            {loading ? 'Création...' : 'Créer la jam'}
          </button>
          <Link
            href="/dashboard/my-jams"
            className="px-6 py-3 font-bold text-sm"
            style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
          >
            Annuler
          </Link>
        </div>
      </form>
    </section>
  )
}

