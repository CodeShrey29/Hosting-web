import { useEffect, useState } from 'react'
import { AlertCircle, Check, Database, HardDrive, MonitorCog, Moon, Shield, Sun } from 'lucide-react'
import { apiFetch } from '../lib/api'

export default function Settings() {
  const [dark, setDark] = useState(() => window.localStorage.getItem('cloud-host-theme') !== 'light')
  const [health, setHealth] = useState<'checking' | 'online' | 'offline'>('checking')
  const [deploymentMode, setDeploymentMode] = useState('unknown')
  const [storageMode, setStorageMode] = useState('unknown')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    window.localStorage.setItem('cloud-host-theme', dark ? 'dark' : 'light')
  }, [dark])

  useEffect(() => {
    apiFetch('/api/health')
      .then(async (response) => {
        if (!response.ok) throw new Error('Health check failed')
        const data = await response.json()
        setDeploymentMode(data.mode || 'unknown')
        setStorageMode(data.storage || 'unknown')
        setHealth('online')
      })
      .catch(() => setHealth('offline'))
  }, [])

  return (
    <div className="page-content space-y-6">
      <div>
        <div className="eyebrow"><span className="status-dot" />Workspace</div>
        <h1 className="page-title mt-2">Settings</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">Environment preferences and service information.</p>
      </div>

      <section className="panel overflow-hidden">
        <div className="panel-heading"><div><h2 className="section-title">Preferences</h2><p className="section-description">Changes apply to this browser.</p></div><MonitorCog className="h-4 w-4 text-muted-foreground" /></div>
        <div className="flex items-center gap-3 px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-secondary/60 text-muted-foreground">{dark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</span>
          <div className="flex-1"><p className="text-xs font-semibold">Appearance</p><p className="mt-1 text-[10px] text-muted-foreground">Theme preference is saved in local browser storage.</p></div>
          <button type="button" onClick={() => setDark((value) => !value)} className="secondary-button"><span className={`h-1.5 w-1.5 rounded-full ${dark ? 'bg-cyan-400' : 'bg-amber-400'}`} />{dark ? 'Dark' : 'Light'} theme</button>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="panel-heading"><div><h2 className="section-title">Environment</h2><p className="section-description">How this instance is configured.</p></div><Shield className="h-4 w-4 text-muted-foreground" /></div>
        <div className="divide-y divide-border/70">
          <div className="settings-row"><div className="settings-row-icon"><Database className="h-4 w-4" /></div><div className="flex-1"><p className="text-xs font-semibold">Control plane</p><p className="mt-1 text-[10px] text-muted-foreground">{deploymentMode === 'render' ? 'Hosted on Render' : deploymentMode === 'local-pc' ? 'Single-machine local mode' : 'Deployment mode reported by the API'}</p></div><span className={`subtle-tag ${health === 'online' ? 'text-emerald-400' : ''}`}>{health === 'online' ? <Check className="h-3 w-3" /> : health === 'offline' ? <AlertCircle className="h-3 w-3" /> : null}{health === 'checking' ? 'Checking' : health === 'online' ? 'API online' : 'API offline'}</span></div>
          <div className="settings-row"><div className="settings-row-icon"><HardDrive className="h-4 w-4" /></div><div className="flex-1"><p className="text-xs font-semibold">Data storage</p><p className="mt-1 text-[10px] text-muted-foreground">{storageMode === 'ephemeral' ? 'Render filesystem is ephemeral; data may be lost on redeploy or restart.' : storageMode === 'persistent' ? 'Persistent storage mount is active.' : storageMode === 'local-disk' ? 'Application-managed local disk directory.' : 'Storage persistence status reported by the API.'}</p></div><code className="rounded-md border border-border bg-secondary/60 px-2 py-1 font-mono text-[10px] text-muted-foreground">{storageMode === 'ephemeral' ? 'ephemeral' : deploymentMode === 'render' ? '/var/data' : './data'}</code></div>
          <div className="settings-row"><div className="settings-row-icon"><MonitorCog className="h-4 w-4" /></div><div className="flex-1"><p className="text-xs font-semibold">Start command</p><p className="mt-1 text-[10px] text-muted-foreground">Run the Flask control plane and built frontend.</p></div><code className="rounded-md border border-border bg-secondary/60 px-2 py-1 font-mono text-[10px] text-muted-foreground">{deploymentMode === 'render' ? 'gunicorn hosting:app' : 'python hosting.py'}</code></div>
        </div>
      </section>

      <section className="inline-alert inline-alert-neutral items-start">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="text-[11px] leading-relaxed">Customer accounts use isolated project access, and administrator tools are available separately. Email verification, account recovery, persistent production storage, and an authenticated remote worker are not configured yet.</p>
      </section>
    </div>
  )
}
