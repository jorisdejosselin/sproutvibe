import { useEffect, useState } from 'react'
import { getSettings, saveSettings, getVersion } from '../api/settings'
import { useAppSettings } from '../hooks/useAppSettings'
import { getSpecies, getAiCare } from '../api/plants'
import { getServerUrl, clearServerUrl } from '../api/client'
import { getVapidPublicKey, subscribeUser, unsubscribeUser } from '../api/notifications'
import { updateMe } from '../api/auth'
import { useAuth } from '../hooks/useAuth'

// Each integration is defined here — add new ones by extending this array
const INTEGRATIONS = [
  {
    id: 'perenual',
    name: 'Perenual',
    description: 'Adds watering, sunlight, and cycle data to search results. Free tier covers ~3,000 species (100 req/day); paid plans unlock the full 10,000+.',
    signupUrl: 'https://perenual.com/',
    docsUrl: 'https://perenual.com/api-doc',
    fields: [
      { key: 'perenual_api_key', label: 'API Key', placeholder: 'sk-...', secret: true },
    ],
    test: async () => { await getSpecies('1', 'perenual') },
  },
  {
    id: 'floracodex',
    name: 'FloraCodex',
    description: 'Optional second species database with 400,000+ plants and photos. Used by plant-it. Merges with iNaturalist results for even broader coverage.',
    signupUrl: 'https://floracodex.com/',
    docsUrl: 'https://floracodex.com/docs/reference',
    fields: [
      { key: 'floracodex_api_key', label: 'API Key', placeholder: 'fc-...', secret: true },
    ],
    test: async () => { await getSpecies('609e2c34ca233f0aecfa9707', 'floracodex') },
  },
]

const AI_PROVIDERS = {
  anthropic: {
    name: 'Anthropic',
    model: 'Claude Haiku 4.5',
    key: 'anthropic_api_key',
    placeholder: 'sk-ant-...',
    signupUrl: 'https://console.anthropic.com/',
  },
  openai: {
    name: 'OpenAI',
    model: 'GPT-5.6 Luna',
    key: 'openai_api_key',
    placeholder: 'sk-...',
    signupUrl: 'https://platform.openai.com/api-keys',
  },
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

function NotificationsSection() {
  const hasNotification = 'Notification' in window
  const isSecure = window.isSecureContext
  const [permission, setPermission] = useState(hasNotification ? Notification.permission : 'unsupported')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(null)

  const handleEnable = async () => {
    setBusy(true)
    setStatus(null)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') { setStatus('Permission denied'); return }
      const vapidKey = await getVapidPublicKey()
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
      await subscribeUser(sub)
      setStatus('Notifications enabled!')
    } catch (err) {
      setStatus('Failed: ' + (err.message || 'unknown error'))
    } finally {
      setBusy(false)
    }
  }

  const handleDisable = async () => {
    setBusy(true)
    setStatus(null)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await unsubscribeUser(sub.endpoint)
        await sub.unsubscribe()
      }
      setPermission('default')
      setStatus('Notifications disabled.')
    } catch (err) {
      setStatus('Failed: ' + (err.message || 'unknown error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Push notifications</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Get daily reminders when plants are due for care, even when the app is closed.
          </p>
        </div>
        {!hasNotification ? (
          <span className="text-xs text-gray-400">Not supported in this browser</span>
        ) : !isSecure ? (
          <span className="text-xs text-orange-500">Requires HTTPS</span>
        ) : permission === 'granted' ? (
          <button
            onClick={handleDisable}
            disabled={busy}
            className="shrink-0 text-sm border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {busy ? 'Disabling…' : 'Disable'}
          </button>
        ) : (
          <button
            onClick={handleEnable}
            disabled={busy || permission === 'denied'}
            className="shrink-0 bg-green-600 text-white text-sm px-3 py-1.5 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {busy ? 'Enabling…' : 'Enable'}
          </button>
        )}
      </div>
      {permission === 'denied' && (
        <p className="text-xs text-orange-600 mt-2">Notifications are blocked. Allow them in your browser settings.</p>
      )}
      {status && (
        <p className={`text-sm mt-2 ${status.startsWith('Failed') || status === 'Permission denied' ? 'text-red-500' : 'text-green-600'}`}>
          {status}
        </p>
      )}
    </div>
  )
}

function NotificationRemindersSection({ settings, onSaved }) {
  const [permission] = useState(() => ('Notification' in window ? Notification.permission : 'unsupported'))
  const [enabled, setEnabled] = useState(() => settings.notifications_enabled !== 'false')
  const [hour, setHour] = useState(() => parseInt(settings.notifications_hour ?? '8'))
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)

  if (permission !== 'granted') return null

  const handleSave = async (newEnabled, newHour) => {
    setSaving(true)
    setStatus(null)
    try {
      const update = { notifications_enabled: String(newEnabled), notifications_hour: String(newHour) }
      await saveSettings(update)
      onSaved(update)
      setStatus('saved')
    } catch {
      setStatus('error')
    } finally {
      setSaving(false)
    }
  }

  const toggle = async () => {
    const next = !enabled
    setEnabled(next)
    await handleSave(next, hour)
  }

  const changeHour = async (e) => {
    const next = parseInt(e.target.value)
    setHour(next)
    await handleSave(enabled, next)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
      <h3 className="font-semibold text-gray-900 dark:text-gray-100">Notification reminders</h3>

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-gray-700 dark:text-gray-300">Reminder notifications</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Notify when plants are due or overdue for care</p>
        </div>
        <button
          role="switch"
          aria-checked={enabled}
          onClick={toggle}
          disabled={saving}
          className={`relative shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${enabled ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-5' : ''}`} />
        </button>
      </div>

      {enabled && (
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-700 dark:text-gray-300 shrink-0">Notify at</label>
          <select
            value={hour}
            onChange={changeHour}
            disabled={saving}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50"
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
            ))}
          </select>
          <span className="text-xs text-gray-400 dark:text-gray-500">UTC</span>
        </div>
      )}

      {status === 'saved' && <p className="text-xs text-green-600">✓ Saved</p>}
      {status === 'error' && <p className="text-xs text-red-500">✗ Failed to save</p>}
    </div>
  )
}

