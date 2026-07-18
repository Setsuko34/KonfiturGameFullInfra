'use client'

import type { AuditLog } from '@/lib/actions/logs'

// Emoji drapeaux depuis un code pays ISO 3166-1 alpha-2
function countryFlag(code: string): string {
  if (!code || code === 'XX') return '🌐'
  const codePoints = [...code.toUpperCase()].map(c => 0x1F1E6 - 65 + c.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}

const typeColor: Record<string, string> = {
  connection: 'var(--muted-foreground)',
  auth: 'var(--primary)',
  error: 'var(--secondary)',
  bot_blocked: 'var(--secondary)',
  ban_applied: 'var(--success)',
  admin_action: 'var(--secondary)',
}

// Composant List de LoadMoreList : reçoit l'accumulation courante, purement affichage.
export default function LogsTable({ items }: { items: AuditLog[] }) {
  return (
    <div className="border overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
      <table className="w-full text-xs" role="grid">
        <thead>
          <tr style={{ background: 'var(--surface-elevated)' }}>
            {['Type', 'Message', 'IP', 'Pays', 'Chemin', 'Date'].map(h => (
              <th key={h} scope="col"
                className="text-left px-3 py-2 font-semibold tracking-wider"
                style={{ color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map(log => (
            <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <td className="px-3 py-2 font-mono font-semibold" style={{ color: typeColor[log.type] ?? 'var(--foreground)' }}>
                {log.type}
              </td>
              <td className="px-3 py-2 max-w-[260px] truncate" title={log.message}>
                {log.message ?? '—'}
              </td>
              <td className="px-3 py-2 font-mono" style={{ color: 'var(--muted-foreground)' }}>
                {log.ip ?? '—'}
              </td>
              <td className="px-3 py-2" title={log.countryCode}>
                {log.countryCode ? countryFlag(log.countryCode) : '—'}
              </td>
              <td className="px-3 py-2 max-w-[200px] truncate" style={{ color: 'var(--muted-foreground)' }}>
                {log.path ?? '—'}
              </td>
              <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--muted-foreground)' }}>
                {/* timeZone explicite : ce composant est SSR puis hydraté, le serveur (UTC en conteneur)
                    et le navigateur client (fuseau local) doivent produire le même texte, sinon Next.js
                    signale une erreur d'hydratation. */}
                {log.createdAt.toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', timeZone: 'Europe/Paris' })}
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={6} className="px-3 py-6 text-center" style={{ color: 'var(--muted-foreground)' }}>
                Aucun log disponible
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
