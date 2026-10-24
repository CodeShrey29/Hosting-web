import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  Activity,
  ArrowUpRight,
  Boxes,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Cloud,
  Cpu,
  HardDrive,
  LayoutDashboard,
  LogOut,
  Pause,
  Play,
  RotateCw,
  Search,
  Server,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react'
import { apiFetch } from '../lib/api'

type Section = 'overview' | 'customers' | 'workloads' | 'infrastructure'

interface AdminUser {
  id: number
  email: string
  name: string
  status: 'active' | 'suspended'
  created_at: string
  plan: string | null
  plan_id: number
  project_count: number
}

interface Project {
  id: number
  name: string
  type: string
  status: string
  ram_mb: number
  cpu_limit: number
  storage_mb: number
  created_at: string
  owner: string | null
}

interface Overview {
  customers: { total: number; active: number; suspended: number }
  projects: { total: number; running: number }
  worker: {
    name?: string
    status?: string
    total_ram_mb?: number
    reserved_ram_mb?: number
    total_cpu?: number
    reserved_cpu?: number
    total_storage_mb?: number
    reserved_storage_mb?: number
  } | null
  docker: { available?: boolean; running?: number; error?: string }
  mode: string
  storage: string
  plans: Array<{ id: number; name: string; ram_mb: number; storage_mb: number; cpu_limit: number; max_deployments: number }>
}

interface PageResult<T> {
  users?: T[]
  projects?: T[]
  error?: string
  page: number
  total_pages: number
  total_users?: number
  active_users?: number
  total_projects?: number
  running_projects?: number
}

const sections: Array<{ key: Section; label: string; icon: typeof LayoutDashboard }> = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'customers', label: 'Customers', icon: Users },
  { key: 'workloads', label: 'Workloads', icon: Boxes },
  { key: 'infrastructure', label: 'Infrastructure', icon: Server },
]

