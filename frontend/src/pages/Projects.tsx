import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import {
  Activity,
  Box,
  CircleAlert,
  ExternalLink,
  FileText,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Square,
  Play,
  Trash2,
} from 'lucide-react'

interface Project {
  id: number
  name: string
  type: string
  status: string
  ram_mb: number
  cpu_limit: number
  storage_mb: number
  created_at?: string
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [logs, setLogs] = useState('')
  const [selected, setSelected] = useState<number | null>(null)
  const [filter, setFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<number | null>(null)

  const load = useCallback(async () => {
    try {
      const response = await apiFetch('/api/projects')
      if (!response.ok) throw new Error('Unable to load projects.')
      const data = await response.json()
      if (!Array.isArray(data)) throw new Error('The API returned an invalid project list.')
      setProjects(data)
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to connect to the local API.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const viewLogs = async (project: Project) => {
    setSelected(project.id)
    setLogs('')
    try {
      const response = await apiFetch(`/api/projects/${project.id}/logs`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not retrieve logs.')
      setLogs(data.logs || 'No logs have been recorded.')
    } catch (cause) {
      setLogs(cause instanceof Error ? cause.message : 'Could not retrieve logs.')
    }
  }

  const changeStatus = async (project: Project) => {
    setBusy(project.id)
    setError('')
    try {
      const action = project.status === 'running' ? 'stop' : 'start'
      const response = await apiFetch(`/api/projects/${project.id}/${action}`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || `Could not ${action} this project.`)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Project action failed.')
    } finally {
      setBusy(null)
    }
  }

  const remove = async (project: Project) => {
    if (!window.confirm(`Delete "${project.name}" and its project data? This cannot be undone.`)) return
    setBusy(project.id)
    setError('')
    try {
      const response = await apiFetch(`/api/projects/${project.id}`, { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not delete this project.')
      if (selected === project.id) { setLogs(''); setSelected(null) }
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Project deletion failed.')
    } finally {
      setBusy(null)
    }
  }

  const visibleProjects = projects.filter((project) => {
    const matchesSearch = `${project.name} ${project.type}`.toLowerCase().includes(filter.toLowerCase())
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="page-content space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="eyebrow"><span className="status-dot" />Workloads</div>
          <h1 className="page-title mt-2">Projects</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">Applications and containers running on your local worker.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void load()} className="secondary-button" aria-label="Refresh projects"><RefreshCw className="h-3.5 w-3.5" />Refresh</button>
          <Link to="/deploy" className="primary-button"><Plus className="h-4 w-4" />New project</Link>
        </div>
      </div>

      {error && <div role="alert" className="inline-alert inline-alert-error"><CircleAlert className="h-4 w-4 shrink-0" /><span>{error}</span></div>}

      <section className="panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{projects.length}</span> total
            <span className="text-border">/</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{projects.filter((project) => project.status === 'running').length} running</span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="search-field">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter projects..." aria-label="Filter projects" />
            </label>
            <select className="select-field" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by status">
              <option value="all">All statuses</option>
              <option value="running">Running</option>
              <option value="stopped">Stopped</option>
            </select>
          </div>
        </div>

        {loading && projects.length === 0 ? (
          <div className="space-y-3 p-5">{[0, 1, 2].map((item) => <div key={item} className="skeleton h-14 rounded-lg" />)}</div>
        ) : visibleProjects.length ? (
          <div className="divide-y divide-border/70">
            {visibleProjects.map((project) => (
              <article key={project.id} className="project-row flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
                <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary/60 text-muted-foreground sm:flex"><Box className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-xs font-semibold">{project.name}</h2>
                    <span className={`status-pill ${project.status === 'running' ? 'status-pill-running' : 'status-pill-stopped'}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{project.status}</span>
                  </div>
                  <p className="mt-1 text-[10px] capitalize text-muted-foreground">{project.type} <span className="px-1 text-border">·</span> {project.ram_mb} MB RAM <span className="px-1 text-border">·</span> {project.cpu_limit} vCPU <span className="px-1 text-border">·</span> {project.storage_mb} MB storage reserved</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => void viewLogs(project)} className="secondary-button compact-button"><FileText className="h-3.5 w-3.5" />Logs</button>
                  <button type="button" onClick={() => void changeStatus(project)} disabled={busy === project.id} className="secondary-button compact-button">
                    {busy === project.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : project.status === 'running' ? <Square className="h-3 w-3" /> : <Play className="h-3.5 w-3.5" />}
                    {project.status === 'running' ? 'Stop' : 'Start'}
                  </button>
                  <button type="button" onClick={() => void remove(project)} disabled={busy === project.id} aria-label={`Delete ${project.name}`} className="icon-button h-8 w-8 text-muted-foreground hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state px-6 py-14 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-secondary/60 text-muted-foreground"><Box className="h-5 w-5" /></span>
            <p className="mt-3 text-xs font-semibold">{projects.length ? 'No matching projects' : loading ? 'Loading projects…' : 'No projects yet'}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{projects.length ? 'Try another search or status filter.' : 'Deploy an application to start managing workloads here.'}</p>
            {!projects.length && !loading && <Link to="/deploy" className="primary-button mt-4"><Plus className="h-3.5 w-3.5" />Create project</Link>}
          </div>
        )}
      </section>

      {selected !== null && (
        <section className="panel overflow-hidden">
          <div className="panel-heading">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-cyan-400" />
              <div><h2 className="section-title">Container logs</h2><p className="section-description">Project #{selected} · latest output</p></div>
            </div>
            <a href={`/api/projects/${selected}/logs`} target="_blank" rel="noreferrer" className="icon-button h-8 w-8" aria-label="Open logs endpoint"><ExternalLink className="h-3.5 w-3.5" /></a>
          </div>
          <pre className="log-output max-h-80 overflow-auto p-4 text-[11px] leading-relaxed sm:p-5">{logs || 'Loading logs…'}</pre>
        </section>
      )}
    </div>
  )
}
