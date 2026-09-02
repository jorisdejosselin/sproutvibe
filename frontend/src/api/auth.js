import api from './client'

export const register = (name, email, password, inviteCode) =>
  api.post('/auth/register', { name, email, password, invite_code: inviteCode || null }).then(r => r.data)

export const login = async (email, password) => {
  const form = new URLSearchParams()
  form.append('username', email)
  form.append('password', password)
  const res = await api.post('/auth/token', form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  return res.data
}

export const getMe = () => api.get('/auth/me').then(r => r.data)

export const updateMe = (name) => api.put('/auth/me', { name }).then(r => r.data)

// Changing the password invalidates every existing token, including this
// client's, so the caller must sign in again afterwards.
export const changePassword = (currentPassword, newPassword) =>
  api.post('/auth/me/password', {
    current_password: currentPassword,
    new_password: newPassword,
  }).then(r => r.data)

export const getKioskStatus = () => api.get('/auth/kiosk').then(r => r.data)

// Whether this server accepts self-service signups, and whether an invite code
// is needed. Falls back to "open" so an older backend keeps working.
export const getRegistrationStatus = () =>
  api.get('/auth/registration')
    .then(r => r.data)
    .catch(() => ({ allowed: true, invite_required: false }))

export const createDemoSession = () => api.post('/auth/demo').then(r => r.data)
