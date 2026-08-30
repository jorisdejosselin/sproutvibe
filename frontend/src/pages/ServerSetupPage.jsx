import { useState, useEffect } from 'react'
import { setServerUrl } from '../api/client'
import {
  buildDiagnosticReport,
  classifyConnectionError,
  preflightServerUrl,
} from '../api/diagnostics'
import axios from 'axios'

async function testConnection(url) {
  const base = url.replace(/\/$/, '')
  const res = await axios.get(`${base}/api/`, { timeout: 6000 })
  // Verify it's actually a Sprout server
  if (!res.data?.message?.toLowerCase().includes('sprout') &&
      !res.data?.message?.toLowerCase().includes('api')) {
    throw new Error('URL responded but does not look like a Sprout server.')
  }
  return true
}

export default function ServerSetupPage({ onConnected }) {
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState(null) // null | 'checking' | 'ok' | 'error'
  const [errorMsg, setErrorMsg] = useState('')
  const [errorDetail, setErrorDetail] = useState('')
  const [report, setReport] = useState('')
  const [showReport, setShowReport] = useState(false)
  const [copied, setCopied] = useState(false)
  const [autoDetected] = useState(false)

  // Warn about a URL that cannot possibly work from this context (see #32:
  // an http:// server is unreachable from the https:// Capacitor WebView)
  // before the user hits Connect and gets an opaque failure.
  const preflight = status === 'checking' ? null : preflightServerUrl(url)

  // Try auto-detecting: the frontend is probably served from the same origin as the API.
  // Skip localhost — that's the Capacitor WebView's own origin, not a real Sprout server.
  // When auto-detected, connect silently without requiring user interaction.
  useEffect(() => {
    const origin = window.location.origin
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) return
    axios.get(`${origin}/api/`, { timeout: 3000 })
      .then((res) => {
        const msg = res.data?.message?.toLowerCase() || ''
        if (!msg.includes('sprout') && !msg.includes('api')) return
        setServerUrl(origin)
        onConnected()
      })
      .catch(() => {})
  }, [onConnected])

  const handleConnect = async (e) => {
    e?.preventDefault()
    if (!url.trim()) return
    setStatus('checking')
    setErrorMsg('')
    try {
      await testConnection(url.trim())
      setServerUrl(url.trim())
      setStatus('ok')
      setTimeout(() => onConnected(), 400)
    } catch (err) {
      const target = url.trim()
      const diagnosis = classifyConnectionError(err, target)
      const text = buildDiagnosticReport({ url: target, err })
      setStatus('error')
      setErrorMsg(diagnosis.title)
      setErrorDetail(diagnosis.detail)
      setReport(text)
      setShowReport(false)
      setCopied(false)
      // Also to the console so it survives into adb logcat / remote debugging,
      // which is the only way to see this on a device you do not own.
      console.warn('[sprout] server connection failed\n' + text)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 w-full max-w-md">

        <div className="text-center mb-8">
          <div className="text-6xl mb-3">🌱</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Welcome to SproutVibe</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Enter the URL of your SproutVibe server to get started</p>
        </div>

        {autoDetected && status !== 'error' && (
          <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-xl p-3 mb-4 flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
            <span>✓</span>
            <span>Sprout server detected at <span className="font-mono font-medium">{url}</span></span>
          </div>
        )}

        <form onSubmit={handleConnect} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Server URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setStatus(null) }}
              placeholder="https://sprout.yourdomain.com"
              required
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              This is the address where you're hosting Sprout, e.g. <span className="font-mono">http://192.168.1.100:3000</span>
            </p>
          </div>

          {preflight && status !== 'error' && (
            <div className={`rounded-xl p-3 text-sm border ${
              preflight.severity === 'error'
                ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                : 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'
            }`}>
              <p className="font-medium">⚠ {preflight.title}</p>
              <p className="mt-1 opacity-90">{preflight.detail}</p>
            </div>
          )}

          {status === 'error' && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-400">
              <p className="font-medium">✗ {errorMsg}</p>
              {errorDetail && <p className="mt-1 opacity-90">{errorDetail}</p>}
              {report && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowReport((v) => !v)}
                    className="mt-2 text-xs underline hover:no-underline"
                  >
                    {showReport ? 'Hide' : 'Show'} connection details
                  </button>
                  {showReport && (
                    <>
                      <pre className="mt-2 p-2 rounded-lg bg-red-100/60 dark:bg-red-950/40 text-[11px] leading-relaxed overflow-x-auto whitespace-pre">{report}</pre>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(report)
                            .then(() => setCopied(true))
                            .catch(() => setCopied(false))
                        }}
                        className="mt-2 text-xs underline hover:no-underline"
                      >
                        {copied ? 'Copied — paste this into a bug report' : 'Copy details'}
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {status === 'ok' && (
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-xl p-3 text-sm text-green-700 dark:text-green-400">
              ✓ Connected! Redirecting…
            </div>
          )}

          <button
            type="submit"
            disabled={status === 'checking' || status === 'ok' || !url.trim()}
            className="w-full bg-green-600 text-white py-3 rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {status === 'checking' ? 'Connecting…' : status === 'ok' ? 'Connected!' : 'Connect to server'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-6">
          Self-hosting Sprout?{' '}
          <a href="https://github.com" className="text-green-600 dark:text-green-400 hover:underline">View setup docs</a>
        </p>
      </div>
    </div>
  )
}
