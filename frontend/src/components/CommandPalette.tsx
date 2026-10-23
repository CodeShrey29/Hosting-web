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
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const filtered = commands.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase())
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-32">
      <div className="w-full max-w-lg bg-card border rounded-lg shadow-xl">
        <div className="flex items-center gap-2 p-3 border-b">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command..."
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
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-accent"
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
