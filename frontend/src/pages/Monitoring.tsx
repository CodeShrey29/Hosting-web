import { Link } from 'react-router-dom'
import { Activity, AlertCircle, ArrowRight, Cpu, HardDrive, Radio, Server, Waypoints } from 'lucide-react'

const unavailableMetrics = [
  { label: 'CPU utilization', icon: Cpu, description: 'Live per-process and worker CPU samples' },
  { label: 'Memory usage', icon: Activity, description: 'Actual working set, separate from reservations' },
  { label: 'Disk I/O & usage', icon: HardDrive, description: 'Filesystem capacity, latency, and throughput' },
  { label: 'Network transfer', icon: Waypoints, description: 'Ingress, egress, and request totals' },
]

export default function Monitoring() {
  return (
    <div className="page-content space-y-6">
      <div>
        <div className="eyebrow"><span className="status-dot status-dot-muted" />Observability</div>
        <h1 className="page-title mt-2">Monitoring</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">Telemetry and health signals from your worker and workloads.</p>
      </div>

      <section className="panel overflow-hidden">
        <div className="flex flex-col items-center px-6 py-12 text-center sm:px-12 sm:py-16">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-secondary/60 text-cyan-300"><Radio className="h-5 w-5" /></span>
          <span className="subtle-tag mt-4"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />Telemetry not configured</span>
          <h2 className="mt-4 text-base font-semibold tracking-tight">No live metrics are available yet</h2>
          <p className="mt-2 max-w-lg text-xs leading-relaxed text-muted-foreground">
            This control plane does not currently collect time-series resource samples. We’re not showing estimated or placeholder charts as if they were real measurements.
          </p>
          <div className="mt-6 grid w-full max-w-2xl grid-cols-1 gap-2 text-left sm:grid-cols-2">
            {unavailableMetrics.map(({ label, icon: Icon, description }) => (
              <div key={label} className="flex items-start gap-3 rounded-xl border border-border/80 bg-background/50 p-3.5">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div><p className="text-[11px] font-semibold">{label}</p><p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{description}</p></div>
              </div>
            ))}
          </div>
          <Link to="/servers" className="secondary-button mt-6">View worker status <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
      </section>

      <section className="inline-alert inline-alert-neutral items-start">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="text-[11px] leading-relaxed">Current project and worker pages show reserved resource allocations from the control plane. They are not substitutes for live utilization telemetry. Metrics will appear here once a trusted worker-side collector is connected.</p>
      </section>

      <div className="flex items-center gap-2 text-[10px] text-muted-foreground"><Server className="h-3 w-3" />Telemetry pipeline unavailable</div>
    </div>
  )
}
