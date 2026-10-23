import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Server, Code, Globe } from 'lucide-react'

export default function Projects() {
  const [projects, setProjects] = useState<any[]>([])
  const [logs, setLogs] = useState<string>('')
  const [selected, setSelected] = useState<number | null>(null)

  const load = () => {
    fetch('/api/projects').then(r => r.json()).then(setProjects).catch(() => {})
  }

  useEffect(() => { load() }, [])

  const viewLogs = async (id: number) => {
    setSelected(id)
    const res = await fetch(`/api/projects/${id}/logs`)
    const data = await res.json()
    setLogs(data.logs || '')
  }

  const stop = async (id: number) => {
    await fetch(`/api/projects/${id}/stop`, { method: 'POST' })
    load()
  }

  const remove = async (id: number) => {
    if (!confirm('Delete this project?')) return
    await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    load()
    setLogs('')
    setSelected(null)
  }

  const iconFor = (type: string) => {
    if (type === 'python') return Code
    if (type === 'website') return Globe
    return Server
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Projects</h2>
          <p className="text-muted-foreground">Deployments on your local PC</p>
        </div>
        <Link
          to="/deploy"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          New Project
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          {projects.length === 0 && (
            <div className="bg-card border rounded-lg p-8 text-center text-muted-foreground">
              No projects yet.
            </div>
          )}
          {projects.map((p) => {
            const Icon = iconFor(p.type)
            return (
              <div key={p.id} className="bg-card border rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-md bg-secondary flex items-center justify-center">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.type} · {p.ram_mb} MB</div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    p.status === 'running' ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground'
                  }`}>
                    {p.status}
                  </span>
                </div>
                <div className="flex gap-2 text-xs">
                  <button onClick={() => viewLogs(p.id)} className="px-2 py-1 bg-secondary rounded">Logs</button>
                  {p.status === 'running' && (
                    <button onClick={() => stop(p.id)} className="px-2 py-1 bg-secondary rounded">Stop</button>
                  )}
                  <button onClick={() => remove(p.id)} className="px-2 py-1 bg-red-500/10 text-red-600 rounded">Delete</button>
                </div>
              </div>
            )
          })}
        </div>

        <div className="bg-card border rounded-lg p-4">
          <h3 className="font-semibold mb-2">Logs {selected ? `#${selected}` : ''}</h3>
          <pre className="text-xs bg-background p-3 rounded overflow-auto max-h-96 whitespace-pre-wrap">
            {logs || 'Select a project to view logs'}
          </pre>
        </div>
      </div>
    </div>
  )
}
