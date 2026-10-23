import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Box,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Code2 as CodeIcon,
  Cpu,
  HardDrive,
  Globe2 as GlobeIcon,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  Terminal as TerminalIcon,
  Zap,
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

interface PlatformStatus {
  mode?: string
  docker?: { available?: boolean; running?: number }
  plan?: { name?: string; ram_mb?: number; storage_mb?: number; cpu_limit?: number; max_deployments?: number }
  usage?: { used_ram?: number; used_cpu?: number; used_storage?: number; deployments?: number }
  worker?: { name?: string; status?: string; total_ram_mb?: number; reserved_ram_mb?: number; total_cpu?: number; reserved_cpu?: number; total_storage_mb?: number; reserved_storage_mb?: number; last_seen?: string }
}

function formatTime(value?: string) {
  if (!value) return 'Time unavailable'
  const parsed = new Date(value.replace(' ', 'T') + (value.endsWith('Z') ? '' : 'Z'))
  if (Number.isNaN(parsed.getTime())) return 'Time unavailable'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(parsed)
}

function MetricCard({
  icon: Icon,
  label,
  value,
  unit,
  detail,
  percent,
  tone,
}: {
  icon: typeof Activity
  label: string
  value: string | number
  unit?: string
  detail: string
  percent?: number
  tone: string
}) {
  return (
    <article className="metric-card panel">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <span className={`metric-icon ${tone}`}><Icon className="h-4 w-4" strokeWidth={1.8} /></span>
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        </div>
        {percent !== undefined && <span className="font-mono text-[10px] text-muted-foreground">{Math.round(percent)}%</span>}
      </div>
      <div className="mt-5 flex items-baseline gap-1.5">
        <span className="text-[27px] font-semibold tracking-[-0.05em]">{value}</span>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
      {percent !== undefined ? (
        <>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div className={`h-full rounded-full transition-[width] duration-500 ${tone.replace('metric-icon-', 'meter-')}`} style={{ width: `${Math.min(100, percent)}%` }} />
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">{detail}</p>
        </>
      ) : <p className="mt-2 text-[10px] text-muted-foreground">{detail}</p>}
    </article>
  )
}

