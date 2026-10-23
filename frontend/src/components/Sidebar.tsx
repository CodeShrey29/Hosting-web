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
} from 'lucide-react'
import { cn } from '../lib/utils'

const navItems = [
  {
    section: 'OVERVIEW',
    items: [{ to: '/', icon: LayoutDashboard, label: 'Dashboard' }],
  },
  {
    section: 'HOST',
    items: [
      { to: '/deploy?type=minecraft', icon: Gamepad2, label: 'Minecraft' },
      { to: '/deploy?type=python', icon: Code, label: 'Python' },
      { to: '/deploy?type=nodejs', icon: Terminal, label: 'Node.js' },
      { to: '/deploy?type=website', icon: Globe, label: 'Websites' },
      { to: '/deploy?type=docker', icon: Box, label: 'Docker' },
    ],
  },
  {
    section: 'PROJECTS',
    items: [{ to: '/projects', icon: FolderOpen, label: 'All Projects' }],
  },
  {
    section: 'INFRASTRUCTURE',
    items: [
      { to: '/servers', icon: Server, label: 'Servers' },
      { to: '/monitoring', icon: Activity, label: 'Monitoring' },
    ],
  },
  {
    section: 'ACCOUNT',
    items: [
      { to: '/billing', icon: CreditCard, label: 'Billing' },
      { to: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
]

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <aside className="h-full w-64 bg-card border-r flex flex-col">
      <div className="p-5 border-b flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Cloud Host</h1>
          <p className="text-xs text-muted-foreground mt-0.5">India-first · Local PC</p>
        </div>
        <button
          onClick={onNavigate}
          className="lg:hidden p-1 rounded-md hover:bg-accent"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-5">
        {navItems.map((group) => (
          <div key={group.section}>
            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-3">
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
                      'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-accent text-foreground'
                    )
                  }
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="p-4 border-t text-xs text-muted-foreground">
        Running on this PC
      </div>
    </aside>
  )
}
