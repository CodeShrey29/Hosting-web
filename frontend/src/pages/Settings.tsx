export default function Settings() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Settings</h2>

      <div className="bg-card border rounded-lg divide-y">
        <div className="p-6">
          <div className="font-medium">Deployment Mode</div>
          <div className="text-sm text-muted-foreground mt-1">Local PC — all data stays on this machine</div>
        </div>
        <div className="p-6">
          <div className="font-medium">Theme</div>
          <div className="text-sm text-muted-foreground mt-1">
            Toggle dark/light from the header sun/moon icon
          </div>
        </div>
        <div className="p-6">
          <div className="font-medium">Data Directory</div>
          <div className="text-sm text-muted-foreground mt-1">./data (created automatically on this PC)</div>
        </div>
        <div className="p-6">
          <div className="font-medium">Start Command</div>
          <code className="text-sm bg-secondary px-2 py-1 rounded">python hosting.py</code>
        </div>
      </div>
    </div>
  )
}
