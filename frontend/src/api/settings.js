import api from './client'

export const getSettings = () => api.get('/settings/').then(r => r.data.data)
export const saveSettings = (data) => api.put('/settings/', { data }).then(r => r.data.data)
export const getVersion = () => api.get('/version').then(r => r.data)
