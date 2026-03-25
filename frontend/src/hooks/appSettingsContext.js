import { createContext } from 'react'

export const AppSettingsContext = createContext({ settings: {}, updateSettings: () => {} })
