import { useEffect, useState } from 'react'

const THEME_KEY = 'cloud-host-theme'
const THEME_EVENT = 'cloud-host:theme-change'

function storedTheme() {
  return window.localStorage.getItem(THEME_KEY) === 'dark'
}

export function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark)
  window.localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light')
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: dark }))
}

export function useTheme() {
  const [dark, setDark] = useState(storedTheme)

  useEffect(() => {
    const syncTheme = (event: Event) => {
      const next = event instanceof CustomEvent ? Boolean(event.detail) : storedTheme()
      document.documentElement.classList.toggle('dark', next)
      setDark(next)
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === THEME_KEY || event.key === null) syncTheme(event)
    }

    document.documentElement.classList.toggle('dark', dark)
    window.addEventListener(THEME_EVENT, syncTheme)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener(THEME_EVENT, syncTheme)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  return {
    dark,
    toggleTheme: () => applyTheme(!dark),
  }
}
