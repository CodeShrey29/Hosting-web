import { useState, type FormEvent } from 'react'
import { AlertCircle, ArrowRight, Check, Cloud, KeyRound, LoaderCircle, LockKeyhole, Mail, ShieldCheck, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { apiFetch, setCsrfToken } from '../lib/api'
import ThemeToggle from '../components/ThemeToggle'

interface LoginProps {
  configurationError?: string
  onAuthenticated: (email: string, csrfToken: string, mode: string) => void
}

export default function Login({ configurationError, onAuthenticated }: LoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(configurationError || '')
  const [loading, setLoading] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Sign-in failed.')
      if (result.role !== 'admin') throw new Error('Use the customer sign-in page for customer accounts.')
      if (typeof result.csrf_token !== 'string') throw new Error('The server did not establish a secure session.')
      setCsrfToken(result.csrf_token)
      onAuthenticated(result.email, result.csrf_token, result.mode)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not reach the control plane.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-screen">
      <div className="login-glow login-glow-top" />
      <header className="login-brandbar">
        <Link to="/" className="flex items-center gap-3">
          <span className="brand-mark flex h-10 w-10 items-center justify-center rounded-xl"><Cloud className="h-5 w-5 text-white" /></span>
          <span><span className="block text-sm font-semibold tracking-tight">Cloud Host</span><span className="mt-0.5 block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Control plane</span></span>
        </Link>
        <div className="auth-header-actions"><span className="login-secure-label"><ShieldCheck className="h-3.5 w-3.5" />Secure admin access</span><ThemeToggle /></div>
      </header>

      <section className="login-layout">
        <div className="login-story">
          <span className="welcome-kicker"><Sparkles className="h-3.5 w-3.5" />PLATFORM ADMINISTRATION</span>
          <h1>Keep your<br /><span>users in view.</span></h1>
          <p>Review customer accounts from a dedicated administrator panel, separate from customer workspaces.</p>
          <div className="login-story-list">
            <span><span className="login-story-check"><Check className="h-3 w-3" /></span>Registered customer accounts</span>
            <span><span className="login-story-check"><Check className="h-3 w-3" /></span>Account status and project counts</span>
            <span><span className="login-story-check"><Check className="h-3 w-3" /></span>No customer purchasing flow</span>
          </div>
        </div>

        <section className="login-card">
          <div className="login-card-heading">
            <span className="login-lock-icon"><LockKeyhole className="h-[18px] w-[18px]" /></span>
            <div>
              <span className="subtle-tag"><KeyRound className="h-3 w-3" />Administrator</span>
              <h2 className="mt-3 text-xl font-semibold tracking-[-0.04em]">Sign in to continue</h2>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">Use the administrator credentials configured for this control plane.</p>
            </div>
          </div>

          {error && <div role="alert" className="inline-alert inline-alert-error mt-5 items-start"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}

          <form onSubmit={(event) => void submit(event)} className="mt-6 space-y-4">
            <label className="field-label">
              Administrator email
              <span className="input-wrap mt-2"><Mail className="h-4 w-4 text-muted-foreground" /><input className="login-input" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></span>
            </label>
            <label className="field-label">
              Password
              <span className="input-wrap mt-2"><KeyRound className="h-4 w-4 text-muted-foreground" /><input className="login-input" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></span>
            </label>
            <button type="submit" disabled={loading || Boolean(configurationError)} className="primary-button login-submit mt-2 w-full justify-center py-2.5">
              {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {configurationError ? 'Configuration required' : loading ? 'Signing in…' : 'Sign in securely'}
            </button>
          </form>
          <p className="login-security-note"><ShieldCheck className="h-3.5 w-3.5 shrink-0" />Protected by a secure session and CSRF-checked actions.</p>
        </section>
      </section>

      <footer className="login-footer"><Link to="/" className="text-link">← Back to Cloud Host</Link><span>Administrator access only</span></footer>
    </main>
  )
}
