import api from './client'

export const getSchedules = (plantId) => api.get(`/plants/${plantId}/schedules/`).then(r => r.data)
export const createSchedule = (plantId, data) => api.post(`/plants/${plantId}/schedules/`, data).then(r => r.data)
export const updateSchedule = (plantId, scheduleId, data) => api.patch(`/plants/${plantId}/schedules/${scheduleId}`, data).then(r => r.data)
export const deleteSchedule = (plantId, scheduleId) => api.delete(`/plants/${plantId}/schedules/${scheduleId}`)
export const markDone = (plantId, scheduleId) => api.post(`/plants/${plantId}/schedules/${scheduleId}/done`).then(r => r.data)
export const getDueTasks = () => api.get('/schedules/due').then(r => r.data)
export const getScheduleSummary = () => api.get('/schedules/summary').then(r => r.data)

export const devForceAllDue = () => api.post('/dev/force-due').then(r => r.data)
export const devResetAllDue = () => api.post('/dev/reset-due').then(r => r.data)
