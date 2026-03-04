'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  LayoutDashboard, Users, Trophy, Send, BarChart3,
  Gamepad2, Plus, LogOut, Menu, X,
} from 'lucide-react'
import { useAuth } from '@/components/providers/AuthProvider'
import { mockJams, mockStats } from '@/lib/mockData'
import StatBlock from '@/components/StatBlock'
import JamCard from '@/components/JamCard'

type Section = 'overview' | 'participants' | 'teams' | 'submissions' | 'rankings'

const sidebarItems: { id: Section; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Vue d\'ensemble', icon: LayoutDashboard },
  { id: 'participants', label: 'Participants', icon: Users },
  { id: 'teams', label: 'Équipes', icon: Users },
  { id: 'submissions', label: 'Soumissions', icon: Send },
  { id: 'rankings', label: 'Classements', icon: BarChart3 },
]

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const [activeSection, setActiveSection] = useState<Section>('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const ongoingJam = mockJams.find(j => j.status === 'ongoing')

  const handleLogout = async () => {
    await logout()
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--background)', color: 'var(--foreground)' }}
    >
      {/* Header mobile */}
      <header
        className="md:hidden flex items-center justify-between px-4 py-3 border-b sticky top-0 z-40"
        style={{ background: 'var(--sidebar)', borderColor: 'var(--sidebar-border)' }}
        role="banner"
      >
        <div className="flex items-center gap-2 font-bold">
          <Gamepad2 size={18} style={{ color: 'var(--primary)' }} aria-hidden="true" />
          <span>Dashboard</span>
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-expanded={sidebarOpen}
          aria-label={sidebarOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          className="p-2"
        >
          {sidebarOpen
            ? <X size={20} aria-hidden="true" />
            : <Menu size={20} aria-hidden="true" />
          }
        </button>
      </header>

      <div className="flex flex-1 relative">
        {/* Sidebar desktop */}
        <nav
          className={`
            fixed inset-y-0 left-0 z-30 w-60 flex flex-col border-r
            md:relative md:flex md:translate-x-0
            transition-transform duration-200
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}
          style={{
            background: 'var(--sidebar)',
            borderColor: 'var(--sidebar-border)',
          }}
          aria-label="Navigation du dashboard"
        >
          {/* Logo */}
          <div
            className="flex items-center gap-2 px-5 py-4 border-b"
            style={{ borderColor: 'var(--sidebar-border)' }}
          >
            <Gamepad2 size={20} style={{ color: 'var(--primary)' }} aria-hidden="true" />
            <Link
              href="/"
              className="font-bold"
              style={{ color: 'var(--sidebar-foreground)' }}
            >
              Konfitur<span style={{ color: 'var(--primary)' }}>Game</span>
            </Link>
          </div>

          {/* Utilisateur */}
          {user && (
            <div
              className="px-5 py-3 border-b"
              style={{ borderColor: 'var(--sidebar-border)' }}
            >
              <p className="label-tech mb-1" style={{ color: 'var(--muted-foreground)' }}>
                CONNECTÉ EN TANT QUE
              </p>
              <p className="font-semibold text-sm truncate" style={{ color: 'var(--sidebar-foreground)' }}>
                {user.name}
              </p>
            </div>
          )}

          {/* Liens */}
          <ul className="flex-1 p-3 space-y-1" role="list">
            {sidebarItems.map(item => (
              <li key={item.id}>
                <button
                  onClick={() => {
                    setActiveSection(item.id)
                    setSidebarOpen(false)
                  }}
                  aria-current={activeSection === item.id ? 'page' : undefined}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-left transition-colors"
                  style={{
                    background: activeSection === item.id ? 'var(--sidebar-accent)' : 'transparent',
                    color: activeSection === item.id ? 'var(--sidebar-primary)' : 'var(--sidebar-foreground)',
                  }}
                >
                  <item.icon size={16} aria-hidden="true" />
                  {item.label}
                </button>
              </li>
            ))}
          </ul>

          {/* Déconnexion */}
          <div
            className="p-3 border-t"
            style={{ borderColor: 'var(--sidebar-border)' }}
          >
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors"
              style={{ color: 'var(--muted-foreground)' }}
            >
              <LogOut size={16} aria-hidden="true" />
              Déconnexion
            </button>
          </div>
        </nav>

        {/* Overlay mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 md:hidden"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Contenu principal */}
        <main id="main-content" className="flex-1 overflow-auto p-6 pb-24 md:pb-6">
          {/* Vue d'ensemble */}
          {activeSection === 'overview' && (
            <section aria-labelledby="overview-heading">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="label-tech mb-1" style={{ color: 'var(--muted-foreground)' }}>
                    DASHBOARD
                  </p>
                  <h1 id="overview-heading" className="text-2xl font-bold">
                    Vue d&apos;ensemble
                  </h1>
                </div>
                <button
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold"
                  style={{
                    background: 'var(--primary)',
                    color: 'var(--primary-foreground)',
                  }}
                >
                  <Plus size={15} aria-hidden="true" />
                  Nouvelle jam
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatBlock icon={Gamepad2} value={mockStats.jamsOrganized} label="JAMS" />
                <StatBlock icon={Users} value={mockStats.participants} label="PARTICIPANTS" />
                <StatBlock icon={Trophy} value={mockStats.projectsSubmitted} label="PROJETS" />
                <StatBlock icon={BarChart3} value={mockStats.countriesRepresented} label="PAYS" />
              </div>

              {/* Jam en cours */}
              {ongoingJam && (
                <div>
                  <h2 className="text-lg font-bold mb-4">Jam en cours</h2>
                  <div className="max-w-sm">
                    <JamCard jam={ongoingJam} variant="featured" />
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Participants */}
          {activeSection === 'participants' && (
            <section aria-labelledby="participants-heading">
              <h1 id="participants-heading" className="text-2xl font-bold mb-6">Participants</h1>
              <div
                className="p-8 border text-center"
                style={{ background: 'var(--card)', borderColor: 'var(--border)', borderStyle: 'dashed' }}
              >
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Liste des participants disponible après connexion Appwrite.
                </p>
              </div>
            </section>
          )}

          {/* Équipes */}
          {activeSection === 'teams' && (
            <section aria-labelledby="teams-heading">
              <h1 id="teams-heading" className="text-2xl font-bold mb-6">Équipes</h1>
              <div
                className="p-8 border text-center"
                style={{ background: 'var(--card)', borderColor: 'var(--border)', borderStyle: 'dashed' }}
              >
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Liste des équipes disponible après connexion Appwrite.
                </p>
              </div>
            </section>
          )}

          {/* Soumissions */}
          {activeSection === 'submissions' && (
            <section aria-labelledby="submissions-heading">
              <h1 id="submissions-heading" className="text-2xl font-bold mb-6">Soumissions</h1>
              <div
                className="p-8 border text-center"
                style={{ background: 'var(--card)', borderColor: 'var(--border)', borderStyle: 'dashed' }}
              >
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Projets soumis disponibles après connexion Appwrite.
                </p>
              </div>
            </section>
          )}

          {/* Classements */}
          {activeSection === 'rankings' && (
            <section aria-labelledby="rankings-heading">
              <h1 id="rankings-heading" className="text-2xl font-bold mb-6">Classements</h1>
              <div
                className="p-8 border text-center"
                style={{ background: 'var(--card)', borderColor: 'var(--border)', borderStyle: 'dashed' }}
              >
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Classements disponibles après la fin de la jam.
                </p>
              </div>
            </section>
          )}
        </main>
      </div>

      {/* Navigation bottom mobile */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 border-t z-30 flex"
        style={{ background: 'var(--sidebar)', borderColor: 'var(--sidebar-border)' }}
        aria-label="Navigation mobile du dashboard"
      >
        {sidebarItems.slice(0, 4).map(item => (
          <button
            key={item.id}
            onClick={() => setActiveSection(item.id)}
            aria-current={activeSection === item.id ? 'page' : undefined}
            className="flex-1 flex flex-col items-center py-3 gap-1 text-xs font-medium"
            style={{
              color: activeSection === item.id ? 'var(--primary)' : 'var(--muted-foreground)',
            }}
          >
            <item.icon size={18} aria-hidden="true" />
            <span className="label-tech text-[8px]">
              {item.label.split(' ')[0].toUpperCase()}
            </span>
          </button>
        ))}
      </nav>
    </div>
  )
}