function AIProviderSection({ initialValues, onSaved }) {
  const initialProvider = AI_PROVIDERS[initialValues.ai_provider]
    ? initialValues.ai_provider
    : 'anthropic'
  const [provider, setProvider] = useState(initialProvider)
  const [keys, setKeys] = useState({
    anthropic_api_key: initialValues.anthropic_api_key || '',
    openai_api_key: initialValues.openai_api_key || '',
  })
  const [showKey, setShowKey] = useState(false)
  const [busy, setBusy] = useState(null)
  const [status, setStatus] = useState(null)
  const selected = AI_PROVIDERS[provider]
  const values = { ai_provider: provider, [selected.key]: keys[selected.key] }

  const save = async (test = false) => {
    setBusy(test ? 'test' : 'save')
    setStatus(null)
    try {
      await saveSettings(values)
      onSaved(values)
      if (test) await getAiCare('Monstera', 'Monstera deliciosa')
      setStatus({ ok: true, message: test ? 'Connection successful!' : 'Settings saved.' })
    } catch (err) {
      setStatus({
        ok: false,
        message: err.response?.data?.detail || (test ? 'Connection failed. Check your API key.' : 'Failed to save.'),
      })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-4">
      <div className="p-5 border-b border-gray-100 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">AI care provider</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Generates schedules and care tips when species data is unavailable. Provider choice is explicit; requests never fail over.
        </p>
      </div>
      <div className="p-5 space-y-4">
        <div>
          <label htmlFor="ai-provider" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Provider</label>
          <select
            id="ai-provider"
            value={provider}
            onChange={e => { setProvider(e.target.value); setStatus(null) }}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            {Object.entries(AI_PROVIDERS).map(([id, option]) => (
              <option key={id} value={id}>{option.name} — {option.model}</option>
            ))}
          </select>
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <label htmlFor="ai-api-key" className="text-sm font-medium text-gray-700 dark:text-gray-300">{selected.name} API key</label>
            <a href={selected.signupUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-green-600 hover:underline">Get API key →</a>
          </div>
          <div className="relative">
            <input
              id="ai-api-key"
              type={showKey ? 'text' : 'password'}
              value={keys[selected.key]}
              onChange={e => setKeys(current => ({ ...current, [selected.key]: e.target.value }))}
              placeholder={selected.placeholder}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
            <button type="button" onClick={() => setShowKey(value => !value)} className="absolute right-3 top-2.5 text-gray-400 text-xs">
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
        {status && <p className={`text-sm ${status.ok ? 'text-green-600' : 'text-red-500'}`}>{status.ok ? '✓ ' : '✗ '}{status.message}</p>}
        <div className="flex gap-2">
          <button onClick={() => save()} disabled={busy} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
            {busy === 'save' ? 'Saving…' : 'Save'}
          </button>
          <button onClick={() => save(true)} disabled={busy || !keys[selected.key]} className="border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40">
            {busy === 'test' ? 'Testing…' : 'Test connection'}
          </button>
        </div>
      </div>
    </div>
  )
}

function IntegrationCard({ integration, initialValues, onSaved }) {
  const [values, setValues] = useState(
    Object.fromEntries(integration.fields.map(f => [f.key, initialValues[f.key] || '']))
  )
  const [show, setShow] = useState({})
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [status, setStatus] = useState(null) // null | 'saved' | 'error' | 'ok' | 'fail'
  const [statusMsg, setStatusMsg] = useState('')

  const isConfigured = integration.fields.every(f => initialValues[f.key])

  const handleSave = async () => {
    setSaving(true)
    setStatus(null)
    try {
      await saveSettings(values)
      setStatus('saved')
      setStatusMsg('Settings saved.')
      onSaved(values)
    } catch {
      setStatus('error')
      setStatusMsg('Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setStatus(null)
    // Save first so the backend picks up the new key
    try {
      await saveSettings(values)
      onSaved(values)
      await integration.test(values)
      setStatus('ok')
      setStatusMsg('Connection successful!')
    } catch (err) {
      setStatus('fail')
      setStatusMsg(err.response?.data?.detail || 'Connection failed. Check your API key.')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{integration.name}</h3>
            {isConfigured ? (
              <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">Connected</span>
            ) : (
              <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">Not configured</span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{integration.description}</p>
          <div className="flex gap-3 mt-2">
            <a href={integration.signupUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs text-green-600 hover:underline">Get API key →</a>
            {integration.docsUrl && (
              <a href={integration.docsUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs text-gray-400 hover:underline">Docs</a>
            )}
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {integration.fields.map(field => (
          <div key={field.key}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{field.label}</label>
            <div className="relative">
              <input
                type={show[field.key] || !field.secret ? 'text' : 'password'}
                value={values[field.key]}
                onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
              {field.secret && (
                <button
                  type="button"
                  onClick={() => setShow(s => ({ ...s, [field.key]: !s[field.key] }))}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 text-xs"
                >
                  {show[field.key] ? 'Hide' : 'Show'}
                </button>
              )}
            </div>
          </div>
        ))}

        {status && (
          <p className={`text-sm ${
            status === 'ok' || status === 'saved' ? 'text-green-600' : 'text-red-500'
          }`}>
            {status === 'ok' || status === 'saved' ? '✓ ' : '✗ '}{statusMsg}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={handleTest}
            disabled={testing || !values[integration.fields[0].key]}
            className="border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
          >
            {testing ? 'Testing…' : 'Test connection'}
          </button>
        </div>
      </div>
    </div>
  )
}

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

export default function SettingsPage({ theme, setTheme }) {
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const { updateSettings: updateAppSettings } = useAppSettings()
  const [appInfo, setAppInfo] = useState(null)
  const serverUrl = getServerUrl()
  const { user, signIn } = useAuth()
  const [profileName, setProfileName] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileStatus, setProfileStatus] = useState(null)

  useEffect(() => {
    if (user) setProfileName(user.name)
  }, [user])

  useEffect(() => {
    getSettings().then(s => { setSettings(s); setLoading(false) }).catch(() => setLoading(false))
    getVersion().then(setAppInfo).catch(() => {})
  }, [])

  const handleChangeServer = () => {
    clearServerUrl()
    localStorage.removeItem('token')
    window.location.href = '/'
  }

  const handleSaveProfile = async () => {
    setProfileSaving(true)
    setProfileStatus(null)
    try {
      const updated = await updateMe(profileName)
      signIn(localStorage.getItem('token'), updated)
      setProfileStatus('saved')
    } catch {
      setProfileStatus('error')
    } finally {
      setProfileSaving(false)
    }
  }

  if (loading) return <p className="text-center py-20 text-gray-400">Loading…</p>

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">Settings</h1>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">Configure integrations and preferences</p>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">Profile</h2>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display name</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={profileName}
              onChange={e => { setProfileName(e.target.value); setProfileStatus(null) }}
              className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
            <button
              onClick={handleSaveProfile}
              disabled={profileSaving || !profileName.trim()}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {profileSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
          {profileStatus === 'saved' && <p className="text-sm text-green-600 mt-2">✓ Name updated.</p>}
          {profileStatus === 'error' && <p className="text-sm text-red-500 mt-2">✗ Failed to save.</p>}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">Appearance</h2>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
          <div className="p-5 flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Theme</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Choose light, dark, or follow your device setting.
              </p>
            </div>
            <div className="flex rounded-lg bg-gray-100 dark:bg-gray-700 p-1 shrink-0">
              {['light', 'dark', 'system'].map((opt) => (
                <button key={opt} onClick={() => setTheme(opt)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                    theme === opt
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}>
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {[
            { key: 'show_source_link', label: 'Show GitHub link', desc: 'Display a link to the source code in the sidebar' },
            { key: 'show_version', label: 'Show version', desc: 'Display the app version number in the sidebar' },
          ].map(({ key, label, desc }) => {
            const enabled = settings[key] !== 'false'
            const toggle = async () => {
              const next = String(!enabled)
              setSettings(s => ({ ...s, [key]: next }))
              updateAppSettings({ [key]: next })
              await saveSettings({ [key]: next })
            }
            return (
              <div key={key} className="p-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{desc}</p>
                </div>
                <button
                  role="switch"
                  aria-checked={enabled}
                  onClick={toggle}
                  className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-5' : ''}`} />
                </button>
              </div>
            )
          })}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">Server</h2>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Connected server</p>
            <p className="text-sm font-mono text-gray-500 dark:text-gray-400 mt-0.5">{serverUrl || window.location.origin}</p>
          </div>
          <button
            onClick={handleChangeServer}
            className="shrink-0 text-sm border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Change server
          </button>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">Notifications</h2>
        <div className="space-y-3">
          <NotificationsSection />
          <NotificationRemindersSection
            settings={settings}
            onSaved={updated => setSettings(s => ({ ...s, ...updated }))}
          />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
          Integrations
        </h2>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
          API keys are stored per account and are only accessible to you.
          {user?.is_demo && (
            <span className="text-amber-600 dark:text-amber-400">
              {' '}This is a public demo instance — enter keys at your own risk.
            </span>
          )}
        </p>
        <AIProviderSection
          initialValues={settings}
          onSaved={updated => setSettings(s => ({ ...s, ...updated }))}
        />
        <div className="space-y-4">
          {INTEGRATIONS.map(integration => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              initialValues={settings}
              onSaved={updated => setSettings(s => ({ ...s, ...updated }))}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">About</h2>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">SproutVibe</p>
            {appInfo?.version && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Version {appInfo.version}</p>
            )}
          </div>
          <a
            href={appInfo?.source_url ?? 'https://github.com/jorisdejosselin/sproutvibe'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors shrink-0"
          >
            <GitHubIcon />
            <span>View source</span>
          </a>
        </div>
      </section>
    </div>
  )
}