function dateLabel(value?: string) {
  if (!value) return '—'
  const date = new Date(value.replace(' ', 'T') + (value.endsWith('Z') ? '' : 'Z'))
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatAmount(value?: number, unit = 'MB') {
  return value == null ? '—' : `${Number(value.toFixed(1))} ${unit}`
}

export default function AdminUsers({ email, onLogout }: { email?: string; onLogout: () => void }) {
  const [section, setSection] = useState<Section>('overview')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [userPage, setUserPage] = useState(1)
  const [projectPage, setProjectPage] = useState(1)
  const [userPages, setUserPages] = useState(1)
  const [projectPages, setProjectPages] = useState(1)
  const [query, setQuery] = useState('')
  const [userQuery, setUserQuery] = useState('')
  const [projectQuery, setProjectQuery] = useState('')
  const [planSelections, setPlanSelections] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)
  const [busyUser, setBusyUser] = useState<number | null>(null)
  const [busyProject, setBusyProject] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadOverview = useCallback(async () => {
    const response = await apiFetch('/api/admin/overview')
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Could not load platform overview.')
    setOverview(result as Overview)
  }, [])

  const loadUsers = useCallback(async (page = userPage, search = userQuery) => {
    const params = new URLSearchParams({ page: String(page) })
    if (search) params.set('q', search)
    const response = await apiFetch(`/api/admin/users?${params}`)
    const result = await response.json() as PageResult<AdminUser>
    if (!response.ok) throw new Error(result.error || 'Could not load customer accounts.')
    setUsers(result.users || [])
    setUserPage(result.page)
    setUserPages(result.total_pages)
  }, [userPage, userQuery])

  const loadProjects = useCallback(async (page = projectPage, search = projectQuery) => {
    const params = new URLSearchParams({ page: String(page) })
    if (search) params.set('q', search)
    const response = await apiFetch(`/api/admin/projects?${params}`)
    const result = await response.json() as PageResult<Project>
    if (!response.ok) throw new Error(result.error || 'Could not load workloads.')
    setProjects(result.projects || [])
    setProjectPage(result.page)
    setProjectPages(result.total_pages)
  }, [projectPage, projectQuery])

  const loadSection = useCallback(async (selected: Section = section) => {
    setLoading(true)
    setError('')
    try {
      if (selected === 'overview' || selected === 'infrastructure') await loadOverview()
      if (selected === 'overview' || selected === 'customers') await loadUsers(1, selected === 'customers' ? userQuery : '')
      if (selected === 'workloads') await loadProjects(1, projectQuery)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load administrator data.')
    } finally {
      setLoading(false)
    }
  }, [loadOverview, loadProjects, loadUsers, projectQuery, section, userQuery])

  useEffect(() => { void loadSection('overview') }, [])

  const changeSection = (next: Section) => {
    setSection(next)
    setQuery('')
    setNotice('')
    void loadSection(next)
  }

  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (section === 'customers') {
      setUserQuery(query.trim())
      void loadUsers(1, query.trim()).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not search accounts.'))
    } else if (section === 'workloads') {
      setProjectQuery(query.trim())
      void loadProjects(1, query.trim()).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not search workloads.'))
    }
  }

  const updateUser = async (user: AdminUser, changes: { status?: 'active' | 'suspended'; plan_id?: number }) => {
    setBusyUser(user.id)
    setError('')
    setNotice('')
    try {
      const response = await apiFetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not update account.')
      setNotice(changes.status ? `Account ${changes.status === 'active' ? 'reactivated' : 'suspended'}.` : 'Plan assignment updated.')
      await Promise.all([loadUsers(userPage, userQuery), loadOverview()])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update account.')
    } finally {
      setBusyUser(null)
    }
  }

  const runProjectAction = async (project: Project, action: 'start' | 'stop' | 'restart') => {
    setBusyProject(project.id)
    setError('')
    setNotice('')
    try {
      const response = await apiFetch(`/api/admin/projects/${project.id}/${action}`, { method: 'POST' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || `Could not ${action} workload.`)
      setNotice(`Workload ${project.name} ${action === 'start' ? 'started' : action === 'stop' ? 'stopped' : 'restarted'}.`)
      await Promise.all([loadProjects(projectPage, projectQuery), loadOverview()])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update workload.')
    } finally {
      setBusyProject(null)
    }
  }

  const deleteProject = async (project: Project) => {
    if (!window.confirm(`Permanently delete "${project.name}" and its managed project files? This cannot be undone.`)) return
    setBusyProject(project.id)
    setError('')
    setNotice('')
    try {
      const response = await apiFetch(`/api/admin/projects/${project.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not delete workload.')
      setNotice(`Workload ${project.name} and its project files were deleted.`)
      await Promise.all([loadProjects(projectPage, projectQuery), loadOverview()])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete workload.')
    } finally {
      setBusyProject(null)
    }
  }

  const refresh = () => void loadSection(section)

  return (
    <main className="admin-console">
      <aside className="admin-rail">
        <div className="admin-brand">
          <span className="admin-brand-mark"><Cloud size={18} strokeWidth={2.2} /></span>
          <span><strong>Cloud Host</strong><small>Operations</small></span>
        </div>
        <div className="admin-rail-caption">CONTROL ROOM</div>
        <nav className="admin-nav" aria-label="Administration">
          {sections.map(({ key, label, icon: Icon }) => (
            <button key={key} type="button" onClick={() => changeSection(key)} className={`admin-nav-item ${section === key ? 'is-active' : ''}`}>
              <Icon size={16} strokeWidth={1.8} /><span>{label}</span>
              {section === key && <span className="admin-nav-indicator" />}
            </button>
          ))}
        </nav>
        <div className="admin-rail-bottom">
          <span className={`admin-health-dot ${overview?.docker.available ? 'is-up' : ''}`} />
          <span><strong>{overview?.docker.available ? 'Runtime connected' : 'Runtime unavailable'}</strong><small>{overview?.mode === 'render' ? 'Hosted control plane' : 'Local control plane'}</small></span>
        </div>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar">
          <div className="admin-breadcrumb"><span>Operations</span><span className="admin-slash">/</span><strong>{sections.find((item) => item.key === section)?.label}</strong></div>
          <div className="admin-top-actions">
            <span className="admin-account"><span className="admin-account-avatar">{(email || 'AD').slice(0, 2).toUpperCase()}</span><span>{email || 'Administrator'}</span></span>
            <button type="button" onClick={onLogout} className="admin-signout"><LogOut size={14} />Sign out</button>
          </div>
        </header>

        <div className="admin-content">
          <div className="admin-page-heading">
            <div>
              <p className="admin-eyebrow">CLOUD HOST <span>·</span> ADMINISTRATION</p>
              <h1>{section === 'overview' ? 'Platform overview' : sections.find((item) => item.key === section)?.label}</h1>
              <p className="admin-heading-subtitle">{section === 'overview' ? 'A clear view of accounts, workloads, and infrastructure.' : section === 'customers' ? 'Manage account access and assign tiers. Suspending blocks sign-in; running workloads remain active.' : section === 'workloads' ? 'Monitor, operate, and remove customer projects from one place.' : 'Live configuration and capacity reported by this control plane.'}</p>
            </div>
            <button type="button" className="admin-refresh" onClick={refresh} disabled={loading}><Activity size={14} className={loading ? 'admin-spin' : ''} />Refresh data</button>
          </div>

          {error && <div className="admin-alert admin-alert-error" role="alert"><CircleAlert size={16} /><span>{error}</span></div>}
          {notice && <div className="admin-alert admin-alert-success" role="status"><Check size={16} /><span>{notice}</span></div>}

          {(section === 'overview' || section === 'customers') && (
            <div className="admin-stat-grid">
              <StatCard label="Customer accounts" value={overview?.customers.total} detail={`${overview?.customers.active ?? 0} active`} icon={Users} />
              <StatCard label="Active workloads" value={overview?.projects.running} detail={`${overview?.projects.total ?? 0} total projects`} icon={Boxes} />
              <StatCard label="Worker memory" value={overview?.worker ? formatAmount(overview.worker.reserved_ram_mb) : '—'} detail={`of ${formatAmount(overview?.worker?.total_ram_mb)} reserved`} icon={Cpu} />
              <StatCard label="Storage allocation" value={overview?.worker ? formatAmount(overview.worker.reserved_storage_mb) : '—'} detail={`of ${formatAmount(overview?.worker?.total_storage_mb)} reserved`} icon={HardDrive} />
            </div>
          )}

          {section === 'overview' && (
            <div className="admin-overview-grid">
              <section className="admin-card">
                <div className="admin-card-heading"><div><h2>Recent customers</h2><p>Latest registered accounts</p></div><button type="button" className="admin-inline-link" onClick={() => changeSection('customers')}>All customers <ArrowUpRight size={13} /></button></div>
                <UserTable users={users.slice(0, 6)} plans={overview?.plans || []} busyUser={busyUser} planSelections={planSelections} onPlanChange={(id, planId) => setPlanSelections((previous) => ({ ...previous, [id]: planId }))} onStatusChange={(user) => void updateUser(user, { status: user.status === 'active' ? 'suspended' : 'active' })} onPlanSave={(user) => void updateUser(user, { plan_id: planSelections[user.id] ?? user.plan_id })} compact />
                {!users.length && <EmptyState loading={loading} label="No customer accounts yet." />}
              </section>
              <section className="admin-card admin-health-card">
                <div className="admin-card-heading"><div><h2>System status</h2><p>Current control-plane signals</p></div><ShieldCheck size={17} className="admin-muted-icon" /></div>
                <HealthLine label="Control plane" value="Operational" good />
                <HealthLine label="Database" value="Connected" good />
                <HealthLine label="Container runtime" value={overview?.docker.available ? 'Connected' : 'Unavailable'} good={Boolean(overview?.docker.available)} />
                <HealthLine label="Storage" value={overview?.storage || 'Checking'} good={overview?.storage === 'persistent'} />
                <div className="admin-health-note">{overview?.storage === 'ephemeral' ? 'Data may not persist across service restarts.' : 'Status reflects configured capacity, not a live customer SLA.'}</div>
              </section>
            </div>
          )}

          {section === 'customers' && (
            <section className="admin-card admin-table-card">
              <div className="admin-card-heading">
                <div><h2>Customer directory</h2><p>Manage account access and manually assign plans. No payments are processed here.</p></div>
                <form className="admin-search" onSubmit={search}><Search size={15} /><input aria-label="Search customers" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search email or name" /><button type="submit">Search</button></form>
              </div>
              <UserTable users={users} plans={overview?.plans || []} busyUser={busyUser} planSelections={planSelections} onPlanChange={(id, planId) => setPlanSelections((previous) => ({ ...previous, [id]: planId }))} onStatusChange={(user) => void updateUser(user, { status: user.status === 'active' ? 'suspended' : 'active' })} onPlanSave={(user) => void updateUser(user, { plan_id: planSelections[user.id] ?? user.plan_id })} />
              {!users.length && <EmptyState loading={loading} label={userQuery ? 'No customers match this search.' : 'No customer accounts yet.'} />}
              <Pagination page={userPage} pages={userPages} onChange={(page) => void loadUsers(page).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not load customers.'))} />
            </section>
          )}

          {section === 'workloads' && (
            <section className="admin-card admin-table-card">
              <div className="admin-card-heading">
                <div><h2>All workloads</h2><p>Manage customer workloads without entering their private workspaces.</p></div>
                <form className="admin-search" onSubmit={search}><Search size={15} /><input aria-label="Search workloads" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search project or owner" /><button type="submit">Search</button></form>
              </div>
              <ProjectTable projects={projects} busyProject={busyProject} onAction={runProjectAction} onDelete={deleteProject} />
              {!projects.length && <EmptyState loading={loading} label={projectQuery ? 'No workloads match this search.' : 'No workloads have been created.'} />}
              <Pagination page={projectPage} pages={projectPages} onChange={(page) => void loadProjects(page).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not load workloads.'))} />
            </section>
          )}

          {section === 'infrastructure' && (
            <div className="admin-infrastructure-grid">
              <section className="admin-card">
                <div className="admin-card-heading"><div><h2>Worker capacity</h2><p>{overview?.worker?.name || 'No worker enrolled'}</p></div><Server size={17} className="admin-muted-icon" /></div>
                <CapacityRow label="Memory" used={overview?.worker?.reserved_ram_mb} total={overview?.worker?.total_ram_mb} unit="MB" />
                <CapacityRow label="CPU" used={overview?.worker?.reserved_cpu} total={overview?.worker?.total_cpu} unit="vCPU" />
                <CapacityRow label="Storage" used={overview?.worker?.reserved_storage_mb} total={overview?.worker?.total_storage_mb} unit="MB" />
                <HealthLine label="Worker status" value={overview?.worker?.status || 'Not enrolled'} good={overview?.worker?.status === 'healthy'} />
              </section>
              <section className="admin-card">
                <div className="admin-card-heading"><div><h2>Runtime & storage</h2><p>Service configuration</p></div><Activity size={17} className="admin-muted-icon" /></div>
                <HealthLine label="Container runtime" value={overview?.docker.available ? `${overview.docker.running ?? 0} containers` : overview?.docker.error || 'Not connected'} good={Boolean(overview?.docker.available)} />
                <HealthLine label="Deployment mode" value={overview?.mode === 'render' ? 'Hosted control plane' : 'Local PC'} />
                <HealthLine label="Storage persistence" value={overview?.storage || 'Unknown'} good={overview?.storage === 'persistent'} />
                <p className="admin-health-note">This console reports the backend’s configured worker and storage state. It does not represent an external monitoring service.</p>
              </section>
              <section className="admin-card admin-plans-card">
                <div className="admin-card-heading"><div><h2>Available account tiers</h2><p>Manual assignment only. No checkout or payment actions.</p></div></div>
                <div className="admin-plan-list">{overview?.plans.map((plan) => (
                  <div className="admin-plan-row" key={plan.id}><span><strong>{plan.name}</strong><small>{plan.max_deployments} deployments · {plan.cpu_limit} vCPU</small></span><span>{plan.ram_mb} MB RAM · {plan.storage_mb} MB storage</span></div>
                ))}</div>
              </section>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

function StatCard({ label, value, detail, icon: Icon }: { label: string; value?: string | number | null; detail: string; icon: typeof Users }) {
  return <article className="admin-stat-card"><span className="admin-stat-icon"><Icon size={17} strokeWidth={1.8} /></span><span className="admin-stat-label">{label}</span><strong>{value ?? '—'}</strong><small>{detail}</small></article>
}

function UserTable({ users, plans, busyUser, planSelections, onPlanChange, onStatusChange, onPlanSave, compact = false }: {
  users: AdminUser[]
  plans: Overview['plans']
  busyUser: number | null
  planSelections: Record<number, number>
  onPlanChange: (id: number, planId: number) => void
  onStatusChange: (user: AdminUser) => void
  onPlanSave: (user: AdminUser) => void
  compact?: boolean
}) {
  return (
    <div className="admin-table-wrap">
      <table className={`admin-table ${compact ? 'is-compact' : ''}`}>
        <thead><tr><th>Customer</th><th>Account</th><th>Projects</th><th>Plan</th><th>Joined</th><th className="admin-actions-heading">Actions</th></tr></thead>
        <tbody>{users.map((user) => (
          <tr key={user.id}>
            <td><span className="admin-user-cell"><span className="admin-user-avatar">{user.email.slice(0, 1).toUpperCase()}</span><span><strong>{user.name || user.email.split('@')[0]}</strong><small>{user.email}</small></span></span></td>
            <td><span className={`admin-status ${user.status}`}><i />{user.status}</span></td>
            <td>{user.project_count}</td>
            <td>
              <span className="admin-plan-cell">
                <select aria-label={`Plan for ${user.email}`} value={planSelections[user.id] ?? user.plan_id} disabled={busyUser === user.id} onChange={(event) => onPlanChange(user.id, Number(event.target.value))}>
                  {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
                </select>
                {(planSelections[user.id] ?? user.plan_id) !== user.plan_id && <button type="button" className="admin-save-plan" disabled={busyUser === user.id} onClick={() => onPlanSave(user)}>Save</button>}
              </span>
            </td>
            <td>{dateLabel(user.created_at)}</td>
            <td className="admin-actions-cell"><button type="button" className={`admin-action-button ${user.status === 'active' ? 'danger' : 'positive'}`} disabled={busyUser === user.id} onClick={() => onStatusChange(user)}>{busyUser === user.id ? 'Saving…' : user.status === 'active' ? 'Suspend' : 'Reactivate'}</button></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  )
}

function ProjectTable({ projects, busyProject, onAction, onDelete }: {
  projects: Project[]
  busyProject: number | null
  onAction: (project: Project, action: 'start' | 'stop' | 'restart') => void
  onDelete: (project: Project) => void
}) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table admin-project-table">
        <thead><tr><th>Project</th><th>Owner</th><th>Type</th><th>Status</th><th>Resources</th><th>Created</th><th className="admin-actions-heading">Actions</th></tr></thead>
        <tbody>{projects.map((project) => (
          <tr key={project.id}>
            <td><span className="admin-project-name"><span className="admin-project-icon"><Boxes size={14} /></span><strong>{project.name}</strong></span></td>
            <td>{project.owner || 'Local account'}</td><td className="capitalize">{project.type}</td>
            <td><span className={`admin-status ${project.status === 'running' ? 'active' : 'suspended'}`}><i />{project.status}</span></td>
            <td>{project.ram_mb} MB · {project.cpu_limit} CPU · {project.storage_mb} MB</td>
            <td>{dateLabel(project.created_at)}</td>
            <td className="admin-project-actions">
              <button type="button" title={project.status === 'running' ? 'Stop workload' : 'Start workload'} aria-label={`${project.status === 'running' ? 'Stop' : 'Start'} ${project.name}`} disabled={busyProject === project.id} onClick={() => onAction(project, project.status === 'running' ? 'stop' : 'start')}>{project.status === 'running' ? <Pause size={12} /> : <Play size={12} />}</button>
              <button type="button" title="Restart workload" aria-label={`Restart ${project.name}`} disabled={busyProject === project.id || project.status !== 'running'} onClick={() => onAction(project, 'restart')}><RotateCw size={12} /></button>
              <button type="button" title="Delete workload and files" aria-label={`Delete ${project.name}`} className="delete" disabled={busyProject === project.id} onClick={() => onDelete(project)}><Trash2 size={12} /></button>
            </td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  )
}

function HealthLine({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return <div className="admin-health-line"><span>{label}</span><strong><i className={good ? 'good' : ''} />{value}</strong></div>
}

function CapacityRow({ label, used, total, unit }: { label: string; used?: number; total?: number; unit: string }) {
  const percent = total && used != null ? Math.min(100, Math.round((used / total) * 100)) : 0
  return <div className="admin-capacity-row"><div><span>{label}</span><strong>{formatAmount(used, unit)} <small>/ {formatAmount(total, unit)}</small></strong></div><div className="admin-capacity-track"><i style={{ width: `${percent}%` }} /></div></div>
}

function EmptyState({ loading, label }: { loading: boolean; label: string }) {
  return <div className="admin-empty"><Users size={18} /><span>{loading ? 'Loading records…' : label}</span></div>
}

function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (page: number) => void }) {
  return <div className="admin-pagination"><span>Page {page} of {pages}</span><div><button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft size={15} /></button><button type="button" aria-label="Next page" disabled={page >= pages} onClick={() => onChange(page + 1)}><ChevronRight size={15} /></button></div></div>
}
