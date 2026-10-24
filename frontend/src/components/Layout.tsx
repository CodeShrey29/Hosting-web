import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import CommandPalette from './CommandPalette'

export default function Layout({ onLogout, accountEmail }: { onLogout?: () => void; accountEmail?: string }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const location = useLocation()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', window.localStorage.getItem('cloud-host-theme') === 'dark')
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1023px)')
    const updateViewport = () => {
      setIsMobile(mediaQuery.matches)
      if (!mediaQuery.matches) setSidebarOpen(false)
    }
    updateViewport()
    mediaQuery.addEventListener('change', updateViewport)
    return () => mediaQuery.removeEventListener('change', updateViewport)
  }, [])

  useEffect(() => {
    drawerRef.current?.toggleAttribute('inert', isMobile && !sidebarOpen)
  }, [isMobile, sidebarOpen])

  useEffect(() => {
    if (!sidebarOpen || !isMobile) return

    const drawer = drawerRef.current
    const getFocusableElements = () =>
      drawer?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []
    const firstFocusable = getFocusableElements()[0]
    firstFocusable?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSidebarOpen(false)
        return
      }
      if (event.key !== 'Tab') return

      const focusable = getFocusableElements()
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      menuButtonRef.current?.focus()
    }
  }, [isMobile, sidebarOpen])

  return (
    <div className="app-shell flex h-dvh min-h-[100dvh] overflow-hidden bg-background">
      <button
        type="button"
        tabIndex={sidebarOpen ? 0 : -1}
        aria-label="Close navigation"
        aria-hidden={!sidebarOpen}
        disabled={!sidebarOpen}
        className={`drawer-backdrop fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden ${sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={() => setSidebarOpen(false)}
      />

      <div
        id="primary-navigation"
        ref={drawerRef}
        role={sidebarOpen ? 'dialog' : undefined}
        aria-modal={sidebarOpen || undefined}
        aria-label={sidebarOpen ? 'Main navigation' : undefined}
        aria-hidden={isMobile && !sidebarOpen}
        className={`fixed inset-y-0 left-0 z-50 w-[min(86vw,280px)] transform shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:relative lg:w-64 lg:translate-x-0 lg:shadow-none ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar onNavigate={() => setSidebarOpen(false)} />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          menuButtonRef={menuButtonRef}
          menuExpanded={sidebarOpen}
          onMenuClick={() => setSidebarOpen(true)}
          onLogout={onLogout}
          accountEmail={accountEmail}
        />
        <main className="page-scroll flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8 xl:px-10">
          <div key={location.key} className="page-transition">
            <Outlet />
          </div>
        </main>
      </div>

      <CommandPalette />
    </div>
  )
}
