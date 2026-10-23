import { useEffect, useState } from 'react'
import { Activity, HardDrive, Cpu, Box, Plus, ArrowUpRight, Server } from 'lucide-react'
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

  const cards = [
    { label: 'RAM Used', value: `${usage.used_ram || 0}`, unit: 'MB', sub: `of ${plan.ram_mb || 512} MB`, icon: Activity, color: 'text-blue-500' },
    { label: 'Deployments', value: usage.deployments || 0, unit: '', sub: `of ${plan.max_deployments || 3} max`, icon: Box, color: 'text-violet-500' },
    { label: 'Docker', value: docker.available ? 'Ready' : 'Offline', unit: '', sub: `${docker.running || 0} running`, icon: Cpu, color: docker.available ? 'text-green-500' : 'text-red-500' },
    { label: 'Storage', value: usage.used_storage || 0, unit: 'MB', sub: `of ${plan.storage_mb || 1024} MB`, icon: HardDrive, color: 'text-amber-500' },
  ]

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {plan.name || 'Free'} plan · Local PC
          </p>
        </div>
        <Link
          to="/deploy"
          className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          New Deployment
        </Link>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-card border rounded-xl p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground">{c.label}</span>
              <c.icon className={`h-4 w-4 ${c.color}`} />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-semibold tracking-tight">{c.value}</span>
              {c.unit && <span className="text-sm text-muted-foreground">{c.unit}</span>}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Projects */}
        <div className="lg:col-span-3 bg-card border rounded-xl">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="font-medium">Recent Projects</h2>
            <Link to="/projects" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="p-2">
            {projects.length === 0 ? (
              <div className="py-12 text-center">
                <Box className="h-8 w-8 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No projects yet</p>
                <Link to="/deploy" className="text-sm text-primary hover:underline mt-1 inline-block">
                  Deploy your first app
                </Link>
              </div>
            ) : (
              <div className="divide-y">
                {projects.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-3 py-3 hover:bg-accent/50 rounded-lg transition-colors">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.type} · {p.ram_mb} MB</div>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      p.status === 'running'
                        ? 'bg-green-500/10 text-green-600'
                        : 'bg-secondary text-muted-foreground'
                    }`}>
                      {p.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Worker */}
        <div className="lg:col-span-2 bg-card border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <Server className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-medium">Worker</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Status</span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-green-600">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Healthy
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-t">
              <span className="text-sm text-muted-foreground">Docker</span>
              <span className={`text-sm font-medium ${docker.available ? 'text-green-600' : 'text-red-500'}`}>
                {docker.available ? 'Connected' : 'Offline'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-t">
              <span className="text-sm text-muted-foreground">Mode</span>
              <span className="text-sm font-medium">Local PC</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4 pt-3 border-t">
            All data stays on this machine.
          </p>
        </div>
      </div>
    </div>
  )
}
