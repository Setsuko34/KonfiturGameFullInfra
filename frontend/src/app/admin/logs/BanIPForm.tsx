'use client'

import { useState, useTransition } from 'react'
import { Shield, Loader2 } from 'lucide-react'
import { banIP } from '@/lib/actions/logs'

export default function BanIPForm() {
  const [ip, setIp] = useState('')
  const [reason, setReason] = useState('')
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleBan = () => {
    startTransition(async () => {
      setMsg(null)
      const result = await banIP(ip, reason)
      if (result.success) {
        setIp('')
        setReason('')
        setMsg({ type: 'success', text: 'IP bannie' })
      } else {
        setMsg({ type: 'error', text: result.error ?? 'Erreur' })
      }
    })
  }

  const fieldStyle = {
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border)',
    color: 'var(--foreground)',
  }

  return (
    <div className="p-3 border space-y-2" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
      <input
        type="text"
        value={ip}
        onChange={e => setIp(e.target.value)}
        placeholder="IP (ex: 1.2.3.4)"
        className="w-full px-2 py-1.5 text-xs font-mono"
        style={fieldStyle}
        aria-label="Adresse IP à bannir"
      />
      <input
        type="text"
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="Raison (optionnel)"
        className="w-full px-2 py-1.5 text-xs"
        style={fieldStyle}
        aria-label="Raison du ban"
      />
      {msg && (
        <p className="text-xs" style={{ color: msg.type === 'success' ? 'var(--success)' : 'var(--secondary)' }}>
          {msg.text}
        </p>
      )}
      <button
        onClick={handleBan}
        disabled={isPending || !ip.trim()}
        className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
        style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}
        aria-busy={isPending}
      >
        {isPending ? <Loader2 size={10} className="animate-spin" aria-hidden="true" /> : <Shield size={10} aria-hidden="true" />}
        Bannir
      </button>
    </div>
  )
}
