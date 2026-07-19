'use client'

import { Send } from 'lucide-react'

export default function ChatComposer({
  value,
  onChange,
  onSend,
  disabled,
  placeholder,
  inputId,
  srLabel,
}: {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  disabled: boolean
  placeholder: string
  inputId: string
  srLabel: string
}) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  return (
    <>
      <div className="flex gap-2">
        <label htmlFor={inputId} className="sr-only">{srLabel}</label>
        <input
          id={inputId}
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          maxLength={2048}
          className="flex-1 px-3 py-2 text-sm"
          style={{
            background: 'var(--input-background)',
            border: '1px solid var(--border)',
            color: 'var(--foreground)',
            fontFamily: 'var(--font-sans)',
          }}
          aria-describedby={`${inputId}-hint`}
        />
        <button
          onClick={onSend}
          disabled={!value.trim() || disabled}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-opacity disabled:opacity-40"
          style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
          aria-label="Envoyer le message"
        >
          <Send size={15} aria-hidden="true" />
        </button>
      </div>
      <p id={`${inputId}-hint`} className="sr-only">
        Appuyez sur Entrée pour envoyer, Maj+Entrée pour une nouvelle ligne.
      </p>
    </>
  )
}
