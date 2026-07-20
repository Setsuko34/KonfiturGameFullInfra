import type { Metadata } from 'next'
import Link from 'next/link'
import { getRecentLogs, getCountryStats, getBannedIPs, type AuditLog } from '@/lib/actions/logs'
import BanIPForm from './BanIPForm'
import UnbanButton from './UnbanButton'
import ClearLogsButton from './ClearLogsButton'
import LogsTable from './LogsTable'
import LoadMoreList from '@/components/LoadMoreList'
import { Shield, Globe, AlertTriangle, Activity } from 'lucide-react'

export const metadata: Metadata = { title: 'Logs & Monitoring' }

// Emoji drapeaux depuis un code pays ISO 3166-1 alpha-2
function countryFlag(code: string): string {
  if (!code || code === 'XX') return '🌐'
  const codePoints = [...code.toUpperCase()].map(c => 0x1F1E6 - 65 + c.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}

const TYPE_FILTERS = [
  { label: 'Tous', value: undefined },
  { label: 'connection', value: 'connection' },
  { label: 'auth', value: 'auth' },
  { label: 'error', value: 'error' },
  { label: 'bot_blocked', value: 'bot_blocked' },
  { label: 'admin_action', value: 'admin_action' },
]

type Props = { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }

export default async function AdminLogsPage({ searchParams }: Props) {
  const sp = await searchParams
  const type = Array.isArray(sp.type) ? sp.type[0] : sp.type
  const [{ logs, nextCursor }, countryStats, bannedIPs] = await Promise.all([
    getRecentLogs(type),
    getCountryStats(),
    getBannedIPs(),
  ])

  const totalConnections = countryStats.reduce((a, b) => a + b.count, 0)

  async function loadMoreLogs(cursor: string): Promise<{ items: AuditLog[]; nextCursor: string | null }> {
    'use server'
    const res = await getRecentLogs(type, cursor)
    return { items: res.logs, nextCursor: res.nextCursor }
  }

  return (
    <section aria-labelledby="logs-heading">
      <div className="mb-8">
        <p className="label-tech mb-1" style={{ color: 'var(--muted-foreground)' }}>ADMIN</p>
        <h1 id="logs-heading" className="text-2xl font-bold">Logs & Monitoring</h1>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Colonne principale — logs récents */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats rapides */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Connexions', value: totalConnections, icon: Activity, color: 'var(--primary)' },
              { label: 'Bots bloqués', value: logs.filter(l => l.type === 'bot_blocked').length, icon: Shield, color: 'var(--secondary)' },
              { label: 'IPs bannies', value: bannedIPs.length, icon: AlertTriangle, color: 'var(--secondary)' },
            ].map(stat => (
              <div key={stat.label} className="p-4 border flex items-center gap-3"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <stat.icon size={18} style={{ color: stat.color }} aria-hidden="true" />
                <div>
                  <p className="text-xl font-bold">{stat.value}</p>
                  <p className="text-[9px] tracking-widest uppercase" style={{ color: 'var(--muted-foreground)' }}>
                    {stat.label}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Tableau des logs */}
          <div>
            <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
              <Activity size={13} aria-hidden="true" />
              Logs récents
            </h2>
            {/* Filtres par type */}
            <div className="flex flex-wrap gap-2 mb-3">
              {TYPE_FILTERS.map(f => (
                <Link
                  key={f.label}
                  href={f.value ? `/admin/logs?type=${f.value}` : '/admin/logs'}
                  className="px-3 py-1.5 text-xs font-mono border transition-opacity hover:opacity-80"
                  style={{
                    borderColor: type === f.value ? 'var(--primary)' : 'var(--border)',
                    color: type === f.value ? 'var(--primary)' : 'var(--muted-foreground)',
                    background: type === f.value ? 'rgba(79, 106, 255, 0.1)' : 'transparent',
                  }}
                >
                  {f.label}
                </Link>
              ))}
            </div>
            <LoadMoreList initialItems={logs} initialCursor={nextCursor} loadMore={loadMoreLogs} List={LogsTable} />
            <div className="mt-2 flex justify-end">
              <ClearLogsButton />
            </div>
          </div>
        </div>

        {/* Sidebar droite — pays + ban */}
        <div className="space-y-6">
          {/* Stats par pays */}
          <div>
            <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
              <Globe size={13} aria-hidden="true" />
              Connexions par pays
            </h2>
            <div className="border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
              {countryStats.length === 0 && (
                <p className="p-4 text-xs" style={{ color: 'var(--muted-foreground)' }}>Pas encore de données</p>
              )}
              {countryStats.map(({ country, count }) => (
                <div key={country}
                  className="flex items-center justify-between px-4 py-2 border-b"
                  style={{ borderColor: 'var(--border)' }}>
                  <span className="text-sm">
                    {countryFlag(country)} <span className="font-mono ml-1">{country}</span>
                  </span>
                  <span className="font-mono text-xs font-semibold" style={{ color: 'var(--primary)' }}>
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Gestion IPs bannies */}
          <div>
            <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
              <Shield size={13} aria-hidden="true" />
              IPs bannies ({bannedIPs.length})
            </h2>
            <BanIPForm />
            {bannedIPs.length > 0 && (
              <ul className="mt-3 space-y-1" role="list">
                {bannedIPs.map(entry => (
                  <li key={entry.id}
                    className="flex items-center justify-between px-3 py-2 border text-xs"
                    style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                    <div>
                      <p className="font-mono font-semibold">{entry.ip}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                        {entry.auto ? '🤖 Auto' : '👤 Manuel'}{entry.reason ? ` · ${entry.reason}` : ''}
                      </p>
                    </div>
                    <UnbanButton bannedIPId={entry.id} ip={entry.ip} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
