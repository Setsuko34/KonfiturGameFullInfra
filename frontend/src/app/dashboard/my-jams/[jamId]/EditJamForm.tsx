'use client'

import { useState, useTransition } from 'react'
import { Save, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { updateJam } from '@/lib/actions/dashboard'
import type { GameJam } from '@/types'

interface Props {
  jam: GameJam
}

export default function EditJamForm({ jam }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const [description, setDescription] = useState(jam.description)
  const [rulesText, setRulesText] = useState(jam.rules.join('\n'))
  const [prizesText, setPrizesText] = useState((jam.prizes ?? []).join('\n'))
  const [tagsText, setTagsText] = useState((jam.tags ?? []).join(', '))
  const [maxParticipants, setMaxParticipants] = useState(jam.maxParticipants?.toString() ?? '')
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  if (jam.status === 'ended') return null

  const handleSave = () => {
    startTransition(async () => {
      setMsg(null)

      const parsedMax = maxParticipants ? parseInt(maxParticipants, 10) : undefined
      if (maxParticipants && (isNaN(parsedMax!) || parsedMax! < 2)) {
        setMsg({ type: 'error', text: 'Nombre de participants invalide (min. 2)' })
        return
      }

      const result = await updateJam(jam.id, {
        description: description.trim(),
        rules: rulesText.split('\n').map(r => r.trim()).filter(Boolean),
        prizes: prizesText.split('\n').map(p => p.trim()).filter(Boolean),
        tags: tagsText.split(',').map(t => t.trim()).filter(Boolean),
        ...(parsedMax !== undefined ? { maxParticipants: parsedMax } : {}),
      })
      if (result.success) {
        setMsg({ type: 'success', text: 'Jam mise à jour' })
      } else {
        setMsg({ type: 'error', text: result.error ?? 'Erreur inconnue' })
      }
    })
  }

  const fieldStyle = {
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border)',
    color: 'var(--foreground)',
  }

  return (
    <div className="mb-8 border" style={{ borderColor: 'var(--border)' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold"
        style={{ background: 'var(--card)' }}
        aria-expanded={open}
      >
        <span>Modifier la jam</span>
        {open
          ? <ChevronUp size={14} aria-hidden="true" />
          : <ChevronDown size={14} aria-hidden="true" />
        }
      </button>

      {open && (
        <div className="p-5 border-t space-y-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Seuls les champs mineurs peuvent être modifiés. Le titre, le thème, le slug et les dates sont figés.
          </p>

          <div>
            <label htmlFor="edit-description" className="block text-xs tracking-widest uppercase mb-1"
              style={{ color: 'var(--muted-foreground)' }}>
              Description
            </label>
            <textarea
              id="edit-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 text-sm resize-none"
              style={fieldStyle}
            />
          </div>

          <div>
            <label htmlFor="edit-rules" className="block text-xs tracking-widest uppercase mb-1"
              style={{ color: 'var(--muted-foreground)' }}>
              Règles (une par ligne)
            </label>
            <textarea
              id="edit-rules"
              value={rulesText}
              onChange={e => setRulesText(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 text-sm resize-none font-mono text-xs"
              style={fieldStyle}
            />
          </div>

          <div>
            <label htmlFor="edit-prizes" className="block text-xs tracking-widest uppercase mb-1"
              style={{ color: 'var(--muted-foreground)' }}>
              Prix (un par ligne)
            </label>
            <textarea
              id="edit-prizes"
              value={prizesText}
              onChange={e => setPrizesText(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm resize-none"
              style={fieldStyle}
            />
          </div>

          <div>
            <label htmlFor="edit-tags" className="block text-xs tracking-widest uppercase mb-1"
              style={{ color: 'var(--muted-foreground)' }}>
              Tags (séparés par des virgules)
            </label>
            <input
              id="edit-tags"
              type="text"
              value={tagsText}
              onChange={e => setTagsText(e.target.value)}
              className="w-full px-3 py-2 text-sm"
              style={fieldStyle}
            />
          </div>

          <div>
            <label htmlFor="edit-max" className="block text-xs tracking-widest uppercase mb-1"
              style={{ color: 'var(--muted-foreground)' }}>
              Maximum de participants (optionnel)
            </label>
            <input
              id="edit-max"
              type="number"
              value={maxParticipants}
              onChange={e => setMaxParticipants(e.target.value)}
              min={2}
              max={10000}
              className="w-full px-3 py-2 text-sm"
              style={fieldStyle}
            />
          </div>

          {msg && (
            <p role="alert" className="text-sm" style={{
              color: msg.type === 'success' ? 'var(--success)' : 'var(--secondary)',
            }}>
              {msg.text}
            </p>
          )}

          <button
            onClick={handleSave}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
            aria-busy={isPending}
          >
            {isPending
              ? <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              : <Save size={14} aria-hidden="true" />
            }
            Enregistrer les modifications
          </button>
        </div>
      )}
    </div>
  )
}