export default function Dashboard() {
  const [status, setStatus] = useState<PlatformStatus | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const loadDashboard = useCallback(async () => {
    try {
      const [statusResponse, projectsResponse] = await Promise.all([apiFetch('/api/status'), apiFetch('/api/projects')])
      if (!statusResponse.ok || !projectsResponse.ok) throw new Error('The control plane could not load dashboard data.')
      const [nextStatus, nextProjects] = await Promise.all([statusResponse.json(), projectsResponse.json()])
      setStatus(nextStatus)
      setProjects(Array.isArray(nextProjects) ? nextProjects : [])
      setError('')
      setLastUpdated(new Date())
    } catch {
      setError('Could not reach the local control plane. Check that the backend is running, then retry.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDashboard()
    const interval = window.setInterval(() => void loadDashboard(), 30_000)
    return () => window.clearInterval(interval)
  }, [loadDashboard])

  const plan = status?.plan ?? {}
  const usage = status?.usage ?? {}
  const worker = status?.worker
  const docker = status?.docker
  const runningProjects = projects.filter((project) => project.status === 'running')
  const ramLimit = Math.max(0, plan.ram_mb ?? 0)
  const storageLimit = Math.max(0, plan.storage_mb ?? 0)
  const ramUsed = Math.max(0, usage.used_ram ?? 0)
  const storageUsed = Math.max(0, usage.used_storage ?? 0)
  const ramPercent = ramLimit ? (ramUsed / ramLimit) * 100 : 0
  const storagePercent = storageLimit ? (storageUsed / storageLimit) * 100 : 0
  const recentProjects = [...projects]
    .sort((left, right) => new Date(right.created_at ?? 0).getTime() - new Date(left.created_at ?? 0).getTime())
    .slice(0, 5)

  return (
    <div className="page-content space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="eyebrow"><span className={`status-dot ${error ? 'status-dot-muted' : ''}`} />{error ? 'Connection issue' : status?.mode === 'render' ? 'Render control plane' : 'Local control plane'}</div>
          <h1 className="page-title mt-2">Overview</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Manage deployments and resource allocations for this machine.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && <span className="hidden text-[10px] text-muted-foreground sm:inline">Updated {lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>}
          <button type="button" onClick={() => void loadDashboard()} className="secondary-button" aria-label="Refresh dashboard">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <Link to="/deploy" className="primary-button"><Plus className="h-4 w-4" />New deployment</Link>
        </div>
      </div>

      {error && (
        <div role="alert" className="inline-alert inline-alert-error">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => void loadDashboard()} className="text-xs font-semibold underline underline-offset-4">Retry</button>
        </div>
      )}

      <section className="overview-banner panel relative overflow-hidden">
        <div className="banner-glow" />
        <div className="relative z-10 flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
          <div className="flex items-start gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-cyan-300">
              <Sparkles className="h-[18px] w-[18px]" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold">{plan.name || 'Free'} plan</h2>
                <span className="subtle-tag"><ShieldCheck className="h-3 w-3" />Local environment</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {runningProjects.length} running {runningProjects.length === 1 ? 'workload' : 'workloads'} across {projects.length} {projects.length === 1 ? 'project' : 'projects'}.
                {' '}{status?.mode === 'render' ? 'No worker is enrolled with this hosted control plane yet.' : 'Capacity and limits are enforced by the local backend.'}
              </p>
            </div>
          </div>
          <Link to="/billing" className="banner-link">
            View plan details <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      <section aria-label="Resource overview" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Activity}
          label="Running workloads"
          value={loading && !status ? '—' : runningProjects.length}
          detail={`${projects.length} total project${projects.length === 1 ? '' : 's'} · ${plan.max_deployments ?? '—'} max on plan`}
          tone="metric-icon-violet"
        />
        <MetricCard
          icon={Cpu}
          label="Reserved memory"
          value={loading && !status ? '—' : ramUsed}
          unit={ramLimit ? `/ ${ramLimit} MB` : 'MB'}
          detail="Allocated to running workloads"
          percent={status ? ramPercent : undefined}
          tone="metric-icon-blue"
        />
        <MetricCard
          icon={HardDrive}
          label="Reserved storage"
          value={loading && !status ? '—' : storageUsed}
          unit={storageLimit ? `/ ${storageLimit} MB` : 'MB'}
          detail="Quota reserved by running workloads"
          percent={status ? storagePercent : undefined}
          tone="metric-icon-amber"
        />
        <MetricCard
          icon={Zap}
          label="CPU entitlement"
          value={plan.cpu_limit ?? '—'}
          unit={plan.cpu_limit ? 'vCPU' : ''}
          detail={`${usage.used_cpu ?? 0} vCPU reserved · allocation limit`}
          tone="metric-icon-cyan"
        />
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.85fr)]">
        <section className="panel min-w-0">
          <div className="panel-heading">
            <div>
              <h2 className="section-title">Recent projects</h2>
              <p className="section-description">Latest workloads in this workspace</p>
            </div>
            <Link to="/projects" className="text-link">All projects <ArrowUpRight className="h-3 w-3" /></Link>
          </div>

          {loading && projects.length === 0 ? (
            <div className="space-y-3 p-5" aria-label="Loading projects">
              {[0, 1, 2].map((item) => <div key={item} className="skeleton h-[54px] rounded-lg" />)}
            </div>
          ) : recentProjects.length ? (
            <div className="divide-y divide-border/70">
              {recentProjects.map((project) => (
                <div key={project.id} className="project-row flex items-center gap-3 px-5 py-3.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary/70 text-muted-foreground">
                    <Box className="h-4 w-4" strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs font-semibold">{project.name}</span>
                      <span className={`status-pill ${project.status === 'running' ? 'status-pill-running' : 'status-pill-stopped'}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />{project.status}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[10px] capitalize text-muted-foreground">{project.type} <span className="px-1 text-muted-foreground/40">·</span> {project.ram_mb} MB reserved</p>
                  </div>
                  <span className="hidden shrink-0 items-center gap-1.5 text-[10px] text-muted-foreground md:flex">
                    <Clock3 className="h-3 w-3" />{formatTime(project.created_at)}
                  </span>
                  <Link to="/projects" aria-label={`View ${project.name}`} className="icon-button h-7 w-7 shrink-0">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state px-6 py-12 text-center">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-secondary/70 text-muted-foreground"><Box className="h-5 w-5" /></span>
              <p className="mt-3 text-xs font-semibold">{error ? 'Project data is unavailable' : 'No projects yet'}</p>
              <p className="mx-auto mt-1 max-w-[260px] text-[11px] leading-relaxed text-muted-foreground">
                {error ? 'Reconnect to the backend to see your workloads.' : 'Start by deploying a website, API, or container to this local worker.'}
              </p>
              {!error && <Link to="/deploy" className="primary-button mt-4"><Plus className="h-3.5 w-3.5" />Create a deployment</Link>}
            </div>
          )}
        </section>

        <div className="space-y-4">
          <section className="panel">
            <div className="panel-heading pb-3">
              <div>
                <h2 className="section-title">Worker status</h2>
                <p className="section-description">This machine only</p>
              </div>
              <Server className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-3 px-5 pb-5">
              <div className="worker-identity">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-400"><Server className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold">{worker?.name || 'Local worker'}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{worker?.status === 'healthy' ? 'Registered worker' : 'Worker status unavailable'}</p>
                </div>
                {worker?.status === 'healthy' && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
              </div>
              <div className="worker-detail">
                <span>Container runtime</span>
                <span className={docker?.available ? 'text-emerald-400' : 'text-muted-foreground'}>{docker?.available ? 'Docker connected' : 'Not connected'}</span>
              </div>
              <div className="worker-detail">
                <span>Containers running</span>
                <span className="font-mono text-foreground">{docker?.running ?? '—'}</span>
              </div>
              <div className="worker-detail">
                <span>Reserved worker RAM</span>
                <span className="font-mono text-foreground">{worker?.reserved_ram_mb ?? '—'}{worker ? ` / ${worker.total_ram_mb} MB` : ''}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Reserved worker CPU</span>
                <span className="text-sm font-medium">{worker?.reserved_cpu ?? '—'}{worker ? ` / ${worker.total_cpu} vCPU` : ''}</span>
              </div>
              <Link to="/servers" className="flex items-center justify-between border-t border-border/70 pt-3 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground">
                Worker details <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading pb-3">
              <div>
                <h2 className="section-title">Quick deploy</h2>
                <p className="section-description">Choose a starting point</p>
              </div>
              <Plus className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="grid grid-cols-2 gap-2 px-4 pb-4">
              {[
                { label: 'Website', type: 'website', icon: GlobeIcon },
                { label: 'Python app', type: 'python', icon: CodeIcon },
                { label: 'Node.js app', type: 'nodejs', icon: TerminalIcon },
                { label: 'Container', type: 'docker', icon: Box },
              ].map(({ label, type, icon: Icon }) => (
                <Link key={type} to={`/deploy?type=${type}`} className="quick-deploy-link">
                  <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.8} />
                  <span>{label}</span>
                  <ArrowDownRight className="ml-auto h-3 w-3 text-muted-foreground/50" />
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-border/70 pt-3 text-[10px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>Resource figures show reserved allocations from the control plane, not live utilization.</span>
        <span className="inline-flex items-center gap-1.5"><Activity className="h-3 w-3" />Network transfer metering is not available in this deployment.</span>
      </div>
    </div>
  )
}
