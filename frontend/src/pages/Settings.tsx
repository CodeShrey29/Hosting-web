export default function Settings() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Settings</h2>

      <div className="bg-card border rounded-lg p-6 space-y-4">
        <div>
          <div className="font-medium">Mode</div>
          <div className="text-sm text-muted-foreground">Local PC</div>
        </div>
        <div>
          <div className="font-medium">Theme</div>
          <div className="text-sm text-muted-foreground">Dark / Light (toggle in header)</div>
        </div>
        <div>
          <div className="font-medium">Storage Root</div>
          <div className="text-sm text-muted-foreground">./data (on this PC)</div>
        </div>
      </div>
    </div>
  )
}
