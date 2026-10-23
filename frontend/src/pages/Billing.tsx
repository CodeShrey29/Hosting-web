export default function Billing() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Billing</h2>
      <p className="text-muted-foreground">Local mode — no external payments</p>

      <div className="bg-card border rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <div className="font-medium">Free Plan</div>
            <div className="text-sm text-muted-foreground">512 MB RAM · 1 GB Storage</div>
          </div>
          <span className="text-xs bg-green-500/10 text-green-600 px-2 py-1 rounded-full">Active</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Billing is disabled in local PC mode. All resources are managed on this machine.
        </p>
      </div>
    </div>
  )
}
