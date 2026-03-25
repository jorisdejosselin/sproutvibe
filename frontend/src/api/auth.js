import api from './client'

export const register = (name, email, password) =>
  api.post('/auth/register', { name, email, password }).then(r => r.data)

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

export const getKioskStatus = () => api.get('/auth/kiosk').then(r => r.data)

export const createDemoSession = () => api.post('/auth/demo').then(r => r.data)
