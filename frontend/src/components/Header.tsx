import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import type { RefObject } from 'react'
import { Command, LogOut, Menu, Moon, Search, Sun } from 'lucide-react'

const pageNames: Record<string, string> = {
  '/': 'Your workspace',
  '/projects': 'Projects',
  '/deploy': 'Deploy',
  '/servers': 'Workers',
  '/monitoring': 'Monitoring',
  '/billing': 'Plans & billing',
  '/settings': 'Settings',
}

export default function Header({
  menuButtonRef,
  menuExpanded = false,
  onMenuClick,
  onLogout,
  accountEmail,
}: {
  menuButtonRef?: RefObject<HTMLButtonElement>
  menuExpanded?: boolean
  onMenuClick?: () => void
  onLogout?: () => void
  accountEmail?: string
}) {
  const [dark, setDark] = useState(() => window.localStorage.getItem('cloud-host-theme') !== 'light')
  const location = useLocation()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    window.localStorage.setItem('cloud-host-theme', dark ? 'dark' : 'light')
  }, [dark])

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('cloud-host-theme')
    if (savedTheme) setDark(savedTheme === 'dark')
  }, [])

  const openSearch = () => window.dispatchEvent(new Event('cloud-host:open-search'))

  return (
    <header className="topbar sticky top-0 z-30 flex h-[64px] shrink-0 items-center gap-4 border-b border-border px-4 sm:px-6">
      <button
        type="button"
        ref={menuButtonRef}
        onClick={onMenuClick}
        aria-label="Open navigation"
        aria-controls="primary-navigation"
        aria-expanded={menuExpanded}
        className="icon-button mobile-menu-button lg:hidden"
      >
        <Menu className="h-[18px] w-[18px]" />
      </button>

      <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
        <span className="text-muted-foreground/70">Workspace</span>
        <span className="text-muted-foreground/40">/</span>
        <span className="font-medium text-foreground">{pageNames[location.pathname] || 'Control plane'}</span>
      </div>

      <button
        type="button"
        onClick={openSearch}
        aria-label="Search projects and pages"
        className="search-trigger ml-auto flex h-9 w-full max-w-[320px] items-center gap-2 rounded-lg border border-border/80 bg-background/70 px-3 text-left text-xs text-muted-foreground transition-colors hover:border-border hover:bg-accent/50 sm:ml-6"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1">Search projects, pages...</span>
        <kbd className="hidden items-center gap-1 rounded border border-border bg-secondary/70 px-1.5 py-1 font-mono text-[9px] text-muted-foreground sm:flex">
          <Command className="h-2.5 w-2.5" /> K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1 sm:ml-2">
        <button type="button" onClick={openSearch} aria-label="Open command search" className="icon-button sm:hidden">
          <Search className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={() => setDark((value) => !value)}
          className="icon-button"
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
        <span aria-label={accountEmail || 'Local host account'} title={accountEmail || 'Local host account'} className="ml-1 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-gradient-to-br from-primary/25 to-cyan-400/10 text-[10px] font-semibold text-foreground">
          {(accountEmail || 'LH').slice(0, 2).toUpperCase()}
        </span>
        {onLogout && <button type="button" onClick={onLogout} aria-label="Sign out" title="Sign out" className="icon-button"><LogOut className="h-4 w-4" /></button>}
      </div>
    </header>
  )
}
