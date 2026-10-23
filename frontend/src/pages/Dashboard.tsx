import { useEffect, useState } from 'react'
import {
  Activity,
  HardDrive,
  Cpu,
  Box,
  Plus,
  ArrowUpRight,
  Server,
  Zap,
  TrendingUp,
  ChevronRight,
} from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Dashboard() {
  const [status, setStatus] = useState<any>(null)
  const [projects, setProjects] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/status').then(r => r.json()).then(setStatus).catch(() => {})
    fetch('/api/projects').then(r => r.json()).then(setProjects).catch(() => {})
  }, [])

  const docker = status?.docker || {}
  const plan = status?.plan || {}
  const usage = status?.usage || {}
  const worker = status?.worker || {}

  const ramPercent = Math.min(100, ((usage.used_ram || 0) / (plan.ram_mb || 512)) * 100)
  const storagePercent = Math.min(100, ((usage.used_storage || 0) / (plan.storage_mb || 1024)) * 100)

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Welcome */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            System operational
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Good evening</h1>
          <p className="text-muted-foreground mt-1">
            {plan.name || 'Free'} plan · {usage.deployments || 0} active deployments
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/projects"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium hover:bg-accent transition-colors"
          >
            View projects
          </Link>
          <Link
            to="/deploy"
            className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Deploy
          </Link>
        </div>
      </div>

      {/* Primary metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* RAM */}
        <div className="bg-card border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Activity className="h-4 w-4 text-blue-500" />
              </div>
              <span className="text-sm font-medium">Memory</span>
            </div>
            <span className="text-xs text-muted-foreground">{Math.round(ramPercent)}%</span>
          </div>
          <div className="text-3xl font-semibold tracking-tight">
            {usage.used_ram || 0}
            <span className="text-lg text-muted-foreground font-normal ml-1">MB</span>
          </div>
          <div className="mt-4 h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${ramPercent}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">of {plan.ram_mb || 512} MB plan limit</p>
        </div>

        {/* Deployments */}
        <div className="bg-card border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <Box className="h-4 w-4 text-violet-500" />
            </div>
            <span className="text-sm font-medium">Deployments</span>
          </div>
          <div className="text-3xl font-semibold tracking-tight">{usage.deployments || 0}</div>
          <div className="mt-4 flex items-center gap-2">
            <div className="flex -space-x-1">
              {[...Array(Math.min(3, usage.deployments || 0))].map((_, i) => (
                <div key={i} className="h-5 w-5 rounded-full bg-violet-500/20 border-2 border-card" />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">of {plan.max_deployments || 3} allowed</span>
          </div>
        </div>

        {/* Docker */}
        <div className="bg-card border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
              docker.available ? 'bg-green-500/10' : 'bg-red-500/10'
            }`}>
              <Cpu className={`h-4 w-4 ${docker.available ? 'text-green-500' : 'text-red-500'}`} />
            </div>
            <span className="text-sm font-medium">Docker</span>
          </div>
          <div className="text-3xl font-semibold tracking-tight">
            {docker.available ? 'Ready' : 'Offline'}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            {docker.running || 0} containers running
          </p>
        </div>

        {/* Storage */}
        <div className="bg-card border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <HardDrive className="h-4 w-4 text-amber-500" />
              </div>
              <span className="text-sm font-medium">Storage</span>
            </div>
            <span className="text-xs text-muted-foreground">{Math.round(storagePercent)}%</span>
          </div>
          <div className="text-3xl font-semibold tracking-tight">
            {usage.used_storage || 0}
            <span className="text-lg text-muted-foreground font-normal ml-1">MB</span>
          </div>
          <div className="mt-4 h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-500"
              style={{ width: `${storagePercent}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">of {plan.storage_mb || 1024} MB</p>
        </div>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Projects list */}
        <div className="lg:col-span-2 bg-card border rounded-2xl">
          <div className="flex items-center justify-between p-5 border-b">
            <div>
              <h2 className="font-semibold">Projects</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Recent deployments</p>
            </div>
            <Link
              to="/projects"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              View all <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          {projects.length === 0 ? (
            <div className="p-12 text-center">
              <div className="h-12 w-12 rounded-2xl bg-secondary mx-auto flex items-center justify-center mb-4">
                <Box className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-medium">No projects yet</p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Deploy your first application to get started
              </p>
              <Link
                to="/deploy"
                className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                <Plus className="h-4 w-4" />
                Deploy now
              </Link>
            </div>
          ) : (
            <div className="divide-y">
              {projects.slice(0, 6).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-5 py-4 hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                      <Box className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.type} · {p.ram_mb} MB RAM
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      p.status === 'running'
                        ? 'bg-green-500/10 text-green-600'
                        : 'bg-secondary text-muted-foreground'
                    }`}>
                      {p.status}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Worker card */}
          <div className="bg-card border rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-5">
              <Server className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold">Worker</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <span className="flex items-center gap-2 text-sm font-medium text-green-600">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                  Healthy
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Docker</span>
                <span className={`text-sm font-medium ${docker.available ? 'text-green-600' : 'text-red-500'}`}>
                  {docker.available ? 'Connected' : 'Offline'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Reserved RAM</span>
                <span className="text-sm font-medium">{worker.reserved_ram_mb || 0} MB</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Mode</span>
                <span className="text-sm font-medium">Local PC</span>
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="bg-card border rounded-2xl p-5">
            <h2 className="font-semibold mb-4">Quick actions</h2>
            <div className="space-y-2">
              {[
                { to: '/deploy?type=python', label: 'Deploy Python', icon: Zap },
                { to: '/deploy?type=website', label: 'Deploy Website', icon: TrendingUp },
                { to: '/monitoring', label: 'View Monitoring', icon: Activity },
              ].map((a) => (
                <Link
                  key={a.to}
                  to={a.to}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent transition-colors group"
                >
                  <a.icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                  <span className="text-sm">{a.label}</span>
                  <ArrowUpRight className="h-3.5 w-3.5 ml-auto text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
