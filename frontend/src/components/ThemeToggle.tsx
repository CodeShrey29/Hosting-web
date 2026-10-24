import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../lib/theme'

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { dark, toggleTheme } = useTheme()

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`}
      onClick={toggleTheme}
      aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`}
      title={`Switch to ${dark ? 'light' : 'dark'} mode`}
      aria-pressed={dark}
    >
      <span className="theme-toggle-icon">{dark ? <Sun size={14} /> : <Moon size={14} />}</span>
      <span className="theme-toggle-label">{dark ? 'Light' : 'Dark'} mode</span>
    </button>
  )
}
