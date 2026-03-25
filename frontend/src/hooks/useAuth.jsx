import { createContext, useContext, useState, useEffect } from 'react'
import { createDemoSession, getKioskStatus, getMe } from '../api/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [kioskMode, setKioskMode] = useState(false)

  async function _startDemoSession() {
    try {
      const { access_token } = await createDemoSession()
      localStorage.setItem('token', access_token)
      const me = await getMe()
      setUser(me)
    } catch {
      // Demo creation failed (e.g. network error) — fall through to login page
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('token')
    // Fetch kiosk status once; reuse the promise in both branches below
    const kioskPromise = getKioskStatus().catch(() => ({ kiosk_mode: false }))

    kioskPromise.then(d => setKioskMode(d.kiosk_mode))

    const boot = token
      ? getMe()
          .then(setUser)
          .catch(() => {
            localStorage.removeItem('token')
            // Token was invalid/expired — auto-create demo session in kiosk mode
            return kioskPromise.then(d => (d.kiosk_mode ? _startDemoSession() : null))
          })
      : kioskPromise.then(d => (d.kiosk_mode ? _startDemoSession() : null))

    boot.finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = (token, userData) => {
    localStorage.setItem('token', token)
    setUser(userData)
    window.dispatchEvent(new CustomEvent('auth:login'))
  }

  const signOut = () => {
    localStorage.removeItem('token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, kioskMode, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}
