import { Search, Moon, Sun, Menu, Command } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const [dark, setDark] = useState(true)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  return (
    <header className="h-14 border-b bg-card/50 backdrop-blur-xl flex items-center gap-3 px-4 shrink-0">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg hover:bg-accent"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex-1 max-w-sm">
        <button className="w-full flex items-center gap-2 px-3 py-1.5 bg-secondary/50 hover:bg-secondary rounded-lg text-sm text-muted-foreground transition-colors">
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Search...</span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-background rounded text-[10px] font-medium border">
            <Command className="h-3 w-3" />K
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => setDark((d) => !d)}
          className="p-2 rounded-lg hover:bg-accent transition-colors"
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white text-xs font-medium">
          SK
        </div>
      </div>
    </header>
  )
}
