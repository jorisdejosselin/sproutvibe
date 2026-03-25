import { useEffect, useState } from 'react'
import { getSettings } from '../api/settings'
import { AppSettingsContext } from './appSettingsContext'

export default function AppSettingsProvider({ children }) {
  const [settings, setSettings] = useState({})

  useEffect(() => {
    getSettings().then(setSettings).catch(() => {})
  }, [])

  function updateSettings(patch) {
    setSettings(s => ({ ...s, ...patch }))
  }

  return (
    <AppSettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </AppSettingsContext.Provider>
  )
}
