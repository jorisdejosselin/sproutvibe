import { useContext } from 'react'
import { AppSettingsContext } from './appSettingsContext'

export function useAppSettings() {
  return useContext(AppSettingsContext)
}
