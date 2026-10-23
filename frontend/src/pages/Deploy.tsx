import { useState, useEffect } from 'react'
import { Upload, Check } from 'lucide-react'

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
      setStatus('Enter a project name')
      return
    }
    setLoading(true)
    setStatus('Deploying...')
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type: selected, ram_mb: ram })
      })
      const data = await res.json()
      if (res.ok) {
        setStatus(`Deployed! ID: ${data.id}`)
      } else {
        setStatus(data.error || 'Failed')
      }
    } catch (e) {
      setStatus('Network error')
    }
    setLoading(false)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Deploy</h2>
        <p className="text-muted-foreground">Deploy on your local PC using real Docker</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelected(t.id)}
            className={`border rounded-lg p-4 text-left transition-colors ${
              selected === t.id ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
            }`}
          >
            <div className="font-medium">{t.name}</div>
            <div className="text-xs text-muted-foreground mt-1">{t.description}</div>
          </button>
        ))}
      </div>

      <div className="bg-card border rounded-lg p-6 space-y-4">
        <div>
          <label className="text-sm font-medium">Project Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full bg-background border rounded-md px-3 py-2 text-sm"
            placeholder="my-app"
          />
        </div>
        <div>
          <label className="text-sm font-medium">RAM (MB)</label>
          <select
            value={ram}
            onChange={(e) => setRam(Number(e.target.value))}
            className="mt-1 w-full bg-background border rounded-md px-3 py-2 text-sm"
          >
            <option value={256}>256 MB</option>
            <option value={512}>512 MB (Free)</option>
            <option value={1024}>1 GB</option>
            <option value={2048}>2 GB</option>
          </select>
        </div>
        <button
          onClick={deploy}
          disabled={loading}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'Deploying...' : 'Deploy on this PC'}
        </button>
        {status && <p className="text-sm text-muted-foreground">{status}</p>}
      </div>
    </div>
  )
}
