import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'

const commands = [
  { label: 'Go to Dashboard', path: '/' },
  { label: 'Deploy new project', path: '/deploy' },
  { label: 'View Projects', path: '/projects' },
  { label: 'Servers', path: '/servers' },
  { label: 'Monitoring', path: '/monitoring' },
  { label: 'Billing', path: '/billing' },
  { label: 'Settings', path: '/settings' },
]

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    const openSearch = () => setOpen(true)
    window.addEventListener('keydown', handler)
    window.addEventListener('cloud-host:open-search', openSearch)
    return () => {
      window.removeEventListener('keydown', handler)
      window.removeEventListener('cloud-host:open-search', openSearch)
    }
  }, [])

  const filtered = commands.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase())
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 px-4 pt-[15vh] backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div className="command-panel w-full max-w-lg overflow-hidden rounded-xl border shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-2 p-3 border-b">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages and actions..."
            className="flex-1 bg-transparent outline-none text-sm"
          />
        </div>
        <div className="max-h-64 overflow-y-auto">
          {filtered.map((cmd) => (
            <button
              key={cmd.path}
              onClick={() => {
                navigate(cmd.path)
                setOpen(false)
                setQuery('')
              }}
              className="flex w-full items-center px-4 py-3 text-left text-sm transition-colors hover:bg-accent"
            >
              {cmd.label}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-4 py-6 text-sm text-muted-foreground text-center">
              No results
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
