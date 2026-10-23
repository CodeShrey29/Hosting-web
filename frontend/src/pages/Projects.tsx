import { Link } from 'react-router-dom'
import { Plus, Server, Box, Code, Globe } from 'lucide-react'

const mockProjects = [
  { id: '1', name: 'my-python-api', type: 'Python', status: 'Running', icon: Code },
  { id: '2', name: 'website-static', type: 'Website', status: 'Stopped', icon: Globe },
  { id: '3', name: 'mc-server', type: 'Minecraft', status: 'Running', icon: Server },
]

export default function Projects() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Projects</h2>
          <p className="text-muted-foreground">Deployments running on your local PC</p>
        </div>
        <Link
          to="/deploy"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          New Project
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mockProjects.map((p) => (
          <div key={p.id} className="bg-card border rounded-lg p-5 hover:border-primary/50 transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-md bg-secondary flex items-center justify-center">
                <p.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.type}</div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  p.status === 'Running'
                    ? 'bg-green-500/10 text-green-600'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {p.status}
              </span>
              <button className="text-xs text-muted-foreground hover:text-foreground">
                Manage
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
