import { Server, Plus } from 'lucide-react'

export default function Servers() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Servers</h2>
          <p className="text-muted-foreground">Local worker nodes on your PC</p>
        </div>
        <button className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium">
          <Plus className="h-4 w-4" />
          Add Worker
        </button>
      </div>

      <div className="bg-card border rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Server className="h-5 w-5 text-green-500" />
          <div>
            <div className="font-medium">Local PC Worker</div>
            <div className="text-xs text-muted-foreground">This machine · Healthy</div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">CPU</div>
            <div className="font-medium">Available</div>
          </div>
          <div>
            <div className="text-muted-foreground">RAM</div>
            <div className="font-medium">Local</div>
          </div>
          <div>
            <div className="text-muted-foreground">Storage</div>
            <div className="font-medium">Internal disk</div>
          </div>
          <div>
            <div className="text-muted-foreground">Docker</div>
            <div className="font-medium text-green-600">Ready</div>
          </div>
        </div>
      </div>
    </div>
  )
}
