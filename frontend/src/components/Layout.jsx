import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getVersion } from '../api/settings'
import { useAppSettings } from '../hooks/useAppSettings'
import DevToolbar from './DevToolbar'

function GitHubIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-4 h-4 fill-current" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
        0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13
        -.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87
        2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95
        0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21
        2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04
        2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15
        0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01
        1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}

function DemoBanner() {
  const { user, kioskMode } = useAuth()
  const [dismissed, setDismissed] = useState(false)
  const navigate = useNavigate()
  if (!kioskMode || !user?.is_demo || dismissed) return null
  return (
    <div className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2 flex items-start justify-between gap-4">
      <p className="flex-1 text-sm text-amber-800 dark:text-amber-300">
        🧪 <strong>Demo mode</strong> — You&apos;re exploring SproutVibe. All data resets nightly.
        {' '}For plant search and AI suggestions, add your own API keys in{' '}
        <button onClick={() => navigate('/settings')} className="underline font-medium">Settings</button>.
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="text-amber-500 hover:text-amber-700 text-xs shrink-0 mt-0.5"
      >
        Dismiss
      </button>
    </div>
  )
}

const NAV = [
  { to: '/', icon: '🏠', label: 'Home' },
  { to: '/plants/new', icon: '➕', label: 'Add plant' },
  { to: '/settings', icon: '⚙️', label: 'Settings' },
]

export default function Layout({ children }) {
  const { signOut, user } = useAuth()
  const location = useLocation()
  const [appInfo, setAppInfo] = useState(null)
  const { settings: appSettings } = useAppSettings()

  useEffect(() => {
    getVersion().then(setAppInfo).catch(() => {})
  }, [])

  const showSourceLink = appSettings.show_source_link !== 'false'
  const showVersion = appSettings.show_version !== 'false'
  const showFooter = showSourceLink || showVersion

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">

      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex flex-col w-56 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 fixed inset-y-0 left-0 z-10">
        <div className="px-5 py-6">
          <span className="text-green-700 font-bold text-xl flex items-center gap-2">
            🌱 SproutVibe
          </span>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {NAV.map(({ to, icon, label }) => {
            const active = location.pathname === to
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <span className="text-base">{icon}</span>
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="px-5 py-5 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-1 truncate">{user?.email}</p>
          <button
            onClick={signOut}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-red-500 transition-colors"
          >
            Sign out
          </button>
        </div>

        {showFooter && (
          <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center gap-3">
            {showSourceLink && (
              <a
                href={appInfo?.source_url ?? 'https://github.com/jorisdejosselin/sproutvibe'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                title="View source on GitHub"
              >
                <GitHubIcon />
              </a>
            )}
            {showVersion && appInfo?.version && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                v{appInfo.version}
              </span>
            )}
          </div>
        )}
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col md:ml-56">

        {/* Mobile top bar */}
        <header className="md:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex justify-between items-center sticky top-0 z-10" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
          <span className="text-green-700 font-bold text-lg">🌱 SproutVibe</span>
          <button onClick={signOut} className="text-gray-400 hover:text-gray-600 text-sm">
            Sign out
          </button>
        </header>

        <DemoBanner />

        <main className="flex-1 pb-20 md:pb-0">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex z-10" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {NAV.map(({ to, icon, label }) => {
            const active = location.pathname === to
            return (
              <Link
                key={to}
                to={to}
                className={`flex-1 flex flex-col items-center py-2 text-xs gap-0.5 ${
                  active ? 'text-green-700 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                <span className="text-xl">{icon}</span>
                {label}
              </Link>
            )
          })}
        </nav>
      </div>
      {(import.meta.env.DEV || import.meta.env.VITE_DEV_TOOLBAR === 'true') && <DevToolbar onRefresh={() => window.location.reload()} />}
    </div>
  )
}
