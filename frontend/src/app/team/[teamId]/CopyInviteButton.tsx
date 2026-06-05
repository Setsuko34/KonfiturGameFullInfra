'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface Props {
  code: string
}

export default function CopyInviteButton({ code }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-2 px-4 py-2 text-sm font-semibold"
      style={{
        border: '1px solid var(--border)',
        color: copied ? 'var(--success)' : 'var(--foreground)',
        background: 'var(--surface-elevated)',
      }}
      aria-label="Copier le code d'invitation"
    >
      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      {copied ? 'Copié !' : 'Copier'}
    </button>
  )
}
