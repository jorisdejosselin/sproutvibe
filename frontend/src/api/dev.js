import api from './client'

export const devForceAllDue = () => api.post('/dev/force-due').then(r => r.data)
export const devResetAllDue = () => api.post('/dev/reset-due').then(r => r.data)
export const devSendTestPush = () => api.post('/dev/send-test-push').then(r => r.data)
export const devTriggerNotifications = () => api.post('/dev/trigger-notifications').then(r => r.data)
export const devNotifySchedule = (scheduleId) => api.post(`/dev/notify-schedule/${scheduleId}`).then(r => r.data)
export const devGetPlantsSchedules = () => api.get('/dev/plants-schedules').then(r => r.data)
export const devSetNotificationHour = (hour) => api.post('/dev/set-notification-hour', { hour }).then(r => r.data)
