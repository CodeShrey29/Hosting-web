import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import {
  Activity,
  Box,
  ChevronRight,
  CircleAlert,
  Download,
  ExternalLink,
  File as FileIcon,
  FileText,
  Folder,
  FolderPlus,
  LoaderCircle,
  Plus,
  RefreshCw,
  RotateCw,
  Search,
  Save,
  Square,
  Play,
  Trash2,
  Upload,
  X,
} from 'lucide-react'

interface Project {
  id: number
  name: string
  type: string
  status: string
  ram_mb: number
  cpu_limit: number
  storage_mb: number
  host_port?: number | null
  created_at?: string
}

interface ProjectFile {
  name: string
  path: string
  type: 'file' | 'directory'
  size: number | null
  modified_at: string
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
  const [fileProject, setFileProject] = useState<Project | null>(null)
  const [filePath, setFilePath] = useState('')
  const [fileEntries, setFileEntries] = useState<ProjectFile[]>([])
  const [fileName, setFileName] = useState('')
  const [fileContent, setFileContent] = useState('')
  const [fileError, setFileError] = useState('')
  const [fileBusy, setFileBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const loadFiles = async (project: Project, path = '') => {
    setFileBusy(true)
    setFileError('')
    setFileName('')
    setFileContent('')
    try {
      const query = new URLSearchParams({ path })
      const response = await apiFetch(`/api/projects/${project.id}/files?${query}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load project files.')
      setFileProject(project)
      setFilePath(path)
      setFileEntries(data.entries)
    } catch (cause) {
      setFileError(cause instanceof Error ? cause.message : 'Could not load project files.')
    } finally {
      setFileBusy(false)
    }
  }

  const openFile = async (file: ProjectFile) => {
    if (!fileProject) return
    setFileBusy(true)
    setFileError('')
    try {
      const query = new URLSearchParams({ path: file.path })
      const response = await apiFetch(`/api/projects/${fileProject.id}/files/content?${query}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not open this file.')
      setFileName(file.path)
      setFileContent(data.content)
    } catch (cause) {
      setFileError(cause instanceof Error ? cause.message : 'Could not open this file.')
    } finally {
      setFileBusy(false)
    }
  }

  const saveFile = async () => {
    if (!fileProject || !fileName) return
    setFileBusy(true)
    setFileError('')
    try {
      const response = await apiFetch(`/api/projects/${fileProject.id}/files/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: fileName, content: fileContent }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not save this file.')
      await loadFiles(fileProject, filePath)
      setFileName('')
      setFileContent('')
    } catch (cause) {
      setFileError(cause instanceof Error ? cause.message : 'Could not save this file.')
      setFileBusy(false)
    }
  }

  const createFolder = async () => {
    if (!fileProject) return
    const folderName = window.prompt('New folder name')
    if (!folderName) return
    setFileBusy(true)
    setFileError('')
    try {
      const response = await apiFetch(`/api/projects/${fileProject.id}/files/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, name: folderName }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not create folder.')
      await loadFiles(fileProject, filePath)
    } catch (cause) {
      setFileError(cause instanceof Error ? cause.message : 'Could not create folder.')
      setFileBusy(false)
    }
  }

  const uploadFile = async (file?: File) => {
    if (!fileProject || !file) return
    setFileBusy(true)
    setFileError('')
    try {
      const form = new FormData()
      form.set('path', filePath)
      form.set('file', file)
      const response = await apiFetch(`/api/projects/${fileProject.id}/files/upload`, { method: 'POST', body: form })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not upload file.')
      await loadFiles(fileProject, filePath)
    } catch (cause) {
      setFileError(cause instanceof Error ? cause.message : 'Could not upload file.')
      setFileBusy(false)
    }
  }

  const deleteFile = async (file: ProjectFile) => {
    if (!fileProject || !window.confirm(`Delete "${file.name}"? This cannot be undone.`)) return
    setFileBusy(true)
    setFileError('')
    try {
      const query = new URLSearchParams({ path: file.path })
      const response = await apiFetch(`/api/projects/${fileProject.id}/files?${query}`, { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not delete this item.')
      await loadFiles(fileProject, filePath)
    } catch (cause) {
      setFileError(cause instanceof Error ? cause.message : 'Could not delete this item.')
      setFileBusy(false)
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

  const restart = async (project: Project) => {
    setBusy(project.id)
    setError('')
    try {
      const response = await apiFetch(`/api/projects/${project.id}/restart`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not restart this project.')
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Project restart failed.')
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
                  {project.status === 'running' && project.host_port && <a className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline" href={`http://127.0.0.1:${project.host_port}`} target="_blank" rel="noreferrer">Open local app <ExternalLink className="h-3 w-3" /></a>}
                </div>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => void loadFiles(project)} className="secondary-button compact-button"><Folder className="h-3.5 w-3.5" />Files</button>
                  <button type="button" onClick={() => void viewLogs(project)} className="secondary-button compact-button"><FileText className="h-3.5 w-3.5" />Logs</button>
                  <button type="button" onClick={() => void changeStatus(project)} disabled={busy === project.id} className="secondary-button compact-button">
                    {busy === project.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : project.status === 'running' ? <Square className="h-3 w-3" /> : <Play className="h-3.5 w-3.5" />}
                    {project.status === 'running' ? 'Stop' : 'Start'}
                  </button>
                  {project.status === 'running' && <button type="button" onClick={() => void restart(project)} disabled={busy === project.id} className="icon-button h-8 w-8" aria-label={`Restart ${project.name}`} title="Restart"><RotateCw className={`h-3.5 w-3.5 ${busy === project.id ? 'animate-spin' : ''}`} /></button>}
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

      {fileProject && (
        <section className="panel overflow-hidden">
          <div className="panel-heading border-b border-border/80">
            <div className="flex min-w-0 items-center gap-2">
              <Folder className="h-4 w-4 shrink-0 text-cyan-400" />
              <div className="min-w-0"><h2 className="section-title">Project files</h2><p className="section-description truncate">{fileProject.name} · /data/{filePath}</p></div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {!fileName && <button type="button" onClick={() => void createFolder()} disabled={fileBusy} className="icon-button" aria-label="Create folder" title="Create folder"><FolderPlus className="h-4 w-4" /></button>}
              {!fileName && <button type="button" onClick={() => fileInputRef.current?.click()} disabled={fileBusy} className="icon-button" aria-label="Upload file" title="Upload file"><Upload className="h-4 w-4" /></button>}
              <input ref={fileInputRef} type="file" className="hidden" onChange={(event) => { void uploadFile(event.target.files?.[0]); event.target.value = '' }} />
              {fileName && <a href={`/api/projects/${fileProject.id}/files/download?${new URLSearchParams({ path: fileName })}`} className="icon-button" aria-label="Download file" title="Download file"><Download className="h-4 w-4" /></a>}
              {fileName && <button type="button" onClick={() => { setFileName(''); setFileContent('') }} className="icon-button" aria-label="Close editor"><X className="h-4 w-4" /></button>}
              {!fileName && <button type="button" onClick={() => setFileProject(null)} className="icon-button" aria-label="Close file manager"><X className="h-4 w-4" /></button>}
            </div>
          </div>
          {fileError && <div role="alert" className="inline-alert inline-alert-error m-4"><CircleAlert className="h-4 w-4 shrink-0" /><span>{fileError}</span></div>}
          {fileName ? (
            <div className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <code className="text-[11px] text-muted-foreground">{fileName}</code>
                <button type="button" onClick={() => void saveFile()} disabled={fileBusy} className="primary-button compact-button"><Save className="h-3.5 w-3.5" />Save changes</button>
              </div>
              <textarea value={fileContent} onChange={(event) => setFileContent(event.target.value)} spellCheck={false} aria-label={`Edit ${fileName}`} className="input-field min-h-[280px] w-full resize-y items-start py-3 font-mono text-[11px] leading-relaxed" />
              <p className="text-[10px] text-muted-foreground">Text files up to 1 MB can be edited here. Changes are written to the project volume immediately.</p>
            </div>
          ) : (
            <>
              {filePath && <button type="button" onClick={() => void loadFiles(fileProject, filePath.split('/').slice(0, -1).join('/'))} className="flex w-full items-center gap-2 border-b border-border/70 px-4 py-3 text-left text-[11px] text-muted-foreground hover:bg-accent/40"><ChevronRight className="h-3.5 w-3.5 rotate-180" />Parent folder</button>}
              {fileBusy && <div className="flex items-center gap-2 p-4 text-[11px] text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" />Working with project files…</div>}
              {!fileBusy && fileEntries.length === 0 && <p className="p-6 text-center text-[11px] text-muted-foreground">This project folder is empty.</p>}
              {!fileBusy && fileEntries.length > 0 && <div className="divide-y divide-border/70">{fileEntries.map((file) => (
                <div key={file.path} className="flex items-center gap-2 px-4 py-2.5">
                  <button type="button" onClick={() => file.type === 'directory' ? void loadFiles(fileProject, file.path) : void openFile(file)} className="flex min-w-0 flex-1 items-center gap-2 text-left text-[11px] hover:text-primary">
                    {file.type === 'directory' ? <Folder className="h-4 w-4 shrink-0 text-cyan-400" /> : <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    <span className="truncate">{file.name}</span>
                    <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{file.type === 'file' ? `${((file.size || 0) / 1024).toFixed(1)} KB` : 'Folder'}</span>
                  </button>
                  {file.type === 'file' && <a href={`/api/projects/${fileProject.id}/files/download?${new URLSearchParams({ path: file.path })}`} className="icon-button h-8 w-8" aria-label={`Download ${file.name}`}><Download className="h-3.5 w-3.5" /></a>}
                  <button type="button" onClick={() => void deleteFile(file)} disabled={fileBusy} className="icon-button h-8 w-8 text-muted-foreground hover:text-red-400" aria-label={`Delete ${file.name}`}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}</div>}
            </>
          )}
        </section>
      )}
    </div>
  )
}
