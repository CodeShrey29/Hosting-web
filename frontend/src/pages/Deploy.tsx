import { useSearchParams } from 'react-router-dom'
import { Upload, Github, Box } from 'lucide-react'

export default function Deploy() {
  const [params] = useSearchParams()
  const type = params.get('type') || 'custom'

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">
          Deploy {type.charAt(0).toUpperCase() + type.slice(1)}
        </h2>
        <p className="text-muted-foreground">
          Local deployment on your PC. No external services required.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button className="border rounded-lg p-6 text-left hover:border-primary transition-colors">
          <Upload className="h-6 w-6 mb-3" />
          <div className="font-medium">Upload ZIP</div>
          <div className="text-xs text-muted-foreground">From your computer</div>
        </button>
        <button className="border rounded-lg p-6 text-left hover:border-primary transition-colors">
          <Github className="h-6 w-6 mb-3" />
          <div className="font-medium">GitHub</div>
          <div className="text-xs text-muted-foreground">Connect repository</div>
        </button>
        <button className="border rounded-lg p-6 text-left hover:border-primary transition-colors">
          <Box className="h-6 w-6 mb-3" />
          <div className="font-medium">Docker Image</div>
          <div className="text-xs text-muted-foreground">Pull or upload</div>
        </button>
      </div>

      <div className="bg-card border rounded-lg p-6">
        <h3 className="font-semibold mb-4">Resource Limits (Free Plan)</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            RAM: <span className="font-medium">512 MB</span>
          </div>
          <div>
            Storage: <span className="font-medium">1 GB</span>
          </div>
          <div>
            CPU: <span className="font-medium">Limited</span>
          </div>
          <div>
            Transfer: <span className="font-medium">Limited</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Limits are enforced locally on your PC.
        </p>
      </div>
    </div>
  )
}
