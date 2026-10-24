import { useState, type FormEvent } from 'react'
import { AlertCircle, ArrowRight, Cloud, LockKeyhole, Mail } from 'lucide-react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../lib/api'

interface CustomerAuthProps {
  mode: 'login' | 'signup'
  onAuthenticated: (email: string, csrfToken: string, mode: string, role: string) => void
}

export default function CustomerAuth({ mode, onAuthenticated }: CustomerAuthProps) {
  const isSignup = mode === 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = await apiFetch(isSignup ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not authenticate.')
      if (!['customer', 'admin'].includes(result.role) || typeof result.csrf_token !== 'string') {
        throw new Error('The server did not establish a secure session.')
      }
      onAuthenticated(result.email, result.csrf_token, result.mode, result.role)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not reach the control plane.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-screen">
      <header className="login-brandbar">
        <Link to="/" className="flex items-center gap-3">
          <span className="brand-mark flex h-10 w-10 items-center justify-center rounded-xl"><Cloud className="h-5 w-5 text-white" /></span>
          <span><span className="block text-sm font-semibold tracking-tight">Cloud Host</span><span className="mt-0.5 block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Customer workspace</span></span>
        </Link>
        <span className="login-secure-label"><LockKeyhole className="h-3.5 w-3.5" />Secure account access</span>
      </header>

      <section className="login-layout">
        <div className="login-story">
          <span className="welcome-kicker">YOUR PROJECTS, IN ONE PLACE</span>
          <h1>{isSignup ? <>Start your<br /><span>workspace.</span></> : <>Welcome<br /><span>back.</span></>}</h1>
          <p>{isSignup ? 'Create a free account to manage your own projects and resources.' : 'Sign in to continue to your private customer workspace.'}</p>
          {isSignup && <p className="mt-4 text-xs text-muted-foreground">Free to create. No payment details or email verification required.</p>}
        </div>

        <section className="login-card">
          <div>
            <span className="subtle-tag"><LockKeyhole className="h-3 w-3" />Customer account</span>
            <h2 className="mt-3 text-xl font-semibold tracking-[-0.04em]">{isSignup ? 'Create your account' : 'Sign in'}</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{isSignup ? 'Your account starts on the free plan.' : 'Use the email and password for your account.'}</p>
          </div>

          {error && <div role="alert" className="inline-alert inline-alert-error mt-5 items-start"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}

          <form onSubmit={(event) => void submit(event)} className="mt-6 space-y-4">
            <label className="field-label">
              Email address
              <span className="input-wrap mt-2"><Mail className="h-4 w-4 text-muted-foreground" /><input className="login-input" type="email" autoComplete="email" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} /></span>
            </label>
            <label className="field-label">
              Password
              <span className="input-wrap mt-2"><LockKeyhole className="h-4 w-4 text-muted-foreground" /><input className="login-input" type="password" autoComplete={isSignup ? 'new-password' : 'current-password'} minLength={isSignup ? 12 : undefined} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} /></span>
              {isSignup && <span className="mt-1 block text-[10px] text-muted-foreground">Use 12–128 characters.</span>}
            </label>
            <button type="submit" disabled={loading} className="primary-button login-submit mt-2 w-full justify-center py-2.5">
              <ArrowRight className="h-4 w-4" />{loading ? 'Please wait…' : isSignup ? 'Create free account' : 'Sign in'}
            </button>
          </form>
          <p className="mt-5 text-center text-xs text-muted-foreground">
            {isSignup ? 'Already have an account? ' : 'New to Cloud Host? '}
            <Link className="text-link" to={isSignup ? '/login' : '/signup'}>{isSignup ? 'Sign in' : 'Create an account'}</Link>
          </p>
        </section>
      </section>

      <footer className="login-footer"><Link to="/" className="text-link">← Back to Cloud Host</Link><Link to="/admin" className="text-link">Administrator sign in</Link></footer>
    </main>
  )
}
