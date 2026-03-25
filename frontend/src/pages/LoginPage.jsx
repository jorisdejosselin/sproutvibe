import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login, register, getMe, createDemoSession } from '../api/auth'
import { useAuth } from '../hooks/useAuth'
import { clearServerUrl } from '../api/client'

export default function LoginPage() {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, kioskMode } = useAuth()
  const navigate = useNavigate()

  const handleTryDemo = async () => {
    setError('')
    setLoading(true)
    try {
      const { access_token } = await createDemoSession()
      localStorage.setItem('token', access_token)
      const me = await getMe()
      signIn(access_token, me)
      navigate('/')
    } catch {
      setError('Could not start demo session. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'register') await register(form.name, form.email, form.password)
      const { access_token } = await login(form.email, form.password)
      localStorage.setItem('token', access_token)  // store before getMe so the request is authenticated
      const me = await getMe()
      signIn(access_token, me)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-green-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-2">🌱</div>
          <h1 className="text-2xl font-bold text-green-700">SproutVibe</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Your personal plant care companion</p>
        </div>

        <div className="flex rounded-lg bg-gray-100 dark:bg-gray-700 p-1 mb-6">
          {['login', 'register'].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === m ? 'bg-white dark:bg-gray-600 text-green-700 dark:text-gray-100 shadow' : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {m === 'login' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <input
              type="text"
              placeholder="Your name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => { setForm({ ...form, email: e.target.value }); setError('') }}
            required
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
          />
          <input
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) => { setForm({ ...form, password: e.target.value }); setError('') }}
            required
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
          />
          {error && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm animate-shake">
              <span className="text-base leading-none mt-0.5">⚠️</span>
              <span>{error}</span>
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        {kioskMode && (
          <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center mb-3">
              Just exploring? No sign-in required.
            </p>
            <button
              onClick={handleTryDemo}
              disabled={loading}
              className="w-full bg-amber-500 text-white py-2.5 rounded-xl font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              🧪 Try the demo
            </button>
          </div>
        )}

        <div className="mt-4 text-center">
          <button
            onClick={() => { clearServerUrl(); window.location.reload() }}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Change server URL
          </button>
        </div>
      </div>
    </div>
  )
}
