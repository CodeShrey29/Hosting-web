import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Box,
  Check,
  ChevronRight,
  Cloud,
  Code2,
  Cpu,
  LockKeyhole,
  Server,
  ShieldCheck,
  Terminal,
  Workflow,
} from 'lucide-react'
import ThemeToggle from '../components/ThemeToggle'

const products = [
  { name: 'Websites', detail: 'Launch a site in minutes', icon: Box, tone: 'welcome-product-cyan' },
  { name: 'Node.js', detail: 'Ship your next app', icon: Code2, tone: 'welcome-product-violet' },
  { name: 'Game servers', detail: 'Keep your world online', icon: Terminal, tone: 'welcome-product-amber' },
]

const benefits = [
  'See every project in one place',
  'Keep an eye on live resource usage',
  'Start and stop workloads when you need to',
]

export default function Welcome() {
  const [mode, setMode] = useState<'checking' | 'local-pc' | 'render' | 'unavailable'>('checking')

  useEffect(() => {
    fetch('/api/health')
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load service status.')
        const data = await response.json()
        setMode(data.mode === 'render' ? 'render' : 'local-pc')
      })
      .catch(() => setMode('unavailable'))
  }, [])

  return (
    <main className="welcome-screen">
      <div className="welcome-orb welcome-orb-one" />
      <div className="welcome-orb welcome-orb-two" />

      <header className="welcome-header">
        <Link to="/" className="flex items-center gap-3" aria-label="Cloud Host home">
          <span className="brand-mark flex h-10 w-10 items-center justify-center rounded-xl"><Cloud className="h-5 w-5 text-white" /></span>
          <span>
            <span className="block text-sm font-semibold tracking-tight">Cloud Host</span>
            <span className="mt-0.5 block text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Your hosting workspace</span>
          </span>
        </Link>
        <div className="welcome-header-actions">
          <span className="welcome-status">
            <span className={`status-dot ${mode === 'unavailable' ? 'status-dot-muted' : ''}`} />
            {mode === 'checking' ? 'Checking service' : mode === 'unavailable' ? 'Service status unavailable' : mode === 'render' ? 'Control plane online' : 'Local workspace'}
          </span>
          <ThemeToggle />
        </div>
      </header>

      <section className="welcome-hero">
        <div className="welcome-copy">
          <span className="welcome-kicker"><span className="welcome-kicker-rule" />HOSTING, WITHOUT THE BUSYWORK</span>
          <h1>Your projects,<br /><span>under control.</span></h1>
          <p className="welcome-description">
            Deploy websites, services, and game servers. Keep every project and its resources organized in one straightforward workspace.
          </p>
          <Link to="/signup" className="welcome-primary">
            Create a free account <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to="/login" className="mt-3 inline-flex text-xs text-muted-foreground transition-colors hover:text-foreground">Already have an account? Sign in</Link>
          <div className="welcome-social-proof">
            <span className="welcome-proof-icon"><ShieldCheck className="h-4 w-4" /></span>
            <span><strong>Everything in one place</strong><br />Projects, resources, and status at a glance</span>
          </div>
        </div>

        <div className="welcome-preview" role="group" aria-label="Preview of the Cloud Host dashboard">
          <div className="welcome-preview-window">
            <div className="welcome-preview-top">
              <div className="flex items-center gap-2">
                <span className="brand-mark flex h-7 w-7 items-center justify-center rounded-lg"><Cloud className="h-3.5 w-3.5 text-white" /></span>
                <span className="text-[11px] font-semibold">Your workspace</span>
              </div>
              <span className="welcome-preview-live"><span className="status-dot" />OVERVIEW</span>
            </div>
            <div className="welcome-preview-content">
              <div className="flex items-end justify-between gap-3">
                <div><p className="text-[10px] text-muted-foreground">WORKSPACE OVERVIEW</p><p className="mt-1 text-lg font-semibold tracking-tight">Everything in its place.</p></div>
                <span className="welcome-preview-spark"><Workflow className="h-4 w-4" /></span>
              </div>
              <div className="welcome-preview-metrics">
                <div><span className="welcome-preview-metric-icon"><Box className="h-3.5 w-3.5" /></span><p className="welcome-preview-value">Projects</p><span className="welcome-preview-caption">All your work, together</span></div>
                <div><span className="welcome-preview-metric-icon welcome-preview-metric-purple"><Cpu className="h-3.5 w-3.5" /></span><p className="welcome-preview-value">Resources</p><span className="welcome-preview-caption">Know what you’re using</span></div>
              </div>
              <div className="welcome-preview-list">
                <div className="flex items-center justify-between"><span className="text-[10px] font-semibold">Built around your work</span><span className="text-[9px] text-muted-foreground">YOUR PROJECTS</span></div>
                {benefits.map((benefit) => <div key={benefit} className="flex items-center gap-2.5 text-[10px] text-muted-foreground"><span className="welcome-check"><Check className="h-2.5 w-2.5" /></span>{benefit}</div>)}
              </div>
            </div>
          </div>
          <div className="welcome-float-card"><span className="welcome-float-icon"><Server className="h-4 w-4" /></span><span><strong>One home for every service</strong><br /><small>Deployments, status, and resources</small></span><ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" /></div>
        </div>
      </section>

      <section className="welcome-products" aria-labelledby="welcome-products-title">
        <div className="welcome-section-heading">
          <div><p className="welcome-section-label">START WITH WHAT YOU NEED</p><h2 id="welcome-products-title">Choose a project type</h2></div>
          <Link to="/signup" className="welcome-text-link">Create an account <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
        <div className="welcome-product-grid">
          {products.map(({ name, detail, icon: Icon, tone }) => (
            <article className="welcome-product-card" key={name}>
              <span className={`welcome-product-icon ${tone}`}><Icon className="h-[18px] w-[18px]" /></span>
              <div className="min-w-0 flex-1"><h3>{name}</h3><p>{detail}</p></div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/60" />
            </article>
          ))}
        </div>
      </section>

      <section className="welcome-access" id="workspace-access">
        <div className="welcome-access-icon"><LockKeyhole className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <p className="welcome-section-label">YOUR WORKSPACE</p>
          <h2>Your own private workspace.</h2>
          <p>Create a free account with your email and password. Your projects and resource usage stay tied to your account.</p>
        </div>
        <Link to="/signup" className="welcome-primary">Sign up <ArrowRight className="h-4 w-4" /></Link>
      </section>

      <footer className="welcome-footer">
        <span>© {new Date().getFullYear()} Cloud Host <span className="welcome-footer-divider">·</span> Built for what’s next</span>
        <Link to="/admin" className="welcome-admin-link" aria-label="Administrator sign in" title="Administrator sign in">
          <LockKeyhole className="h-3.5 w-3.5" />
          <span>Admin</span>
        </Link>
      </footer>
    </main>
  )
}
