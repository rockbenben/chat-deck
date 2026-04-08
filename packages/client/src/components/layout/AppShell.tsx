import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { chatWs } from '../../lib/ws'
import { ProfileSidebar } from './ProfileSidebar'
import { SessionList } from './SessionList'
import { ChatPanel } from '../chat/ChatPanel'
import { MobileNav } from './MobileNav'
import { SettingsDialog } from './SettingsDialog'
import { useTheme } from '../../hooks/useTheme'
import { useI18n } from '../../i18n'
import { Moon, Sun, Settings } from 'lucide-react'

export function AppShell() {
  const loading = useAppStore(s => s.loading)
  const selectedProfileId = useAppStore(s => s.selectedProfileId)
  const selectedSessionId = useAppStore(s => s.selectedSessionId)
  const profiles = useAppStore(s => s.profiles)
  const providers = useAppStore(s => s.providers)
  const sidebarOpen = useAppStore(s => s.sidebarOpen)
  const loadProfiles = useAppStore(s => s.loadProfiles)
  const loadProviders = useAppStore(s => s.loadProviders)
  const openProfileEditor = useAppStore(s => s.openProfileEditor)

  const { theme, toggle: toggleTheme } = useTheme()
  const { locale, t, setLocale } = useI18n()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initRef = useRef<() => void>()

  // Startup: keep retrying until server responds, then connect WS
  useEffect(() => {
    let cancelled = false

    async function initWithRetry() {
      const RETRY_DELAY = 2000
      let retryCount = 0
      // Retry indefinitely — server may be starting up alongside the client
      while (!cancelled) {
        try {
          await loadProfiles()
          // Server is up — load providers and connect WS
          await loadProviders()
          if (!cancelled) chatWs.connect()
          return
        } catch {
          retryCount++
          if (retryCount > 3) {
            setConnectionError(t.error.cannotReachServer)
          }
          // Server not ready — wait and retry (keep loading=true)
          await new Promise<void>(resolve => {
            retryRef.current = setTimeout(resolve, RETRY_DELAY)
          })
        }
      }
    }

    initRef.current = () => {
      cancelled = false
      initWithRetry()
    }

    initWithRetry()
    return () => {
      cancelled = true
      if (retryRef.current) clearTimeout(retryRef.current)
      chatWs.disconnect()
    }
  }, [loadProfiles, loadProviders])

  useEffect(() => {
    const unsub1 = chatWs.on('profiles-changed', () => { loadProfiles().catch(() => {}) })
    // When WS (re)connects, reload any data that may be stale or missing
    const unsub2 = chatWs.on('__connected', () => {
      const state = useAppStore.getState()
      if (state.profiles.length === 0) loadProfiles().catch(() => {})
      if (state.providers.length === 0) loadProviders()
    })
    return () => { unsub1(); unsub2() }
  }, [loadProfiles, loadProviders])

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4">
        <div className="text-muted-foreground text-sm">
          {connectionError || t.error.connectingToServer}
        </div>
        {connectionError && (
          <button
            onClick={() => {
              setConnectionError(null)
              initRef.current?.()
            }}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90"
          >
            {t.error.retry}
          </button>
        )}
      </div>
    )
  }

  // First launch: no profiles exist
  const isFirstLaunch = profiles.length === 0

  return (
    <div className="h-screen flex flex-col">
      <div className="hidden md:flex items-center justify-between px-4 py-2 border-b bg-background">
        <span className="text-sm font-semibold text-foreground">{t.app.name}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-1.5 rounded-lg hover:bg-accent transition-colors"
            title={t.app.settings}
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={() => setLocale(locale === 'en' ? 'zh' : 'en')}
            className="p-1.5 rounded-lg hover:bg-accent transition-colors text-xs font-medium"
          >
            {locale === 'en' ? '中' : 'EN'}
          </button>
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg hover:bg-accent transition-colors"
            title={theme === 'dark' ? t.app.switchToLight : t.app.switchToDark}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <MobileNav />

      <div className="flex flex-1 overflow-hidden" role="main">
        {/* Profile sidebar — hidden on mobile */}
        <nav aria-label="Profiles" className={`
          ${sidebarOpen ? 'w-56' : 'w-0'}
          transition-all duration-200
          hidden md:block
          flex-shrink-0 overflow-hidden
        `}>
          <ProfileSidebar />
        </nav>

        {/* Session list — hidden on mobile, shown when profile selected */}
        <aside aria-label="Sessions" className={`
          ${selectedProfileId ? 'w-60' : 'w-0'}
          transition-all duration-200
          hidden md:block
          flex-shrink-0 overflow-hidden border-r
        `}>
          <SessionList />
        </aside>

        {/* Main area */}
        <div className="flex-1 min-w-0">
          {isFirstLaunch ? (
            <div className="h-full flex flex-col items-center justify-center gap-6 p-8">
              <h1 className="text-3xl font-bold">{t.app.welcome}</h1>
              <p className="text-muted-foreground text-center max-w-md">
                {t.app.description}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="border border-border text-foreground px-5 py-2.5 rounded-lg font-medium hover:bg-accent transition-colors text-sm"
                >
                  {t.app.configureProviders}
                </button>
                <button
                  onClick={() => openProfileEditor(null)}
                  className="bg-primary text-primary-foreground px-5 py-2.5 rounded-lg font-medium hover:opacity-90 transition-opacity text-sm"
                >
                  {t.app.createProfile}
                </button>
              </div>
            </div>
          ) : selectedSessionId ? (
            <ChatPanel />
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              {selectedProfileId
                ? t.app.selectSession
                : t.app.selectProfile}
            </div>
          )}
        </div>
      </div>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
