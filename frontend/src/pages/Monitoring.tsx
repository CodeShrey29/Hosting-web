export default function Monitoring() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Monitoring</h2>
      <p className="text-muted-foreground">Real-time metrics from your local PC</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border rounded-lg p-6">
          <h3 className="font-semibold mb-4">CPU Usage</h3>
          <div className="h-32 flex items-end gap-1">
            {[40, 55, 30, 70, 45, 60, 35, 50, 65, 40].map((h, i) => (
              <div key={i} className="flex-1 bg-primary/60 rounded-t" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
        <div className="bg-card border rounded-lg p-6">
          <h3 className="font-semibold mb-4">Memory</h3>
          <div className="text-3xl font-bold">0.8 GB</div>
          <div className="text-sm text-muted-foreground">of local available</div>
        </div>
      </div>
    </div>
  )
}
