import { useState, useEffect, useRef } from 'react'
import { getSettings, saveSettings } from '../api/settings'

const STORAGE_KEY = 'theme'

function applyTheme(pref, mqlRef) {
  // clean up previous system listener
  if (mqlRef.current) {
    window.matchMedia('(prefers-color-scheme: dark)')
      .removeEventListener('change', mqlRef.current)
    mqlRef.current = null
  }
  if (pref === 'dark') {
    document.documentElement.classList.add('dark')
  } else if (pref === 'light') {
    document.documentElement.classList.remove('dark')
  } else { // system
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e) => e.matches
      ? document.documentElement.classList.add('dark')
      : document.documentElement.classList.remove('dark')
    mqlRef.current = handler
    mql.addEventListener('change', handler)
    handler(mql) // apply current OS state immediately
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState(
    () => localStorage.getItem(STORAGE_KEY) || 'system'
  )
  const mqlRef = useRef(null)

  useEffect(() => {
    applyTheme(theme, mqlRef)

    const syncFromServer = () => {
      getSettings().then(s => {
        const serverTheme = s.theme || 'system'
        if (serverTheme !== theme) {
          setThemeState(serverTheme)
          localStorage.setItem(STORAGE_KEY, serverTheme)
          applyTheme(serverTheme, mqlRef)
        }
      }).catch(() => {})
    }

    syncFromServer()
    window.addEventListener('auth:login', syncFromServer)

    return () => {
      window.removeEventListener('auth:login', syncFromServer)
      if (mqlRef.current)
        window.matchMedia('(prefers-color-scheme: dark)')
          .removeEventListener('change', mqlRef.current)
    }
  }, []) // once on mount

  const setTheme = (newTheme) => {
    setThemeState(newTheme)
    localStorage.setItem(STORAGE_KEY, newTheme)
    applyTheme(newTheme, mqlRef)
    saveSettings({ theme: newTheme }).catch(() => {})
  }

  return { theme, setTheme }
}
