import { Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  Activity,
  Box,
  Cloud,
  Code2,
  CreditCard,
  FolderKanban,
  Globe2,
  LayoutDashboard,
  Server,
  Settings2,
  Terminal,
  X,
} from 'lucide-react'
import { cn } from '../lib/utils'

const groups = [
  {
    label: 'Workspace',
    items: [{ to: '/', label: 'Overview', icon: LayoutDashboard }],
  },
  {
    label: 'Build & deploy',
    items: [
      { to: '/projects', label: 'Projects', icon: FolderKanban },
      { to: '/deploy?type=website', label: 'Websites', icon: Globe2 },
      { to: '/deploy?type=nodejs', label: 'Node.js', icon: Terminal },
      { to: '/deploy?type=python', label: 'Python', icon: Code2 },
      { to: '/deploy?type=docker', label: 'Docker', icon: Box },
      { to: '/deploy?type=minecraft', label: 'Game servers', icon: Activity },
    ],
  },
  {
    label: 'Infrastructure',
    items: [
      { to: '/servers', label: 'Workers', icon: Server },
      { to: '/monitoring', label: 'Monitoring', icon: Activity },
    ],
  },
  {
    label: 'Account',
    items: [
      { to: '/billing', label: 'Plans & billing', icon: CreditCard },
      { to: '/settings', label: 'Settings', icon: Settings2 },
    ],
  },
]

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation()
  const [mode, setMode] = useState('local-pc')

  useEffect(() => {
    fetch('/api/health')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Health request failed')))
      .then((data) => setMode(data.mode || 'local-pc'))
      .catch(() => setMode('unavailable'))
  }, [])

  const isRender = mode === 'render'

  return (
    <aside className="sidebar flex h-full w-[264px] flex-col border-r border-border">
      <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-border px-5">
        <Link to="/" onClick={onNavigate} className="flex min-w-0 items-center gap-3">
          <span className="brand-mark flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
            <Cloud className="h-[18px] w-[18px] text-white" strokeWidth={2.2} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-semibold tracking-[-0.02em]">Cloud Host</span>
            <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Control plane</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={onNavigate}
          aria-label="Close navigation"
          className="icon-button lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-3 pt-4">
        <div className="workspace-switcher flex items-center gap-3 rounded-xl border border-border/80 px-3 py-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Cloud className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold">Personal workspace</span>
            <span className="mt-0.5 block text-[10px] text-muted-foreground">
              {isRender ? 'Render environment' : mode === 'unavailable' ? 'Connection unavailable' : 'Local environment'}
            </span>
          </span>
        </div>
      </div>

      <nav aria-label="Main navigation" className="min-h-0 flex-1 space-y-6 overflow-y-auto px-3 py-6">
        {groups.map((group) => (
          <section key={group.label}>
            <h2 className="nav-section-label mb-2 px-3">{group.label}</h2>
            <div className="space-y-1">
              {group.items.map((item) => {
                const [path, query] = item.to.split('?')
                const active =
                  location.pathname === path &&
                  (query ? location.search === `?${query}` : path === '/' || !location.search)
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'nav-link group flex items-center gap-3 rounded-lg px-3 py-[9px] text-[13px] font-medium transition-colors',
                      active
                        ? 'nav-link-active'
                        : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground',
                    )}
                  >
                    <item.icon className="h-[17px] w-[17px] shrink-0 opacity-80 group-hover:opacity-100" strokeWidth={1.8} />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </section>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <div className="rounded-xl border border-border/80 bg-background/50 p-3">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${mode === 'unavailable' ? 'bg-amber-400' : 'bg-cyan-400'}`} />
            <span className="text-[11px] font-semibold">{isRender ? 'Render control plane' : mode === 'unavailable' ? 'API unavailable' : 'Local PC mode'}</span>
          </div>
          <p className="mt-1.5 pl-4 text-[10px] leading-relaxed text-muted-foreground">
            {isRender ? 'Hosted dashboard. No worker is enrolled yet.' : 'Single-node environment. Public hosting is not configured.'}
          </p>
        </div>
        <div className="mt-3 flex items-center gap-2 px-2 text-[10px] text-muted-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-[9px] font-semibold text-foreground">LH</span>
          <span>Local host</span>
          <span className="ml-auto rounded-md border border-border px-1.5 py-0.5 font-mono text-[9px]">DEV</span>
        </div>
      </div>
    </aside>
  )
}
