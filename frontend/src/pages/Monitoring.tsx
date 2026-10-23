import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, AlertCircle, ArrowRight, Cpu, HardDrive, MemoryStick, Radio, RefreshCw, Waypoints } from 'lucide-react'
import { apiFetch } from '../lib/api'

interface WorkloadMetric {
  project_id: number
  name: string
  type?: string
  error?: string
  cpu_percent?: number
  memory_usage_bytes?: number
  memory_limit_bytes?: number
  storage_used_bytes?: number | null
  storage_limit_bytes?: number
  ingress_bytes?: number
  egress_bytes?: number
}

interface MetricsResponse {
  sampled_at: string
  sampling: 'instantaneous'
  metrics: WorkloadMetric[]
}

const formatBytes = (value?: number | null) => {
  if (value == null) return 'Unavailable'
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export default function Monitoring() {
  const [data, setData] = useState<MetricsResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const response = await apiFetch('/api/monitoring/metrics')
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not read live workload metrics.')
      setData(result)
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not connect to the metrics API.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const interval = window.setInterval(() => void load(), 10_000)
    return () => window.clearInterval(interval)
  }, [load])

  const metrics = data?.metrics || []
  const validMetrics = metrics.filter((metric) => !metric.error)
  const averageCpu = validMetrics.length
    ? validMetrics.reduce((total, metric) => total + (metric.cpu_percent || 0), 0) / validMetrics.length
    : null
  const totalMemory = validMetrics.reduce((total, metric) => total + (metric.memory_usage_bytes || 0), 0)
  const totalStorage = validMetrics.reduce((total, metric) => total + (metric.storage_used_bytes || 0), 0)
  const totalTransfer = validMetrics.reduce((total, metric) => total + (metric.ingress_bytes || 0) + (metric.egress_bytes || 0), 0)

  return (
    <div className="page-content space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="eyebrow"><span className={`status-dot ${error ? 'status-dot-muted' : ''}`} />Live observability</div>
          <h1 className="page-title mt-2">Monitoring</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">Current Docker workload samples from this local worker.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="secondary-button self-start sm:self-auto">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />Refresh
        </button>
      </div>

      {error && <div role="alert" className="inline-alert inline-alert-error"><AlertCircle className="h-4 w-4 shrink-0" /><span>{error}</span></div>}

      {data && (
        <>
          <section aria-label="Current resource samples" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={Cpu} label="Average CPU" value={averageCpu === null ? '—' : `${averageCpu.toFixed(1)}%`} detail="Across sampled running containers" />
            <MetricCard icon={MemoryStick} label="Memory working set" value={formatBytes(totalMemory)} detail="Container usage excluding reclaimable cache" />
            <MetricCard icon={HardDrive} label="Project volume usage" value={formatBytes(totalStorage)} detail="Measured files in managed project volumes" />
            <MetricCard icon={Waypoints} label="Lifetime network counters" value={formatBytes(totalTransfer)} detail="Docker interface counters; not a billing meter" />
          </section>

          <section className="panel overflow-hidden">
            <div className="panel-heading border-b border-border/80">
              <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-cyan-400" /><div><h2 className="section-title">Running workloads</h2><p className="section-description">Samples refresh every 10 seconds · last sample {new Date(data.sampled_at).toLocaleTimeString()}</p></div></div>
              <span className="subtle-tag"><span className="status-dot" />Live sample</span>
            </div>
            {metrics.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-[11px]">
                  <thead className="bg-secondary/35 text-[9px] uppercase tracking-wider text-muted-foreground">
                    <tr><th className="px-5 py-3 font-semibold">Workload</th><th className="px-4 py-3 font-semibold">CPU</th><th className="px-4 py-3 font-semibold">Memory</th><th className="px-4 py-3 font-semibold">Volume</th><th className="px-4 py-3 font-semibold">Network counters</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border/70">
                    {metrics.map((metric) => (
                      <tr key={metric.project_id}>
                        <td className="px-5 py-3"><span className="font-semibold">{metric.name}</span><span className="ml-2 capitalize text-muted-foreground">{metric.type}</span>{metric.error && <p className="mt-1 text-[10px] text-amber-400">{metric.error}</p>}</td>
                        <td className="px-4 py-3 font-mono">{metric.error ? '—' : `${(metric.cpu_percent || 0).toFixed(1)}%`}</td>
                        <td className="px-4 py-3 font-mono">{metric.error ? '—' : `${formatBytes(metric.memory_usage_bytes)} / ${formatBytes(metric.memory_limit_bytes)}`}</td>
                        <td className="px-4 py-3 font-mono">{metric.error ? '—' : `${formatBytes(metric.storage_used_bytes)} / ${formatBytes(metric.storage_limit_bytes)}`}</td>
                        <td className="px-4 py-3 font-mono">{metric.error ? '—' : `↓ ${formatBytes(metric.ingress_bytes)} · ↑ ${formatBytes(metric.egress_bytes)}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-6 py-12 text-center"><Radio className="mx-auto h-5 w-5 text-muted-foreground" /><p className="mt-3 text-xs font-semibold">No running workloads to sample</p><p className="mt-1 text-[11px] text-muted-foreground">Start a project to collect a live Docker snapshot.</p><Link to="/projects" className="secondary-button mt-4">View projects <ArrowRight className="h-3.5 w-3.5" /></Link></div>
            )}
          </section>

          <section className="inline-alert inline-alert-neutral items-start">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-[11px] leading-relaxed">These are instantaneous Docker snapshots and lifetime network counters, not historical charts or billable usage. The service does not persist time-series data, measure disk I/O, or meter transfer against a plan.</p>
          </section>
        </>
      )}

      {!data && !error && loading && <div className="panel p-8 text-center text-xs text-muted-foreground">Connecting to the local Docker metrics provider…</div>}
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: typeof Cpu; label: string; value: string; detail: string }) {
  return (
    <section className="metric-card panel">
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</div>
      <p className="mt-3 font-mono text-lg font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{detail}</p>
    </section>
  )
}
