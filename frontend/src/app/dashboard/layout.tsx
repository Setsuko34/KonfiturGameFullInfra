import type { Metadata } from 'next'
import DashboardSidebar from './DashboardSidebar'

export const metadata: Metadata = {
  title: { default: 'Dashboard', template: '%s | KonfiturGame' },
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <DashboardSidebar />
      <main id="main-content" className="flex-1 overflow-auto p-6 pb-24 md:pb-6 md:ml-60">
        {children}
      </main>
    </div>
  )
}
