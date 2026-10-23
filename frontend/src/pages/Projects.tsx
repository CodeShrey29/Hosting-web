import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Terminal, Square, Trash2, Box } from 'lucide-react'

export default function Projects() {
  const [projects, setProjects] = useState<any[]>([])
  const [logs, setLogs] = useState('')
  const [selected, setSelected] = useState<number | null>(null)

  const load = () => fetch('/api/projects').then(r => r.json()).then(setProjects).catch(() => {})
  useEffect(() => { load() }, [])

  const viewLogs = async (id: number) => {
    setSelected(id)
    const res = await fetch(`/api/projects/${id}/logs`)
    const data = await res.json()
    setLogs(data.logs || 'No logs')
  }

  const stop = async (id: number) => {
    await fetch(`/api/projects/${id}/stop`, { method: 'POST' })
    load()
  }

  const remove = async (id: number) => {
    if (!confirm('Delete this project?')) return
    await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    load()
    if (selected === id) { setLogs(''); setSelected(null) }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground mt-1">{projects.length} total</p>
        </div>
        <Link
          to="/deploy"
          className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          New
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          {projects.length === 0 && (
            <div className="bg-card border rounded-xl p-12 text-center">
              <Box className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No projects</p>
            </div>
          )}
          {projects.map((p) => (
            <div key={p.id} className="bg-card border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.type} · {p.ram_mb} MB</div>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                  p.status === 'running' ? 'bg-green-500/10 text-green-600' : 'bg-secondary text-muted-foreground'
                }`}>
                  {p.status}
                </span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => viewLogs(p.id)} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-secondary hover:bg-accent rounded-lg transition-colors">
                  <Terminal className="h-3.5 w-3.5" /> Logs
                </button>
                {p.status === 'running' && (
                  <button onClick={() => stop(p.id)} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-secondary hover:bg-accent rounded-lg transition-colors">
                    <Square className="h-3.5 w-3.5" /> Stop
                  </button>
                )}
                <button onClick={() => remove(p.id)} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 text-red-600 hover:bg-red-500/10 rounded-lg transition-colors ml-auto">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b text-sm font-medium">
            Logs {selected && <span className="text-muted-foreground">#{selected}</span>}
          </div>
          <pre className="p-4 text-xs font-mono overflow-auto max-h-96 text-muted-foreground whitespace-pre-wrap">
            {logs || 'Select a project to view logs'}
          </pre>
        </div>
      </div>
    </div>
  )
}
