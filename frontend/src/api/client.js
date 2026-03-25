import axios from 'axios'

export const SERVER_URL_KEY = 'sprout_server_url'

export function getServerUrl() {
  return localStorage.getItem(SERVER_URL_KEY) || ''
}

export function setServerUrl(url) {
  // Strip trailing slash
  localStorage.setItem(SERVER_URL_KEY, url.replace(/\/$/, ''))
}

export function clearServerUrl() {
  localStorage.removeItem(SERVER_URL_KEY)
}

const api = axios.create()

api.interceptors.request.use((config) => {
  const serverUrl = getServerUrl()
  config.baseURL = serverUrl ? `${serverUrl}/api` : '/api'
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      // No hard redirect — ProtectedRoute redirects to /login when user is null,
      // and useAuth can intercept to create a new demo session in kiosk mode.
    }
    return Promise.reject(err)
  }
)

/** Resolve a photo_url that may be a relative path (e.g. /uploads/foo.jpg)
 *  to an absolute URL using the configured server URL.
 *  In a browser this works fine, but in the Capacitor WebView the base is
 *  https://localhost so relative paths need the server URL prepended. */
export function resolveMediaUrl(url) {
  if (!url) return url
  if (url.startsWith('http')) return url
  const base = getServerUrl()
  return base ? `${base}${url}` : url
}

export default api
