import { useEffect, useState } from 'react'
import { Activity, HardDrive, Cpu, Network, Server, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Dashboard() {
  const [status, setStatus] = useState<any>(null)
  const [projects, setProjects] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/status').then(r => r.json()).then(setStatus).catch(() => {})
    fetch('/api/projects').then(r => r.json()).then(setProjects).catch(() => {})
  }, [])

  const docker = status?.docker || {}
  const worker = status?.worker || {}
  const plan = status?.plan || {}
  const usage = status?.usage || {}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <p className="text-muted-foreground">
            Local PC · Plan: {plan.name || 'Free'}
          </p>
        </div>
        <Link
          to="/deploy"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Deploy New
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border rounded-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">RAM</span>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold">{usage.used_ram || 0} MB</div>
          <div className="text-xs text-muted-foreground mt-1">of {plan.ram_mb || 512} MB plan</div>
        </div>
        <div className="bg-card border rounded-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Deployments</span>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold">{usage.deployments || 0}</div>
          <div className="text-xs text-muted-foreground mt-1">of {plan.max_deployments || 3} max</div>
        </div>
        <div className="bg-card border rounded-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Docker</span>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold">{docker.available ? 'Ready' : 'Offline'}</div>
          <div className="text-xs text-muted-foreground mt-1">{docker.running || 0} running</div>
        </div>
        <div className="bg-card border rounded-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Storage</span>
            <Network className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold">{usage.used_storage || 0} MB</div>
          <div className="text-xs text-muted-foreground mt-1">of {plan.storage_mb || 1024} MB</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border rounded-lg p-6">
          <h3 className="font-semibold mb-4">Projects</h3>
          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No projects yet. Deploy one to see it here.</p>
          ) : (
            <div className="space-y-3">
              {projects.slice(0, 5).map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-background rounded-md">
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.type} · {p.ram_mb} MB RAM</div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    p.status === 'running' ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground'
                  }`}>
                    {p.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border rounded-lg p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Server className="h-4 w-4" />
            Local Worker
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className="text-green-600 font-medium">{worker.status || 'healthy'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reserved RAM</span>
              <span>{worker.reserved_ram_mb || 0} MB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Docker</span>
              <span>{docker.available ? 'Connected' : 'Offline'}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Real plan limits enforced on this PC.
          </p>
        </div>
      </div>
    </div>
  )
}
