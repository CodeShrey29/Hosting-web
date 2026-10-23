import { useEffect, useState } from 'react'
import { AlertCircle, Check, CreditCard, HardDrive, Layers3, MemoryStick, ShieldCheck, Zap } from 'lucide-react'
import { apiFetch } from '../lib/api'

interface BillingStatus {
  plan?: { name?: string; ram_mb?: number; storage_mb?: number; cpu_limit?: number; max_deployments?: number; transfer_gb?: number; price_inr?: number | null }
  usage?: { used_ram?: number; used_cpu?: number; used_storage?: number; deployments?: number }
}

export default function Billing() {
  const [data, setData] = useState<BillingStatus | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    apiFetch('/api/status')
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not retrieve plan details.')
        setData(await response.json())
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not retrieve plan details.'))
  }, [])

  const plan = data?.plan
  const usage = data?.usage
  const limits = [
    { label: 'Memory', value: plan?.ram_mb === undefined ? '—' : `${plan.ram_mb} MB`, used: usage?.used_ram === undefined ? '—' : `${usage.used_ram} MB reserved`, icon: MemoryStick },
    { label: 'Storage', value: plan?.storage_mb === undefined ? '—' : `${plan.storage_mb} MB`, used: usage?.used_storage === undefined ? '—' : `${usage.used_storage} MB reserved`, icon: HardDrive },
    { label: 'CPU limit', value: plan?.cpu_limit === undefined ? '—' : `${plan.cpu_limit} vCPU`, used: usage?.used_cpu === undefined ? '—' : `${usage.used_cpu} vCPU reserved`, icon: Zap },
    { label: 'Deployments', value: plan?.max_deployments === undefined ? '—' : `${plan.max_deployments}`, used: usage?.deployments === undefined ? '—' : `${usage.deployments} running`, icon: Layers3 },
  ]

  return (
    <div className="page-content space-y-6">
      <div>
        <div className="eyebrow"><span className="status-dot" />Account</div>
        <h1 className="page-title mt-2">Plans & billing</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">Resource entitlements currently configured for this local account.</p>
      </div>

      {error && <div role="alert" className="inline-alert inline-alert-error"><AlertCircle className="h-4 w-4" /><span>{error}</span></div>}

      <section className="billing-plan-card panel overflow-hidden">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-3.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-300/10 text-cyan-300"><CreditCard className="h-[18px] w-[18px]" /></span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold">{plan?.name || 'Current plan'}</h2>
                <span className="subtle-tag"><Check className="h-3 w-3" />Active locally</span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">Plan limits are returned by the backend and enforced during deployment.</p>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-xl font-semibold tracking-tight">{plan?.price_inr === 0 ? 'Free' : plan?.price_inr == null ? 'Not configured' : `₹${plan.price_inr}`}<span className="ml-1 text-[10px] font-normal text-muted-foreground">{plan?.price_inr ? '/ month' : ''}</span></p>
            <p className="mt-1 text-[10px] text-muted-foreground">{plan?.transfer_gb === undefined ? 'Transfer allowance unavailable' : `${plan.transfer_gb} GB transfer allowance configured`}</p>
          </div>
        </div>
        <div className="border-t border-border/80 bg-background/30 px-5 py-3.5 sm:px-6">
          <p className="flex items-start gap-2 text-[10px] leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />
            Local mode does not process payments or create subscriptions. Prices and limits shown here are configuration values, not an invoice or payment status.
          </p>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="panel-heading">
          <div><h2 className="section-title">Plan limits & allocation</h2><p className="section-description">Running workloads reserve resources against the plan.</p></div>
          <span className="subtle-tag">Backend values</span>
        </div>
        <div className="grid gap-px border-t border-border bg-border/70 sm:grid-cols-2">
          {limits.map(({ label, value, used, icon: Icon }) => (
            <div key={label} className="flex items-center gap-3 bg-card p-4 sm:p-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-secondary/60 text-muted-foreground"><Icon className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1"><p className="text-[10px] text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>
              <span className="text-right text-[10px] text-muted-foreground">{used}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="inline-alert inline-alert-neutral items-start">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="text-[11px] leading-relaxed">Network transfer is a configured plan allowance only; the current backend does not report actual transfer usage. Upgrade, invoices, payment methods, and recurring billing are not available in this local build.</p>
      </section>
    </div>
  )
}
