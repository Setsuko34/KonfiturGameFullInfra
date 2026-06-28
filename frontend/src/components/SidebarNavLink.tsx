'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'

interface SidebarNavLinkProps {
  href: string
  icon: LucideIcon
  label: string
  exact?: boolean
  activeBackground?: string
  activeColor?: string
  inactiveColor?: string
  onClose?: () => void
}

export default function SidebarNavLink({
  href,
  icon: Icon,
  label,
  exact = false,
  activeBackground = 'var(--sidebar-accent)',
  activeColor = 'var(--sidebar-primary)',
  inactiveColor = 'var(--sidebar-foreground)',
  onClose,
}: SidebarNavLinkProps) {
  const pathname = usePathname()
  const isActive = exact ? pathname === href : pathname.startsWith(href)

  return (
    <Link
      href={href}
      onClick={onClose}
      aria-current={isActive ? 'page' : undefined}
      className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors"
      style={{
        background: isActive ? activeBackground : 'transparent',
        color: isActive ? activeColor : inactiveColor,
      }}
    >
      <Icon size={15} aria-hidden="true" />
      {label}
    </Link>
  )
}