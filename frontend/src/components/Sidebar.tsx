import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Server,
  FolderOpen,
  Activity,
  CreditCard,
  Settings,
  Box,
  Code,
  Globe,
  Gamepad2,
  Terminal,
  X,
  Cloud,
} from 'lucide-react'
import { cn } from '../lib/utils'

const navItems = [
  {
    section: 'Overview',
    items: [{ to: '/', icon: LayoutDashboard, label: 'Dashboard' }],
  },
  {
    section: 'Deploy',
    items: [
      { to: '/deploy?type=minecraft', icon: Gamepad2, label: 'Minecraft' },
      { to: '/deploy?type=python', icon: Code, label: 'Python' },
      { to: '/deploy?type=nodejs', icon: Terminal, label: 'Node.js' },
      { to: '/deploy?type=website', icon: Globe, label: 'Websites' },
      { to: '/deploy?type=docker', icon: Box, label: 'Docker' },
    ],
  },
  {
    section: 'Manage',
    items: [
      { to: '/projects', icon: FolderOpen, label: 'Projects' },
      { to: '/servers', icon: Server, label: 'Servers' },
      { to: '/monitoring', icon: Activity, label: 'Monitoring' },
    ],
  },
  {
    section: 'Account',
    items: [
      { to: '/billing', icon: CreditCard, label: 'Billing' },
      { to: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
]

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <aside className="h-full w-64 bg-card border-r flex flex-col">
      <div className="p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shadow-sm">
            <Cloud className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-sm">Cloud Host</h1>
            <p className="text-[11px] text-muted-foreground">Local PC</p>
          </div>
        </div>
        <button
          onClick={onNavigate}
          className="lg:hidden p-1.5 rounded-lg hover:bg-accent"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-6">
        {navItems.map((group) => (
          <div key={group.section}>
            <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2 px-3">
              {group.section}
            </h3>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
                      isActive
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    )
                  }
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3 mx-3 mb-4 rounded-xl bg-secondary/60">
        <div className="flex items-center gap-2 text-xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-muted-foreground">Worker healthy</span>
        </div>
      </div>
    </aside>
  )
}
