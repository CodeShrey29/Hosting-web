import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import Deploy from './pages/Deploy'
import Servers from './pages/Servers'
import Monitoring from './pages/Monitoring'
import Billing from './pages/Billing'
import Settings from './pages/Settings'
import Login from './pages/Login'
import { apiFetch, setCsrfToken } from './lib/api'

export default function App() {
  const [auth, setAuth] = useState<{ loading: boolean; authenticated: boolean; email?: string; mode?: string; authRequired?: boolean; configurationError?: string }>({
    loading: true,
    authenticated: false,
  })

  useEffect(() => {
    apiFetch('/api/auth/me')
      .then(async (response) => {
        const data = await response.json()
        if (response.status === 503) {
          setAuth({ loading: false, authenticated: false, mode: data.mode, authRequired: data.auth_required, configurationError: data.configuration_error || data.error })
          return
        }
        if (!response.ok) throw new Error(data.error || 'Could not verify session.')
        setCsrfToken(data.csrf_token || null)
        setAuth({ loading: false, authenticated: Boolean(data.authenticated), email: data.email, mode: data.mode, authRequired: data.auth_required })
      })
      .catch(() => setAuth({ loading: false, authenticated: false, configurationError: 'Could not reach the control plane. Refresh after the service is available.' }))
    const handleUnauthorized = () => setAuth({ loading: false, authenticated: false, mode: 'render' })
    window.addEventListener('cloud-host:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('cloud-host:unauthorized', handleUnauthorized)
  }, [])

  const logout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' })
    } finally {
      setCsrfToken(null)
      setAuth({ loading: false, authenticated: false })
    }
  }

  if (auth.loading) {
    return <main className="auth-loading"><span className="brand-mark flex h-10 w-10 items-center justify-center rounded-xl"><span className="h-2 w-2 animate-pulse rounded-full bg-white" /></span><p className="mt-4 text-xs text-muted-foreground">Connecting to your control plane…</p></main>
  }

  if (!auth.authenticated) {
    return <Login configurationError={auth.configurationError} onAuthenticated={(email, _csrfToken, mode) => setAuth({ loading: false, authenticated: true, email, mode, authRequired: true })} />
  }

  return (
    <Routes>
      <Route path="/" element={<Layout onLogout={auth.authRequired ? () => void logout() : undefined} accountEmail={auth.email} />}>
        <Route index element={<Dashboard />} />
        <Route path="projects" element={<Projects />} />
        <Route path="deploy" element={<Deploy />} />
        <Route path="servers" element={<Servers />} />
        <Route path="monitoring" element={<Monitoring />} />
        <Route path="billing" element={<Billing />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Dashboard />} />
      </Route>
    </Routes>
  )
}
