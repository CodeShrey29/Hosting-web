import { useCallback, useEffect, useState } from 'react'
import { Activity, AlertCircle, Clock3, Cpu, HardDrive, RefreshCw, Server, Shield } from 'lucide-react'
import { apiFetch } from '../lib/api'

interface Worker {
  name?: string
  status?: string
  total_ram_mb?: number
  reserved_ram_mb?: number
  total_cpu?: number
  reserved_cpu?: number
  total_storage_mb?: number
  reserved_storage_mb?: number
  last_seen?: string
}

interface ServerData {
  worker?: Worker
  docker?: { available?: boolean; running?: number; error?: string }
  mode?: string
}

export default function Servers() {
  const [data, setData] = useState<ServerData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const response = await apiFetch('/api/status')
      if (!response.ok) throw new Error('Could not load worker status.')
      setData(await response.json())
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not connect to the local API.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const worker = data?.worker
  const percentage = (reserved?: number, total?: number) => total ? Math.min(100, Math.round(((reserved || 0) / total) * 100)) : null
  const ramPercent = percentage(worker?.reserved_ram_mb, worker?.total_ram_mb)
  const storagePercent = percentage(worker?.reserved_storage_mb, worker?.total_storage_mb)

  return (
    <div className="page-content space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="eyebrow"><span className={`status-dot ${error ? 'status-dot-muted' : ''}`} />Infrastructure</div>
          <h1 className="page-title mt-2">Workers</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">Compute nodes registered with this control plane.</p>
        </div>
        <button type="button" onClick={() => void load()} className="secondary-button self-start sm:self-auto"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />Refresh status</button>
      </div>

      {error && <div role="alert" className="inline-alert inline-alert-error"><AlertCircle className="h-4 w-4 shrink-0" /><span>{error}</span></div>}

      <section className="panel overflow-hidden">
        <div className="panel-heading">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/15 bg-emerald-400/10 text-emerald-400"><Server className="h-[18px] w-[18px]" /></span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="section-title">{worker?.name || 'Worker unavailable'}</h2>
                {worker?.status && <span className={`status-pill ${worker.status === 'healthy' ? 'status-pill-running' : 'status-pill-stopped'}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{worker.status}</span>}
              </div>
              <p className="section-description">{data?.mode || 'Single-node'} · worker record reported by the API</p>
            </div>
          </div>
          <span className="subtle-tag"><Shield className="h-3 w-3" />Single node</span>
        </div>

        <div className="grid gap-px border-t border-border bg-border/70 sm:grid-cols-2 xl:grid-cols-5">
          <div className="bg-card p-5">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground"><Cpu className="h-3.5 w-3.5" />RAM reservation</div>
            <p className="mt-3 font-mono text-lg font-semibold tracking-tight">{worker && worker.status !== 'unavailable' ? `${worker.reserved_ram_mb ?? 0} MB` : '—'}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">{worker ? `of ${worker.total_ram_mb ?? '—'} MB configured` : 'Worker data unavailable'}</p>
            {ramPercent !== null && <div className="mt-3 h-1 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-blue-400" style={{ width: `${ramPercent}%` }} /></div>}
          </div>
          <div className="bg-card p-5">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground"><Cpu className="h-3.5 w-3.5" />CPU reservation</div>
            <p className="mt-3 font-mono text-lg font-semibold tracking-tight">{worker && worker.status !== 'unavailable' ? `${worker.reserved_cpu ?? 0} vCPU` : '—'}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">{worker ? `of ${worker.total_cpu ?? '—'} vCPU configured` : 'Worker data unavailable'}</p>
          </div>
          <div className="bg-card p-5">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground"><HardDrive className="h-3.5 w-3.5" />Storage reservation</div>
            <p className="mt-3 font-mono text-lg font-semibold tracking-tight">{worker && worker.status !== 'unavailable' ? `${worker.reserved_storage_mb ?? 0} MB` : '—'}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">{worker ? `of ${worker.total_storage_mb ?? '—'} MB configured` : 'Worker data unavailable'}</p>
            {storagePercent !== null && <div className="mt-3 h-1 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-amber-400" style={{ width: `${storagePercent}%` }} /></div>}
          </div>
          <div className="bg-card p-5">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground"><Activity className="h-3.5 w-3.5" />Container runtime</div>
            <p className={`mt-3 text-lg font-semibold tracking-tight ${data?.docker?.available ? 'text-emerald-400' : ''}`}>{loading ? 'Checking…' : data?.docker?.available ? 'Docker ready' : 'Unavailable'}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">{data?.docker?.available ? `${data.docker.running ?? 0} running containers reported` : data?.docker?.error || 'Runtime has not connected'}</p>
          </div>
          <div className="bg-card p-5">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />Last worker check-in</div>
            <p className="mt-3 text-sm font-semibold tracking-tight">{worker?.last_seen ? new Date(worker.last_seen.replace(' ', 'T') + (worker.last_seen.endsWith('Z') ? '' : 'Z')).toLocaleString() : 'Not reported'}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">Worker record timestamp, not a heartbeat</p>
          </div>
        </div>
      </section>

      <section className="inline-alert inline-alert-neutral items-start">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="text-[11px] leading-relaxed">The current API reports configured reservation capacity, not live CPU, memory, disk health, or network throughput. Remote worker enrollment is not configured.</p>
      </section>
    </div>
  )
}
