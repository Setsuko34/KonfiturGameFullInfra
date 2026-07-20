'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { exportUserData } from '@/lib/actions/export'

export default function ExportDataButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleExport = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await exportUserData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `konfiturgame-donnees-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError("L'export a échoué. Réessayez ou contactez le support.")
    }
    setLoading(false)
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleExport}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2 min-h-11 text-sm font-medium border transition-opacity hover:opacity-80 disabled:opacity-50"
        style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
      >
        <Download size={15} aria-hidden="true" />
        {loading ? 'Préparation…' : 'Télécharger mes données (JSON)'}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-xs" style={{ color: 'var(--secondary)' }}>{error}</p>
      )}
    </div>
  )
}
