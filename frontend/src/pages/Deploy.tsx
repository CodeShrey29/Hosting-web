import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Upload, Github, Box, Check } from 'lucide-react'

const steps = ['Source', 'Configure', 'Review']

export default function Deploy() {
  const [params] = useSearchParams()
  const type = params.get('type') || 'custom'
  const [step, setStep] = useState(0)

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

      <div className="flex items-center gap-4 text-sm">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium ${
                i <= step ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
              }`}
            >
              {i < step ? <Check className="h-3 w-3" /> : i + 1}
            </div>
            <span className={i === step ? 'font-medium' : 'text-muted-foreground'}>{s}</span>
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => setStep(1)}
            className="border rounded-lg p-6 text-left hover:border-primary transition-colors"
          >
            <Upload className="h-6 w-6 mb-3" />
            <div className="font-medium">Upload ZIP</div>
            <div className="text-xs text-muted-foreground">From your computer</div>
          </button>
          <button
            onClick={() => setStep(1)}
            className="border rounded-lg p-6 text-left hover:border-primary transition-colors"
          >
            <Github className="h-6 w-6 mb-3" />
            <div className="font-medium">GitHub</div>
            <div className="text-xs text-muted-foreground">Connect repository</div>
          </button>
          <button
            onClick={() => setStep(1)}
            className="border rounded-lg p-6 text-left hover:border-primary transition-colors"
          >
            <Box className="h-6 w-6 mb-3" />
            <div className="font-medium">Docker Image</div>
            <div className="text-xs text-muted-foreground">Pull or upload</div>
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="bg-card border rounded-lg p-6 space-y-4">
          <div>
            <label className="text-sm font-medium">Project Name</label>
            <input
              className="mt-1 w-full bg-background border rounded-md px-3 py-2 text-sm"
              placeholder="my-awesome-app"
            />
          </div>
          <div>
            <label className="text-sm font-medium">RAM Limit</label>
            <select className="mt-1 w-full bg-background border rounded-md px-3 py-2 text-sm">
              <option>512 MB (Free)</option>
              <option>1 GB</option>
              <option>2 GB</option>
            </select>
          </div>
          <button
            onClick={() => setStep(2)}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium"
          >
            Continue
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="bg-card border rounded-lg p-6 space-y-4">
          <h3 className="font-semibold">Review</h3>
          <div className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <span>{type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Location</span>
              <span>Local PC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Plan</span>
              <span>Free (512 MB)</span>
            </div>
          </div>
          <button className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium">
            Deploy on this PC
          </button>
        </div>
      )}
    </div>
  )
}
