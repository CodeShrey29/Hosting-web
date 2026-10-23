import { useState, type FormEvent } from 'react'
import { AlertCircle, ArrowRight, Cloud, KeyRound, LoaderCircle, Mail } from 'lucide-react'
import { apiFetch, setCsrfToken } from '../lib/api'

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
      <div className="login-glow" />
      <section className="login-card">
        <div className="flex items-center gap-3">
          <span className="brand-mark flex h-10 w-10 items-center justify-center rounded-xl"><Cloud className="h-5 w-5 text-white" /></span>
          <div><p className="text-sm font-semibold tracking-tight">Cloud Host</p><p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Control plane</p></div>
        </div>
        <div className="mt-9">
          <span className="subtle-tag"><KeyRound className="h-3 w-3" />Protected access</span>
          <h1 className="mt-4 text-[25px] font-semibold tracking-[-0.04em]">Welcome back</h1>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Sign in with the administrator credentials configured for this control plane.</p>
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
          <button type="submit" disabled={loading || Boolean(configurationError)} className="primary-button mt-2 w-full justify-center py-2.5">
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {configurationError ? 'Configuration required' : loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-6 border-t border-border pt-4 text-[10px] leading-relaxed text-muted-foreground">This is a single-administrator control plane. It does not yet provide customer accounts or multi-tenant isolation.</p>
      </section>
      <p className="relative mt-5 text-center text-[10px] text-muted-foreground/70">Secure session · Same-site cookies · CSRF protected actions</p>
    </main>
  )
}
