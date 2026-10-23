import { Activity, HardDrive, Cpu, Network, Server, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'

const metrics = [
  { label: 'RAM', value: '0.8 GB', total: '4 GB', percent: 20, icon: Activity },
  { label: 'Storage', value: '2.1 GB', total: '50 GB', percent: 4, icon: HardDrive },
  { label: 'CPU', value: '12%', total: '100%', percent: 12, icon: Cpu },
  { label: 'Transfer', value: '1.2 GB', total: '100 GB', percent: 1, icon: Network },
]

const recentDeployments = [
  { name: 'my-python-api', status: 'Running', type: 'Python', region: 'Local PC' },
  { name: 'website-static', status: 'Stopped', type: 'Website', region: 'Local PC' },
]

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <p className="text-muted-foreground">Local PC infrastructure overview</p>
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
        {metrics.map((m) => (
          <div key={m.label} className="bg-card border rounded-lg p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">{m.label}</span>
              <m.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{m.value}</div>
            <div className="text-xs text-muted-foreground mt-1">of {m.total}</div>
            <div className="mt-3 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${m.percent}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border rounded-lg p-6">
          <h3 className="font-semibold mb-4">Recent Deployments</h3>
          <div className="space-y-3">
            {recentDeployments.map((d) => (
              <div
                key={d.name}
                className="flex items-center justify-between p-3 bg-background rounded-md"
              >
                <div>
                  <div className="font-medium">{d.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {d.type} · {d.region}
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    d.status === 'Running'
                      ? 'bg-green-500/10 text-green-600'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {d.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border rounded-lg p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Server className="h-4 w-4" />
            Local Worker
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className="text-green-600 font-medium">Healthy</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Mode</span>
              <span>Local PC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Docker</span>
              <span>Ready</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            All data and containers stay on this machine.
          </p>
        </div>
      </div>
    </div>
  )
}
