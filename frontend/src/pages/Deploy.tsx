import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import {
  AlertCircle,
  ArrowLeft,
  Box,
  CheckCircle2,
  Code2,
  Gamepad2,
  Globe2,
  LoaderCircle,
  Rocket,
  Server,
  Terminal,
} from 'lucide-react'

interface Template {
  id: string
  name: string
  description: string
  image?: string
  command?: string | null
}

interface RuntimeStatus {
  mode?: string
  worker?: { name?: string; status?: string }
  docker?: { available?: boolean }
  plan?: { ram_mb?: number; storage_mb?: number; cpu_limit?: number; max_deployments?: number }
}

const templateIcons: Record<string, typeof Box> = {
  python: Code2,
  nodejs: Terminal,
  website: Globe2,
  minecraft: Gamepad2,
  docker: Box,
}

export default function Deploy() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [templates, setTemplates] = useState<Template[]>([])
  const [runtime, setRuntime] = useState<RuntimeStatus | null>(null)
  const [runtimeError, setRuntimeError] = useState('')
  const [selected, setSelected] = useState(searchParams.get('type') || 'python')
  const [name, setName] = useState('')
  const [ram, setRam] = useState(512)
  const [storage, setStorage] = useState(1024)
  const [image, setImage] = useState('')
  const [command, setCommand] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [loading, setLoading] = useState(false)
  const activeTemplate = templates.find((template) => template.id === selected)
  const maxRam = runtime?.plan?.ram_mb || 512
  const ramOptions = [256, 512, 1024, 2048].filter((value) => value <= maxRam)
  if (!ramOptions.length && maxRam >= 64) ramOptions.push(maxRam)
  const maxStorage = runtime?.plan?.storage_mb || 1024
  const storageOptions = [128, 256, 512, 1024, 2048, 5120].filter((value) => value <= maxStorage)
  if (!storageOptions.length && maxStorage >= 1) storageOptions.push(maxStorage)

  useEffect(() => {
    const type = searchParams.get('type')
    if (type) setSelected(type)
  }, [searchParams])

  useEffect(() => {
    setImage(activeTemplate?.image || '')
    setCommand(activeTemplate?.command || '')
  }, [activeTemplate?.id, activeTemplate?.image, activeTemplate?.command])

  useEffect(() => {
    const loadResources = async () => {
      try {
        const [templatesResponse, statusResponse] = await Promise.all([apiFetch('/api/templates'), apiFetch('/api/status')])
        if (!templatesResponse.ok) throw new Error('Could not load deployment templates.')
        if (!statusResponse.ok) throw new Error('Could not check worker availability.')
        const [data, nextRuntime] = await Promise.all([templatesResponse.json(), statusResponse.json()])
        if (!Array.isArray(data)) throw new Error('The API returned invalid template data.')
        setTemplates(data)
        setRuntime(nextRuntime)
        if (nextRuntime.plan?.ram_mb) setRam((current) => Math.min(current, nextRuntime.plan.ram_mb!))
        if (nextRuntime.plan?.storage_mb) setStorage((current) => Math.min(current, nextRuntime.plan.storage_mb!))
        if (!nextRuntime.docker?.available) setRuntimeError('No Docker runtime is available. A configured worker is required before this workload can be deployed.')
      } catch (cause) {
        setRuntimeError(cause instanceof Error ? cause.message : 'Could not load deployment resources.')
      } finally {
        setLoadingTemplates(false)
      }
    }
    void loadResources()
  }, [])

  const chooseTemplate = (type: string) => {
    setSelected(type)
    setSearchParams({ type }, { replace: true })
    setMessage(null)
  }

  const deploy = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!name.trim()) {
      setMessage({ type: 'error', text: 'Enter a project name to continue.' })
      return
    }
    if (!runtime?.docker?.available) {
      setMessage({ type: 'error', text: runtimeError || 'No Docker runtime is available.' })
      return
    }
    setLoading(true)
    setMessage(null)
    try {
      const response = await apiFetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          type: selected,
          ram_mb: ram,
          storage_mb: storage,
          ...(selected === 'docker' && image.trim() ? { image: image.trim() } : {}),
          ...(command.trim() ? { command: command.trim() } : {}),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'The deployment could not be created.')
      setMessage({ type: 'success', text: `${name} was created and is ${data.status || 'running'}.` })
      setName('')
    } catch (cause) {
      setMessage({ type: 'error', text: cause instanceof Error ? cause.message : 'Could not connect to the local API.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-content space-y-6">
      <div>
        <Link to="/" className="back-link"><ArrowLeft className="h-3.5 w-3.5" />Back to overview</Link>
        <div className="eyebrow mt-5"><span className="status-dot" />Provision a workload</div>
        <h1 className="page-title mt-2">New deployment</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">Create a workload on the configured local Docker worker.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.75fr)]">
        <form onSubmit={(event) => void deploy(event)} className="panel p-5 sm:p-6">
          <div>
            <h2 className="section-title">Choose a runtime</h2>
            <p className="section-description">Templates and images are provided by the local API.</p>
          </div>

          {loadingTemplates ? (
            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">{[0, 1, 2, 3].map((item) => <div className="skeleton h-[78px] rounded-xl" key={item} />)}</div>
          ) : templates.length ? (
            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {templates.map((template) => {
                const Icon = templateIcons[template.id] || Box
                const active = selected === template.id
                return (
                  <button
                    type="button"
                    key={template.id}
                    aria-pressed={active}
                    onClick={() => chooseTemplate(template.id)}
                    className={`template-option ${active ? 'template-option-active' : ''}`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground'}`}><Icon className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block text-xs font-semibold">{template.name}</span>
                      <span className="mt-1 block line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">{template.description}</span>
                    </span>
                    {active && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />}
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="inline-alert inline-alert-error mt-5"><AlertCircle className="h-4 w-4" /><span>No deployment templates are available from the backend.</span></div>
          )}

          <div className="my-6 border-t border-border/80" />

          <div className="space-y-5">
            <label className="field-label">
              Project name
              <input className="input-field mt-2" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. api-production" maxLength={80} autoComplete="off" required />
              <span className="field-hint">Used to identify this workload in your project list.</span>
            </label>
            <label className="field-label">
              Memory allocation
              <select className="select-field mt-2 w-full" value={ram} onChange={(event) => setRam(Number(event.target.value))}>
                {ramOptions.map((value) => <option key={value} value={value}>{value >= 1024 ? `${value / 1024} GB` : `${value} MB`}</option>)}
              </select>
              <span className="field-hint">The backend validates this request against your plan and worker capacity.</span>
            </label>
            <label className="field-label">
              Persistent project storage
              <select className="select-field mt-2 w-full" value={storage} onChange={(event) => setStorage(Number(event.target.value))}>
                {storageOptions.map((value) => <option key={value} value={value}>{value >= 1024 ? `${value / 1024} GB` : `${value} MB`}</option>)}
              </select>
              <span className="field-hint">Maximum allowed by your current plan: {maxStorage >= 1024 ? `${(maxStorage / 1024).toFixed(maxStorage % 1024 ? 1 : 0)} GB` : `${maxStorage} MB`}.</span>
            </label>
            {selected === 'docker' && (
              <label className="field-label">
                Docker image
                <input className="input-field mt-2" value={image} onChange={(event) => setImage(event.target.value)} placeholder="e.g. nginx:alpine" maxLength={256} required />
                <span className="field-hint">The local Docker daemon pulls this image. Never deploy images you do not trust.</span>
              </label>
            )}
            <label className="field-label">
              Startup command
              <input className="input-field mt-2 font-mono" value={command} onChange={(event) => setCommand(event.target.value)} placeholder="Use the image's default command" maxLength={2048} />
              <span className="field-hint">Runs inside the isolated container. Project files are mounted under /data.</span>
            </label>
          </div>

          {message && (
            <div role={message.type === 'error' ? 'alert' : 'status'} className={`inline-alert mt-5 ${message.type === 'success' ? 'inline-alert-success' : 'inline-alert-error'}`}>
              {message.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
              <span>{message.text}</span>
              {message.type === 'success' && <Link to="/projects" className="ml-auto shrink-0 text-xs font-semibold underline underline-offset-4">View</Link>}
            </div>
          )}

          <button type="submit" disabled={loading || loadingTemplates || !activeTemplate || !runtime?.docker?.available} className="primary-button mt-6 w-full justify-center py-2.5">
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            {loading ? 'Creating workload…' : 'Deploy workload'}
          </button>
        </form>

        <aside className="space-y-4">
          <section className="panel p-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300"><Server className="h-4 w-4" /></span>
              <div><h2 className="section-title">Provisioning target</h2><p className="section-description">Local environment</p></div>
            </div>
            <div className="mt-5 space-y-3">
              <div className="worker-detail"><span>Environment</span><span className="text-foreground">{runtime?.mode || '—'}</span></div>
              <div className="worker-detail"><span>Worker</span><span className="text-foreground">{runtime?.worker?.name || '—'}</span></div>
              <div className="worker-detail"><span>Runtime</span><span className="text-foreground">Docker</span></div>
              <div className="worker-detail"><span>Runtime status</span><span className={runtime?.docker?.available ? 'text-emerald-400' : 'text-amber-400'}>{runtime?.docker?.available ? 'Ready' : 'Unavailable'}</span></div>
              <div className="worker-detail"><span>Selected template</span><span className="text-foreground">{activeTemplate?.name || '—'}</span></div>
              <div className="worker-detail"><span>Requested memory</span><span className="font-mono text-foreground">{ram} MB</span></div>
            </div>
          </section>
          <section className="inline-alert inline-alert-neutral items-start">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-[11px] leading-relaxed">{runtimeError || 'Resource limits are validated server-side. Public routing, network metering, and payment processing are not configured.'}</p>
          </section>
        </aside>
      </div>
    </div>
  )
}
