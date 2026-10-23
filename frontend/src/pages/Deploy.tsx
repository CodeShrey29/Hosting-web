import { useState, useEffect } from 'react'
import { Rocket, Check } from 'lucide-react'

export default function Deploy() {
  const [templates, setTemplates] = useState<any[]>([])
  const [selected, setSelected] = useState('python')
  const [name, setName] = useState('')
  const [ram, setRam] = useState(512)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/templates').then(r => r.json()).then(setTemplates).catch(() => {})
  }, [])

  const deploy = async () => {
    if (!name.trim()) {
      setStatus('Please enter a project name')
      return
    }
    setLoading(true)
    setStatus('')
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type: selected, ram_mb: ram })
      })
      const data = await res.json()
      setStatus(res.ok ? `Deployed successfully` : (data.error || 'Failed'))
    } catch {
      setStatus('Network error')
    }
    setLoading(false)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New Deployment</h1>
        <p className="text-sm text-muted-foreground mt-1">Deploy a container on your local PC</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelected(t.id)}
            className={`p-3 rounded-xl border text-left transition-all ${
              selected === t.id
                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                : 'hover:border-muted-foreground/30 hover:bg-accent/50'
            }`}
          >
            <div className="font-medium text-sm">{t.name}</div>
            <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.description}</div>
          </button>
        ))}
      </div>

      <div className="bg-card border rounded-xl p-5 space-y-4">
        <div>
          <label className="text-sm font-medium">Project name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1.5 w-full bg-background border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="my-awesome-app"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Memory</label>
          <select
            value={ram}
            onChange={(e) => setRam(Number(e.target.value))}
            className="mt-1.5 w-full bg-background border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value={256}>256 MB</option>
            <option value={512}>512 MB</option>
            <option value={1024}>1 GB</option>
            <option value={2048}>2 GB</option>
          </select>
        </div>
        <button
          onClick={deploy}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          <Rocket className="h-4 w-4" />
          {loading ? 'Deploying...' : 'Deploy'}
        </button>
        {status && (
          <p className={`text-sm text-center ${
            status.includes('success') ? 'text-green-600' : 'text-muted-foreground'
          }`}>
            {status.includes('success') && <Check className="inline h-4 w-4 mr-1" />}
            {status}
          </p>
        )}
      </div>
    </div>
  )
}
