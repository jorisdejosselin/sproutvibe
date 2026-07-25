import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import AppSettingsProvider from './hooks/AppSettingsContext.jsx'
import { useTheme } from './hooks/useTheme'
import { getServerUrl } from './api/client'
import Layout from './components/Layout'
import ServerSetupPage from './pages/ServerSetupPage'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import AddPlantPage from './pages/AddPlantPage'
import PlantDetailPage from './pages/PlantDetailPage'
import JournalEntryPage from './pages/JournalEntryPage'
import SettingsPage from './pages/SettingsPage'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center min-h-screen bg-white dark:bg-gray-900 text-gray-400 dark:text-gray-500">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { theme, setTheme } = useTheme()
  const [serverConfigured, setServerConfigured] = useState(() => !!getServerUrl())

  if (!serverConfigured) {
    return <ServerSetupPage onConnected={() => setServerConfigured(true)} />
  }

  return (
    <AuthProvider>
      <AppSettingsProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/plants/new" element={<ProtectedRoute><AddPlantPage /></ProtectedRoute>} />
          <Route path="/plants/:id" element={<ProtectedRoute><PlantDetailPage /></ProtectedRoute>} />
          <Route path="/plants/:id/journal/:entryId" element={<ProtectedRoute><JournalEntryPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage theme={theme} setTheme={setTheme} /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </AppSettingsProvider>
    </AuthProvider>
  )
}
