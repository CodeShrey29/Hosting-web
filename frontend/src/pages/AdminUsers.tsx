import { useEffect, useState } from 'react'
import { AlertCircle, Cloud, LogOut, RefreshCw, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../lib/api'

interface AdminUser {
  id: number
  email: string
  name: string
  status: string
  created_at: string
  plan: string | null
  project_count: number
}

interface UserList {
  users: AdminUser[]
  total_users: number
  active_users: number
}

export default function AdminUsers({ email, onLogout }: { email?: string; onLogout: () => void }) {
  const [data, setData] = useState<UserList | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const loadUsers = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await apiFetch('/api/admin/users')
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not load registered users.')
      setData(result as UserList)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load registered users.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadUsers() }, [])

  return (
    <main className="min-h-dvh bg-background">
      <header className="topbar sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border px-4 sm:px-8">
        <Link to="/admin/panel" className="flex items-center gap-3">
          <span className="brand-mark flex h-9 w-9 items-center justify-center rounded-xl"><Cloud className="h-4 w-4 text-white" /></span>
          <span><span className="block text-sm font-semibold">Cloud Host</span><span className="block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Administrator panel</span></span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-muted-foreground sm:inline">{email}</span>
          <button type="button" onClick={onLogout} className="secondary-button"><LogOut className="h-3.5 w-3.5" />Sign out</button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="eyebrow"><span className="status-dot" />Administration</div>
            <h1 className="page-title mt-2">Users</h1>
            <p className="mt-1.5 text-[13px] text-muted-foreground">Registered customer accounts and their workspace activity.</p>
          </div>
          <button type="button" onClick={() => void loadUsers()} disabled={loading} className="secondary-button"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />Refresh</button>
        </div>

        {error && <div role="alert" className="inline-alert inline-alert-error"><AlertCircle className="h-4 w-4" /><span>{error}</span></div>}

        <section className="grid gap-4 sm:grid-cols-2">
          <article className="panel flex items-center gap-4 p-5">
            <span className="metric-icon metric-icon-cyan"><Users className="h-4 w-4" /></span>
            <div><p className="text-xs text-muted-foreground">Registered users</p><p className="mt-1 text-2xl font-semibold">{loading ? '—' : data?.total_users ?? 0}</p></div>
          </article>
          <article className="panel flex items-center gap-4 p-5">
            <span className="metric-icon metric-icon-blue"><Users className="h-4 w-4" /></span>
            <div><p className="text-xs text-muted-foreground">Active accounts</p><p className="mt-1 text-2xl font-semibold">{loading ? '—' : data?.active_users ?? 0}</p></div>
          </article>
        </section>

        <section className="panel overflow-hidden">
          <div className="panel-heading"><div><h2 className="section-title">Customer accounts</h2><p className="section-description">Account details and project counts. The administrator has no customer purchasing flow.</p></div></div>
          {loading && !data ? <p className="px-5 py-8 text-sm text-muted-foreground">Loading users…</p> : data?.users.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-xs">
                <thead className="border-t border-border bg-background/50 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr><th className="px-5 py-3 font-medium">Email</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Plan</th><th className="px-4 py-3 font-medium">Projects</th><th className="px-5 py-3 font-medium">Joined</th></tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {data.users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-5 py-4 font-medium">{user.email}</td>
                      <td className="px-4 py-4"><span className="subtle-tag">{user.status}</span></td>
                      <td className="px-4 py-4 text-muted-foreground">{user.plan || 'Unassigned'}</td>
                      <td className="px-4 py-4">{user.project_count}</td>
                      <td className="px-5 py-4 text-muted-foreground">{new Date(user.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="border-t border-border px-5 py-10 text-center">
              <Users className="mx-auto h-5 w-5 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">No customer accounts yet</p>
              <p className="mt-1 text-xs text-muted-foreground">New signups will appear here.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
